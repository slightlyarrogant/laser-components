# Bake-off: Perplexity vs Parallel on 20 real leads

Date: 2026-10-04, 18:10–18:35 UTC. The test made 48 billable calls (24 per vendor) and spent about **$1.53** of the $6 cap. It follows up on `2026-10-04-parallel-live-test.md` and section (d) of `2026-10-04-parallel-vs-perplexity.md`.

Raw responses, scripts and verification material are in the session scratchpad `…/scratchpad/bakeoff/`, not in the repo:
- `raw/enrich-{perplexity|parallel}-<leadId>.json`: one file per call, holding the request, HTTP status, latency, headers and body.
- `raw/disc-{vendor}-{Poland|Czech_Republic}-{schema|prose}.json`: the discovery calls.
- `parsed.json` (extracted JSON and citations), `urlstatus.json` (resolution of every cited URL), `agg.json` (scores).
- `reg/` (ARES and KRS API responses) and `pages/<leadId>/` (fetched company pages as text).
- Scripts: `lib.mjs`, `probe.mjs`, `disc.mjs`, `extract.py`, `urlcheck.py`, `grid.py` (the verdict grid) and `agg.py`.

## Method

- **Same prompt, same schema for both vendors.** The prompt names LC as the seller and the lead as a potential **buyer**, and asks for facts about the lead company. The schema is `{company_name, website, hq_country, hq_city, employees, founded, products[], relevance_to_laser_components, recent_news[{title,date,url}], confidence}` (`lib.mjs`). The client times out after 60 s. Calls ran sequentially within each vendor.
- **Perplexity** used the call `ai.ts` makes today: `POST /chat/completions`, `sonar-pro`, the same system prompt, `temperature 0.7` and `max_tokens 1500`. I added `response_format: {type: "json_schema", json_schema: {schema}}`, and the endpoint **accepted it** (24 of 24 calls, no fallback needed).
- **Parallel** used `POST /v1/responses` with `model: "parallel"`, `reasoning.effort: "medium"` and `text.format: json_schema`.
- **Fact checks.** For each lead and vendor I checked 3 fields:
  - `hq_city` and `founded`, against the company site plus a register: ARES for CZ, the official KRS API `api-krs.ms.gov.pl` for PL, and Wikipedia for Aselsan, whose site is rendered by JavaScript.
  - One distinctive product claim per vendor. These are different claims for the two vendors, each one specific enough to falsify.
  - Codes: **C** correct, **W** wrong, **U** unverifiable from the live site or register, **N** the vendor returned null.
  - Rule for `founded`: the founding year stated on the company's own site wins. A register date counts only when the site is silent.
- **Relevance.** **Specific** means the text names a company-specific product or programme, or a narrow product line that ties directly to LC parts (for example "laser rangefinders" at Etronika). **Generic** means it lists only sector categories that would fit any firm in the sector.
- **Sources.** Distinct citation URLs: Perplexity `citations`, Parallel `url_citation` annotations. Each URL was checked with `curl -L` and a ranged GET. 2xx, 403 and 429 count as resolving.
- **Discovery: 4 questions × 2 vendors = 8 calls.** The question as specified, for Poland and Czech Republic, each asked twice: once with a json_schema (`{companies:[{name, website, products_using_905nm, evidence_url}]}`) and once as prose, the way `ai.ts` calls today.

## 1. Lead list

| id | Company | Country | Website |
|---|---|---|---|
| 74 | CRW Telesystem-Mesko Sp. z o.o. | Poland | https://telesystem.eu/ |
| 77 | TopGaN Sp. z o.o. | Poland | https://topganlasers.com/ |
| 79 | PIT-RADWAR S.A. | Poland | https://en.pitradwar.com/ |
| 202 | Etronika Sp. z o.o. | Poland | https://www.etronika.pl |
| 207 | OEM Tech Sp. z o.o. | Poland | https://www.oem-tech.pl |
| 209 | Solaris Optics S.A. | Poland | https://solarisoptics.eu |
| 213 | SDS Optic S.A. | Poland | https://sdsoptic.com |
| 216 | LiDAR3D Sp. z o.o. | Poland | http://www.lidar3d.pl |
| 65 | EVPU Defence a.s. | Czech Republic | https://www.evpudefence.com |
| 66 | Argotech a.s. | Czech Republic | https://www.argotech.cz |
| 72 | RETIA a.s. | Czech Republic | https://www.retia.eu |
| 223 | Micro-Epsilon Czech Republic s.r.o. | Czech Republic | https://www.micro-epsilon.cz |
| 225 | GenEvo s.r.o. | Czech Republic | https://www.genevo.com |
| 146 | Aselsan A.S. | Turkey | https://www.aselsan.com.tr |
| 154 | SDT Space & Defence Technologies | Turkey | https://www.sdt.com.tr |
| 156 | Anova Defence Technologies | Turkey | https://anova.com.tr |
| 329 | Opto Space & Defense (OPTO S&D) | Brazil | https://www.optosd.com.br |
| 336 | IACIT Soluções Tecnológicas | Brazil | https://www.iacit.com.br |
| 357 | Ascent Vision Technologies (AVT) Australia | Australia | https://www.ascentvision.com.au |
| 196 | KVANT Lasers s.r.o. | Slovakia | https://www.kvantlasers.sk |

Turkey was chosen over South Korea because Korea has no leads in the base. Leads 394, 76 and 218 were excluded.

## 2. Per-lead results

The facts column reads city / founded / product. Sources are given as resolving / total. Latency is client wall time in seconds.

| Lead | Ctry | Pplx facts | Pplx relevance | Pplx sources | Pplx s | Parallel facts | Parallel relevance | Parallel sources | Parallel s |
|---|---|---|---|---|---|---|---|---|---|
| 74 CRW Telesystem-Mesko | PL | C/**W**/C | specific | 15/15 | 7.5 | C/C/C | specific | 11/11 | 24.1 |
| 77 TopGaN | PL | C/C/U | specific | 14/15 | 8.1 | C/C/C | specific | 6/6 | 15.3 |
| 79 PIT-RADWAR | PL | C/C/C | specific | 15/15 | 9.0 | C/C/C | specific | 10/10 | 15.2 |
| 202 Etronika | PL | C/C/C | specific | 15/15 | 5.6 | C/C/C | specific | 11/11 | 28.7 |
| 207 OEM Tech | PL | C/C/C | specific | 15/15 | 8.6 | C/C/C | specific | 8/8 | 28.1 |
| 209 Solaris Optics | PL | C/C/U | specific | 3/15 | 6.7 | C/C/U | specific | 3/8 | 23.7 |
| 213 SDS Optic | PL | C/**W**/C | specific | 15/15 | 7.9 | C/C/C | specific | 12/12 | 16.1 |
| 216 LiDAR3D | PL | N/N/C | specific | 15/15 | 5.8 | C/N/C | specific | 3/3 | 19.1 |
| 65 EVPU Defence | CZ | C/C/C | specific | 15/15 | 7.4 | C/C/C | specific | 11/11 | 17.7 |
| 66 Argotech | CZ | C/C/U | generic | 15/15 | 6.7 | C/C/C | specific | 6/6 | 15.9 |
| 72 RETIA | CZ | C/C/C | generic | 15/15 | 8.6 | C/C/C | specific | 12/12 | 22.7 |
| 223 Micro-Epsilon CZ | CZ | C/C/C | specific | 15/15 | 8.4 | C/C/C | specific | 11/11 | 23.4 |
| 225 GENEVO | CZ | C/C/C | specific | 13/15 | 6.4 | C/C/C | specific | 11/11 | 28.0 |
| 146 Aselsan | TR | C/C/C | generic | 14/15 | 7.9 | C/C/C | specific | 11/11 | 24.4 |
| 154 SDT | TR | C/U/C | generic | 15/15 | 7.0 | C/U/C | specific | 11/11 | 29.6 |
| 156 Anova | TR | C/C/C | specific | 15/15 | 8.6 | C/C/C | specific | 6/6 | 31.4 |
| 329 OPTO S&D | BR | C/C/C | specific | 14/15 | 6.2 | C/C/C | specific | 6/6 | 19.7 |
| 336 IACIT | BR | C/C/C | generic | 15/15 | 8.0 | C/C/C | specific | 13/13 | 20.0 |
| 357 AVT Australia | AU | C/U/C | specific | 15/15 | 6.7 | C/U/U | specific | 9/9 | 15.2 |
| 196 KVANT Lasers | SK | C/C/C | specific | 15/15 | 6.7 | C/**W**/C | specific | 9/9 | 19.0 |

All 48 calls returned HTTP 200 and none hit the 60 s abort. Notes on the less obvious verdicts:
- **GENEVO founded.** Perplexity says 2012 and Parallel 2011. Both are marked C, because genevo.com says "All works began in the spring of 2011 … resulted in the founding of GENEVO s.r.o." and also "Since 2012". The current ARES entity dates from 2017.
- **Solaris products.** U for both vendors: the live site is a "Website under construction" page, and both vendors cited old URLs that now return 404. The founding year 1991 is consistent with "over 30 years" on the homepage and with the pre-2001 RHB register entry in KRS 0000049554.
- **CRW (Parallel) product.** The site shows the LPD-C laser designator with a built-in rangefinder. Parallel called the variant "LPD-A".
- **AVT CM142 (Parallel).** The page `/cm142-1` returns HTTP 200 but renders only through JavaScript, and CM142 is missing from the current navigation.

## 3. Aggregate

| Metric | Perplexity sonar-pro + json_schema | Parallel Responses `medium` + json_schema |
|---|---|---|
| Facts correct / wrong / unverifiable / null (of 60) | 51 / **2** / 5 / 2 | 54 / **1** / 4 / 1 |
| Accuracy of checkable facts (C / (C+W)) | 96.2% | 98.2% |
| Accuracy of all 60 slots | 85.0% | 90.0% |
| Relevance specific | 15/20 (**75%**) | 20/20 (**100%**) |
| Relevance text opens with "High" | 13/20 | 0/20 |
| `confidence: high` | 12/20 | 1/20 |
| Latency median / p90 / max (enrich) | **7.5 / 8.6 / 9.0 s** | 21.4 / 29.5 / **31.4 s** |
| Latency (discovery) | 3.8–5.6 s | 26.2–30.2 s |
| JSON validity | 24/24 (100%) | 24/24 (100%), but schema discovery returned empty lists |
| Distinct citations per enrich answer | 15.0 (always exactly 15) | 9.2 |
| Resolving citations per answer | 14.2 (94.3%) | 9.0 (97.3%) |
| `recent_news` items / article-specific URL / undated | 48 / **24** / 7 | 43 / **40** / 0 |
| News URLs that do not resolve | 4 (two 404, two 511) | 2 (both 404) |
| Cost per call | $0.0112–0.0177, **returned in `usage.cost`** | $0.05 (rate card, no cost field) |
| Total spend, 24 calls | **$0.327** (sum of `usage.cost.total_cost`) | **$1.20** (estimate) |

Cost notes:
- **Perplexity does return a cost field,** contrary to what the brief assumed: `usage.cost = {input_tokens_cost, output_tokens_cost, request_cost: 0.006, total_cost}`, with `search_context_size: "low"`. The request fee of $0.006 is the legacy sonar-pro "low" fee.
- **Parallel** returns only token counts, so the cost is the published rate for Responses `medium` ($50 per 1,000 requests). I did not reconcile it against the platform usage page.

**Signs of Agent API reformulation in the Perplexity responses: none visible.** Every response has `model: "sonar-pro"`, `object: "chat.completion"`, the legacy `choices[].delta` and `message`, `citations` plus `search_results`, and the legacy cost breakdown. There are no `output[]`, preset or tool-call fields. Headers are Cloudflare plus `x-ratelimit-limit: 3`, `x-ratelimit-remaining` and `x-ratelimit-reset`, with no Agent-specific headers. The limit of 3 is low enough that parallel fan-out would probably hit 429s; this run made sequential calls only. Two things stand out but prove nothing:
- Latency was 5.6–9 s, against the 23.6 s logged earlier for one prose enrich.
- The prose answers talk about "your search results" (for example "website: **not shown in the result**"), as though the retrieved results had been pasted in by the user.

## 4. Discovery (verbatim question, PL and CZ)

Matching against the base uses the domain, with a name match as fallback, against all 364 leads that have a website. "Plausible new" means the candidate's homepage mentions LiDAR, a rangefinder or 905 nm. I also note candidates whose homepage mentions only "laser".

### Poland

| Vendor / mode | Listed | In base | Plausible new (LiDAR/rangefinder/905 on homepage) | False positives / problems |
|---|---|---|---|---|
| Perplexity schema (5.2 s) | 9 | 4: Opt Lasers 208 (domain match); Semicon 394, Fluence 78, CTL 210 (name match only, wrong domains given) | **0.** Microvec and Mode-Locked Technology are laser makers: "laser" only, no 905 nm or LiDAR | **4 of 9 websites wrong or dead:** `fluence.tech` → Yokogawa Fluence Analytics (US); `implaser.com` → a Spanish signage firm; `semicon.pl` and `laserinstruments.pl` do not resolve. Eurotek is a laser distributor; Gekko Photonics makes spectral analysers. Most entries are laser makers or distributors (sellers), not buyers of 905 nm diodes. |
| Perplexity prose (4.6 s) | 8 | the same 4 | 0 | The website column says only the company name, with no URL. ABPLANALP is a distributor. |
| Parallel schema (28.9 s) | **0** (`{"companies": []}` after 15 searches) | 0 | 0 | — |
| Parallel prose (26.2 s) | 1 "closest lead" | 1: Etronika 202 | 0 | "I could not verify any Poland-based company whose public product specifications establish all three points." |

### Czech Republic

| Vendor / mode | Listed | In base | Plausible new | False positives / problems |
|---|---|---|---|---|
| Perplexity schema (5.6 s) | 8 (7 distinct: Astrum LT appears twice) | 1: Crytur 69 (name match; no website given) | 0 buyers. Astrum LT **makes** 905 nm laser diodes, so it is a competitor or supplier, not a buyer. | **"Laser Components Czech Republic presence | lasercomponents.com"**, which is LC itself, and Coherent (a competitor). EZconn and SAR/LIMTEK are makers or distributors. 6 of 8 entries have `website: null`. |
| Perplexity prose (3.8 s) | 5 | 1: Crytur | 0 | Same names; "website: not shown in the result" for all five. |
| Parallel schema (26.8 s) | **0** (9 searches, 0 citations) | 0 | 0 | — |
| Parallel prose (30.2 s) | 1 | 0 | 0 | ams OSRAM, a 905 nm diode maker and therefore a competitor. |

Neither vendor answers the discovery question usefully as worded. Perplexity reads "pulsed laser diodes at 905 nm" as "companies in the laser-diode category" and lists sellers. Parallel insists on proof of all three conditions and returns an empty list. Neither found the defence and optronics primes already in the base (WB Group, PCO, PIT-RADWAR, CRW, EVPU, Meopta).

For comparison, the earlier Entity Search test found 6 Polish base leads in 1.6 s for $0.005 (live-test doc §2).

## 5. Notable errors (quotes; file in brackets)

1. **Perplexity, wrong founding year:** CRW Telesystem-Mesko `"founded": 1988`. The company site says "Inicjatorem powstania spółki w 1993 roku był zespół… profesora Zbigniewa Puzewicza" and "1993 Rok założenia spółki". Parallel said 1993. [`enrich-perplexity-74.json`, `pages/74/`]
2. **Perplexity, founding year taken from a legal conversion:** SDS Optic `"founded": 2019`. The KRS entry for 0000786821 reads "PRZEKSZTAŁCENIE SPÓŁKI SDS OPTIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ W SPÓŁKĘ SDS OPTIC SPÓŁKA AKCYJNA, UCHWAŁA… Z DNIA 10 STYCZNIA 2019". The predecessor is KRS 0000474982, whose number falls in the 2013 range; Parallel said 2013. [`enrich-perplexity-213.json`, `reg/krs-0000786821*.json`]
3. **Parallel, founding year taken from a legal entity:** KVANT `"founded": 2017`. kvantlasers.sk ("All about Kvant") has a timeline starting with 1995, and Perplexity said 1995. [`enrich-parallel-196.json`, `pages/196/`]
4. **Perplexity discovery, wrong websites:** `"Fluence Technology | https://fluence.tech"` redirects to fluenceanalytics.com, Yokogawa's US polymer-analytics firm (the base has fluence.technology). `"Implaser Innovative Technologies… https://implaser.com"` is "IMPLASER | Señalización, Pegatinas…", a Spanish signage company. [`disc-perplexity-Poland-schema.json`]
5. **Perplexity discovery lists LC itself and a competitor as Czech buyers:** "Laser Components Czech Republic presence | https://www.lasercomponents.com" and "Coherent Czech Republic presence". [`disc-perplexity-Czech_Republic-schema.json`]
6. **Parallel discovery returns nothing:** `{"companies": []}` for both countries. The Polish prose answer says: "I could not verify any Poland-based company whose public product specifications establish all three points: that it builds the product, that the product uses a pulsed laser diode, and that the wavelength is 905 nm." [`disc-parallel-*.json`]
7. **Perplexity relevance inflation:** TopGaN gets "High relevance as a potential buyer…", but the same text goes on to say "direct use of LC's 905 nm emitters is not evident". 13 of 20 answers open with "High". Parallel: "There is no evident direct fit for LC's 905 nm pulsed laser diodes in those stated product lines." [`enrich-*-77.json`]
8. **Perplexity citation noise:** the TopGaN answer cites `pagesix.com/2026/04/16/entertainment/top-gun-3-officially-in-works-with-tom-cruise-returning/`. Perplexity always returns exactly 15 citations, so filler links get through. [`enrich-perplexity-77.json`]
9. **Perplexity news items point at listing pages:** for Micro-Epsilon, all three news URLs are `https://www.micro-epsilon.cz/newsroom/news/` (two of them undated). 24 of 48 Perplexity news URLs are list, category or product pages, against 3 of 43 for Parallel. Dead links: `wnp.pl/…mesko-wdraza-rewolucje…` (404), `aselsan.com/en/newsletter/detail/407/newsletter-no-12` (404) and 2 × `ceoutlook.com` (511). Parallel's dead links: `argotech.cz/eurosensors-2026` and `argotech.cz/sensor-test-2026` (both 404). [`urlstatus.json`]
10. **Parallel claim that cannot be checked but matters commercially:** CRW "describes a 905 nm semiconductor-laser rangefinder module". Both cited pages (`telesystem.eu/en/2022/03/17` and `/en/products/precision-guided-munitions-smartness`) now redirect to the redesigned homepage, so I could not confirm it. If it is true, CRW is a direct 905 nm prospect, and a salesperson should ask. [`enrich-parallel-74.json`]

Side finding: topganlasers.com contains injected German online-casino spam ("fussball wetten", "Wildsino"), so the site appears compromised. Do not link to it from customer-facing material. [`pages/77/crawl/`]

## 6. Verdict and recommendation for LC Connect

**Accuracy is a near tie and no basis for choosing.** On basic facts the two vendors are about equal: 2 wrong against 1 wrong out of 60, which is noise at N=20 with one run each. All three errors are the same kind of mistake: a register or legal-entity date taken as the founding year.

**The differences are in the sales-relevant output:**
- Parallel's relevance text is always company-specific (20/20 against 15/20).
- Parallel hedges in proportion to the evidence; Perplexity labels 13 of 20 "High" and sets `confidence: high` 12 times.
- Parallel's news items are real dated articles (40 of 43 against 24 of 48).

**Perplexity's advantage is speed and price:** 7.5 s median against 21.4 s, and about $0.013 per call against $0.05. Its legacy chat endpoint now accepts `json_schema` and returned valid JSON 24 of 24 times. It runs on the Sonar surface whose support ended on 2026-09-27, and this run shows no sign of the reformulation, so that path is on borrowed time.

| Tool | Recommendation | Timeout | Why |
|---|---|---|---|
| `enrich_lead` | **Parallel Responses `medium` + json_schema**, one call replacing today's 4. Fallback: Perplexity `sonar-pro` + the same json_schema on timeout or error. | Server-side 45 s for Parallel (observed max 31.4 s, p90 29.5 s). Perplexity 20 s (observed max 9 s). | Better relevance and news, calibrated confidence. At 300 enrichments a month the cost difference is about $15 against $4. Parallel's p90 sits at the edge of a 30 s MCP budget, so either confirm the client tolerates about 35 s or return early and persist asynchronously. |
| `generate_lead_score` | No new web call. Score from the **persisted** enrichment JSON (any LLM, or Parallel `low`), with the factor scores returned as integers and **the overall score computed in code**. | 20 s | Scoring depends on company fit and technology alignment, which the enrichment's `products` and `relevance` fields already carry. This also removes the `extractFactorScore` regex. |
| Discovery (new `find_companies`) | **Neither chat model as tested.** Use Parallel **Entity Search** as the candidate step (from the earlier test: 1–2 s, $0.005, 6 Polish base hits) with a **buyer-framed objective** ("manufacturers of laser rangefinders / LiDAR / laser distance sensors / laser-guided munitions in {country}"), and leave "905 nm" out. Deduplicate against the base by domain, then enrich the shortlist. | Entity Search 10 s | The verbatim 905 nm question gives sellers and wrong websites from Perplexity, and an empty list from Parallel. |

**What to persist from each enrichment:**
- Fields: the whole JSON response, plus vendor, model or processor, request id, timestamp, latency, cost (`usage.cost.total_cost` for Perplexity, the rate card for Parallel) and the citation list (URL, title, and whether it resolved). Write these to `enrichment_jobs` and set `leads.last_enriched`.
- Mapped columns: `location ← hq_city`, `founded_year ← founded`, `employee_count` only when the value is a number, and `recent_news` as a JSON array with url and date.
- **Never overwrite** columns a human filled in. Store the new values next to them, for review.
- Store `founded` together with its source URL, because register-vs-founding confusion is the main error mode found here.
- Drop news items whose URL is a listing page or does not resolve (`HEAD` check at write time).
- Keep the raw response: Parallel accounts on zero data retention lose it on their side, and Perplexity results cannot be reproduced at temperature 0.7.

**Caveats:**
- N=20, a single run per vendor, and a single checker (me).
- The product claims checked differ between the vendors.
- 5 of 60 Perplexity slots and 4 of 60 Parallel slots stayed unverifiable: JavaScript-rendered sites, a site under construction, and Turkish or Australian registers that I did not query.

Nothing was committed. No repo source file was changed. The only repo file written is this one.
