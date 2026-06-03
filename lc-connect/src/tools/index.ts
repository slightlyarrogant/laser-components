import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  KPI_WIDGET_URI,
  buildKpiEnvelope,
  type KpiItem,
  type KpiMeta,
} from "@cfi/mcp-widgets";
import { prisma } from "../db/client.js";
import { registerProductsTools } from "./products.js";
import { registerApplicationsTools } from "./applications.js";
import { registerLeadsTools } from "./leads.js";
import { registerReportTools } from "./report.js";
import { registerAiTools } from "./ai.js";
import { registerKnowledgeTools } from "./knowledge.js";
import { registerAnalyticsTools } from "./analytics.js";
import { PRESENT_BRIEFLY } from "./_present.js";

/**
 * registerAllTools — registers the LC Connect tool set on a fresh McpServer.
 *
 * CHUNK 1 (this file): only a minimal proof-of-skeleton set —
 *   - get_statistics : DB-backed counts (products / applications / leads / mappings)
 *   - ping           : liveness probe
 *
 * CHUNK 2a: DB/CRUD domains ported to high-level `server.tool(...)`:
 *   - products     (src/tools/products.ts)     — catalog CRUD, search, taxonomy
 *   - applications (src/tools/applications.ts) — application catalog + product mappings + cross-search
 *   - leads        (src/tools/leads.ts)         — lead list/search, single + batch CRUD, notes
 *   - report       (src/tools/report.ts)        — report_issue via WhatsApp bridge
 *
 * CHUNK 2b (this chunk): AI + knowledge domains ported to high-level `server.tool(...)`,
 * plus DB-backed resources and the session-start prompt (wired in src/server.ts):
 *   - ai         (src/tools/ai.ts)          — Perplexity market intel + DB export/report/feed
 *   - knowledge  (src/tools/knowledge.ts)   — DB-backed resources, workflow guidance, learnings
 *                                             (+ registerKnowledgeResources for lc://resources/<slug>)
 *   - prompts    (src/prompts.ts)           — lc_session_start (loads knowledge base)
 *
 * TODO (chunk 2c — still on the old low-level server):
 *   - analytics-widget (src/widgets/analytics-widget.ts) — analytics dashboards as widgets
 * Chunk 2c also re-introduces the widget/dataset layer (datasets.ts, widgets.ts,
 * okList()) and the /widget, /widget-data, /datasets CSV routes.
 *
 * The `getTenantSub` resolver is threaded in so per-tenant tools (leads owned by
 * a user, etc.) can scope queries by the authenticated user id once ported.
 */
export function registerAllTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // ping — trivial liveness/echo probe to prove the transport round-trips.
  // -------------------------------------------------------------------------
  server.tool(
    "ping",
    [
      "Liveness probe for the LC Connect MCP server.",
      "USE WHEN: you need to confirm the connection is alive or echo a message.",
      "DON'T USE WHEN: you need real CRM data — use get_statistics or a domain tool.",
      "RETURNS: 'pong' plus the optional echoed message.",
    ].join("\n"),
    {
      message: z
        .string()
        .max(500)
        .optional()
        .describe("Optional text to echo back."),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: message ? `pong: ${message}` : "pong",
          },
        ],
      };
    }
  );

  // -------------------------------------------------------------------------
  // get_statistics — high-level counts straight from Postgres.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_statistics",
    {
      title: "Database statistics",
      description: [
        "Return headline counts for the Laser Components database: total products,",
        "applications, leads, and product↔application mappings.",
        "USE WHEN: the user asks 'how many products/leads do we have?', wants a quick",
        "overview, or you need a sanity-check that the data layer is reachable.",
        "DON'T USE WHEN: the user wants the actual records (use the product/lead/",
        "application list tools in chunk 2) or filtered/segmented metrics.",
        "RETURNS: a KPI card (interactive tiles for products / applications / leads /",
        "mappings) — the card IS the answer; the model also receives the same integer",
        "counts in structuredContent. Present them briefly.",
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: KPI_WIDGET_URI },
        "openai/outputTemplate": KPI_WIDGET_URI,
      },
    },
    async () => {
      // Touch the tenant context so the wiring is exercised even though these
      // aggregate counts are not user-scoped.
      void getTenantSub();

      const [products, applications, leads, productApplications] =
        await Promise.all([
          prisma.product.count(),
          prisma.application.count(),
          prisma.lead.count(),
          prisma.applicationProduct.count(),
        ]);

      const stats = { products, applications, leads, productApplications };

      // Render the same counts as a KPI card. structuredContent keeps the raw
      // numbers so the model can answer "how many?" without parsing the card.
      const kpis: KpiItem[] = [
        { label: "Products", value: products, format: "int" },
        { label: "Applications", value: applications, format: "int" },
        { label: "Leads", value: leads, format: "int" },
        { label: "Product↔application links", value: productApplications, format: "int" },
      ];
      const meta: KpiMeta = { title: "Database statistics", kpis };
      const steer =
        `[PRESENTATION] Statistics: ${products} products, ${applications} applications, ` +
        `${leads} leads, ${productApplications} product↔application links. ` +
        `The widget (KPI tiles) IS the answer — summarize briefly, do not build tables.`;

      const env = buildKpiEnvelope(meta, steer);
      // Surface the raw counts alongside the slim KPI summary for the model.
      (env.structuredContent as Record<string, unknown>).stats = stats;
      return env as any;
    }
  );

  // -------------------------------------------------------------------------
  // CHUNK 2a domain tool sets.
  // -------------------------------------------------------------------------
  registerProductsTools(server, getTenantSub);
  registerApplicationsTools(server, getTenantSub);
  registerLeadsTools(server, getTenantSub);
  registerReportTools(server, getTenantSub);

  // -------------------------------------------------------------------------
  // CHUNK 2b domain tool sets.
  // -------------------------------------------------------------------------
  registerAiTools(server, getTenantSub);
  registerKnowledgeTools(server, getTenantSub);

  // -------------------------------------------------------------------------
  // CHUNK 2c — analytics widget card (leads_analytics).
  // -------------------------------------------------------------------------
  registerAnalyticsTools(server, getTenantSub);
}
