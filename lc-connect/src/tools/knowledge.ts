// Knowledge system tools: resources, versioning, and learning capture for LC Connect
import { prisma } from '../db/client.js'

export const knowledgeToolDefinitions = [
  {
    name: 'list_resources',
    description:
      'USE WHEN: user asks what knowledge/workflow resources exist or needs to discover a resource slug. READ-ONLY. DO NOT USE WHEN: user already knows the slug and needs full content -> use get_resource. RETURNS: compact previews only.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description:
      'USE WHEN: user asks for the full content of a known knowledge/workflow resource. READ-ONLY. DO NOT USE WHEN: user needs to find the right slug first -> use list_resources. RETURNS: resource content and recent version previews.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    name: 'find_workflow_guidance',
    description:
      'USE WHEN: user asks how to perform a workflow or the model needs connector guidance before a multi-step task. READ-ONLY. DO NOT USE WHEN: the exact resource slug is already known -> use read_workflow_guide/get_resource. RETURNS: compact matching workflow/resource candidates; load only the selected guide.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Task or workflow to find guidance for, e.g. create lead, research applications, score leads',
        },
        limit: {
          type: 'number',
          default: 5,
          description: 'Maximum number of guidance resources to return',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_workflow_guide',
    description:
      'USE WHEN: user or find_workflow_guidance identified a workflow/resource slug to load before executing a task. READ-ONLY. DO NOT USE WHEN: discovering candidate guides -> use find_workflow_guidance. RETURNS: full guide content.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'string',
          description: 'Workflow/resource slug to read, e.g. research_methodology or lead_scoring_guide',
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'save_learning',
    description:
      'USE WHEN: user corrects the connector, confirms an unusual approach, or provides reusable domain knowledge that should be reviewed later. WRITE ACTION; stores a learning event only. DO NOT USE WHEN: user asks to immediately change a knowledge resource -> use update_resource after explicit confirmation. GOTCHAS: this does not auto-apply suggested_update; critical learnings remain pending review.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
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
          description: 'How important is this learning. Critical items are sorted first for review but are not auto-applied.',
        },
      },
      required: ['event_type', 'observation', 'context', 'impact'],
    },
  },
  {
    name: 'update_resource',
    description:
      'USE WHEN: user explicitly asks to replace/update a knowledge resource. WRITE ACTION; should require confirmation. DO NOT USE WHEN: user only provides a learning/correction for later review -> use save_learning. GOTCHAS: content replaces the full resource body; fetch get_resource first if editing existing content.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
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
    description:
      'USE WHEN: user explicitly asks to create a new knowledge/workflow resource. WRITE ACTION; should require confirmation. DO NOT USE WHEN: user is only sharing a correction or note -> use save_learning. GOTCHAS: slug must be unique, lowercase, and stable.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
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
      'USE WHEN: user asks to review pending captured learnings or decide what should be applied to resources. READ-ONLY. DO NOT USE WHEN: user asks to apply a learning -> use update_resource after reading the target resource. RETURNS: unapplied events ordered by impact.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    case 'find_workflow_guidance':
      return findWorkflowGuidance(a)
    case 'read_workflow_guide':
      return getResource({ slug: a.workflow })
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

async function findWorkflowGuidance(args: Record<string, any>) {
  if (!args.query) throw new Error('query is required')

  const limit = Math.min(args.limit ?? 5, 20)
  const terms = String(args.query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  const resources = await prisma.resource.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { slug: 'asc' }],
  })

  const scored = resources
    .map((r: any) => {
      const haystack = `${r.slug} ${r.title} ${r.category} ${r.content}`.toLowerCase()
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
      return { resource: r, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.slug.localeCompare(b.resource.slug))
    .slice(0, limit)

  return ok({
    query: args.query,
    count: scored.length,
    guides: scored.map(({ resource, score }) => ({
      slug: resource.slug,
      title: resource.title,
      category: resource.category,
      score,
      preview: resource.content.slice(0, 300) + (resource.content.length > 300 ? '...' : ''),
      nextTool: 'read_workflow_guide',
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

  return ok({
    saved: true,
    event_id: event.id,
    auto_applied: false,
    message: `Learning saved (id: ${event.id}). Pending manual review.`,
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
