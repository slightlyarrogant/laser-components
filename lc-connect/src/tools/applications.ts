import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "../db/client.js";

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
  server.tool(
    "get_applications",
    [
      "List known industrial applications (with lead/mapping counts), optionally",
      "filtered by status.",
      "USE WHEN: the user asks to list/filter applications or needs application IDs.",
      "DO NOT USE WHEN: the user wants product↔application mappings -> use",
      "get_product_applications.",
      "RETURNS: { success, data[] (with _count.leads / _count.product_applications), count }.",
      "GOTCHAS: status must be exactly 'ACTIVE' or 'INACTIVE'.",
    ].join("\n"),
    {
      limit: z.number().optional().default(10).describe("Maximum number of applications to return."),
      status: z
        .enum(["ACTIVE", "INACTIVE"])
        .optional()
        .describe("Filter by application status (ApplicationStatus enum)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      return ok({ success: true, data: applications, count: applications.length });
    }
  );

  // -------------------------------------------------------------------------
  // create_application — application write.
  // -------------------------------------------------------------------------
  server.tool(
    "create_application",
    [
      "Create a new application record.",
      "USE WHEN: the user explicitly asks to create an application. WRITE ACTION —",
      "confirm intent first.",
      "DO NOT USE WHEN: the user is researching whether an application exists ->",
      "use get_applications first.",
      "RETURNS: { success, data (with counts), message }.",
      "GOTCHAS: name is required; status defaults to 'ACTIVE' and must be a valid",
      "ApplicationStatus value.",
    ].join("\n"),
    {
      name: z.string().describe("Application name (required)."),
      description: z.string().optional().describe("Application description."),
      status: z
        .enum(["ACTIVE", "INACTIVE"])
        .optional()
        .default("ACTIVE")
        .describe("Application status (ApplicationStatus enum). Defaults to ACTIVE."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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
      return ok({ success: true, data: application, message: "Application created successfully" });
    }
  );

  // -------------------------------------------------------------------------
  // get_product_applications — inspect mappings.
  // -------------------------------------------------------------------------
  server.tool(
    "get_product_applications",
    [
      "List product↔application mappings, filtered by product and/or application.",
      "USE WHEN: the user asks which products are mapped to an application or which",
      "applications are mapped to a product.",
      "DO NOT USE WHEN: the user asks to create a mapping -> use",
      "create_product_application.",
      "RETURNS: { success, data[] (with product+application context), count, filters }.",
      "GOTCHAS: resolve productId/applicationId first with search_products/get_applications.",
    ].join("\n"),
    {
      productId: z.number().optional().describe("Filter by product ID."),
      applicationId: z.number().optional().describe("Filter by application ID."),
      limit: z.number().optional().default(20).describe("Maximum number of mappings to return."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      return ok({
        success: true,
        data: mappings,
        count: mappings.length,
        filters: { productId: a.productId, applicationId: a.applicationId },
      });
    }
  );

  // -------------------------------------------------------------------------
  // create_product_application — map a product to an application.
  // -------------------------------------------------------------------------
  server.tool(
    "create_product_application",
    [
      "Map/link a product to an application.",
      "USE WHEN: the user explicitly asks to map a product to an application.",
      "WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user asks to inspect existing mappings -> use",
      "get_product_applications.",
      "RETURNS: { success, data (mapping with product+application), message }.",
      "GOTCHAS: productId and applicationId are required; resolve both first and",
      "never guess IDs.",
    ].join("\n"),
    {
      productId: z.number().describe("Product ID to map (required)."),
      applicationId: z.number().describe("Application ID to map to (required)."),
      assignedBy: z
        .string()
        .optional()
        .default("MCP Server")
        .describe("Who/what created the mapping. Defaults to 'MCP Server'."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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
      return ok({
        success: true,
        data: mapping,
        message: "Product-application mapping created successfully",
      });
    }
  );

  // -------------------------------------------------------------------------
  // get_regions — geographic taxonomy lookup.
  // -------------------------------------------------------------------------
  server.tool(
    "get_regions",
    [
      "List regions (optionally with their countries and lead counts).",
      "USE WHEN: the user needs region/country IDs or asks about geographic coverage.",
      "DO NOT USE WHEN: the user wants lead records by region -> use get_leads after",
      "resolving the region/country IDs here.",
      "RETURNS: { success, data[] (regions, optionally with countries+counts), count }.",
    ].join("\n"),
    {
      limit: z.number().optional().default(20).describe("Maximum number of regions to return."),
      includeCountries: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include the countries (and lead count) for each region."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      return ok({ success: true, data: regions, count: regions.length });
    }
  );

  // -------------------------------------------------------------------------
  // advanced_search — cross-entity fuzzy search.
  // -------------------------------------------------------------------------
  server.tool(
    "advanced_search",
    [
      "Search a single broad term across products, leads, and applications at once.",
      "USE WHEN: the user gives one broad phrase and wants matches across multiple",
      "entity types.",
      "DO NOT USE WHEN: the user clearly targets one entity type -> use",
      "search_products / search_leads / get_applications.",
      "RETURNS: { success, query, types, results{products?,leads?,applications?}, counts }.",
      "GOTCHAS: pass `types` to narrow the search; defaults to all three.",
    ].join("\n"),
    {
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
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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

      return ok({
        success: true,
        query: a.query,
        types: searchTypes,
        results,
        counts: {
          products: results.products?.length || 0,
          leads: results.leads?.length || 0,
          applications: results.applications?.length || 0,
        },
      });
    }
  );
}
