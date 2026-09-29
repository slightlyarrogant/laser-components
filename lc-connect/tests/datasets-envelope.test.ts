/**
 * okList envelope: the model-facing structuredContent carries compact rows
 * (capped at MODEL_ROWS_MAX, compact columns only, secrets stripped) while the
 * widget `_meta` keeps the full row set. DB-free.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_ROWS_MAX, compactRows, okList } from "../src/datasets.js";

const LEAD_COLS = ["id", "name", "country", "location", "industry", "product", "status", "owner", "website"];

function leadRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Company ${i + 1}`,
    status: "NEW",
    industry: "Defense",
    country: "Poland",
    location: "Warsaw",
    product: "Pulsed Laser Diodes",
    application: "LiDAR",
    owner: null,
    ownerUserId: null,
    email: `c${i}@example.com`,
    phone: "+48 000",
    website: "https://example.com",
    passwordHash: "x",
    createdAt: "2026-09-01T00:00:00Z",
  }));
}

test("okList: rows capped at 50, truncated, compact columns, filters echoed", () => {
  const src = leadRows(120);
  const env = okList(src, "Leads", "https://h/", 0, ["id", "name", "email"], {
    columns: LEAD_COLS,
    filters: { country: "Poland", productName: undefined, limit: 120 },
  }) as any;
  const sc = env.structuredContent;
  assert.equal(MODEL_ROWS_MAX, 50);
  assert.equal(sc.rows.length, 50);
  assert.equal(sc.total, 120);
  assert.equal(sc.returned, 50);
  assert.equal(sc.truncated, true);
  assert.deepEqual(sc.filters, { country: "Poland", limit: 120 });
  assert.ok(!("sample" in sc) && !("schema" in sc));
  for (const r of sc.rows) assert.deepEqual(Object.keys(r), LEAD_COLS);
  const json = JSON.stringify(sc.rows);
  assert.ok(!/passwordHash|email|phone|ownerUserId/.test(json));
  // Widget _meta still carries every row (minus secrets).
  assert.equal(env._meta.rows.length, 120);
  assert.ok(!("passwordHash" in env._meta.rows[0]));
  assert.ok("email" in env._meta.rows[0]);
});

test("okList: small set -> not truncated; default columns = key columns", () => {
  const env = okList(leadRows(12), "Leads", "https://h", 10, ["id", "name", "passwordHash"]) as any;
  const sc = env.structuredContent;
  assert.equal(sc.rows.length, 12);
  assert.equal(sc.truncated, false);
  assert.deepEqual(Object.keys(sc.rows[0]), ["id", "name"]);
  assert.deepEqual(sc.filters, {});
});

test("compactRows: clips long strings, never emits sensitive columns", () => {
  const out = compactRows([{ id: 1, note: "a".repeat(500), token: "t" }], ["id", "note", "token"]);
  assert.deepEqual(Object.keys(out[0]), ["id", "note"]);
  assert.equal((out[0].note as string).length, 200);
});

test("size: 50 lead rows in structuredContent stay under 12 KB", () => {
  const env = okList(leadRows(200), "Leads — search", "https://h", 0, undefined, { columns: LEAD_COLS }) as any;
  const bytes = JSON.stringify(env.structuredContent).length;
  assert.ok(bytes < 12 * 1024, `structuredContent is ${bytes} bytes`);
});
