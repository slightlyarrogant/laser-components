import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  ANALYTICS_WIDGET_URI,
  buildAnalyticsEnvelope,
  type AnalyticsMeta,
  type AnalyticsView,
} from "@cfi/mcp-widgets";
import { prisma } from "../db/client.js";

/**
 * Analytics card — `leads_analytics`.
 *
 * Read-only dashboard: leads grouped by industry sector, rendered through the
 * SHARED @cfi/mcp-widgets ANALYTICS widget (one client-side table view + a 4-KPI
 * header strip). Mirrors Vendo's analytics-sales-widget.ts wiring:
 *   - registerAppTool binds the tool to ANALYTICS_WIDGET_URI in its DEFINITION
 *     (`_meta.ui.resourceUri` + `openai/outputTemplate`), required for the host
 *     to render the inline widget.
 *   - the handler builds an AnalyticsMeta and returns buildAnalyticsEnvelope,
 *     which puts the rows in `_meta` (the model never sees them) and a slim
 *     summary + Polish brevity steer in content/structuredContent.
 *
 * The shared widget RESOURCE is registered once per server by
 * registerSharedWidgets (src/widgets.ts) — NOT here.
 */

const LOST_WON = ["LOST", "WON"] as const;

export function registerAnalyticsTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  registerAppTool(
    server,
    "leads_analytics",
    {
      title: "Leady wg sektora",
      description: [
        "Read-only analytics dashboard: sales leads grouped by industry sector,",
        "rendered as an INTERACTIVE inline widget (sortable/searchable table + a",
        "header KPI strip). ONE call computes everything; the user reads the widget",
        "without any further tool calls.",
        "USE WHEN: the user wants an overview of leads by sector/industry, a",
        "breakdown of the pipeline, or headline KPIs (total/active leads, conversion,",
        "product coverage).",
        "DO NOT USE WHEN: the user wants the actual lead RECORDS or to filter a",
        "specific subset -> use get_leads/search_leads.",
        "RETURNS: an interactive widget (the widget IS the answer). The model only",
        "sees slim totals + counts — present them briefly and do NOT enumerate rows.",
        "Read-only — no confirmation needed.",
      ].join("\n"),
      inputSchema: {
        topN: z
          .number()
          .int()
          .positive()
          .optional()
          .default(25)
          .describe(
            "Maximum number of sector rows to show in the table (default 25, sorted by lead count desc)."
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ANALYTICS_WIDGET_URI },
        // OpenAI compat alias so ChatGPT binds this widget explicitly.
        "openai/outputTemplate": ANALYTICS_WIDGET_URI,
      },
    },
    async (args: { topN?: number }) => {
      void getTenantSub();

      const topN = args.topN ?? 25;

      // --- Aggregations (all via Prisma) -----------------------------------
      const [
        bySector,
        totalLeads,
        activeLeads,
        wonLeads,
        totalProducts,
        coveredProducts,
      ] = await Promise.all([
        // Leads grouped by industry, counted.
        prisma.lead.groupBy({
          by: ["industry"],
          _count: { _all: true },
        }),
        prisma.lead.count(),
        // Active = not yet closed (status not in LOST/WON).
        prisma.lead.count({ where: { status: { notIn: [...LOST_WON] } } }),
        prisma.lead.count({ where: { status: "WON" } }),
        prisma.product.count(),
        // Distinct products that appear in at least one product<->application
        // mapping (the applicationProduct join model, table product_applications,
        // join field productId — verified against prisma/schema.prisma).
        prisma.applicationProduct
          .groupBy({ by: ["productId"] })
          .then((g) => g.length),
      ]);

      const conversionPct =
        totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
      const coveragePct =
        totalProducts > 0
          ? Math.round((coveredProducts / totalProducts) * 100)
          : 0;

      // Sector rows: coalesce null/blank industry -> 'Nieznany', sort desc,
      // cap to topN. Rows use the reserved layout key "Nazwa" (the frozen first
      // column) + the numeric measure "Leady"; tableCols label them in Polish.
      const sectorRows = bySector
        .map((r) => ({
          Nazwa:
            (r.industry ?? "").trim() === "" ? "Nieznany" : (r.industry as string),
          Leady: r._count._all,
        }))
        .sort((a, b) => b.Leady - a.Leady);
      const cappedRows = sectorRows.slice(0, topN);

      const view: AnalyticsView = {
        id: "sektory",
        label: "Sektory",
        kind: "table",
        rows: cappedRows,
        tableCols: [
          { key: "Nazwa", label: "Sektor", fmt: "text" },
          { key: "Leady", label: "Leady", fmt: "int", total: totalLeads },
        ],
      };

      const meta: AnalyticsMeta = {
        title: "Leady wg sektora",
        kpiStrip: [
          { label: "Leady (suma)", value: totalLeads, kind: "int" },
          { label: "Aktywne", value: activeLeads, kind: "int" },
          { label: "Konwersja %", value: conversionPct, kind: "int" },
          { label: "Pokrycie prod. %", value: coveragePct, kind: "int" },
        ],
        tableCols: [
          { key: "Nazwa", label: "Sektor", fmt: "text" },
          { key: "Leady", label: "Leady", fmt: "int", total: totalLeads },
        ],
        views: [view],
        csvStem: "leady-wg-sektora",
        counts: { sektory: sectorRows.length },
      };

      const steer =
        `[PREZENTACJA] Leady wg sektora: ${totalLeads} leadów łącznie, ${activeLeads} aktywnych, ` +
        `konwersja ${conversionPct}%, pokrycie produktowe ${coveragePct}%. ` +
        `Widget JEST odpowiedzią — NIE wypisuj wierszy w tekście, nie twórz tabel ani list. ` +
        `Podsumuj tylko nagłówkowe KPI; szczegóły sektorów są w widgecie.`;

      // Cast to `any`: the ext-apps ToolCallback return type expects an index
      // signature that WidgetEnvelope omits — Vendo's analytics tools cast the
      // same way. The runtime shape (content/structuredContent/_meta) is exact.
      return buildAnalyticsEnvelope(meta, steer) as any;
    }
  );
}
