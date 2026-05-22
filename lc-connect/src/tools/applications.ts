import { prisma } from '../db/client.js'

export const applicationToolDefinitions = [
  {
    name: 'get_applications',
    description: 'Get applications from the database',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
        },
      },
    },
  },
  {
    name: 'create_application',
    description: 'Create a new application',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
          default: 'ACTIVE',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_product_applications',
    description: 'Get product-application mappings',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        applicationId: { type: 'number' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'create_product_application',
    description: 'Create a product-application mapping',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        applicationId: { type: 'number' },
        assignedBy: { type: 'string', default: 'MCP Server' },
      },
      required: ['productId', 'applicationId'],
    },
  },
  {
    name: 'get_regions',
    description: 'Get regions with their countries',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20 },
        includeCountries: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'advanced_search',
    description: 'Advanced search across products, leads, and applications',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['products', 'leads', 'applications'],
          },
          default: ['products', 'leads', 'applications'],
        },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
]

type ToolResult = { content: Array<{ type: string; text: string }> }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export async function handleApplicationTool(name: string, args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const a = (args ?? {}) as Record<string, any>

  switch (name) {
    case 'get_applications': {
      const limit = a.limit || 10
      const whereConditions: any = {}
      if (a.status) whereConditions.status = a.status

      const applications = await prisma.application.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { leads: true, product_applications: true } },
        },
      })
      return ok({ success: true, data: applications, count: applications.length })
    }

    case 'create_application': {
      if (!a.name) throw new Error('Application name is required')

      const applicationData: any = {
        name: a.name,
        status: a.status || 'ACTIVE',
      }
      if (a.description) applicationData.description = a.description

      const application = await prisma.application.create({
        data: applicationData,
        include: { _count: { select: { leads: true, product_applications: true } } },
      })
      return ok({ success: true, data: application, message: 'Application created successfully' })
    }

    case 'get_product_applications': {
      const limit = a.limit || 20
      const whereConditions: any = {}
      if (a.productId) whereConditions.product_id = a.productId
      if (a.applicationId) whereConditions.application_id = a.applicationId

      const mappings = await prisma.product_applications.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { assigned_at: 'desc' },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              description: true,
              subcategory: { include: { category: true } },
            },
          },
          applications: {
            select: { id: true, name: true, description: true, status: true },
          },
        },
      })
      return ok({
        success: true,
        data: mappings,
        count: mappings.length,
        filters: { productId: a.productId, applicationId: a.applicationId },
      })
    }

    case 'create_product_application': {
      if (!a.productId || !a.applicationId) throw new Error('productId and applicationId are required')

      const mapping = await prisma.product_applications.create({
        data: {
          product_id: a.productId,
          application_id: a.applicationId,
          assignedBy: a.assignedBy || 'MCP Server',
        },
        include: {
          products: { select: { id: true, name: true, description: true } },
          applications: { select: { id: true, name: true, description: true } },
        },
      })
      return ok({ success: true, data: mapping, message: 'Product-application mapping created successfully' })
    }

    case 'get_regions': {
      const limit = a.limit || 20
      const includeCountries = a.includeCountries !== false

      const regions = await prisma.region.findMany({
        take: limit,
        orderBy: { name: 'asc' },
        include: includeCountries
          ? { countries: { orderBy: { name: 'asc' } }, _count: { select: { leads: true } } }
          : { _count: { select: { countries: true, leads: true } } },
      })
      return ok({ success: true, data: regions, count: regions.length })
    }

    case 'advanced_search': {
      if (!a.query) throw new Error('Search query is required')

      const searchTypes = Array.isArray(a.types) ? a.types : ['products', 'leads', 'applications']
      const limit = a.limit || 10
      const results: any = {}

      if (searchTypes.includes('products')) {
        results.products = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: 'insensitive' } },
              { description: { contains: a.query, mode: 'insensitive' } },
              { sku: { contains: a.query, mode: 'insensitive' } },
              { subcategory: { name: { contains: a.query, mode: 'insensitive' } } },
              { subcategory: { category: { name: { contains: a.query, mode: 'insensitive' } } } },
            ],
          },
          take: limit,
          include: { subcategory: { include: { category: true } } },
        })
      }

      if (searchTypes.includes('leads')) {
        results.leads = await prisma.lead.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: 'insensitive' } },
              { description: { contains: a.query, mode: 'insensitive' } },
              { email: { contains: a.query, mode: 'insensitive' } },
              { industry: { contains: a.query, mode: 'insensitive' } },
              { website: { contains: a.query, mode: 'insensitive' } },
            ],
          },
          take: limit,
          include: {
            products: { select: { id: true, name: true } },
            applications: { select: { id: true, name: true } },
          },
        })
      }

      if (searchTypes.includes('applications')) {
        results.applications = await prisma.application.findMany({
          where: {
            OR: [
              { name: { contains: a.query, mode: 'insensitive' } },
              { description: { contains: a.query, mode: 'insensitive' } },
            ],
          },
          take: limit,
          include: { _count: { select: { leads: true, product_applications: true } } },
        })
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
      })
    }

    default:
      throw new Error(`Unknown application tool: ${name}`)
  }
}
