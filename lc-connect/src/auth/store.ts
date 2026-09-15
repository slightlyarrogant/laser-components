/**
 * OAuth state store — Postgres-backed.
 *
 * Replaces the in-memory Maps + JSON files under STATE_DIR that used to hold
 * the dynamic client registry, the authorization codes and the refresh tokens
 * (audit 2026-09-15 §1 M1, §4 "OAuth state"). Three problems went away with
 * them: the auth-code Map died on every restart, the JSON files were lost when
 * the repo was re-cloned, and `writeFileSync` sat on the request path of every
 * single login.
 *
 * Schema: db/migrations/2026-09-15-oauth-state.sql, mirrored in
 * prisma/schema.prisma (models OAuthClient / OAuthAuthCode / OAuthRefreshToken).
 *
 * Deliberately config-free: TTLs and the state directory are passed in by the
 * caller, so this module imports nothing but Prisma, node builtins and the
 * (environment-free) logger — its pure helpers stay unit-testable without an
 * environment.
 */

import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../db/client.js";
import { child, errMessage, errStack } from "../core/log.js";

const log = child({ mod: "oauth-store" });

// ---------------------------------------------------------------------------
// Pure helpers (no I/O — covered by tests/oauth-store.test.ts)
// ---------------------------------------------------------------------------

/**
 * sha256(token) in lowercase hex — the primary key of oauth_refresh_tokens.
 *
 * Refresh tokens are 30-day bearer credentials. Storing them verbatim would
 * make a read of that table (a backup, a `\copy`, a SQL-injection elsewhere)
 * directly replayable, so only the digest is persisted; the raw token exists
 * only in the response body that carried it to the client. The digest is
 * unsalted and unstretched on purpose: the input is a full-entropy UUIDv4, so
 * there is no dictionary to run, and the lookup must stay a single indexed
 * point read.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Absolute expiry `ttlSeconds` from `now` (ms epoch), as a Date for Postgres. */
export function expiresAtIn(ttlSeconds: number, now: number = Date.now()): Date {
  return new Date(now + ttlSeconds * 1000);
}

/**
 * Expiry test with the same strictness as the Map-based store it replaces:
 * a row is expired once `now` is strictly past `expiresAt`.
 */
export function isExpired(expiresAt: Date, now: number = Date.now()): boolean {
  return now > expiresAt.getTime();
}

/** An absolute http(s) URL — the only redirect target shape we register. */
export function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

// ---------------------------------------------------------------------------
// Types returned to the OAuth router
// ---------------------------------------------------------------------------

export interface StoredClient {
  clientId: string;
  redirectUris: string[];
  createdAt: Date;
}

/** Identity + binding recovered from a redeemed authorization code. */
export interface ConsumedAuthCode {
  sub: string;
  email: string;
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
}

/** Identity recovered from a redeemed (rotated) refresh token. */
export interface ConsumedRefreshToken {
  sub: string;
  email: string;
  clientId: string;
}

/** 30 days — unchanged from the JSON-file store. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Dynamic client registry (RFC 7591)
// ---------------------------------------------------------------------------

/** Registers a new client and returns its row. `clientId` is caller-generated. */
export async function registerClient(
  clientId: string,
  redirectUris: string[],
  clientName?: string
): Promise<StoredClient> {
  const row = await prisma.oAuthClient.create({
    data: {
      clientId,
      redirectUris,
      ...(clientName ? { clientName } : {}),
    },
  });
  return { clientId: row.clientId, redirectUris: row.redirectUris, createdAt: row.createdAt };
}

/** Looks up a registered client, or null when the client_id is unknown. */
export async function getClient(clientId: string): Promise<StoredClient | null> {
  const row = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!row) return null;
  return { clientId: row.clientId, redirectUris: row.redirectUris, createdAt: row.createdAt };
}

/**
 * Records that a client just completed a grant. Purely observational (it answers
 * "is this registration still in use?" when pruning), so it is fire-and-forget:
 * a failure here must never turn a successful token grant into an error.
 */
export function touchClient(clientId: string): void {
  void prisma.oAuthClient
    .update({ where: { clientId }, data: { lastUsedAt: new Date() } })
    .catch(() => {
      /* the client may have been deleted between the grant and this write */
    });
}

// ---------------------------------------------------------------------------
// Authorization codes — single-use, short-lived
// ---------------------------------------------------------------------------

/** Issues a code bound to the user, the client, the redirect_uri and the PKCE challenge. */
export async function createAuthCode(params: {
  userId: number;
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  ttlSeconds: number;
}): Promise<string> {
  const code = randomUUID();
  await prisma.oAuthAuthCode.create({
    data: {
      code,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge ?? null,
      // S256 is the only method we accept, so the stored method is a constant
      // rather than client-echoed input.
      codeChallengeMethod: params.codeChallenge ? "S256" : null,
      expiresAt: expiresAtIn(params.ttlSeconds),
    },
  });
  return code;
}

/**
 * Redeems a code exactly once.
 *
 * The DELETE is the concurrency control: Prisma's `delete` compiles to
 * `DELETE ... RETURNING`, so of two simultaneous redemptions of the same code
 * exactly one gets a row and the other gets P2025. An expired code is still
 * deleted (matching the old Map behaviour) but yields null.
 *
 * Returns null for: unknown code, already-redeemed code, expired code, or a
 * user row that has since disappeared.
 */
export async function consumeAuthCode(code: string): Promise<ConsumedAuthCode | null> {
  let row;
  try {
    row = await prisma.oAuthAuthCode.delete({ where: { code } });
  } catch {
    return null; // unknown or already consumed
  }
  if (isExpired(row.expiresAt)) return null;

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { id: true, email: true },
  });
  if (!user) return null;

  return {
    sub: String(user.id),
    email: user.email,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    ...(row.codeChallenge ? { codeChallenge: row.codeChallenge } : {}),
  };
}

// ---------------------------------------------------------------------------
// Refresh tokens — 30 days, single-use, rotating
// ---------------------------------------------------------------------------

/** Mints a refresh token, persisting only its sha256 digest. */
export async function issueRefreshToken(
  userId: number,
  clientId: string,
  ttlSeconds: number = REFRESH_TOKEN_TTL_SECONDS
): Promise<string> {
  const token = randomUUID();
  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash: hashToken(token),
      clientId,
      userId,
      expiresAt: expiresAtIn(ttlSeconds),
    },
  });
  return token;
}

/**
 * Redeems a refresh token exactly once (rotation).
 *
 * The conditional UPDATE (`used_at IS NULL` → `used_at = now()`) is the
 * concurrency control: it reports how many rows it changed, so the second
 * caller to arrive with the same token changes nothing and is refused. The row
 * is marked rather than deleted so a replay stays distinguishable from an
 * unknown token until the sweeper collects it at expiry.
 *
 * Returns null for: unknown token, already-rotated token, expired token, or a
 * user row that has since disappeared.
 */
export async function consumeRefreshToken(token: string): Promise<ConsumedRefreshToken | null> {
  const tokenHash = hashToken(token);

  const claimed = await prisma.oAuthRefreshToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash } });
  if (!row) return null; // swept between the claim and the read — it was expired
  if (isExpired(row.expiresAt)) return null;

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { id: true, email: true },
  });
  if (!user) return null;

  return { sub: String(user.id), email: user.email, clientId: row.clientId };
}

// ---------------------------------------------------------------------------
// Sweeper
// ---------------------------------------------------------------------------

/**
 * Deletes expired codes and tokens. Both DELETEs hit the `expires_at` indexes
 * created by the migration.
 */
export async function sweepExpired(): Promise<{ codes: number; tokens: number }> {
  const now = new Date();
  const [codes, tokens] = await Promise.all([
    prisma.oAuthAuthCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.oAuthRefreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { codes: codes.count, tokens: tokens.count };
}

const SWEEP_INTERVAL_MS = 5 * 60_000;
let sweepTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Starts the one sweeper this process needs. Idempotent, and unref'd so it
 * never keeps the event loop (or a test run) alive. Two separate intervals
 * used to do this on the Maps; one query pair every five minutes replaces them.
 */
export function startOAuthStateSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    void sweepExpired()
      .then(({ codes, tokens }) => {
        if (codes || tokens) {
          log.info({ evt: "oauth-sweep", codes, tokens });
        }
      })
      .catch((err) => {
        log.error({ evt: "oauth-sweep", err: errMessage(err) });
      });
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

// ---------------------------------------------------------------------------
// One-time import of the legacy STATE_DIR JSON files
// ---------------------------------------------------------------------------

/** Legacy on-disk shape: JSON array of [client_id, {redirectUris, createdAt}]. */
function parseLegacyClients(raw: string): Array<{ clientId: string; redirectUris: string[] }> {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const out: Array<{ clientId: string; redirectUris: string[] }> = [];
  for (const item of parsed) {
    // Older still: a bare array of client_id strings with no redirect URIs.
    // Such a client imports with an empty allow-list, so /authorize refuses it
    // until the connector re-registers — the intended protection, not a bug.
    if (typeof item === "string") {
      out.push({ clientId: item, redirectUris: [] });
      continue;
    }
    if (Array.isArray(item) && typeof item[0] === "string") {
      const meta = item[1] as { redirectUris?: unknown } | undefined;
      out.push({
        clientId: item[0],
        redirectUris: Array.isArray(meta?.redirectUris)
          ? meta.redirectUris.filter(isAbsoluteHttpUrl)
          : [],
      });
    }
  }
  return out;
}

/** Legacy on-disk shape: JSON array of [rawToken, {sub, email, clientId, expiresAt}]. */
function parseLegacyRefreshTokens(
  raw: string
): Array<{ token: string; userId: number; clientId: string; expiresAt: Date }> {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const out: Array<{ token: string; userId: number; clientId: string; expiresAt: Date }> = [];
  for (const item of parsed) {
    if (!Array.isArray(item) || typeof item[0] !== "string") continue;
    const meta = item[1] as
      | { sub?: unknown; clientId?: unknown; expiresAt?: unknown }
      | undefined;
    const userId = Number(meta?.sub);
    if (!Number.isInteger(userId) || userId <= 0) continue;
    if (typeof meta?.clientId !== "string" || typeof meta?.expiresAt !== "number") continue;
    out.push({
      token: item[0],
      userId,
      clientId: meta.clientId,
      expiresAt: new Date(meta.expiresAt),
    });
  }
  return out;
}

async function importLegacyFile(
  filePath: string,
  importRows: (raw: string) => Promise<string>
): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return; // absent — the normal case after the first start
  }
  let summary: string;
  try {
    summary = await importRows(raw);
  } catch (err) {
    log.error({
      evt: "oauth-legacy-import",
      phase: "failed",
      file: filePath,
      note: "file left in place",
      err: errMessage(err),
    });
    log.debug({ evt: "oauth-legacy-import", file: filePath, stack: errStack(err) });
    return;
  }
  // Renamed only after a successful import, so a crash mid-import leaves the
  // file to be retried on the next start rather than silently dropping state.
  try {
    fs.renameSync(filePath, `${filePath}.imported`);
  } catch (err) {
    log.error({
      evt: "oauth-legacy-import",
      phase: "rename-failed",
      file: filePath,
      err: errMessage(err),
    });
  }
  log.info({ evt: "oauth-legacy-import", phase: "imported", file: filePath, summary });
}

/**
 * Migrates `STATE_DIR/dynamic_clients.json` and `STATE_DIR/refresh_tokens.json`
 * into Postgres once, then renames both to `*.imported`.
 *
 * Called at startup. Existing rows win (the DB is the source of truth from here
 * on), expired and orphaned refresh tokens are dropped, and raw tokens on disk
 * are hashed on the way in — the legacy file stored them verbatim.
 */
export async function importLegacyOAuthState(stateDir: string): Promise<void> {
  await importLegacyFile(`${stateDir}/dynamic_clients.json`, async (raw) => {
    const clients = parseLegacyClients(raw);
    let imported = 0;
    let skipped = 0;
    for (const c of clients) {
      const existing = await prisma.oAuthClient.findUnique({ where: { clientId: c.clientId } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.oAuthClient.create({
        data: { clientId: c.clientId, redirectUris: c.redirectUris },
      });
      imported++;
    }
    return `${imported} client(s) imported, ${skipped} already present`;
  });

  await importLegacyFile(`${stateDir}/refresh_tokens.json`, async (raw) => {
    const tokens = parseLegacyRefreshTokens(raw);
    const now = Date.now();
    let imported = 0;
    let skipped = 0;
    for (const t of tokens) {
      if (isExpired(t.expiresAt, now)) {
        skipped++;
        continue;
      }
      try {
        // The legacy file holds the RAW token; only its digest goes in.
        await prisma.oAuthRefreshToken.create({
          data: {
            tokenHash: hashToken(t.token),
            clientId: t.clientId,
            userId: t.userId,
            expiresAt: t.expiresAt,
          },
        });
        imported++;
      } catch {
        // Already imported (duplicate hash) or the user row is gone (FK).
        skipped++;
      }
    }
    return `${imported} refresh token(s) imported, ${skipped} skipped (expired/duplicate/orphaned)`;
  });
}
