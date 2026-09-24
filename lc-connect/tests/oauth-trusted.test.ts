/**
 * Unit tests for the trusted-assistant-host allowlist that gates on-the-fly
 * client auto-registration in /authorize (src/auth/oauth.ts).
 *
 * Run with:  npx tsx --test tests/oauth-trusted.test.ts
 *
 * A wrong "yes" here re-opens audit C3 (authorization code delivered to an
 * attacker-chosen URL), so the rejections matter more than the acceptances.
 * oauth.ts imports config.ts, which needs an environment; placeholders are set
 * before the dynamic import and nothing connects to a database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL ??= "postgresql://user@localhost/none";
process.env.PUBLIC_URL ??= "http://localhost:3999";
process.env.LC_JWT_SECRET ??= "test-only-secret-not-a-placeholder-0123456789";
process.env.STATE_DIR ??= mkdtempSync(join(tmpdir(), "lc-oauth-test-"));

const { trustedRedirectHost, TRUSTED_REDIRECT_HOSTS } = await import("../src/auth/oauth.js");

test("allowlist is exactly the three assistant hosts", () => {
  assert.deepEqual([...TRUSTED_REDIRECT_HOSTS].sort(), ["chat.openai.com", "chatgpt.com", "claude.ai"]);
});

test("claude.ai callback is trusted", () => {
  assert.equal(trustedRedirectHost("https://claude.ai/api/mcp/auth_callback"), "claude.ai");
});

test("chatgpt.com and chat.openai.com are trusted; path and query are irrelevant", () => {
  assert.equal(trustedRedirectHost("https://chatgpt.com/connector/oauth/test123"), "chatgpt.com");
  assert.equal(trustedRedirectHost("https://chatgpt.com/"), "chatgpt.com");
  assert.equal(trustedRedirectHost("https://chatgpt.com/a/b/c?x=1#frag"), "chatgpt.com");
  assert.equal(trustedRedirectHost("https://chat.openai.com/aip/g-1/oauth/callback"), "chat.openai.com");
});

test("host comparison is case-insensitive and default port is fine", () => {
  assert.equal(trustedRedirectHost("https://CLAUDE.AI/api/mcp/auth_callback"), "claude.ai");
  assert.equal(trustedRedirectHost("https://claude.ai:443/cb"), "claude.ai");
});

test("look-alike and suffix hosts are rejected", () => {
  assert.equal(trustedRedirectHost("https://evil.claude.ai.attacker.tld/cb"), null);
  assert.equal(trustedRedirectHost("https://claude.ai.attacker.tld/cb"), null);
  assert.equal(trustedRedirectHost("https://notclaude.ai/cb"), null);
  assert.equal(trustedRedirectHost("https://claude.ai./cb"), null);
});

test("subdomains of trusted hosts are rejected (no wildcard)", () => {
  assert.equal(trustedRedirectHost("https://evil.claude.ai/cb"), null);
  assert.equal(trustedRedirectHost("https://www.chatgpt.com/cb"), null);
});

test("non-https schemes are rejected", () => {
  assert.equal(trustedRedirectHost("http://chatgpt.com/connector/oauth/x"), null);
  assert.equal(trustedRedirectHost("javascript://claude.ai/%0aalert(1)"), null);
  assert.equal(trustedRedirectHost("ftp://claude.ai/cb"), null);
});

test("non-default ports and embedded credentials are rejected", () => {
  assert.equal(trustedRedirectHost("https://claude.ai:8443/cb"), null);
  assert.equal(trustedRedirectHost("https://user:pw@claude.ai/cb"), null);
  // userinfo trick: the real host is attacker.tld
  assert.equal(trustedRedirectHost("https://claude.ai@attacker.tld/cb"), null);
});

test("garbage input is rejected", () => {
  assert.equal(trustedRedirectHost(""), null);
  assert.equal(trustedRedirectHost("claude.ai"), null);
  assert.equal(trustedRedirectHost("/relative/cb"), null);
  assert.equal(trustedRedirectHost("https://evil.example/cb"), null);
});
