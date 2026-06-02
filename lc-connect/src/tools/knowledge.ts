import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "../db/client.js";

/**
 * Knowledge / learning domain: DB-backed resource retrieval, workflow guidance,
 * versioned resource editing, and learning-event capture.
 *
 * Prisma logic (against Resource / ResourceVersion / LearningEvent) is ported
 * verbatim from the old low-level `tools/knowledge.ts`; only the transport shape
 * (zod schema + high-level `server.tool`) and the descriptions have changed.
 *
 * NOTE: `read_workflow_guide` is, as in the original, an alias over the
 * `get_resource` implementation (workflow slug -> resource slug).
 */

const RESOURCE_CATEGORIES = ["knowledge", "region", "sales", "product", "scoring"] as const;
const EVENT_TYPES = ["correction", "new_insight", "confirmation", "flag", "regional_note"] as const;
const IMPACTS = ["low", "medium", "high", "critical"] as const;

function ok(data: Record<string, any>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Shared implementations (ported verbatim from the old handler)
// ---------------------------------------------------------------------------

async function listResources(args: Record<string, any>) {
  const activeOnly = args.active_only !== false;

  const where: Record<string, any> = {};
  if (activeOnly) where.isActive = true;
  if (args.category) where.category = args.category;

  const resources = await prisma.resource.findMany({
    where,
    orderBy: [{ category: "asc" }, { slug: "asc" }],
  });

  const result = resources.map((r: any) => ({
    slug: r.slug,
    title: r.title,
    category: r.category,
    version: r.version,
    isActive: r.isActive,
    updatedAt: r.updatedAt,
    preview: r.content.slice(0, 200) + (r.content.length > 200 ? "..." : ""),
  }));

  return ok({ count: result.length, resources: result });
}

async function getResource(args: Record<string, any>) {
  if (!args.slug) throw new Error("slug is required");

  const resource = await prisma.resource.findUnique({
    where: { slug: args.slug },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 3,
      },
    },
  });

  if (!resource) {
    return ok({ found: false, message: `No resource with slug: ${args.slug}` });
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
      contentPreview: v.content.slice(0, 150) + (v.content.length > 150 ? "..." : ""),
    })),
  });
}

async function findWorkflowGuidance(args: Record<string, any>) {
  if (!args.query) throw new Error("query is required");

  const limit = Math.min(args.limit ?? 5, 20);
  const terms = String(args.query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const resources = await prisma.resource.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { slug: "asc" }],
  });

  const scored = resources
    .map((r: any) => {
      const haystack = `${r.slug} ${r.title} ${r.category} ${r.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { resource: r, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.slug.localeCompare(b.resource.slug))
    .slice(0, limit);

  return ok({
    query: args.query,
    count: scored.length,
    guides: scored.map(({ resource, score }) => ({
      slug: resource.slug,
      title: resource.title,
      category: resource.category,
      score,
      preview: resource.content.slice(0, 300) + (resource.content.length > 300 ? "..." : ""),
      nextTool: "read_workflow_guide",
    })),
  });
}

async function saveLearning(args: Record<string, any>) {
  const { event_type, observation, context, resource_slug, suggested_update, impact } = args;

  if (!event_type) throw new Error("event_type is required");
  if (!observation) throw new Error("observation is required");
  if (!context) throw new Error("context is required");
  if (!impact) throw new Error("impact is required");

  const validEventTypes = ["correction", "new_insight", "confirmation", "flag", "regional_note"];
  if (!validEventTypes.includes(event_type)) {
    throw new Error(`event_type must be one of: ${validEventTypes.join(", ")}`);
  }

  const validImpacts = ["low", "medium", "high", "critical"];
  if (!validImpacts.includes(impact)) {
    throw new Error(`impact must be one of: ${validImpacts.join(", ")}`);
  }

  // Verify resource_slug exists if provided (optional FK)
  if (resource_slug) {
    const exists = await prisma.resource.findUnique({ where: { slug: resource_slug } });
    if (!exists) {
      return ok({
        saved: false,
        message: `resource_slug "${resource_slug}" not found — learning NOT saved. Use list_resources to find valid slugs or omit resource_slug.`,
      });
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
  });

  return ok({
    saved: true,
    event_id: event.id,
    auto_applied: false,
    message: `Learning saved (id: ${event.id}). Pending manual review.`,
  });
}

async function updateResource(args: Record<string, any>) {
  if (!args.slug) throw new Error("slug is required");
  if (!args.content) throw new Error("content is required");
  if (!args.change_reason) throw new Error("change_reason is required");

  const newVersion = await applyResourceUpdate(
    args.slug,
    args.content,
    args.change_reason,
    args.changed_by
  );

  return ok({
    updated: true,
    slug: args.slug,
    newVersion,
    message: `Resource "${args.slug}" updated to version ${newVersion}.`,
  });
}

async function createResource(args: Record<string, any>) {
  if (!args.slug) throw new Error("slug is required");
  if (!args.title) throw new Error("title is required");
  if (!args.content) throw new Error("content is required");
  if (!args.category) throw new Error("category is required");

  const validCategories = ["knowledge", "region", "sales", "product", "scoring"];
  if (!validCategories.includes(args.category)) {
    throw new Error(`category must be one of: ${validCategories.join(", ")}`);
  }

  const existing = await prisma.resource.findUnique({ where: { slug: args.slug } });
  if (existing) {
    return ok({
      created: false,
      message: `A resource with slug "${args.slug}" already exists (version ${existing.version}). Use update_resource to modify it.`,
    });
  }

  const resource = await prisma.resource.create({
    data: {
      slug: args.slug,
      title: args.title,
      content: args.content,
      category: args.category,
    },
  });

  return ok({
    created: true,
    id: resource.id,
    slug: resource.slug,
    version: resource.version,
    message: `Resource "${args.slug}" created successfully.`,
  });
}

async function getPendingLearnings(args: Record<string, any>) {
  const limit = Math.min(args.limit ?? 20, 100);

  const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const events = await prisma.learningEvent.findMany({
    where: { applied: false },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Sort by impact priority then date
  events.sort((a: any, b: any) => {
    const ia = impactOrder[a.impact as keyof typeof impactOrder] ?? 99;
    const ib = impactOrder[b.impact as keyof typeof impactOrder] ?? 99;
    return ia !== ib ? ia - ib : b.createdAt.getTime() - a.createdAt.getTime();
  });

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
  });
}

async function applyResourceUpdate(
  slug: string,
  newContent: string,
  changeReason: string,
  changedBy?: string
): Promise<number> {
  const resource = await prisma.resource.findUnique({ where: { slug } });
  if (!resource) throw new Error(`Resource not found: ${slug}`);

  // Archive current version
  await prisma.resourceVersion.create({
    data: {
      resourceId: resource.id,
      content: resource.content,
      version: resource.version,
      changeReason,
      changedBy: changedBy ?? null,
    },
  });

  const newVersion = resource.version + 1;

  await prisma.resource.update({
    where: { slug },
    data: { content: newContent, version: newVersion },
  });

  return newVersion;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerKnowledgeTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // list_resources — discover knowledge/workflow resource slugs.
  // -------------------------------------------------------------------------
  server.tool(
    "list_resources",
    [
      "List knowledge/workflow resources (compact previews) to discover slugs.",
      "USE WHEN: the user asks what knowledge/workflow resources exist, or you need",
      "to discover a resource slug before reading it.",
      "DO NOT USE WHEN: you already know the slug and need full content -> use",
      "get_resource.",
      "RETURNS: { count, resources[] } where each item is a slug/title/category/",
      "version preview (content truncated to 200 chars).",
      "GOTCHAS: active_only defaults to true; pass false to include archived",
      "resources.",
    ].join("\n"),
    {
      category: z
        .enum(RESOURCE_CATEGORIES)
        .optional()
        .describe("Filter by category: knowledge | region | sales | product | scoring."),
      active_only: z
        .boolean()
        .optional()
        .default(true)
        .describe("Only return active resources. Defaults to true."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return listResources(a);
    }
  );

  // -------------------------------------------------------------------------
  // get_resource — full content of a known resource.
  // -------------------------------------------------------------------------
  server.tool(
    "get_resource",
    [
      "Read the full content of a known knowledge/workflow resource by slug.",
      "USE WHEN: the user asks for the full content of a resource whose slug you know.",
      "DO NOT USE WHEN: you still need to find the right slug -> use list_resources",
      "or find_workflow_guidance.",
      "RETURNS: { slug, title, category, version, content, recentVersions[] } — or",
      "{ found:false, message } if the slug does not exist.",
      "GOTCHAS: slug is required and case-sensitive.",
    ].join("\n"),
    {
      slug: z
        .string()
        .describe("Unique slug of the resource (e.g. supply_chain_positioning)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return getResource(a);
    }
  );

  // -------------------------------------------------------------------------
  // find_workflow_guidance — fuzzy search for the right guide before a task.
  // -------------------------------------------------------------------------
  server.tool(
    "find_workflow_guidance",
    [
      "Find candidate workflow/knowledge guides for a task via keyword scoring.",
      "USE WHEN: the user asks how to perform a workflow, or you need connector",
      "guidance before a multi-step task and don't yet know the slug.",
      "DO NOT USE WHEN: the exact resource slug is already known -> use",
      "read_workflow_guide/get_resource.",
      "RETURNS: { query, count, guides[] } — compact ranked candidates; load only the",
      "selected guide with read_workflow_guide.",
      "GOTCHAS: query is required; limit is capped at 20.",
    ].join("\n"),
    {
      query: z
        .string()
        .describe("Task/workflow to find guidance for (e.g. 'create lead', 'score leads')."),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of guidance resources to return (capped at 20). Defaults to 5."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return findWorkflowGuidance(a);
    }
  );

  // -------------------------------------------------------------------------
  // read_workflow_guide — load a guide by slug (alias over get_resource).
  // -------------------------------------------------------------------------
  server.tool(
    "read_workflow_guide",
    [
      "Load the full content of a workflow/resource guide by slug.",
      "USE WHEN: you (or find_workflow_guidance) identified a workflow/resource slug",
      "to load before executing a task.",
      "DO NOT USE WHEN: you are still discovering candidate guides -> use",
      "find_workflow_guidance.",
      "RETURNS: the same shape as get_resource (full guide content + recentVersions),",
      "or { found:false, message } if the slug does not exist.",
      "GOTCHAS: `workflow` is the resource slug (e.g. research_methodology).",
    ].join("\n"),
    {
      workflow: z
        .string()
        .describe("Workflow/resource slug to read (e.g. research_methodology or lead_scoring_guide)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return getResource({ slug: a.workflow });
    }
  );

  // -------------------------------------------------------------------------
  // save_learning — capture a learning event for later review. WRITE.
  // -------------------------------------------------------------------------
  server.tool(
    "save_learning",
    [
      "Capture a reusable correction / insight / confirmation as a pending learning.",
      "USE WHEN: the user corrects the connector, confirms an unusual approach, or",
      "shares reusable domain knowledge that should be reviewed later. WRITE ACTION —",
      "stores a learning event only.",
      "DO NOT USE WHEN: the user asks to immediately change a knowledge resource ->",
      "use update_resource after explicit confirmation; or for casual conversation.",
      "RETURNS: { saved, event_id, auto_applied:false, message } — or { saved:false }",
      "if resource_slug was given but does not exist.",
      "GOTCHAS: this does NOT auto-apply suggested_update; critical learnings remain",
      "pending review. event_type, observation, context, impact are required.",
    ].join("\n"),
    {
      event_type: z
        .enum(EVENT_TYPES)
        .describe("Type of learning event (required)."),
      observation: z
        .string()
        .describe("What was learned — specific and detailed, useful without further context (required)."),
      context: z
        .string()
        .describe("2-3 sentences from the conversation that led to this learning (required)."),
      resource_slug: z
        .string()
        .optional()
        .describe("Slug of the resource this learning relates to, if known."),
      suggested_update: z
        .string()
        .optional()
        .describe("Proposed text to update or add to the related resource."),
      impact: z
        .enum(IMPACTS)
        .describe("Importance. Critical items sort first for review but are not auto-applied (required)."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return saveLearning(a);
    }
  );

  // -------------------------------------------------------------------------
  // update_resource — replace a resource body (versioned). WRITE.
  // -------------------------------------------------------------------------
  server.tool(
    "update_resource",
    [
      "Replace a knowledge resource body, archiving the prior version.",
      "USE WHEN: the user explicitly asks to update/replace a knowledge resource.",
      "WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user only provides a learning/correction for later review",
      "-> use save_learning.",
      "RETURNS: { updated, slug, newVersion, message }.",
      "GOTCHAS: content REPLACES the full resource body — fetch get_resource first if",
      "editing existing content. slug, content, and change_reason are required. Fails",
      "if the slug does not exist.",
    ].join("\n"),
    {
      slug: z.string().describe("Slug of the resource to update (required)."),
      content: z.string().describe("New full content for the resource (replaces the body) (required)."),
      change_reason: z.string().describe("Why this update was made (required)."),
      changed_by: z.string().optional().describe("Who made the change (optional)."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return updateResource(a);
    }
  );

  // -------------------------------------------------------------------------
  // create_resource — create a new knowledge/workflow resource. WRITE.
  // -------------------------------------------------------------------------
  server.tool(
    "create_resource",
    [
      "Create a new knowledge/workflow resource.",
      "USE WHEN: the user explicitly asks to create a new knowledge/workflow resource.",
      "WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user is only sharing a correction or note -> use",
      "save_learning.",
      "RETURNS: { created, id, slug, version, message } — or { created:false } if a",
      "resource with that slug already exists (use update_resource instead).",
      "GOTCHAS: slug must be unique, lowercase, and stable; category must be one of",
      "knowledge|region|sales|product|scoring.",
    ].join("\n"),
    {
      slug: z
        .string()
        .describe("Unique identifier (lowercase, underscores), e.g. german_market_notes."),
      title: z.string().describe("Human-readable title."),
      content: z.string().describe("Full content of the resource."),
      category: z
        .enum(RESOURCE_CATEGORIES)
        .describe("Resource category: knowledge | region | sales | product | scoring."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return createResource(a);
    }
  );

  // -------------------------------------------------------------------------
  // get_pending_learnings — review unapplied learnings.
  // -------------------------------------------------------------------------
  server.tool(
    "get_pending_learnings",
    [
      "List captured learnings that have not yet been applied, ordered by impact.",
      "USE WHEN: the user asks to review pending captured learnings or decide what",
      "should be applied to resources.",
      "DO NOT USE WHEN: the user asks to apply a learning -> read the target resource",
      "with get_resource, then use update_resource.",
      "RETURNS: { count, events[] } sorted critical-first then newest.",
      "GOTCHAS: limit is capped at 100 (defaults to 20).",
    ].join("\n"),
    {
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of events to return (capped at 100). Defaults to 20."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();
      return getPendingLearnings(a);
    }
  );
}

// ---------------------------------------------------------------------------
// DB-backed dynamic resources (lc://resources/<slug>)
// ---------------------------------------------------------------------------

/**
 * Registers LC's DB-backed knowledge resources on the high-level McpServer so
 * hosts can list/read `lc://resources/<slug>` from the `Resource` table.
 *
 * This follows Vendo's `registerWorkflowResources` pattern but uses a
 * ResourceTemplate (the resource set is dynamic — driven by the DB), preserving
 * the old ListResources / ReadResource handler behavior:
 *   - list: active resources only, ordered by category, exposed as
 *     `lc://resources/<slug>` with a `[category] vN — <preview>...` description.
 *   - read: full content rendered with a title/category/version/updated header.
 */
export function registerKnowledgeResources(server: McpServer): void {
  const template = new ResourceTemplate("lc://resources/{slug}", {
    list: async () => {
      const resources = await prisma.resource.findMany({
        where: { isActive: true },
        orderBy: { category: "asc" },
      });
      return {
        resources: resources.map((r: any) => ({
          uri: `lc://resources/${r.slug}`,
          name: r.title,
          description: `[${r.category}] v${r.version} — ${r.content.slice(0, 120)}...`,
          mimeType: "text/plain",
        })),
      };
    },
  });

  server.resource(
    "lc-resources",
    template,
    { description: "Laser Components knowledge base resources (DB-backed)", mimeType: "text/plain" },
    async (uri: URL) => {
      const slug = uri.href.replace("lc://resources/", "");
      const resource = await prisma.resource.findUnique({ where: { slug } });

      if (!resource) throw new Error(`Resource not found: ${slug}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text:
              `# ${resource.title}\n` +
              `_Category: ${(resource as any).category} | Version: ${(resource as any).version} | Updated: ${(resource as any).updatedAt.toISOString().slice(0, 10)}_\n\n` +
              `${(resource as any).content}`,
          },
        ],
      };
    }
  );
}
