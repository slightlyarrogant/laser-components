/**
 * backfill-city-text.ts — fill leads.location with a CITY named in the lead's
 * OWN text (name + description). Companion to backfill-geography-text.ts; same
 * conventions (dry-run default, tag, guarded revert, BEGIN…ROLLBACK test).
 *
 * Why: claude.ai looped one search_leads call per company hunting for cities
 * that were only written in the descriptions (leads.location empty).
 *
 * Rules
 *   - Only leads whose location IS NULL or blank. A non-empty location is never
 *     overwritten (guarded again in the UPDATE's WHERE).
 *   - Only cities from the curated CITIES table below (built from a scan of the
 *     capitalised tokens that actually occur in descriptions).
 *   - Strong evidence wins: "Warsaw-based", "based/headquartered/located in X",
 *     "HQ in X", "X, Poland" (X followed by its own country), "(X)".
 *     Without a strong match, a bare mention qualifies only if exactly ONE
 *     curated city is mentioned.
 *   - Two different cities with strong evidence -> held (ambiguous).
 *   - If the lead has a country_id and the city belongs to another country ->
 *     held (contradiction).
 *   - REVIEW_EXCLUDE: rows a human rejected after reading the dry run.
 *
 * Writes: location = '<City>' (English exonym where one exists), tag
 * 'geo:city-text' appended in the same UPDATE. --revert-city clears location
 * and the tag ONLY where the row still carries the tag AND location still
 * equals the city this pass assigns.
 *
 * Usage:
 *   tsx --env-file=.env scripts/backfill-city-text.ts                 # dry-run
 *   tsx --env-file=.env scripts/backfill-city-text.ts --apply
 *   tsx --env-file=.env scripts/backfill-city-text.ts --revert-city   # dry-run of undo
 *   tsx --env-file=.env scripts/backfill-city-text.ts --revert-city --apply
 *   tsx --env-file=.env scripts/backfill-city-text.ts --revert-city --rollback-test
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const CITY_TAG = "geo:city-text";

/** Rows a human excluded after reviewing the dry run. id -> reason. */
// 2026-09-29 dry-run review: all 185 proposals read by hand; these 9 rejected.
const REVIEW_EXCLUDE: Record<number, string> = {
  116: "only 'founded at University of Belgrade' — not a location statement",
  135: "text says Novi Travnik (different town from Travnik)",
  209: "'Near Warsaw' — not in Warsaw",
  272: "one of several facilities ('including Hamble (Southampton)')",
  277: "'originated at University of Manchester' — not a location statement",
  281: "'Dalgety Bay near Edinburgh' — not in Edinburgh",
  292: "trade-show venue ('ExCeL London'), not the company's location",
  294: "'Based near Nottingham' — not in Nottingham",
  345: "'near La Plata' — not a precise location",
};

/** canonical city -> [country, ...aliases as they may be written]. */
const CITIES: Record<string, [string, ...string[]]> = {
  // Poland
  Warsaw: ["Poland", "Warszawa"], "Kraków": ["Poland", "Krakow", "Cracow"],
  "Wrocław": ["Poland", "Wroclaw"], "Poznań": ["Poland", "Poznan"],
  "Gdańsk": ["Poland", "Gdansk"], Gdynia: ["Poland"], "Łódź": ["Poland", "Lodz"],
  "Toruń": ["Poland", "Torun"], Lublin: ["Poland"], "Rzeszów": ["Poland", "Rzeszow"],
  Katowice: ["Poland"], Gliwice: ["Poland"], "Zielona Góra": ["Poland", "Zielona Gora"],
  Mielec: ["Poland"], Radom: ["Poland"], "Stalowa Wola": ["Poland"],
  "Ożarów Mazowiecki": ["Poland", "Ozarow Mazowiecki", "Ożarów", "Ozarow"],
  Piaseczno: ["Poland"], Szczecin: ["Poland"], Bydgoszcz: ["Poland"],
  "Białystok": ["Poland", "Bialystok"], Kielce: ["Poland"], Olsztyn: ["Poland"],
  "Bielsko-Biała": ["Poland", "Bielsko-Biala"], "Tarnów": ["Poland", "Tarnow"],
  "Skarżysko-Kamienna": ["Poland", "Skarzysko-Kamienna"], Zielonka: ["Poland"],
  "Dęblin": ["Poland", "Deblin"], Siemianowice: ["Poland"],
  // Czech Republic
  Prague: ["Czech Republic", "Praha"], Brno: ["Czech Republic"], Ostrava: ["Czech Republic"],
  "Plzeň": ["Czech Republic", "Plzen", "Pilsen"], Olomouc: ["Czech Republic"],
  Liberec: ["Czech Republic"], Turnov: ["Czech Republic"], "Přerov": ["Czech Republic", "Prerov"],
  Pardubice: ["Czech Republic"], "Hradec Králové": ["Czech Republic", "Hradec Kralove"],
  Jihlava: ["Czech Republic"], "Zlín": ["Czech Republic", "Zlin"],
  "České Budějovice": ["Czech Republic", "Ceske Budejovice"], "Nová Paka": ["Czech Republic", "Nova Paka"],
  "Náchod": ["Czech Republic", "Nachod"], "Šternberk": ["Czech Republic", "Sternberk"],
  "Vyškov": ["Czech Republic", "Vyskov"], "Bechyně": ["Czech Republic", "Bechyne"],
  Lochovice: ["Czech Republic"], "Staré Město": ["Czech Republic", "Stare Mesto"], "Uherský Brod": ["Czech Republic", "Uhersky Brod"],
  // Slovakia
  Bratislava: ["Slovakia"], "Košice": ["Slovakia", "Kosice"], "Žilina": ["Slovakia", "Zilina"],
  "Dubnica nad Váhom": ["Slovakia", "Dubnica nad Vahom"], "Moldava nad Bodvou": ["Slovakia"],
  "Banská Bystrica": ["Slovakia", "Banska Bystrica"], "Trenčín": ["Slovakia", "Trencin"],
  // Hungary / Austria
  Budapest: ["Hungary"], Szeged: ["Hungary"], "Gödöllő": ["Hungary", "Godollo", "Gödöllö"],
  Vienna: ["Austria", "Wien"], Linz: ["Austria"], Graz: ["Austria"], Innsbruck: ["Austria"],
  Absam: ["Austria"], "Premstätten": ["Austria", "Premstaetten"], Guntramsdorf: ["Austria"],
  "Götzis": ["Austria", "Goetzis"],
  // Baltics / Ukraine
  Tallinn: ["Estonia"], Tartu: ["Estonia"], Vilnius: ["Lithuania"], Kaunas: ["Lithuania"],
  Riga: ["Latvia"], Kyiv: ["Ukraine", "Kiev"], Kharkiv: ["Ukraine"], Lviv: ["Ukraine"],
  // Balkans
  Ljubljana: ["Slovenia"], "Šentjernej": ["Slovenia", "Sentjernej"],
  "Ajdovščina": ["Slovenia", "Ajdovscina"], Zagreb: ["Croatia"], Osijek: ["Croatia"],
  Split: ["Croatia"], Rijeka: ["Croatia"], Sarajevo: ["Bosnia and Herzegovina"],
  "Teslić": ["Bosnia and Herzegovina", "Teslic"], Travnik: ["Bosnia and Herzegovina"],
  Belgrade: ["Serbia", "Beograd"], "Pančevo": ["Serbia", "Pancevo"], Zemun: ["Serbia"],
  "Kuršumlija": ["Serbia", "Kursumlija", "Kurzumlija"], "Novi Sad": ["Serbia"],
  Tirana: ["Albania"], Skopje: ["North Macedonia"],
  Bucharest: ["Romania"], Brasov: ["Romania", "Brașov"], "Cluj-Napoca": ["Romania", "Cluj"],
  Sofia: ["Bulgaria"], Kazanlak: ["Bulgaria"], Samokov: ["Bulgaria"], Panagyurishte: ["Bulgaria"],
  Plovdiv: ["Bulgaria"],
  // Greece / Turkey
  Athens: ["Greece"], Thessaloniki: ["Greece"], Koropi: ["Greece"], Larissa: ["Greece"],
  Heraklion: ["Greece"], Pallini: ["Greece"],
  Ankara: ["Turkey"], Istanbul: ["Turkey"], Izmir: ["Turkey"], Konya: ["Turkey"],
  // UK / Ireland
  London: ["United Kingdom"], Edinburgh: ["United Kingdom"], Glasgow: ["United Kingdom"],
  Belfast: ["United Kingdom"], Manchester: ["United Kingdom"], Nottingham: ["United Kingdom"],
  Northampton: ["United Kingdom"], Glenrothes: ["United Kingdom"], Luton: ["United Kingdom"],
  Basildon: ["United Kingdom"], Horsham: ["United Kingdom"], Sheffield: ["United Kingdom"],
  Ilminster: ["United Kingdom"], Hamble: ["United Kingdom"], Southampton: ["United Kingdom"],
  "Wotton-under-Edge": ["United Kingdom"], Ruddington: ["United Kingdom"],
  Cardiff: ["United Kingdom"], Sedgefield: ["United Kingdom"], Abingdon: ["United Kingdom"],
  "Newcastle upon Tyne": ["United Kingdom", "Newcastle"], Harlow: ["United Kingdom"],
  Romsey: ["United Kingdom"], Bristol: ["United Kingdom"], Birmingham: ["United Kingdom"],
  Cambridge: ["United Kingdom"], Livingston: ["United Kingdom"], Stevenage: ["United Kingdom"],
  Farnborough: ["United Kingdom"], Malvern: ["United Kingdom"], Bedford: ["United Kingdom"],
  Dublin: ["Ireland"], Cork: ["Ireland"], Galway: ["Ireland"], Limerick: ["Ireland"],
  Tuam: ["Ireland"], Leixlip: ["Ireland"], Fermoy: ["Ireland"], Sandyford: ["Ireland"],
  Shannon: ["Ireland"],
  // Nordics
  Stockholm: ["Sweden"], Gothenburg: ["Sweden", "Göteborg"], "Linköping": ["Sweden", "Linkoping"],
  "Malmö": ["Sweden", "Malmo"], Copenhagen: ["Denmark"], Oslo: ["Norway"], Asker: ["Norway"],
  Helsinki: ["Finland"], Tampere: ["Finland"], Espoo: ["Finland"], Oulu: ["Finland"],
  // Australia / NZ
  Sydney: ["Australia"], Melbourne: ["Australia"], Adelaide: ["Australia"], Perth: ["Australia"],
  Brisbane: ["Australia"], Canberra: ["Australia"], Derrimut: ["Australia"],
  Auckland: ["New Zealand"], Wellington: ["New Zealand"], Christchurch: ["New Zealand"],
  // Latin America
  "São Paulo": ["Brazil", "Sao Paulo"], "Rio de Janeiro": ["Brazil"],
  "São José dos Campos": ["Brazil", "Sao Jose dos Campos"], Campinas: ["Brazil"],
  "Florianópolis": ["Brazil", "Florianopolis"], "Brasília": ["Brazil", "Brasilia"],
  "Buenos Aires": ["Argentina"], Bariloche: ["Argentina", "San Carlos de Bariloche"],
  "Córdoba": ["Argentina", "Cordoba"], "La Plata": ["Argentina"],
  Santiago: ["Chile"], "Valparaíso": ["Chile", "Valparaiso"], Providencia: ["Chile"],
  "Bogotá": ["Colombia", "Bogota"], "Medellín": ["Colombia", "Medellin"], Cartagena: ["Colombia"],
  Lima: ["Peru"], Callao: ["Peru"], Chimbote: ["Peru"], Iquitos: ["Peru"],
  Caracas: ["Venezuela"], Quito: ["Ecuador"],
  "Querétaro": ["Mexico", "Queretaro"], Puebla: ["Mexico"], Aguascalientes: ["Mexico"],
  "Mexico City": ["Mexico"], Guadalajara: ["Mexico"], Monterrey: ["Mexico"],
};

// Word-boundary helpers that work with diacritics (JS \b is ASCII-only).
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface CityPat { city: string; country: string; any: RegExp; strong: RegExp[] }

const PATTERNS: CityPat[] = Object.entries(CITIES).map(([city, [country, ...aliases]]) => {
  // Case-sensitive on the city itself (capitalised proper noun), so "split",
  // "reading", "nice" as ordinary words never match.
  const names = [city, ...aliases].sort((a, b) => b.length - a.length).map(esc).join("|");
  const c = `(?:${names})`;
  const cc = esc(country);
  return {
    city,
    country,
    any: new RegExp(`${B}${c}${E}`, "u"),
    strong: [
      new RegExp(`${B}${c}-based${E}`, "u"),
      new RegExp(`(?:[Bb]ased|[Hh]eadquartered|HQ|[Ll]ocated|[Hh]eadquarters|[Ss]ituated|[Ff]acility|[Pp]lant|[Oo]ffice)\\s+(?:is\\s+)?(?:in|at)\\s+(?:the\\s+)?${c}${E}`, "u"),
      new RegExp(`${B}${c},\\s*(?:${cc}|UK|England|Scotland|Wales|Northern Ireland|Co\\.)`, "u"),
      new RegExp(`\\(\\s*${c}\\s*[,)]`, "u"),
    ],
  };
});

interface LeadRow {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  country: string | null;
  tags: string[] | null;
}

interface Finding { city: string | null; evidence: string; blocked: string | null }

function snippet(text: string, idx: number, len: number, max = 60): string {
  const half = Math.floor((max - len) / 2);
  let s = Math.max(0, idx - half);
  const e = Math.min(text.length, s + max);
  s = Math.max(0, e - max);
  return text.slice(s, e).replace(/\s+/g, " ").trim();
}

function evaluate(l: LeadRow): Finding {
  const text = [l.name, l.description ?? ""].join(" \n ");
  const strong = new Map<string, string>();
  const mentioned = new Map<string, string>();
  for (const p of PATTERNS) {
    for (const re of p.strong) {
      const m = re.exec(text);
      if (m) { strong.set(p.city, snippet(text, m.index, m[0].length)); break; }
    }
    const m = p.any.exec(text);
    if (m) mentioned.set(p.city, snippet(text, m.index, m[0].length));
  }
  // "Newcastle" alone is also contained in "Newcastle upon Tyne" etc.: dedupe by
  // dropping a city whose every alias hit is inside a longer city's hit.
  let city: string | null = null;
  let evidence = "";
  let kind = "";
  if (strong.size === 1) {
    [[city, evidence]] = [...strong];
    kind = "strong";
  } else if (strong.size > 1) {
    return { city: null, evidence: [...strong].map(([c, e]) => `${c}: "${e}"`).join(" | "), blocked: "several cities with strong evidence" };
  } else if (mentioned.size === 1) {
    [[city, evidence]] = [...mentioned];
    kind = "mention";
  } else if (mentioned.size > 1) {
    return { city: null, evidence: [...mentioned.keys()].join(", "), blocked: "several cities mentioned, none strong" };
  } else {
    return { city: null, evidence: "", blocked: null };
  }
  const cityCountry = CITIES[city!][0];
  if (l.country && l.country !== cityCountry) {
    return { city: null, evidence: `${city} (${cityCountry}): "${evidence}"`, blocked: `lead country is ${l.country}` };
  }
  return { city, evidence: `${kind}: "${evidence}"`, blocked: null };
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

async function loadLeads(where: "empty" | "tagged") {
  const rows = await prisma.$queryRaw<LeadRow[]>`
    SELECT l.id, l.name, l.description, l.location, c.name AS country, l.tags
      FROM leads l LEFT JOIN countries c ON c.id = l.country_id
     ORDER BY l.id`;
  return where === "empty"
    ? rows.filter((r) => !r.location || !r.location.trim())
    : rows.filter((r) => r.tags?.includes(CITY_TAG));
}

class RollbackOnPurpose extends Error {}

async function revertCity(apply: boolean, rollbackTest: boolean) {
  const rows = await loadLeads("tagged");
  const revertable: { id: number; name: string; city: string }[] = [];
  for (const r of rows) {
    const f = evaluate({ ...r, location: null });
    if (!f.city || r.location !== f.city) {
      console.log(`  skip ${r.id} ${r.name}: location=${JSON.stringify(r.location)} is not what this pass set (hand-corrected?)`);
      continue;
    }
    revertable.push({ id: r.id, name: r.name, city: f.city });
  }
  const mode = rollbackTest ? "ROLLBACK-TEST" : apply ? "APPLY" : "DRY-RUN";
  console.log(`\nbackfill-city-text --revert-city — ${mode}`);
  console.log(`  tagged ${CITY_TAG}: ${rows.length}   revertable: ${revertable.length}\n`);

  const revertOne = (tx: Pick<PrismaClient, "$executeRaw">, r: (typeof revertable)[number]) =>
    tx.$executeRaw`
      UPDATE leads
         SET location   = NULL,
             tags       = array_remove(tags, ${CITY_TAG}),
             updated_at = NOW()
       WHERE id = ${r.id}
         AND location = ${r.city}
         AND tags IS NOT NULL
         AND ${CITY_TAG} = ANY(tags)`;

  if (rollbackTest) {
    const probe = revertable[0];
    if (!probe) return console.log("rollback-test: nothing tagged to test against.\n");
    const show = async (label: string, c: Pick<PrismaClient, "$queryRaw">) => {
      const [r] = await c.$queryRaw<{ location: string | null; tags: string[] | null }[]>`
        SELECT location, tags FROM leads WHERE id = ${probe.id}`;
      console.log(`  ${pad(label, 22)} location=${JSON.stringify(r?.location)} tags=${JSON.stringify(r?.tags ?? null)}`);
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
  for (const r of revertable) console.log(`  revert ${r.id} ${r.name} (${r.city})`);
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
  const KNOWN = ["--apply", "--dry-run", "--revert-city", "--rollback-test"];
  const unknown = argv.filter((a) => !KNOWN.includes(a));
  if (unknown.length) {
    console.error(`error: unknown argument(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const revert = argv.includes("--revert-city");
  const rollbackTest = argv.includes("--rollback-test");
  if (rollbackTest && !revert) {
    console.error("error: --rollback-test is only meaningful with --revert-city");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("error: DATABASE_URL is not set (run with tsx --env-file=.env)");
    process.exit(1);
  }
  if (revert) return revertCity(apply, rollbackTest);

  const leads = await loadLeads("empty");
  const plans: { id: number; name: string; city: string; country: string; evidence: string }[] = [];
  const held: string[] = [];
  console.log(`\nbackfill-city-text — ${apply ? "APPLY" : "DRY-RUN"}  (leads with empty location: ${leads.length})\n`);
  for (const l of leads) {
    const f = evaluate(l);
    if (!f.city && !f.blocked) continue;
    if (f.blocked) {
      held.push(`  HOLD  ${pad(String(l.id), 4)} ${pad(l.name, 36)} ${f.blocked} — ${f.evidence}`);
      continue;
    }
    if (REVIEW_EXCLUDE[l.id]) {
      held.push(`  EXCL  ${pad(String(l.id), 4)} ${pad(l.name, 36)} ${REVIEW_EXCLUDE[l.id]} — ${f.city} ${f.evidence}`);
      continue;
    }
    const country = l.country ?? CITIES[f.city!][0];
    plans.push({ id: l.id, name: l.name, city: f.city!, country, evidence: f.evidence });
    console.log(`  SET   ${pad(String(l.id), 4)} ${pad(l.name, 36)} -> ${pad(f.city!, 18)} ${pad(l.country ?? "-", 14)} ${f.evidence}`);
  }
  if (held.length) console.log(`\nnot changed:\n${held.join("\n")}`);
  const byCountry: Record<string, number> = {};
  for (const p of plans) byCountry[p.country] = (byCountry[p.country] ?? 0) + 1;
  console.log(`\nproposed: ${plans.length}; held/excluded: ${held.length}`);
  console.log(`by country: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}`);

  if (!apply) return console.log("dry-run: nothing written. Re-run with --apply.\n");

  const written = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const p of plans) {
      n += await tx.$executeRaw`
        UPDATE leads
           SET location = ${p.city},
               tags = CASE
                        WHEN tags IS NULL THEN ARRAY[${CITY_TAG}]::text[]
                        WHEN ${CITY_TAG} = ANY(tags) THEN tags
                        ELSE array_append(tags, ${CITY_TAG})
                      END,
               updated_at = NOW()
         WHERE id = ${p.id} AND (location IS NULL OR btrim(location) = '')`;
    }
    return n;
  });
  console.log(`applied: ${written} lead(s) updated and tagged ${CITY_TAG}.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
