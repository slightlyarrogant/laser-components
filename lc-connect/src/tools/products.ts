import { prisma } from '../db/client.js'

export const productToolDefinitions = [
  {
    name: 'get_products',
    description:
      'USE WHEN: user asks to browse/list/filter product catalog records, optionally by category, subcategory, application, or text search. READ-ONLY; no approval should be needed. DO NOT USE WHEN: user only has a free-text product query and expects fuzzy lookup -> use search_products; user wants to create/delete product records -> use create_product/delete_product. GOTCHAS: categoryId/subcategoryId/applicationId must be resolved first; never guess IDs. Large results should be summarized with counts and top items, not dumped row-by-row.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10, description: 'Maximum number of products to return' },
        offset: { type: 'number', default: 0, description: 'Number of products to skip for pagination' },
        categoryId: { type: 'number', description: 'Filter by category ID' },
        subcategoryId: { type: 'number', description: 'Filter by subcategory ID' },
        applicationId: { type: 'number', description: 'Filter by application ID (products mapped to this application)' },
        search: { type: 'string', description: 'Search in name and description' },
        sortBy: {
          type: 'string',
          enum: ['name', 'createdAt', 'updatedAt'],
          default: 'createdAt',
          description: 'Field to sort by',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc',
          description: 'Sort direction',
        },
        includeApplications: { type: 'boolean', default: false, description: 'Include product-application mappings' },
      },
    },
  },
  {
    name: 'search_products',
    description:
      'USE WHEN: user gives a product/category/subcategory phrase and wants matching catalog items. READ-ONLY fuzzy lookup. DO NOT USE WHEN: exact filtered browsing by known IDs is needed -> use get_products. RETURNS: up to 20 matching products with category/subcategory context. GOTCHAS: use returned product IDs before calling create_lead, analyze_product_market, or discover_applications.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_product',
    description:
      'USE WHEN: user explicitly asks to create a product catalog record. WRITE ACTION; should require confirmation/approval. DO NOT USE WHEN: user is asking whether a product exists -> use search_products/get_products first. REQUIRED FIELDS: name and subcategoryId. GOTCHAS: resolve subcategoryId with get_categories; never guess IDs.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        subcategoryId: { type: 'number', description: 'Subcategory ID' },
        sku: { type: 'string', description: 'Stock keeping unit (optional)' },
        price: { type: 'number', description: 'Product price (optional)' },
        datasheet_url: { type: 'string', description: 'URL to product datasheet (optional)' },
        specifications: { type: 'object', description: 'Product specifications as JSON (optional)' },
      },
      required: ['name', 'subcategoryId'],
    },
  },
  {
    name: 'delete_product',
    description:
      'USE WHEN: user explicitly asks to delete a product record by ID. DESTRUCTIVE WRITE ACTION; should require confirmation/approval. DO NOT USE WHEN: user asks to archive, hide, or clean duplicate data without explicit deletion. GOTCHAS: deletion fails if product has leads or application mappings; inspect get_products/get_product_applications first.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Product ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_categories',
    description:
      'USE WHEN: user needs category/subcategory IDs or wants to understand product taxonomy. READ-ONLY. DO NOT USE WHEN: user wants product rows -> use get_products/search_products. RETURNS: categories and optionally subcategories with product counts. GOTCHAS: use this before create_product because create_product requires subcategoryId.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20 },
        includeSubcategories: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'find_category_like_products',
    description:
      'USE WHEN: user asks for data-quality cleanup candidates, especially product rows that look like category/landing pages rather than real SKU/product records. READ-ONLY diagnostic. DO NOT USE WHEN: user asks for normal product search -> use search_products/get_products.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20, description: 'Maximum results to return' },
      },
    },
  },
  {
    name: 'get_statistics',
    description:
      'USE WHEN: user asks for high-level database/catalog statistics or current system coverage. READ-ONLY. RETURNS: counts of products, applications, leads, and product-application mappings. DO NOT USE WHEN: user wants analytical breakdowns by segment; use dedicated list/search/group tools when available.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

type ToolResult = { content: Array<{ type: string; text: string }> }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

const MAX_QUERY_LIMIT = 1000

function enforceLimit(requested?: number): number {
  if (!requested) return 10
  return Math.min(requested, MAX_QUERY_LIMIT)
}

export async function handleProductTool(name: string, args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const a = (args ?? {}) as Record<string, any>

  switch (name) {
    case 'get_products': {
      const limit = enforceLimit(a.limit)
      const offset = a.offset || 0
      const categoryId = a.categoryId
      const subcategoryId = a.subcategoryId
      const applicationId = a.applicationId
      const search = a.search
      const sortBy = a.sortBy || 'createdAt'
      const sortOrder = a.sortOrder || 'desc'
      const includeApplications = a.includeApplications || false

      const whereConditions: any = {}

      if (subcategoryId) {
        whereConditions.subcategoryId = subcategoryId
      } else if (categoryId) {
        whereConditions.subcategory = { categoryId }
      }

      if (applicationId) {
        whereConditions.product_applications = { some: { applicationId } }
      }

      if (search) {
        whereConditions.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      const total = await prisma.product.count({ where: whereConditions })
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
      })

      return ok({
        success: true,
        data: products,
        pagination: { total, count: products.length, offset, limit, hasMore: offset + products.length < total },
        filters: { categoryId, subcategoryId, applicationId, search, sortBy, sortOrder },
      })
    }

    case 'search_products': {
      const query = a.query as string
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { subcategory: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        take: 20,
        include: { subcategory: { include: { category: true } } },
      })
      return ok({ success: true, data: products, count: products.length, query })
    }

    case 'create_product': {
      if (!a.name || !a.subcategoryId) {
        throw new Error('Product name and subcategoryId are required')
      }
      const subcategory = await prisma.subcategory.findUnique({ where: { id: a.subcategoryId } })
      if (!subcategory) throw new Error(`Subcategory with ID ${a.subcategoryId} not found`)

      const productData: any = { name: a.name, subcategoryId: a.subcategoryId }
      if (a.description) productData.description = a.description
      if (a.sku) productData.sku = a.sku
      if (a.price !== undefined) productData.price = a.price
      if (a.datasheet_url) productData.datasheet_url = a.datasheet_url
      if (a.specifications) productData.specifications = a.specifications

      try {
        const newProduct = await prisma.product.create({
          data: productData,
          include: { subcategory: { include: { category: true } } },
        })
        return ok({ success: true, message: 'Product created successfully', product: newProduct })
      } catch (error: any) {
        if (error.code === 'P2002') {
          throw new Error(`Product with name "${a.name}" already exists in subcategory ${a.subcategoryId}`)
        }
        throw error
      }
    }

    case 'delete_product': {
      if (!a.id) throw new Error('Product ID is required')
      const product = await prisma.product.findUnique({
        where: { id: a.id },
        include: {
          leads: { select: { id: true } },
          product_applications: { select: { productId: true, applicationId: true } },
        },
      })
      if (!product) throw new Error(`Product with ID ${a.id} not found`)
      if (product.leads.length > 0 || product.product_applications.length > 0) {
        throw new Error(
          `Cannot delete product ${a.id}: It has ${product.leads.length} leads and ${product.product_applications.length} application mappings. Please remove these associations first.`
        )
      }
      await prisma.product.delete({ where: { id: a.id } })
      return ok({ success: true, message: `Product "${product.name}" (ID: ${a.id}) deleted successfully` })
    }

    case 'get_categories': {
      const limit = a.limit || 20
      const includeSubcategories = a.includeSubcategories !== false

      const categories = await prisma.category.findMany({
        take: limit,
        orderBy: { name: 'asc' },
        include: includeSubcategories
          ? {
              subcategories: {
                orderBy: { name: 'asc' },
                include: { _count: { select: { products: true } } },
              },
            }
          : { _count: { select: { subcategories: true } } },
      })
      return ok({ success: true, data: categories, count: categories.length })
    }

    case 'find_category_like_products': {
      const limit = a.limit || 20
      const suspiciousProducts = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: 'Accessories', mode: 'insensitive' } },
            { name: { contains: 'Components', mode: 'insensitive' } },
            { name: { contains: 'Series', mode: 'insensitive' } },
            { name: { contains: 'Family', mode: 'insensitive' } },
            { name: { contains: 'Collection', mode: 'insensitive' } },
            { description: { contains: 'View Product', mode: 'insensitive' } },
            { description: { contains: 'Click here', mode: 'insensitive' } },
            { description: { contains: 'See more', mode: 'insensitive' } },
            { description: { contains: 'Browse', mode: 'insensitive' } },
            { description: { contains: 'Explore', mode: 'insensitive' } },
          ],
          AND: [
            { name: { not: { contains: ' - ' } } },
            { sku: null },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subcategory: { include: { category: true } },
          leads: { select: { id: true } },
          product_applications: { select: { productId: true, applicationId: true } },
        },
      })

      const scoredProducts = suspiciousProducts.map((product: any) => {
        let score = 0
        if (product.name.match(/Accessories|Components|Series|Family|Collection/i)) score += 3
        if (product.name.length < 20) score += 1
        if (!product.name.includes('-') && !product.name.includes(',')) score += 1
        if (product.description?.match(/View Product|Click here|See more|Browse|Explore/i)) score += 3
        if (product.description?.includes('coupling') || product.description?.includes('illuminating')) score += 2
        if (product.description?.length < 100) score += 1
        if (!product.sku) score += 2
        if (!product.price) score += 1
        if (!product.datasheet_url) score += 1
        if (product.leads.length === 0 && product.product_applications.length === 0) score += 1
        return {
          ...product,
          categoryLikelihoodScore: score,
          associations: { leads: product.leads.length, applications: product.product_applications.length },
        }
      })

      scoredProducts.sort((a: any, b: any) => b.categoryLikelihoodScore - a.categoryLikelihoodScore)
      return ok({
        success: true,
        message: 'Products that may be category pages requiring deeper scraping',
        totalFound: scoredProducts.length,
        products: scoredProducts,
      })
    }

    case 'get_statistics': {
      const [products, applications, leads, productApplications] = await Promise.all([
        prisma.product.count(),
        prisma.application.count(),
        prisma.lead.count(),
        prisma.applicationProduct.count(),
      ])
      return ok({
        success: true,
        data: { products, applications, leads, productApplications },
      })
    }

    default:
      throw new Error(`Unknown product tool: ${name}`)
  }
}
