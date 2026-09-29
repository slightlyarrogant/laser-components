/**
 * backfill-geography-text.ts — evidence-based country backfill (Poland, Czech
 * Republic) from a lead's OWN text. Companion to backfill-geography.ts
 * (ccTLD pass, tag geo:tld); same conventions.
 *
 * A lead qualifies only if its own fields state the country explicitly:
 *   Poland          "Poland" / "Polska" / "Polish", a Polish city, or the legal
 *                   form "Sp. z o.o." / "S.A." together with a .pl e-mail
 *                   (form + Polish city is already covered by the city rule).
 *   Czech Republic  "Czech Republic" / "Czechia" / "Czech", or a Czech city.
 *                   "s.r.o." / "a.s." alone never qualify (also Slovak).
 * Fields searched: name, description, industry, source, location (+ email for
 * the legal-form rule). No id-range heuristic, no website, no AI, no network.
 *
 * A lead is NOT changed when:
 *   - it already has a country_id (never overwritten);
 *   - it carries evidence for both countries;
 *   - a Czech match co-occurs with "Slovak"/"Slovakia"/"Bratislava" (the
 *     brief's "no field contradicts it" rule for the s.r.o. ambiguity);
 *   - a human reviewer excluded it (REVIEW_EXCLUDE, reason recorded).
 * Other country names found in the text are printed as a review note so the
 * dry run can be checked row by row.
 *
 * Reversibility: every changed lead gets tag "geo:text", appended in the same
 * UPDATE as the geography (never replacing tags). --revert-text nulls
 * country_id/region_id and removes the tag ONLY where the row still carries
 * the tag AND country_id is still the country this pass assigns to it.
 *
 * Usage:
 *   tsx --env-file=.env scripts/backfill-geography-text.ts                  # dry-run (default)
 *   tsx --env-file=.env scripts/backfill-geography-text.ts --apply
 *   tsx --env-file=.env scripts/backfill-geography-text.ts --revert-text    # dry-run of the undo
 *   tsx --env-file=.env scripts/backfill-geography-text.ts --revert-text --apply
 *   tsx --env-file=.env scripts/backfill-geography-text.ts --revert-text --rollback-test
 *                                   # undo ONE row inside BEGIN…ROLLBACK
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const TEXT_TAG = "geo:text";

type Target = "Poland" | "Czech Republic";

/** Rows a human excluded after reviewing the dry run. id -> reason. */
const REVIEW_EXCLUDE: Record<number, string> = {
  // 2026-09-29 dry-run review: all 26 proposed rows checked by hand, none excluded.
  // (224 Metrodat, Slovak, is held automatically by the Slovak-contradiction rule.)
};

// Word-boundary helper that works with diacritics (JS \b is ASCII-only).
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const rx = (alts: string[]) => new RegExp(`${B}(?:${alts.join("|")})${E}`, "iu");

const PL_COUNTRY = rx(["Poland", "Polska", "Polish"]);
const PL_CITY = rx([
  "Warsaw", "Warszawa", "Kraków", "Krakow", "Cracow", "Wrocław", "Wroclaw",
  "Poznań", "Poznan", "Gdańsk", "Gdansk", "Gdynia", "Łódź", "Lodz", "Toruń",
  "Torun", "Lublin", "Rzeszów", "Rzeszow", "Katowice", "Gliwice",
  "Zielona Góra", "Zielona Gora", "Mielec", "Radom", "Stalowa Wola",
  "Ożarów", "Ozarow", "Piaseczno", "Szczecin", "Bydgoszcz", "Białystok",
  "Bialystok", "Kielce", "Olsztyn", "Opole", "Bielsko-Biała", "Bielsko-Biala",
]);
const PL_FORM = /(?:sp\.\s*z\s*o\.\s*o\.?|(?<![\p{L}])S\.A\.)/iu;
const PL_EMAIL = /@[^\s@]+\.pl\b/i;

const CZ_COUNTRY = rx(["Czech Republic", "Czechia", "Czech"]);
const CZ_CITY = rx([
  "Prague", "Praha", "Brno", "Ostrava", "Plzeň", "Plzen", "Pilsen", "Olomouc",
  "Liberec", "Turnov", "Přerov", "Prerov", "Pardubice", "Hradec Králové",
  "Hradec Kralove", "Jihlava", "Zlín", "Zlin", "České Budějovice",
  "Ceske Budejovice", "Nová Paka", "Nova Paka",
]);
const SK_CONTRA = rx(["Slovak", "Slovakia", "Slovak Republic", "Bratislava"]);

/** Other countries, reported as a review note (not an automatic veto). */
const OTHER_COUNTRY = rx([
  "Germany", "German", "Slovakia", "Slovak", "Hungary", "Hungarian", "Austria",
  "Austrian", "Lithuania", "Latvia", "Estonia", "Ukraine", "Ukrainian",
  "Croatia", "Croatian", "Turkey", "Turkish", "Sweden", "Swedish", "Ireland",
  "Irish", "UK", "United Kingdom", "USA", "United States", "France", "French",
  "Italy", "Spain", "Luxembourg", "Australia", "Israel", "Netherlands",
  "Denmark", "Finland", "Norway", "Switzerland", "Swiss", "Romania",
  "Bulgaria", "Serbia", "Slovenia", "Greece", "Japan", "China",
]);

interface LeadRow {
  id: number;
  name: string;
  email: string | null;
  description: string | null;
  industry: string | null;
  source: string | null;
  location: string | null;
  country_id: number | null;
  tags: string[] | null;
}

interface Finding {
  target: Target | null;
  evidence: string;
  blocked: string | null; // why an otherwise-matching row is not changed
  notes: string[];
}

function snippet(text: string, m: RegExpExecArray, max = 80): string {
  const half = Math.floor((max - m[0].length) / 2);
  let s = Math.max(0, m.index - half);
  let e = Math.min(text.length, s + max);
  s = Math.max(0, e - max);
  return text.slice(s, e).replace(/\s+/g, " ").trim();
}

function firstMatch(fields: [string, string][], re: RegExp): string | null {
  for (const [label, text] of fields) {
    const m = re.exec(text);
    if (m) return `${label}: "${snippet(text, m)}"`;
  }
  return null;
}

function evaluate(l: LeadRow): Finding {
  const fields: [string, string][] = (
    [
      ["name", l.name],
      ["description", l.description],
      ["industry", l.industry],
      ["source", l.source],
      ["location", l.location],
    ] as [string, string | null][]
  ).filter((f): f is [string, string] => !!f[1]);

  const pl =
    firstMatch(fields, PL_COUNTRY) ??
    firstMatch(fields, PL_CITY) ??
    (firstMatch(fields, PL_FORM) && l.email && PL_EMAIL.test(l.email)
      ? `${firstMatch(fields, PL_FORM)} + email .pl`
      : null);
  const cz = firstMatch(fields, CZ_COUNTRY) ?? firstMatch(fields, CZ_CITY);

  const all = fields.map((f) => f[1]).join(" \n ");
  const notes: string[] = [];
  const g = new RegExp(OTHER_COUNTRY.source, "giu");
  const others = new Set<string>();
  for (const m of all.matchAll(g)) others.add(m[0]);
  if (others.size) notes.push(`also mentions: ${[...others].join(", ")}`);

  if (pl && cz) return { target: null, evidence: `${pl} | ${cz}`, blocked: "evidence for both PL and CZ", notes };
  if (cz && SK_CONTRA.test(all)) return { target: null, evidence: cz, blocked: "Czech match but text says Slovak/Slovakia", notes };
  if (pl) return { target: "Poland", evidence: pl, blocked: null, notes };
  if (cz) return { target: "Czech Republic", evidence: cz, blocked: null, notes };
  return { target: null, evidence: "", blocked: null, notes };
}

async function loadCountries() {
  const rows = await prisma.$queryRaw<{ id: number; name: string; region_id: number | null }[]>`
    SELECT id, name, region_id FROM countries WHERE name IN ('Poland', 'Czech Republic')`;
  const map = new Map<Target, { id: number; regionId: number }>();
  for (const r of rows) {
    if (r.region_id == null) throw new Error(`country ${r.name} has no region_id`);
    map.set(r.name as Target, { id: r.id, regionId: r.region_id });
  }
  if (map.size !== 2) throw new Error("Poland / Czech Republic missing from countries");
  return map;
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

class RollbackOnPurpose extends Error {}

async function revertText(apply: boolean, rollbackTest: boolean) {
  const countries = await loadCountries();
  const rows = await prisma.$queryRaw<LeadRow[]>`
    SELECT id, name, email, description, industry, source, location, country_id, tags
      FROM leads WHERE ${TEXT_TAG} = ANY(tags) ORDER BY id`;
  const revertable: { id: number; name: string; countryId: number }[] = [];
  for (const r of rows) {
    const f = evaluate(r);
    const expected = f.target ? countries.get(f.target)!.id : null;
    if (expected == null || r.country_id !== expected) {
      console.log(`  skip ${r.id} ${r.name}: country_id=${r.country_id} is not what this pass set (hand-corrected?)`);
      continue;
    }
    revertable.push({ id: r.id, name: r.name, countryId: expected });
  }
  const mode = rollbackTest ? "ROLLBACK-TEST" : apply ? "APPLY" : "DRY-RUN";
  console.log(`\nbackfill-geography-text --revert-text — ${mode}`);
  console.log(`  tagged ${TEXT_TAG}: ${rows.length}   revertable: ${revertable.length}\n`);

  const revertOne = (tx: Pick<PrismaClient, "$executeRaw">, r: (typeof revertable)[number]) =>
    tx.$executeRaw`
      UPDATE leads
         SET country_id = NULL,
             region_id  = NULL,
             tags       = array_remove(tags, ${TEXT_TAG}),
             updated_at = NOW()
       WHERE id = ${r.id}
         AND country_id = ${r.countryId}
         AND tags IS NOT NULL
         AND ${TEXT_TAG} = ANY(tags)`;

  if (rollbackTest) {
    const probe = revertable[0];
    if (!probe) return console.log("rollback-test: nothing tagged to test against.\n");
    const show = async (label: string, c: Pick<PrismaClient, "$queryRaw">) => {
      const [r] = await c.$queryRaw<{ country_id: number | null; region_id: number | null; tags: string[] | null }[]>`
        SELECT country_id, region_id, tags FROM leads WHERE id = ${probe.id}`;
      console.log(`  ${pad(label, 22)} country_id=${r?.country_id} region_id=${r?.region_id} tags=${JSON.stringify(r?.tags ?? null)}`);
    };
    console.log(`rollback-test on lead ${probe.id} (${probe.name}):`);
    await show("before (committed)", prisma);
    try {
      await prisma.$transaction(async (tx) => {
        console.log(`  ${pad("revert UPDATE", 22)} rows affected = ${await revertOne(tx, probe)}`);
        await show("inside transaction", tx);
        throw new RollbackOnPurpose();
      });
    } catch (e) {
      if (!(e instanceof RollbackOnPurpose)) throw e;
    }
    await show("after rollback", prisma);
    return;
  }
  for (const r of revertable) console.log(`  revert ${r.id} ${r.name}`);
  if (!apply) return console.log("\ndry-run: nothing written. Re-run with --apply to revert.\n");
  const n = await prisma.$transaction(async (tx) => {
    let k = 0;
    for (const r of revertable) k += await revertOne(tx, r);
    return k;
  });
  console.log(`\nreverted ${n} lead(s).\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const KNOWN = ["--apply", "--dry-run", "--revert-text", "--rollback-test"];
  const unknown = argv.filter((a) => !KNOWN.includes(a));
  if (unknown.length) {
    console.error(`error: unknown argument(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const revert = argv.includes("--revert-text");
  const rollbackTest = argv.includes("--rollback-test");
  if (rollbackTest && !revert) {
    console.error("error: --rollback-test is only meaningful with --revert-text");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("error: DATABASE_URL is not set (run with tsx --env-file=.env)");
    process.exit(1);
  }
  if (revert) return revertText(apply, rollbackTest);

  const countries = await loadCountries();
  const leads = await prisma.$queryRaw<LeadRow[]>`
    SELECT id, name, email, description, industry, source, location, country_id, tags
      FROM leads WHERE country_id IS NULL ORDER BY id`;

  const plans: { id: number; name: string; target: Target }[] = [];
  const held: string[] = [];
  console.log(`\nbackfill-geography-text — ${apply ? "APPLY" : "DRY-RUN"}  (uncountried leads scanned: ${leads.length})\n`);
  for (const l of leads) {
    const f = evaluate(l);
    if (!f.target && !f.blocked) continue;
    const note = f.notes.length ? `   [${f.notes.join("; ")}]` : "";
    if (f.blocked) {
      held.push(`  HOLD  ${pad(String(l.id), 4)} ${pad(l.name, 42)} ${f.blocked} — ${f.evidence}${note}`);
      continue;
    }
    if (REVIEW_EXCLUDE[l.id]) {
      held.push(`  EXCL  ${pad(String(l.id), 4)} ${pad(l.name, 42)} ${REVIEW_EXCLUDE[l.id]} — ${f.evidence}`);
      continue;
    }
    plans.push({ id: l.id, name: l.name, target: f.target! });
    console.log(`  SET   ${pad(String(l.id), 4)} ${pad(l.name, 42)} -> ${pad(f.target!, 14)} ${f.evidence}${note}`);
  }
  if (held.length) console.log(`\nnot changed:\n${held.join("\n")}`);
  const byC = (t: Target) => plans.filter((p) => p.target === t).length;
  console.log(`\nproposed: ${plans.length}  (Poland ${byC("Poland")}, Czech Republic ${byC("Czech Republic")}); held/excluded: ${held.length}`);

  if (!apply) return console.log("dry-run: nothing written. Re-run with --apply.\n");

  const written = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const p of plans) {
      const c = countries.get(p.target)!;
      n += await tx.$executeRaw`
        UPDATE leads
           SET country_id = ${c.id},
               region_id  = ${c.regionId},
               tags = CASE
                        WHEN tags IS NULL THEN ARRAY[${TEXT_TAG}]::text[]
                        WHEN ${TEXT_TAG} = ANY(tags) THEN tags
                        ELSE array_append(tags, ${TEXT_TAG})
                      END,
               updated_at = NOW()
         WHERE id = ${p.id} AND country_id IS NULL`;
    }
    return n;
  });
  console.log(`applied: ${written} lead(s) updated and tagged ${TEXT_TAG}.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
