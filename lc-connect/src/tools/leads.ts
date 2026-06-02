import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  ACTION_WIDGET_URI,
  buildActionEnvelope,
} from "@cfi/mcp-widgets";
import { DATASET_WIDGET_URI, okList } from "../datasets.js";
import { config } from "../config.js";
import { prisma } from "../db/client.js";

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
      title: "Leady",
      description: [
        "List/filter sales leads (with product/application/region/country context).",
        "USE WHEN: the user asks to list, review, filter, or inspect leads by status,",
        "product, or application.",
        "DO NOT USE WHEN: the user has a company/person/tag phrase -> use search_leads;",
        "the user wants to create/update/delete a lead -> use the matching write tool.",
        "RETURNS: a small result inline as { success, data[], count }; a LARGE result",
        "(> threshold) as an interactive DATASET widget (sortable/searchable table +",
        "CSV export) — present that widget, do not re-list rows.",
        "GOTCHAS: resolve productId/applicationId with search_products/get_applications",
        "first; status must be one of NEW/CONTACTED/QUALIFIED/LOST/WON. Summarize large",
        "result sets analytically.",
      ].join("\n"),
      inputSchema: {
        limit: z.number().optional().default(10).describe("Maximum number of leads to return."),
        status: z
          .enum(LEAD_STATUS)
          .optional()
          .describe("Filter by lead status (LeadStatus enum)."),
        productId: z.number().optional().describe("Filter by associated product ID."),
        applicationId: z.number().optional().describe("Filter by associated application ID."),
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
      void getTenantSub();

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

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          application: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          country: { select: { id: true, name: true } },
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
        email: l.email ?? null,
        phone: l.phone ?? null,
        website: l.website ?? null,
        createdAt: l.createdAt,
      }));

      const widget = okList(
        rows,
        "Leady",
        config.PUBLIC_BASE_URL,
        DATASET_THRESHOLD,
        ["id", "name", "status", "industry", "product", "country"]
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
      title: "Utwórz lead",
      description: [
        "Create a single lead/prospect.",
        "USE WHEN: the user explicitly asks to create a lead. WRITE ACTION — confirm",
        "intent first.",
        "DO NOT USE WHEN: the user is still researching candidates or asking whether a",
        "lead exists -> use search_leads first; the user has many prepared leads ->",
        "use batch_create_leads.",
        "RETURNS: an ACTION confirmation widget on success (the created lead's id +",
        "name); the model should confirm briefly.",
        "GOTCHAS: name and productId are required; resolve productId with",
        "search_products/get_products. status defaults to NEW.",
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
      void getTenantSub();

      if (!a.name || !a.productId) throw new Error("name and productId are required");

      const leadData: any = {
        name: a.name,
        productId: a.productId,
        status: a.status || "NEW",
      };
      if (a.email) leadData.email = a.email;
      if (a.phone) leadData.phone = a.phone;
      if (a.industry) leadData.industry = a.industry;
      if (a.tags) leadData.tags = a.tags;
      if (a.description) leadData.description = a.description;
      if (a.website) leadData.website = a.website;
      if (a.applicationId) leadData.applicationId = a.applicationId;

      const lead = await prisma.lead.create({
        data: leadData,
        include: { product: true, application: true },
      });

      // Success -> ACTION confirmation widget (terminal). The human fields go to
      // BOTH the model (structuredContent) and the widget (_meta), so the model
      // can confirm in words even if the card is collapsed.
      return buildActionEnvelope(
        {
          status: "success",
          title: "Lead utworzony",
          detail: `${lead.name}${lead.product ? ` → ${lead.product.name}` : ""} (status: ${lead.status})`,
          id: String(lead.id),
          idLabel: "ID leada",
        },
        `[PREZENTACJA] Lead "${lead.name}" (ID ${lead.id}) utworzony. Potwierdź zwięźle.`
      ) as any;
    }
  );

  // -------------------------------------------------------------------------
  // update_lead — single lead update.
  // -------------------------------------------------------------------------
  server.tool(
    "update_lead",
    [
      "Update fields on an existing lead.",
      "USE WHEN: the user explicitly asks to change fields (status, contact info,",
      "metadata) on a known lead. WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user only wants to analyze a lead -> use get_leads; the",
      "user wants to update many leads at once -> use batch_update_leads.",
      "RETURNS: { success, data (updated lead), message }.",
      "GOTCHAS: id is required (look it up with search_leads if unknown); status must",
      "be a valid LeadStatus value. Fails (P2025) if the lead does not exist.",
    ].join("\n"),
    {
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
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.id) throw new Error("Lead ID is required");

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

      try {
        const updatedLead = await prisma.lead.update({
          where: { id: a.id },
          data: updateData,
          include: { product: true, application: true, region: true, country: true },
        });
        return ok({ success: true, data: updatedLead, message: "Lead updated successfully" });
      } catch (error: any) {
        if (error.code === "P2025") throw new Error(`Lead with ID ${a.id} not found`);
        throw error;
      }
    }
  );

  // -------------------------------------------------------------------------
  // delete_lead — destructive single delete.
  // -------------------------------------------------------------------------
  server.tool(
    "delete_lead",
    [
      "Permanently delete a lead by ID.",
      "USE WHEN: the user explicitly asks to delete a lead by ID. DESTRUCTIVE —",
      "confirm intent first.",
      "DO NOT USE WHEN: the user asks to mark a lead lost, archive, or disqualify ->",
      "use update_lead with the appropriate status instead.",
      "RETURNS: { success, message }.",
      "GOTCHAS: fails (P2025) if the lead does not exist.",
    ].join("\n"),
    {
      id: z.number().describe("Lead ID to delete."),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.id) throw new Error("Lead ID is required");
      try {
        await prisma.lead.delete({ where: { id: a.id } });
      } catch (error: any) {
        if (error.code === "P2025") throw new Error(`Lead with ID ${a.id} not found`);
        throw error;
      }
      return ok({ success: true, message: `Lead ${a.id} deleted successfully` });
    }
  );

  // -------------------------------------------------------------------------
  // search_leads — fuzzy lead lookup.
  // -------------------------------------------------------------------------
  server.tool(
    "search_leads",
    [
      "Fuzzy lead lookup by a company/person phrase and/or required tags.",
      "USE WHEN: the user gives a company/person/tag phrase and wants matching lead",
      "records or IDs.",
      "DO NOT USE WHEN: the user wants all leads with structured filters -> use",
      "get_leads.",
      "RETURNS: { success, data[] (with product+application context), count, searchCriteria }.",
      "GOTCHAS: tags use hasEvery (a lead must carry ALL provided tags).",
    ].join("\n"),
    {
      query: z
        .string()
        .optional()
        .describe("Free-text phrase matched against name, description, and email."),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags that a matching lead must ALL carry (hasEvery)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      const whereConditions: any = { OR: [] };

      if (a.query) {
        whereConditions.OR.push(
          { name: { contains: a.query, mode: "insensitive" } },
          { description: { contains: a.query, mode: "insensitive" } },
          { email: { contains: a.query, mode: "insensitive" } }
        );
      }
      if (a.tags && Array.isArray(a.tags) && a.tags.length > 0) {
        whereConditions.OR.push({ tags: { hasEvery: a.tags } });
      }
      if (whereConditions.OR.length === 0) {
        delete whereConditions.OR;
      }

      const leads = await prisma.lead.findMany({
        where: whereConditions,
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          application: { select: { id: true, name: true } },
        },
      });
      return ok({
        success: true,
        data: leads,
        count: leads.length,
        searchCriteria: { query: a.query, tags: a.tags },
      });
    }
  );

  // -------------------------------------------------------------------------
  // get_lead_notes — read note/activity history.
  // -------------------------------------------------------------------------
  server.tool(
    "get_lead_notes",
    [
      "Read notes / call / meeting / activity history for a specific lead.",
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
      void getTenantSub();

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

      const notes = await prisma.note.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { name: true, status: true } } },
      });

      const formattedNotes = notes.map((note: any) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        userId: note.user_id,
      }));

      return ok({
        success: true,
        leadId: a.leadId,
        leadName: notes[0]?.lead.name || "Unknown",
        totalNotes: formattedNotes.length,
        notes: formattedNotes,
      });
    }
  );

  // -------------------------------------------------------------------------
  // create_lead_note — write a note.
  // -------------------------------------------------------------------------
  server.tool(
    "create_lead_note",
    [
      "Record a note / call / meeting / email / task / follow-up on a lead.",
      "USE WHEN: the user explicitly asks to log activity or a note on a lead.",
      "WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user only wants to read lead history -> use get_lead_notes.",
      "RETURNS: { success, note{id,leadName,content,createdAt}, message }.",
      "GOTCHAS: leadId and content are required; noteType is stored as a [TYPE]",
      "prefix on the content (defaults to 'general').",
    ].join("\n"),
    {
      leadId: z.number().describe("Lead ID the note belongs to (required)."),
      content: z.string().describe("Note body (required)."),
      noteType: z
        .enum(["general", "call", "meeting", "email", "task", "follow_up"])
        .optional()
        .default("general")
        .describe("Note type, stored as an uppercase [TYPE] prefix. Defaults to general."),
      userId: z.number().optional().describe("ID of the user creating the note."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

      if (!a.leadId || !a.content) throw new Error("leadId and content are required");

      const lead = await prisma.lead.findUnique({
        where: { id: a.leadId },
        select: { id: true, name: true },
      });
      if (!lead) throw new Error(`Lead with ID ${a.leadId} not found`);

      const noteType = (a.noteType as string) || "general";
      const noteData: any = {
        leadId: a.leadId,
        content: `[${noteType.toUpperCase()}] ${a.content}`,
      };
      if (a.userId) noteData.user_id = a.userId;

      const note = await prisma.note.create({
        data: noteData,
        include: { lead: { select: { name: true } } },
      });

      return ok({
        success: true,
        note: {
          id: note.id,
          leadName: note.lead.name,
          content: note.content,
          createdAt: note.createdAt,
        },
        message: `Note added to lead "${lead.name}"`,
      });
    }
  );

  // -------------------------------------------------------------------------
  // batch_create_leads — bulk import.
  // -------------------------------------------------------------------------
  server.tool(
    "batch_create_leads",
    [
      "Bulk-create multiple leads from prepared candidate data.",
      "USE WHEN: the user explicitly asks to import/create many leads at once.",
      "BULK WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user is still researching/validating candidates, or only",
      "needs one lead -> use create_lead.",
      "RETURNS: { success, summary{total,created,skipped,errors}, createdLeads[],",
      "skippedLeads[], errors[] }.",
      "GOTCHAS: each lead needs name + productId; maximum 200 per call; prefer",
      "skipDuplicates=true (matches existing name or email).",
    ].join("\n"),
    {
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
          })
        )
        .describe("Array of leads to create (max 200)."),
      skipDuplicates: z
        .boolean()
        .optional()
        .default(true)
        .describe("Skip leads whose name or email already exists. Defaults to true."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

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

      return ok({
        success: true,
        summary: {
          total: a.leads.length,
          created: createdLeads.length,
          skipped: skippedLeads.length,
          errors: errors.length,
        },
        createdLeads: createdLeads.map((l) => ({ id: l.id, name: l.name })),
        skippedLeads,
        errors,
      });
    }
  );

  // -------------------------------------------------------------------------
  // batch_update_leads — bulk update.
  // -------------------------------------------------------------------------
  server.tool(
    "batch_update_leads",
    [
      "Bulk-update status/tags/metadata across many existing leads.",
      "USE WHEN: the user explicitly asks to change fields on multiple leads at once.",
      "BULK WRITE ACTION — confirm intent first.",
      "DO NOT USE WHEN: the user only wants to analyze/filter leads -> use get_leads;",
      "a single lead -> use update_lead.",
      "RETURNS: { success, operation, updatedCount, ... , message }.",
      "GOTCHAS: maximum 500 IDs; operation='append' only affects tags (union with",
      "existing); status must be a valid LeadStatus value.",
    ].join("\n"),
    {
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
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      void getTenantSub();

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
          return ok({
            success: true,
            operation: "append",
            updatedCount: updatePromises.length,
            updatedIds: updatePromises.map((l: any) => l.id),
            message: `Successfully updated ${updatePromises.length} leads (tags appended)`,
          });
        } else {
          updateData.tags = updates.tags;
        }
      }

      const result = await prisma.lead.updateMany({
        where: { id: { in: a.leadIds } },
        data: updateData,
      });
      return ok({
        success: true,
        operation: "replace",
        updatedCount: result.count,
        requestedIds: a.leadIds,
        updates: updateData,
        message: `Successfully updated ${result.count} leads`,
      });
    }
  );
}
