import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractFactorScore,
  extractNextSteps,
  formatSources,
  mergeSources,
  parseSources,
  weightedOverall,
} from "../src/tools/ai-helpers.ts";

test("parseSources: citations-only shape", () => {
  const s = parseSources({ citations: ["https://a.com", "https://b.com", "https://a.com"] });
  assert.deepEqual(s.map((x) => x.url), ["https://a.com", "https://b.com"]);
});

test("parseSources: search_results shape carries title/date, merged with citations", () => {
  const s = parseSources({
    search_results: [{ title: "A", url: "https://a.com", date: "2026-01-02" }, { url: "" }, null],
    citations: ["https://a.com", "https://c.com"],
  });
  assert.deepEqual(s, [
    { url: "https://a.com", title: "A", date: "2026-01-02" },
    { url: "https://c.com" },
  ]);
});

test("parseSources: caps at 10 and tolerates garbage", () => {
  const many = Array.from({ length: 25 }, (_, i) => `https://x${i}.com`);
  assert.equal(parseSources({ citations: many }).length, 10);
  assert.deepEqual(parseSources(null), []);
  assert.deepEqual(parseSources({ citations: "nope" }), []);
});

test("mergeSources dedupes across calls and caps", () => {
  const m = mergeSources([[{ url: "u1" }, { url: "u2" }], [{ url: "u2" }, { url: "u3" }]]);
  assert.deepEqual(m.map((x) => x.url), ["u1", "u2", "u3"]);
});

test("formatSources: numbered list or explicit none", () => {
  assert.match(formatSources([]), /none returned/);
  assert.equal(
    formatSources([{ url: "https://a.com", title: "A" }, { url: "https://b.com" }]),
    "Sources:\n1. https://a.com (A)\n2. https://b.com"
  );
});

test("extractFactorScore: ignores list numbering and citation markers", () => {
  const text = "1. **Company fit**[1]: 80/100\nReasoning...\n2. Budget potential [2]\nScore: 55\n3. Technology alignment: 70";
  assert.equal(extractFactorScore(text, "company_fit"), 80);
  assert.equal(extractFactorScore(text, "budget_potential"), 55);
  assert.equal(extractFactorScore(text, "technology_alignment"), 70);
  assert.equal(extractFactorScore(text, "timeline"), null);
});

test("weightedOverall: weighted mean over scored factors only", () => {
  // company_fit 0.3, budget_potential 0.25 -> (80*0.3 + 40*0.25) / 0.55 = 61.8 -> 62
  assert.equal(
    weightedOverall([
      { factor: "company_fit", score: 80 },
      { factor: "budget_potential", score: 40 },
      { factor: "technology_alignment", score: null },
    ]),
    62
  );
  assert.equal(weightedOverall([{ factor: "company_fit", score: null }]), null);
});

test("extractNextSteps finds the section", () => {
  const t = "## Company fit: 80/100\nblah\n## Next steps\n- Call them\n- Send sample";
  assert.equal(extractNextSteps(t), "- Call them\n- Send sample");
  assert.equal(extractNextSteps("no such section"), null);
});
