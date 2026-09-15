import { randomUUID } from "node:crypto";
import {
  DATASET_WIDGET_URI,
  buildDatasetEnvelope,
  type DatasetMeta,
  type DatasetRow,
  type DatasetSchema,
  type WidgetEnvelope,
} from "@cfi/mcp-widgets";
import { child } from "./core/log.js";

const log = child({ mod: "datasets" });

// ---------------------------------------------------------------------------
// Vendo-free dataset layer for LC Connect.
//
// Ported from VendoConnect's src/datasets.ts + the okList() envelope helper in
// src/widgets.ts, stripped of Vendo's SessionContext. The dataset store backs
// the `/datasets/:id.csv` download route (the DATASET widget's optional
// exportUrl); rows themselves are delivered to the widget inline via the
// envelope `_meta.rows` (the @cfi/mcp-widgets DATASET widget reads them there),
// so the store exists purely so a large result still has a full-fidelity CSV.
//
// Column curation is connector-specific and injectable into the DATASET widget
// (`columns`/`allColumns`); LC curates a small key-column set per object type
// (products, leads) and passes it through. No per-tenant scoping: a dataset id
// is an opaque random handle with a TTL, identical to Vendo's model.
// ---------------------------------------------------------------------------

// 30 minutes: the CSV button is clicked (or not) within seconds of the widget
// rendering. A 4-hour window only widened the guessing window on an
// unauthenticated route that serves lead PII.
const TTL_MS = 30 * 60 * 1000;
// Hard ceilings so the store cannot become the process's memory leak. Measured:
// ~320 KB per 396-row get_leads result, so 50 entries is the practical cap long
// before the byte cap bites on normal use.
const MAX_ENTRIES = 50;
const MAX_BYTES = 50 * 1024 * 1024;

interface DatasetEntry {
  rows: DatasetRow[];
  title: string;
  columns: string[]; // CSV column order (curated key columns lead).
  expiresAt: number;
  /** Rough retained size, measured once at insert (JSON length of the rows). */
  bytes: number;
}

// Insertion-ordered, used as an LRU: a hit re-inserts the entry at the tail, so
// the head is always the least-recently-used entry.
const datasets = new Map<string, DatasetEntry>();
let totalBytes = 0;

// Privacy: keys matching this pattern are credentials/secrets that must NEVER
// reach the widget, model, or CSV. Stripped centrally at the okList boundary so
// a secret column is removed exactly once for every downstream consumer.
export const SENSITIVE_KEY_RE = /haslo|password|hash|token|secret|\bpin\b/i;

/**
 * Drop sensitive keys from every row. Returns a NEW array of NEW row objects so
 * the caller's data is never mutated; a no-op (returns the input) when no row
 * carries a sensitive key. Non-object rows pass through untouched.
 */
export function stripSensitive(rows: unknown[]): unknown[] {
  let needsStrip = false;
  for (const row of rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      for (const k of Object.keys(row as Record<string, unknown>)) {
        if (SENSITIVE_KEY_RE.test(k)) {
          needsStrip = true;
          break;
        }
      }
    }
    if (needsStrip) break;
  }
  if (!needsStrip) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (!SENSITIVE_KEY_RE.test(k)) out[k] = v;
    }
    return out;
  });
}

function dropEntry(id: string): void {
  const entry = datasets.get(id);
  if (!entry) return;
  datasets.delete(id);
  totalBytes -= entry.bytes;
  if (totalBytes < 0) totalBytes = 0;
}

function prune() {
  const now = Date.now();
  let expired = 0;
  for (const [id, e] of datasets) {
    if (e.expiresAt < now) {
      dropEntry(id);
      expired++;
    }
  }
  // Only when something actually went: a per-minute "swept 0" line would bury
  // the log under noise from an idle server.
  if (expired > 0) {
    log.debug({
      evt: "dataset-evict",
      reason: "expired",
      dropped: expired,
      entries: datasets.size,
      bytes: totalBytes,
    });
  }
}

/**
 * Evict least-recently-used entries until both caps hold. The most recent entry
 * is never evicted by the byte cap — a single oversized result stays
 * downloadable rather than 404-ing the button that was just rendered.
 */
function evictToCaps(): void {
  let dropped = 0;
  let reason: "max-entries" | "max-bytes" | undefined;
  while (
    datasets.size > MAX_ENTRIES ||
    (totalBytes > MAX_BYTES && datasets.size > 1)
  ) {
    reason = datasets.size > MAX_ENTRIES ? "max-entries" : "max-bytes";
    const oldest = datasets.keys().next();
    if (oldest.done) break;
    dropEntry(oldest.value);
    dropped++;
  }
  // A cap eviction means a CSV link that was just handed to a user has gone
  // 404 — worth an info line, unlike routine TTL expiry.
  if (dropped > 0) {
    log.info({
      evt: "dataset-evict",
      reason,
      dropped,
      entries: datasets.size,
      bytes: totalBytes,
      maxEntries: MAX_ENTRIES,
      maxBytes: MAX_BYTES,
    });
  }
}

// TTL expiry used to happen only on write, so a quiet server held every dataset
// from its last busy minute indefinitely.
setInterval(prune, 60_000).unref?.();

function estimateBytes(rows: unknown): number {
  try {
    return JSON.stringify(rows)?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Store a row set under a fresh opaque id (for the CSV download route). `rows`
 * are stripped of sensitive keys here too (harmless second pass when okList
 * already stripped). `columns` is the curated CSV column order.
 */
export function storeDataset(
  rows: unknown[],
  title: string,
  columns: string[]
): string {
  prune();
  const safeRows = stripSensitive(rows) as DatasetRow[];
  // Full 128-bit handle (32 hex chars). The old 12-hex handle was the only
  // secret protecting an unauthenticated PII download.
  const id = randomUUID().replace(/-/g, "");
  const bytes = estimateBytes(safeRows);
  datasets.set(id, {
    rows: safeRows,
    title,
    columns,
    expiresAt: Date.now() + TTL_MS,
    bytes,
  });
  totalBytes += bytes;
  evictToCaps();
  return id;
}

export function getDataset(id: string): DatasetEntry | undefined {
  const e = datasets.get(id);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    dropEntry(id);
    return undefined;
  }
  // Re-insert at the tail: this entry is now the most recently used.
  datasets.delete(id);
  datasets.set(id, e);
  return e;
}

// ---------------------------------------------------------------------------
// Schema inference + column curation
// ---------------------------------------------------------------------------

function inferType(value: unknown): NonNullable<
  DatasetSchema["columns"]
>[number]["type"] {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "string";
}

/** Build a soft per-column schema hint for the DATASET widget. */
function inferSchema(rows: DatasetRow[]): DatasetSchema {
  if (!rows.length) return { columns: [] };
  const first = rows[0];
  return {
    columns: Object.keys(first).map((name) => ({
      name,
      type: inferType(first[name]),
    })),
  };
}

/** All keys present on the first row (the full column superset). */
function allKeys(rows: DatasetRow[]): string[] {
  return rows.length ? Object.keys(rows[0]) : [];
}

// ---------------------------------------------------------------------------
// CSV export — dependency-free, server-side, instant.
// ---------------------------------------------------------------------------

/** RFC-4180 cell escaping (comma delimiter). */
function csvCell(value: unknown): string {
  if (value == null) return "";
  const s =
    typeof value === "object"
      ? (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })()
      : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function datasetToCsv(entry: DatasetEntry): string {
  const header =
    entry.columns.length > 0
      ? entry.columns
      : entry.rows.length > 0
        ? Object.keys(entry.rows[0])
        : [];
  const lines: string[] = [header.map(csvCell).join(",")];
  for (const row of entry.rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    lines.push(header.map((c) => csvCell(r[c])).join(","));
  }
  return lines.join("\r\n");
}

/**
 * HTTP handler body for `GET /datasets/:id.csv`. Returns a downloadable CSV
 * (UTF-8 with BOM, Content-Disposition: attachment) or null when the dataset id
 * is unknown/expired (caller maps null -> 404).
 */
export function datasetCsvHandler(id: string): Response | null {
  const entry = getDataset(id);
  if (!entry) return null;
  const BOM = "﻿";
  const body = BOM + datasetToCsv(entry);
  const safeTitle = entry.title.replace(/[^\w.-]+/g, "_").slice(0, 80) || "dataset";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}.csv"`,
      // No ACAO: the browser downloads this directly from the widget's link, so
      // nothing needs cross-origin *read* access to lead PII. No caching either
      // — the handle expires but a proxy copy would not.
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// okList — the DATASET-widget envelope helper.
// ---------------------------------------------------------------------------

/**
 * Decide, given a row set, whether to emit the DATASET widget envelope or a
 * compact inline JSON dump. Mirrors Vendo's list-tool behaviour:
 *
 *  - Non-collection or small (<= threshold rows): return compact inline JSON
 *    (the model reads it directly — no widget needed for a handful of rows).
 *  - Large (> threshold rows): return a `buildDatasetEnvelope` with the full
 *    rows in `_meta`, a curated initial column set, an `exportUrl` pointing at
 *    the CSV route, and a Polish brevity steer. The model only sees the slim
 *    structuredContent (dataset_id, row_count, a 3-row sample, export_url).
 *
 * @param keyColumns curated initial columns (display order); the "all columns"
 *                   view falls back to the full key superset.
 */
export function okList(
  data: unknown,
  title: string,
  baseUrl: string,
  threshold = 10,
  keyColumns?: string[]
): WidgetEnvelope | { content: [{ type: "text"; text: string }] } {
  const rows = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)?.data as unknown[] | undefined) ?? null;

  // Non-collection or small set -> compact inline JSON (no widget).
  if (!Array.isArray(rows) || rows.length <= threshold) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(data ?? null, null, 2) },
      ],
    };
  }

  const safeRows = stripSensitive(rows) as DatasetRow[];
  const count = safeRows.length;
  const all = allKeys(safeRows);
  // Curated columns: caller-supplied key columns that are actually present,
  // else the full key set.
  const columns =
    keyColumns && keyColumns.length
      ? keyColumns.filter((c) => all.includes(c))
      : all;
  const csvOrder = columns.length ? columns : all;

  const datasetId = storeDataset(safeRows, title, csvOrder);
  const exportUrl = `${baseUrl.replace(/\/$/, "")}/datasets/${datasetId}.csv`;

  const views =
    columns.length && columns.length < all.length
      ? [
          { id: "kluczowe", label: "Key", columns },
          { id: "wszystkie", label: "All", columns: all },
        ]
      : undefined;

  const meta: DatasetMeta = {
    datasetId,
    title,
    rows: safeRows,
    rowCount: count,
    schema: inferSchema(safeRows),
    columns: columns.length ? columns : undefined,
    ...(views ? { views } : {}),
    allColumns: all,
    exportUrl,
  };

  const steer =
    `[PRESENTATION] ${title}: ${count} records in the widget (interactive table with sorting, ` +
    `search and CSV export). The widget IS the answer — do NOT list rows in text, ` +
    `do not build tables or lists. Summarize briefly (record count, key items from the sample). ` +
    `The full set is available via CSV export in the widget. dataset_id: ${datasetId}.`;

  return buildDatasetEnvelope(meta, steer);
}

export { DATASET_WIDGET_URI };
