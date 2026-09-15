# Lead geography backfill — inventory and outcome

*One-off. Run 2026-09-15 against the LC Connect Postgres (`laser_components`).*

Files: `scripts/backfill-geography.ts`, `db/seed/regions-countries.sql`.

---

## 1. The premise did not hold

The task assumed `leads.location` was populated on most of the 396 rows. It is not:

| | rows |
| --- | ---: |
| leads total | 396 |
| with any `location` text | **10** |
| with `country_id` | 10 (**the same 10**) |
| with `region_id` (before) | 0 |

So there was no "City, Country" text to parse: every lead that has a location
already had its country set. The location parser found **zero** new countries,
and that pass (§3) came to **region_id derived from the existing country_id, on
10 rows**. A second, approved pass then filled 140 more leads from the website
domain (§5), taking the table from 10 to **150** leads with geography.

The remaining 386 leads have **no location, no address, and no country column
anywhere** — checked `description`, `tags`, `industry`, `organizations`,
`industrial_application_research`. The only geography signal they carry is the
**website domain** (see §5).

### Inventory: distinct trailing segments of `location`

Split on the last comma, trimmed. This is the complete list.

| trailing segment | leads | maps to | status |
| --- | ---: | --- | --- |
| `Finland` | 4 | Finland (FI) | existing country |
| `Denmark` | 3 | Denmark (DK) | existing country |
| `Sweden` | 2 | Sweden (SE) | existing country |
| `Norway` | 1 | Norway (NO) | existing country |

- Segments mapping to a country already in `countries`: **all 4 (10 leads)**.
- Segments naming a country missing from `countries`: **none**.
- Unparsable / ambiguous segments (`UK`, `USA`, `Deutschland`, `Czechia`,
  `Holland`, city-only …): **none**. Not one of the messy cases the synonym map
  was built for actually occurs in the data.

The synonym map in the script is therefore **untriggered today but retained**:
it is what makes the script safe to re-run after leads are imported from a
source that does write free-text locations.

---

## 2. Seed applied — `db/seed/regions-countries.sql`

Idempotent (`INSERT … ON CONFLICT DO NOTHING`, region ids resolved by code, not
hard-coded). Verified by running it twice: second run inserted 0 rows.

**3 regions added** (Europe / Asia / North America already existed):

| code | name | why |
| --- | --- | --- |
| `SA` | South America | Brazil, Argentina, Chile, Peru, Colombia, Venezuela |
| `OC` | Oceania | Australia, New Zealand |
| `ME` | Middle East | Turkey — see the decision note below |

**26 countries added** (16 → 42 total):

- **Europe (17):** Poland, Czech Republic, Austria, Ireland, Slovakia, Slovenia,
  Croatia, Bosnia and Herzegovina, Serbia, Albania, Greece, Romania, Bulgaria,
  Hungary, Ukraine, Estonia, Latvia
- **Middle East (1):** Turkey
- **South America (6):** Brazil, Argentina, Chile, Peru, Colombia, Venezuela
- **Oceania (2):** Australia, New Zealand

Region counts after seeding: EU 26, SA 6, AS 4, NA 3, OC 2, ME 1.

**Not added, deliberately:**

- **Africa / `AF`** — no lead carries any African signal. A top-level region is
  added when the data needs one, not speculatively.
- **Countries with no lead:** Netherlands, Belgium, Switzerland, Portugal,
  Lithuania, North Macedonia, Israel, UAE, Saudi Arabia, South Africa. The
  synonym map already recognises their names, so if such a lead appears the
  script reports *"resolves to X, which is not in the countries table"* rather
  than silently dropping it. Add one by copying a row in the seed's VALUES list.

**Decision taken — Turkey → Middle East, not Europe** (11 leads). It matches the
customer's "emerging markets" bucket in the coming *France / Western Europe /
Africa & emerging / Asia* taxonomy, where Turkey is emphatically not the
Western-Europe desk; putting it in `EU` would hand 11 Turkish defence leads to
whoever gets European competency. Reversible whenever the customer says
otherwise:

```sql
UPDATE countries SET region_id = (SELECT id FROM regions WHERE code='EU')
 WHERE code = 'TR';
UPDATE leads SET region_id = (SELECT id FROM regions WHERE code='EU')
 WHERE country_id = (SELECT id FROM countries WHERE code='TR');
```

No sub-regions were invented — the client taxonomy comes later, and `regions`
already supports `parent_region_id` for it.

---

## 3. Pass 1 applied — region from existing country

```
tsx --env-file=.env scripts/backfill-geography.ts            # dry-run (default)
tsx --env-file=.env scripts/backfill-geography.ts --apply
```

Dry-run, all 10 rows (this is the whole table, not a sample):

```
lead  source                via                   -> country        region   sets
55    Tampere, Finland      existing country_id   -> Finland (FI)   Europe   region
56    Finland               existing country_id   -> Finland (FI)   Europe   region
57    Malmö, Sweden         existing country_id   -> Sweden (SE)    Europe   region
58    Asker, Norway         existing country_id   -> Norway (NO)    Europe   region
59    Tampere, Finland      existing country_id   -> Finland (FI)   Europe   region
60    Tampere, Finland      existing country_id   -> Finland (FI)   Europe   region
61    Denmark               existing country_id   -> Denmark (DK)   Europe   region
62    Denmark               existing country_id   -> Denmark (DK)   Europe   region
63    Denmark               existing country_id   -> Denmark (DK)   Europe   region
64    Sweden                existing country_id   -> Sweden (SE)    Europe   region
```

Applied in one transaction: `country_id` written **0**, `region_id` written
**10**, skipped 0. Re-running is a no-op ("no lead needs a change").

| | before | after |
| --- | ---: | ---: |
| leads | 396 | 396 |
| with `country_id` | 10 | 10 |
| with `region_id` | 0 | **10** |

Region distribution: Europe 10. (Every other region: 0 leads.)

An existing non-null `country_id` is never overwritten — the write is guarded
`WHERE country_id IS NULL`, so a concurrent edit wins and is reported as
"skipped", never clobbered.

---

## 4. Unmatched by the location pass

**Unmatched from `location`: none** — all 10 locations resolved, no ambiguous
segment, no country missing from the table.

The other **386 leads had no location text at all**, which no parser can fix.
140 of them were recovered from the website domain in §5; the remaining **246
are the customer backlog in §6**.

---

## 5. Second pass, APPLIED: country inferred from the website ccTLD

Because `location` turned out to be empty on 386 of 396 leads, the only broad
signal left is the website domain. This pass was approved and applied on
2026-09-15.

```
tsx --env-file=.env scripts/backfill-geography.ts --use-website-tld            # dry-run
tsx --env-file=.env scripts/backfill-geography.ts --use-website-tld --apply    # applied
```

Result: **140 leads gained a country and a region.** Re-running is a no-op
("no lead needs a change", 150 already complete).

| | before pass 2 | after pass 2 |
| --- | ---: | ---: |
| leads | 396 | 396 |
| with `country_id` | 10 | **150** |
| with `region_id` | 10 | **150** |
| tagged `geo:tld` | 0 | **140** |

Region distribution across the whole `leads` table now:

| region | leads |
| --- | ---: |
| Europe | 90 |
| South America | 30 |
| Oceania | 14 |
| Middle East | 11 |
| North America | 3 |
| Asia | 2 |
| *(no region)* | 246 |

### Why the inference is trustworthy

- **Allowlist, not blocklist.** A TLD absent from the table yields nothing, so
  `.ai`, `.io`, `.tech`, `.energy`, `.abb`, `.canon`, `.eu`, `.org`, `.net`
  never produce a country.
- **`.co` only as `.com.co` / `.gov.co` / `.edu.co` / …**, because a bare `.co`
  is sold worldwide as a vanity domain.
- `.uk` → `GB`; `.co.jp` → `JP` (last label wins).
- The country distribution reproduces the country-by-country research these
  leads came from (Poland 14, Czech Republic 13, Australia 13, Brazil 12,
  Turkey 11, UK 8, Ireland 7, Chile 7, Argentina 6 …).
- Every low-volume match was checked by hand: `fanuc.co.jp`, `yaskawa.co.jp`,
  `pi-usa.us`, `zrak.ba`, `bnt-tmh.ba`, `mod.gov.al`, `indumil.gov.co`,
  `escuelanaval.edu.co`, `cavim.gob.ve`, `inaoep.mx`, `cio.mx`,
  `aerialsurveys.co.nz`. All correct.

**Residual risk, stated plainly:** a multinational subsidiary recorded under the
group's `.com` stays unmatched (harmless), but one recorded under a *national*
domain gets that nation — usually the right answer, since that national entity
is what is being sold to. Anything wrong is a single `update_lead` away, and
§5.2 makes the whole pass undoable.

### 5.1 Reversibility — the `geo:tld` tag

Every one of the 140 rows carries the tag **`geo:tld`**, written in the *same*
`UPDATE` as the geography, so a row can never be tagged without the geography or
the reverse. Existing tags are **appended to, never replaced** (351 leads
already had tags; all were preserved — e.g. lead 66 kept its eight research
tags and gained a ninth). Rows the pass did not change were not touched at all,
and none of the 10 location-derived rows from §3 are tagged.

`geo:tld` therefore means exactly one thing: *this geography was inferred from a
domain name, not recorded by a human.*

### 5.2 Undo — `--revert-tld`

```
tsx --env-file=.env scripts/backfill-geography.ts --revert-tld                  # dry-run
tsx --env-file=.env scripts/backfill-geography.ts --revert-tld --apply
tsx --env-file=.env scripts/backfill-geography.ts --revert-tld --rollback-test
```

A row is reverted only if **both** hold: it still carries `geo:tld`, **and** its
`country_id` still equals the country its own TLD implies. A lead someone has
since corrected by hand is reported and left alone. Both branches were verified:

```
rollback-test on lead 7 (FANUC Corporation):
  before (committed)     country_id=10 region_id=3 tags=["geo:tld"]
  revert UPDATE          rows affected = 1
  inside transaction     country_id=null region_id=null tags=[]
  ROLLBACK issued        (deliberate)
  after rollback         country_id=10 region_id=3 tags=["geo:tld"]
```

and the negative branch, in a rolled-back psql transaction that first moved
lead 7 from Japan to Germany as a human would: the revert statement returned
**`UPDATE 0`** — it refused the hand-corrected row, exactly as intended.

Minor known detail: reverting a lead whose `tags` were `NULL` leaves `{}`
rather than `NULL`. Prisma reads both as `[]`, so nothing downstream notices.

### 5.3 The 140 leads changed

| lead | website | country | region |
| ---: | --- | --- | --- |
| 7 | `https://www.fanuc.co.jp` | Japan (JP) | Asia |
| 9 | `https://www.yaskawa.co.jp` | Japan (JP) | Asia |
| 136 | `https://www.mod.gov.al/eng/ministry/subordinate-structure…` | Albania (AL) | Europe |
| 178 | `https://www.photonic.at` | Austria (AT) | Europe |
| 180 | `https://www.kahles.at` | Austria (AT) | Europe |
| 182 | `https://www.sola.at` | Austria (AT) | Europe |
| 132 | `https://www.zrak.ba` | Bosnia and Herzegovina (BA) | Europe |
| 135 | `https://english.bnt-tmh.ba` | Bosnia and Herzegovina (BA) | Europe |
| 103 | `https://3dscan.bg` | Bulgaria (BG) | Europe |
| 128 | `https://speed.g-zona.hr` | Croatia (HR) | Europe |
| 129 | `https://dok-ing.hr` | Croatia (HR) | Europe |
| 130 | `https://geo3d.hr` | Croatia (HR) | Europe |
| 131 | `https://www.geometricus.hr` | Croatia (HR) | Europe |
| 66 | `https://www.argotech.cz` | Czech Republic (CZ) | Europe |
| 71 | `https://frentech.cz` | Czech Republic (CZ) | Europe |
| 73 | `https://www.infrared.cz` | Czech Republic (CZ) | Europe |
| 217 | `https://www.vrg.cz` | Czech Republic (CZ) | Europe |
| 220 | `https://elya.cz` | Czech Republic (CZ) | Europe |
| 223 | `https://www.micro-epsilon.cz` | Czech Republic (CZ) | Europe |
| 226 | `https://narran.cz` | Czech Republic (CZ) | Europe |
| 227 | `https://www.vuts.cz` | Czech Republic (CZ) | Europe |
| 228 | `https://www.excaliburarmy.cz` | Czech Republic (CZ) | Europe |
| 229 | `https://tatradv.cz` | Czech Republic (CZ) | Europe |
| 230 | `https://www.aero.cz` | Czech Republic (CZ) | Europe |
| 233 | `https://urc-systems.cz` | Czech Republic (CZ) | Europe |
| 235 | `https://www.laser-tech.cz` | Czech Republic (CZ) | Europe |
| 108 | `https://rantelon.ee` | Estonia (EE) | Europe |
| 166 | `https://miltech.gr` | Greece (GR) | Europe |
| 170 | `https://www.eas.gr` | Greece (GR) | Europe |
| 171 | `https://www.elfon.gr` | Greece (GR) | Europe |
| 172 | `https://www.optronics.gr` | Greece (GR) | Europe |
| 174 | `https://www.iesl.forth.gr` | Greece (GR) | Europe |
| 185 | `https://www.gammatech.hu` | Hungary (HU) | Europe |
| 186 | `https://www.videoton.hu` | Hungary (HU) | Europe |
| 188 | `https://www.ceoptics.hu` | Hungary (HU) | Europe |
| 190 | `https://www.eli-alps.hu` | Hungary (HU) | Europe |
| 243 | `https://www.tyndall.ie/news/vivid-photonics-launch/` | Ireland (IE) | Europe |
| 250 | `https://www.faztech.ie` | Ireland (IE) | Europe |
| 254 | `https://www.tyndall.ie` | Ireland (IE) | Europe |
| 255 | `https://www.cappa.ie` | Ireland (IE) | Europe |
| 256 | `https://www.ncla.ie` | Ireland (IE) | Europe |
| 283 | `https://www.intel.ie` | Ireland (IE) | Europe |
| 285 | `https://www.photonicsireland.ie` | Ireland (IE) | Europe |
| 111 | `https://www.balticphotonics.lv` | Latvia (LV) | Europe |
| 113 | `http://optek.lv` | Latvia (LV) | Europe |
| 75 | `https://pcosa.com.pl/` | Poland (PL) | Europe |
| 201 | `https://www.mesko.com.pl` | Poland (PL) | Europe |
| 202 | `https://www.etronika.pl` | Poland (PL) | Europe |
| 203 | `https://www.wbgroup.pl` | Poland (PL) | Europe |
| 204 | `https://ac-m.pl` | Poland (PL) | Europe |
| 205 | `https://zmt.tarnow.pl` | Poland (PL) | Europe |
| 206 | `https://www.hsw.pl` | Poland (PL) | Europe |
| 207 | `https://www.oem-tech.pl` | Poland (PL) | Europe |
| 210 | `http://www.ctl.com.pl` | Poland (PL) | Europe |
| 211 | `https://piap.lukasiewicz.gov.pl` | Poland (PL) | Europe |
| 214 | `https://www.witu.mil.pl` | Poland (PL) | Europe |
| 215 | `https://ioe.wat.edu.pl` | Poland (PL) | Europe |
| 216 | `http://www.lidar3d.pl` | Poland (PL) | Europe |
| 394 | `https://www.semicon.com.pl` | Poland (PL) | Europe |
| 82 | `https://prooptica.ro` | Romania (RO) | Europe |
| 83 | `https://www.ior.ro` | Romania (RO) | Europe |
| 84 | `https://www.romaero.ro` | Romania (RO) | Europe |
| 86 | `https://eurosurvey.ro` | Romania (RO) | Europe |
| 114 | `https://ziroskopi.rs` | Serbia (RS) | Europe |
| 118 | `http://www.vti.mod.gov.rs` | Serbia (RS) | Europe |
| 119 | `https://geogis.rs` | Serbia (RS) | Europe |
| 193 | `https://kotadef.sk` | Slovakia (SK) | Europe |
| 194 | `https://www.ztsspecial.sk` | Slovakia (SK) | Europe |
| 196 | `https://www.kvantlasers.sk` | Slovakia (SK) | Europe |
| 198 | `https://way.sk` | Slovakia (SK) | Europe |
| 199 | `https://www.dmdgroup.sk` | Slovakia (SK) | Europe |
| 124 | `https://www.tp-lj.si/en/members/optacore-d-o-o-2271` | Slovenia (SI) | Europe |
| 138 | `http://www.luch.kiev.ua` | Ukraine (UA) | Europe |
| 143 | `https://archer.ua` | Ukraine (UA) | Europe |
| 265 | `https://www.sentinelphotonics.co.uk` | United Kingdom (GB) | Europe |
| 267 | `https://www.raytheon.co.uk` | United Kingdom (GB) | Europe |
| 277 | `https://lynton.co.uk` | United Kingdom (GB) | Europe |
| 288 | `https://arqit.uk` | United Kingdom (GB) | Europe |
| 295 | `https://photonics.laser2000.co.uk` | United Kingdom (GB) | Europe |
| 302 | `https://www.xcam.co.uk` | United Kingdom (GB) | Europe |
| 306 | `https://www.roke.co.uk` | United Kingdom (GB) | Europe |
| 310 | `https://www.gov.uk/government/organisations/defence-scien…` | United Kingdom (GB) | Europe |
| 146 | `https://www.aselsan.com.tr` | Turkey (TR) | Middle East |
| 147 | `https://www.roketsan.com.tr` | Turkey (TR) | Middle East |
| 148 | `https://www.sage.tubitak.gov.tr` | Turkey (TR) | Middle East |
| 153 | `https://www.savronik.com.tr` | Turkey (TR) | Middle East |
| 154 | `https://www.sdt.com.tr` | Turkey (TR) | Middle East |
| 155 | `https://www.fnss.com.tr` | Turkey (TR) | Middle East |
| 156 | `https://anova.com.tr` | Turkey (TR) | Middle East |
| 158 | `https://www.stm.com.tr` | Turkey (TR) | Middle East |
| 159 | `https://www.bmc.com.tr` | Turkey (TR) | Middle East |
| 160 | `https://www.simsoft.com.tr` | Turkey (TR) | Middle East |
| 164 | `https://www.kurcelik.com.tr` | Turkey (TR) | Middle East |
| 348 | `https://www.inaoep.mx` | Mexico (MX) | North America |
| 349 | `https://www.cio.mx` | Mexico (MX) | North America |
| 19 | `https://www.pi-usa.us` | United States (US) | North America |
| 357 | `https://www.ascentvision.com.au` | Australia (AU) | Oceania |
| 361 | `https://www.nioa.com.au` | Australia (AU) | Oceania |
| 368 | `https://minelidar.com.au` | Australia (AU) | Oceania |
| 370 | `https://unisa.edu.au` | Australia (AU) | Oceania |
| 375 | `https://sydneyphotonics.com.au` | Australia (AU) | Oceania |
| 376 | `https://www.lastek.com.au` | Australia (AU) | Oceania |
| 377 | `https://www.raymax.com.au` | Australia (AU) | Oceania |
| 384 | `https://daronmont.com.au` | Australia (AU) | Oceania |
| 385 | `https://www.cea.com.au` | Australia (AU) | Oceania |
| 387 | `https://www.csiro.au` | Australia (AU) | Oceania |
| 388 | `https://www.lidarsolutions.com.au` | Australia (AU) | Oceania |
| 390 | `https://www.riegl.com.au` | Australia (AU) | Oceania |
| 392 | `https://www.silentiumdefence.com.au` | Australia (AU) | Oceania |
| 369 | `https://www.aerialsurveys.co.nz` | New Zealand (NZ) | Oceania |
| 342 | `https://www.invap.com.ar` | Argentina (AR) | South America |
| 343 | `https://www.citedef.gob.ar` | Argentina (AR) | South America |
| 344 | `https://www.fadea.com.ar` | Argentina (AR) | South America |
| 345 | `https://ciop.conicet.gov.ar` | Argentina (AR) | South America |
| 346 | `https://www.argentina.gob.ar/conae` | Argentina (AR) | South America |
| 347 | `https://www.consularsa.com.ar` | Argentina (AR) | South America |
| 329 | `https://www.optosd.com.br` | Brazil (BR) | South America |
| 330 | `https://www.ael.com.br` | Brazil (BR) | South America |
| 331 | `https://www.siatt.com.br` | Brazil (BR) | South America |
| 332 | `https://www.ares.ind.br` | Brazil (BR) | South America |
| 333 | `https://www.avibras.com.br` | Brazil (BR) | South America |
| 334 | `https://velsis.com.br` | Brazil (BR) | South America |
| 335 | `https://www.gespi.com.br` | Brazil (BR) | South America |
| 336 | `https://www.iacit.com.br` | Brazil (BR) | South America |
| 338 | `https://orbitalengenharia.com.br` | Brazil (BR) | South America |
| 340 | `https://www.gov.br/inpe` | Brazil (BR) | South America |
| 341 | `https://www.condornaoletal.com.br` | Brazil (BR) | South America |
| 352 | `https://www.telebras.com.br` | Brazil (BR) | South America |
| 314 | `https://www.famae.cl` | Chile (CL) | South America |
| 315 | `https://www.enaer.cl` | Chile (CL) | South America |
| 316 | `https://www.geocom.cl` | Chile (CL) | South America |
| 317 | `https://geoinstrumentos.cl` | Chile (CL) | South America |
| 318 | `https://surveying.cl` | Chile (CL) | South America |
| 319 | `https://uasvision.cl` | Chile (CL) | South America |
| 327 | `http://laserbeam.cl` | Chile (CL) | South America |
| 320 | `https://www.indumil.gov.co` | Colombia (CO) | South America |
| 322 | `https://www.escuelanaval.edu.co` | Colombia (CO) | South America |
| 323 | `https://www.sima.com.pe` | Peru (PE) | South America |
| 324 | `https://horizonsperu.pe` | Peru (PE) | South America |
| 325 | `https://www.cavim.gob.ve` | Venezuela (VE) | South America |

---

## 6. Remaining backlog for the customer — 246 leads with no geography

246 of 396 leads still have no country. They split into two groups, and neither
can be fixed by any parser — they need a human, via `update_lead`:

- **218 leads on a generic or vanity domain** (`.com`, `.eu`, `.org`, `.net`,
  `.tech`, `.ai`, `.energy`, brand TLDs). The domain says nothing about the
  country. Many are obvious to a person and only to a person — Meopta and Crytur
  are Czech on `.com`, the Lithuanian photonics cluster (Ekspla, Light
  Conversion, Altechna, Brolis) is entirely on `.com`, the UK defence block
  (QinetiQ, BAE, MBDA, Leonardo UK) likewise, and the Australian block (EOS,
  DroneShield, Emesent, Baraja) too.
- **28 leads with no website at all** (or a placeholder such as `N/A`).

Get the current list any time with:

```sql
SELECT id, name, COALESCE(website, '(no website)') AS website
FROM leads WHERE country_id IS NULL ORDER BY id;
```

Three of these are worth a note: **Lithuania**, **Netherlands** and the other
countries listed in §2 as "not added" have no row in `countries` yet, so a lead
cannot be assigned to them until the seed gains that row. The synonym map
already knows the names, so the script reports them explicitly rather than
failing silently.

A practical way to clear the backlog fast: the leads were gathered
country-by-country, so they sit in contiguous id ranges (Lithuania ≈ 87–96,
Bulgaria ≈ 98–102, Estonia ≈ 105–110, UK ≈ 258–313, Ireland ≈ 238–257,
Australia ≈ 353–393). A person can confirm a range at a glance and set it with
one bulk update per country — far cheaper than 246 individual decisions.

---

## 7. Why this is a one-off

New leads stamp their own region: `create_lead`, `batch_create_leads` and
`update_lead` all call `resolveRegionId(countryId, regionId)`
(`src/tools/leads.ts`), which derives the region from the country whenever a
country is given and no region is passed. Nothing keeps calling this script.

Access control also degrades safely: `src/core/access.ts` resolves a lead's
region as `lead.regionId ?? lead.country.regionId`, so a lead that has a country
but somehow no region still lands in the right competency bucket, and a lead
with no geography at all stays editable by any competent user.

Re-run the script only after a bulk import from a source that writes free-text
`location` — that is the case the synonym map exists for.
