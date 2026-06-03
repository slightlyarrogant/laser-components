import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  ANALYTICS_WIDGET_URI,
  buildAnalyticsEnvelope,
  type AnalyticsMeta,
  type AnalyticsView,
  MAP_WIDGET_URI,
  buildMapEnvelope,
  type MapMeta,
  type MapScope,
} from "@cfi/mcp-widgets";
import { prisma } from "../db/client.js";
import { PRESENT_BRIEFLY } from "./_present.js";

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
      title: "Leads by sector",
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
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {
        topN: z
          .number()
          .int()
          .positive()
          .optional()
          .default(12)
          .describe(
            "Maximum number of industry rows/bars to show (default 12, sorted by lead count desc)."
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

      // Cap labels/rows to a sensible top N (default 12 for the bar breakdown).
      const topN = args.topN ?? 12;

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
            (r.industry ?? "").trim() === "" ? "Unknown" : (r.industry as string),
          Leady: r._count._all,
        }))
        .sort((a, b) => b.Leady - a.Leady);
      const cappedRows = sectorRows.slice(0, topN);

      // Shared column spec for both views (frozen first column "Nazwa").
      const tableCols = [
        { key: "Nazwa", label: "Sector", fmt: "text" as const },
        {
          key: "Leady",
          label: "Leads",
          fmt: "int" as const,
          total: totalLeads,
        },
      ];

      // View 1 — bar breakdown "By industry". chart.fmt:'int' so the bar value
      // labels render as plain integers (lead COUNTS), not currency. Same capped
      // rows + tableCols ride along so the bar view also has its underlying data.
      const barView: AnalyticsView = {
        id: "industry",
        label: "By industry",
        kind: "bar",
        rows: cappedRows,
        chart: {
          labels: cappedRows.map((r) => r.Nazwa),
          values: cappedRows.map((r) => r.Leady),
          fmt: "int",
        },
        tableCols,
      };

      // View 2 — the sortable/searchable table.
      const tableView: AnalyticsView = {
        id: "table",
        label: "Table",
        kind: "table",
        rows: cappedRows,
        tableCols,
      };

      const meta: AnalyticsMeta = {
        title: "Leads by sector",
        kpiStrip: [
          { label: "Leads (total)", value: totalLeads, kind: "int" },
          { label: "Active", value: activeLeads, kind: "int" },
          { label: "Conversion %", value: conversionPct, kind: "int" },
          { label: "Product coverage %", value: coveragePct, kind: "int" },
        ],
        tableCols,
        views: [barView, tableView],
        csvStem: "leads-by-sector",
        counts: { industry: sectorRows.length, table: sectorRows.length },
      };

      const steer =
        `[PRESENTATION] Leads by sector: ${totalLeads} leads in total, ${activeLeads} active, ` +
        `conversion ${conversionPct}%, product coverage ${coveragePct}%. ` +
        `The widget shows a "By industry" bar breakdown (lead counts per industry) plus a sortable "Table" view, ` +
        `with the KPI strip on top. The widget IS the answer — do NOT list rows in text, do not build tables or lists. ` +
        `Summarize only the headline KPIs; the per-sector detail is in the widget.`;

      // Cast to `any`: the ext-apps ToolCallback return type expects an index
      // signature that WidgetEnvelope omits — Vendo's analytics tools cast the
      // same way. The runtime shape (content/structuredContent/_meta) is exact.
      return buildAnalyticsEnvelope(meta, steer) as any;
    }
  );

  // -------------------------------------------------------------------------
  // leads_by_country — choropleth map of lead counts per country.
  //
  // Read-only. Leads are grouped by their Lead.countryId; each country carries
  // an ISO-2 `code` (uppercased -> the MAP value key) and a `name` (a `names`
  // override so the widget shows the DB's spelling). Leads with no country
  // (countryId == null) are not codable to the map and are reported in `note`.
  // Renders the SHARED @cfi/mcp-widgets MAP widget (registered once per server
  // by registerSharedWidgets) — this file only registers the tool + binds the
  // MAP resourceUri, exactly like leads_analytics binds the analytics widget.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "leads_by_country",
    {
      title: "Leads by country",
      description: [
        "Read-only choropleth MAP of sales leads counted per country, rendered as",
        "an INTERACTIVE inline widget (a coloured world/Europe map with a legend,",
        "hover tooltips and a Europa/Świat scope switch). ONE call computes",
        "everything; the map IS the answer.",
        "USE WHEN: the user wants leads BY COUNTRY on a map, a geographic/territorial",
        "distribution of the pipeline, 'leady wg kraju', 'gdzie mamy leady', 'leads",
        "by country', 'mapa leadów'.",
        "DO NOT USE WHEN: the user wants leads by SECTOR/industry -> use",
        "leads_analytics; or the actual lead RECORDS -> use get_leads/search_leads.",
        "RETURNS: an interactive choropleth map (the widget IS the answer) plus a",
        "slim summary (total leads, how many countries carry data, top countries,",
        "and how many leads have no country). Do NOT enumerate every country in",
        "prose — point at the map. Read-only — no confirmation needed.",
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {
        scope: z
          .enum(["europe", "world"])
          .optional()
          .default("world")
          .describe(
            "Initial map scope: 'world' (default) or 'europe'. Purely the widget's starting view — the underlying per-country counts are identical."
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: MAP_WIDGET_URI },
        // OpenAI compat alias so ChatGPT binds this widget explicitly.
        "openai/outputTemplate": MAP_WIDGET_URI,
      },
    },
    async (args: { scope?: MapScope }) => {
      void getTenantSub();

      const scope: MapScope = args.scope === "europe" ? "europe" : "world";

      // Leads grouped by their country FK; resolve each FK -> ISO-2 code + name.
      const [grouped, countries, totalLeads] = await Promise.all([
        prisma.lead.groupBy({
          by: ["countryId"],
          _count: { _all: true },
        }),
        prisma.country.findMany({ select: { id: true, code: true, name: true } }),
        prisma.lead.count(),
      ]);

      const countryById = new Map(countries.map((c) => [c.id, c]));

      // Build the per-ISO-2 value map (uppercased) + DB-name overrides.
      // Coalesce leads whose country has no resolvable code, and count leads
      // with no country at all (countryId == null) as "uncoded".
      const values: Record<string, number> = {};
      const names: Record<string, string> = {};
      let uncoded = 0;
      let codedLeads = 0;

      for (const row of grouped) {
        const count = row._count._all;
        const country =
          row.countryId != null ? countryById.get(row.countryId) : undefined;
        const code = country?.code?.trim().toUpperCase();
        if (!code) {
          uncoded += count;
          continue;
        }
        values[code] = (values[code] ?? 0) + count;
        if (country?.name) names[code] = country.name;
        codedLeads += count;
      }

      const codedCountries = Object.keys(values).length;

      const meta: MapMeta = {
        title: "Leads by country",
        scope,
        unit: "leads",
        values,
        names,
        palette: "blues",
      };

      const note =
        uncoded > 0
          ? ` ${uncoded} of ${totalLeads} leads have no assigned country — not shown on the map.`
          : "";
      const steer =
        `[PRESENTATION] Map of leads by country (scope: ${scope === "europe" ? "Europe" : "World"}) ` +
        `is in the widget: ${codedLeads} leads across ${codedCountries} countries. ` +
        `The widget IS the answer — do NOT list countries in text. ` +
        `Comment in at most 1-2 sentences on the largest countries and the number of leads without a country.${note}`;

      // Cast to `any`: ext-apps ToolCallback expects an index signature that
      // WidgetEnvelope omits; the runtime shape is exact. Mirrors leads_analytics.
      return buildMapEnvelope(meta, steer) as any;
    }
  );
}
