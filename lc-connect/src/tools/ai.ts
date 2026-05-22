import { createRequire } from 'module'
import { prisma } from '../db/client.js'

const require = createRequire(import.meta.url)
const fetch = require('node-fetch')

// ---------------------------------------------------------------------------
// Perplexity client (inline, no external file dependency)
// ---------------------------------------------------------------------------

class PerplexityClient {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai'

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Perplexity API key is required')
    this.apiKey = apiKey
  }

  async analyze(prompt: string, context?: string): Promise<string> {
    let userMessage = prompt
    if (context) userMessage = `Context: ${context}\n\nRequest: ${prompt}`

    const body = {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in laser components and photonics industry analysis. Provide concise, data-driven insights.',
        },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Perplexity API error ${response.status}: ${error}`)
    }

    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || 'No response generated'
  }
}

let _perplexity: PerplexityClient | null = null

function getPerplexity(): PerplexityClient {
  if (!_perplexity) {
    const key = process.env.PERPLEXITY_API_KEY
    if (!key) throw new Error('PERPLEXITY_API_KEY environment variable is not set')
    _perplexity = new PerplexityClient(key)
  }
  return _perplexity
}

// ---------------------------------------------------------------------------
// Export utils (inline)
// ---------------------------------------------------------------------------

function convertToCSV(data: any[], fields?: string[]): string {
  if (!data || data.length === 0) return ''
  const keys = fields || Object.keys(data[0])
  const header = keys.join(',')
  const rows = data.map((item) => {
    return keys.map((key) => {
      const value = item[key]
      if (typeof value === 'object' && value !== null) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value ?? ''
    }).join(',')
  })
  return [header, ...rows].join('\n')
}

function createTableHTML(data: any[]): string {
  if (!data || data.length === 0) return '<p>No data available</p>'
  const keys = Object.keys(data[0])
  const headerRow = `<tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr>`
  const dataRows = data.map((item) => {
    const cells = keys.map((key) => {
      const value = item[key]
      if (typeof value === 'object' && value !== null) return `<td>${JSON.stringify(value)}</td>`
      return `<td>${value ?? ''}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table>${headerRow}${dataRows}</table>`
}

function createTableMarkdown(data: any[]): string {
  if (!data || data.length === 0) return '_No data available_'
  const keys = Object.keys(data[0])
  const header = `| ${keys.join(' | ')} |`
  const separator = `| ${keys.map(() => '---').join(' | ')} |`
  const rows = data.map((item) => {
    const cells = keys.map((key) => {
      const value = item[key]
      if (typeof value === 'object' && value !== null) return JSON.stringify(value)
      return String(value ?? '')
    }).join(' | ')
    return `| ${cells} |`
  })
  return [header, separator, ...rows].join('\n')
}

function generateHTMLReport(title: string, sections: Array<{ title: string; content: string; type: 'text' | 'table' | 'list' }>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #3498db; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .timestamp { color: #7f8c8d; font-size: 0.9em; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${sections.map((s) => `<h2>${s.title}</h2>${s.type === 'text' ? `<p>${s.content}</p>` : `<div>${s.content}</div>`}`).join('')}
  <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`.trim()
}

function generateMarkdownReport(title: string, sections: Array<{ title: string; content: string; type: 'text' | 'table' | 'list' }>): string {
  const lines = [`# ${title}`, '', `_Generated on: ${new Date().toLocaleString()}_`, '']
  sections.forEach((s) => { lines.push(`## ${s.title}`, '', s.content, '') })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const aiToolDefinitions = [
  {
    name: 'analyze_product_market',
    description: 'AI-powered market analysis for a product',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        analysisType: {
          type: 'string',
          enum: ['market_size', 'trends', 'applications', 'competitors', 'full'],
          default: 'full',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'discover_applications',
    description: 'AI-powered discovery of potential applications for a product',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        industryFocus: { type: 'string' },
        limit: { type: 'number', default: 5 },
      },
      required: ['productId'],
    },
  },
  {
    name: 'enrich_lead',
    description: 'AI-powered lead enrichment with company and market data',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'number' },
        enrichmentTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['company_info', 'market_position', 'technology_stack', 'growth_potential', 'all'],
          },
          default: ['all'],
        },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'analyze_competition',
    description: 'AI-powered competitive analysis for products or markets',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        competitorNames: {
          type: 'array',
          items: { type: 'string' },
        },
        analysisDepth: {
          type: 'string',
          enum: ['quick', 'standard', 'comprehensive'],
          default: 'standard',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'generate_insights',
    description: 'Generate business insights from data patterns',
    inputSchema: {
      type: 'object',
      properties: {
        insightType: {
          type: 'string',
          enum: ['market_trends', 'customer_patterns', 'product_performance', 'sales_opportunities', 'overall'],
          default: 'overall',
        },
        timeframe: {
          type: 'string',
          enum: ['current', 'quarterly', 'annual'],
          default: 'current',
        },
        focusArea: { type: 'string' },
      },
    },
  },
  {
    name: 'generate_lead_score',
    description: 'AI-powered lead scoring based on multiple factors',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'number' },
        scoringFactors: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['company_fit', 'budget_potential', 'timeline', 'engagement', 'technology_alignment'],
          },
          default: ['company_fit', 'budget_potential', 'technology_alignment'],
        },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'export_data',
    description: 'Export data in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        dataType: {
          type: 'string',
          enum: ['leads', 'products', 'applications', 'full_database'],
        },
        format: {
          type: 'string',
          enum: ['csv', 'json', 'excel'],
          default: 'csv',
        },
        filters: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            dateFrom: { type: 'string' },
            dateTo: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['dataType'],
    },
  },
  {
    name: 'generate_report',
    description: 'Generate formatted reports',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: ['lead_summary', 'product_performance', 'sales_pipeline', 'activity_log', 'custom'],
        },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'markdown'],
          default: 'html',
        },
        dateRange: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
          },
        },
        includeCharts: { type: 'boolean', default: true },
        customQuery: { type: 'string' },
      },
      required: ['reportType'],
    },
  },
  {
    name: 'get_activity_feed',
    description: 'Get recent activity across all leads and users',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 },
        userId: { type: 'number' },
        activityTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['lead_created', 'lead_updated', 'note_added', 'status_changed'],
          },
        },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
    },
  },
]

type ToolResult = { content: Array<{ type: string; text: string }> }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export async function handleAITool(name: string, args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const a = (args ?? {}) as Record<string, any>

  switch (name) {
    case 'analyze_product_market': {
      if (!a.productId) throw new Error('Product ID is required')

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: {
          subcategory: { include: { category: true } },
          product_applications: { include: { applications: true } },
        },
      })
      if (!product) throw new Error(`Product with ID ${a.productId} not found`)

      const analysisType = a.analysisType || 'full'
      const perplexity = getPerplexity()

      const context = `Product: ${product.name}
Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}
Description: ${product.description || 'N/A'}
Applications: ${product.product_applications.map((pa: any) => pa.applications.name).join(', ') || 'None mapped'}`

      let prompt = ''
      switch (analysisType) {
        case 'market_size':
          prompt = `Analyze the market size and growth potential for "${product.name}" in the laser/photonics industry. Include specific market segments and regional opportunities.`
          break
        case 'trends':
          prompt = `Identify current and emerging trends related to "${product.name}" in the laser/photonics industry. Focus on technology advancements and market drivers.`
          break
        case 'applications':
          prompt = `Discover potential applications for "${product.name}" across different industries. Consider both current and emerging use cases.`
          break
        case 'competitors':
          prompt = `Identify key competitors and alternative solutions to "${product.name}" in the market. Compare features and market positioning.`
          break
        case 'full':
        default:
          prompt = `Provide a comprehensive market analysis for "${product.name}" including: 1) Market size and growth potential, 2) Key applications and use cases, 3) Technology trends, 4) Competitive landscape, 5) Future opportunities.`
      }

      const analysis = await perplexity.analyze(prompt, context)
      return ok({ success: true, productId: a.productId, productName: product.name, analysisType, analysis, timestamp: new Date().toISOString() })
    }

    case 'discover_applications': {
      if (!a.productId) throw new Error('Product ID is required')

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: { subcategory: { include: { category: true } } },
      })
      if (!product) throw new Error(`Product with ID ${a.productId} not found`)

      const perplexity = getPerplexity()
      const limit = a.limit || 5

      let prompt = `Discover ${limit} specific industrial or commercial applications for "${product.name}" (${product.description || 'laser/photonics component'}).`
      if (a.industryFocus) prompt += ` Focus specifically on applications in the ${a.industryFocus} industry.`
      prompt += ` For each application, provide: 1) Application name, 2) Industry sector, 3) Use case description, 4) Technical requirements, 5) Market potential. Format as a structured list.`

      const context = `Product Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}`
      const aiResponse = await perplexity.analyze(prompt, context)

      return ok({
        success: true,
        data: {
          productId: a.productId,
          productName: product.name,
          industryFocus: a.industryFocus || 'all industries',
          discoveries: aiResponse,
          recommendedActions: [
            'Review discovered applications for relevance',
            'Create application records for promising opportunities',
            'Map product to relevant applications',
            'Conduct deeper market research for top opportunities',
          ],
          timestamp: new Date().toISOString(),
        },
      })
    }

    case 'enrich_lead': {
      if (!a.leadId) throw new Error('Lead ID is required')

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: { products: true, applications: true, regions: true, countries: true },
      })
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`)

      const perplexity = getPerplexity()
      const enrichmentTypes = Array.isArray(a.enrichmentTypes) ? a.enrichmentTypes : ['all']
      const shouldEnrichAll = enrichmentTypes.includes('all')

      const enrichmentData: any = {
        leadId: a.leadId,
        companyName: lead.name,
        currentData: { industry: lead.industry, website: lead.website, location: lead.location },
        enrichedData: {},
      }

      if (shouldEnrichAll || enrichmentTypes.includes('company_info')) {
        const prompt = `Research company information for "${lead.name}"${lead.website ? ` (${lead.website})` : ''}. Provide: company size, founding year, key products/services, headquarters location, and recent news.`
        enrichmentData.enrichedData.company_info = await perplexity.analyze(prompt)
      }
      if (shouldEnrichAll || enrichmentTypes.includes('market_position')) {
        const prompt = `Analyze the market position of "${lead.name}" in the ${lead.industry || 'laser/photonics'} industry. Include market share, competitive advantages, and industry reputation.`
        enrichmentData.enrichedData.market_position = await perplexity.analyze(prompt)
      }
      if (shouldEnrichAll || enrichmentTypes.includes('technology_stack')) {
        const prompt = `Identify the technology stack and technical capabilities of "${lead.name}". Focus on their use of laser/photonics technologies and related systems.`
        enrichmentData.enrichedData.technology_stack = await perplexity.analyze(prompt)
      }
      if (shouldEnrichAll || enrichmentTypes.includes('growth_potential')) {
        const prompt = `Assess the growth potential of "${lead.name}". Consider funding status, market expansion, product development, and industry trends affecting their business.`
        enrichmentData.enrichedData.growth_potential = await perplexity.analyze(prompt)
      }

      enrichmentData.enrichmentTimestamp = new Date().toISOString()
      enrichmentData.recommendedActions = [
        'Update lead record with enriched data',
        'Review and validate AI-generated insights',
        'Schedule follow-up based on growth potential',
        'Identify cross-sell opportunities',
      ]
      return ok({ success: true, data: enrichmentData })
    }

    case 'analyze_competition': {
      if (!a.productId) throw new Error('Product ID is required')

      const product = await prisma.product.findUnique({
        where: { id: a.productId },
        include: { subcategory: { include: { category: true } } },
      })
      if (!product) throw new Error(`Product with ID ${a.productId} not found`)

      const perplexity = getPerplexity()
      const analysisDepth = a.analysisDepth || 'standard'
      const competitorNames = Array.isArray(a.competitorNames) ? a.competitorNames : []

      let prompt = `Perform a ${analysisDepth} competitive analysis for "${product.name}" in the laser/photonics industry.`
      if (competitorNames.length > 0) prompt += ` Focus on these specific competitors: ${competitorNames.join(', ')}.`

      switch (analysisDepth) {
        case 'quick':
          prompt += ` Provide: 1) Top 3-5 competitors, 2) Key differentiators, 3) Market positioning.`
          break
        case 'comprehensive':
          prompt += ` Provide detailed analysis including: 1) Complete competitor list with company profiles, 2) Feature comparison matrix, 3) Pricing strategies, 4) Market share estimates, 5) SWOT analysis, 6) Technology advantages/disadvantages, 7) Customer base analysis, 8) Future threats and opportunities.`
          break
        default:
          prompt += ` Include: 1) Main competitors (5-7), 2) Product feature comparison, 3) Pricing comparison, 4) Market positioning, 5) Competitive advantages and weaknesses, 6) Strategic recommendations.`
      }

      const context = `Product Category: ${(product.subcategory as any).category.name} > ${(product.subcategory as any).name}
Product Description: ${product.description || 'N/A'}`

      const competitiveAnalysis = await perplexity.analyze(prompt, context)
      return ok({
        success: true,
        productId: a.productId,
        productName: product.name,
        analysisDepth,
        focusedCompetitors: competitorNames,
        analysis: competitiveAnalysis,
        recommendations: [
          'Review competitive positioning',
          'Identify unique value propositions',
          'Develop differentiation strategies',
          'Monitor competitor activities regularly',
        ],
        timestamp: new Date().toISOString(),
      })
    }

    case 'generate_insights': {
      const perplexity = getPerplexity()
      const insightType = a.insightType || 'overall'
      const timeframe = a.timeframe || 'current'

      let context = ''
      let prompt = ''

      switch (insightType) {
        case 'market_trends': {
          const recentProducts = await prisma.product.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { subcategory: { include: { category: true } } },
          })
          context = `Recent products: ${recentProducts.map((p: any) => `${p.name} (${p.subcategory.category.name})`).join(', ')}`
          prompt = `Analyze current market trends in the laser/photonics industry based on product categories and recent additions. Focus on ${timeframe} trends.`
          break
        }
        case 'customer_patterns': {
          const activeLeads = await prisma.lead.count({ where: { status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } } })
          const industries = await prisma.lead.groupBy({
            by: ['industry'],
            _count: true,
            where: { industry: { not: null } },
            orderBy: { _count: { industry: 'desc' } },
            take: 5,
          })
          context = `Active leads: ${activeLeads}, Top industries: ${industries.map((i: any) => i.industry).join(', ')}`
          prompt = `Analyze customer patterns and buying behaviors in the laser/photonics market. Identify key customer segments and their needs for the ${timeframe} period.`
          break
        }
        case 'product_performance': {
          const productsWithApplications = await prisma.product.findMany({
            include: { _count: { select: { product_applications: true, leads: true } } },
            orderBy: { leads: { _count: 'desc' } },
            take: 10,
          })
          context = `Top products by lead interest: ${productsWithApplications.map((p: any) => `${p.name} (${p._count.leads} leads, ${p._count.product_applications} applications)`).join(', ')}`
          prompt = `Analyze product performance patterns and identify high-performing product categories in the laser/photonics market for the ${timeframe} timeframe.`
          break
        }
        case 'sales_opportunities': {
          const qualifiedLeads = await prisma.lead.count({ where: { status: 'QUALIFIED' } })
          const recentApplications = await prisma.application.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
          context = `Qualified leads: ${qualifiedLeads}, Recent applications: ${recentApplications.map((a: any) => a.name).join(', ')}`
          prompt = `Identify sales opportunities and growth potential in the laser/photonics market. Focus on ${timeframe} opportunities and actionable recommendations.`
          break
        }
        default: {
          const [products, leads, applications] = await Promise.all([
            prisma.product.count(),
            prisma.lead.count(),
            prisma.application.count(),
          ])
          context = `Database contains: ${products} products, ${leads} leads, ${applications} applications`
          prompt = `Generate comprehensive business insights for a laser/photonics company. Include market opportunities, customer trends, and strategic recommendations for the ${timeframe} period.`
        }
      }

      if (a.focusArea) prompt += ` Pay special attention to: ${a.focusArea}.`

      const insights = await perplexity.analyze(prompt, context)
      return ok({
        success: true,
        insightType,
        timeframe,
        focusArea: a.focusArea,
        insights,
        dataContext: context,
        nextSteps: [
          'Review and validate insights with team',
          'Develop action plans based on key findings',
          'Set up tracking for identified opportunities',
          'Schedule follow-up analysis',
        ],
        generatedAt: new Date().toISOString(),
      })
    }

    case 'generate_lead_score': {
      if (!a.leadId) throw new Error('Lead ID is required')

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        include: {
          products: true,
          applications: true,
          regions: true,
          notes_relation: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      })
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`)

      const perplexity = getPerplexity()
      const scoringFactors = Array.isArray(a.scoringFactors)
        ? a.scoringFactors
        : ['company_fit', 'budget_potential', 'technology_alignment']

      const context = `Lead: ${lead.name}
Industry: ${lead.industry || 'Unknown'}
Website: ${lead.website || 'N/A'}
Status: ${lead.status}
Products of Interest: ${(lead.products as any).name}
Annual Revenue: ${lead.annual_revenue || 'Unknown'}
Employee Count: ${lead.employee_count || 'Unknown'}`

      const prompt = `Score this lead on a scale of 0-100 based on the following factors: ${scoringFactors.join(', ')}.
For each factor, provide:
1. Score (0-100)
2. Reasoning
3. Key indicators

Also provide an overall weighted score and recommendation for next steps.`

      const aiAnalysis = await perplexity.analyze(prompt, context)
      return ok({
        success: true,
        data: {
          leadId: a.leadId,
          leadName: lead.name,
          scoringFactors,
          analysis: aiAnalysis,
          currentStatus: lead.status,
          recommendations: {
            immediate_actions: [
              'Review AI-generated score and factors',
              'Update lead status based on score',
              'Prioritize high-scoring leads for outreach',
            ],
            score_interpretation: {
              '80-100': 'Hot lead - immediate follow-up recommended',
              '60-79': 'Warm lead - nurture with targeted content',
              '40-59': 'Cool lead - add to long-term nurture campaign',
              '0-39': 'Cold lead - reassess fit or archive',
            },
          },
          scoreTimestamp: new Date().toISOString(),
        },
      })
    }

    case 'export_data': {
      if (!a.dataType) throw new Error('dataType is required')

      const validDataTypes = ['leads', 'products', 'applications', 'full_database']
      if (!validDataTypes.includes(a.dataType)) {
        throw new Error(`Invalid dataType "${a.dataType}". Valid types are: ${validDataTypes.join(', ')}`)
      }

      const format = a.format || 'csv'
      let data: any[] = []
      let filename = ''

      const filters: any = {}
      if (a.filters) {
        const filterObj = a.filters as any
        if (filterObj.status) filters.status = filterObj.status
        if (filterObj.dateFrom || filterObj.dateTo) {
          filters.createdAt = {}
          if (filterObj.dateFrom) filters.createdAt.gte = new Date(filterObj.dateFrom)
          if (filterObj.dateTo) filters.createdAt.lte = new Date(filterObj.dateTo)
        }
        if (filterObj.tags && filterObj.tags.length > 0) {
          filters.tags = { hasEvery: filterObj.tags }
        }
      }

      switch (a.dataType) {
        case 'leads':
          data = await prisma.lead.findMany({
            where: filters,
            include: {
              products: { select: { name: true } },
              applications: { select: { name: true } },
            },
          })
          filename = `leads_export_${new Date().toISOString().split('T')[0]}`
          break
        case 'products':
          data = await prisma.product.findMany({
            include: {
              subcategory: { include: { category: true } },
              _count: { select: { leads: true, product_applications: true } },
            },
          })
          filename = `products_export_${new Date().toISOString().split('T')[0]}`
          break
        case 'applications':
          data = await prisma.application.findMany({
            include: { _count: { select: { leads: true, product_applications: true } } },
          })
          filename = `applications_export_${new Date().toISOString().split('T')[0]}`
          break
        case 'full_database': {
          const [leadsCount, productsCount, applicationsCount] = await Promise.all([
            prisma.lead.count(),
            prisma.product.count(),
            prisma.application.count(),
          ])
          data = [{ export_type: 'summary', total_leads: leadsCount, total_products: productsCount, total_applications: applicationsCount, export_date: new Date().toISOString() }]
          filename = `database_summary_${new Date().toISOString().split('T')[0]}`
          break
        }
      }

      let output = ''
      if (format === 'json') {
        output = JSON.stringify(data, null, 2)
      } else {
        output = convertToCSV(data, a.fields as string[])
      }

      return ok({
        success: true,
        dataType: a.dataType,
        format,
        filename: `${filename}.${format}`,
        recordCount: data.length,
        data: output,
      })
    }

    case 'generate_report': {
      if (!a.reportType) throw new Error('reportType is required')

      const format = a.format || 'html'
      let reportTitle = ''
      const sections: Array<{ title: string; content: string; type: 'text' | 'table' | 'list' }> = []

      switch (a.reportType) {
        case 'lead_summary': {
          reportTitle = 'Lead Summary Report'
          const [totalLeads, statusCounts, recentLeads] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.groupBy({ by: ['status'], _count: true }),
            prisma.lead.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { products: true } }),
          ])
          sections.push({ title: 'Overview', content: `Total Leads: ${totalLeads}`, type: 'text' })
          sections.push({
            title: 'Status Distribution',
            content: format === 'html'
              ? createTableHTML(statusCounts.map((s: any) => ({ Status: s.status, Count: s._count })))
              : createTableMarkdown(statusCounts.map((s: any) => ({ Status: s.status, Count: s._count }))),
            type: 'table',
          })
          sections.push({
            title: 'Recent Leads',
            content: format === 'html'
              ? createTableHTML(recentLeads.map((l: any) => ({ Name: l.name, Status: l.status, Product: l.products.name, Created: new Date(l.createdAt).toLocaleDateString() })))
              : createTableMarkdown(recentLeads.map((l: any) => ({ Name: l.name, Status: l.status, Product: l.products.name, Created: new Date(l.createdAt).toLocaleDateString() }))),
            type: 'table',
          })
          break
        }
        case 'product_performance': {
          reportTitle = 'Product Performance Report'
          const topProducts = await prisma.product.findMany({
            take: 20,
            include: { _count: { select: { leads: true, product_applications: true } }, subcategory: { include: { category: true } } },
            orderBy: { leads: { _count: 'desc' } },
          })
          sections.push({
            title: 'Top Products by Lead Interest',
            content: format === 'html'
              ? createTableHTML(topProducts.map((p: any) => ({ Product: p.name, Category: `${p.subcategory.category.name} > ${p.subcategory.name}`, Leads: p._count.leads, Applications: p._count.product_applications })))
              : createTableMarkdown(topProducts.map((p: any) => ({ Product: p.name, Category: `${p.subcategory.category.name} > ${p.subcategory.name}`, Leads: p._count.leads, Applications: p._count.product_applications }))),
            type: 'table',
          })
          break
        }
        case 'sales_pipeline': {
          reportTitle = 'Sales Pipeline Report'
          const pipelineData = await prisma.lead.groupBy({ by: ['status'], _count: true, _avg: { confidence: true } })
          sections.push({
            title: 'Pipeline Overview',
            content: format === 'html'
              ? createTableHTML(pipelineData.map((p: any) => ({ Stage: p.status, Count: p._count, 'Avg Confidence': p._avg.confidence ? `${p._avg.confidence.toFixed(1)}%` : 'N/A' })))
              : createTableMarkdown(pipelineData.map((p: any) => ({ Stage: p.status, Count: p._count, 'Avg Confidence': p._avg.confidence ? `${p._avg.confidence.toFixed(1)}%` : 'N/A' }))),
            type: 'table',
          })
          break
        }
        default:
          throw new Error(`Unknown report type: ${a.reportType}`)
      }

      const report = format === 'markdown' ? generateMarkdownReport(reportTitle, sections) : generateHTMLReport(reportTitle, sections)
      return ok({ success: true, reportType: a.reportType, format, title: reportTitle, report })
    }

    case 'get_activity_feed': {
      const limit = a.limit || 50
      const activities: any[] = []

      const dateFilter: any = {}
      if (a.dateFrom) dateFilter.gte = new Date(a.dateFrom as string)
      if (a.dateTo) dateFilter.lte = new Date(a.dateTo as string)

      const recentLeads = await prisma.lead.findMany({
        where: { createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: 'desc' },
        include: { products: { select: { name: true } } },
      })

      recentLeads.forEach((lead: any) => {
        activities.push({
          type: 'lead_created',
          timestamp: lead.createdAt,
          description: `New lead created: ${lead.name}`,
          details: { leadId: lead.id, leadName: lead.name, product: lead.products.name, status: lead.status },
        })
      })

      const recentNotes = await prisma.note.findMany({
        where: { createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: 'desc' },
        include: { lead: { select: { name: true } } },
      })

      recentNotes.forEach((note: any) => {
        activities.push({
          type: 'note_added',
          timestamp: note.createdAt,
          description: `Note added to lead: ${note.lead.name}`,
          details: {
            noteId: note.id,
            leadName: note.lead.name,
            notePreview: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
          },
        })
      })

      activities.sort((x: any, y: any) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
      const limitedActivities = activities.slice(0, limit)

      return ok({
        success: true,
        totalActivities: limitedActivities.length,
        dateRange: { from: a.dateFrom || 'unlimited', to: a.dateTo || 'now' },
        activities: limitedActivities,
      })
    }

    default:
      throw new Error(`Unknown AI tool: ${name}`)
  }
}
