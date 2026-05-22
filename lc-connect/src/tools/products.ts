import { prisma } from '../db/client.js'

export const productToolDefinitions = [
  {
    name: 'get_products',
    description: 'Get products with flexible filtering options. All filters are optional and can be combined.',
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
    description: 'Search products by name, description, or subcategory name',
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
    description: 'Create a new product in the database',
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
    description: 'Delete a product from the database',
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
    description: 'Get categories with their subcategories',
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
    description: 'Find products that appear to be category pages needing deeper scraping',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20, description: 'Maximum results to return' },
      },
    },
  },
  {
    name: 'get_statistics',
    description: 'Get database statistics',
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
        whereConditions.product_applications = { some: { application_id: applicationId } }
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
            product_applications: { include: { applications: true } },
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
          product_applications: { select: { product_id: true, application_id: true } },
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
          product_applications: { select: { product_id: true, application_id: true } },
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
        prisma.product_applications.count(),
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
