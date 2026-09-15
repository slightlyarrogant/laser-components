import { createHash } from "node:crypto";
import { pino, stdTimeFunctions, type Logger, type LoggerOptions } from "pino";
import { VERSION } from "../version.js";

// ---------------------------------------------------------------------------
// Structured logging for LC Connect.
//
// One JSON object per line on stdout. systemd already appends this process's
// stdout to server.log (logrotate copytruncate weekly), so there is deliberately
// NO file transport and NO pino-pretty here: a transport would fork a worker
// thread whose output systemd does not own, and pretty-printing would destroy
// the only property that makes the log greppable in production.
//
// Shape mirrors VendoConnect's src/logger.ts (pino JSON + redaction + a tenant
// mixin), adapted to LC's AsyncLocalStorage and secret names.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tenant binding
//
// The tenant sub lives in an AsyncLocalStorage owned by src/server.ts, which in
// turn pulls in the whole tool tree (and therefore src/config.ts, which throws
// without a valid environment). Importing it here would make the logger
// unusable in a unit test and would close an import cycle (server.ts needs the
// logger for the tool-call ledger).
//
// So the direction is inverted: server.ts REGISTERS its reader at module init.
// Until it does, the mixin simply contributes nothing, which is the correct
// answer for anything logged outside a request anyway.
// ---------------------------------------------------------------------------

type TenantReader = () => string | undefined;

let readTenant: TenantReader = () => undefined;

/**
 * Point the logger's `userId` mixin at a tenant-context reader. Called once by
 * src/server.ts with `() => tenantContext.getStore()`.
 */
export function bindTenantReader(reader: TenantReader): void {
  readTenant = reader;
}

/** Current tenant sub, or undefined outside a request context. Never throws. */
export function currentUserId(): string | undefined {
  try {
    return readTenant();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Redaction
//
// A NARROW BACKSTOP for credentials that legitimately sit near the top of a
// logged object (an auth header, an OAuth form body, a config echo). It is NOT
// what keeps lead PII out of the log — pino's `redact` takes literal paths, so
// it cannot reach arbitrary depth, and it is blind to anything already
// serialised into a message string.
//
// The actual invariant is upstream: call sites log SHAPE (key names, counts,
// ids), never row values. The tool-call ledger logs `argsKeys`, never argument
// values, for exactly this reason. Do not "fix" a leak by adding a key here.
// ---------------------------------------------------------------------------

const SECRET_KEYS = [
  "password",
  "passwordHash",
  "authorization",
  "access_token",
  "refresh_token",
  "code_verifier",
  "code",
  "client_secret",
  "LC_JWT_SECRET",
  "PERPLEXITY_API_KEY",
];

export const REDACT_PATHS = [
  ...SECRET_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
  // Header bags, wherever they hang: `{ req: { headers: { authorization } } }`
  // is the shape Hono/node produce, and `*.headers.authorization` covers the
  // same bag nested under any other single key.
  "req.headers.authorization",
  "*.headers.authorization",
  "headers.authorization",
];

/**
 * The exact options the process logger is built from.
 *
 * Exported as a factory rather than inlined so a test can build a logger with
 * the SAME redaction paths and the SAME mixin over a capture stream. pino's
 * default destination writes to fd 1 through sonic-boom, bypassing
 * `process.stdout.write`, so there is no way to observe the real logger's
 * output in-process — and a redaction rule that is only asserted against a
 * hand-copied path list is a rule that silently stops matching the day someone
 * edits one and not the other.
 */
export function loggerOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "lc-connect", version: VERSION },
    // ISO-8601 rather than epoch millis: this log is read by humans with `jq`
    // and correlated against systemd timestamps far more often than it is
    // machine-aggregated, and the cost is one Date#toISOString per line.
    timestamp: stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    // Stamps the authenticated user onto every line emitted inside a request.
    // Read at log time (not bound at call sites) so no signature changes.
    mixin() {
      const userId = currentUserId();
      return userId ? { userId } : {};
    },
  };
}

export const log: Logger = pino(loggerOptions());

/** A child logger with fixed bindings, e.g. `child({ mod: "oauth" })`. */
export function child(bindings: Record<string, unknown>): Logger {
  return log.child(bindings);
}

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

/**
 * A stable, non-reversible handle for an identifier that must be correlatable
 * across lines but must not appear verbatim (an OAuth client_id is a live
 * credential-ish value: with a matching redirect_uri it is enough to start a
 * flow). 12 hex chars of SHA-256 — collision-free at this cardinality.
 */
export function hashId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/**
 * The error message alone — never the stack, which belongs at `debug`.
 * Accepts the `unknown` that a catch block actually yields.
 */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The stack when there is one, for `debug`-level lines only. */
export function errStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}
