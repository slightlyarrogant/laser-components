/**
 * Pure helpers for the Perplexity-backed AI tools (src/tools/ai.ts).
 *
 * Kept free of config/prisma imports so they can be unit-tested directly
 * (tests/ai-helpers.test.ts).
 */

export type AiSource = { url: string; title?: string; date?: string };

/** Max sources surfaced to the model / stored in a note per tool call. */
export const MAX_SOURCES = 10;

/**
 * Extract sources from a Perplexity chat-completions response. Handles both
 * shapes the API has used: `citations: string[]` (URLs) and
 * `search_results: {title,url,date}[]`. search_results wins for metadata
 * (title/date) when the same URL appears in both. Deduped by URL, capped.
 */
export function parseSources(data: unknown, cap: number = MAX_SOURCES): AiSource[] {
  const d = (data ?? {}) as { citations?: unknown; search_results?: unknown };
  const byUrl = new Map<string, AiSource>();

  if (Array.isArray(d.search_results)) {
    for (const r of d.search_results) {
      if (!r || typeof r !== "object") continue;
      const url = typeof (r as any).url === "string" ? (r as any).url.trim() : "";
      if (!url || byUrl.has(url)) continue;
      const src: AiSource = { url };
      if (typeof (r as any).title === "string" && (r as any).title.trim()) src.title = (r as any).title.trim();
      if (typeof (r as any).date === "string" && (r as any).date.trim()) src.date = (r as any).date.trim();
      byUrl.set(url, src);
    }
  }
  if (Array.isArray(d.citations)) {
    for (const c of d.citations) {
      const url = typeof c === "string" ? c.trim() : typeof (c as any)?.url === "string" ? (c as any).url.trim() : "";
      if (!url || byUrl.has(url)) continue;
      byUrl.set(url, { url });
    }
  }
  return [...byUrl.values()].slice(0, cap);
}

/** Merge several source lists (e.g. one per enrichment focus area): dedupe by URL, cap. */
export function mergeSources(lists: AiSource[][], cap: number = MAX_SOURCES): AiSource[] {
  const byUrl = new Map<string, AiSource>();
  for (const list of lists) for (const s of list) if (!byUrl.has(s.url)) byUrl.set(s.url, s);
  return [...byUrl.values()].slice(0, cap);
}

/** "Sources:" block as plain text, numbered. Empty list -> explicit "none returned". */
export function formatSources(sources: AiSource[]): string {
  if (sources.length === 0) return "Sources: none returned by the research provider.";
  const lines = sources.map((s, i) => {
    const meta = [s.title, s.date].filter(Boolean).join(", ");
    return `${i + 1}. ${s.url}${meta ? ` (${meta})` : ""}`;
  });
  return ["Sources:", ...lines].join("\n");
}

// ---------------------------------------------------------------------------
// Lead scoring
// ---------------------------------------------------------------------------

/** Human-readable label per scoring factor enum value. */
export const SCORING_FACTOR_LABELS: Record<string, string> = {
  company_fit: "Company fit",
  budget_potential: "Budget potential",
  timeline: "Timeline",
  engagement: "Engagement",
  technology_alignment: "Technology alignment",
};

/**
 * Weights for the overall score. The overall is computed in code as the
 * weighted mean over the factors that were actually scored (weights are
 * renormalised), never taken from the model's own arithmetic.
 */
export const SCORING_FACTOR_WEIGHTS: Record<string, number> = {
  company_fit: 0.3,
  technology_alignment: 0.25,
  budget_potential: 0.25,
  timeline: 0.1,
  engagement: 0.1,
};

/** Strip Perplexity inline citation markers ("[1]", "[2][3]") so they are not read as scores. */
function stripCitationMarkers(s: string): string {
  return s.replace(/\[\d{1,3}\]/g, "");
}

function plausible(n: number): number | null {
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * Best-effort extraction of a 0-100 score for a named factor from the free-text
 * AI analysis. Finds the first line mentioning the factor (enum token, spaced
 * token or label), then looks on that line and the next few lines for, in
 * order: "NN/100" or "NN%", "score: NN", or a number after the label on the
 * label line. Returns null when nothing plausible is found.
 */
export function extractFactorScore(analysis: string, factor: string): number | null {
  const label = (SCORING_FACTOR_LABELS[factor] ?? factor).toLowerCase();
  const spaced = factor.replace(/_/g, " ");
  const lines = stripCitationMarkers(analysis).split(/\n+/);

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const idx = [label, spaced, factor].map((k) => lower.indexOf(k)).find((x) => x >= 0);
    if (idx === undefined) continue;

    const windowLines = lines.slice(i, i + 4);
    for (const l of windowLines) {
      const m = l.match(/(\d{1,3})\s*(?:\/\s*100|%)/);
      if (m) {
        const n = plausible(Number(m[1]));
        if (n != null) return n;
      }
    }
    for (const l of windowLines) {
      const m = l.match(/score[^0-9\n]{0,15}(\d{1,3})\b/i);
      if (m) {
        const n = plausible(Number(m[1]));
        if (n != null) return n;
      }
    }
    // Number after the label on the label line itself (e.g. "Company fit: 80").
    const after = lines[i].slice(idx);
    const m = after.match(/[:\-–—]\s*\**\s*(\d{1,3})\b/);
    if (m) {
      const n = plausible(Number(m[1]));
      if (n != null) return n;
    }
  }
  return null;
}

/** Weighted mean (rounded) over factors with a score; null when none scored. */
export function weightedOverall(
  scores: Array<{ factor: string; score: number | null }>
): number | null {
  let sum = 0;
  let wsum = 0;
  for (const s of scores) {
    if (s.score == null) continue;
    const w = SCORING_FACTOR_WEIGHTS[s.factor] ?? 0.1;
    sum += s.score * w;
    wsum += w;
  }
  return wsum > 0 ? Math.round(sum / wsum) : null;
}

/** "Next steps" section of the analysis, if the model wrote one (best-effort). */
export function extractNextSteps(analysis: string): string | null {
  const text = stripCitationMarkers(analysis);
  const m = text.match(/(?:^|\n)[#*\s\d.]*(?:recommend\w*|next steps?)[^\n]*\n([\s\S]{1,2000}?)(?:\n#{1,6}\s|\n\*\*[^*\n]+\*\*\s*\n|$)/i);
  const body = m?.[1]?.trim();
  return body ? body : null;
}

/** YYYY-MM-DD in UTC. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
