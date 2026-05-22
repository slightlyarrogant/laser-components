import { prisma } from '../db/client.js'

export const leadToolDefinitions = [
  {
    name: 'get_leads',
    description: 'Get leads from the database',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        status: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST'],
        },
        productId: { type: 'number' },
        applicationId: { type: 'number' },
      },
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        productId: { type: 'number' },
        status: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST'],
          default: 'NEW',
        },
        industry: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        website: { type: 'string' },
        applicationId: { type: 'number' },
      },
      required: ['name', 'productId'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update an existing lead',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        status: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST'],
        },
        industry: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        website: { type: 'string' },
        applicationId: { type: 'number' },
        annualRevenue: { type: 'number' },
        employeeCount: { type: 'number' },
        confidence: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_lead',
    description: 'Delete a lead by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_leads',
    description: 'Search leads by name or tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'get_lead_notes',
    description: 'Retrieve notes and activity history for a lead',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'number' },
        limit: { type: 'number', default: 20 },
        noteType: { type: 'string' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'create_lead_note',
    description: 'Add a note to a lead for activity tracking',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'number' },
        content: { type: 'string' },
        noteType: {
          type: 'string',
          enum: ['general', 'call', 'meeting', 'email', 'task', 'follow_up'],
          default: 'general',
        },
        userId: { type: 'number' },
      },
      required: ['leadId', 'content'],
    },
  },
  {
    name: 'batch_create_leads',
    description: 'Create multiple leads from bulk data',
    inputSchema: {
      type: 'object',
      properties: {
        leads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              productId: { type: 'number' },
              status: { type: 'string' },
              industry: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              website: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['name', 'productId'],
          },
        },
        skipDuplicates: { type: 'boolean', default: true },
      },
      required: ['leads'],
    },
  },
  {
    name: 'batch_update_leads',
    description: 'Update multiple leads in bulk',
    inputSchema: {
      type: 'object',
      properties: {
        leadIds: {
          type: 'array',
          items: { type: 'number' },
        },
        updates: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST'],
            },
            tags: { type: 'array', items: { type: 'string' } },
            assignedTo: { type: 'string' },
            industry: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
        operation: {
          type: 'string',
          enum: ['replace', 'append'],
          default: 'replace',
        },
      },
      required: ['leadIds', 'updates'],
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
]

type ToolResult = { content: Array<{ type: string; text: string }> }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export async function handleLeadTool(name: string, args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const a = (args ?? {}) as Record<string, any>

  switch (name) {
    case 'get_leads': {
      const limit = a.limit || 10
      const whereConditions: any = {}

      if (a.status) {
        const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST']
        if (!validStatuses.includes(a.status)) {
          throw new Error(`Invalid status "${a.status}". Valid statuses are: ${validStatuses.join(', ')}`)
        }
        whereConditions.status = a.status
      }
      if (a.productId) whereConditions.productId = a.productId
      if (a.applicationId) whereConditions.applicationId = a.applicationId

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          products: { select: { id: true, name: true } },
          applications: { select: { id: true, name: true } },
          regions: { select: { id: true, name: true } },
          countries: { select: { id: true, name: true } },
        },
      })
      return ok({ success: true, data: leads, count: leads.length })
    }

    case 'create_lead': {
      if (!a.name || !a.productId) throw new Error('name and productId are required')

      const leadData: any = {
        name: a.name,
        productId: a.productId,
        status: a.status || 'NEW',
      }
      if (a.email) leadData.email = a.email
      if (a.phone) leadData.phone = a.phone
      if (a.industry) leadData.industry = a.industry
      if (a.tags) leadData.tags = a.tags
      if (a.description) leadData.description = a.description
      if (a.website) leadData.website = a.website
      if (a.applicationId) leadData.applicationId = a.applicationId

      const lead = await prisma.lead.create({
        data: leadData,
        include: { products: true, applications: true },
      })
      return ok({ success: true, data: lead, message: 'Lead created successfully' })
    }

    case 'update_lead': {
      if (!a.id) throw new Error('Lead ID is required')

      const updateData: any = {}
      if (a.name !== undefined) updateData.name = a.name
      if (a.email !== undefined) updateData.email = a.email
      if (a.phone !== undefined) updateData.phone = a.phone
      if (a.status !== undefined) updateData.status = a.status
      if (a.industry !== undefined) updateData.industry = a.industry
      if (a.tags !== undefined) updateData.tags = a.tags
      if (a.description !== undefined) updateData.description = a.description
      if (a.website !== undefined) updateData.website = a.website
      if (a.applicationId !== undefined) updateData.applicationId = a.applicationId
      if (a.annualRevenue !== undefined) updateData.annual_revenue = a.annualRevenue
      if (a.employeeCount !== undefined) updateData.employee_count = a.employeeCount
      if (a.confidence !== undefined) updateData.confidence = a.confidence

      try {
        const updatedLead = await prisma.lead.update({
          where: { id: a.id },
          data: updateData,
          include: { products: true, applications: true, regions: true, countries: true },
        })
        return ok({ success: true, data: updatedLead, message: 'Lead updated successfully' })
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error(`Lead with ID ${a.id} not found`)
        throw error
      }
    }

    case 'delete_lead': {
      if (!a.id) throw new Error('Lead ID is required')
      try {
        await prisma.lead.delete({ where: { id: a.id } })
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error(`Lead with ID ${a.id} not found`)
        throw error
      }
      return ok({ success: true, message: `Lead ${a.id} deleted successfully` })
    }

    case 'search_leads': {
      const whereConditions: any = { OR: [] }

      if (a.query) {
        whereConditions.OR.push(
          { name: { contains: a.query, mode: 'insensitive' } },
          { description: { contains: a.query, mode: 'insensitive' } },
          { email: { contains: a.query, mode: 'insensitive' } }
        )
      }
      if (a.tags && Array.isArray(a.tags) && a.tags.length > 0) {
        whereConditions.OR.push({ tags: { hasEvery: a.tags } })
      }
      if (whereConditions.OR.length === 0) {
        delete whereConditions.OR
      }

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          products: { select: { id: true, name: true } },
          applications: { select: { id: true, name: true } },
        },
      })
      return ok({ success: true, data: leads, count: leads.length, searchCriteria: { query: a.query, tags: a.tags } })
    }

    case 'get_lead_notes': {
      if (!a.leadId) throw new Error('leadId is required')

      const where: any = { leadId: a.leadId }
      const limit = a.limit || 20

      if (a.noteType) {
        where.content = { contains: `[${(a.noteType as string).toUpperCase()}]` }
      }
      if (a.dateFrom || a.dateTo) {
        where.createdAt = {}
        if (a.dateFrom) where.createdAt.gte = new Date(a.dateFrom as string)
        if (a.dateTo) where.createdAt.lte = new Date(a.dateTo as string)
      }

      const notes = await prisma.note.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { lead: { select: { name: true, status: true } } },
      })

      const formattedNotes = notes.map((note: any) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        userId: note.user_id,
      }))

      return ok({
        success: true,
        leadId: a.leadId,
        leadName: notes[0]?.lead.name || 'Unknown',
        totalNotes: formattedNotes.length,
        notes: formattedNotes,
      })
    }

    case 'create_lead_note': {
      if (!a.leadId || !a.content) throw new Error('leadId and content are required')

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        select: { id: true, name: true },
      })
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`)

      const noteType = (a.noteType as string) || 'general'
      const noteData: any = {
        leadId: a.leadId,
        content: `[${noteType.toUpperCase()}] ${a.content}`,
      }
      if (a.userId) noteData.user_id = a.userId

      const note = await prisma.note.create({
        data: noteData,
        include: { lead: { select: { name: true } } },
      })

      return ok({
        success: true,
        note: { id: note.id, leadName: note.lead.name, content: note.content, createdAt: note.createdAt },
        message: `Note added to lead "${lead.name}"`,
      })
    }

    case 'batch_create_leads': {
      if (!a.leads || !Array.isArray(a.leads) || a.leads.length === 0) {
        throw new Error('leads array is required and must not be empty')
      }
      if (a.leads.length > 200) {
        throw new Error(`Batch size too large: ${a.leads.length}. Maximum allowed: 200. Please split into smaller batches.`)
      }

      const skipDuplicates = a.skipDuplicates !== false
      const createdLeads: any[] = []
      const skippedLeads: any[] = []
      const errors: any[] = []

      for (const leadData of a.leads) {
        try {
          if (skipDuplicates) {
            const existing = await prisma.lead.findFirst({
              where: { OR: [{ name: leadData.name }, ...(leadData.email ? [{ email: leadData.email }] : [])] },
            })
            if (existing) {
              skippedLeads.push({ name: leadData.name, reason: `Duplicate found (ID: ${existing.id})` })
              continue
            }
          }

          const lead = await prisma.lead.create({
            data: {
              name: leadData.name,
              email: leadData.email,
              phone: leadData.phone,
              productId: leadData.productId,
              status: leadData.status || 'NEW',
              industry: leadData.industry,
              tags: leadData.tags || [],
              website: leadData.website,
              description: leadData.description,
            },
          })
          createdLeads.push(lead)
        } catch (error) {
          errors.push({ name: leadData.name, error: error instanceof Error ? error.message : String(error) })
        }
      }

      return ok({
        success: true,
        summary: { total: a.leads.length, created: createdLeads.length, skipped: skippedLeads.length, errors: errors.length },
        createdLeads: createdLeads.map((l) => ({ id: l.id, name: l.name })),
        skippedLeads,
        errors,
      })
    }

    case 'batch_update_leads': {
      if (!a.leadIds || !Array.isArray(a.leadIds) || a.leadIds.length === 0) {
        throw new Error('leadIds array is required and must not be empty')
      }
      if (a.leadIds.length > 500) {
        throw new Error(`Batch size too large: ${a.leadIds.length}. Maximum allowed: 500. Please split into smaller batches.`)
      }
      if (!a.updates || typeof a.updates !== 'object') throw new Error('updates object is required')

      const operation = a.operation || 'replace'
      const updateData: any = {}
      const updates = a.updates as any

      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.industry !== undefined) updateData.industry = updates.industry
      if (updates.confidence !== undefined) updateData.confidence = updates.confidence

      if (updates.tags !== undefined) {
        if (operation === 'append') {
          const existingLeads = await prisma.lead.findMany({
            where: { id: { in: a.leadIds } },
            select: { id: true, tags: true },
          })
          const updatePromises = await Promise.all(
            existingLeads.map((lead: any) =>
              prisma.lead.update({
                where: { id: lead.id },
                data: { ...updateData, tags: [...new Set([...lead.tags, ...updates.tags])] },
              })
            )
          )
          return ok({
            success: true,
            operation: 'append',
            updatedCount: updatePromises.length,
            updatedIds: updatePromises.map((l: any) => l.id),
            message: `Successfully updated ${updatePromises.length} leads (tags appended)`,
          })
        } else {
          updateData.tags = updates.tags
        }
      }

      const result = await prisma.lead.updateMany({
        where: { id: { in: a.leadIds } },
        data: updateData,
      })
      return ok({
        success: true,
        operation: 'replace',
        updatedCount: result.count,
        requestedIds: a.leadIds,
        updates: updateData,
        message: `Successfully updated ${result.count} leads`,
      })
    }

    case 'generate_lead_score': {
      // This tool delegates to AI — handled in ai.ts via re-export
      // This case should not be reached — generate_lead_score is in leadToolDefinitions
      // but its actual implementation is in ai tools. We keep it here for completeness.
      throw new Error('generate_lead_score must be handled by the AI tool handler')
    }

    default:
      throw new Error(`Unknown lead tool: ${name}`)
  }
}
