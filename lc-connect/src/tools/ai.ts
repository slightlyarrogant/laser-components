import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  KPI_WIDGET_URI,
  buildKpiEnvelope,
  type KpiItem,
  type KpiMeta,
  ACTION_WIDGET_URI,
  buildActionEnvelope,
} from "@cfi/mcp-widgets";
import { DATASET_WIDGET_URI, okList } from "../datasets.js";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import {
  AUDIT_DEFAULT_LIMIT,
  AUDIT_MAX_LIMIT,
  normalizeAuditLimit,
  parseSince,
  queryAuditLog,
} from "../core/audit.js";
import { getCurrentUser } from "../core/current-user.js";
import { audit } from "../core/audit.js";
import { canEditLead, type LeadAccessFields } from "../core/access.js";
import { child, errMessage } from "../core/log.js";
import { LONG_JOB_RULE, PRESENT_BRIEFLY, SLOW_AI_RULE } from "./_present.js";
import {
  type AiSource,
  SCORING_FACTOR_LABELS,
  SCORING_FACTOR_WEIGHTS,
  extractFactorScore,
  extractNextSteps,
  formatSources,
  isoDate,
  mergeSources,
  parseSources,
  weightedOverall,
  Limiter,
  resolveEnrichmentAreas,
  shouldRunInBackground,
  formatJobStarted,
  formatJobStatus,
  estimateEnrichment,
  type EnrichmentArea,
} from "./ai-helpers.js";

/**
 * AI / market-intelligence domain.
 *
 * The Perplexity-backed tools reach out to an external web-search model
 * (openWorldHint=true) and return the provider's cited sources. They are
 * read-only with respect to the LC database EXCEPT enrich_lead and
 * generate_lead_score, which store their result as a lead note (enrich_lead
 * also sets leads.last_enriched and writes an enrichment_jobs row). The Prisma
 * queries (export_data, generate_insights, get_activity_feed, generate_report,
 * and the context-loading reads) are ported verbatim from the old low-level
 * `tools/ai.ts`; only the transport shape (zod schema + high-level `server.tool`)
 * and the descriptions have changed.
 *
 * The Perplexity client is ported verbatim from the old implementation: same env
 * var (PERPLEXITY_API_KEY), same base URL, model, system prompt, temperature and
 * max_tokens. The only change is using the global `fetch` (Node >= 20) instead of
 * the `node-fetch` require, which is behaviourally identical for this call shape.
 */

// Row count above which a list result is emitted as a DATASET widget rather than
// inline JSON (mirrors the threshold used by get_products/get_leads).
const DATASET_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Perplexity client (inline, no external file dependency)
// ---------------------------------------------------------------------------

/** One AI call's outcome: the answer text plus the sources the provider cited. */
type AiResult = {
  text: string;
  sources: AiSource[];
  /** Every distinct cited URL (uncapped), for counting sources read. */
  allSourceUrls: string[];
  provider: string;
  model: string;
  durationMs: number;
};

const AI_PROVIDER = "perplexity";
const AI_TIMEOUT_MS = 45_000;

function aiModel(): string {
  // Perplexity retired the llama-3.1-sonar-* names (2025); "sonar" is the cheaper option.
  return process.env.PERPLEXITY_MODEL || "sonar-pro";
}

class PerplexityClient {
  private apiKey: string;
  private baseUrl = "https://api.perplexity.ai";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Perplexity API key is required");
    this.apiKey = apiKey;
  }

  async analyze(prompt: string, context?: string): Promise<AiResult> {
    let userMessage = prompt;
    if (context) userMessage = `Context: ${context}\n\nRequest: ${prompt}`;

    const model = aiModel();
    const body = {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant specialized in laser components and photonics industry analysis. Provide concise, data-driven insights.",
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    };

    const t0 = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Without a deadline a hung upstream pins the request (and its MCP
      // transport) open indefinitely. sonar-pro answers with web search
      // routinely take 20-35 s, so 30 s was too tight.
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${error.slice(0, 300)}`);
    }

    const data = (await response.json()) as any;
    return {
      text: data.choices?.[0]?.message?.content || "No response generated",
      sources: parseSources(data),
      allSourceUrls: parseSources(data, Number.POSITIVE_INFINITY).map((x) => x.url),
      provider: AI_PROVIDER,
      model: typeof data.model === "string" && data.model ? data.model : model,
      durationMs: Date.now() - t0,
    };
  }
}

let _perplexity: PerplexityClient | null = null;

function getPerplexity(): PerplexityClient {
  if (!_perplexity) {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) throw new Error("PERPLEXITY_API_KEY environment variable is not set");
    _perplexity = new PerplexityClient(key);
  }
  return _perplexity;
}

const aiLog = child({ mod: "ai" });

/**
 * The single entry point for AI calls from tools: runs the call and logs one
 * line (tool, lead id, provider, model, duration, citations count, ok/error).
 * Never logs prompts or answers.
 */
async function callAi(
  tool: string,
  leadId: number | null,
  prompt: string,
  context?: string
): Promise<AiResult> {
  const t0 = Date.now();
  try {
    const r = await getPerplexity().analyze(prompt, context);
    aiLog.info(
      { tool, leadId, provider: r.provider, model: r.model, durationMs: r.durationMs, citations: r.sources.length, ok: true },
      "ai call"
    );
    return r;
  } catch (err) {
    aiLog.warn(
      { tool, leadId, provider: AI_PROVIDER, model: aiModel(), durationMs: Date.now() - t0, citations: 0, ok: false, error: errMessage(err) },
      "ai call failed"
    );
    throw err;
  }
}

/** JSON payload for the model, followed by a plain-text Sources block. */
function okWithSources(data: Record<string, unknown>, sources: AiSource[]) {
  return {
    content: [
      {
        type: "text" as const,
        text: `${JSON.stringify(data, null, 2)}\n\n${formatSources(sources)}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Export / report formatting utils (inline, ported verbatim)
// ---------------------------------------------------------------------------

function convertToCSV(data: any[], fields?: string[]): string {
  if (!data || data.length === 0) return "";
  const keys = fields || Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((item) => {
    return keys
      .map((key) => {
        const value = item[key];
        if (typeof value === "object" && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      })
      .join(",");
  });
  return [header, ...rows].join("\n");
}

function createTableHTML(data: any[]): string {
  if (!data || data.length === 0) return "<p>No data available</p>";
  const keys = Object.keys(data[0]);
  const headerRow = `<tr>${keys.map((k) => `<th>${k}</th>`).join("")}</tr>`;
  const dataRows = data
    .map((item) => {
      const cells = keys
        .map((key) => {
          const value = item[key];
          if (typeof value === "object" && value !== null) return `<td>${JSON.stringify(value)}</td>`;
          return `<td>${value ?? ""}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table>${headerRow}${dataRows}</table>`;
}

function createTableMarkdown(data: any[]): string {
  if (!data || data.length === 0) return "_No data available_";
  const keys = Object.keys(data[0]);
  const header = `| ${keys.join(" | ")} |`;
  const separator = `| ${keys.map(() => "---").join(" | ")} |`;
  const rows = data.map((item) => {
    const cells = keys
      .map((key) => {
        const value = item[key];
        if (typeof value === "object" && value !== null) return JSON.stringify(value);
        return String(value ?? "");
      })
      .join(" | ");
    return `| ${cells} |`;
  });
  return [header, separator, ...rows].join("\n");
}

function generateHTMLReport(
  title: string,
  sections: Array<{ title: string; content: string; type: "text" | "table" | "list" }>
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #3498db; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .timestamp { color: #7f8c8d; font-size: 0.9em; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${sections
    .map(
      (s) =>
        `<h2>${s.title}</h2>${s.type === "text" ? `<p>${s.content}</p>` : `<div>${s.content}</div>`}`
    )
    .join("")}
  <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`.trim();
}

function generateMarkdownReport(
  title: string,
  sections: Array<{ title: string; content: string; type: "text" | "table" | "list" }>
): string {
  const lines = [`# ${title}`, "", `_Generated on: ${new Date().toLocaleString()}_`, ""];
  sections.forEach((s) => {
    lines.push(`## ${s.title}`, "", s.content, "");
  });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// enrich_lead execution + background job runtime
//
// Background jobs run in-process, fire-and-forget: the tool call returns a job
// id at once and the work continues after the MCP response is sent. The
// promise keeps the request's AsyncLocalStorage store, so audit() still
// attributes the write to the caller. Nothing is tied to the request's
// AbortSignal (the Perplexity fetch has its own 45 s deadline per call).
//
// Lifecycle guarantees for the enrichment_jobs row:
//   - every exit of executeEnrichment writes COMPLETED or FAILED;
//   - SIGTERM: failRunningEnrichmentJobs("server restart") (src/index.ts);
//   - crash/SIGKILL: the sweeper marks PROCESSING rows older than 10 min that
//     no live worker owns as FAILED (at startup and every 5 min), and
//     get_enrichment_status reports such a row as failed straight away.
// ---------------------------------------------------------------------------

const ENRICH_CONCURRENCY = 2;
const ENRICH_MAX_QUEUED = 8;
const STALE_JOB_MS = 10 * 60_000;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const PROCESS_STARTED_AT = new Date();

const enrichLimiter = new Limiter(ENRICH_CONCURRENCY);
const activeEnrichmentJobs = new Set<number>();
let acceptingJobs = true;

type EnrichPlanItem = { key: EnrichmentArea; title: string; prompt: string };
type EnrichLead = { id: number; name: string; industry: string | null; website: string | null };

type EnrichmentRun = {
  jobId: number | null;
  lead: EnrichLead;
  plan: EnrichPlanItem[];
  mayEdit: boolean;
  userId: number;
  jobMeta: Record<string, unknown>;
  startedAt: Date;
};

function buildEnrichmentPlan(lead: EnrichLead, areas: EnrichmentArea[]): EnrichPlanItem[] {
  const prompts: Record<EnrichmentArea, { title: string; prompt: string }> = {
    company_info: {
      title: "Company info",
      prompt: `Research company information for "${lead.name}"${lead.website ? ` (${lead.website})` : ""}. Provide: company size, founding year, key product/services, headquarters location, and recent news.`,
    },
    market_position: {
      title: "Market position",
      prompt: `Analyze the market position of "${lead.name}" in the ${lead.industry || "laser/photonics"} industry. Include market share, competitive advantages, and industry reputation.`,
    },
    technology_stack: {
      title: "Technology stack",
      prompt: `Identify the technology stack and technical capabilities of "${lead.name}". Focus on their use of laser/photonics technologies and related systems.`,
    },
    growth_potential: {
      title: "Growth potential",
      prompt: `Assess the growth potential of "${lead.name}". Consider funding status, market expansion, product development, and industry trends affecting their business.`,
    },
  };
  return areas.map((key) => ({ key, ...prompts[key] }));
}

/** durationMs + calls of the last 50 completed enrichment jobs (for the estimate). */
async function recentJobHistory(): Promise<Array<{ durationMs?: unknown; calls?: unknown }>> {
  try {
    const rows = await prisma.enrichmentJob.findMany({
      where: { status: "COMPLETED" },
      orderBy: { id: "desc" },
      take: 50,
      select: { metadata: true },
    });
    return rows.map((r) => parseJson(r.metadata) ?? {});
  } catch (err) {
    aiLog.warn({ error: errMessage(err) }, "enrichment history read failed");
    return [];
  }
}

function parseJson(s: string | null | undefined): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function createEnrichmentJob(
  leadId: number,
  jobMeta: Record<string, unknown>,
  startedAt: Date
): Promise<number | null> {
  try {
    const job = await prisma.enrichmentJob.create({
      data: {
        leadId,
        status: "PROCESSING",
        attempts: 1,
        lastAttemptAt: startedAt,
        updatedAt: startedAt,
        provider: AI_PROVIDER,
        metadata: JSON.stringify(jobMeta),
      },
      select: { id: true },
    });
    return job.id;
  } catch (err) {
    aiLog.error({ tool: "enrich_lead", leadId, error: errMessage(err) }, "enrichment job create failed");
    return null;
  }
}

async function markJobFailed(jobId: number, meta: Record<string, unknown>, error: string): Promise<void> {
  const finishedAt = new Date();
  await prisma.enrichmentJob
    .update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: finishedAt,
        updatedAt: finishedAt,
        metadata: JSON.stringify({ ...meta, finishedAt: finishedAt.toISOString(), error: error.slice(0, 500) }),
      },
      select: { id: true },
    })
    .catch((e) => aiLog.error({ jobId, error: errMessage(e) }, "enrichment job update failed"));
}

/**
 * Runs the AI calls, persists the note + last_enriched, closes the job row and
 * writes the audit entry. Same behaviour inline and in the background. Throws
 * (after marking the job FAILED + auditing) when an AI call fails.
 */
async function executeEnrichment(r: EnrichmentRun) {
  const { jobId, lead, plan, mayEdit, jobMeta, startedAt } = r;
  const leadId = lead.id;
  const model = aiModel();

  const results: Array<{ key: string; title: string; ai: AiResult }> = [];
  try {
    for (const p of plan) {
      results.push({ key: p.key, title: p.title, ai: await callAi("enrich_lead", leadId, p.prompt) });
    }
  } catch (err) {
    if (jobId != null) {
      await markJobFailed(
        jobId,
        { ...jobMeta, durationMs: Date.now() - startedAt.getTime(), callsCompleted: results.length },
        errMessage(err)
      );
    }
    await audit({
      action: "lead.enrichment_failed",
      resourceType: "lead",
      resourceId: leadId,
      details: { leadName: lead.name, jobId, provider: AI_PROVIDER, model, error: errMessage(err) },
    });
    throw err;
  }

  const sources = mergeSources(results.map((x) => x.ai.sources));
  const distinctSources = new Set(results.flatMap((x) => x.ai.allSourceUrls ?? [])).size;
  const usedModel = results[0]?.ai.model ?? model;
  const finishedAt = new Date();
  const date = isoDate(finishedAt);

  const enrichedData: Record<string, string> = {};
  for (const x of results) enrichedData[x.key] = x.ai.text;

  const body = [
    `Enrichment (Perplexity ${usedModel}, ${date})`,
    "",
    ...results.flatMap((x) => [`## ${x.title}`, x.ai.text.trim(), ""]),
    formatSources(sources),
  ].join("\n");

  // Persist: note + last_enriched, only when the caller may edit the lead.
  let noteId: number | null = null;
  let persisted: Record<string, unknown>;
  if (!mayEdit) {
    persisted = {
      saved: false,
      reason:
        "You may not edit this lead, so no note was saved and last_enriched was not updated. " +
        "The owner or an ADMIN can run enrich_lead to store it.",
    };
  } else {
    try {
      const [note] = await prisma.$transaction([
        prisma.note.create({
          data: { leadId, content: `[ENRICHMENT] ${body}`, user_id: r.userId },
          select: { id: true },
        }),
        prisma.lead.update({
          where: { id: leadId },
          data: { lastEnriched: finishedAt },
          select: { id: true },
        }),
      ]);
      noteId = note.id;
      persisted = { saved: true, noteId, lastEnriched: finishedAt.toISOString() };
    } catch (err) {
      aiLog.error({ tool: "enrich_lead", leadId, error: errMessage(err) }, "enrichment persist failed");
      persisted = { saved: false, reason: `Saving the enrichment note failed: ${errMessage(err)}` };
    }
  }

  if (jobId != null) {
    await prisma.enrichmentJob
      .update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: finishedAt,
          updatedAt: finishedAt,
          // The text is kept on the job too, so a background result is readable
          // via get_enrichment_status even when no note could be saved.
          result: JSON.stringify({
            noteId,
            saved: persisted.saved === true,
            reason: persisted.saved === true ? undefined : persisted.reason,
            sources: sources.map((s) => s.url),
            text: body,
          }),
          metadata: JSON.stringify({
            ...jobMeta,
            model: usedModel,
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            calls: results.length,
            citations: sources.length,
            distinctSources,
          }),
        },
        select: { id: true },
      })
      .catch((e) => aiLog.error({ jobId, error: errMessage(e) }, "enrichment job update failed"));
  }

  await audit({
    action: "lead.enriched",
    resourceType: "lead",
    resourceId: leadId,
    details: {
      leadName: lead.name,
      jobId,
      noteId,
      saved: persisted.saved === true,
      enrichmentTypes: plan.map((p) => p.key),
      provider: AI_PROVIDER,
      model: usedModel,
      citations: sources.length,
    },
  });

  return { enrichedData, sources, finishedAt, persisted, noteId };
}

/** Fire-and-forget: never throws, never rejects unhandled. */
function startBackgroundEnrichment(r: EnrichmentRun): void {
  const jobId = r.jobId as number;
  activeEnrichmentJobs.add(jobId);
  void enrichLimiter
    .run(async () => {
      if (!acceptingJobs) return; // shutdown already marked the row FAILED
      const t0 = Date.now();
      await executeEnrichment(r);
      aiLog.info({ tool: "enrich_lead", leadId: r.lead.id, jobId, durationMs: Date.now() - t0, totalMs: Date.now() - r.startedAt.getTime() }, "enrichment job completed");
    })
    .catch(async (err) => {
      aiLog.warn({ tool: "enrich_lead", leadId: r.lead.id, jobId, error: errMessage(err) }, "enrichment job failed");
      // executeEnrichment marks FAILED itself on AI errors; this covers anything
      // that escaped before or after (only touches a row still PROCESSING).
      await prisma.enrichmentJob
        .updateMany({
          where: { id: jobId, status: "PROCESSING" },
          data: { status: "FAILED", completedAt: new Date(), updatedAt: new Date() },
        })
        .catch(() => undefined);
    })
    .finally(() => activeEnrichmentJobs.delete(jobId));
}

async function failJobs(where: { ids?: number[]; olderThan?: Date }, reason: string): Promise<number> {
  const rows = await prisma.enrichmentJob.findMany({
    where: {
      status: { in: ["PROCESSING", "PENDING"] },
      ...(where.ids ? { id: { in: where.ids } } : {}),
      ...(where.olderThan ? { createdAt: { lt: where.olderThan } } : {}),
    },
    select: { id: true, metadata: true },
  });
  let n = 0;
  for (const row of rows) {
    if (!where.ids && activeEnrichmentJobs.has(row.id)) continue; // a live worker owns it
    await markJobFailed(row.id, parseJson(row.metadata) ?? {}, reason);
    n++;
  }
  return n;
}

/**
 * SIGTERM path: stop starting queued jobs and mark every job this process owns
 * FAILED ("server restart"). Call BEFORE closing the HTTP server / Prisma.
 */
export async function failRunningEnrichmentJobs(reason = "server restart"): Promise<number> {
  acceptingJobs = false;
  const ids = [...activeEnrichmentJobs];
  if (ids.length === 0) return 0;
  const n = await failJobs({ ids }, reason);
  aiLog.warn({ jobs: ids, reason }, "enrichment jobs failed on shutdown");
  return n;
}

/** Marks PROCESSING rows older than 10 min that no live worker owns as FAILED. */
export async function failStaleEnrichmentJobs(olderThanMs: number = STALE_JOB_MS): Promise<number> {
  const n = await failJobs({ olderThan: new Date(Date.now() - olderThanMs) }, "server restart (job was left running)");
  if (n > 0) aiLog.warn({ jobs: n }, "stale enrichment jobs marked failed");
  return n;
}

/** Startup sweep + periodic sweep (unref'd). */
export function startEnrichmentJobSweeper(): void {
  const sweep = () =>
    failStaleEnrichmentJobs().catch((err) => aiLog.error({ error: errMessage(err) }, "enrichment job sweep failed"));
  void sweep();
  const t = setInterval(sweep, SWEEP_INTERVAL_MS);
  t.unref?.();
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerAiTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // analyze_product_market — Perplexity-backed market analysis for a product.
  // -------------------------------------------------------------------------
  server.tool(
    "analyze_product_market",
    [
      "analyze_product_market — AI market analysis (size, trends, applications, competitors) for a known product.",
      "USE WHEN: the user asks for market size, trends, competitors, or strategic",
      "market analysis for a specific product. Calls a web-backed AI (Perplexity), so",
      "results may include external/live information.",
      "DO NOT USE WHEN: the user only needs local catalog rows -> use",
      "get_products/search_products; or wants competitor-only detail -> use",
      "analyze_competition.",
      "DURATION: 10–30 s (one web-search call).",
      SLOW_AI_RULE,
      "RETURNS: { success, productId, productName, analysisType, analysis, timestamp,",
      "then a 'Sources:' list of cited URLs — an analytical narrative, not a",
      "DB change. Cite the sources when presenting.",
      "GOTCHAS: productId is required and must be resolved with search_products/",
      "get_products first; never guess IDs. Requires PERPLEXITY_API_KEY.",
    ].join("\n"),
    {
      productId: z.number().describe("Product ID to analyze (resolve via search_products/get_products)."),
      analysisType: z
        .enum(["market_size", "trends", "applications", "competitors", "full"])
        .optional()
        .default("full")
        .describe("Slice of analysis to produce. Defaults to 'full' (all dimensions)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      if (!a.productId) throw new Error("Product ID is required");

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: {
          subcategory: { include: { category: true } },
          product_applications: { include: { application: true } },
        },
      });
      if (!product) throw new Error(`Product with ID ${a.productId} not found`);

      const analysisType = a.analysisType || "full";

      const context = `Product: ${product.name}
Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}
Description: ${product.description || "N/A"}
Applications: ${product.product_applications.map((pa: any) => pa.application.name).join(", ") || "None mapped"}`;

      let prompt = "";
      switch (analysisType) {
        case "market_size":
          prompt = `Analyze the market size and growth potential for "${product.name}" in the laser/photonics industry. Include specific market segments and regional opportunities.`;
          break;
        case "trends":
          prompt = `Identify current and emerging trends related to "${product.name}" in the laser/photonics industry. Focus on technology advancements and market drivers.`;
          break;
        case "applications":
          prompt = `Discover potential applications for "${product.name}" across different industries. Consider both current and emerging use cases.`;
          break;
        case "competitors":
          prompt = `Identify key competitors and alternative solutions to "${product.name}" in the market. Compare features and market positioning.`;
          break;
        case "full":
        default:
          prompt = `Provide a comprehensive market analysis for "${product.name}" including: 1) Market size and growth potential, 2) Key applications and use cases, 3) Technology trends, 4) Competitive landscape, 5) Future opportunities.`;
      }

      const ai = await callAi("analyze_product_market", null, prompt, context);
      return okWithSources({
        success: true,
        productId: a.productId,
        productName: product.name,
        analysisType,
        analysis: ai.text,
        timestamp: new Date().toISOString(),
      }, ai.sources);
    }
  );

  // -------------------------------------------------------------------------
  // discover_applications — Perplexity-backed application discovery.
  // -------------------------------------------------------------------------
  server.tool(
    "discover_applications",
    [
      "discover_applications — AI discovery of industries/use cases a known product could serve.",
      "USE WHEN: the user asks what applications/industries/use cases a specific",
      "product could serve. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user only wants the applications already mapped to the",
      "product -> use get_product_applications.",
      "DURATION: 10–30 s (one web-search call).",
      SLOW_AI_RULE,
      "RETURNS: { success, data{ productId, productName, industryFocus, discoveries,",
      "recommendedActions, timestamp }, then a 'Sources:' list of cited URLs —",
      "suggestions only.",
      "GOTCHAS: productId is required (resolve via search_products/get_products); this",
      "does NOT create application records or mappings — review before",
      "create_application/create_product_application. Requires PERPLEXITY_API_KEY.",
    ].join("\n"),
    {
      productId: z.number().describe("Product ID to discover applications for."),
      industryFocus: z
        .string()
        .optional()
        .describe("Optional industry to focus the discovery on (e.g. 'defense', 'medical')."),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Number of applications to discover. Defaults to 5."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      if (!a.productId) throw new Error("Product ID is required");

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: { subcategory: { include: { category: true } } },
      });
      if (!product) throw new Error(`Product with ID ${a.productId} not found`);

      const limit = a.limit || 5;

      let prompt = `Discover ${limit} specific industrial or commercial applications for "${product.name}" (${product.description || "laser/photonics component"}).`;
      if (a.industryFocus) prompt += ` Focus specifically on applications in the ${a.industryFocus} industry.`;
      prompt += ` For each application, provide: 1) Application name, 2) Industry sector, 3) Use case description, 4) Technical requirements, 5) Market potential. Format as a structured list.`;

      const context = `Product Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}`;
      const ai = await callAi("discover_applications", null, prompt, context);

      return okWithSources({
        success: true,
        data: {
          productId: a.productId,
          productName: product.name,
          industryFocus: a.industryFocus || "all industries",
          discoveries: ai.text,
          recommendedActions: [
            "Review discovered applications for relevance",
            "Create application records for promising opportunities",
            "Map product to relevant applications",
            "Conduct deeper market research for top opportunities",
          ],
          timestamp: new Date().toISOString(),
        },
      }, ai.sources);
    }
  );

  // -------------------------------------------------------------------------
  // enrich_lead — Perplexity-backed lead enrichment. One area runs inline;
  // two or more areas (or async:true) run as a background job.
  // -------------------------------------------------------------------------
  server.tool(
    "enrich_lead",
    [
      "enrich_lead — AI enrichment of a known lead (company info, market position, tech stack, growth).",
      "USE WHEN: the user asks to research/enrich a specific lead with company,",
      "market, technology, or growth information. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user asks to change CRM fields (status, industry, website…)",
      "-> use update_lead after explicit confirmation.",
      "DURATION: ~5–15 s per focus area. ONE area runs inline and returns the findings.",
      "'all' or 2+ areas (or async:true) run in the BACKGROUND (1–3 min) and return",
      "IMMEDIATELY with a job id — the findings are not in that reply.",
      "RETURNS (inline): { success, data{ leadId, companyName, currentData, enrichedData,",
      "enrichmentTimestamp, persisted, recommendedActions } } followed by a",
      "'Sources:' list of cited URLs — cite them when presenting the findings.",
      "RETURNS (background): a short user-facing paragraph (job #N, saved to the lead's",
      "notes, estimated minutes from past runs) — read the result later with",
      "get_enrichment_status { jobId: N } or get_lead_notes.",
      "When this returns a job id, tell the user the process is running, that the result",
      "will be saved to the lead, the estimated time, and that you can check the status",
      "when they ask. Do not poll.",
      "PERSISTS: the findings + sources are saved as an [ENRICHMENT] note on the lead and",
      "leads.last_enriched is set (only if you may edit the lead; otherwise the text is",
      "kept on the job / returned, and persisted explains why no note was saved). Lead",
      "fields are NOT changed.",
      "GOTCHAS: leadId is required (resolve via get_leads/search_leads). Prefer the",
      "specific areas the user asked for over 'all'. Run one lead at a time; do not fan",
      "out across many leads in one turn. Requires PERPLEXITY_API_KEY.",
      LONG_JOB_RULE,
    ].join("\n"),
    {
      leadId: z.number().describe("Lead ID to enrich (resolve via get_leads/search_leads)."),
      enrichmentTypes: z
        .array(
          z.enum([
            "company_info",
            "market_position",
            "technology_stack",
            "growth_potential",
            "all",
          ])
        )
        .optional()
        .default(["all"])
        .describe(
          "Which enrichment dimensions to gather. 'all' runs every dimension (background job). " +
            "Defaults to ['all']. One dimension runs inline (~5–15 s)."
        ),
      async: z
        .boolean()
        .optional()
        .describe("Force a background job even for one area. Two or more areas always run in the background."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      if (!a.leadId) throw new Error("Lead ID is required");

      const me = await getCurrentUser();
      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: { product: true, application: true, region: true, country: true },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);
      const access: LeadAccessFields = {
        ownerUserId: lead.ownerUserId,
        createdByUserId: lead.createdByUserId,
        regionId: lead.regionId,
        countryRegionId: (lead.country as any)?.regionId ?? null,
      };
      const mayEdit = canEditLead(me, access);

      const areas = resolveEnrichmentAreas(a.enrichmentTypes);
      if (areas.length === 0) throw new Error("No enrichment area selected");
      const plan = buildEnrichmentPlan(lead, areas);
      const background = shouldRunInBackground(plan.length, a.async);

      if (background && enrichLimiter.active + enrichLimiter.waiting >= ENRICH_CONCURRENCY + ENRICH_MAX_QUEUED) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Too many enrichment jobs are already running or queued (${enrichLimiter.active + enrichLimiter.waiting}). ` +
                "Nothing was started. Tell the user to try again in a few minutes, and run one lead at a time.",
            },
          ],
        };
      }

      const queuedAhead =
        background && enrichLimiter.active >= ENRICH_CONCURRENCY ? enrichLimiter.waiting + 1 : 0;
      const estimate = estimateEnrichment(await recentJobHistory(), plan.length, queuedAhead, ENRICH_CONCURRENCY);
      const startedAt = new Date();
      const jobMeta: Record<string, unknown> = {
        tool: "enrich_lead",
        model: aiModel(),
        enrichmentTypes: plan.map((p) => p.key),
        mode: background ? "background" : "inline",
        estimatedMs: estimate.estimatedMs,
        estimateMsPerArea: estimate.msPerArea,
        estimateSamples: estimate.samples,
        userId: me.id,
        startedAt: startedAt.toISOString(),
      };
      // Job row first, so a crash mid-call still leaves a PROCESSING trace.
      const jobId = await createEnrichmentJob(a.leadId, jobMeta, startedAt);
      const run: EnrichmentRun = { jobId, lead, plan, mayEdit, userId: me.id, jobMeta, startedAt };

      if (background) {
        if (jobId == null) {
          throw new Error("Could not create the enrichment job record; nothing was started. Try again.");
        }
        startBackgroundEnrichment(run);
        aiLog.info(
          { tool: "enrich_lead", leadId: a.leadId, jobId, areas: plan.length, queuedAhead, estimatedMs: estimate.estimatedMs },
          "enrichment job started"
        );
        return {
          content: [
            {
              type: "text" as const,
              text: formatJobStarted({ jobId, leadName: lead.name, areas: plan.map((p) => p.key), estimate, queuedAhead }),
            },
          ],
        };
      }

      const out = await executeEnrichment(run);
      return okWithSources(
        {
          success: true,
          data: {
            leadId: a.leadId,
            companyName: lead.name,
            currentData: { industry: lead.industry, website: lead.website, location: lead.location },
            enrichedData: out.enrichedData,
            enrichmentTimestamp: out.finishedAt.toISOString(),
            persisted: out.persisted,
            jobId,
            recommendedActions: [
              "Review and validate AI-generated insights against the sources",
              "Update lead fields (industry, website, size) with update_lead if confirmed",
              "Schedule follow-up based on growth potential",
              "Identify cross-sell opportunities",
            ],
          },
        },
        out.sources
      );
    }
  );

  // -------------------------------------------------------------------------
  // get_enrichment_status — read a background enrichment job.
  // -------------------------------------------------------------------------
  server.tool(
    "get_enrichment_status",
    [
      "get_enrichment_status — status and result of an enrich_lead background job.",
      "USE WHEN: enrich_lead returned a job id and the user asks whether it is done or",
      "what it found (or at the next turn after starting it).",
      "DO NOT USE WHEN: you just started the job in this same reply — say it is running",
      "instead. Never call this in a loop.",
      "RETURNS: status (RUNNING / COMPLETED / FAILED), timings, and on COMPLETED the",
      "full enrichment text with its 'Sources:' list; on FAILED the error.",
      "INPUT: jobId, or leadId for that lead's most recent job.",
      "DURATION: instant (database read).",
    ].join("\n"),
    {
      jobId: z.number().optional().describe("Job id returned by enrich_lead."),
      leadId: z.number().optional().describe("Lead id: returns that lead's most recent enrichment job."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      if (a.jobId == null && a.leadId == null) throw new Error("Pass jobId or leadId");

      const job =
        a.jobId != null
          ? await prisma.enrichmentJob.findUnique({ where: { id: a.jobId }, include: { lead: { select: { name: true } } } })
          : await prisma.enrichmentJob.findFirst({
              where: { leadId: a.leadId! },
              orderBy: { id: "desc" },
              include: { lead: { select: { name: true } } },
            });
      if (!job) {
        return {
          content: [
            {
              type: "text" as const,
              text: a.jobId != null ? `No enrichment job #${a.jobId}.` : `No enrichment job for lead ${a.leadId}.`,
            },
          ],
        };
      }

      const metadata = parseJson(job.metadata);
      const result = parseJson(job.result);
      let noteContent: string | null = null;
      if (job.status === "COMPLETED" && typeof result?.noteId === "number") {
        const note = await prisma.note.findUnique({ where: { id: result.noteId as number }, select: { content: true } });
        noteContent = note?.content ?? null;
      }
      const orphaned =
        (job.status === "PROCESSING" || job.status === "PENDING") &&
        !activeEnrichmentJobs.has(job.id) &&
        job.createdAt < PROCESS_STARTED_AT;

      return {
        content: [
          {
            type: "text" as const,
            text: formatJobStatus({
              id: job.id,
              leadId: job.leadId,
              leadName: job.lead?.name ?? null,
              status: job.status,
              createdAt: job.createdAt,
              completedAt: job.completedAt,
              metadata,
              result,
              noteContent,
              orphaned,
            }),
          },
        ],
      };
    }
  );

  // -------------------------------------------------------------------------
  // analyze_competition — Perplexity-backed competitive analysis.
  // -------------------------------------------------------------------------
  server.tool(
    "analyze_competition",
    [
      "analyze_competition — AI competitive analysis (competitors, positioning, SWOT) for a known product.",
      "USE WHEN: the user asks for competitors, market positioning, SWOT, or",
      "alternative solutions for a specific product. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user only wants local product/application records -> use",
      "get_products/get_product_applications.",
      "DURATION: 10–30 s (one web-search call; 'comprehensive' is the slow end).",
      SLOW_AI_RULE,
      "RETURNS: { success, productId, productName, analysisDepth, focusedCompetitors,",
      "analysis, recommendations, timestamp, then a 'Sources:' list of cited URLs.",
      "GOTCHAS: productId is required; optional competitorNames narrows the analysis.",
      "Requires PERPLEXITY_API_KEY.",
    ].join("\n"),
    {
      productId: z.number().describe("Product ID to analyze competitively."),
      competitorNames: z
        .array(z.string())
        .optional()
        .describe("Optional specific competitor names to focus the analysis on."),
      analysisDepth: z
        .enum(["quick", "standard", "comprehensive"])
        .optional()
        .default("standard")
        .describe("Depth of analysis. Defaults to 'standard'."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      if (!a.productId) throw new Error("Product ID is required");

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: { subcategory: { include: { category: true } } },
      });
      if (!product) throw new Error(`Product with ID ${a.productId} not found`);

      const analysisDepth = a.analysisDepth || "standard";
      const competitorNames = Array.isArray(a.competitorNames) ? a.competitorNames : [];

      let prompt = `Perform a ${analysisDepth} competitive analysis for "${product.name}" in the laser/photonics industry.`;
      if (competitorNames.length > 0) prompt += ` Focus on these specific competitors: ${competitorNames.join(", ")}.`;

      switch (analysisDepth) {
        case "quick":
          prompt += ` Provide: 1) Top 3-5 competitors, 2) Key differentiators, 3) Market positioning.`;
          break;
        case "comprehensive":
          prompt += ` Provide detailed analysis including: 1) Complete competitor list with company profiles, 2) Feature comparison matrix, 3) Pricing strategies, 4) Market share estimates, 5) SWOT analysis, 6) Technology advantages/disadvantages, 7) Customer base analysis, 8) Future threats and opportunities.`;
          break;
        default:
          prompt += ` Include: 1) Main competitors (5-7), 2) Product feature comparison, 3) Pricing comparison, 4) Market positioning, 5) Competitive advantages and weaknesses, 6) Strategic recommendations.`;
      }

      const context = `Product Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}
Product Description: ${product.description || "N/A"}`;

      const ai = await callAi("analyze_competition", null, prompt, context);
      return okWithSources({
        success: true,
        productId: a.productId,
        productName: product.name,
        analysisDepth,
        focusedCompetitors: competitorNames,
        analysis: ai.text,
        recommendations: [
          "Review competitive positioning",
          "Identify unique value propositions",
          "Develop differentiation strategies",
          "Monitor competitor activities regularly",
        ],
        timestamp: new Date().toISOString(),
      }, ai.sources);
    }
  );

  // -------------------------------------------------------------------------
  // generate_insights — DB-context summarized into a Perplexity analysis.
  // -------------------------------------------------------------------------
  server.tool(
    "generate_insights",
    [
      "generate_insights — AI business insights drawn from summarized LC Connect data.",
      "USE WHEN: the user asks for analytical business insights such as market",
      "trends, customer patterns, product performance, or sales opportunities. Reads",
      "the DB for context, then calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user asks for raw rows -> use get_leads/get_products/",
      "get_applications.",
      "DURATION: 10–30 s (DB summary + one web-search call).",
      SLOW_AI_RULE,
      "RETURNS: { success, insightType, timeframe, focusArea, insights, dataContext,",
      "nextSteps, generatedAt, then a 'Sources:' list of cited URLs —",
      "interpretation and next steps, not row dumps.",
      "GOTCHAS: requires PERPLEXITY_API_KEY.",
    ].join("\n"),
    {
      insightType: z
        .enum([
          "market_trends",
          "customer_patterns",
          "product_performance",
          "sales_opportunities",
          "overall",
        ])
        .optional()
        .default("overall")
        .describe("Type of insight to generate. Defaults to 'overall'."),
      timeframe: z
        .enum(["current", "quarterly", "annual"])
        .optional()
        .default("current")
        .describe("Time horizon for the insight framing. Defaults to 'current'."),
      focusArea: z
        .string()
        .optional()
        .describe("Optional free-text area to weight the analysis toward."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      const insightType = a.insightType || "overall";
      const timeframe = a.timeframe || "current";

      let context = "";
      let prompt = "";

      switch (insightType) {
        case "market_trends": {
          const recentProducts = await prisma.product.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: { subcategory: { include: { category: true } } },
          });
          context = `Recent products: ${recentProducts.map((p: any) => `${p.name} (${p.subcategory.category.name})`).join(", ")}`;
          prompt = `Analyze current market trends in the laser/photonics industry based on product categories and recent additions. Focus on ${timeframe} trends.`;
          break;
        }
        case "customer_patterns": {
          const activeLeads = await prisma.lead.count({
            where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } },
          });
          const industries = await prisma.lead.groupBy({
            by: ["industry"],
            _count: true,
            where: { industry: { not: null } },
            orderBy: { _count: { industry: "desc" } },
            take: 5,
          });
          context = `Active leads: ${activeLeads}, Top industries: ${industries.map((i: any) => i.industry).join(", ")}`;
          prompt = `Analyze customer patterns and buying behaviors in the laser/photonics market. Identify key customer segments and their needs for the ${timeframe} period.`;
          break;
        }
        case "product_performance": {
          const productsWithApplications = await prisma.product.findMany({
            include: { _count: { select: { product_applications: true, leads: true } } },
            orderBy: { leads: { _count: "desc" } },
            take: 10,
          });
          context = `Top products by lead interest: ${productsWithApplications.map((p: any) => `${p.name} (${p._count.leads} leads, ${p._count.product_applications} applications)`).join(", ")}`;
          prompt = `Analyze product performance patterns and identify high-performing product categories in the laser/photonics market for the ${timeframe} timeframe.`;
          break;
        }
        case "sales_opportunities": {
          const qualifiedLeads = await prisma.lead.count({ where: { status: "QUALIFIED" } });
          const recentApplications = await prisma.application.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
          });
          context = `Qualified leads: ${qualifiedLeads}, Recent applications: ${recentApplications.map((ap: any) => ap.name).join(", ")}`;
          prompt = `Identify sales opportunities and growth potential in the laser/photonics market. Focus on ${timeframe} opportunities and actionable recommendations.`;
          break;
        }
        default: {
          const [products, leads, applications] = await Promise.all([
            prisma.product.count(),
            prisma.lead.count(),
            prisma.application.count(),
          ]);
          context = `Database contains: ${products} products, ${leads} leads, ${applications} applications`;
          prompt = `Generate comprehensive business insights for a laser/photonics company. Include market opportunities, customer trends, and strategic recommendations for the ${timeframe} period.`;
        }
      }

      if (a.focusArea) prompt += ` Pay special attention to: ${a.focusArea}.`;

      const ai = await callAi("generate_insights", null, prompt, context);
      return okWithSources({
        success: true,
        insightType,
        timeframe,
        focusArea: a.focusArea,
        insights: ai.text,
        dataContext: context,
        nextSteps: [
          "Review and validate insights with team",
          "Develop action plans based on key findings",
          "Set up tracking for identified opportunities",
          "Schedule follow-up analysis",
        ],
        generatedAt: new Date().toISOString(),
      }, ai.sources);
    }
  );

  // -------------------------------------------------------------------------
  // generate_lead_score — Perplexity-backed lead scoring.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "generate_lead_score",
    {
      title: "Lead scoring",
      description: [
        "generate_lead_score — AI scoring/prioritization of a known lead with reasoning and next steps.",
        "USE WHEN: the user asks to score, prioritize, or explain sales fit for a",
        "specific lead. Calls a web-backed AI (Perplexity).",
        "DO NOT USE WHEN: the user asks to change the lead status -> use update_lead",
        "after explicit confirmation.",
        "DURATION: takes 15–30 s (one web-search call). " + SLOW_AI_RULE,
        "RETURNS: a KPI card — one tile per scoring factor plus an accented overall-score",
        "tile; the card IS the answer. The text carries the AI reasoning and a 'Sources:'",
        "list of cited URLs.",
        "PERSISTS: factor scores, overall and next steps are saved as a [LEAD_SCORE] note",
        "on the lead (only if you may edit it). Lead fields are NOT changed.",
        "GOTCHAS: leadId is required (resolve via get_leads/search_leads). Requires",
        "PERPLEXITY_API_KEY. Factor scores are extracted from the AI text best-effort",
        "('not scored' when no number could be parsed); the overall is the weighted",
        "mean of the scored factors, computed by LC Connect.",
      ].join("\n"),
      inputSchema: {
        leadId: z.number().describe("Lead ID to score (resolve via get_leads/search_leads)."),
        scoringFactors: z
          .array(
            z.enum([
              "company_fit",
              "budget_potential",
              "timeline",
              "engagement",
              "technology_alignment",
            ])
          )
          .optional()
          .default(["company_fit", "budget_potential", "technology_alignment"])
          .describe("Factors to score against. Defaults to company_fit, budget_potential, technology_alignment."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: KPI_WIDGET_URI },
        "openai/outputTemplate": KPI_WIDGET_URI,
      },
    },
    async (a) => {
      void getTenantSub();

      if (!a.leadId) throw new Error("Lead ID is required");

      const me = await getCurrentUser();
      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: {
          product: true,
          application: true,
          region: true,
          country: { select: { regionId: true } },
        },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);
      const mayEdit = canEditLead(me, {
        ownerUserId: lead.ownerUserId,
        createdByUserId: lead.createdByUserId,
        regionId: lead.regionId,
        countryRegionId: lead.country?.regionId ?? null,
      });

      const scoringFactors = Array.isArray(a.scoringFactors)
        ? a.scoringFactors
        : ["company_fit", "budget_potential", "technology_alignment"];

      const context = `Lead: ${lead.name}
Industry: ${lead.industry || "Unknown"}
Website: ${lead.website || "N/A"}
Status: ${lead.status}
Product of Interest: ${(lead.product as any)?.name || "Unknown"}
Annual Revenue: ${(lead as any).annualRevenue || "Unknown"}
Employee Count: ${(lead as any).employeeCount || "Unknown"}`;

      const prompt = `Score this lead on a scale of 0-100 based on the following factors: ${scoringFactors.join(", ")}.
For each factor, start a line with "<Factor name>: NN/100", then give:
1. Reasoning
2. Key indicators

Factor names: ${scoringFactors.map((f: string) => SCORING_FACTOR_LABELS[f] ?? f).join(", ")}.
Do not compute an overall score (it is computed separately from the factor scores).
End with a section headed "Next steps" listing concrete recommended actions.`;

      const ai = await callAi("generate_lead_score", a.leadId, prompt, context);
      const aiAnalysis = ai.text;

      const recommendations = {
        immediate_actions: [
          "Review AI-generated score and factors",
          "Update lead status based on score",
          "Prioritize high-scoring leads for outreach",
        ],
        score_interpretation: {
          "80-100": "Hot lead - immediate follow-up recommended",
          "60-79": "Warm lead - nurture with targeted content",
          "40-59": "Cool lead - add to long-term nurture campaign",
          "0-39": "Cold lead - reassess fit or archive",
        },
      };

      // Best-effort numeric extraction from the unstructured AI text -> KPI tiles.
      const factorScores = scoringFactors.map((f: string) => ({
        factor: f,
        label: SCORING_FACTOR_LABELS[f] ?? f,
        score: extractFactorScore(aiAnalysis, f),
      }));
      // Overall is computed here, never taken from the model's arithmetic.
      const overall = weightedOverall(factorScores);
      const nextSteps = extractNextSteps(aiAnalysis);
      const scoredAt = new Date();

      const factorTiles: KpiItem[] = factorScores.map((s) => ({
        label: s.label,
        value: s.score != null ? s.score : "not scored",
        format: s.score != null ? "int" : "text",
      }));
      const overallTile: KpiItem = {
        label: "Overall score",
        value: overall != null ? overall : "not scored",
        format: overall != null ? "int" : "text",
        accent: true,
        note: "/100",
      };

      // Persist as a lead note (there is no score column on leads; score_overrides
      // is for manual overrides and is deliberately not written here).
      let noteId: number | null = null;
      let persistNote: string;
      if (!mayEdit) {
        persistNote = "Not saved: you may not edit this lead (owner or an ADMIN can re-run it to store the score).";
      } else {
        try {
          const weightsLine = factorScores
            .map((s) => `${s.label} ${SCORING_FACTOR_WEIGHTS[s.factor] ?? 0.1}`)
            .join(", ");
          const body = [
            `Lead score (${isoDate(scoredAt)}, Perplexity ${ai.model})`,
            "",
            `Overall: ${overall != null ? `${overall}/100` : "not scored"} (weighted mean of scored factors; weights: ${weightsLine})`,
            ...factorScores.map((s) => `- ${s.label}: ${s.score != null ? `${s.score}/100` : "not scored"}`),
            "",
            "Next steps:",
            nextSteps ?? aiAnalysis.trim().slice(0, 2000),
            "",
            formatSources(ai.sources),
          ].join("\n");
          const note = await prisma.note.create({
            data: { leadId: a.leadId, content: `[LEAD_SCORE] ${body}`, user_id: me.id },
            select: { id: true },
          });
          noteId = note.id;
          persistNote = `Saved as lead note #${noteId}.`;
        } catch (err) {
          aiLog.error({ tool: "generate_lead_score", leadId: a.leadId, error: errMessage(err) }, "lead score persist failed");
          persistNote = `Not saved: writing the note failed (${errMessage(err)}).`;
        }
      }

      await audit({
        action: "lead.scored",
        resourceType: "lead",
        resourceId: a.leadId,
        details: {
          leadName: lead.name,
          noteId,
          overall,
          factors: Object.fromEntries(factorScores.map((s) => [s.factor, s.score])),
          provider: ai.provider,
          model: ai.model,
          citations: ai.sources.length,
        },
      });

      const meta: KpiMeta = {
        title: `Lead scoring — ${lead.name}`,
        kpis: [overallTile, ...factorTiles],
        notes: [aiAnalysis],
      };

      const steer =
        `[PRESENTATION] Lead scoring "${lead.name}" (ID ${a.leadId}). ` +
        (overall != null
          ? `Overall score: ${overall}/100. `
          : `No factor score could be parsed from the analysis, so there is no overall. `) +
        `${persistNote} ` +
        `The KPI tiles (one per factor + overall) ARE the answer — do not repeat the numbers in a table. ` +
        `Recommendation: present the key takeaways and next steps from the AI analysis below briefly, citing the sources.\n\n` +
        `--- AI analysis ---\n${aiAnalysis}\n\n${formatSources(ai.sources)}`;

      const env = buildKpiEnvelope(meta, steer);
      // Keep the original structured payload available to the model.
      (env.structuredContent as Record<string, unknown>).data = {
        leadId: a.leadId,
        leadName: lead.name,
        scoringFactors,
        factorScores,
        overallScore: overall,
        overallMethod: "weighted mean of scored factors",
        weights: Object.fromEntries(scoringFactors.map((f: string) => [f, SCORING_FACTOR_WEIGHTS[f] ?? 0.1])),
        analysis: aiAnalysis,
        sources: ai.sources,
        noteId,
        currentStatus: lead.status,
        recommendations,
        scoreTimestamp: scoredAt.toISOString(),
      };
      return env as any;
    }
  );

  // -------------------------------------------------------------------------
  // export_data — DB export (CSV/JSON). Local DB only, no AI.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "export_data",
    {
      title: "Export data",
      description: [
        "export_data — export leads, products, applications, or a database summary as CSV/JSON text.",
        "USE ONLY WHEN the user explicitly asks to EXPORT, DOWNLOAD, or get a CSV/file of",
        "data. Do NOT use this to browse, search, or display leads — for that use",
        "search_leads (it renders a widget).",
        "USE WHEN: the user explicitly asks to export one of these datasets. Read-only",
        "local DB operation (no AI).",
        "DO NOT USE WHEN: the user only needs an answer/analysis -> prefer",
        "generate_insights or a narrower list tool.",
        "RETURNS: a confirmation card ('Export ready — N records (format)'); the",
        "serialized export string + metadata ride in structuredContent.data",
        "({ success, dataType, format, filename, recordCount, data }).",
        "GOTCHAS: large exports can overflow chat — prefer summaries/samples; 'excel'",
        "is accepted but serialized as CSV.",
      ].join("\n"),
      inputSchema: {
        dataType: z
          .enum(["leads", "products", "applications", "full_database"])
          .describe("Which dataset to export (required)."),
        format: z
          .enum(["csv", "json", "excel"])
          .optional()
          .default("csv")
          .describe("Output format. 'excel' is serialized as CSV. Defaults to 'csv'."),
        filters: z
          .object({
            status: z.string().optional().describe("Filter by lead status."),
            dateFrom: z.string().optional().describe("Only records created on/after this date (ISO)."),
            dateTo: z.string().optional().describe("Only records created on/before this date (ISO)."),
            tags: z.array(z.string()).optional().describe("Records must carry ALL these tags (hasEvery)."),
          })
          .optional()
          .describe("Optional filters applied to the exported records."),
        fields: z
          .array(z.string())
          .optional()
          .describe("Optional explicit column list for CSV output."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        // OpenAI compat alias so ChatGPT binds this widget explicitly.
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      void getTenantSub();

      if (!a.dataType) throw new Error("dataType is required");

      const validDataTypes = ["leads", "products", "applications", "full_database"];
      if (!validDataTypes.includes(a.dataType)) {
        throw new Error(`Invalid dataType "${a.dataType}". Valid types are: ${validDataTypes.join(", ")}`);
      }

      const format = a.format || "csv";
      let data: any[] = [];
      let filename = "";

      const filters: any = {};
      if (a.filters) {
        const filterObj = a.filters as any;
        if (filterObj.status) filters.status = filterObj.status;
        if (filterObj.dateFrom || filterObj.dateTo) {
          filters.createdAt = {};
          if (filterObj.dateFrom) filters.createdAt.gte = new Date(filterObj.dateFrom);
          if (filterObj.dateTo) filters.createdAt.lte = new Date(filterObj.dateTo);
        }
        if (filterObj.tags && filterObj.tags.length > 0) {
          filters.tags = { hasEvery: filterObj.tags };
        }
      }

      switch (a.dataType) {
        case "leads":
          data = await prisma.lead.findMany({
            where: filters,
            include: {
              product: { select: { name: true } },
              application: { select: { name: true } },
            },
          });
          filename = `leads_export_${new Date().toISOString().split("T")[0]}`;
          break;
        case "products":
          data = await prisma.product.findMany({
            include: {
              subcategory: { include: { category: true } },
              _count: { select: { leads: true, product_applications: true } },
            },
          });
          filename = `products_export_${new Date().toISOString().split("T")[0]}`;
          break;
        case "applications":
          data = await prisma.application.findMany({
            include: { _count: { select: { leads: true, product_applications: true } } },
          });
          filename = `applications_export_${new Date().toISOString().split("T")[0]}`;
          break;
        case "full_database": {
          const [leadsCount, productsCount, applicationsCount] = await Promise.all([
            prisma.lead.count(),
            prisma.product.count(),
            prisma.application.count(),
          ]);
          data = [
            {
              export_type: "summary",
              total_leads: leadsCount,
              total_products: productsCount,
              total_applications: applicationsCount,
              export_date: new Date().toISOString(),
            },
          ];
          filename = `database_summary_${new Date().toISOString().split("T")[0]}`;
          break;
        }
      }

      let output = "";
      if (format === "json") {
        output = JSON.stringify(data, null, 2);
      } else {
        output = convertToCSV(data, a.fields as string[]);
      }

      // Action-confirmation card. The bulky serialized export stays in
      // structuredContent.data (the model can read it / re-emit it), while the
      // widget shows a slim "done" card. No real download URL exists here, so
      // the card is purely a confirmation — not a link.
      const env = buildActionEnvelope(
        {
          status: "success",
          title: "Export ready",
          detail: `${data.length} records (${format})`,
          id: `${filename}.${format}`,
          idLabel: "File",
        },
        `[PRESENTATION] Export of ${a.dataType} ready: ${data.length} records in ${format} format. ` +
          `The confirmation card IS the answer — confirm briefly. The full data is in structuredContent.data.`
      );
      (env.structuredContent as Record<string, unknown>).data = {
        success: true,
        dataType: a.dataType,
        format,
        filename: `${filename}.${format}`,
        recordCount: data.length,
        data: output,
      };
      return env as any;
    }
  );

  // -------------------------------------------------------------------------
  // generate_report — DB-backed formatted report (HTML/markdown). No AI.
  // -------------------------------------------------------------------------
  server.tool(
    "generate_report",
    [
      "generate_report — generate a formatted lead / product / pipeline report from the DB.",
      "USE WHEN: the user asks for a formatted lead summary, product performance, or",
      "sales pipeline report. Read-only; generates report content but does not save",
      "or send it (no AI).",
      "DO NOT USE WHEN: the user asks for external delivery -> use a sending/reporting",
      "tool such as report_issue.",
      "RETURNS: { success, reportType, format, title, report } where `report` is HTML",
      "or markdown text.",
      "GOTCHAS: reportType is required; 'pdf' is accepted but rendered as HTML. The",
      "'activity_log' and 'custom' report types are not implemented and will error.",
    ].join("\n"),
    {
      reportType: z
        .enum(["lead_summary", "product_performance", "sales_pipeline", "activity_log", "custom"])
        .describe("Which report to generate (required)."),
      format: z
        .enum(["pdf", "html", "markdown"])
        .optional()
        .default("html")
        .describe("Output format. 'pdf' is rendered as HTML. Defaults to 'html'."),
      dateRange: z
        .object({
          from: z.string().optional().describe("Report range start (ISO)."),
          to: z.string().optional().describe("Report range end (ISO)."),
        })
        .optional()
        .describe("Optional date range for the report."),
      includeCharts: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include charts (currently advisory). Defaults to true."),
      customQuery: z
        .string()
        .optional()
        .describe("Optional custom query string for the 'custom' report type."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.reportType) throw new Error("reportType is required");

      const format = a.format || "html";
      let reportTitle = "";
      const sections: Array<{ title: string; content: string; type: "text" | "table" | "list" }> = [];

      switch (a.reportType) {
        case "lead_summary": {
          reportTitle = "Lead Summary Report";
          const [totalLeads, statusCounts, recentLeads] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.groupBy({ by: ["status"], _count: true }),
            prisma.lead.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { product: true } }),
          ]);
          sections.push({ title: "Overview", content: `Total Leads: ${totalLeads}`, type: "text" });
          sections.push({
            title: "Status Distribution",
            content:
              format === "html"
                ? createTableHTML(statusCounts.map((s: any) => ({ Status: s.status, Count: s._count })))
                : createTableMarkdown(statusCounts.map((s: any) => ({ Status: s.status, Count: s._count }))),
            type: "table",
          });
          sections.push({
            title: "Recent Leads",
            content:
              format === "html"
                ? createTableHTML(
                    recentLeads.map((l: any) => ({
                      Name: l.name,
                      Status: l.status,
                      Product: l.product.name,
                      Created: new Date(l.createdAt).toLocaleDateString(),
                    }))
                  )
                : createTableMarkdown(
                    recentLeads.map((l: any) => ({
                      Name: l.name,
                      Status: l.status,
                      Product: l.product.name,
                      Created: new Date(l.createdAt).toLocaleDateString(),
                    }))
                  ),
            type: "table",
          });
          break;
        }
        case "product_performance": {
          reportTitle = "Product Performance Report";
          const topProducts = await prisma.product.findMany({
            take: 20,
            include: {
              _count: { select: { leads: true, product_applications: true } },
              subcategory: { include: { category: true } },
            },
            orderBy: { leads: { _count: "desc" } },
          });
          sections.push({
            title: "Top Products by Lead Interest",
            content:
              format === "html"
                ? createTableHTML(
                    topProducts.map((p: any) => ({
                      Product: p.name,
                      Category: `${p.subcategory.category.name} > ${p.subcategory.name}`,
                      Leads: p._count.leads,
                      Applications: p._count.product_applications,
                    }))
                  )
                : createTableMarkdown(
                    topProducts.map((p: any) => ({
                      Product: p.name,
                      Category: `${p.subcategory.category.name} > ${p.subcategory.name}`,
                      Leads: p._count.leads,
                      Applications: p._count.product_applications,
                    }))
                  ),
            type: "table",
          });
          break;
        }
        case "sales_pipeline": {
          reportTitle = "Sales Pipeline Report";
          const pipelineData = await prisma.lead.groupBy({
            by: ["status"],
            _count: true,
            _avg: { confidence: true },
          });
          sections.push({
            title: "Pipeline Overview",
            content:
              format === "html"
                ? createTableHTML(
                    pipelineData.map((p: any) => ({
                      Stage: p.status,
                      Count: p._count,
                      "Avg Confidence": p._avg.confidence ? `${p._avg.confidence.toFixed(1)}%` : "N/A",
                    }))
                  )
                : createTableMarkdown(
                    pipelineData.map((p: any) => ({
                      Stage: p.status,
                      Count: p._count,
                      "Avg Confidence": p._avg.confidence ? `${p._avg.confidence.toFixed(1)}%` : "N/A",
                    }))
                  ),
            type: "table",
          });
          break;
        }
        default:
          throw new Error(`Unknown report type: ${a.reportType}`);
      }

      const report =
        format === "markdown"
          ? generateMarkdownReport(reportTitle, sections)
          : generateHTMLReport(reportTitle, sections);
      return ok({ success: true, reportType: a.reportType, format, title: reportTitle, report });
    }
  );

  // -------------------------------------------------------------------------
  // get_activity_feed — recent lead/note timeline. Local DB only, no AI.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_activity_feed",
    {
      title: "Activity",
      description: [
        "get_activity_feed — recent CRM activity timeline, newest first: the AUDIT TRAIL",
        "(every recorded write — creates, updates, deletes, assignments, bulk imports,",
        "user administration, and refused destructive attempts) merged with the older",
        "lead-creation and note events that predate the trail.",
        "USE WHEN: the user asks what recently changed, who did what, or wants a recent",
        "activity feed. Read-only local DB operation (no AI).",
        "DO NOT USE WHEN: the user wants the raw audit table only (no legacy events) ->",
        "use get_audit_log; they ask to report an issue to the admin -> report_issue.",
        "RETURNS: a small result inline as { success, totalActivities, dateRange,",
        "activities[] }; a LARGE result (> threshold) as an interactive DATASET widget",
        "(sortable/searchable table + CSV export). The card IS the answer.",
        "GOTCHAS: `action` is a PREFIX match (\"lead.\" catches every lead action);",
        "`since`/dateFrom/dateTo are ISO dates; `userId` scopes to one person. Audited",
        "events win over the legacy ones, so a lead created since the trail went live",
        `appears once, not twice. limit defaults to ${AUDIT_DEFAULT_LIMIT}, capped at ${AUDIT_MAX_LIMIT}.`,
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(AUDIT_MAX_LIMIT)
          .optional()
          .default(AUDIT_DEFAULT_LIMIT)
          .describe(
            `Maximum number of activities to return. Defaults to ${AUDIT_DEFAULT_LIMIT}, capped at ${AUDIT_MAX_LIMIT}.`
          ),
        userId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Only activity by this user ID (resolve with whoami/manage_users)."),
        action: z
          .string()
          .optional()
          .describe('Action prefix from the audit trail, e.g. "lead." or "user.".'),
        resourceType: z
          .enum([
            "lead",
            "note",
            "product",
            "application",
            "product_application",
            "resource",
            "learning",
            "user",
            "issue",
          ])
          .optional()
          .describe("Only activity on this kind of record."),
        since: z
          .string()
          .optional()
          .describe("Only activity at or after this ISO date (alias of dateFrom)."),
        activityTypes: z
          .array(z.enum(["lead_created", "lead_updated", "note_added", "status_changed"]))
          .optional()
          .describe("Optional legacy activity type filter (lead_created / note_added)."),
        dateFrom: z.string().optional().describe("Only activity on/after this date (ISO)."),
        dateTo: z.string().optional().describe("Only activity on/before this date (ISO)."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: DATASET_WIDGET_URI },
        "openai/outputTemplate": DATASET_WIDGET_URI,
      },
    },
    async (a) => {
      void getTenantSub();

      const limit = normalizeAuditLimit(a.limit);
      // `since` and the legacy `dateFrom` mean the same thing; the later of the
      // two wins so passing both cannot silently widen the window.
      const sinceRaw = a.since ?? a.dateFrom ?? null;
      const since = parseSince(sinceRaw);
      const until = a.dateTo ? parseSince(a.dateTo as string) : null;

      const activities: any[] = [];

      // ---- 1. The audit trail: the authoritative record of every write. ----
      // User-management events (user.*) are visible to ADMIN only; everyone else
      // sees the data-level trail. get_audit_log remains the gated full view.
      const viewer = await getCurrentUser();
      const auditRows = await queryAuditLog({
        userId: a.userId,
        action: a.action,
        resourceType: a.resourceType,
        since: sinceRaw,
        limit,
      });
      for (const r of auditRows) {
        if (until && r.timestamp > until) continue;
        if (viewer.role !== "ADMIN" && r.action.startsWith("user.")) continue;
        activities.push({
          source: "audit",
          type: r.action,
          timestamp: r.timestamp,
          actor: r.actor,
          actorEmail: r.actorEmail,
          userId: r.userId,
          resourceType: r.resourceType,
          resourceId: r.resourceId,
          description: `${r.actor}: ${r.action}${r.resourceId ? ` #${r.resourceId}` : ""}`,
          summary: r.summary,
          details: r.details,
        });
      }

      // Anything already in the trail must not be re-reported from the raw
      // tables below, or every post-audit lead would show up twice.
      const auditedLeadIds = new Set(
        auditRows.filter((r) => r.action === "lead.created").map((r) => r.resourceId)
      );
      const auditedNoteIds = new Set(
        auditRows.filter((r) => r.action === "note.created").map((r) => r.resourceId)
      );

      // ---- 2. Legacy events: leads/notes written before the trail existed. --
      const dateFilter: any = {};
      if (since) dateFilter.gte = since;
      if (until) dateFilter.lte = until;
      const createdAt = Object.keys(dateFilter).length > 0 ? dateFilter : undefined;

      const types = (a.activityTypes as string[] | undefined) ?? null;
      const wantsLeads =
        (!a.resourceType || a.resourceType === "lead") &&
        (!types || types.includes("lead_created")) &&
        (!a.action || "lead.created".startsWith(a.action));
      const wantsNotes =
        (!a.resourceType || a.resourceType === "note") &&
        (!types || types.includes("note_added")) &&
        (!a.action || "note.created".startsWith(a.action));

      if (wantsLeads) {
        const recentLeads = await prisma.lead.findMany({
          where: {
            createdAt,
            ...(a.userId != null ? { createdByUserId: a.userId } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { product: { select: { name: true } } },
        });
        for (const lead of recentLeads as any[]) {
          if (auditedLeadIds.has(String(lead.id))) continue;
          activities.push({
            source: "legacy",
            type: "lead_created",
            timestamp: lead.createdAt,
            actor: null,
            userId: lead.createdByUserId ?? null,
            resourceType: "lead",
            resourceId: String(lead.id),
            description: `New lead created: ${lead.name}`,
            summary: `name=${lead.name}, status=${lead.status}`,
            details: {
              leadId: lead.id,
              leadName: lead.name,
              product: lead.product?.name ?? null,
              status: lead.status,
            },
          });
        }
      }

      if (wantsNotes) {
        const recentNotes = await prisma.note.findMany({
          where: {
            createdAt,
            ...(a.userId != null ? { user_id: a.userId } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { lead: { select: { name: true } } },
        });
        for (const note of recentNotes as any[]) {
          if (auditedNoteIds.has(String(note.id))) continue;
          activities.push({
            source: "legacy",
            type: "note_added",
            timestamp: note.createdAt,
            actor: null,
            userId: note.user_id ?? null,
            resourceType: "note",
            resourceId: String(note.id),
            description: `Note added to lead: ${note.lead.name}`,
            summary: `lead=${note.lead.name}`,
            details: {
              noteId: note.id,
              leadName: note.lead.name,
              notePreview:
                note.content.substring(0, 100) + (note.content.length > 100 ? "..." : ""),
            },
          });
        }
      }

      activities.sort((x: any, y: any) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
      const limitedActivities = activities.slice(0, limit);

      // Flatten the nested `details` into scalar columns for the DATASET widget.
      const rows = limitedActivities.map((act: any) => ({
        timestamp: act.timestamp,
        actor: act.actor ?? (act.userId != null ? `user #${act.userId}` : null),
        type: act.type,
        resourceType: act.resourceType ?? null,
        resourceId: act.resourceId ?? null,
        description: act.description,
        details: act.summary ?? null,
        lead: act.details?.leadName ?? null,
        product: act.details?.product ?? null,
        status: act.details?.status ?? null,
      }));

      const widget = okList(
        rows,
        "Activity",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["timestamp", "actor", "type", "description", "details"]
      );
      if (!("structuredContent" in widget)) {
        return ok({
          success: true,
          totalActivities: limitedActivities.length,
          dateRange: { from: sinceRaw || "unlimited", to: a.dateTo || "now" },
          activities: limitedActivities,
        });
      }
      return widget as any;
    }
  );
}
