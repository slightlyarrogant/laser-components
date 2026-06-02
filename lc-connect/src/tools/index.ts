import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "../db/client.js";

/**
 * registerAllTools — registers the LC Connect tool set on a fresh McpServer.
 *
 * CHUNK 1 (this file): only a minimal proof-of-skeleton set —
 *   - get_statistics : DB-backed counts (products / applications / leads / mappings)
 *   - ping           : liveness probe
 *
 * TODO (CHUNK 2 — port the remaining 38 tools from the old low-level server,
 * grouped by domain; each becomes a high-level `server.tool(...)` with a zod
 * schema and a USE WHEN / DON'T USE description in VC's style):
 *   - products   (src/tools/products.ts)   — catalog CRUD, search, spec lookup
 *   - leads      (src/tools/leads.ts)       — lead list/create/update, scoring
 *   - applications (src/tools/applications.ts) — application catalog + product mappings
 *   - ai         (src/tools/ai.ts)          — lead scoring, enrichment, Perplexity research
 *   - knowledge  (src/tools/knowledge.ts)   — DB-backed knowledge/resource retrieval
 *   - report     (src/tools/report.ts)      — report generation / export
 *   - analytics-widget (src/widgets/analytics-widget.ts) — analytics dashboards as widgets
 * Chunk 2 also re-introduces the widget/dataset layer (datasets.ts, widgets.ts,
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
  server.tool(
    "get_statistics",
    [
      "Return headline counts for the Laser Components database: total products,",
      "applications, leads, and product↔application mappings.",
      "USE WHEN: the user asks 'how many products/leads do we have?', wants a quick",
      "overview, or you need a sanity-check that the data layer is reachable.",
      "DON'T USE WHEN: the user wants the actual records (use the product/lead/",
      "application list tools in chunk 2) or filtered/segmented metrics.",
      "RETURNS: a small JSON object of integer counts.",
    ].join("\n"),
    {},
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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
        structuredContent: stats,
      };
    }
  );
}
