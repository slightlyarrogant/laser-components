import { prisma } from '../db/client.js'

export const applicationToolDefinitions = [
  {
    name: 'get_applications',
    description:
      'USE WHEN: user asks to list/filter known industrial applications or needs application IDs. READ-ONLY. DO NOT USE WHEN: user asks AI to discover new possible applications -> use discover_applications; user wants product mappings -> use get_product_applications. GOTCHAS: status must use exact enum values.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE'],
        },
      },
    },
  },
  {
    name: 'create_application',
    description:
      'USE WHEN: user explicitly asks to create a new application record. WRITE ACTION; should require confirmation/approval. DO NOT USE WHEN: user only asks for AI application ideas -> use discover_applications first. REQUIRED FIELDS: name.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE'],
          default: 'ACTIVE',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_product_applications',
    description:
      'USE WHEN: user asks which products are mapped to applications or which applications are mapped to a product. READ-ONLY. DO NOT USE WHEN: user asks to create a mapping -> use create_product_application. GOTCHAS: productId/applicationId should be resolved first with search_products/get_applications.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description:
      'USE WHEN: user explicitly asks to map/link a product to an application. WRITE ACTION; should require confirmation/approval. DO NOT USE WHEN: user asks to inspect mappings -> use get_product_applications. REQUIRED FIELDS: productId and applicationId; never guess IDs.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
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
    description:
      'USE WHEN: user needs region/country IDs or asks about geographic coverage. READ-ONLY. DO NOT USE WHEN: user asks for lead records by region -> use get_leads after resolving IDs.',
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
        includeCountries: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'advanced_search',
    description:
      'USE WHEN: user gives one broad search term and wants matches across products, leads, and applications. READ-ONLY. DO NOT USE WHEN: user clearly targets one entity type -> use search_products/search_leads/get_applications. RETURNS: grouped matches by entity type with counts.',
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
      if (a.productId) whereConditions.productId = a.productId
      if (a.applicationId) whereConditions.applicationId = a.applicationId

      const mappings = await prisma.applicationProduct.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { assignedAt: 'desc' },
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

      const mapping = await prisma.applicationProduct.create({
        data: {
          productId: a.productId,
          applicationId: a.applicationId,
          assignedBy: a.assignedBy || 'MCP Server',
        },
        include: {
          product: { select: { id: true, name: true, description: true } },
          application: { select: { id: true, name: true, description: true } },
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
            product: { select: { id: true, name: true } },
            application: { select: { id: true, name: true } },
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
