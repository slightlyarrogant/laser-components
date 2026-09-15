/**
 * access.ts — the LC Connect authorization rules, as PURE functions.
 *
 * No database, no Prisma, no I/O: every decision is taken from an `Actor`
 * (resolved once per request by src/core/current-user.ts) plus the handful of
 * lead columns that matter. That keeps the rules unit-testable without a DB
 * (tests/access.test.ts) and keeps a single place to reason about "who may
 * write what".
 *
 * The model, in one paragraph:
 *   Visibility is OPEN — every active user reads everything. WRITES are
 *   governed by three things, checked in this order: role (ADMIN may do
 *   anything), personal attachment (you may edit a lead you own or created),
 *   and region competency (an UNOWNED lead may be edited by anyone whose
 *   competency covers its region; a user with NO regions assigned has GLOBAL
 *   competency). A lead that somebody else already owns is off-limits to
 *   everyone but its owner, its creator, and an ADMIN.
 */

export type Role = "ADMIN" | "RESEARCHER" | "SALES";

/**
 * The authenticated user, reduced to exactly what the rules need.
 * `regionIds` empty === GLOBAL competency (not "no competency").
 */
export type Actor = {
  id: number;
  role: Role;
  regionIds: number[];
};

/**
 * The lead columns the rules read. `countryRegionId` is the region reached
 * through the lead's country (leads.country.region_id) — used as a fallback
 * when the lead carries no direct region_id, which today is the common case
 * (region_id is populated on 0 of 396 live leads).
 */
export type LeadAccessFields = {
  ownerUserId?: number | null;
  createdByUserId?: number | null;
  regionId?: number | null;
  countryRegionId?: number | null;
};

export function isAdmin(actor: Actor): boolean {
  return actor.role === "ADMIN";
}

/**
 * Throws unless the actor holds one of `roles`. Message is deliberately short
 * and stable ("Requires role ADMIN") so the model can relay it verbatim.
 */
export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (roles.length === 0) return;
  if (roles.includes(actor.role)) return;
  throw new Error(
    `Requires role ${roles.join(" or ")} — you are ${actor.role}.`
  );
}

/**
 * The effective region of a lead: its own region, else its country's region,
 * else null (geography unknown).
 */
export function leadRegionId(lead: LeadAccessFields): number | null {
  return lead.regionId ?? lead.countryRegionId ?? null;
}

/**
 * True when `actor` may write to `lead`.
 *
 *   ADMIN                                  -> always
 *   actor is the lead's owner               -> yes
 *   actor created the lead                  -> yes
 *   lead has NO owner and:
 *       actor has no regions (global)       -> yes
 *       lead's region ∈ actor.regionIds     -> yes
 *   otherwise                               -> no
 *
 * A lead whose geography is unknown (no region, no country) can be claimed by
 * any competent user, regional or global. Decision 2026-09-15: internal
 * single company, open visibility; falling closed would block regional users
 * on the ~97% of leads that have no geography yet.
 */
export function canEditLead(actor: Actor, lead: LeadAccessFields): boolean {
  if (isAdmin(actor)) return true;
  if (lead.ownerUserId != null && lead.ownerUserId === actor.id) return true;
  if (lead.createdByUserId != null && lead.createdByUserId === actor.id) return true;

  // Somebody else owns it -> hands off (owner/creator/admin already returned).
  if (lead.ownerUserId != null) return false;

  // Unowned: competency decides.
  if (actor.regionIds.length === 0) return true; // global competency
  const region = leadRegionId(lead);
  // Unknown geography (no region, no country) falls OPEN: this is one company,
  // and 386/396 leads have no geography yet — blocking regional users on them
  // would be worse than an occasional out-of-region edit.
  return region == null || actor.regionIds.includes(region);
}

/**
 * Human-readable refusal used by the write tools, so the model can explain
 * WHY rather than just failing.
 */
export function editRefusalMessage(lead: LeadAccessFields): string {
  if (lead.ownerUserId != null) {
    return `You can't edit this lead (owned by user ${lead.ownerUserId}). Ask that owner, or an ADMIN, to reassign it with assign_lead.`;
  }
  return "You can't edit this lead: it is unowned but lies outside your region competency. Ask an ADMIN to assign it to you (assign_lead) or to widen your regions (manage_users).";
}
