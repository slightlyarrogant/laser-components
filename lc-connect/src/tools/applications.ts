import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { ACTION_WIDGET_URI, buildActionEnvelope } from "@cfi/mcp-widgets";
import { DATASET_WIDGET_URI, okList } from "../datasets.js";
import { config } from "../config.js";
import { prisma } from "../db/client.js";

// Row count above which a list result is emitted as a DATASET widget rather than
// inline JSON (mirrors the threshold used by get_products/get_leads).
const DATASET_THRESHOLD = 10;

/**
 * Application catalog + product↔application mapping + region/cross-entity search.
 *
 * Prisma logic ported verbatim from the old low-level server; transport shape
 * and descriptions upgraded to the high-level `server.tool` style.
 */

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerApplicationsTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // get_applications — list known applications.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_applications",
    {
      title: "Applications",
      description: [
        "List known industrial applications (with lead/mapping counts), optionally",
        "filtered by status.",
        "USE WHEN: the user asks to list/filter applications or needs application IDs.",
        "DO NOT USE WHEN: the user wants product↔application mappings -> use",
        "get_product_applications.",
        "RETURNS: a small result inline as { success, data[], count }; a LARGE result",
        "(> threshold) as an interactive DATASET widget (sortable/searchable table + CSV",
        "export). The card IS the answer — do not re-list rows.",
        "GOTCHAS: status must be exactly 'ACTIVE' or 'INACTIVE'.",
      ].join("\n"),
      inputSchema: {
        limit: z.number().optional().default(10).describe("Maximum number of applications to return."),
        status: z
          .enum(["ACTIVE", "INACTIVE"])
          .optional()
          .describe("Filter by application status (ApplicationStatus enum)."),
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

      const limit = a.limit || 10;
      const whereConditions: any = {};
      if (a.status) whereConditions.status = a.status;

      const applications = await prisma.application.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { leads: true, product_applications: true } },
        },
      });

      // Flatten _count to scalar columns for the DATASET widget.
      const rows = applications.map((ap: any) => ({
        id: ap.id,
        name: ap.name,
        status: ap.status,
        description: ap.description ?? null,
        leads: ap._count?.leads ?? 0,
        products: ap._count?.product_applications ?? 0,
        createdAt: ap.createdAt,
      }));

      const widget = okList(
        rows,
        "Applications",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["id", "name", "status", "leads", "products"]
      );
      if (!("structuredContent" in widget)) {
        return ok({ success: true, data: applications, count: applications.length });
      }
      return widget as any;
    }
  );

  // -------------------------------------------------------------------------
  // create_application — application write.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "create_application",
    {
      title: "Create application",
      description: [
        "Create a new application record.",
        "USE WHEN: the user explicitly asks to create an application. WRITE ACTION —",
        "confirm intent first.",
        "DO NOT USE WHEN: the user is researching whether an application exists ->",
        "use get_applications first.",
        "RETURNS: an ACTION confirmation card on success (the created application's id +",
        "name); the model should confirm briefly.",
        "GOTCHAS: name is required; status defaults to 'ACTIVE' and must be a valid",
        "ApplicationStatus value.",
      ].join("\n"),
      inputSchema: {
        name: z.string().describe("Application name (required)."),
        description: z.string().optional().describe("Application description."),
        status: z
          .enum(["ACTIVE", "INACTIVE"])
          .optional()
          .default("ACTIVE")
          .describe("Application status (ApplicationStatus enum). Defaults to ACTIVE."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      void getTenantSub();

      if (!a.name) throw new Error("Application name is required");

      const applicationData: any = {
        name: a.name,
        status: a.status || "ACTIVE",
      };
      if (a.description) applicationData.description = a.description;

      const application = await prisma.application.create({
        data: applicationData,
        include: { _count: { select: { leads: true, product_applications: true } } },
      });
      return buildActionEnvelope(
        {
          status: "success",
          title: "Application created",
          detail: `${application.name} (status: ${application.status})`,
          id: String(application.id),
          idLabel: "Application ID",
        },
        `[PRESENTATION] Application "${application.name}" (ID ${application.id}) created. Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // get_product_applications — inspect mappings.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_product_applications",
    {
      title: "Product↔application mappings",
      description: [
        "List product↔application mappings, filtered by product and/or application.",
        "USE WHEN: the user asks which products are mapped to an application or which",
        "applications are mapped to a product.",
        "DO NOT USE WHEN: the user asks to create a mapping -> use",
        "create_product_application.",
        "RETURNS: a small result inline as { success, data[], count, filters }; a LARGE",
        "result (> threshold) as an interactive DATASET widget (sortable/searchable table",
        "+ CSV export). The card IS the answer — do not re-list rows.",
        "GOTCHAS: resolve productId/applicationId first with search_products/get_applications.",
      ].join("\n"),
      inputSchema: {
        productId: z.number().optional().describe("Filter by product ID."),
        applicationId: z.number().optional().describe("Filter by application ID."),
        limit: z.number().optional().default(20).describe("Maximum number of mappings to return."),
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

      const limit = a.limit || 20;
      const whereConditions: any = {};
      if (a.productId) whereConditions.productId = a.productId;
      if (a.applicationId) whereConditions.applicationId = a.applicationId;

      const mappings = await prisma.applicationProduct.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { assignedAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              subcategory: { include: { category: true } },
            },
          },
          application: {
            select: { id: true, name: true, description: true, status: true },
          },
        },
      });

      // Flatten the product/application relations to scalar columns.
      const rows = mappings.map((m: any) => ({
        productId: m.productId,
        product: m.product?.name ?? null,
        category: m.product?.subcategory?.category?.name ?? null,
        subcategory: m.product?.subcategory?.name ?? null,
        applicationId: m.applicationId,
        application: m.application?.name ?? null,
        applicationStatus: m.application?.status ?? null,
        assignedAt: m.assignedAt,
      }));

      const widget = okList(
        rows,
        "Product↔application mappings",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["productId", "product", "applicationId", "application", "applicationStatus"]
      );
      if (!("structuredContent" in widget)) {
        return ok({
          success: true,
          data: mappings,
          count: mappings.length,
          filters: { productId: a.productId, applicationId: a.applicationId },
        });
      }
      return widget as any;
    }
  );

  // -------------------------------------------------------------------------
  // create_product_application — map a product to an application.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "create_product_application",
    {
      title: "Map product → application",
      description: [
        "Map/link a product to an application.",
        "USE WHEN: the user explicitly asks to map a product to an application.",
        "WRITE ACTION — confirm intent first.",
        "DO NOT USE WHEN: the user asks to inspect existing mappings -> use",
        "get_product_applications.",
        "RETURNS: an ACTION confirmation card on success (product → application); the",
        "model should confirm briefly. Full mapping is in structuredContent.",
        "GOTCHAS: productId and applicationId are required; resolve both first and",
        "never guess IDs.",
      ].join("\n"),
      inputSchema: {
        productId: z.number().describe("Product ID to map (required)."),
        applicationId: z.number().describe("Application ID to map to (required)."),
        assignedBy: z
          .string()
          .optional()
          .default("MCP Server")
          .describe("Who/what created the mapping. Defaults to 'MCP Server'."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      void getTenantSub();

      if (!a.productId || !a.applicationId) {
        throw new Error("productId and applicationId are required");
      }

      const mapping = await prisma.applicationProduct.create({
        data: {
          productId: a.productId,
          applicationId: a.applicationId,
          assignedBy: a.assignedBy || "MCP Server",
        },
        include: {
          product: { select: { id: true, name: true, description: true } },
          application: { select: { id: true, name: true, description: true } },
        },
      });
      const productName = (mapping as any).product?.name ?? `#${a.productId}`;
      const applicationName = (mapping as any).application?.name ?? `#${a.applicationId}`;
      return buildActionEnvelope(
        {
          status: "success",
          title: "Mapping created",
          detail: `product ${productName} → application ${applicationName}`,
          id: `${a.productId}→${a.applicationId}`,
          idLabel: "Product → Application",
        },
        `[PRESENTATION] Mapping product "${productName}" → application "${applicationName}" created. Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // get_regions — geographic taxonomy lookup.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_regions",
    {
      title: "Regions",
      description: [
        "List regions (optionally with their countries and lead counts).",
        "USE WHEN: the user needs region/country IDs or asks about geographic coverage.",
        "DO NOT USE WHEN: the user wants lead records by region -> use get_leads after",
        "resolving the region/country IDs here.",
        "RETURNS: a small result inline as { success, data[], count }; a LARGE result",
        "(> threshold rows) as an interactive DATASET widget (one row per country with",
        "its region + region lead count, or per region when countries are excluded). The",
        "card IS the answer — do not re-list rows.",
      ].join("\n"),
      inputSchema: {
        limit: z.number().optional().default(20).describe("Maximum number of regions to return."),
        includeCountries: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include the countries (and lead count) for each region."),
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

      const limit = a.limit || 20;
      const includeCountries = a.includeCountries !== false;

      const regions = await prisma.region.findMany({
        take: limit,
        orderBy: { name: "asc" },
        include: includeCountries
          ? { countries: { orderBy: { name: "asc" } }, _count: { select: { leads: true } } }
          : { _count: { select: { countries: true, leads: true } } },
      });

      // Flatten: one row per country (region/country + region lead count) when
      // countries are included, else one row per region with its counts.
      const rows: Record<string, unknown>[] = includeCountries
        ? regions.flatMap((r: any) =>
            (r.countries ?? []).length
              ? r.countries.map((c: any) => ({
                  regionId: r.id,
                  region: r.name,
                  countryId: c.id,
                  country: c.name,
                  code: c.code ?? null,
                  regionLeads: r._count?.leads ?? 0,
                }))
              : [
                  {
                    regionId: r.id,
                    region: r.name,
                    countryId: null,
                    country: null,
                    code: null,
                    regionLeads: r._count?.leads ?? 0,
                  },
                ]
          )
        : regions.map((r: any) => ({
            regionId: r.id,
            region: r.name,
            countries: r._count?.countries ?? 0,
            leads: r._count?.leads ?? 0,
          }));

      const keyColumns = includeCountries
        ? ["regionId", "region", "countryId", "country", "code", "regionLeads"]
        : ["regionId", "region", "countries", "leads"];

      const widget = okList(rows, "Regions", config.PUBLIC_BASE_URL, DATASET_THRESHOLD, keyColumns);
      if (!("structuredContent" in widget)) {
        return ok({ success: true, data: regions, count: regions.length });
      }
      return widget as any;
    }
  );

  // -------------------------------------------------------------------------
  // advanced_search — cross-entity fuzzy search.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "advanced_search",
    {
      title: "Advanced search",
      description: [
        "Search a single broad term across products, leads, and applications at once.",
        "USE WHEN: the user gives one broad phrase and wants matches across multiple",
        "entity types.",
        "DO NOT USE WHEN: the user clearly targets one entity type -> use",
        "search_products / search_leads / get_applications.",
        "RETURNS: matches from all selected entity types in ONE combined, labelled",
        "DATASET widget (a `type` column tags each row product/lead/application; filter",
        "the table by type). The card IS the answer. A tiny combined result (<= threshold",
        "rows) is returned inline as { success, query, types, results{...}, counts }.",
        "GOTCHAS: pass `types` to narrow the search; defaults to all three.",
      ].join("\n"),
      inputSchema: {
        query: z.string().describe("Broad search term to match across the selected entity types."),
        types: z
          .array(z.enum(["products", "leads", "applications"]))
          .optional()
          .default(["products", "leads", "applications"])
          .describe("Which entity types to search. Defaults to all three."),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of matches per entity type."),
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

      if (!a.query) throw new Error("Search query is required");

      const searchTypes = Array.isArray(a.types)
        ? a.types
        : ["products", "leads", "applications"];
      const limit = a.limit || 10;
      const results: any = {};

      if (searchTypes.includes("products")) {
        results.products = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: "insensitive" } },
              { description: { contains: a.query, mode: "insensitive" } },
              { sku: { contains: a.query, mode: "insensitive" } },
              { subcategory: { name: { contains: a.query, mode: "insensitive" } } },
              {
                subcategory: {
                  category: { name: { contains: a.query, mode: "insensitive" } },
                },
              },
            ],
          },
          take: limit,
          include: { subcategory: { include: { category: true } } },
        });
      }

      if (searchTypes.includes("leads")) {
        results.leads = await prisma.lead.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: "insensitive" } },
              { description: { contains: a.query, mode: "insensitive" } },
              { email: { contains: a.query, mode: "insensitive" } },
              { industry: { contains: a.query, mode: "insensitive" } },
              { website: { contains: a.query, mode: "insensitive" } },
            ],
          },
          take: limit,
          include: {
            product: { select: { id: true, name: true } },
            application: { select: { id: true, name: true } },
          },
        });
      }

      if (searchTypes.includes("applications")) {
        results.applications = await prisma.application.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: "insensitive" } },
              { description: { contains: a.query, mode: "insensitive" } },
            ],
          },
          take: limit,
          include: { _count: { select: { leads: true, product_applications: true } } },
        });
      }

      const counts = {
        products: results.products?.length || 0,
        leads: results.leads?.length || 0,
        applications: results.applications?.length || 0,
      };

      // Combined, labelled dataset: heterogeneous entity types collapsed into one
      // common scalar projection (type/id/name/detail/context) so the whole result
      // is a single sortable/searchable/type-filterable table. Per-group caps mean
      // each group stays small, but the COMBINED set can exceed the threshold —
      // one card covering all matches is cleaner than up to three separate cards.
      const rows: Record<string, unknown>[] = [];
      for (const p of results.products ?? []) {
        rows.push({
          type: "product",
          id: p.id,
          name: p.name,
          detail: p.sku ?? null,
          context: p.subcategory?.category?.name ?? p.subcategory?.name ?? null,
        });
      }
      for (const l of results.leads ?? []) {
        rows.push({
          type: "lead",
          id: l.id,
          name: l.name,
          detail: l.status ?? null,
          context: l.industry ?? l.product?.name ?? null,
        });
      }
      for (const ap of results.applications ?? []) {
        rows.push({
          type: "application",
          id: ap.id,
          name: ap.name,
          detail: ap.status ?? null,
          context: `${ap._count?.leads ?? 0} leads / ${ap._count?.product_applications ?? 0} prod.`,
        });
      }

      const widget = okList(
        rows,
        `Search — "${a.query}"`,
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["type", "id", "name", "detail", "context"]
      );
      if (!("structuredContent" in widget)) {
        return ok({ success: true, query: a.query, types: searchTypes, results, counts });
      }
      return widget as any;
    }
  );
}
