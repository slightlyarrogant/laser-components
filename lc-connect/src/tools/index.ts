import { createRequire } from "node:module";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  KPI_WIDGET_URI,
  buildKpiEnvelope,
  type KpiItem,
  type KpiMeta,
} from "@cfi/mcp-widgets";
import { prisma } from "../db/client.js";
import { getCurrentUser, invalidateCurrentUser } from "../core/current-user.js";
import { requireRole } from "../core/access.js";
import { registerProductsTools } from "./products.js";
import { registerApplicationsTools } from "./applications.js";
import { registerLeadsTools } from "./leads.js";
import { registerReportTools } from "./report.js";
import { registerAiTools } from "./ai.js";
import { registerKnowledgeTools } from "./knowledge.js";
import { registerAnalyticsTools } from "./analytics.js";
import { PRESENT_BRIEFLY } from "./_present.js";

// bcryptjs is CommonJS; createRequire mirrors how src/auth/oauth.ts loads it so
// the hash format written here is byte-for-byte what the login path verifies.
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

/** Cost factor for new password hashes. Matches the OAuth login expectation. */
const BCRYPT_COST = 12;

const USER_ROLES = ["ADMIN", "RESEARCHER", "SALES"] as const;

/**
 * Public user projection. `passwordHash` is NEVER selected here — no code path
 * in manage_users may return it.
 */
const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  regions: { select: { region: { select: { id: true, name: true, code: true } } } },
  _count: { select: { ownedLeads: true, leads: true } },
};

function shapeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? null,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    regions: (u.regions ?? []).map((r: any) => ({
      id: r.region.id,
      name: r.region.name,
      code: r.region.code ?? null,
    })),
    ownedLeads: u._count?.ownedLeads ?? 0,
    createdLeads: u._count?.leads ?? 0,
  };
}

function jsonOk(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * registerAllTools — registers the LC Connect tool set on a fresh McpServer.
 *
 * CHUNK 1 (this file): only a minimal proof-of-skeleton set —
 *   - get_statistics : DB-backed counts (products / applications / leads / mappings)
 *   - ping           : liveness probe
 *
 * CHUNK 2a: DB/CRUD domains ported to high-level `server.tool(...)`:
 *   - products     (src/tools/products.ts)     — catalog CRUD, search, taxonomy
 *   - applications (src/tools/applications.ts) — application catalog + product mappings + cross-search
 *   - leads        (src/tools/leads.ts)         — lead list/search, single + batch CRUD, notes
 *   - report       (src/tools/report.ts)        — report_issue via WhatsApp bridge
 *
 * CHUNK 2b (this chunk): AI + knowledge domains ported to high-level `server.tool(...)`,
 * plus DB-backed resources and the session-start prompt (wired in src/server.ts):
 *   - ai         (src/tools/ai.ts)          — Perplexity market intel + DB export/report/feed
 *   - knowledge  (src/tools/knowledge.ts)   — DB-backed resources, workflow guidance, learnings
 *                                             (+ registerKnowledgeResources for lc://resources/<slug>)
 *   - prompts    (src/prompts.ts)           — lc_session_start (loads knowledge base)
 *
 * CHUNK 2c: the widget/dataset layer (datasets.ts, widgets.ts, okList()), the
 * /widget, /widget-data and /datasets CSV routes, and the analytics cards
 * (src/tools/analytics.ts).
 *
 * IDENTITY: the `getTenantSub` resolver is threaded in so tools can resolve the
 * authenticated user. Tools that need the user's ROLE or REGION COMPETENCY call
 * getCurrentUser() (src/core/current-user.ts) instead, which reads the same
 * AsyncLocalStorage sub and loads the profile behind it.
 */
export function registerAllTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  // -------------------------------------------------------------------------
  // ping — trivial liveness/echo probe to prove the transport round-trips.
  // -------------------------------------------------------------------------
  server.tool(
    "ping",
    [
      "ping — liveness probe for the LC Connect MCP server.",
      "USE WHEN: you need to confirm the connection is alive or echo a message.",
      "DON'T USE WHEN: you need real CRM data — use get_statistics or a domain tool.",
      "RETURNS: 'pong' plus the optional echoed message.",
    ].join("\n"),
    {
      message: z
        .string()
        .max(500)
        .optional()
        .describe("Optional text to echo back."),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: message ? `pong: ${message}` : "pong",
          },
        ],
      };
    }
  );

  // -------------------------------------------------------------------------
  // get_statistics — high-level counts straight from Postgres.
  // -------------------------------------------------------------------------
  registerAppTool(
    server,
    "get_statistics",
    {
      title: "Database statistics",
      description: [
        "get_statistics — return headline counts for the Laser Components database: total products,",
        "applications, leads, and product↔application mappings.",
        "USE WHEN: the user asks 'how many products/leads do we have?', wants a quick",
        "overview, or you need a sanity-check that the data layer is reachable.",
        "DON'T USE WHEN: the user wants the actual records (use the product/lead/",
        "application list tools in chunk 2) or filtered/segmented metrics.",
        "RETURNS: a KPI card (interactive tiles for products / applications / leads /",
        "mappings) — the card IS the answer; the model also receives the same integer",
        "counts in structuredContent. Present them briefly.",
        PRESENT_BRIEFLY,
      ].join("\n"),
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: KPI_WIDGET_URI },
        "openai/outputTemplate": KPI_WIDGET_URI,
      },
    },
    async () => {
      const [products, applications, leads, productApplications] =
        await Promise.all([
          prisma.product.count(),
          prisma.application.count(),
          prisma.lead.count(),
          prisma.applicationProduct.count(),
        ]);

      const stats = { products, applications, leads, productApplications };

      // Render the same counts as a KPI card. structuredContent keeps the raw
      // numbers so the model can answer "how many?" without parsing the card.
      const kpis: KpiItem[] = [
        { label: "Products", value: products, format: "int" },
        { label: "Applications", value: applications, format: "int" },
        { label: "Leads", value: leads, format: "int" },
        { label: "Product↔application links", value: productApplications, format: "int" },
      ];
      const meta: KpiMeta = { title: "Database statistics", kpis };
      const steer =
        `[PRESENTATION] Statistics: ${products} products, ${applications} applications, ` +
        `${leads} leads, ${productApplications} product↔application links. ` +
        `The widget (KPI tiles) IS the answer — summarize briefly, do not build tables.`;

      const env = buildKpiEnvelope(meta, steer);
      // Surface the raw counts alongside the slim KPI summary for the model.
      (env.structuredContent as Record<string, unknown>).stats = stats;
      return env as any;
    }
  );

  // -------------------------------------------------------------------------
  // whoami — who am I, what may I do, and what is my book?
  // -------------------------------------------------------------------------
  server.tool(
    "whoami",
    [
      "whoami — identify the signed-in LC Connect user: id, email, display name,",
      "role, region competencies, and how many leads they own vs. created.",
      "ROLES: ADMIN may do everything, including delete_lead / delete_product /",
      "batch_update_leads and user administration (manage_users). RESEARCHER may also",
      "write shared company data — the product catalog, applications and the knowledge",
      "base. SALES may create and import leads, edit their own, and add notes anywhere.",
      "OWNERSHIP + COMPETENCY: everyone READS everything; a lead may be edited by its",
      "owner, its creator, an ADMIN, or — while it is unowned — by anyone whose region",
      "competency covers it. A user with NO regions listed here has GLOBAL competency.",
      "USE WHEN: the user asks who they are signed in as, what they are allowed to do,",
      "why a write was refused, or wants 'my leads' scoped correctly.",
      "DON'T USE WHEN: you need somebody ELSE's account -> manage_users (ADMIN only).",
      "RETURNS: { id, email, displayName, role, regions[{id,name,code}], counts:",
      "{ownedLeads, createdLeads} }.",
      "GOTCHAS: regions: [] means global competency, NOT 'no access'.",
    ].join("\n"),
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async () => {
      const me = await getCurrentUser();
      const row = await prisma.user.findUnique({
        where: { id: me.id },
        select: USER_SELECT,
      });
      if (!row) throw new Error(`User #${me.id} not found`);
      const u = shapeUser(row);
      return jsonOk({
        success: true,
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        regions: u.regions,
        competency: u.regions.length === 0 ? "global" : "regional",
        counts: { ownedLeads: u.ownedLeads, createdLeads: u.createdLeads },
      });
    }
  );

  // -------------------------------------------------------------------------
  // manage_users — ADMIN-only account administration.
  // -------------------------------------------------------------------------
  server.tool(
    "manage_users",
    [
      "manage_users — ADMIN-only user administration: list accounts, create one, set a",
      "role, set region competencies, deactivate/reactivate, or reset a password.",
      "USE WHEN: an admin asks to add a colleague, change someone's role, give someone",
      "a region, switch an account off, or reset a password. WRITE ACTION for every",
      "action except 'list' — confirm intent first.",
      "DON'T USE WHEN: the user only wants their own identity -> whoami; they want to",
      "change who owns a LEAD -> assign_lead.",
      "RETURNS: { success, action, user | users[] }. Password hashes are never",
      "returned by any action.",
      "GOTCHAS: identify the target with userId OR email. regionIds come from",
      "get_regions; an EMPTY regionIds array means GLOBAL competency (all regions),",
      "not 'no regions'. Passwords must be at least 10 characters. You cannot",
      "deactivate or demote your own account.",
    ].join("\n"),
    {
      action: z
        .enum([
          "list",
          "create",
          "set_role",
          "set_regions",
          "deactivate",
          "reactivate",
          "reset_password",
        ])
        .describe("What to do (required)."),
      userId: z
        .number()
        .optional()
        .describe("Target user ID (for every action except list/create)."),
      email: z
        .string()
        .optional()
        .describe("Target user's email — required for create, alternative to userId."),
      password: z
        .string()
        .optional()
        .describe("Password for create / reset_password (min 10 characters)."),
      role: z
        .enum(USER_ROLES)
        .optional()
        .describe("Role for create / set_role."),
      displayName: z.string().optional().describe("Human-readable name (create)."),
      regionIds: z
        .array(z.number())
        .optional()
        .describe(
          "Region IDs from get_regions (create / set_regions). Empty array = global competency."
        ),
      includeInactive: z
        .boolean()
        .optional()
        .default(false)
        .describe("list: include deactivated accounts. Defaults to false."),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (a) => {
      const me = await getCurrentUser();
      requireRole(me, "ADMIN");

      // Resolve the target account for the actions that need one.
      const findTarget = async () => {
        if (a.userId == null && !a.email) {
          throw new Error(`action "${a.action}" requires userId or email`);
        }
        const target = await prisma.user.findUnique({
          where: a.userId != null ? { id: a.userId } : { email: a.email as string },
          select: { id: true },
        });
        if (!target) {
          throw new Error(
            `User ${a.userId != null ? `#${a.userId}` : a.email} not found`
          );
        }
        return target.id;
      };

      const reload = async (id: number) => {
        invalidateCurrentUser(id);
        const row = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
        return shapeUser(row);
      };

      switch (a.action) {
        case "list": {
          const rows = await prisma.user.findMany({
            where: a.includeInactive ? {} : { isActive: true },
            orderBy: { id: "asc" },
            select: USER_SELECT,
          });
          return jsonOk({
            success: true,
            action: "list",
            count: rows.length,
            users: rows.map(shapeUser),
          });
        }

        case "create": {
          if (!a.email) throw new Error("create requires email");
          if (!a.password || a.password.length < 10) {
            throw new Error("create requires a password of at least 10 characters");
          }
          if (!a.role) throw new Error("create requires role (ADMIN, RESEARCHER or SALES)");
          const existing = await prisma.user.findUnique({
            where: { email: a.email },
            select: { id: true },
          });
          if (existing) {
            throw new Error(`A user with email ${a.email} already exists (ID ${existing.id})`);
          }
          const created = await prisma.user.create({
            data: {
              email: a.email,
              passwordHash: await bcrypt.hash(a.password, BCRYPT_COST),
              role: a.role,
              displayName: a.displayName ?? null,
              isActive: true,
              regions: a.regionIds?.length
                ? { create: a.regionIds.map((regionId) => ({ regionId })) }
                : undefined,
            },
            select: { id: true },
          });
          return jsonOk({
            success: true,
            action: "create",
            user: await reload(created.id),
          });
        }

        case "set_role": {
          if (!a.role) throw new Error("set_role requires role");
          const id = await findTarget();
          if (id === me.id && a.role !== "ADMIN") {
            throw new Error(
              "You cannot remove your own ADMIN role — ask another admin to do it."
            );
          }
          await prisma.user.update({ where: { id }, data: { role: a.role } });
          return jsonOk({ success: true, action: "set_role", user: await reload(id) });
        }

        case "set_regions": {
          if (!a.regionIds) {
            throw new Error(
              "set_regions requires regionIds (pass [] for global competency)"
            );
          }
          const id = await findTarget();
          const unique = [...new Set(a.regionIds)];
          if (unique.length > 0) {
            const found = await prisma.region.findMany({
              where: { id: { in: unique } },
              select: { id: true },
            });
            const missing = unique.filter((r) => !found.some((f) => f.id === r));
            if (missing.length) {
              throw new Error(`Unknown region ID(s): ${missing.join(", ")} — see get_regions`);
            }
          }
          await prisma.$transaction([
            prisma.userRegion.deleteMany({ where: { userId: id } }),
            ...(unique.length
              ? [
                  prisma.userRegion.createMany({
                    data: unique.map((regionId) => ({ userId: id, regionId })),
                  }),
                ]
              : []),
          ]);
          return jsonOk({ success: true, action: "set_regions", user: await reload(id) });
        }

        case "deactivate": {
          const id = await findTarget();
          if (id === me.id) {
            throw new Error("You cannot deactivate your own account.");
          }
          await prisma.user.update({ where: { id }, data: { isActive: false } });
          return jsonOk({ success: true, action: "deactivate", user: await reload(id) });
        }

        case "reactivate": {
          const id = await findTarget();
          await prisma.user.update({ where: { id }, data: { isActive: true } });
          return jsonOk({ success: true, action: "reactivate", user: await reload(id) });
        }

        case "reset_password": {
          if (!a.password || a.password.length < 10) {
            throw new Error("reset_password requires a password of at least 10 characters");
          }
          const id = await findTarget();
          await prisma.user.update({
            where: { id },
            data: {
              passwordHash: await bcrypt.hash(a.password, BCRYPT_COST),
              resetTokenHash: null,
              resetTokenExpiry: null,
            },
          });
          return jsonOk({
            success: true,
            action: "reset_password",
            user: await reload(id),
            note: "The new password was set. Share it out-of-band; it is not returned here.",
          });
        }
      }
    }
  );

  // -------------------------------------------------------------------------
  // CHUNK 2a domain tool sets.
  // -------------------------------------------------------------------------
  registerProductsTools(server, getTenantSub);
  registerApplicationsTools(server, getTenantSub);
  registerLeadsTools(server, getTenantSub);
  registerReportTools(server, getTenantSub);

  // -------------------------------------------------------------------------
  // CHUNK 2b domain tool sets.
  // -------------------------------------------------------------------------
  registerAiTools(server, getTenantSub);
  registerKnowledgeTools(server, getTenantSub);

  // -------------------------------------------------------------------------
  // CHUNK 2c — analytics widget card (leads_analytics).
  // -------------------------------------------------------------------------
  registerAnalyticsTools(server, getTenantSub);
}
