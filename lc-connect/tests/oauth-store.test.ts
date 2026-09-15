/**
 * Unit tests for the pure helpers behind the Postgres-backed OAuth state store.
 *
 * Run with:  npx tsx --test tests/oauth-store.test.ts
 *
 * DB-free by construction. The store's query functions are exercised end to end
 * against the live schema by the curl walkthrough in the migration's commit
 * notes; what is worth pinning down in a unit test is the logic that has no
 * database in it at all and that a wrong answer would silently break:
 *
 *   - hashToken     — a refresh token is looked up ONLY by this digest. If it
 *                     is not stable and not injective in practice, every token
 *                     either stops working or starts matching another one.
 *   - expiresAtIn   — TTL arithmetic for both the 300 s code and the 30 d token.
 *   - isExpired     — the boundary that decides whether a credential still works.
 *   - verifyPkceChallenge — the S256 check that binds a code to its verifier.
 *   - isAbsoluteHttpUrl   — the filter on registered redirect URIs.
 *
 * src/auth/store.ts imports the shared Prisma client and src/auth/oauth.ts
 * imports src/config.ts, so both modules need an environment to be constructed
 * even though nothing here connects. The placeholder values below are supplied
 * before a dynamic import for exactly that reason — no query is ever issued.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL ??= "postgresql://user@localhost/none";
process.env.PUBLIC_URL ??= "http://localhost:3999";
process.env.LC_JWT_SECRET ??= "test-only-secret-not-a-placeholder-0123456789";
process.env.STATE_DIR ??= mkdtempSync(join(tmpdir(), "lc-oauth-test-"));

const { hashToken, expiresAtIn, isExpired, isAbsoluteHttpUrl, REFRESH_TOKEN_TTL_SECONDS } =
  await import("../src/auth/store.js");
const { verifyPkceChallenge } = await import("../src/auth/oauth.js");

// ---------------------------------------------------------------------------
// hashToken
// ---------------------------------------------------------------------------

test("hashToken returns lowercase sha256 hex", () => {
  const digest = hashToken("hello");
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, createHash("sha256").update("hello", "utf8").digest("hex"));
});

test("hashToken is deterministic — the same token always finds the same row", () => {
  const token = randomUUID();
  assert.equal(hashToken(token), hashToken(token));
});

test("hashToken separates distinct tokens", () => {
  const digests = new Set(Array.from({ length: 200 }, () => hashToken(randomUUID())));
  assert.equal(digests.size, 200);
});

test("hashToken never echoes the raw token — that is the whole point of storing a digest", () => {
  const token = "4f2c1b90-0000-4000-8000-aaaaaaaaaaaa";
  assert.ok(!hashToken(token).includes(token));
  assert.notEqual(hashToken(token), token);
});

test("hashToken is case- and whitespace-sensitive", () => {
  assert.notEqual(hashToken("abc"), hashToken("ABC"));
  assert.notEqual(hashToken("abc"), hashToken("abc "));
});

// ---------------------------------------------------------------------------
// expiresAtIn / isExpired
// ---------------------------------------------------------------------------

test("expiresAtIn adds the TTL in seconds to the supplied instant", () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  assert.equal(expiresAtIn(300, now).getTime(), now + 300_000);
  assert.equal(expiresAtIn(0, now).getTime(), now);
});

test("expiresAtIn covers the 30-day refresh-token window exactly", () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  const expiry = expiresAtIn(REFRESH_TOKEN_TTL_SECONDS, now);
  assert.equal(REFRESH_TOKEN_TTL_SECONDS, 2_592_000);
  assert.equal(expiry.getTime() - now, 30 * 24 * 60 * 60 * 1000);
});

test("expiresAtIn defaults to the current clock", () => {
  const before = Date.now();
  const expiry = expiresAtIn(60);
  const after = Date.now();
  assert.ok(expiry.getTime() >= before + 60_000);
  assert.ok(expiry.getTime() <= after + 60_000);
});

test("isExpired: an unexpired credential is usable, including at the exact boundary", () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  assert.equal(isExpired(new Date(now + 1), now), false);
  // Strictly past, not at — same strictness as the Map store this replaces
  // (`Date.now() > entry.expiresAt`).
  assert.equal(isExpired(new Date(now), now), false);
});

test("isExpired: one millisecond past the expiry is expired", () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  assert.equal(isExpired(new Date(now - 1), now), true);
});

test("isExpired round-trips a freshly issued code and a stale one", () => {
  const now = Date.now();
  assert.equal(isExpired(expiresAtIn(300, now), now), false);
  assert.equal(isExpired(expiresAtIn(-1, now), now), true);
});

// ---------------------------------------------------------------------------
// verifyPkceChallenge (RFC 7636 S256)
// ---------------------------------------------------------------------------

/** The client side of PKCE: challenge = base64url(sha256(verifier)). */
function s256(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

test("verifyPkceChallenge accepts the matching verifier", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(verifyPkceChallenge(verifier, s256(verifier)), true);
});

test("verifyPkceChallenge matches RFC 7636 appendix B", () => {
  // The canonical example pair from the spec.
  assert.equal(
    verifyPkceChallenge(
      "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    ),
    true
  );
});

test("verifyPkceChallenge rejects a different verifier", () => {
  const challenge = s256("verifier-one");
  assert.equal(verifyPkceChallenge("verifier-two", challenge), false);
});

test("verifyPkceChallenge rejects a single-character mutation", () => {
  const verifier = randomUUID() + randomUUID();
  const challenge = s256(verifier);
  const mutated = (challenge[0] === "A" ? "B" : "A") + challenge.slice(1);
  assert.equal(verifyPkceChallenge(verifier, mutated), false);
});

test("verifyPkceChallenge rejects a truncated or padded challenge without throwing", () => {
  const verifier = "some-verifier";
  const challenge = s256(verifier);
  // Length mismatch must short-circuit: timingSafeEqual throws on unequal
  // buffer lengths, so a truncated challenge would crash the token endpoint.
  assert.equal(verifyPkceChallenge(verifier, challenge.slice(0, -1)), false);
  assert.equal(verifyPkceChallenge(verifier, challenge + "A"), false);
  assert.equal(verifyPkceChallenge(verifier, ""), false);
});

test("verifyPkceChallenge rejects the plain verifier sent as the challenge", () => {
  // i.e. the 'plain' PKCE method, which this server does not accept.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(verifyPkceChallenge(verifier, verifier), false);
});

// ---------------------------------------------------------------------------
// isAbsoluteHttpUrl — the redirect_uri allow-list filter
// ---------------------------------------------------------------------------

test("isAbsoluteHttpUrl accepts absolute http and https URLs", () => {
  assert.equal(isAbsoluteHttpUrl("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAbsoluteHttpUrl("http://localhost:3116/cb"), true);
});

test("isAbsoluteHttpUrl rejects non-http schemes, relative paths and non-strings", () => {
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "file:///etc/passwd",
    "/api/callback",
    "claude.ai/cb",
    "",
    null,
    undefined,
    42,
    ["https://claude.ai/cb"],
  ]) {
    assert.equal(isAbsoluteHttpUrl(bad), false, `expected ${JSON.stringify(bad)} to be rejected`);
  }
});
