import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MS_PER_AREA,
  Limiter,
  estimateEnrichment,
  formatJobStarted,
  formatJobStatus,
  resolveEnrichmentAreas,
  shouldRunInBackground,
} from "../src/tools/ai-helpers.ts";

test("resolveEnrichmentAreas: all/empty/undefined expand; explicit keeps canonical order, dedupes", () => {
  assert.equal(resolveEnrichmentAreas(["all"]).length, 4);
  assert.equal(resolveEnrichmentAreas(undefined).length, 4);
  assert.equal(resolveEnrichmentAreas([]).length, 4);
  assert.deepEqual(resolveEnrichmentAreas(["market_position", "company_info", "company_info"]), [
    "company_info",
    "market_position",
  ]);
});

test("shouldRunInBackground: one area inline, 2+ or async:true background", () => {
  assert.equal(shouldRunInBackground(1), false);
  assert.equal(shouldRunInBackground(1, false), false);
  assert.equal(shouldRunInBackground(1, true), true);
  assert.equal(shouldRunInBackground(2), true);
  assert.equal(shouldRunInBackground(4, false), true);
});

test("estimateEnrichment: fallback 20 s/area with no history", () => {
  const e = estimateEnrichment([], 4);
  assert.equal(e.msPerArea, DEFAULT_MS_PER_AREA);
  assert.equal(e.samples, 0);
  assert.equal(e.estimatedMs, 120_000); // 4 × 20 s × 1.5
  assert.deepEqual([e.lowMin, e.highMin], [2, 3]); // base 80 s -> 2; 120 s -> 2, bumped to low+1
});

test("estimateEnrichment: mean per call from history, garbage ignored, range in whole minutes", () => {
  const e = estimateEnrichment(
    [{ durationMs: 30_000, calls: 2 }, { durationMs: 4_000, calls: 1 }, { durationMs: "x", calls: 1 }, {}],
    2
  );
  assert.equal(e.samples, 2);
  assert.equal(e.msPerArea, Math.round(34_000 / 3));
  assert.equal(e.lowMin, 1);
  assert.equal(e.highMin, 2); // always at least low+1
  const big = estimateEnrichment([{ durationMs: 90_000, calls: 1 }], 4); // 6 min base, 9 with margin
  assert.deepEqual([big.lowMin, big.highMin], [6, 9]);
});

test("estimateEnrichment: queue wait is added", () => {
  const a = estimateEnrichment([], 2, 0);
  const b = estimateEnrichment([], 2, 2, 2);
  assert.ok(b.estimatedMs > a.estimatedMs);
});

test("formatJobStarted: user paragraph with job id, notes, estimate, area count, check-back", () => {
  const t = formatJobStarted({
    jobId: 7,
    leadName: "VIGO Photonics",
    areas: ["company_info", "market_position"],
    estimate: { lowMin: 1, highMin: 2 },
  });
  assert.match(t, /job #7/);
  assert.match(t, /saved to the lead's notes in the database/);
  assert.match(t, /about 1–2 minutes/);
  assert.match(t, /each of the 2 areas/);
  assert.match(t, /Ask me for the status in 2 minutes/);
  assert.match(t, /get_enrichment_status \{ jobId: 7 \}/);
  assert.match(t, /do not poll/);
  assert.ok(t.split("\n")[0].length < 700, "first paragraph stays short");
});

const base = {
  id: 3,
  leadId: 76,
  leadName: "VIGO Photonics",
  createdAt: new Date("2026-10-04T10:00:00Z"),
  metadata: { enrichmentTypes: ["company_info", "market_position"] },
};

test("formatJobStatus: running shows elapsed and no-poll hint", () => {
  const t = formatJobStatus({ ...base, status: "PROCESSING" }, new Date("2026-10-04T10:00:42Z"));
  assert.match(t, /Status: RUNNING/);
  assert.match(t, /42 s elapsed/);
  assert.match(t, /do not poll/);
});

test("formatJobStatus: orphaned PROCESSING reads as failed (server restart)", () => {
  const t = formatJobStatus({ ...base, status: "PROCESSING", orphaned: true });
  assert.match(t, /FAILED \(server restart\)/);
});

test("formatJobStatus: completed reports stats line before the note text", () => {
  const t = formatJobStatus({
    ...base,
    status: "COMPLETED",
    completedAt: new Date("2026-10-04T10:00:31Z"),
    metadata: { ...base.metadata, durationMs: 31_000, calls: 2, citations: 10, distinctSources: 17 },
    result: { saved: true, noteId: 12, text: "fallback" },
    noteContent: "[ENRICHMENT] body\nSources:\n1. https://a.com",
  });
  const stats = t.indexOf("Areas done: 2 · AI calls: 2 · distinct sources cited: 17 · wall time: 31 s · note id: 12");
  assert.ok(stats > 0, t);
  assert.ok(t.indexOf("[ENRICHMENT] body") > stats);
  assert.match(t, /Saved as note #12/);
});

test("formatJobStatus: completed without note falls back to stored text + reason", () => {
  const t = formatJobStatus({
    ...base,
    status: "COMPLETED",
    completedAt: new Date("2026-10-04T10:00:31Z"),
    result: { saved: false, reason: "You may not edit this lead", text: "stored body" },
  });
  assert.match(t, /Not saved as a note: You may not edit/);
  assert.match(t, /note id: none/);
  assert.match(t, /stored body/);
});

test("formatJobStatus: failed shows the error", () => {
  const t = formatJobStatus({
    ...base,
    status: "FAILED",
    completedAt: new Date("2026-10-04T10:00:05Z"),
    metadata: { ...base.metadata, error: "server restart" },
  });
  assert.match(t, /Status: FAILED/);
  assert.match(t, /Error: server restart/);
});

test("Limiter: never more than cap concurrently, all tasks finish", async () => {
  const lim = new Limiter(2);
  let now = 0;
  let peak = 0;
  const task = async () => {
    now++;
    peak = Math.max(peak, now);
    await new Promise((r) => setTimeout(r, 5));
    now--;
  };
  await Promise.all(Array.from({ length: 7 }, () => lim.run(task)));
  assert.equal(peak, 2);
  assert.equal(lim.active, 0);
  assert.equal(lim.waiting, 0);
});

test("Limiter: a rejecting task releases its slot", async () => {
  const lim = new Limiter(1);
  await assert.rejects(lim.run(async () => { throw new Error("x"); }));
  assert.equal(await lim.run(async () => 5), 5);
  assert.equal(lim.active, 0);
});
