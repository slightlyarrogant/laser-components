/**
 * audit.ts — the LC Connect audit trail.
 *
 * Every WRITE tool (and every refusal of a destructive one) leaves exactly one
 * row in `activity_logs` (Prisma model ActivityLog). The table already existed
 * in the live schema but nothing wrote to it; this module is the single writer.
 *
 * Three rules govern this file:
 *
 *  1. AUDITING NEVER BREAKS A TOOL. `audit()` catches everything — a failed
 *     insert, an unauthenticated caller, a serialization surprise — logs to
 *     stderr and resolves. A tool call must never fail because the trail did.
 *
 *  2. AUDITING NEVER BLOCKS. It is one INSERT, awaited. No batching, no queue,
 *     no retry: a lost row is cheaper than a stalled tool.
 *
 *  3. `details` STAYS SMALL AND CLEAN. Everything written goes through
 *     `sanitizeDetails()`: secrets are redacted by key name, long free text is
 *     truncated at 500 characters, arrays are capped at 500 elements, nesting
 *     is capped, and the whole blob is capped by serialized size. `details` is
 *     a forensic breadcrumb, not a copy of the row.
 *
 * `ipAddress` / `userAgent` stay NULL: the transport only puts the tenant sub
 * into AsyncLocalStorage, so there is no request object to read them from here.
 * The columns are left for a later transport-level change.
 *
 * The shaping helpers below are PURE and unit-tested in tests/audit.test.ts.
 */

import { prisma } from "../db/client.js";
import { getCurrentUser } from "./current-user.js";

/** The object kinds LC Connect audits. Mapped to `activity_logs.resource_type`. */
export type AuditResourceType =
  | "lead"
  | "note"
  | "product"
  | "application"
  | "product_application"
  | "resource"
  | "learning"
  | "user"
  | "issue";

export type AuditEntry = {
  /** `<resource>.<verb>`, e.g. "lead.created", "user.role_changed". */
  action: string;
  resourceType: AuditResourceType;
  resourceId?: string | number | null;
  details?: Record<string, unknown>;
};

/** Free text longer than this is truncated (plus a "…" marker). */
export const MAX_STRING_LENGTH = 500;
/** Id lists / arrays are capped at this many elements. */
export const MAX_LIST_LENGTH = 500;
/** How deep `details` may nest before the subtree is replaced by a marker. */
export const MAX_DEPTH = 5;
/** Hard ceiling on the serialized `details` blob. */
export const MAX_DETAILS_BYTES = 16_000;

/** Marker substituted for anything stripped by the sanitizer. */
export const REDACTED = "[redacted]";

/**
 * Keys whose VALUE is never stored, matched case-insensitively on the whole
 * key. Deliberately broad: a password, its bcrypt hash, a reset-token hash and
 * an API key are all things an audit row must be able to reference by NAME
 * ("password was reset") without ever carrying the secret itself.
 */
const SENSITIVE_KEY = /(password|passwordhash|hash|secret|token|salt|apikey|api_key|authorization|credential)/i;

/** True for `{}`-shaped objects (not Date, Decimal, Buffer, class instances…). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Truncates `s` to `max` characters, appending "…" when anything was cut.
 * Returns the input unchanged when it already fits.
 */
export function truncate(s: string, max: number = MAX_STRING_LENGTH): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/**
 * Caps an id list at `max` entries.
 * Returns the (possibly shortened) list plus how many were dropped, so a batch
 * row records "500 of 1200" rather than silently lying about its scope.
 */
export function capIdList<T>(
  ids: readonly T[],
  max: number = MAX_LIST_LENGTH
): { ids: T[]; count: number; omitted: number } {
  const kept = ids.length > max ? ids.slice(0, max) : [...ids];
  return { ids: kept, count: ids.length, omitted: Math.max(0, ids.length - max) };
}

/**
 * Recursively normalizes one value for JSON storage:
 *   - secrets (by key name, handled by the caller) never reach here
 *   - strings truncated at MAX_STRING_LENGTH
 *   - Date -> ISO string; Decimal/BigInt/other non-plain objects -> String()
 *   - arrays capped at MAX_LIST_LENGTH (with a trailing "…N more" marker)
 *   - nesting capped at MAX_DEPTH
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
    case "string":
      return truncate(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "function":
    case "symbol":
      return REDACTED;
  }

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[array(${value.length})]`;
    const head = value.slice(0, MAX_LIST_LENGTH).map((v) => sanitizeValue(v, depth + 1));
    if (value.length > MAX_LIST_LENGTH) {
      head.push(`…${value.length - MAX_LIST_LENGTH} more`);
    }
    return head;
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_DEPTH) return "[object]";
    return sanitizeObject(value, depth + 1);
  }

  // Prisma Decimal, Buffer, class instances: keep a readable scalar, never the
  // internal shape (a Decimal serializes to {s,e,d} otherwise).
  try {
    return truncate(String(value));
  } catch {
    return REDACTED;
  }
}

function sanitizeObject(
  obj: Record<string, unknown>,
  depth: number
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(value, depth);
  }
  return out;
}

/**
 * Shapes an arbitrary details object into something safe and small enough to
 * store: redacts secrets by key name, truncates long text, caps lists and
 * nesting, then enforces a hard ceiling on the serialized size.
 *
 * PURE — this is the function tests/audit.test.ts exercises.
 */
export function sanitizeDetails(
  details: Record<string, unknown> | undefined | null
): Record<string, unknown> | null {
  if (!details) return null;

  let shaped: Record<string, unknown>;
  try {
    shaped = sanitizeObject(details, 0);
  } catch (err) {
    return { _error: "details could not be serialized", _reason: truncate(String(err), 200) };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(shaped);
  } catch {
    return { _error: "details could not be serialized" };
  }

  if (serialized.length <= MAX_DETAILS_BYTES) return shaped;

  // Over the ceiling: keep the top-level keys (they name what happened) and
  // drop the payload rather than storing a giant blob.
  return {
    _truncated: true,
    _bytes: serialized.length,
    keys: Object.keys(shaped).slice(0, MAX_LIST_LENGTH),
  };
}

/**
 * Builds the `{ before, after }` pair for an update, keeping ONLY the fields
 * that actually changed. `after` is the update payload the tool is about to
 * apply (or applied); `before` is the row as it was.
 *
 * Values are compared on their sanitized JSON form, so a Decimal that did not
 * move does not register as a change, and an unchanged tag array does not
 * either.
 *
 * PURE — unit-tested.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { before: Record<string, unknown>; after: Record<string, unknown>; changed: string[] } {
  const prev = before ?? {};
  const next = after ?? {};

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const changed: string[] = [];

  for (const key of Object.keys(next)) {
    const nextValue = next[key];
    if (nextValue === undefined) continue;

    const a = sanitizeValue(prev[key], 1);
    const b = sanitizeValue(nextValue, 1);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;

    changed.push(key);
    changedBefore[key] = SENSITIVE_KEY.test(key) ? REDACTED : a;
    changedAfter[key] = SENSITIVE_KEY.test(key) ? REDACTED : b;
  }

  return { before: changedBefore, after: changedAfter, changed };
}

/** Normalizes a resource id to the TEXT column `activity_logs.resource_id`. */
export function normalizeResourceId(
  id: string | number | null | undefined
): string | null {
  if (id === null || id === undefined) return null;
  const s = String(id);
  return s.length === 0 ? null : truncate(s, 200);
}

// ---------------------------------------------------------------------------
// READ SIDE — shared by get_audit_log (src/tools/index.ts) and the merged
// get_activity_feed (src/tools/ai.ts), so both answer the same filters the
// same way.
// ---------------------------------------------------------------------------

export const AUDIT_DEFAULT_LIMIT = 50;
export const AUDIT_MAX_LIMIT = 500;

export type AuditFilters = {
  /** Only this actor. */
  userId?: number | null;
  /** PREFIX match on the action, e.g. "lead." or "user.role". */
  action?: string | null;
  resourceType?: string | null;
  /** ISO date/datetime; only entries at or after it. */
  since?: string | null;
  limit?: number | null;
};

export type AuditFeedRow = {
  id: number;
  timestamp: Date;
  userId: number;
  actor: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  details: unknown;
};

/** Clamps a requested limit into [1, AUDIT_MAX_LIMIT]. PURE. */
export function normalizeAuditLimit(limit?: number | null): number {
  if (limit == null || !Number.isFinite(limit)) return AUDIT_DEFAULT_LIMIT;
  const n = Math.floor(limit);
  if (n < 1) return 1;
  return Math.min(n, AUDIT_MAX_LIMIT);
}

/**
 * Parses the `since` filter. Returns null when absent; throws a message the
 * model can relay when the string is not a date. PURE.
 */
export function parseSince(since?: string | null): Date | null {
  if (!since) return null;
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) {
    throw new Error(
      `since "${since}" is not a valid ISO date — use e.g. 2026-09-01 or 2026-09-01T00:00:00Z.`
    );
  }
  return d;
}

/**
 * Builds the Prisma `where` for an ActivityLog query from the shared filters.
 * PURE (plain object in, plain object out) — unit-tested.
 */
export function buildAuditWhere(filters: AuditFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.userId != null) where.userId = filters.userId;
  if (filters.action) where.action = { startsWith: filters.action };
  if (filters.resourceType) where.resource_type = filters.resourceType;
  const since = parseSince(filters.since);
  if (since) where.timestamp = { gte: since };
  return where;
}

/** Ceiling on the one-line `summary` rendered from a details blob. */
const SUMMARY_MAX = 240;

/**
 * Renders a details blob as ONE short human line: `before`/`after` pairs
 * become "status: NEW→QUALIFIED", everything else becomes "key=value".
 * PURE — unit-tested.
 */
export function compactDetails(details: unknown): string {
  if (details === null || details === undefined) return "";
  if (typeof details !== "object") return truncate(String(details), SUMMARY_MAX);

  const d = details as Record<string, unknown>;
  const parts: string[] = [];

  const before = isPlainObject(d.before) ? d.before : null;
  const after = isPlainObject(d.after) ? d.after : null;
  if (before || after) {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    for (const k of keys) {
      parts.push(`${k}: ${scalar(before?.[k])}→${scalar(after?.[k])}`);
    }
  }

  for (const [k, v] of Object.entries(d)) {
    if (k === "before" || k === "after") continue;
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      parts.push(`${k}=[${v.length}]`);
    } else if (isPlainObject(v)) {
      parts.push(`${k}={${Object.keys(v).length}}`);
    } else {
      parts.push(`${k}=${scalar(v)}`);
    }
  }

  return truncate(parts.join(", "), SUMMARY_MAX);
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "string") return truncate(v, 60);
  if (Array.isArray(v)) return `[${v.length}]`;
  if (isPlainObject(v)) return "{…}";
  return truncate(String(v), 60);
}

/**
 * Reads ActivityLog rows (newest first) with the shared filters, joined to the
 * actor so the feed can show a human rather than a user id.
 */
export async function queryAuditLog(filters: AuditFilters): Promise<AuditFeedRow[]> {
  const rows = await prisma.activityLog.findMany({
    where: buildAuditWhere(filters) as any,
    orderBy: { timestamp: "desc" },
    take: normalizeAuditLimit(filters.limit),
    select: {
      id: true,
      timestamp: true,
      userId: true,
      action: true,
      resource_type: true,
      resource_id: true,
      details: true,
      user: { select: { email: true, displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    userId: r.userId,
    actor: r.user?.displayName || r.user?.email || `user #${r.userId}`,
    actorEmail: r.user?.email ?? "",
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id ?? null,
    summary: compactDetails(r.details),
    details: r.details ?? null,
  }));
}

/**
 * Writes ONE audit row. Resolves the actor from the request's access token.
 *
 * NEVER throws and never rejects: every failure path is caught and logged to
 * stderr. Callers `await` it (it is a single insert) but do not guard it.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const me = await getCurrentUser();
    await prisma.activityLog.create({
      data: {
        userId: me.id,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: normalizeResourceId(entry.resourceId),
        details: (sanitizeDetails(entry.details) ?? undefined) as any,
      },
      select: { id: true },
    });
  } catch (err) {
    // Deliberately swallowed: the audit trail is best-effort relative to the
    // tool call it describes. A dropped row is visible here, in the server log.
    console.error(
      `[audit] failed to record "${entry.action}" on ${entry.resourceType}:`,
      err
    );
  }
}
