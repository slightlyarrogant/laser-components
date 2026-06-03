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

/**
 * AI / market-intelligence domain.
 *
 * All tools are read-only with respect to the LC database; the Perplexity-backed
 * ones reach out to an external web-search model (openWorldHint=true). The Prisma
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

class PerplexityClient {
  private apiKey: string;
  private baseUrl = "https://api.perplexity.ai";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Perplexity API key is required");
    this.apiKey = apiKey;
  }

  async analyze(prompt: string, context?: string): Promise<string> {
    let userMessage = prompt;
    if (context) userMessage = `Context: ${context}\n\nRequest: ${prompt}`;

    const body = {
      model: "llama-3.1-sonar-small-128k-online",
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || "No response generated";
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

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// Human-readable label per scoring factor enum value (used as the KPI tile label).
const SCORING_FACTOR_LABELS: Record<string, string> = {
  company_fit: "Company fit",
  budget_potential: "Budget potential",
  timeline: "Timeline",
  engagement: "Engagement",
  technology_alignment: "Technology alignment",
};

/**
 * Best-effort extraction of a 0-100 score for a named factor from the free-text
 * AI analysis. Looks at the line(s) that mention the factor (by its enum token or
 * its human label) and pulls the first plausible 0-100 integer near it. Returns
 * null when no score can be confidently located (the tile then shows "—").
 */
function extractFactorScore(analysis: string, factor: string): number | null {
  const label = (SCORING_FACTOR_LABELS[factor] ?? factor).toLowerCase();
  const spaced = factor.replace(/_/g, " ");
  for (const line of analysis.split(/\n+/)) {
    const lower = line.toLowerCase();
    if (lower.includes(spaced) || lower.includes(factor) || lower.includes(label)) {
      const m = line.match(/(\d{1,3})\s*(?:\/\s*100|%)?/);
      if (m) {
        const n = Number(m[1]);
        if (n >= 0 && n <= 100) return n;
      }
    }
  }
  return null;
}

/** Pull the overall/weighted 0-100 score from the analysis text, if stated. */
function extractOverallScore(analysis: string): number | null {
  for (const line of analysis.split(/\n+/)) {
    if (/overall|weighted|total|łączn|ogóln|całkowit/i.test(line)) {
      const m = line.match(/(\d{1,3})\s*(?:\/\s*100|%)?/);
      if (m) {
        const n = Number(m[1]);
        if (n >= 0 && n <= 100) return n;
      }
    }
  }
  // Fallback: average of any factor scores the caller computed (handled by caller).
  return null;
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
      "AI market analysis (size, trends, applications, competitors) for a known product.",
      "USE WHEN: the user asks for market size, trends, competitors, or strategic",
      "market analysis for a specific product. Calls a web-backed AI (Perplexity), so",
      "results may include external/live information.",
      "DO NOT USE WHEN: the user only needs local catalog rows -> use",
      "get_products/search_products; or wants competitor-only detail -> use",
      "analyze_competition.",
      "RETURNS: { success, productId, productName, analysisType, analysis, timestamp }",
      "— an analytical narrative, not a DB change.",
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
      const perplexity = getPerplexity();

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

      const analysis = await perplexity.analyze(prompt, context);
      return ok({
        success: true,
        productId: a.productId,
        productName: product.name,
        analysisType,
        analysis,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // -------------------------------------------------------------------------
  // discover_applications — Perplexity-backed application discovery.
  // -------------------------------------------------------------------------
  server.tool(
    "discover_applications",
    [
      "AI discovery of industries/use cases a known product could serve.",
      "USE WHEN: the user asks what applications/industries/use cases a specific",
      "product could serve. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user only wants the applications already mapped to the",
      "product -> use get_product_applications.",
      "RETURNS: { success, data{ productId, productName, industryFocus, discoveries,",
      "recommendedActions, timestamp } } — suggestions only.",
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

      const perplexity = getPerplexity();
      const limit = a.limit || 5;

      let prompt = `Discover ${limit} specific industrial or commercial applications for "${product.name}" (${product.description || "laser/photonics component"}).`;
      if (a.industryFocus) prompt += ` Focus specifically on applications in the ${a.industryFocus} industry.`;
      prompt += ` For each application, provide: 1) Application name, 2) Industry sector, 3) Use case description, 4) Technical requirements, 5) Market potential. Format as a structured list.`;

      const context = `Product Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}`;
      const aiResponse = await perplexity.analyze(prompt, context);

      return ok({
        success: true,
        data: {
          productId: a.productId,
          productName: product.name,
          industryFocus: a.industryFocus || "all industries",
          discoveries: aiResponse,
          recommendedActions: [
            "Review discovered applications for relevance",
            "Create application records for promising opportunities",
            "Map product to relevant applications",
            "Conduct deeper market research for top opportunities",
          ],
          timestamp: new Date().toISOString(),
        },
      });
    }
  );

  // -------------------------------------------------------------------------
  // enrich_lead — Perplexity-backed lead enrichment.
  // -------------------------------------------------------------------------
  server.tool(
    "enrich_lead",
    [
      "AI enrichment of a known lead (company info, market position, tech stack, growth).",
      "USE WHEN: the user asks to research/enrich a specific lead with company,",
      "market, technology, or growth information. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user asks to persist changes to the CRM record -> use",
      "update_lead after explicit confirmation.",
      "RETURNS: { success, data{ leadId, companyName, currentData, enrichedData,",
      "enrichmentTimestamp, recommendedActions } } — suggested enrichment only; nothing",
      "is persisted.",
      "GOTCHAS: leadId is required (resolve via get_leads/search_leads). Requires",
      "PERPLEXITY_API_KEY.",
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
        .describe("Which enrichment dimensions to gather. 'all' runs every dimension. Defaults to ['all']."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (a) => {
      void getTenantSub();

      if (!a.leadId) throw new Error("Lead ID is required");

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: { product: true, application: true, region: true, country: true },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);

      const perplexity = getPerplexity();
      const enrichmentTypes = Array.isArray(a.enrichmentTypes) ? a.enrichmentTypes : ["all"];
      const shouldEnrichAll = enrichmentTypes.includes("all");

      const enrichmentData: any = {
        leadId: a.leadId,
        companyName: lead.name,
        currentData: { industry: lead.industry, website: lead.website, location: (lead as any).location },
        enrichedData: {},
      };

      if (shouldEnrichAll || enrichmentTypes.includes("company_info")) {
        const prompt = `Research company information for "${lead.name}"${lead.website ? ` (${lead.website})` : ""}. Provide: company size, founding year, key product/services, headquarters location, and recent news.`;
        enrichmentData.enrichedData.company_info = await perplexity.analyze(prompt);
      }
      if (shouldEnrichAll || enrichmentTypes.includes("market_position")) {
        const prompt = `Analyze the market position of "${lead.name}" in the ${lead.industry || "laser/photonics"} industry. Include market share, competitive advantages, and industry reputation.`;
        enrichmentData.enrichedData.market_position = await perplexity.analyze(prompt);
      }
      if (shouldEnrichAll || enrichmentTypes.includes("technology_stack")) {
        const prompt = `Identify the technology stack and technical capabilities of "${lead.name}". Focus on their use of laser/photonics technologies and related systems.`;
        enrichmentData.enrichedData.technology_stack = await perplexity.analyze(prompt);
      }
      if (shouldEnrichAll || enrichmentTypes.includes("growth_potential")) {
        const prompt = `Assess the growth potential of "${lead.name}". Consider funding status, market expansion, product development, and industry trends affecting their business.`;
        enrichmentData.enrichedData.growth_potential = await perplexity.analyze(prompt);
      }

      enrichmentData.enrichmentTimestamp = new Date().toISOString();
      enrichmentData.recommendedActions = [
        "Update lead record with enriched data",
        "Review and validate AI-generated insights",
        "Schedule follow-up based on growth potential",
        "Identify cross-sell opportunities",
      ];
      return ok({ success: true, data: enrichmentData });
    }
  );

  // -------------------------------------------------------------------------
  // analyze_competition — Perplexity-backed competitive analysis.
  // -------------------------------------------------------------------------
  server.tool(
    "analyze_competition",
    [
      "AI competitive analysis (competitors, positioning, SWOT) for a known product.",
      "USE WHEN: the user asks for competitors, market positioning, SWOT, or",
      "alternative solutions for a specific product. Calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user only wants local product/application records -> use",
      "get_products/get_product_applications.",
      "RETURNS: { success, productId, productName, analysisDepth, focusedCompetitors,",
      "analysis, recommendations, timestamp }.",
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

      const perplexity = getPerplexity();
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

      const competitiveAnalysis = await perplexity.analyze(prompt, context);
      return ok({
        success: true,
        productId: a.productId,
        productName: product.name,
        analysisDepth,
        focusedCompetitors: competitorNames,
        analysis: competitiveAnalysis,
        recommendations: [
          "Review competitive positioning",
          "Identify unique value propositions",
          "Develop differentiation strategies",
          "Monitor competitor activities regularly",
        ],
        timestamp: new Date().toISOString(),
      });
    }
  );

  // -------------------------------------------------------------------------
  // generate_insights — DB-context summarized into a Perplexity analysis.
  // -------------------------------------------------------------------------
  server.tool(
    "generate_insights",
    [
      "AI business insights drawn from summarized LC Connect data.",
      "USE WHEN: the user asks for analytical business insights such as market",
      "trends, customer patterns, product performance, or sales opportunities. Reads",
      "the DB for context, then calls a web-backed AI (Perplexity).",
      "DO NOT USE WHEN: the user asks for raw rows -> use get_leads/get_products/",
      "get_applications.",
      "RETURNS: { success, insightType, timeframe, focusArea, insights, dataContext,",
      "nextSteps, generatedAt } — interpretation and next steps, not row dumps.",
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

      const perplexity = getPerplexity();
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

      const insights = await perplexity.analyze(prompt, context);
      return ok({
        success: true,
        insightType,
        timeframe,
        focusArea: a.focusArea,
        insights,
        dataContext: context,
        nextSteps: [
          "Review and validate insights with team",
          "Develop action plans based on key findings",
          "Set up tracking for identified opportunities",
          "Schedule follow-up analysis",
        ],
        generatedAt: new Date().toISOString(),
      });
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
        "AI scoring/prioritization of a known lead with reasoning and next steps.",
        "USE WHEN: the user asks to score, prioritize, or explain sales fit for a",
        "specific lead. Calls a web-backed AI (Perplexity).",
        "DO NOT USE WHEN: the user asks to persist the score/status -> use update_lead",
        "after explicit confirmation.",
        "RETURNS: a KPI card — one tile per scoring factor plus an accented overall-score",
        "tile; the card IS the answer. The full AI reasoning + recommendations stay in",
        "the steer/structuredContent (textual analysis only — nothing is persisted).",
        "GOTCHAS: leadId is required (resolve via get_leads/search_leads). Requires",
        "PERPLEXITY_API_KEY. Factor/overall scores are extracted from the AI text",
        "best-effort; a tile shows '—' when no number could be parsed.",
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
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
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

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: {
          product: true,
          application: true,
          region: true,
          notes: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);

      const perplexity = getPerplexity();
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
For each factor, provide:
1. Score (0-100)
2. Reasoning
3. Key indicators

Also provide an overall weighted score and recommendation for next steps.`;

      const aiAnalysis = await perplexity.analyze(prompt, context);

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
      const parsed = factorScores
        .map((s) => s.score)
        .filter((n): n is number => n != null);
      const overall =
        extractOverallScore(aiAnalysis) ??
        (parsed.length
          ? Math.round(parsed.reduce((x, y) => x + y, 0) / parsed.length)
          : null);

      const factorTiles: KpiItem[] = factorScores.map((s) => ({
        label: s.label,
        value: s.score != null ? s.score : "—",
        format: s.score != null ? "int" : "text",
      }));
      const overallTile: KpiItem = {
        label: "Overall score",
        value: overall != null ? overall : "—",
        format: overall != null ? "int" : "text",
        accent: true,
        note: "/100",
      };

      const meta: KpiMeta = {
        title: `Lead scoring — ${lead.name}`,
        kpis: [overallTile, ...factorTiles],
        notes: [aiAnalysis],
      };

      const steer =
        `[PRESENTATION] Lead scoring "${lead.name}" (ID ${a.leadId}). ` +
        (overall != null
          ? `Overall score: ${overall}/100. `
          : `The overall score could not be parsed from the analysis. `) +
        `The KPI tiles (one per factor + overall) ARE the answer — do not repeat the numbers in a table. ` +
        `Recommendation: present the key takeaways and next steps from the AI analysis below briefly.\n\n` +
        `--- AI analysis ---\n${aiAnalysis}`;

      const env = buildKpiEnvelope(meta, steer);
      // Keep the original structured payload available to the model.
      (env.structuredContent as Record<string, unknown>).data = {
        leadId: a.leadId,
        leadName: lead.name,
        scoringFactors,
        factorScores,
        overallScore: overall,
        analysis: aiAnalysis,
        currentStatus: lead.status,
        recommendations,
        scoreTimestamp: new Date().toISOString(),
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
        "Export leads, products, applications, or a database summary as CSV/JSON text.",
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
      "Generate a formatted lead / product / pipeline report from the DB.",
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
        "Recent CRM activity timeline (lead creations + notes), newest first.",
        "USE WHEN: the user asks what recently changed or wants a recent activity feed.",
        "Read-only local DB operation (no AI).",
        "DO NOT USE WHEN: the user asks to report an issue to the admin -> use",
        "report_issue.",
        "RETURNS: a small result inline as { success, totalActivities, dateRange,",
        "activities[] }; a LARGE result (> threshold) as an interactive DATASET widget",
        "(sortable/searchable table + CSV export). The card IS the answer.",
        "GOTCHAS: dateFrom/dateTo are ISO dates; the feed mixes lead-created and",
        "note-added events split evenly up to `limit`.",
      ].join("\n"),
      inputSchema: {
        limit: z.number().optional().default(50).describe("Maximum number of activities to return. Defaults to 50."),
        userId: z.number().optional().describe("Optional user ID filter (reserved)."),
        activityTypes: z
          .array(z.enum(["lead_created", "lead_updated", "note_added", "status_changed"]))
          .optional()
          .describe("Optional activity type filter (reserved)."),
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

      const limit = a.limit || 50;
      const activities: any[] = [];

      const dateFilter: any = {};
      if (a.dateFrom) dateFilter.gte = new Date(a.dateFrom as string);
      if (a.dateTo) dateFilter.lte = new Date(a.dateTo as string);

      const recentLeads = await prisma.lead.findMany({
        where: { createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true } } },
      });

      recentLeads.forEach((lead: any) => {
        activities.push({
          type: "lead_created",
          timestamp: lead.createdAt,
          description: `New lead created: ${lead.name}`,
          details: { leadId: lead.id, leadName: lead.name, product: lead.product.name, status: lead.status },
        });
      });

      const recentNotes = await prisma.note.findMany({
        where: { createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { name: true } } },
      });

      recentNotes.forEach((note: any) => {
        activities.push({
          type: "note_added",
          timestamp: note.createdAt,
          description: `Note added to lead: ${note.lead.name}`,
          details: {
            noteId: note.id,
            leadName: note.lead.name,
            notePreview: note.content.substring(0, 100) + (note.content.length > 100 ? "..." : ""),
          },
        });
      });

      activities.sort((x: any, y: any) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
      const limitedActivities = activities.slice(0, limit);

      // Flatten the nested `details` into scalar columns for the DATASET widget.
      const rows = limitedActivities.map((act: any) => ({
        timestamp: act.timestamp,
        type: act.type,
        description: act.description,
        leadId: act.details?.leadId ?? null,
        lead: act.details?.leadName ?? null,
        product: act.details?.product ?? null,
        status: act.details?.status ?? null,
      }));

      const widget = okList(
        rows,
        "Activity",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["timestamp", "type", "lead", "description"]
      );
      if (!("structuredContent" in widget)) {
        return ok({
          success: true,
          totalActivities: limitedActivities.length,
          dateRange: { from: a.dateFrom || "unlimited", to: a.dateTo || "now" },
          activities: limitedActivities,
        });
      }
      return widget as any;
    }
  );
}
