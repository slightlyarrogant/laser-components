// Knowledge system tools: resources, versioning, and learning capture for LC Connect
import { prisma } from '../db/client.js'

export const knowledgeToolDefinitions = [
  {
    name: 'list_resources',
    description:
      'List all knowledge resources stored in LC Connect. Resources contain domain knowledge, sales guidelines, scoring rules, and session instructions that shape AI behaviour.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category: knowledge | region | sales | product | scoring',
        },
        active_only: {
          type: 'boolean',
          default: true,
          description: 'Only return active resources (default: true)',
        },
      },
    },
  },
  {
    name: 'get_resource',
    description: 'Get the full content of a specific knowledge resource plus its last 3 versions.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Unique slug identifier of the resource (e.g. supply_chain_positioning)',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'save_learning',
    description:
      'Capture a learning from the current conversation — a correction, new insight, confirmation, flag, or regional note. ' +
      'Call this proactively whenever a user corrects you, confirms an unusual approach, or reveals something new about a company/region/market. ' +
      'If impact is "critical" AND suggested_update + resource_slug are provided, the resource is updated automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: {
          type: 'string',
          enum: ['correction', 'new_insight', 'confirmation', 'flag', 'regional_note'],
          description: 'Type of learning event',
        },
        observation: {
          type: 'string',
          description: 'What was learned — specific and detailed, written to be useful without context',
        },
        context: {
          type: 'string',
          description: '2-3 sentences from the conversation that led to this learning',
        },
        resource_slug: {
          type: 'string',
          description: 'Slug of the resource this learning relates to (if known)',
        },
        suggested_update: {
          type: 'string',
          description: 'Proposed text to update or add to the related resource',
        },
        impact: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'How important is this learning — critical triggers auto-apply if resource_slug + suggested_update provided',
        },
      },
      required: ['event_type', 'observation', 'context', 'impact'],
    },
  },
  {
    name: 'update_resource',
    description:
      'Update the content of an existing resource. Saves the old version to history and bumps the version number.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug of the resource to update' },
        content: { type: 'string', description: 'New content for the resource' },
        change_reason: { type: 'string', description: 'Why this update was made' },
        changed_by: { type: 'string', description: 'Who made the change (optional)' },
      },
      required: ['slug', 'content', 'change_reason'],
    },
  },
  {
    name: 'create_resource',
    description: 'Create a new knowledge resource. Slug must be unique.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Unique identifier (lowercase, underscores): e.g. german_market_notes',
        },
        title: { type: 'string', description: 'Human-readable title' },
        content: { type: 'string', description: 'Full content of the resource' },
        category: {
          type: 'string',
          enum: ['knowledge', 'region', 'sales', 'product', 'scoring'],
          description: 'Resource category',
        },
      },
      required: ['slug', 'title', 'content', 'category'],
    },
  },
  {
    name: 'get_pending_learnings',
    description:
      'Get unapplied learning events ordered by impact (critical first). Use to review what the system has learned and decide what to apply to resources.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of events to return (default: 20)',
        },
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleKnowledgeTool(
  name: string,
  args: Record<string, any> | undefined
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const a = args ?? {}

  switch (name) {
    case 'list_resources':
      return listResources(a)
    case 'get_resource':
      return getResource(a)
    case 'save_learning':
      return saveLearning(a)
    case 'update_resource':
      return updateResource(a)
    case 'create_resource':
      return createResource(a)
    case 'get_pending_learnings':
      return getPendingLearnings(a)
    default:
      throw new Error(`Unknown knowledge tool: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listResources(args: Record<string, any>) {
  const activeOnly = args.active_only !== false

  const where: Record<string, any> = {}
  if (activeOnly) where.isActive = true
  if (args.category) where.category = args.category

  const resources = await prisma.resource.findMany({
    where,
    orderBy: [{ category: 'asc' }, { slug: 'asc' }],
  })

  const result = resources.map((r: any) => ({
    slug: r.slug,
    title: r.title,
    category: r.category,
    version: r.version,
    isActive: r.isActive,
    updatedAt: r.updatedAt,
    preview: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
  }))

  return ok({ count: result.length, resources: result })
}

async function getResource(args: Record<string, any>) {
  if (!args.slug) throw new Error('slug is required')

  const resource = await prisma.resource.findUnique({
    where: { slug: args.slug },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 3,
      },
    },
  })

  if (!resource) {
    return ok({ found: false, message: `No resource with slug: ${args.slug}` })
  }

  return ok({
    slug: resource.slug,
    title: resource.title,
    category: resource.category,
    version: resource.version,
    isActive: resource.isActive,
    content: resource.content,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    recentVersions: (resource as any).versions.map((v: any) => ({
      version: v.version,
      changeReason: v.changeReason,
      changedBy: v.changedBy,
      createdAt: v.createdAt,
      contentPreview: v.content.slice(0, 150) + (v.content.length > 150 ? '...' : ''),
    })),
  })
}

async function saveLearning(args: Record<string, any>) {
  const { event_type, observation, context, resource_slug, suggested_update, impact } = args

  if (!event_type) throw new Error('event_type is required')
  if (!observation) throw new Error('observation is required')
  if (!context) throw new Error('context is required')
  if (!impact) throw new Error('impact is required')

  const validEventTypes = ['correction', 'new_insight', 'confirmation', 'flag', 'regional_note']
  if (!validEventTypes.includes(event_type)) {
    throw new Error(`event_type must be one of: ${validEventTypes.join(', ')}`)
  }

  const validImpacts = ['low', 'medium', 'high', 'critical']
  if (!validImpacts.includes(impact)) {
    throw new Error(`impact must be one of: ${validImpacts.join(', ')}`)
  }

  // Verify resource_slug exists if provided (optional FK)
  if (resource_slug) {
    const exists = await prisma.resource.findUnique({ where: { slug: resource_slug } })
    if (!exists) {
      return ok({
        saved: false,
        message: `resource_slug "${resource_slug}" not found — learning NOT saved. Use list_resources to find valid slugs or omit resource_slug.`,
      })
    }
  }

  const event = await prisma.learningEvent.create({
    data: {
      eventType: event_type,
      resourceSlug: resource_slug ?? null,
      observation,
      context,
      suggestedUpdate: suggested_update ?? null,
      impact,
      applied: false,
    },
  })

  // Auto-apply for critical learnings with full info
  let autoApplied = false
  if (impact === 'critical' && resource_slug && suggested_update) {
    try {
      await applyResourceUpdate(resource_slug, suggested_update, `Auto-applied from critical learning #${event.id}`, 'system')
      await prisma.learningEvent.update({ where: { id: event.id }, data: { applied: true } })
      autoApplied = true
    } catch (err) {
      console.error('Auto-apply failed:', err)
    }
  }

  return ok({
    saved: true,
    event_id: event.id,
    auto_applied: autoApplied,
    message: autoApplied
      ? `Learning saved and automatically applied to resource "${resource_slug}" (critical impact).`
      : `Learning saved (id: ${event.id}). Pending manual review.`,
  })
}

async function updateResource(args: Record<string, any>) {
  if (!args.slug) throw new Error('slug is required')
  if (!args.content) throw new Error('content is required')
  if (!args.change_reason) throw new Error('change_reason is required')

  const newVersion = await applyResourceUpdate(
    args.slug,
    args.content,
    args.change_reason,
    args.changed_by
  )

  return ok({
    updated: true,
    slug: args.slug,
    newVersion,
    message: `Resource "${args.slug}" updated to version ${newVersion}.`,
  })
}

async function createResource(args: Record<string, any>) {
  if (!args.slug) throw new Error('slug is required')
  if (!args.title) throw new Error('title is required')
  if (!args.content) throw new Error('content is required')
  if (!args.category) throw new Error('category is required')

  const validCategories = ['knowledge', 'region', 'sales', 'product', 'scoring']
  if (!validCategories.includes(args.category)) {
    throw new Error(`category must be one of: ${validCategories.join(', ')}`)
  }

  const existing = await prisma.resource.findUnique({ where: { slug: args.slug } })
  if (existing) {
    return ok({
      created: false,
      message: `A resource with slug "${args.slug}" already exists (version ${existing.version}). Use update_resource to modify it.`,
    })
  }

  const resource = await prisma.resource.create({
    data: {
      slug: args.slug,
      title: args.title,
      content: args.content,
      category: args.category,
    },
  })

  return ok({
    created: true,
    id: resource.id,
    slug: resource.slug,
    version: resource.version,
    message: `Resource "${args.slug}" created successfully.`,
  })
}

async function getPendingLearnings(args: Record<string, any>) {
  const limit = Math.min(args.limit ?? 20, 100)

  const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 }

  const events = await prisma.learningEvent.findMany({
    where: { applied: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Sort by impact priority then date
  events.sort((a: any, b: any) => {
    const ia = impactOrder[a.impact as keyof typeof impactOrder] ?? 99
    const ib = impactOrder[b.impact as keyof typeof impactOrder] ?? 99
    return ia !== ib ? ia - ib : b.createdAt.getTime() - a.createdAt.getTime()
  })

  return ok({
    count: events.length,
    events: events.map((e: any) => ({
      id: e.id,
      event_type: e.eventType,
      impact: e.impact,
      observation: e.observation,
      context: e.context,
      resource_slug: e.resourceSlug,
      suggested_update: e.suggestedUpdate,
      createdAt: e.createdAt,
    })),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function applyResourceUpdate(
  slug: string,
  newContent: string,
  changeReason: string,
  changedBy?: string
): Promise<number> {
  const resource = await prisma.resource.findUnique({ where: { slug } })
  if (!resource) throw new Error(`Resource not found: ${slug}`)

  // Archive current version
  await prisma.resourceVersion.create({
    data: {
      resourceId: resource.id,
      content: resource.content,
      version: resource.version,
      changeReason,
      changedBy: changedBy ?? null,
    },
  })

  const newVersion = resource.version + 1

  await prisma.resource.update({
    where: { slug },
    data: { content: newContent, version: newVersion },
  })

  return newVersion
}

function ok(data: Record<string, any>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}
