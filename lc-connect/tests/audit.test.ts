/**
 * Unit tests for the PURE details-shaping helpers in src/core/audit.ts.
 *
 * Run with:  npx tsx --test tests/audit.test.ts
 *
 * Deliberately DB-free: `audit()` itself (the single INSERT) is not exercised
 * here — everything it decides before touching Postgres lives in truncate(),
 * capIdList(), sanitizeDetails(), diffFields() and normalizeResourceId(), and
 * those take plain objects and return plain objects.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AUDIT_DEFAULT_LIMIT,
  AUDIT_MAX_LIMIT,
  MAX_DETAILS_BYTES,
  MAX_LIST_LENGTH,
  MAX_STRING_LENGTH,
  REDACTED,
  buildAuditWhere,
  capIdList,
  compactDetails,
  diffFields,
  normalizeAuditLimit,
  normalizeResourceId,
  parseSince,
  sanitizeDetails,
  truncate,
} from "../src/core/audit.js";

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

test("truncate leaves short strings untouched", () => {
  assert.equal(truncate("hello"), "hello");
  assert.equal(truncate(""), "");
});

test("truncate cuts at the limit and marks the cut with an ellipsis", () => {
  const long = "x".repeat(MAX_STRING_LENGTH + 100);
  const cut = truncate(long);
  assert.equal(cut.length, MAX_STRING_LENGTH + 1);
  assert.ok(cut.endsWith("…"));
  assert.equal(cut.slice(0, MAX_STRING_LENGTH), "x".repeat(MAX_STRING_LENGTH));
});

test("truncate is exact at the boundary (no ellipsis at exactly max)", () => {
  const exact = "y".repeat(MAX_STRING_LENGTH);
  assert.equal(truncate(exact), exact);
  assert.equal(truncate("z".repeat(MAX_STRING_LENGTH + 1)).endsWith("…"), true);
});

test("truncate honours an explicit smaller limit", () => {
  assert.equal(truncate("abcdef", 3), "abc…");
});

// ---------------------------------------------------------------------------
// capIdList
// ---------------------------------------------------------------------------

test("capIdList keeps a short list whole and reports the true count", () => {
  const r = capIdList([1, 2, 3]);
  assert.deepEqual(r.ids, [1, 2, 3]);
  assert.equal(r.count, 3);
  assert.equal(r.omitted, 0);
});

test("capIdList caps at 500 but still records the real total", () => {
  const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
  const r = capIdList(ids);
  assert.equal(r.ids.length, MAX_LIST_LENGTH);
  assert.equal(r.count, 1200);
  assert.equal(r.omitted, 700);
  assert.equal(r.ids[0], 1);
  assert.equal(r.ids[MAX_LIST_LENGTH - 1], MAX_LIST_LENGTH);
});

test("capIdList does not alias the caller's array", () => {
  const ids = [1, 2, 3];
  const r = capIdList(ids);
  r.ids.push(4);
  assert.deepEqual(ids, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// sanitizeDetails — secret stripping
// ---------------------------------------------------------------------------

test("sanitizeDetails returns null for nothing", () => {
  assert.equal(sanitizeDetails(undefined), null);
  assert.equal(sanitizeDetails(null), null);
});

test("sanitizeDetails redacts password-ish keys but keeps the key names", () => {
  const out = sanitizeDetails({
    email: "anna@example.com",
    password: "hunter2hunter2",
    passwordHash: "$2a$12$abcdefghijklmnopqrstuv",
    resetTokenHash: "deadbeef",
    role: "SALES",
  })!;
  assert.equal(out.email, "anna@example.com");
  assert.equal(out.role, "SALES");
  assert.equal(out.password, REDACTED);
  assert.equal(out.passwordHash, REDACTED);
  assert.equal(out.resetTokenHash, REDACTED);
  // The secret value must appear nowhere in the serialized blob.
  const blob = JSON.stringify(out);
  assert.ok(!blob.includes("hunter2hunter2"));
  assert.ok(!blob.includes("$2a$12$"));
  assert.ok(!blob.includes("deadbeef"));
});

test("sanitizeDetails redacts secrets nested inside objects and arrays", () => {
  const out = sanitizeDetails({
    target: { id: 7, email: "x@y.z", passwordHash: "$2a$12$secrethash" },
    batch: [{ apiKey: "sk-live-123" }],
  })!;
  const blob = JSON.stringify(out);
  assert.ok(!blob.includes("secrethash"));
  assert.ok(!blob.includes("sk-live-123"));
  assert.equal((out.target as any).email, "x@y.z");
});

test("sanitizeDetails matches secret keys case-insensitively", () => {
  const out = sanitizeDetails({ PASSWORD: "p", Secret_Token: "t", Salt: "s" })!;
  assert.equal(out.PASSWORD, REDACTED);
  assert.equal(out.Secret_Token, REDACTED);
  assert.equal(out.Salt, REDACTED);
});

// ---------------------------------------------------------------------------
// sanitizeDetails — truncation and caps
// ---------------------------------------------------------------------------

test("sanitizeDetails truncates long free text", () => {
  const body = "a".repeat(5000);
  const out = sanitizeDetails({ note: body })!;
  assert.equal((out.note as string).length, MAX_STRING_LENGTH + 1);
  assert.ok((out.note as string).endsWith("…"));
});

test("sanitizeDetails truncates long text nested in arrays", () => {
  const out = sanitizeDetails({ rows: [{ text: "b".repeat(2000) }] })!;
  const text = (out.rows as any[])[0].text as string;
  assert.equal(text.length, MAX_STRING_LENGTH + 1);
});

test("sanitizeDetails caps arrays at 500 and marks the overflow", () => {
  const out = sanitizeDetails({ ids: Array.from({ length: 900 }, (_, i) => i) })!;
  const ids = out.ids as unknown[];
  assert.equal(ids.length, MAX_LIST_LENGTH + 1);
  assert.equal(ids[MAX_LIST_LENGTH], "…400 more");
});

test("sanitizeDetails keeps scalars, normalizes dates and drops undefined", () => {
  const out = sanitizeDetails({
    count: 3,
    ok: true,
    when: new Date("2026-09-15T10:00:00.000Z"),
    missing: undefined,
    empty: null,
  })!;
  assert.equal(out.count, 3);
  assert.equal(out.ok, true);
  assert.equal(out.when, "2026-09-15T10:00:00.000Z");
  assert.ok(!("missing" in out));
  assert.equal(out.empty, null);
});

test("sanitizeDetails renders non-plain objects as readable scalars, not internals", () => {
  // Stands in for a Prisma Decimal: a class instance with a useful toString().
  class Decimalish {
    constructor(private readonly v: string) {}
    toString() {
      return this.v;
    }
  }
  const out = sanitizeDetails({ annualRevenue: new Decimalish("1200000.00") })!;
  assert.equal(out.annualRevenue, "1200000.00");
});

test("sanitizeDetails survives circular structures instead of throwing", () => {
  const a: Record<string, unknown> = { name: "loop" };
  a.self = a;
  const out = sanitizeDetails(a)!;
  assert.equal(out.name, "loop");
  assert.doesNotThrow(() => JSON.stringify(out));
});

test("sanitizeDetails replaces an oversized blob with a key summary", () => {
  // 600 keys x ~500 chars each blows past the byte ceiling.
  const huge: Record<string, unknown> = {};
  for (let i = 0; i < 600; i++) huge[`k${i}`] = "c".repeat(MAX_STRING_LENGTH);
  const out = sanitizeDetails(huge)!;
  assert.equal(out._truncated, true);
  assert.ok((out._bytes as number) > MAX_DETAILS_BYTES);
  assert.ok(Array.isArray(out.keys));
  assert.ok(JSON.stringify(out).length < MAX_DETAILS_BYTES);
});

// ---------------------------------------------------------------------------
// diffFields
// ---------------------------------------------------------------------------

test("diffFields records only the fields that actually changed", () => {
  const before = { name: "Acme", status: "NEW", industry: "optics", phone: null };
  const after = { status: "QUALIFIED", industry: "optics" };
  const d = diffFields(before, after);
  assert.deepEqual(d.changed, ["status"]);
  assert.deepEqual(d.before, { status: "NEW" });
  assert.deepEqual(d.after, { status: "QUALIFIED" });
});

test("diffFields treats a newly-set field (was null) as a change", () => {
  const d = diffFields({ email: null }, { email: "a@b.c" });
  assert.deepEqual(d.changed, ["email"]);
  assert.equal(d.before.email, null);
  assert.equal(d.after.email, "a@b.c");
});

test("diffFields treats a missing before-key as null, not as 'unchanged'", () => {
  const d = diffFields({}, { website: "https://x.test" });
  assert.deepEqual(d.changed, ["website"]);
  assert.equal(d.before.website, null);
});

test("diffFields ignores undefined in the after payload", () => {
  const d = diffFields({ a: 1 }, { a: undefined, b: 2 });
  assert.deepEqual(d.changed, ["b"]);
});

test("diffFields compares arrays by value, not identity", () => {
  const same = diffFields({ tags: ["a", "b"] }, { tags: ["a", "b"] });
  assert.deepEqual(same.changed, []);
  const moved = diffFields({ tags: ["a", "b"] }, { tags: ["b", "a"] });
  assert.deepEqual(moved.changed, ["tags"]);
});

test("diffFields never leaks a secret value on either side", () => {
  const d = diffFields(
    { passwordHash: "$2a$12$oldhash" },
    { passwordHash: "$2a$12$newhash" }
  );
  assert.deepEqual(d.changed, ["passwordHash"]);
  assert.equal(d.before.passwordHash, REDACTED);
  assert.equal(d.after.passwordHash, REDACTED);
  const blob = JSON.stringify(d);
  assert.ok(!blob.includes("oldhash"));
  assert.ok(!blob.includes("newhash"));
});

test("diffFields truncates long changed text on both sides", () => {
  const d = diffFields(
    { description: "o".repeat(3000) },
    { description: "n".repeat(3000) }
  );
  assert.equal((d.before.description as string).length, MAX_STRING_LENGTH + 1);
  assert.equal((d.after.description as string).length, MAX_STRING_LENGTH + 1);
});

test("diffFields tolerates null/undefined inputs", () => {
  assert.deepEqual(diffFields(null, null).changed, []);
  assert.deepEqual(diffFields(undefined, { a: 1 }).changed, ["a"]);
  assert.deepEqual(diffFields({ a: 1 }, undefined).changed, []);
});

// ---------------------------------------------------------------------------
// normalizeResourceId
// ---------------------------------------------------------------------------

test("normalizeResourceId stringifies, nulls the empties and caps the length", () => {
  assert.equal(normalizeResourceId(42), "42");
  assert.equal(normalizeResourceId("slug"), "slug");
  assert.equal(normalizeResourceId(null), null);
  assert.equal(normalizeResourceId(undefined), null);
  assert.equal(normalizeResourceId(""), null);
  assert.equal(normalizeResourceId(0), "0");
  assert.equal(normalizeResourceId("q".repeat(500))!.length, 201);
});

// ---------------------------------------------------------------------------
// Read-side filters (shared by get_audit_log and get_activity_feed)
// ---------------------------------------------------------------------------

test("normalizeAuditLimit defaults, floors and caps", () => {
  assert.equal(normalizeAuditLimit(undefined), AUDIT_DEFAULT_LIMIT);
  assert.equal(normalizeAuditLimit(null), AUDIT_DEFAULT_LIMIT);
  assert.equal(normalizeAuditLimit(NaN), AUDIT_DEFAULT_LIMIT);
  assert.equal(normalizeAuditLimit(0), 1);
  assert.equal(normalizeAuditLimit(-5), 1);
  assert.equal(normalizeAuditLimit(12), 12);
  assert.equal(normalizeAuditLimit(9999), AUDIT_MAX_LIMIT);
});

test("parseSince accepts ISO dates and rejects junk with a relayable message", () => {
  assert.equal(parseSince(undefined), null);
  assert.equal(parseSince(null), null);
  assert.equal(parseSince(""), null);
  assert.equal(
    parseSince("2026-09-01")!.toISOString(),
    "2026-09-01T00:00:00.000Z"
  );
  assert.throws(() => parseSince("last tuesday"), /not a valid ISO date/);
});

test("buildAuditWhere is empty when nothing is filtered", () => {
  assert.deepEqual(buildAuditWhere({}), {});
});

test("buildAuditWhere maps every filter, action as a PREFIX match", () => {
  const where = buildAuditWhere({
    userId: 6,
    action: "lead.",
    resourceType: "lead",
    since: "2026-09-01T00:00:00Z",
    limit: 10,
  });
  assert.equal(where.userId, 6);
  assert.deepEqual(where.action, { startsWith: "lead." });
  assert.equal(where.resource_type, "lead");
  assert.deepEqual(where.timestamp, { gte: new Date("2026-09-01T00:00:00Z") });
});

test("buildAuditWhere keeps userId 0 out and does not invent filters", () => {
  const where = buildAuditWhere({ userId: null, action: "", resourceType: null });
  assert.deepEqual(where, {});
});

// ---------------------------------------------------------------------------
// compactDetails — the one-line summary shown in the feed/table
// ---------------------------------------------------------------------------

test("compactDetails renders before/after as arrows", () => {
  const s = compactDetails({
    name: "Acme",
    before: { status: "NEW" },
    after: { status: "QUALIFIED" },
  });
  assert.ok(s.includes("status: NEW→QUALIFIED"));
  assert.ok(s.includes("name=Acme"));
});

test("compactDetails marks a field that was previously unset", () => {
  const s = compactDetails({ before: {}, after: { email: "a@b.c" } });
  assert.ok(s.includes("email: ∅→a@b.c"));
});

test("compactDetails collapses arrays and objects to sizes", () => {
  const s = compactDetails({ ids: [1, 2, 3], nested: { a: 1, b: 2 } });
  assert.ok(s.includes("ids=[3]"));
  assert.ok(s.includes("nested={2}"));
});

test("compactDetails handles empty and non-object input", () => {
  assert.equal(compactDetails(null), "");
  assert.equal(compactDetails(undefined), "");
  assert.equal(compactDetails({}), "");
  assert.equal(compactDetails("plain"), "plain");
});

test("compactDetails stays short even for a fat blob", () => {
  const big: Record<string, unknown> = {};
  for (let i = 0; i < 100; i++) big[`field${i}`] = `value${i}`;
  const s = compactDetails(big);
  assert.ok(s.length <= 241, `summary too long: ${s.length}`);
});
