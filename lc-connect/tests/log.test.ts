/**
 * Unit tests for the structured logger (src/core/log.ts).
 *
 * Run with:  npx tsx --test tests/log.test.ts
 *
 * Two properties are worth pinning down, because both fail SILENTLY — a broken
 * one produces a log that still looks perfectly healthy:
 *
 *   - REDACTION. A credential that stops being censored does not throw, does not
 *     warn, and does not change the shape of a line. The only way anyone finds
 *     out is by reading server.log after it has already been written, copied by
 *     the nightly backup, and shipped to the NAS.
 *   - THE TENANT MIXIN. A `userId` that silently stops being stamped turns the
 *     whole log from "who did this" into "something happened", and a `userId`
 *     that leaks OUT of its request context is worse than none: it attributes
 *     one user's actions to whoever ran last.
 *
 * Both are asserted against the REAL configuration — `loggerOptions()` is the
 * exact object `log` is built from — rather than a hand-copied path list, which
 * would go stale the first time someone edits one and not the other. The one
 * thing the test substitutes is the destination: pino's default writes to fd 1
 * through sonic-boom, bypassing `process.stdout.write`, so its output cannot be
 * observed in-process.
 *
 * Environment-free: src/core/log.ts imports only pino, node builtins and
 * src/version.ts (which reads package.json), so no .env is needed here.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { Writable } from "node:stream";
import { pino } from "pino";

import { bindTenantReader, loggerOptions, REDACT_PATHS } from "../src/core/log.js";

/** A logger with the production options, writing parsed lines into `lines`. */
function captureLogger(): { lines: Record<string, unknown>[]; logger: ReturnType<typeof pino> } {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      for (const raw of String(chunk).split("\n")) {
        if (raw.trim()) lines.push(JSON.parse(raw) as Record<string, unknown>);
      }
      cb();
    },
  });
  // `level: "trace"` only widens what reaches the stream; every other option —
  // redact, mixin, base, timestamp — is production's.
  return { lines, logger: pino({ ...loggerOptions(), level: "trace" }, stream) };
}

const CENSOR = "[REDACTED]";

// Every key the spec requires to be censored, with a value distinctive enough
// that a substring search over the serialized line is conclusive.
const SECRETS: Record<string, string> = {
  password: "hunter2-plaintext-password",
  passwordHash: "$2a$12$ZZZZbcryptdigestZZZZ",
  authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.leaked",
  access_token: "at-000-leaked-access-token",
  refresh_token: "rt-000-leaked-refresh-token",
  code_verifier: "cv-000-leaked-code-verifier",
  code: "ac-000-leaked-auth-code",
  client_secret: "cs-000-leaked-client-secret",
  LC_JWT_SECRET: "jwt-000-leaked-signing-secret",
  PERPLEXITY_API_KEY: "pplx-000-leaked-api-key",
};

test("redaction censors every listed secret key at the top level", () => {
  const { lines, logger } = captureLogger();
  logger.info({ evt: "test", ...SECRETS });

  assert.equal(lines.length, 1);
  const line = lines[0]!;
  const serialized = JSON.stringify(line);

  for (const [key, value] of Object.entries(SECRETS)) {
    assert.equal(line[key], CENSOR, `${key} was not censored`);
    assert.ok(
      !serialized.includes(value),
      `the value of ${key} survived into the serialized line`
    );
  }
});

test("redaction reaches secrets nested one and two levels down", () => {
  const { lines, logger } = captureLogger();
  logger.info({
    evt: "test",
    body: { password: SECRETS.password, code: SECRETS.code },
    oauth: { client: { client_secret: SECRETS.client_secret } },
  });

  const line = lines[0]!;
  const body = line.body as Record<string, unknown>;
  const oauth = line.oauth as { client: Record<string, unknown> };

  assert.equal(body.password, CENSOR);
  assert.equal(body.code, CENSOR);
  assert.equal(oauth.client.client_secret, CENSOR);
  assert.ok(!JSON.stringify(line).includes(SECRETS.password!));
});

test("redaction censors an Authorization header in every header-bag shape", () => {
  const { lines, logger } = captureLogger();
  const header = SECRETS.authorization!;

  logger.info({ evt: "test", req: { headers: { authorization: header } } });
  logger.info({ evt: "test", headers: { authorization: header } });
  logger.info({ evt: "test", upstream: { headers: { authorization: header } } });

  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.ok(
      !JSON.stringify(line).includes(header),
      "an Authorization header survived into the serialized line"
    );
  }
});

test("redaction does NOT see a secret already serialized into a message string", () => {
  // Not a wish — a documented limit. pino redacts structured FIELDS, so a
  // credential interpolated into the message text passes straight through.
  // This test exists so the limit stays a known one: the invariant that keeps
  // credentials out of the log is that call sites log fields, never
  // `${JSON.stringify(body)}`.
  const { lines, logger } = captureLogger();
  logger.info(`password=${SECRETS.password}`);
  assert.ok(String(lines[0]!.msg).includes(SECRETS.password!));
});

test("the redact path list covers each secret key at depths 1-3", () => {
  for (const key of Object.keys(SECRETS)) {
    assert.ok(REDACT_PATHS.includes(key), `${key} missing from REDACT_PATHS`);
    assert.ok(REDACT_PATHS.includes(`*.${key}`), `*.${key} missing from REDACT_PATHS`);
    assert.ok(REDACT_PATHS.includes(`*.*.${key}`), `*.*.${key} missing from REDACT_PATHS`);
  }
});

test("the mixin stamps userId inside a tenant context and omits it outside", async () => {
  const tenant = new AsyncLocalStorage<string>();
  bindTenantReader(() => tenant.getStore());

  const { lines, logger } = captureLogger();

  logger.info({ evt: "before" });
  await tenant.run("6", async () => {
    logger.info({ evt: "inside" });
    // Still stamped after an await: the whole point of AsyncLocalStorage is
    // that the context survives the continuation, and a mixin that only worked
    // synchronously would silently drop userId from every DB-backed handler.
    await Promise.resolve();
    logger.info({ evt: "inside-after-await" });
  });
  logger.info({ evt: "after" });

  const byEvt = new Map(lines.map((l) => [l.evt, l]));
  assert.equal(byEvt.get("before")!.userId, undefined);
  assert.equal(byEvt.get("inside")!.userId, "6");
  assert.equal(byEvt.get("inside-after-await")!.userId, "6");
  assert.equal(
    byEvt.get("after")!.userId,
    undefined,
    "userId leaked out of the tenant context"
  );
});

test("a nested tenant context stamps the inner user, not the outer one", async () => {
  const tenant = new AsyncLocalStorage<string>();
  bindTenantReader(() => tenant.getStore());
  const { lines, logger } = captureLogger();

  await tenant.run("6", async () => {
    await tenant.run("9", async () => logger.info({ evt: "inner" }));
    logger.info({ evt: "outer" });
  });

  const byEvt = new Map(lines.map((l) => [l.evt, l]));
  assert.equal(byEvt.get("inner")!.userId, "9");
  assert.equal(byEvt.get("outer")!.userId, "6");
});

test("the mixin contributes nothing when no reader is bound", () => {
  bindTenantReader(() => undefined);
  const { lines, logger } = captureLogger();
  logger.info({ evt: "unbound" });
  assert.ok(!("userId" in lines[0]!));
});

test("a reader that throws does not take the log line down with it", () => {
  // getTenantSub() throws outside a request by design; a mixin that let that
  // escape would turn every startup/shutdown line into a crash.
  bindTenantReader(() => {
    throw new Error("No tenant context found.");
  });
  const { lines, logger } = captureLogger();
  logger.info({ evt: "throwing-reader" });
  assert.equal(lines[0]!.evt, "throwing-reader");
  assert.ok(!("userId" in lines[0]!));
  bindTenantReader(() => undefined);
});

test("every line carries the service/version base and an ISO timestamp", () => {
  bindTenantReader(() => undefined);
  const { lines, logger } = captureLogger();
  logger.info({ evt: "base" });
  const line = lines[0]!;
  assert.equal(line.service, "lc-connect");
  assert.equal(typeof line.version, "string");
  assert.match(String(line.time), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
