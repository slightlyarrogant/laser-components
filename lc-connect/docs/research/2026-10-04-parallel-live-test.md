# Parallel Web Systems: live API test for LC Connect

Date: 2026-10-04, 17:54–17:58 UTC. This test follows up on `2026-10-04-parallel-vs-perplexity.md`. It made 8 billable calls: 3 to Entity Search and 5 to the Responses API at `medium` effort. Raw JSON responses are in the session scratchpad (`…/scratchpad/parallel-test/*.raw.json`), not in the repo.

Setup: plain `fetch` from Node 22 with a 60 s abort. Endpoints and bodies were checked against `docs.parallel.ai/llms-full.txt` on the test day:
- Entity Search: `POST /v1beta/findall/entity-search` with header `x-api-key`. No beta header is needed (the docs say `parallel-beta` is no longer required for FindAll v1).
- Responses API: `POST /v1/responses` with `Authorization: Bearer`, `model: "parallel"`, `reasoning.effort: "medium"` and `text.format: json_schema` where used.

Neither endpoint returns a cost field. Responses returns only `usage` token counts, so the costs below come from the published rate card.

**There is no stored Perplexity output to compare against.** `enrich_lead` and `generate_lead_score` are read-only: they return text and write nothing. In the DB, `enrichment_jobs` is empty, `leads.last_enriched` is NULL for all 396 leads, and the only note that looks like AI output is a 2025 test note on fake lead 39 ("TechComm"). The retained server logs record only the outcome and timing of each call, not its content. The comparison in section 3 therefore uses the **stored lead description**, the research-base text written when the lead was created (March 2026 country research; the provider is not recorded). A real Perplexity-vs-Parallel comparison needs Perplexity run live in the bake-off.

## 1. Results per call

| # | Call | Endpoint / effort | Latency | HTTP | Cost (rate card) | Citations | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Entity Search, Poland | entity-search, match_limit 25 | **1.6 s** | 200 | $0.005 | 0 (none by design) | Usable. 24 returned, 6 already in base, about 5–6 plausible new candidates, the rest is noise. |
| 2 | Entity Search, South Korea | entity-search, match_limit 25 | **1.9 s** | 200 | $0.005 | 0 | Good. About 15 of 25 relevant (LiDAR makers, laser-diode and photodiode makers). |
| 3 | Entity Search, Brazil | entity-search, match_limit 25 | **1.2 s** | 200 | $0.005 | 0 | Poor. 23 returned, 0 of the 12 Brazilian base leads among them, about 20 generic metal/automation firms. |
| 4 | Enrich lead 394 Semicon | responses, medium, json_schema | **24.4 s** | 200 | $0.05 | 36 annotations / 10 unique URLs | Good. Valid JSON with 10 web actions (7 searches, 3 page opens). Corrects our profile (see §3). |
| 5 | Enrich lead 76 VIGO Photonics | responses, medium, json_schema | **21.2 s** | 200 | $0.05 | 29 / 10 | Good. All 3 news items are dated and URL'd, and the one checked (the acquisition) is correct. |
| 6 | Enrich lead 218 Workswell | responses, medium, json_schema | **15.7 s** | 200 | $0.05 | 28 / 10 | Good. Correctly says Workswell neither makes nor obviously buys pulsed diodes. |
| 7 | DE 905 nm segments + top-10 buyers (prose) | responses, medium | **39.1 s** | 200 | $0.05 | 24 / 14 | Plausible list, but it **exceeds a 30 s budget**. |
| 8 | Lead score 394 | responses, medium, json_schema | **21.8 s** | 200 | $0.05 | 15 / 3 | Usable. Numbers come as integers, so no regex is needed. Small arithmetic slip (see below). |

No call hit the 60 s abort, and no call failed. All 4 `json_schema` outputs parsed with `JSON.parse` on the first try. Token usage per Responses call was 600–790 total tokens. That is the final answer only: the search work is not reported in tokens, because billing is per request.

## 2. Entity Search vs the lead base

Matching: by website domain (lower-case, `www.` stripped) taken from the `Website Url:` field inside `description`, or by normalised company name. Note that the response's `url` field is often a **LinkedIn or Tracxn link, not the company website**. The real site sits in the free-text `description`, so a `find_companies` tool must parse it out. Results are firmographic records (Tracxn/LinkedIn-style: sector, founded, stage), not web evidence.

| Region | Returned | Leads in base for that country | Returned ∩ base | Plausibly relevant (my read) | Obvious false positives |
|---|---|---|---|---|---|
| Poland | 24 | 25 | **6** (Etronika 202, Inframet 80, PCO 75, Opt Lasers 208, Fluence 78, VIGO 76 as "VIGO System") | ~11 incl. the 6 known | ~12 |
| South Korea | 25 | 0 (Korea is not in the base) | 0 (the matcher's one hit, "Lasersystem" ↔ Tryzub Laser System, is a false match) | ~15 | ~7 |
| Brazil | 23 | 12 | **0** | 0–3 (LaserMed, Lasersmile = medical/dental lasers; BrPhotonics = telecom, acquired) | ~20 |

Poland recall against the base: 6 of 25 base leads (24%). It found the photonics makers but **none of the defense primes** in the base (WB Group, PIT-RADWAR, Mesko, HSW, ZMT, CRW Telesystem-Mesko), and not Semicon (394), the lead we rate as the best fit. Brazil recall: 0 of 12, because all 12 base leads are defense/aerospace (Opto S&D, AEL, Avibras, SIATT …) and Entity Search returned none of them.

### New candidates in Poland (not in the base)

| Company | Website | Assessment |
|---|---|---|
| Solaris Laser | https://solarislaser.com.pl | Plausible. Laser systems producer. Not to be confused with Solaris Optics (lead 209). |
| Lasertex | https://lasertex.eu | Plausible. Laser measurement tools for CNC/CMM. |
| Airoptic | https://www.airoptic.pl | Plausible. Tunable-laser gas analysers (detector buyer more than 905 nm). |
| Laser Technology Centre (Lasertec) | https://lasertec.pl | Weak. Laser process stations (industrial lasers, not pulsed diodes). |
| Instytut Fotonowy | https://www.fotonowy.pl | Weak/possible. Custom lab instruments (photon counting). |
| Materials Design Systems & Devices | https://mdsd.pl | Weak. Scientific equipment design. |
| Geotrading Polska | https://geotradingpolska.pl | Weak. Trimble surveying reseller, not a manufacturer. |
| SEFAKO, Unilogo Robotics, Rayleigh Instruments, LED Labs, HADATAP, APS, Camt, Relpol, Telesto, Rotometal, Tb Technology | — | **False positives**: boilers, packaging, relays, RFID, printing cylinders and similar. |

Data errors seen: VIGO is listed as "VIGO System, founded 1993, vigo.com.pl". The company's site says it was founded in **1987** and now trades as VIGO Photonics. In Korea, "LiDAR" (jslidar.com) and "JSLiDAR" (global-jungsang.com) look like one company listed twice, GKpns is flagged "Deadpooled", and "Laser Technology, Inc." is the US LTI (Colorado), shown through a Korean LinkedIn page.

## 3. Enrichment: Parallel vs stored lead description

The baseline is the `leads.description` text, because no Perplexity output exists (see the top of this report). "✓ site" means I confirmed the fact on the company's own website on 2026-10-04.

### Lead 394: Semicon Sp. z o.o.

| Field | Parallel (call 4) | Stored description | Check |
|---|---|---|---|
| HQ | Poland (Warsaw) | Warsaw | Agree |
| Employees | ~130 (profile) / 131 in 2025 (company-data source) | — | ✓ site: "ponad 125 osób" (over 125 people) on the "O nas" page. Consistent. |
| Founded | 1987 (KRS registration 2001) | — | ✓ site: "od ponad 35 lat" (for over 35 years), consistent with ~1987–1991 |
| Products | Distribution, EMS (PCB assembly), laser modules (line/cross/spot), SMT stencils, converting, cable harnesses | "Largest Polish producer of laser modules … ideal profile: module maker/integrator" | **Parallel is more accurate.** The site nav shows five divisions (DYSTRYBUCJA, EMS, SZABLONY, KONWERTING, LASERY), so lasers are one division of a distributor/EMS house. Our description overstates the laser focus. |
| Laser/photonics use | Makes laser modules, uses lasers for stencil cutting; pulsed-diode need "not confirmed" | "Potential buyer of 905 nm pulsed diodes" (assumption) | Parallel is properly hedged |
| Recent news | 3 items (May 2026 seminar, June 2026 Space Forum, Sept 2025 Elmia), all with semicon.com.pl URLs | — | Real, but it **missed the newest and most relevant item**: "Semicon na Drone Security Expo 2026" on the homepage |
| Growth signals | Headcount 127 → 131, trade-fair activity, no funding | — | Plausible, from a KRS aggregator |

### Lead 76: VIGO Photonics S.A.

| Field | Parallel (call 5) | Stored description | Check |
|---|---|---|---|
| HQ | Poland, Ożarów Mazowiecki | — | ✓ site: 129/133 Poznańska St., Ożarów Mazowiecki |
| Employees | ~240 (July 2026) | — | Site says ">200". Consistent. |
| Founded | 1987 | — (Entity Search said 1993) | ✓ site: "VIGO was founded in 1987" |
| Products | MWIR/LWIR detectors and modules, III-V epiwafers, FPAs, mid-IR QCLs for PICs (in development) | MCT and InAs/InAsSb detectors, VCSEL epi for LiDAR/ToF, InGaAs epi | Agree. Parallel adds QCL/PIC and FPAs. |
| Recent news | Acquisition of InfraRed Associates (2026-03-25), QCL for PICs (2026-05-28), PhotoGeNic (2026-07-28) | "Recent EUR 1B investment for new semiconductor factory" | ✓ site: InfraRed Associates acquisition dated 25 March 2026. The stored "EUR 1B" claim was **not found** on vigophotonics.com (its HyperPIC page gives no figure), so it is unverified and possibly a currency or scale error. |
| Growth signals | PLN 93M LTM revenue +19%, USD 8.4M acquisition, headcount growth | — | Revenue and acquisition amount not checked |

### Lead 218: Workswell s.r.o.

| Field | Parallel (call 6) | Stored description | Check |
|---|---|---|---|
| HQ | Czech Republic, Prague | Prague | Agree |
| Founded | 2010 | 2010 | ✓ site: "Founded 2010" |
| Employees | "50+" (company) / 51–200 band (LinkedIn) | — | Not found on the about-us page. Unverified. |
| Products | WEOM cores/HD/Zoom Block, WIRIS UAV/UGV, WIC, SAFETIS, software | WIRIS Pro/Enterprise, SAFETIS, GIS-320 gas-leak detector | Agree. Parallel lists newer modules; the stored text has GIS-320. |
| Laser/photonics use | Thermal imaging; "no evidence it makes or uses pulsed laser diodes or photodetectors" | "potentially pulsed laser rangefinders in drone gimbals" (speculation) | Parallel is more conservative. Neither source proves a rangefinder. |
| Customers | — | "BMW, Skoda, Bosch, Honeywell" | **Not found** on workswell.eu homepage or about-us. Unverified. |
| Recent news | 1 item (Hecthor II with WIRIS Enterprise, 2025-11-12) | — | Thin. A 2026 Eurosatory item appears only under growth signals. |

**Verifiably wrong facts:** none found in Parallel's 6 spot-checked facts (Semicon headcount and founding, VIGO HQ and founding, the InfraRed Associates date, Workswell founding). On our side, the Semicon profile ("largest Polish laser-module maker, ideal integrator") is **misleading by emphasis**, and two stored claims (VIGO "EUR 1B", the Workswell customer list) could not be confirmed. Entity Search metadata got VIGO's founding year wrong (1993).

**Prompt caveat:** my enrichment prompt mentioned "a supplier of pulsed laser diodes". Parallel read that partly as "does this company *sell* pulsed diodes?" and added "does not establish that VIGO sells pulsed laser diodes" to the photonics field. The bake-off prompt should say explicitly "LC is the supplier; assess the company as a *buyer*".

## 4. German top 10 (call 7, prose, 39 s)

Segments named: automotive LiDAR/ADAS; industrial LiDAR and distance measurement; robotics/AGV/logistics; surveying, mapping and agriculture; security and defense ranging. The answer labels every company a "prospect, not a confirmed purchaser".

| # | Company | Website | HEAD/GET | In base | Remark |
|---|---|---|---|---|---|
| 1 | SICK | https://www.sick.com | 200 | No | Strong fit |
| 2 | Pepperl+Fuchs | https://www.pepperl-fuchs.com | 403 (bot wall on scripted HEAD and GET) | No | Strong fit. The site exists; the 403 is anti-bot. |
| 3 | Leuze | https://www.leuze.com | 403 (bot wall) | No | Strong fit |
| 4 | Blickfeld | https://www.blickfeld.com | 200 | No | Strong fit (LiDAR maker) |
| 5 | Valeo | https://www.valeo.com | 200 | Group only: lead 245 Valeo Vision Systems (Ireland) | French group. Fits only through its Wemding (DE) LiDAR plant. |
| 6 | Jenoptik | https://www.jenoptik.com | 200 | Group only: lead 291 Jenoptik UK Traffic Solutions | Good fit (rangefinders) |
| 7 | ZF | https://www.zf.com | 200 | No | Plausible |
| 8 | Continental | https://www.continental.com | 200 | No | Weak (the answer calls it "adjacent") |
| 9 | KELO Robotics | https://www.kelo-robotics.com | 200 | No | **Weak.** The cited page is a shop reselling a Hokuyo (JP) scanner. |
| 10 | Rheinmetall | https://www.rheinmetall.com | 200 | Group only: lead 200 Rheinmetall Slovakia | Plausible (defense ranging) |

Result: 10 of 10 domains are real (8 answer 200; 2 return 403 to scripts because of a bot wall). 0 of the 10 German entities are in the base, as expected, though 3 groups appear through non-German subsidiaries. About 7 of 10 are credible buyers. Without being asked, it cited `lasercomponents.com` (LC's own 905 nm product page) as a segment source. Most companies have one source each, as requested.

## 5. Spend

| Item | Count | Unit (rate card) | Subtotal |
|---|---|---|---|
| Entity Search (≤100 results included) | 3 | $5 / 1k | $0.015 |
| Responses `medium` | 5 | $50 / 1k | $0.25 |
| **Total (estimated)** | 8 | | **≈ $0.27** |

Neither API returns a cost field. Confirm against the platform.parallel.ai usage page; I did not check it.

## 6. Verdict

- **Good enough for the 20-lead bake-off: yes.** Structured output was reliable (4 of 4 valid JSON). Answers cite sources (10 unique URLs per enrichment, mostly the company's own site and KRS aggregators). They hedge correctly when evidence is missing, and none of the 6 spot-checked facts was wrong. The weak spots are missing the most recent news item (Semicon's drone expo) and occasional arithmetic slips: call 8 states weights of 40/30/30 over factors 90/68/60, which gives 74.4, but it reports 73. Compute the overall score in code from the factor scores, not from the model.
- **Inside a 30 s MCP call:**
  - **Entity Search: yes, easily** (1.2–1.9 s). It is a recall tool only. Quality depends on region: good for Korea, mediocre for Poland, junk for Brazil. It missed every defense prime. It needs domain parsing out of `description` and a downstream filter. Use it as a "candidates" step, never as a lead list.
  - **Responses `medium` + json_schema: yes, but tight** (15.7–24.4 s for enrichment and scoring, which replaces 4 serial Perplexity calls of up to 120 s). Open-ended prose (call 7) took **39 s**, so list-building questions need `low`, a longer client timeout, or streaming. Keep a ≥ 45 s server-side timeout for `medium`.
- **Bake-off design changes:** (1) phrase prompts with LC as the seller and the lead as the buyer; (2) run Perplexity live on the same 20 leads, because there is no stored Perplexity text to compare against; (3) score per field against the company site plus KRS/ARES, not against `leads.description`, which itself contains unverified claims.
