import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { DATASET_WIDGET_URI, okList } from "../datasets.js";
import { config } from "../config.js";
import { prisma } from "../db/client.js";

/**
 * Product catalog domain tools (CRUD, search, taxonomy, data-quality).
 *
 * Prisma logic is ported verbatim from the old low-level server; only the
 * transport shape (zod schema + high-level `server.tool`) and the description
 * strings have been upgraded.
 */

const MAX_QUERY_LIMIT = 1000;

// Row count above which a list result is emitted as a DATASET widget rather
// than inline JSON (mirrors Vendo's list-tool threshold behaviour). At or below
// it, small sets stay inline so the model reads them directly.
const DATASET_THRESHOLD = 10;

function enforceLimit(requested?: number): number {
  if (!requested) return 10;
  return Math.min(requested, MAX_QUERY_LIMIT);
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerProductsTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // get_products — filtered/paginated catalog browse.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_products",
    {
      title: "Produkty",
      description: [
        "List/filter the product catalog with pagination, optionally by category,",
        "subcategory, application, or free-text search.",
        "USE WHEN: the user wants to browse/list/filter products by known IDs or a",
        "text fragment, paginate through the catalog, or pull product rows for analysis.",
        "DO NOT USE WHEN: the user has only a fuzzy phrase and expects best-effort",
        "matching -> use search_products; the user wants to create/delete a product",
        "-> use create_product/delete_product.",
        "RETURNS: a small result inline as { success, data[], pagination, filters }; a",
        "LARGE result (> threshold) as an interactive DATASET widget (sortable/searchable",
        "table + CSV export) — present that widget, do not re-list rows.",
        "GOTCHAS: categoryId/subcategoryId/applicationId must be resolved first (get_categories,",
        "get_applications) — never guess IDs. Summarize large result sets with counts and top",
        "items rather than dumping every row.",
      ].join("\n"),
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of products to return (capped at 1000)."),
        offset: z
          .number()
          .optional()
          .default(0)
          .describe("Number of products to skip for pagination."),
        categoryId: z
          .number()
          .optional()
          .describe("Filter by category ID."),
        subcategoryId: z
          .number()
          .optional()
          .describe("Filter by subcategory ID (takes precedence over categoryId)."),
        applicationId: z
          .number()
          .optional()
          .describe("Filter by application ID (products mapped to this application)."),
        search: z
          .string()
          .optional()
          .describe("Case-insensitive search in name and description."),
        sortBy: z
          .enum(["name", "createdAt", "updatedAt"])
          .optional()
          .default("createdAt")
          .describe("Field to sort by."),
        sortOrder: z
          .enum(["asc", "desc"])
          .optional()
          .default("desc")
          .describe("Sort direction."),
        includeApplications: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include product-application mappings in each row."),
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

      const limit = enforceLimit(a.limit);
      const offset = a.offset || 0;
      const categoryId = a.categoryId;
      const subcategoryId = a.subcategoryId;
      const applicationId = a.applicationId;
      const search = a.search;
      const sortBy = a.sortBy || "createdAt";
      const sortOrder = a.sortOrder || "desc";
      const includeApplications = a.includeApplications || false;

      const whereConditions: any = {};

      if (subcategoryId) {
        whereConditions.subcategoryId = subcategoryId;
      } else if (categoryId) {
        whereConditions.subcategory = { categoryId };
      }

      if (applicationId) {
        whereConditions.product_applications = { some: { applicationId } };
      }

      if (search) {
        whereConditions.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const total = await prisma.product.count({ where: whereConditions });
      const products = await prisma.product.findMany({
        where: whereConditions,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
        include: {
          subcategory: { include: { category: true } },
          ...(includeApplications && {
            product_applications: { include: { application: true } },
          }),
        },
      });

      const payload = {
        success: true,
        data: products,
        pagination: {
          total,
          count: products.length,
          offset,
          limit,
          hasMore: offset + products.length < total,
        },
        filters: { categoryId, subcategoryId, applicationId, search, sortBy, sortOrder },
      };

      // Large result -> DATASET widget; small result -> inline JSON. okList
      // decides on the row count vs DATASET_THRESHOLD. The widget rows are a
      // FLAT projection (nested subcategory/category surfaced as scalar
      // columns) so the type-aware table renders cleanly; the curated key
      // columns lead, with the full set available via the "Wszystkie" view.
      const rows = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        price: p.price != null ? Number(p.price) : null,
        subcategory: p.subcategory?.name ?? null,
        category: p.subcategory?.category?.name ?? null,
        description: p.description ?? null,
        datasheet_url: p.datasheet_url ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      const widget = okList(
        rows,
        "Produkty",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["id", "name", "sku", "price", "subcategory", "category"]
      );
      // Inline path (small set): return the rich original payload, not the flat
      // projection, so callers keep pagination/filters context.
      if (!("structuredContent" in widget)) return ok(payload);
      return widget;
    }
  );

  // -------------------------------------------------------------------------
  // search_products — fuzzy lookup across name/description/subcategory.
  // -------------------------------------------------------------------------
  server.tool(
    "search_products",
    [
      "Fuzzy product lookup by a free-text phrase across name, description, and",
      "subcategory name.",
      "USE WHEN: the user gives a product/category/subcategory phrase and wants",
      "matching catalog items (e.g. to resolve a product ID).",
      "DO NOT USE WHEN: the user wants exact filtered browsing by known IDs or",
      "pagination -> use get_products.",
      "RETURNS: { success, data[] (up to 20 with category/subcategory context), count, query }.",
      "GOTCHAS: use the returned product IDs before calling create_lead or",
      "create_product_application; never guess IDs.",
    ].join("\n"),
    {
      query: z
        .string()
        .describe("Free-text phrase to match against name, description, and subcategory name."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      const query = a.query;
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { subcategory: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        take: 20,
        include: { subcategory: { include: { category: true } } },
      });
      return ok({ success: true, data: products, count: products.length, query });
    }
  );

  // -------------------------------------------------------------------------
  // create_product — catalog write.
  // -------------------------------------------------------------------------
  server.tool(
    "create_product",
    [
      "Create a product catalog record.",
      "USE WHEN: the user explicitly asks to create a product. WRITE ACTION —",
      "confirm intent first.",
      "DO NOT USE WHEN: the user is asking whether a product exists -> use",
      "search_products/get_products first.",
      "RETURNS: { success, message, product } with subcategory+category context.",
      "GOTCHAS: name and subcategoryId are required; resolve subcategoryId with",
      "get_categories. Fails (P2002) if a product with the same name already exists",
      "in that subcategory.",
    ].join("\n"),
    {
      name: z.string().describe("Product name (required)."),
      subcategoryId: z.number().describe("Subcategory ID the product belongs to (required)."),
      description: z.string().optional().describe("Product description."),
      sku: z.string().optional().describe("Stock keeping unit (optional, unique)."),
      price: z.number().optional().describe("Product price (optional)."),
      datasheet_url: z.string().optional().describe("URL to product datasheet (optional)."),
      specifications: z
        .record(z.any())
        .optional()
        .describe("Product specifications as a JSON object (optional)."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.name || !a.subcategoryId) {
        throw new Error("Product name and subcategoryId are required");
      }
      const subcategory = await prisma.subcategory.findUnique({ where: { id: a.subcategoryId } });
      if (!subcategory) throw new Error(`Subcategory with ID ${a.subcategoryId} not found`);

      const productData: any = { name: a.name, subcategoryId: a.subcategoryId };
      if (a.description) productData.description = a.description;
      if (a.sku) productData.sku = a.sku;
      if (a.price !== undefined) productData.price = a.price;
      if (a.datasheet_url) productData.datasheet_url = a.datasheet_url;
      if (a.specifications) productData.specifications = a.specifications;

      try {
        const newProduct = await prisma.product.create({
          data: productData,
          include: { subcategory: { include: { category: true } } },
        });
        return ok({ success: true, message: "Product created successfully", product: newProduct });
      } catch (error: any) {
        if (error.code === "P2002") {
          throw new Error(
            `Product with name "${a.name}" already exists in subcategory ${a.subcategoryId}`
          );
        }
        throw error;
      }
    }
  );

  // -------------------------------------------------------------------------
  // delete_product — destructive catalog write.
  // -------------------------------------------------------------------------
  server.tool(
    "delete_product",
    [
      "Permanently delete a product record by ID.",
      "USE WHEN: the user explicitly asks to delete a product by ID. DESTRUCTIVE —",
      "confirm intent first.",
      "DO NOT USE WHEN: the user asks to archive, hide, or clean duplicate data",
      "without explicit deletion.",
      "RETURNS: { success, message }.",
      "GOTCHAS: deletion is refused if the product has any leads or application",
      "mappings; inspect get_products/get_product_applications and remove those",
      "associations first.",
    ].join("\n"),
    {
      id: z.number().describe("Product ID to delete."),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.id) throw new Error("Product ID is required");
      const product = await prisma.product.findUnique({
        where: { id: a.id },
        include: {
          leads: { select: { id: true } },
          product_applications: { select: { productId: true, applicationId: true } },
        },
      });
      if (!product) throw new Error(`Product with ID ${a.id} not found`);
      if (product.leads.length > 0 || product.product_applications.length > 0) {
        throw new Error(
          `Cannot delete product ${a.id}: It has ${product.leads.length} leads and ${product.product_applications.length} application mappings. Please remove these associations first.`
        );
      }
      await prisma.product.delete({ where: { id: a.id } });
      return ok({
        success: true,
        message: `Product "${product.name}" (ID: ${a.id}) deleted successfully`,
      });
    }
  );

  // -------------------------------------------------------------------------
  // get_categories — taxonomy lookup.
  // -------------------------------------------------------------------------
  server.tool(
    "get_categories",
    [
      "List product categories (and optionally their subcategories with product counts).",
      "USE WHEN: the user needs category/subcategory IDs or wants to understand the",
      "product taxonomy.",
      "DO NOT USE WHEN: the user wants product rows -> use get_products/search_products.",
      "RETURNS: { success, data[] (categories, optionally with subcategories+counts), count }.",
      "GOTCHAS: call this before create_product, which requires a subcategoryId.",
    ].join("\n"),
    {
      limit: z.number().optional().default(20).describe("Maximum number of categories to return."),
      includeSubcategories: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include subcategories (with product counts) for each category."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      const limit = a.limit || 20;
      const includeSubcategories = a.includeSubcategories !== false;

      const categories = await prisma.category.findMany({
        take: limit,
        orderBy: { name: "asc" },
        include: includeSubcategories
          ? {
              subcategories: {
                orderBy: { name: "asc" },
                include: { _count: { select: { products: true } } },
              },
            }
          : { _count: { select: { subcategories: true } } },
      });
      return ok({ success: true, data: categories, count: categories.length });
    }
  );

  // -------------------------------------------------------------------------
  // find_category_like_products — data-quality diagnostic.
  // -------------------------------------------------------------------------
  server.tool(
    "find_category_like_products",
    [
      "Find product rows that look like category/landing pages rather than real",
      "SKU/product records (data-quality cleanup candidates).",
      "USE WHEN: the user asks for cleanup candidates or rows that may be mis-scraped",
      "category pages.",
      "DO NOT USE WHEN: the user wants a normal product search -> use",
      "search_products/get_products.",
      "RETURNS: { success, message, totalFound, products[] } each with a",
      "categoryLikelihoodScore and association counts, sorted by score desc.",
      "GOTCHAS: this is a heuristic — review before any deletion.",
    ].join("\n"),
    {
      limit: z.number().optional().default(20).describe("Maximum number of results to return."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      const limit = a.limit || 20;
      const suspiciousProducts = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: "Accessories", mode: "insensitive" } },
            { name: { contains: "Components", mode: "insensitive" } },
            { name: { contains: "Series", mode: "insensitive" } },
            { name: { contains: "Family", mode: "insensitive" } },
            { name: { contains: "Collection", mode: "insensitive" } },
            { description: { contains: "View Product", mode: "insensitive" } },
            { description: { contains: "Click here", mode: "insensitive" } },
            { description: { contains: "See more", mode: "insensitive" } },
            { description: { contains: "Browse", mode: "insensitive" } },
            { description: { contains: "Explore", mode: "insensitive" } },
          ],
          AND: [{ name: { not: { contains: " - " } } }, { sku: null }],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subcategory: { include: { category: true } },
          leads: { select: { id: true } },
          product_applications: { select: { productId: true, applicationId: true } },
        },
      });

      const scoredProducts = suspiciousProducts.map((product: any) => {
        let score = 0;
        if (product.name.match(/Accessories|Components|Series|Family|Collection/i)) score += 3;
        if (product.name.length < 20) score += 1;
        if (!product.name.includes("-") && !product.name.includes(",")) score += 1;
        if (product.description?.match(/View Product|Click here|See more|Browse|Explore/i)) score += 3;
        if (product.description?.includes("coupling") || product.description?.includes("illuminating"))
          score += 2;
        if (product.description?.length < 100) score += 1;
        if (!product.sku) score += 2;
        if (!product.price) score += 1;
        if (!product.datasheet_url) score += 1;
        if (product.leads.length === 0 && product.product_applications.length === 0) score += 1;
        return {
          ...product,
          categoryLikelihoodScore: score,
          associations: {
            leads: product.leads.length,
            applications: product.product_applications.length,
          },
        };
      });

      scoredProducts.sort(
        (x: any, y: any) => y.categoryLikelihoodScore - x.categoryLikelihoodScore
      );
      return ok({
        success: true,
        message: "Products that may be category pages requiring deeper scraping",
        totalFound: scoredProducts.length,
        products: scoredProducts,
      });
    }
  );
}
