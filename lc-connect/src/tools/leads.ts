import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  ACTION_WIDGET_URI,
  buildActionEnvelope,
  MESSAGES_WIDGET_URI,
  buildMessagesEnvelope,
  type MessagesMeta,
  type NormalizedMessage,
} from "@cfi/mcp-widgets";
import { DATASET_WIDGET_URI, okList } from "../datasets.js";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import { getCurrentUser } from "../core/current-user.js";
import {
  canEditLead,
  editRefusalMessage,
  requireRole,
  type LeadAccessFields,
} from "../core/access.js";
import { PRESENT_BRIEFLY } from "./_present.js";

// Row count above which get_leads emits a DATASET widget instead of inline JSON.
const DATASET_THRESHOLD = 10;

/**
 * Sales lead domain: list/search, single + batch CRUD, and notes.
 *
 * Prisma logic ported verbatim from the old low-level server; transport shape
 * and descriptions upgraded to the high-level `server.tool` style.
 *
 * NOTE: generate_lead_score is intentionally NOT registered here — it is an AI
 * tool ported in a later chunk.
 */

const LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "LOST", "WON"] as const;

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Owner projection surfaced on every lead read. */
const OWNER_SELECT = { select: { id: true, email: true, displayName: true } };

/** Lead columns canEditLead() needs, plus the name for error messages. */
const ACCESS_SELECT = {
  id: true,
  name: true,
  ownerUserId: true,
  createdByUserId: true,
  regionId: true,
  country: { select: { regionId: true } },
};

/**
 * Region stamping for writes: an explicit regionId wins; otherwise the lead's
 * country supplies it. Lead geography is what region competency is checked
 * against, so filling it on create is what makes competencies bite at all.
 */
async function resolveRegionId(
  countryId?: number | null,
  regionId?: number | null
): Promise<number | undefined> {
  if (regionId != null) return regionId;
  if (countryId == null) return undefined;
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { regionId: true },
  });
  if (!country) throw new Error(`Country with ID ${countryId} not found`);
  return country.regionId;
}

/** Resolves an explicit owner argument, rejecting unknown/inactive users. */
async function resolveOwnerUserId(
  ownerUserId: number | null | undefined,
  fallbackId: number
): Promise<number | null> {
  if (ownerUserId === undefined) return fallbackId;
  if (ownerUserId === null) return null;
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true, isActive: true },
  });
  if (!owner) throw new Error(`User with ID ${ownerUserId} not found`);
  if (!owner.isActive) {
    throw new Error(`User with ID ${ownerUserId} is deactivated and cannot own leads`);
  }
  return owner.id;
}

/** Flat owner label for widget rows. */
function ownerLabel(l: any): string | null {
  return l.ownerUser?.displayName ?? l.ownerUser?.email ?? null;
}

export function registerLeadsTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // get_leads — filtered list.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_leads",
    {
      title: "Leads",
      description: [
        "get_leads — list/filter sales leads (product / application / region /",
        "country / owner context).",
        "Returns raw lead records as data (no widget). For any user-facing 'show/list/",
        "find leads' request, use search_leads instead, which renders the interactive",
        "list widget.",
        "USE WHEN: the user asks to list, review, filter, or inspect leads by status,",
        "product, or application.",
        "DO NOT USE WHEN: the user has a company/person/tag phrase -> use search_leads;",
        "the user wants to create/update/delete a lead -> use the matching write tool.",
        "RETURNS: a small result inline as { success, data[], count }; a LARGE result",
        "(> threshold) as an interactive DATASET widget (sortable/searchable table +",
        "CSV export) — present that widget, do not re-list rows.",
        "GOTCHAS: resolve productId/applicationId with search_products/get_applications",
        "first; status must be one of NEW/CONTACTED/QUALIFIED/LOST/WON. Summarize large",
        "result sets analytically. Visibility is OPEN — everyone sees every lead; use",
        "mine=true or ownerUserId to narrow to a person's book.",
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .default(10)
          .describe("Maximum number of leads to return (max 1000)."),
        status: z
          .enum(LEAD_STATUS)
          .optional()
          .describe("Filter by lead status (LeadStatus enum)."),
        productId: z.number().optional().describe("Filter by associated product ID."),
        applicationId: z.number().optional().describe("Filter by associated application ID."),
        mine: z
          .boolean()
          .optional()
          .describe("Only leads you own or created ('my leads')."),
        ownerUserId: z
          .number()
          .optional()
          .describe("Only leads owned by this user ID (resolve with whoami/manage_users)."),
        regionId: z
          .number()
          .optional()
          .describe(
            "Only leads in this region, matched on the lead's region or its country's region (IDs from get_regions)."
          ),
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
      const me = await getCurrentUser();

      const limit = a.limit || 10;
      const whereConditions: any = {};

      if (a.status) {
        const validStatuses = ["NEW", "CONTACTED", "QUALIFIED", "LOST", "WON"];
        if (!validStatuses.includes(a.status)) {
          throw new Error(
            `Invalid status "${a.status}". Valid statuses are: ${validStatuses.join(", ")}`
          );
        }
        whereConditions.status = a.status;
      }
      if (a.productId) whereConditions.productId = a.productId;
      if (a.applicationId) whereConditions.applicationId = a.applicationId;

      // Ownership/geography filters are ANDed on top of the structured ones.
      const and: any[] = [];
      if (a.mine) {
        and.push({ OR: [{ ownerUserId: me.id }, { createdByUserId: me.id }] });
      }
      if (a.ownerUserId != null) and.push({ ownerUserId: a.ownerUserId });
      if (a.regionId != null) {
        and.push({
          OR: [
            { regionId: a.regionId },
            { country: { is: { regionId: a.regionId } } },
          ],
        });
      }
      if (and.length > 0) whereConditions.AND = and;

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          application: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          country: { select: { id: true, name: true } },
          ownerUser: OWNER_SELECT,
        },
      });
      const payload = { success: true, data: leads, count: leads.length };

      // Large result -> DATASET widget; small -> inline JSON. Widget rows are a
      // FLAT projection (related product/application/region/country surfaced as
      // scalar name columns) so the type-aware table renders cleanly.
      const rows = leads.map((l: any) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        industry: l.industry ?? null,
        product: l.product?.name ?? null,
        application: l.application?.name ?? null,
        region: l.region?.name ?? null,
        country: l.country?.name ?? null,
        owner: ownerLabel(l),
        ownerUserId: l.ownerUserId ?? null,
        email: l.email ?? null,
        phone: l.phone ?? null,
        website: l.website ?? null,
        createdAt: l.createdAt,
      }));

      const widget = okList(
        rows,
        "Leads",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["id", "name", "status", "industry", "product", "country", "owner"]
      );
      if (!("structuredContent" in widget)) return ok(payload);
      return widget as any;
    }
  );

  // -------------------------------------------------------------------------
  // create_lead — single lead write.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "create_lead",
    {
      title: "Create lead",
      description: [
        "create_lead — create a single lead/prospect, owned by you.",
        "USE WHEN: the user explicitly asks to create a lead. WRITE ACTION — confirm",
        "intent first.",
        "DO NOT USE WHEN: the user is still researching candidates or asking whether a",
        "lead exists -> use search_leads first; the user has many prepared leads ->",
        "use batch_create_leads.",
        "RETURNS: an ACTION confirmation widget on success (the created lead's id +",
        "name); the model should confirm briefly.",
        "GOTCHAS: name and productId are required; resolve productId with",
        "search_products/get_products. status defaults to NEW.",
        "OWNERSHIP: the lead is stamped with you as creator AND owner unless you pass",
        "ownerUserId. The owner (plus the creator and any ADMIN) is who may later edit",
        "it. Passing countryId also stamps the lead's region, which is what region",
        "competencies are checked against — always set it when you know the country.",
      ].join("\n"),
      inputSchema: {
        name: z.string().describe("Lead/company name (required)."),
        productId: z.number().describe("Associated product ID (required)."),
        email: z.string().optional().describe("Contact email."),
        phone: z.string().optional().describe("Contact phone."),
        status: z
          .enum(LEAD_STATUS)
          .optional()
          .default("NEW")
          .describe("Lead status (LeadStatus enum). Defaults to NEW."),
        industry: z.string().optional().describe("Lead industry."),
        tags: z.array(z.string()).optional().describe("Free-form tags."),
        description: z.string().optional().describe("Lead description / notes."),
        website: z.string().optional().describe("Lead website URL."),
        applicationId: z.number().optional().describe("Associated application ID."),
        countryId: z
          .number()
          .optional()
          .describe("Country ID (get_regions). Also stamps the lead's region."),
        regionId: z
          .number()
          .optional()
          .describe("Region ID (get_regions). Defaults to the country's region."),
        ownerUserId: z
          .number()
          .optional()
          .describe("Owner user ID. Defaults to you."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();

      if (!a.name || !a.productId) throw new Error("name and productId are required");

      const ownerUserId = await resolveOwnerUserId(a.ownerUserId, me.id);
      const regionId = await resolveRegionId(a.countryId, a.regionId);

      const leadData: any = {
        name: a.name,
        productId: a.productId,
        status: a.status || "NEW",
        createdByUserId: me.id,
        ownerUserId,
      };
      if (a.countryId !== undefined) leadData.countryId = a.countryId;
      if (regionId !== undefined) leadData.regionId = regionId;
      if (a.email) leadData.email = a.email;
      if (a.phone) leadData.phone = a.phone;
      if (a.industry) leadData.industry = a.industry;
      if (a.tags) leadData.tags = a.tags;
      if (a.description) leadData.description = a.description;
      if (a.website) leadData.website = a.website;
      if (a.applicationId) leadData.applicationId = a.applicationId;

      const lead = await prisma.lead.create({
        data: leadData,
        include: { product: true, application: true, ownerUser: OWNER_SELECT },
      });

      // Success -> ACTION confirmation widget (terminal). The human fields go to
      // BOTH the model (structuredContent) and the widget (_meta), so the model
      // can confirm in words even if the card is collapsed.
      return buildActionEnvelope(
        {
          status: "success",
          title: "Lead created",
          detail: `${lead.name}${lead.product ? ` → ${lead.product.name}` : ""} (status: ${lead.status}, owner: ${ownerLabel(lead) ?? "unassigned"})`,
          id: String(lead.id),
          idLabel: "Lead ID",
        },
        `[PRESENTATION] Lead "${lead.name}" (ID ${lead.id}) created. Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // update_lead — single lead update.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "update_lead",
    {
      title: "Update lead",
      description: [
        "update_lead — change fields on an existing lead you may edit.",
        "USE WHEN: the user explicitly asks to change fields (status, contact info,",
        "metadata) on a known lead. WRITE ACTION — confirm intent first.",
        "DO NOT USE WHEN: the user only wants to analyze a lead -> use get_leads; the",
        "user wants to update many leads at once -> use batch_update_leads.",
        "RETURNS: an ACTION confirmation card on success (which fields changed / new",
        "status); the model should confirm briefly. Full updated lead is in",
        "structuredContent.",
        "GOTCHAS: id is required (look it up with search_leads if unknown); status must",
        "be a valid LeadStatus value. Fails (P2025) if the lead does not exist.",
        "OWNERSHIP: you may edit a lead you own or created, an UNOWNED lead inside your",
        "region competency (any unowned lead if you have no regions assigned), or —",
        "as ADMIN — anything. Otherwise the call is refused and names the owner; use",
        "assign_lead to take it over if you are allowed to.",
      ].join("\n"),
      inputSchema: {
        id: z.number().describe("Lead ID to update (required)."),
        name: z.string().optional().describe("New lead/company name."),
        email: z.string().optional().describe("New contact email."),
        phone: z.string().optional().describe("New contact phone."),
        status: z
          .enum(LEAD_STATUS)
          .optional()
          .describe("New lead status (LeadStatus enum)."),
        industry: z.string().optional().describe("New industry."),
        tags: z.array(z.string()).optional().describe("Replacement tag list."),
        description: z.string().optional().describe("New description."),
        website: z.string().optional().describe("New website URL."),
        applicationId: z.number().optional().describe("New associated application ID."),
        annualRevenue: z.number().optional().describe("Annual revenue."),
        employeeCount: z.number().optional().describe("Employee count."),
        confidence: z.number().optional().describe("Confidence score."),
        countryId: z
          .number()
          .optional()
          .describe("New country ID (get_regions). Also restamps the region."),
        regionId: z
          .number()
          .optional()
          .describe("New region ID (get_regions)."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();

      if (!a.id) throw new Error("Lead ID is required");

      // Ownership gate: load only the columns the rule needs.
      const existing = await prisma.lead.findUnique({
        where: { id: a.id },
        select: ACCESS_SELECT,
      });
      if (!existing) throw new Error(`Lead with ID ${a.id} not found`);
      const access: LeadAccessFields = {
        ownerUserId: existing.ownerUserId,
        createdByUserId: existing.createdByUserId,
        regionId: existing.regionId,
        countryRegionId: existing.country?.regionId ?? null,
      };
      if (!canEditLead(me, access)) throw new Error(editRefusalMessage(access));

      const updateData: any = {};
      if (a.name !== undefined) updateData.name = a.name;
      if (a.email !== undefined) updateData.email = a.email;
      if (a.phone !== undefined) updateData.phone = a.phone;
      if (a.status !== undefined) updateData.status = a.status;
      if (a.industry !== undefined) updateData.industry = a.industry;
      if (a.tags !== undefined) updateData.tags = a.tags;
      if (a.description !== undefined) updateData.description = a.description;
      if (a.website !== undefined) updateData.website = a.website;
      if (a.applicationId !== undefined) updateData.applicationId = a.applicationId;
      if (a.annualRevenue !== undefined) updateData.annualRevenue = a.annualRevenue;
      if (a.employeeCount !== undefined) updateData.employeeCount = a.employeeCount;
      if (a.confidence !== undefined) updateData.confidence = a.confidence;
      if (a.countryId !== undefined) updateData.countryId = a.countryId;
      if (a.countryId !== undefined || a.regionId !== undefined) {
        const regionId = await resolveRegionId(a.countryId, a.regionId);
        if (regionId !== undefined) updateData.regionId = regionId;
      }

      try {
        const updatedLead = await prisma.lead.update({
          where: { id: a.id },
          data: updateData,
          include: { product: true, application: true, region: true, country: true },
        });

        // Human summary of what changed. If status was set, lead with it; else
        // list the changed field names.
        const changedFields = Object.keys(updateData);
        const detail =
          updateData.status !== undefined
            ? `Status → ${updateData.status}` +
              (changedFields.length > 1
                ? ` (+${changedFields.length - 1} fields)`
                : "")
            : changedFields.length > 0
              ? `Changed: ${changedFields.join(", ")}`
              : "No changes";

        return buildActionEnvelope(
          {
            status: "success",
            title: "Lead updated",
            detail: `${updatedLead.name} — ${detail}`,
            id: String(updatedLead.id),
            idLabel: "Lead ID",
          },
          `[PRESENTATION] Lead "${updatedLead.name}" (ID ${updatedLead.id}) updated. Confirm briefly.`
        ) as any;
      } catch (error: any) {
        if (error.code === "P2025") throw new Error(`Lead with ID ${a.id} not found`);
        throw error;
      }
    }
  );

  // -------------------------------------------------------------------------
  // delete_lead — destructive single delete.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "delete_lead",
    {
      title: "Delete lead",
      description: [
        "delete_lead — permanently delete a lead by ID (ADMIN only).",
        "USE WHEN: the user explicitly asks to delete a lead by ID. DESTRUCTIVE —",
        "confirm intent first.",
        "DO NOT USE WHEN: the user asks to mark a lead lost, archive, or disqualify ->",
        "use update_lead with the appropriate status instead.",
        "RETURNS: an ACTION confirmation card on success (the deleted lead's id); the",
        "model should confirm briefly.",
        "GOTCHAS: fails (P2025) if the lead does not exist.",
        "OWNERSHIP: ADMIN role required — owning or creating a lead does NOT grant",
        "delete. Non-admins should mark the lead LOST with update_lead instead.",
      ].join("\n"),
      inputSchema: {
        id: z.number().describe("Lead ID to delete."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();
      requireRole(me, "ADMIN");

      if (!a.id) throw new Error("Lead ID is required");

      // Fetch the name first so the confirmation card can show it (the delete
      // itself returns nothing useful for the card).
      const existing = await prisma.lead.findUnique({
        where: { id: a.id },
        select: { name: true },
      });
      try {
        await prisma.lead.delete({ where: { id: a.id } });
      } catch (error: any) {
        if (error.code === "P2025") throw new Error(`Lead with ID ${a.id} not found`);
        throw error;
      }
      return buildActionEnvelope(
        {
          status: "success",
          title: "Lead deleted",
          detail: existing?.name ?? `Lead #${a.id}`,
          id: String(a.id),
          idLabel: "Lead ID",
        },
        `[PRESENTATION] Lead${existing?.name ? ` "${existing.name}"` : ""} (ID ${a.id}) deleted. Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // search_leads — fuzzy lead lookup.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "search_leads",
    {
      title: "Search leads",
      description: [
        "search_leads — fuzzy lead lookup by a company/person phrase and/or required",
        "tags, with optional filters by industry/sector, country, status, owner and",
        "region.",
        "USE WHEN: the user wants to SEE, LIST, FIND, or BROWSE leads/companies in a",
        "sector/industry/country or by any filter — this is the primary tool for showing",
        "a set of leads.",
        "PREFER THIS over get_leads for any human-facing request: get_leads returns raw",
        "records with no widget; search_leads renders the interactive table the user",
        "actually sees.",
        "USE WHEN: the user gives a company/person/tag phrase and wants matching lead",
        "records or IDs.",
        "DO NOT USE WHEN: the user wants all leads with structured filters -> use",
        "get_leads.",
        "RETURNS: matching rows as an interactive DATASET widget (sortable/searchable",
        "table + CSV export). The card IS the answer — do not re-list rows. An empty",
        "result is returned inline as { success, data[], count, searchCriteria }.",
        "GOTCHAS: tags use hasEvery (a lead must carry ALL provided tags); the",
        "industry/country/status/owner/region filters narrow the result (ANDed with the",
        "phrase). Visibility is OPEN — everyone sees every lead; mine=true narrows to",
        "the leads you own or created.",
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Free-text phrase matched against name, description, email, and industry/sector."
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe("Tags that a matching lead must ALL carry (hasEvery)."),
        industry: z
          .string()
          .optional()
          .describe(
            "Filter by industry / sector (case-insensitive contains, e.g. 'Defense Electronics')."
          ),
        country: z
          .string()
          .optional()
          .describe("Filter by country name (case-insensitive contains)."),
        status: z
          .string()
          .optional()
          .describe("Filter by lead status (e.g. NEW, WON, LOST)."),
        mine: z
          .boolean()
          .optional()
          .describe("Only leads you own or created ('my leads')."),
        ownerUserId: z
          .number()
          .optional()
          .describe("Only leads owned by this user ID."),
        regionId: z
          .number()
          .optional()
          .describe(
            "Only leads in this region, matched on the lead's region or its country's region (IDs from get_regions)."
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .default(20)
          .describe("Maximum number of matches to return (max 1000)."),
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
      const me = await getCurrentUser();

      // Fuzzy OR-group (phrase + tags) is matched loosely; the structured
      // filters (industry/country/status) narrow the set and are ANDed with it.
      const or: any[] = [];
      const and: any[] = [];

      if (a.query) {
        or.push(
          { name: { contains: a.query, mode: "insensitive" } },
          { description: { contains: a.query, mode: "insensitive" } },
          { email: { contains: a.query, mode: "insensitive" } },
          { industry: { contains: a.query, mode: "insensitive" } }
        );
      }
      if (a.tags && Array.isArray(a.tags) && a.tags.length > 0) {
        or.push({ tags: { hasEvery: a.tags } });
      }

      if (a.industry) {
        and.push({ industry: { contains: a.industry, mode: "insensitive" } });
      }
      if (a.status) {
        and.push({ status: a.status.toUpperCase() });
      }
      if (a.country) {
        and.push({
          country: { is: { name: { contains: a.country, mode: "insensitive" } } },
        });
      }
      if (a.mine) {
        and.push({ OR: [{ ownerUserId: me.id }, { createdByUserId: me.id }] });
      }
      if (a.ownerUserId != null) and.push({ ownerUserId: a.ownerUserId });
      if (a.regionId != null) {
        and.push({
          OR: [
            { regionId: a.regionId },
            { country: { is: { regionId: a.regionId } } },
          ],
        });
      }

      const whereConditions: any =
        or.length > 0
          ? { AND: [{ OR: or }, ...and] }
          : and.length > 0
            ? { AND: and }
            : {};

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: a.limit || 20,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          application: { select: { id: true, name: true } },
          ownerUser: OWNER_SELECT,
        },
      });

      // Flatten relations to scalar columns for the DATASET widget.
      const rows = leads.map((l: any) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        industry: l.industry ?? null,
        product: l.product?.name ?? null,
        application: l.application?.name ?? null,
        owner: ownerLabel(l),
        ownerUserId: l.ownerUserId ?? null,
        email: l.email ?? null,
        website: l.website ?? null,
      }));

      // search_leads is THE "show me the list" tool, so it renders the DATASET
      // widget unconditionally whenever there are matching rows — threshold 0
      // means any non-empty set produces the interactive table. A zero-row
      // result falls through to the inline empty result below.
      const widget = okList(
        rows,
        "Leads — search",
        config.PUBLIC_BASE_URL,
        0,
        ["id", "name", "status", "industry", "product", "application", "owner"]
      );
      if (!("structuredContent" in widget)) {
        return ok({
          success: true,
          data: leads,
          count: leads.length,
          searchCriteria: {
            query: a.query,
            tags: a.tags,
            industry: a.industry,
            country: a.country,
            status: a.status,
            mine: a.mine,
            ownerUserId: a.ownerUserId,
            regionId: a.regionId,
          },
        });
      }
      return widget as any;
    }
  );

  // -------------------------------------------------------------------------
  // get_lead_notes — read note/activity history.
  // -------------------------------------------------------------------------
  server.tool(
    "get_lead_notes",
    [
      "get_lead_notes — read notes / call / meeting / activity history for a lead.",
      "USE WHEN: the user asks for notes, call/meeting history, or activity context",
      "for a lead.",
      "DO NOT USE WHEN: the user asks to add a note -> use create_lead_note.",
      "RETURNS: { success, leadId, leadName, totalNotes, notes[] }.",
      "GOTCHAS: leadId is required (resolve with search_leads/get_leads first);",
      "noteType filters by a bracketed prefix in the note content.",
    ].join("\n"),
    {
      leadId: z.number().describe("Lead ID whose notes to read (required)."),
      limit: z.number().optional().default(20).describe("Maximum number of notes to return."),
      noteType: z
        .string()
        .optional()
        .describe("Filter notes whose content carries a [TYPE] prefix (e.g. 'call')."),
      dateFrom: z.string().optional().describe("Only notes created on/after this date (ISO)."),
      dateTo: z.string().optional().describe("Only notes created on/before this date (ISO)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      if (!a.leadId) throw new Error("leadId is required");

      const where: any = { leadId: a.leadId };
      const limit = a.limit || 20;

      if (a.noteType) {
        where.content = { contains: `[${(a.noteType as string).toUpperCase()}]` };
      }
      if (a.dateFrom || a.dateTo) {
        where.createdAt = {};
        if (a.dateFrom) where.createdAt.gte = new Date(a.dateFrom as string);
        if (a.dateTo) where.createdAt.lte = new Date(a.dateTo as string);
      }

      // Explicit select of columns that exist in the live `notes` table. The
      // schema also declares a `createdBy`/`created_by` column that is NOT
      // present in the deployed DB, so a default (all-columns) findMany throws
      // P2022 — selecting only real columns keeps this read working.
      const notes = await prisma.note.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          user_id: true,
          lead: { select: { name: true, status: true } },
        },
      });

      const leadName = notes[0]?.lead.name || "Unknown";

      // 0 notes -> simple inline message (no widget).
      if (notes.length === 0) {
        return ok({
          success: true,
          leadId: a.leadId,
          leadName,
          totalNotes: 0,
          message: `No notes for lead "${leadName}" (ID ${a.leadId}).`,
        });
      }

      // Map each Note -> the MESSAGES widget's NormalizedMessage shape.
      //
      // The note's type is stored as a bracketed [TYPE] prefix on `content`
      // (e.g. "[CALL] ..."); there is no dedicated noteType column. We parse it
      // to drive both `source` (email -> 'mail', everything else -> 'chat') and
      // the human `subject` label. `sender` is the note's user: the numeric
      // user_id when present, else 'System' (the live `notes` table has no
      // human-name/`created_by` column).
      const messages: NormalizedMessage[] = notes.map((note: any) => {
        const raw = String(note.content ?? "");
        const m = raw.match(/^\s*\[([^\]]+)\]\s*/);
        const typeLabel = m ? m[1].trim() : "GENERAL";
        const typeKey = typeLabel.toLowerCase();
        const isEmail = typeKey === "email" || typeKey === "mail";
        // Body = content without the leading [TYPE] prefix (cleaner read).
        const body = m ? raw.slice(m[0].length) : raw;
        const firstLine =
          body.split(/\r?\n/, 1)[0]?.trim() || "(no content)";
        const sender =
          note.user_id != null ? `User #${note.user_id}` : "System";

        return {
          id: String(note.id),
          source: isEmail ? ("mail" as const) : ("chat" as const),
          sender,
          subject: typeLabel,
          preview: firstLine,
          body,
          ts: new Date(note.createdAt).toISOString(),
          unread: false,
        };
      });

      const hasMail = messages.some((msg) => msg.source === "mail");
      const meta: MessagesMeta = {
        title: `Lead history — ${leadName}`,
        kind: hasMail ? "mixed" : "chat",
        messages,
      };

      const steer =
        `[PRESENTATION] Note history for lead "${leadName}" (ID ${a.leadId}): ` +
        `${messages.length} entr(ies) in the messages widget (expandable, with a filter). ` +
        `The widget IS the answer — do NOT list note contents in text. ` +
        `Summarize briefly (how many entries, latest activity); the detail is in the widget.`;

      return buildMessagesEnvelope(meta, steer) as any;
    }
  );

  // -------------------------------------------------------------------------
  // create_lead_note — write a note.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "create_lead_note",
    {
      title: "Add note",
      description: [
        "create_lead_note — log a note / call / meeting / email / task / follow-up",
        "on a lead.",
        "USE WHEN: the user explicitly asks to log activity or a note on a lead.",
        "WRITE ACTION — confirm intent first.",
        "DO NOT USE WHEN: the user only wants to read lead history -> use get_lead_notes.",
        "RETURNS: an ACTION confirmation card on success (note type + lead); the model",
        "should confirm briefly. Created note is in structuredContent.",
        "GOTCHAS: leadId and content are required; noteType is stored as a [TYPE]",
        "prefix on the content (defaults to 'general').",
        "OWNERSHIP: notes are deliberately OPEN — any active user may add a note to any",
        "lead, including one owned by someone else. The note is always attributed to",
        "you (there is no way to write a note as another user).",
      ].join("\n"),
      inputSchema: {
        leadId: z.number().describe("Lead ID the note belongs to (required)."),
        content: z.string().describe("Note body (required)."),
        noteType: z
          .enum(["general", "call", "meeting", "email", "task", "follow_up"])
          .optional()
          .default("general")
          .describe("Note type, stored as an uppercase [TYPE] prefix. Defaults to general."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();

      if (!a.leadId || !a.content) throw new Error("leadId and content are required");

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        select: { id: true, name: true },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);

      const noteType = (a.noteType as string) || "general";
      // Attribution is taken from the access token, never from an argument.
      const noteData: any = {
        leadId: a.leadId,
        content: `[${noteType.toUpperCase()}] ${a.content}`,
        user_id: me.id,
      };

      // Explicit select of columns that exist in the live `notes` table. The
      // Prisma schema also declares `createdBy`/`created_by`, which is NOT present
      // in the deployed DB — a default (all-columns) create return throws P2022.
      // Selecting only real columns keeps this write working (mirrors the read in
      // get_lead_notes).
      const note = await prisma.note.create({
        data: noteData,
        select: {
          id: true,
          content: true,
          createdAt: true,
          lead: { select: { name: true } },
        },
      });

      return buildActionEnvelope(
        {
          status: "success",
          title: "Note added",
          detail: `${noteType.toUpperCase()} → ${note.lead.name}`,
          id: String(note.id),
          idLabel: "Note ID",
        },
        `[PRESENTATION] Note (${noteType.toUpperCase()}) saved for lead "${note.lead.name}". Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // batch_create_leads — bulk import.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "batch_create_leads",
    {
      title: "Import leads",
      description: [
        "batch_create_leads — bulk-create leads from prepared candidate data.",
        "USE WHEN: the user explicitly asks to import/create many leads at once.",
        "BULK WRITE ACTION — confirm intent first.",
        "DO NOT USE WHEN: the user is still researching/validating candidates, or only",
        "needs one lead -> use create_lead.",
        "RETURNS: an ACTION confirmation card (created / skipped / errors counts) —",
        "success when all clean, warning when any were skipped as duplicates or any",
        "errored. Full summary + lists are in structuredContent.",
        "GOTCHAS: each lead needs name + productId; maximum 200 per call; prefer",
        "skipDuplicates=true (matches existing name or email).",
        "OWNERSHIP: any active user may import. Every created lead is stamped with you",
        "as creator and (unless ownerUserId says otherwise) as owner. Set countryId per",
        "lead where you know it — that stamps the region competencies are checked on.",
      ].join("\n"),
      inputSchema: {
        leads: z
          .array(
            z.object({
              name: z.string().describe("Lead/company name (required)."),
              productId: z.number().describe("Associated product ID (required)."),
              email: z.string().optional().describe("Contact email."),
              phone: z.string().optional().describe("Contact phone."),
              status: z.string().optional().describe("Lead status (LeadStatus). Defaults to NEW."),
              industry: z.string().optional().describe("Lead industry."),
              tags: z.array(z.string()).optional().describe("Free-form tags."),
              website: z.string().optional().describe("Website URL."),
              description: z.string().optional().describe("Description."),
              countryId: z
                .number()
                .optional()
                .describe("Country ID (get_regions). Also stamps the region."),
              regionId: z
                .number()
                .optional()
                .describe("Region ID (get_regions). Defaults to the country's region."),
            })
          )
          .describe("Array of leads to create (max 200)."),
        skipDuplicates: z
          .boolean()
          .optional()
          .default(true)
          .describe("Skip leads whose name or email already exists. Defaults to true."),
        ownerUserId: z
          .number()
          .optional()
          .describe("Owner for every created lead. Defaults to you."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      // Any ACTIVE user may bulk-import; getCurrentUser refuses deactivated ones.
      const me = await getCurrentUser();
      const ownerUserId = await resolveOwnerUserId(a.ownerUserId, me.id);

      if (!a.leads || !Array.isArray(a.leads) || a.leads.length === 0) {
        throw new Error("leads array is required and must not be empty");
      }
      if (a.leads.length > 200) {
        throw new Error(
          `Batch size too large: ${a.leads.length}. Maximum allowed: 200. Please split into smaller batches.`
        );
      }

      const skipDuplicates = a.skipDuplicates !== false;
      const createdLeads: any[] = [];
      const skippedLeads: any[] = [];
      const errors: any[] = [];

      for (const leadData of a.leads) {
        try {
          if (skipDuplicates) {
            const existing = await prisma.lead.findFirst({
              where: {
                OR: [
                  { name: leadData.name },
                  ...(leadData.email ? [{ email: leadData.email }] : []),
                ],
              },
            });
            if (existing) {
              skippedLeads.push({
                name: leadData.name,
                reason: `Duplicate found (ID: ${existing.id})`,
              });
              continue;
            }
          }

          const regionId = await resolveRegionId(
            leadData.countryId,
            leadData.regionId
          );
          const lead = await prisma.lead.create({
            data: {
              name: leadData.name,
              email: leadData.email,
              phone: leadData.phone,
              productId: leadData.productId,
              status: (leadData.status as any) || "NEW",
              industry: leadData.industry,
              tags: leadData.tags || [],
              website: leadData.website,
              description: leadData.description,
              countryId: leadData.countryId,
              regionId,
              createdByUserId: me.id,
              ownerUserId,
            },
          });
          createdLeads.push(lead);
        } catch (error) {
          errors.push({
            name: leadData.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Card status: warning when anything was skipped (duplicates) or errored;
      // success only when every requested lead was created cleanly. The full
      // lists stay in structuredContent for the model to inspect.
      const hasIssues = skippedLeads.length > 0 || errors.length > 0;
      const summary = {
        total: a.leads.length,
        created: createdLeads.length,
        skipped: skippedLeads.length,
        errors: errors.length,
      };

      return buildActionEnvelope(
        {
          status: hasIssues ? "warning" : "success",
          title: hasIssues ? "Import finished with warnings" : "Leads imported",
          detail: `Created ${summary.created}, skipped ${summary.skipped} (duplicates), errors ${summary.errors}`,
          id: String(summary.created),
          idLabel: "Created",
        },
        `[PRESENTATION] Lead import: created ${summary.created}, skipped ${summary.skipped}, errors ${summary.errors}. ` +
          `Confirm briefly${hasIssues ? " and mention the skipped/errored ones" : ""}.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // batch_update_leads — bulk update.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "batch_update_leads",
    {
      title: "Update leads (bulk)",
      description: [
        "batch_update_leads — bulk-update status/tags/metadata across many leads",
        "(ADMIN only).",
        "USE WHEN: the user explicitly asks to change fields on multiple leads at once.",
        "BULK WRITE ACTION — confirm intent first.",
        "DO NOT USE WHEN: the user only wants to analyze/filter leads -> use get_leads;",
        "a single lead -> use update_lead.",
        "RETURNS: an ACTION confirmation card (how many leads were updated) — success",
        "when at least one was updated, warning when 0 matched. Counts/IDs are in",
        "structuredContent via the card id.",
        "GOTCHAS: maximum 500 IDs; operation='append' only affects tags (union with",
        "existing); status must be a valid LeadStatus value.",
        "OWNERSHIP: ADMIN role required — a bulk write crosses everyone's book at once,",
        "so per-lead ownership is not evaluated. Non-admins update leads one at a time",
        "with update_lead.",
      ].join("\n"),
      inputSchema: {
        leadIds: z.array(z.number()).describe("Lead IDs to update (max 500)."),
        updates: z
          .object({
            status: z.enum(LEAD_STATUS).optional().describe("New status for all leads."),
            tags: z.array(z.string()).optional().describe("Tags to set or append."),
            assignedTo: z.string().optional().describe("Assignee."),
            industry: z.string().optional().describe("New industry."),
            confidence: z.number().optional().describe("New confidence score."),
          })
          .describe("Fields to apply to every selected lead."),
        operation: z
          .enum(["replace", "append"])
          .optional()
          .default("replace")
          .describe("How to apply tags: 'replace' overwrites, 'append' unions. Defaults to replace."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();
      requireRole(me, "ADMIN");

      if (!a.leadIds || !Array.isArray(a.leadIds) || a.leadIds.length === 0) {
        throw new Error("leadIds array is required and must not be empty");
      }
      if (a.leadIds.length > 500) {
        throw new Error(
          `Batch size too large: ${a.leadIds.length}. Maximum allowed: 500. Please split into smaller batches.`
        );
      }
      if (!a.updates || typeof a.updates !== "object") {
        throw new Error("updates object is required");
      }

      const operation = a.operation || "replace";
      const updateData: any = {};
      const updates = a.updates as any;

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.industry !== undefined) updateData.industry = updates.industry;
      if (updates.confidence !== undefined) updateData.confidence = updates.confidence;

      if (updates.tags !== undefined) {
        if (operation === "append") {
          const existingLeads = await prisma.lead.findMany({
            where: { id: { in: a.leadIds } },
            select: { id: true, tags: true },
          });
          const updatePromises = await Promise.all(
            existingLeads.map((lead: any) =>
              prisma.lead.update({
                where: { id: lead.id },
                data: { ...updateData, tags: [...new Set([...lead.tags, ...updates.tags])] },
              })
            )
          );
          const updatedCount = updatePromises.length;
          return buildActionEnvelope(
            {
              status: updatedCount > 0 ? "success" : "warning",
              title:
                updatedCount > 0
                  ? "Leads updated"
                  : "No matching leads",
              detail: `Updated ${updatedCount} (tags appended)`,
              id: String(updatedCount),
              idLabel: "Updated",
            },
            `[PRESENTATION] Bulk update (append): updated ${updatedCount} leads. Confirm briefly.`
          ) as any;
        } else {
          updateData.tags = updates.tags;
        }
      }

      const result = await prisma.lead.updateMany({
        where: { id: { in: a.leadIds } },
        data: updateData,
      });
      return buildActionEnvelope(
        {
          status: result.count > 0 ? "success" : "warning",
          title:
            result.count > 0 ? "Leads updated" : "No matching leads",
          detail: `Updated ${result.count}`,
          id: String(result.count),
          idLabel: "Updated",
        },
        `[PRESENTATION] Bulk update: updated ${result.count} leads. Confirm briefly.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // assign_lead — hand a lead to another user (or release it).
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "assign_lead",
    {
      title: "Assign lead",
      description: [
        "assign_lead — set (or clear) the owner of a lead.",
        "USE WHEN: the user asks to assign/reassign a lead to a colleague, to take a",
        "lead over, or to release it back to the unowned pool. WRITE ACTION — confirm",
        "intent first.",
        "DON'T USE WHEN: you only want to change lead fields -> update_lead; you want to",
        "know who owns what -> get_leads with ownerUserId / mine.",
        "RETURNS: an ACTION confirmation card with the before/after owner; the same",
        "before/after pair is in structuredContent.",
        "GOTCHAS: pass ownerUserId=null to release the lead (it becomes claimable by",
        "anyone whose region competency covers it).",
        "OWNERSHIP: you may reassign a lead you own or created, or an unowned lead",
        "inside your region competency; ADMIN may reassign anything. Once you hand a",
        "lead to somebody else you can no longer edit it unless you created it.",
      ].join("\n"),
      inputSchema: {
        leadId: z.number().describe("Lead ID to (re)assign (required)."),
        ownerUserId: z
          .number()
          .nullable()
          .describe("New owner's user ID, or null to leave the lead unowned."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (a) => {
      const me = await getCurrentUser();

      if (!a.leadId) throw new Error("leadId is required");

      const existing = await prisma.lead.findUnique({
        where: { id: a.leadId },
        select: { ...ACCESS_SELECT, ownerUser: OWNER_SELECT },
      });
      if (!existing) throw new Error(`Lead with ID ${a.leadId} not found`);

      const access: LeadAccessFields = {
        ownerUserId: existing.ownerUserId,
        createdByUserId: existing.createdByUserId,
        regionId: existing.regionId,
        countryRegionId: existing.country?.regionId ?? null,
      };
      if (!canEditLead(me, access)) throw new Error(editRefusalMessage(access));

      const nextOwnerId = await resolveOwnerUserId(a.ownerUserId, me.id);
      const updated = await prisma.lead.update({
        where: { id: a.leadId },
        data: { ownerUserId: nextOwnerId },
        select: { id: true, name: true, ownerUserId: true, ownerUser: OWNER_SELECT },
      });

      const before = existing.ownerUser
        ? { id: existing.ownerUser.id, label: ownerLabel(existing) }
        : null;
      const after = updated.ownerUser
        ? { id: updated.ownerUser.id, label: ownerLabel(updated) }
        : null;
      const beforeLabel = before?.label ?? "unassigned";
      const afterLabel = after?.label ?? "unassigned";

      const env = buildActionEnvelope(
        {
          status: "success",
          title: "Lead reassigned",
          detail: `${updated.name}: ${beforeLabel} → ${afterLabel}`,
          id: String(updated.id),
          idLabel: "Lead ID",
        },
        `[PRESENTATION] Lead "${updated.name}" (ID ${updated.id}) reassigned: ${beforeLabel} → ${afterLabel}. Confirm briefly.`
      ) as any;
      (env.structuredContent as Record<string, unknown>).owner = { before, after };
      return env;
    }
  );
}
