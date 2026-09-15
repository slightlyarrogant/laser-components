/**
 * backfill-geography.ts — one-off backfill of lead geography (country + region).
 *
 * Deterministic only. No AI, no network, no guessing: a location either maps
 * through an explicit table or it is reported as unmatched for a human to fix.
 * A wrong region is worse than an unmatched lead.
 *
 * Sources of geography, in priority order:
 *   1. leads.location  — "City, Country" or "Country". Always used.
 *   2. leads.website   — country-code TLD (.pl, .cz, .com.br, .co.jp ...).
 *                        OPT-IN via --use-website-tld. It is an inference about
 *                        where the site is registered, not a recorded fact, so
 *                        it stays off unless explicitly asked for.
 *
 * What it writes:
 *   - lead.country_id IS NULL + parsable source -> set country_id AND region_id
 *   - lead.country_id IS NOT NULL + region_id IS NULL -> set region_id from the country
 *   - an existing non-null country_id is NEVER overwritten.
 *
 * Reversibility: every lead whose geography comes from the ccTLD inference is
 * tagged "geo:tld". That tag is the audit trail and the undo key — --revert-tld
 * clears country_id/region_id and removes the tag, but ONLY on rows that still
 * carry the tag AND still point at the country their own TLD implies. A row
 * someone has since corrected by hand is left alone. Tags on rows this script
 * does not change are never touched.
 *
 * Usage:
 *   tsx --env-file=.env scripts/backfill-geography.ts                      # dry-run (default)
 *   tsx --env-file=.env scripts/backfill-geography.ts --apply
 *   tsx --env-file=.env scripts/backfill-geography.ts --use-website-tld    # dry-run incl. TLD source
 *   tsx --env-file=.env scripts/backfill-geography.ts --use-website-tld --apply
 *   tsx --env-file=.env scripts/backfill-geography.ts --revert-tld         # dry-run of the undo
 *   tsx --env-file=.env scripts/backfill-geography.ts --revert-tld --apply
 *   tsx --env-file=.env scripts/backfill-geography.ts --revert-tld --rollback-test
 *                                       # exercise the undo on ONE row inside a
 *                                       # transaction that is then rolled back
 *
 * Prerequisite: db/seed/regions-countries.sql has been applied.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/**
 * Marker tag written on (and only on) leads whose geography was inferred from
 * the website ccTLD. It is what makes the TLD pass reversible.
 */
const TLD_TAG = "geo:tld";

/* ------------------------------------------------------------------ *
 * Synonym map: normalised input -> canonical country name in `countries`.
 * Keys are normalised the same way as the input (lowercase, diacritics
 * stripped, punctuation and extra whitespace removed).
 * ------------------------------------------------------------------ */
const COUNTRY_SYNONYMS: Record<string, string> = {
  // United Kingdom
  uk: "United Kingdom",
  "u k": "United Kingdom",
  gb: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  "northern ireland": "United Kingdom",
  "united kingdom of great britain and northern ireland": "United Kingdom",
  // United States
  usa: "United States",
  us: "United States",
  "u s": "United States",
  "u s a": "United States",
  america: "United States",
  "united states of america": "United States",
  "the united states": "United States",
  // Germany
  deutschland: "Germany",
  brd: "Germany",
  // Czech Republic
  czechia: "Czech Republic",
  "czech rep": "Czech Republic",
  "czech republic": "Czech Republic",
  cesko: "Czech Republic",
  // Turkey
  turkiye: "Turkey",
  turkey: "Turkey",
  // Korea
  korea: "South Korea",
  "s korea": "South Korea",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "korea republic of": "South Korea",
  rok: "South Korea",
  // Bosnia
  bosnia: "Bosnia and Herzegovina",
  "bosnia herzegovina": "Bosnia and Herzegovina",
  "bosnia and herzegovina": "Bosnia and Herzegovina",
  "bosnia hercegovina": "Bosnia and Herzegovina",
  bih: "Bosnia and Herzegovina",
  // Others seen in this kind of data
  polska: "Poland",
  espana: "Spain",
  italia: "Italy",
  osterreich: "Austria",
  oesterreich: "Austria",
  hrvatska: "Croatia",
  srbija: "Serbia",
  slovensko: "Slovakia",
  slovenija: "Slovenia",
  magyarorszag: "Hungary",
  romania: "Romania",
  ellada: "Greece",
  hellas: "Greece",
  suomi: "Finland",
  sverige: "Sweden",
  norge: "Norway",
  danmark: "Denmark",
  eesti: "Estonia",
  latvija: "Latvia",
  ukraine: "Ukraine",
  brasil: "Brazil",
  "nova zelandia": "New Zealand",
  nz: "New Zealand",
  aus: "Australia",
  // NOTE: the following resolve to countries that are NOT seeded yet; they are
  // listed so the script reports them as "known country, missing from the
  // countries table" rather than as an unparsable string.
  holland: "Netherlands",
  "the netherlands": "Netherlands",
  nederland: "Netherlands",
  netherlands: "Netherlands",
  "n l": "Netherlands",
  schweiz: "Switzerland",
  suisse: "Switzerland",
  switzerland: "Switzerland",
  belgie: "Belgium",
  belgique: "Belgium",
  belgium: "Belgium",
  portugal: "Portugal",
  lietuva: "Lithuania",
  lithuania: "Lithuania",
  macedonia: "North Macedonia",
  "north macedonia": "North Macedonia",
  israel: "Israel",
  uae: "United Arab Emirates",
  "u a e": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "saudi arabia": "Saudi Arabia",
  ksa: "Saudi Arabia",
  "south africa": "South Africa",
  rsa: "South Africa",
  egypt: "Egypt",
  morocco: "Morocco",
  nigeria: "Nigeria",
  russia: "Russia",
  "russian federation": "Russia",
};

/* ------------------------------------------------------------------ *
 * Country-code TLD -> ISO 3166-1 alpha-2, allowlist only.
 * Allowlist (not blocklist) on purpose: a TLD absent here is simply not used,
 * which keeps vanity TLDs (.ai .io .me .tv .tech .energy .abb .canon) out.
 * ------------------------------------------------------------------ */
const CC_TLD_TO_ISO: Record<string, string> = {
  al: "AL", ar: "AR", at: "AT", au: "AU", ba: "BA", bg: "BG", br: "BR",
  ca: "CA", cl: "CL", cn: "CN", cz: "CZ", de: "DE", dk: "DK", ee: "EE",
  es: "ES", fi: "FI", fr: "FR", gr: "GR", hr: "HR", hu: "HU", ie: "IE",
  in: "IN", it: "IT", jp: "JP", kr: "KR", lv: "LV", mx: "MX", nl: "NL",
  no: "NO", nz: "NZ", pe: "PE", pl: "PL", pt: "PT", ro: "RO", rs: "RS",
  se: "SE", si: "SI", sk: "SK", tr: "TR", ua: "UA", uk: "GB", us: "US",
  ve: "VE",
};

/**
 * `.co` is Colombia but is also sold as a vanity TLD worldwide, so a bare
 * `.co` is never trusted — only Colombia's own second-level domains are.
 */
const CO_SECOND_LEVEL = [".com.co", ".gov.co", ".edu.co", ".org.co", ".net.co", ".mil.co"];

/** Lowercase, strip diacritics, drop punctuation, collapse whitespace. */
function normalise(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Trailing segment of a location: everything after the last comma. */
function trailingSegment(location: string): string {
  const idx = location.lastIndexOf(",");
  return (idx >= 0 ? location.slice(idx + 1) : location).trim();
}

/** Hostname of a URL, lowercase, no leading "www.". Null if unparsable. */
function hostOf(website: string): string | null {
  const raw = website.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** ISO code inferred from a website's country-code TLD, or null. */
function isoFromWebsite(website: string): string | null {
  const host = hostOf(website);
  if (!host) return null;
  if (CO_SECOND_LEVEL.some((s) => host.endsWith(s))) return "CO";
  const tld = host.slice(host.lastIndexOf(".") + 1);
  return CC_TLD_TO_ISO[tld] ?? null;
}

type CountryRow = { id: number; name: string; code: string; regionId: number };
type RegionRow = { id: number; name: string };

type Resolution =
  | { kind: "matched"; country: CountryRow; via: string; token: string }
  | { kind: "known-country-not-seeded"; canonical: string; token: string }
  | { kind: "unmatched"; token: string };

function buildResolver(countries: CountryRow[]) {
  const byNormalisedName = new Map<string, CountryRow>();
  const byCode = new Map<string, CountryRow>();
  for (const c of countries) {
    byNormalisedName.set(normalise(c.name), c);
    byCode.set(c.code.toUpperCase(), c);
  }

  /** Resolve a free-text country token. Deterministic; no fuzzy matching. */
  function resolveToken(rawToken: string): Resolution {
    const token = rawToken.trim();
    if (!token) return { kind: "unmatched", token: rawToken };
    const key = normalise(token);
    if (!key) return { kind: "unmatched", token };

    const canonical = COUNTRY_SYNONYMS[key];
    if (canonical) {
      const hit = byNormalisedName.get(normalise(canonical));
      return hit
        ? { kind: "matched", country: hit, via: "location", token }
        : { kind: "known-country-not-seeded", canonical, token };
    }

    const direct = byNormalisedName.get(key);
    if (direct) return { kind: "matched", country: direct, via: "location", token };

    // A bare 2-letter token is only accepted as an ISO code, never guessed.
    if (/^[a-z]{2}$/.test(key)) {
      const byIso = byCode.get(key.toUpperCase());
      if (byIso) return { kind: "matched", country: byIso, via: "location", token };
    }
    return { kind: "unmatched", token };
  }

  function resolveIso(iso: string): CountryRow | null {
    return byCode.get(iso.toUpperCase()) ?? null;
  }

  return { resolveToken, resolveIso };
}

type Plan = {
  leadId: number;
  name: string;
  source: string; // the text the decision was made from
  via: "location" | "website-tld" | "existing country_id";
  country: CountryRow;
  region: RegionRow;
  setsCountry: boolean;
  setsRegion: boolean;
  /** true only for TLD-inferred rows: they get the reversibility marker tag. */
  tagsAsTld: boolean;
};

type Unresolved = {
  leadId: number;
  name: string;
  source: string;
  reason: string;
};

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

/** Thrown to force a deliberate rollback in --rollback-test. Not an error. */
class RollbackTest extends Error {
  constructor() {
    super("rollback-test: rolling back on purpose");
  }
}

/**
 * Undo the ccTLD pass.
 *
 * A row is reverted only if BOTH hold:
 *   - it still carries the "geo:tld" tag, and
 *   - its country_id still equals the country its own website TLD implies.
 * Anything a human has corrected since is reported and left untouched.
 */
async function revertTld(apply: boolean, rollbackTest: boolean): Promise<void> {
  const countries = await prisma.country.findMany({
    select: { id: true, name: true, code: true, regionId: true },
  });
  const { resolveIso } = buildResolver(countries);

  const tagged = await prisma.lead.findMany({
    where: { tags: { has: TLD_TAG } },
    select: { id: true, name: true, website: true, countryId: true, regionId: true },
    orderBy: { id: "asc" },
  });

  type Revertable = { leadId: number; name: string; website: string; countryId: number };
  const revertable: Revertable[] = [];
  const kept: { leadId: number; name: string; reason: string }[] = [];

  for (const lead of tagged) {
    const iso = lead.website ? isoFromWebsite(lead.website) : null;
    const implied = iso ? resolveIso(iso) : null;
    if (!implied) {
      kept.push({
        leadId: lead.id,
        name: lead.name,
        reason: "website no longer implies a country — tag left in place",
      });
      continue;
    }
    if (lead.countryId !== implied.id) {
      kept.push({
        leadId: lead.id,
        name: lead.name,
        reason: `country_id changed since the backfill (now ${lead.countryId ?? "null"}, TLD implies ${implied.id}) — corrected by hand, left alone`,
      });
      continue;
    }
    revertable.push({
      leadId: lead.id,
      name: lead.name,
      website: lead.website ?? "",
      countryId: implied.id,
    });
  }

  const mode = rollbackTest ? "ROLLBACK-TEST" : apply ? "APPLY" : "DRY-RUN";
  console.log(`\nbackfill-geography --revert-tld — ${mode}\n`);
  console.log(`  tagged "${TLD_TAG}" ........... ${tagged.length}`);
  console.log(`  revertable ................. ${revertable.length}`);
  console.log(`  kept (changed by hand) ..... ${kept.length}`);
  for (const k of kept) console.log(`    lead ${k.leadId} ${k.name}: ${k.reason}`);
  console.log("");

  /** The single UPDATE the revert is made of. Guards live in the WHERE clause. */
  async function revertOne(
    tx: Pick<PrismaClient, "$executeRaw">,
    r: Revertable
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE leads
         SET country_id = NULL,
             region_id  = NULL,
             tags       = array_remove(tags, ${TLD_TAG}),
             updated_at = NOW()
       WHERE id = ${r.leadId}
         AND country_id = ${r.countryId}
         AND tags IS NOT NULL
         AND ${TLD_TAG} = ANY(tags)`;
  }

  if (rollbackTest) {
    const probe = revertable[0];
    if (!probe) {
      console.log("rollback-test: nothing tagged to test against.\n");
      return;
    }
    const show = async (label: string, client: Pick<PrismaClient, "$queryRaw">) => {
      const rows = await client.$queryRaw<
        { id: number; country_id: number | null; region_id: number | null; tags: string[] | null }[]
      >`SELECT id, country_id, region_id, tags FROM leads WHERE id = ${probe.leadId}`;
      const r = rows[0];
      console.log(
        `  ${pad(label, 22)} country_id=${String(r?.country_id)} region_id=${String(
          r?.region_id
        )} tags=${JSON.stringify(r?.tags ?? null)}`
      );
    };

    console.log(`rollback-test on lead ${probe.leadId} (${probe.name}):`);
    await show("before (committed)", prisma);
    try {
      await prisma.$transaction(async (tx) => {
        const n = await revertOne(tx, probe);
        console.log(`  ${pad("revert UPDATE", 22)} rows affected = ${n}`);
        await show("inside transaction", tx);
        throw new RollbackTest();
      });
    } catch (err) {
      if (!(err instanceof RollbackTest)) throw err;
      console.log(`  ${pad("ROLLBACK issued", 22)} (deliberate)`);
    }
    await show("after rollback", prisma);
    console.log("\nrollback-test: the row is unchanged — revert works and undoes cleanly.\n");
    return;
  }

  if (!apply) {
    console.log("dry-run: nothing written. Re-run with --apply to revert.\n");
    return;
  }

  const reverted = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const r of revertable) n += await revertOne(tx, r);
    return n;
  });
  console.log(`reverted ${reverted} lead(s); ${revertable.length - reverted} skipped.\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const KNOWN = [
    "--apply",
    "--dry-run",
    "--use-website-tld",
    "--revert-tld",
    "--rollback-test",
  ];
  const unknown = argv.filter((a) => !KNOWN.includes(a));
  if (unknown.length > 0) {
    console.error(`error: unknown argument(s): ${unknown.join(", ")}`);
    console.error(
      "usage: tsx --env-file=.env scripts/backfill-geography.ts " +
        "[--apply] [--use-website-tld] | --revert-tld [--apply|--rollback-test]"
    );
    process.exit(1);
  }
  const apply = argv.includes("--apply");
  const useTld = argv.includes("--use-website-tld");
  const revert = argv.includes("--revert-tld");
  const rollbackTest = argv.includes("--rollback-test");

  if (rollbackTest && !revert) {
    console.error("error: --rollback-test is only meaningful with --revert-tld");
    process.exit(1);
  }
  if (revert && useTld) {
    console.error("error: --revert-tld and --use-website-tld are opposites");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("error: DATABASE_URL is not set (run with tsx --env-file=.env)");
    process.exit(1);
  }

  if (revert) {
    await revertTld(apply, rollbackTest);
    return;
  }

  const [countries, regions, leads] = await Promise.all([
    prisma.country.findMany({
      select: { id: true, name: true, code: true, regionId: true },
      orderBy: { id: "asc" },
    }),
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.lead.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        website: true,
        countryId: true,
        regionId: true,
        tags: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const regionById = new Map<number, RegionRow>(regions.map((r) => [r.id, r]));
  const countryById = new Map<number, CountryRow>(countries.map((c) => [c.id, c]));
  const { resolveToken, resolveIso } = buildResolver(countries);

  const plans: Plan[] = [];
  const unresolved: Unresolved[] = [];
  let alreadyComplete = 0;
  let noSignal = 0;

  for (const lead of leads) {
    // Case A: country already known -> only region may need filling.
    if (lead.countryId !== null) {
      if (lead.regionId !== null) {
        alreadyComplete++;
        continue;
      }
      const country = countryById.get(lead.countryId);
      const region = country ? regionById.get(country.regionId) : undefined;
      if (!country || !region) {
        unresolved.push({
          leadId: lead.id,
          name: lead.name,
          source: `country_id=${lead.countryId}`,
          reason: "country_id points at a country or region that does not exist",
        });
        continue;
      }
      plans.push({
        leadId: lead.id,
        name: lead.name,
        source: lead.location ?? `country_id=${lead.countryId}`,
        via: "existing country_id",
        country,
        region,
        setsCountry: false,
        setsRegion: true,
        tagsAsTld: false,
      });
      continue;
    }

    // Case B: no country -> derive it from location, then optionally from the TLD.
    const location = lead.location?.trim();
    if (location) {
      const res = resolveToken(trailingSegment(location));
      if (res.kind === "matched") {
        const region = regionById.get(res.country.regionId);
        if (!region) {
          unresolved.push({
            leadId: lead.id,
            name: lead.name,
            source: location,
            reason: `country ${res.country.name} has no valid region`,
          });
          continue;
        }
        plans.push({
          leadId: lead.id,
          name: lead.name,
          source: location,
          via: "location",
          country: res.country,
          region,
          setsCountry: true,
          setsRegion: true,
          tagsAsTld: false,
        });
        continue;
      }
      unresolved.push({
        leadId: lead.id,
        name: lead.name,
        source: location,
        reason:
          res.kind === "known-country-not-seeded"
            ? `resolves to "${res.canonical}", which is not in the countries table`
            : `trailing segment "${res.token}" is not a known country`,
      });
      continue;
    }

    // Case C: no location at all.
    if (useTld && lead.website) {
      const iso = isoFromWebsite(lead.website);
      const country = iso ? resolveIso(iso) : null;
      const region = country ? regionById.get(country.regionId) : undefined;
      if (country && region) {
        plans.push({
          leadId: lead.id,
          name: lead.name,
          source: lead.website,
          via: "website-tld",
          country,
          region,
          setsCountry: true,
          setsRegion: true,
          tagsAsTld: true,
        });
        continue;
      }
      unresolved.push({
        leadId: lead.id,
        name: lead.name,
        source: lead.website,
        reason: iso
          ? `TLD maps to ${iso}, which is not in the countries table`
          : "no country-code TLD (generic or vanity domain)",
      });
      continue;
    }

    noSignal++;
  }

  /* ---------------------------- report ---------------------------- */
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(
    `\nbackfill-geography — ${mode}${useTld ? " (+ website ccTLD inference)" : ""}`
  );
  console.log(
    `leads=${leads.length} countries=${countries.length} regions=${regions.length}\n`
  );

  if (plans.length > 0) {
    console.log(
      `${pad("lead", 6)}${pad("source", 42)}${pad("via", 20)}${pad("-> country", 26)}${pad("region", 16)}sets`
    );
    console.log("-".repeat(118));
    for (const p of plans) {
      const sets = [p.setsCountry ? "country" : null, p.setsRegion ? "region" : null]
        .filter(Boolean)
        .join("+");
      console.log(
        pad(String(p.leadId), 6) +
          pad(p.source, 42) +
          pad(p.via, 20) +
          pad(`-> ${p.country.name} (${p.country.code})`, 26) +
          pad(p.region.name, 16) +
          sets
      );
    }
    console.log("");
  } else {
    console.log("no lead needs a change.\n");
  }

  const byRegion = new Map<string, number>();
  for (const p of plans) byRegion.set(p.region.name, (byRegion.get(p.region.name) ?? 0) + 1);

  console.log("summary");
  console.log(`  planned changes ............ ${plans.length}`);
  console.log(`    country + region set ..... ${plans.filter((p) => p.setsCountry).length}`);
  console.log(`    region only (had country)  ${plans.filter((p) => !p.setsCountry).length}`);
  console.log(`  already complete ........... ${alreadyComplete}`);
  console.log(`  unresolved (reported below)  ${unresolved.length}`);
  console.log(`  no geography signal at all . ${noSignal}`);
  if (byRegion.size > 0) {
    console.log("  planned region distribution:");
    for (const [name, n] of [...byRegion].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${pad(name, 18)} ${n}`);
    }
  }
  console.log("");

  if (unresolved.length > 0) {
    console.log(`unmatched — ${unresolved.length} lead(s), fix by hand via update_lead:`);
    for (const u of unresolved) {
      console.log(`  lead ${pad(String(u.leadId), 5)} ${pad(u.name, 38)} "${u.source}" — ${u.reason}`);
    }
    console.log("");
  }

  if (!apply) {
    console.log("dry-run: nothing written. Re-run with --apply to write.\n");
    return;
  }

  /* ---------------------------- write ----------------------------- */
  if (plans.length === 0) {
    console.log("apply: nothing to write.\n");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    let countrySet = 0;
    let regionSet = 0;
    let tagged = 0;
    for (const p of plans) {
      let count: number;
      if (p.tagsAsTld) {
        // TLD-inferred: set geography AND stamp the reversibility marker, in one
        // statement. The `country_id IS NULL` guard keeps it idempotent and makes
        // it impossible to overwrite a country set in the meantime — and because
        // the tag rides along in the same UPDATE, a row can never end up tagged
        // without the geography or vice versa. Tags are appended, never replaced,
        // and only on rows this statement actually changes.
        count = await tx.$executeRaw`
          UPDATE leads
             SET country_id = ${p.country.id},
                 region_id  = ${p.region.id},
                 tags = CASE
                          WHEN tags IS NULL THEN ARRAY[${TLD_TAG}]::text[]
                          WHEN ${TLD_TAG} = ANY(tags) THEN tags
                          ELSE array_append(tags, ${TLD_TAG})
                        END,
                 updated_at = NOW()
           WHERE id = ${p.leadId} AND country_id IS NULL`;
        if (count > 0) tagged += count;
      } else {
        const where = p.setsCountry
          ? { id: p.leadId, countryId: null }
          : { id: p.leadId, countryId: p.country.id, regionId: null };
        const updated = await tx.lead.updateMany({
          where,
          data: p.setsCountry
            ? { countryId: p.country.id, regionId: p.region.id }
            : { regionId: p.region.id },
        });
        count = updated.count;
      }
      if (count > 0) {
        if (p.setsCountry) countrySet += count;
        regionSet += count;
      }
    }
    return { countrySet, regionSet, tagged };
  });

  console.log("applied");
  console.log(`  country_id written ......... ${result.countrySet}`);
  console.log(`  region_id written .......... ${result.regionSet}`);
  console.log(`  tagged "${TLD_TAG}" ........... ${result.tagged}`);
  console.log(`  skipped (changed meanwhile)  ${plans.length - result.regionSet}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
