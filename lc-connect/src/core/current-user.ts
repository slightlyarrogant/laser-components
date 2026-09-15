/**
 * current-user.ts — resolves the authenticated user behind the current MCP
 * request into a full profile (role + region competency), with a short cache.
 *
 * The transport layer puts `String(user.id)` into AsyncLocalStorage (see
 * src/server.ts, getTenantSub). Everything above that wants a *user*, not a
 * string: role, activation state, and which regions the user is competent for.
 * That is one small query, but it runs on EVERY tool call, so the result is
 * cached for 60 s keyed by user id.
 *
 * Cache invalidation is deliberately crude: a 60 s TTL plus an explicit
 * `invalidateCurrentUser(id)` called by manage_users after it changes a role,
 * a region set, or an activation flag. A role change therefore takes effect
 * immediately for the admin who made it, and within a minute everywhere else.
 */

import { prisma } from "../db/client.js";
import { getTenantSub } from "../server.js";
import type { Actor, Role } from "./access.js";

export type CurrentUser = Actor & {
  email: string;
  isActive: boolean;
  displayName: string | null;
};

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 1000;

type CacheEntry = { user: CurrentUser; expiresAt: number };

const cache = new Map<number, CacheEntry>();

/** Drops every expired entry. Cheap: the map is bounded at CACHE_MAX_ENTRIES. */
function sweep(): void {
  const now = Date.now();
  for (const [id, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(id);
  }
}

// Unref'd so this timer never keeps the process (or a test run) alive.
const sweepTimer = setInterval(sweep, CACHE_TTL_MS);
sweepTimer.unref?.();

function cacheSet(user: CurrentUser): void {
  // Bound the map. Map iteration is insertion-ordered, so the first key is the
  // oldest insertion — evict it once we are at the ceiling.
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(user.id)) {
    sweep();
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
  }
  cache.set(user.id, { user, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Forget a cached profile (call after changing role / regions / activation). */
export function invalidateCurrentUser(userId?: number): void {
  if (userId == null) cache.clear();
  else cache.delete(userId);
}

/**
 * Loads the user identified by the request's tenant sub.
 *
 * Throws a message the model can relay verbatim when the sub is not a number,
 * the user no longer exists, or the account has been deactivated.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const sub = getTenantSub();
  const id = Number(sub);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      `Authentication problem: the access token's subject ("${sub}") is not a user id. Sign in to LC Connect again.`
    );
  }

  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const row = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      displayName: true,
      regions: { select: { regionId: true } },
    },
  });

  if (!row) {
    cache.delete(id);
    throw new Error(
      `Authentication problem: user #${id} from the access token no longer exists. Ask an administrator to re-create the account.`
    );
  }
  if (!row.isActive) {
    cache.delete(id);
    throw new Error(
      `Your LC Connect account (${row.email}) is deactivated, so no data can be read or written. Ask an administrator to reactivate it (manage_users, action "reactivate").`
    );
  }

  const user: CurrentUser = {
    id: row.id,
    email: row.email,
    role: row.role as Role,
    isActive: row.isActive,
    displayName: row.displayName,
    regionIds: row.regions.map((r) => r.regionId).sort((a, b) => a - b),
  };
  cacheSet(user);
  return user;
}
