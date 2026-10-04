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

// ---------------------------------------------------------------------------
// Enrichment jobs (sync vs background) — pure parts
// ---------------------------------------------------------------------------

/** The enrichment areas in canonical order; "all" expands to every one. */
export const ENRICHMENT_AREAS = [
  "company_info",
  "market_position",
  "technology_stack",
  "growth_potential",
] as const;
export type EnrichmentArea = (typeof ENRICHMENT_AREAS)[number];

/** Requested types -> concrete areas (deduped, canonical order). Empty/undefined -> all. */
export function resolveEnrichmentAreas(types: readonly string[] | undefined): EnrichmentArea[] {
  const list = Array.isArray(types) && types.length > 0 ? types : ["all"];
  if (list.includes("all")) return [...ENRICHMENT_AREAS];
  return ENRICHMENT_AREAS.filter((a) => list.includes(a));
}

/**
 * Background when the request would make more than one AI call, or when the
 * caller asks for it. One area (~5-15 s) stays synchronous.
 */
export function shouldRunInBackground(areaCount: number, asyncFlag?: boolean): boolean {
  return asyncFlag === true || areaCount > 1;
}

/** Fallback per-area duration when there is no completed history. */
export const DEFAULT_MS_PER_AREA = 20_000;
/** Safety margin on top of the historical mean. */
export const ESTIMATE_MARGIN = 1.5;

export type JobEstimate = { msPerArea: number; estimatedMs: number; lowMin: number; highMin: number; samples: number };

/**
 * Estimate from completed jobs: mean ms per AI call (sum durationMs / sum calls),
 * times areas (+ queue wait at the concurrency cap), +50 % margin. Range in whole
 * minutes: low = base rounded up, high = base+margin rounded up (at least low+1).
 */
export function estimateEnrichment(
  history: Array<{ durationMs?: unknown; calls?: unknown }>,
  areas: number,
  queuedAhead = 0,
  concurrency = 2
): JobEstimate {
  let ms = 0;
  let calls = 0;
  let samples = 0;
  for (const h of history) {
    const d = Number(h.durationMs);
    const c = Number(h.calls);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d <= 0 || c <= 0) continue;
    ms += d;
    calls += c;
    samples++;
  }
  const msPerArea = calls > 0 ? ms / calls : DEFAULT_MS_PER_AREA;
  const wait = queuedAhead > 0 ? (queuedAhead * msPerArea * areas) / Math.max(1, concurrency) : 0;
  const base = msPerArea * areas + wait;
  const estimatedMs = Math.round(base * ESTIMATE_MARGIN);
  const lowMin = Math.max(1, Math.ceil(base / 60_000));
  const highMin = Math.max(lowMin + 1, Math.ceil(estimatedMs / 60_000));
  return { msPerArea: Math.round(msPerArea), estimatedMs, lowMin, highMin, samples };
}

/** Text returned immediately when a background job is started (relayable to the user). */
export function formatJobStarted(p: {
  jobId: number;
  leadName: string;
  areas: readonly string[];
  estimate: Pick<JobEstimate, "lowMin" | "highMin">;
  queuedAhead?: number;
}): string {
  const n = p.areas.length;
  const range = `about ${p.estimate.lowMin}–${p.estimate.highMin} minutes`;
  const queued = p.queuedAhead && p.queuedAhead > 0 ? ` (queued behind ${p.queuedAhead} other job(s))` : "";
  const userText = [
    `Research on ${p.leadName} is running in the background as job #${p.jobId}${queued}; the result will be saved to the lead's notes in the database.`,
    `It should take ${range}.`,
    `It takes time because each of the ${n} areas (${p.areas.join(", ")}) is a separate web research call that searches and reads many sources across the web; when it is done, the status will show how many distinct sources were cited.`,
    `Ask me for the status in ${p.estimate.highMin} minutes or so.`,
  ].join(" ");
  return [
    userText,
    "",
    `FOR THE ASSISTANT: relay the paragraph above to the user, then stop. Read the result later with get_enrichment_status { jobId: ${p.jobId} } (or get_lead_notes) when the user asks — do not poll in a loop.`,
    JSON.stringify({ jobId: p.jobId, status: "PROCESSING", areas: p.areas, estimateMinutes: [p.estimate.lowMin, p.estimate.highMin] }),
  ].join("\n");
}

/** What get_enrichment_status needs from a job row (already parsed). */
export type JobView = {
  id: number;
  leadId: number;
  leadName?: string | null;
  status: string;
  createdAt: Date;
  completedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  /** Note body when the job saved one and it still exists. */
  noteContent?: string | null;
  /** PROCESSING row that no live worker owns (server restarted mid-job). */
  orphaned?: boolean;
};

function secs(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}

/** Plain-text status block for one job. `now` injectable for tests. */
export function formatJobStatus(j: JobView, now: Date = new Date()): string {
  const meta = j.metadata ?? {};
  const areas = Array.isArray(meta.enrichmentTypes) ? (meta.enrichmentTypes as string[]).join(", ") : "?";
  const who = j.leadName ? `${j.leadName} (lead ${j.leadId})` : `lead ${j.leadId}`;
  const head = `Enrichment job #${j.id} for ${who} — areas: ${areas}.`;
  const started = `Started ${j.createdAt.toISOString()}`;

  if (j.status === "PROCESSING" || j.status === "PENDING") {
    if (j.orphaned) {
      return [
        head,
        `Status: FAILED (server restart) — the server restarted while this job was running, so it will not finish. ${started}.`,
        "Run enrich_lead again if the user still wants it.",
      ].join("\n");
    }
    const elapsed = now.getTime() - j.createdAt.getTime();
    return [
      head,
      `Status: RUNNING — ${started}, ${secs(elapsed)} elapsed (expected 1–3 minutes in total).`,
      "Tell the user it is still running; do not poll in a loop — check again at the next turn or when the user asks.",
    ].join("\n");
  }

  const took =
    typeof meta.durationMs === "number"
      ? secs(meta.durationMs)
      : j.completedAt
        ? secs(j.completedAt.getTime() - j.createdAt.getTime())
        : "?";
  const finished = j.completedAt ? `finished ${j.completedAt.toISOString()}` : "finish time not recorded";

  if (j.status === "FAILED") {
    const error = typeof meta.error === "string" ? meta.error : "no error recorded";
    return [head, `Status: FAILED — ${started}, ${finished}, took ${took}.`, `Error: ${error}`].join("\n");
  }

  // COMPLETED
  const res = j.result ?? {};
  const saved = res.saved === true;
  const noteId = typeof res.noteId === "number" ? res.noteId : null;
  const body =
    j.noteContent ?? (typeof res.text === "string" ? res.text : null) ?? "(result text not stored)";
  const where = saved && noteId != null
    ? `Saved as note #${noteId} on the lead.`
    : typeof res.reason === "string"
      ? `Not saved as a note: ${res.reason}`
      : "Not saved as a note.";
  const areasDone = Array.isArray(meta.enrichmentTypes) ? (meta.enrichmentTypes as unknown[]).length : "?";
  const calls = typeof meta.calls === "number" ? meta.calls : "?";
  const distinct =
    typeof meta.distinctSources === "number"
      ? meta.distinctSources
      : typeof meta.citations === "number"
        ? meta.citations
        : "?";
  const stats = `Areas done: ${areasDone} · AI calls: ${calls} · distinct sources cited: ${distinct} · wall time: ${took} · note id: ${saved && noteId != null ? noteId : "none"}`;
  return [head, `Status: COMPLETED — ${started}, ${finished}. ${where}`, stats, "", body].join("\n");
}

/**
 * Minimal counting semaphore for background jobs. `run` waits for a slot,
 * runs the task, releases. `pending` = queued + running.
 */
export class Limiter {
  private running = 0;
  private queue: Array<() => void> = [];
  constructor(readonly cap: number) {}

  get active(): number {
    return this.running;
  }
  get waiting(): number {
    return this.queue.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.cap) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.running++;
    }
    try {
      return await task();
    } finally {
      const next = this.queue.shift();
      if (next) next(); // slot handed over, running unchanged
      else this.running--;
    }
  }
}
