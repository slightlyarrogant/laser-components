# Epic: lead enrichment for LC Connect (strategy and challenge)

Date: 2026-10-05. Inputs:
- the bake-off `2026-10-05-bakeoff-perplexity-vs-parallel.md`;
- the provider comparison `2026-10-04-parallel-vs-perplexity.md`;
- the state of the code as described in `beads/to-do.md`. On 2026-10-04 the code gained an `[ENRICHMENT]` note, `enrichment_jobs` rows and background jobs;
- the live DB, read-only, 2026-10-04.

## 0. Where we actually are (measured, not assumed)

| Lead field (396 leads) | Filled |
|---|---|
| `location` | 187 |
| `email` | 21 |
| `founded_year` | **0** |
| `employee_count` | **0** |
| `linkedin_url` | **0** |
| `last_enriched` before 2026-10-04 | **0**: nobody had ever run `enrich_lead` |
| `enrichment_batches` | 0 |

Enrichment therefore starts from almost zero, and the existing tool had no users. That is the first thing to fix in our own thinking. The problem is not "which engine combs the web best". It is "what does a Laser Components salesperson need to see on a lead to act, and how do we keep that true".

## 1. Challenge to the current thinking

1. **"Combing the web for a topic" is the commodity part.** On basic facts (city, founding year, product), the two engines tied: 2 wrong against 1 wrong out of 60. Any decent engine gets these facts right. What differed, and what sells, is:
   - **fit evidence**: "builds the CMS-1 commander sight with an eye-safe rangefinder";
   - **timing**: news, tenders, expansions;
   - and, not yet addressed, **who to talk to**.

   The epic should be organised around those three questions, not around a list of fields.
2. **Choosing an engine is not a strategy.** Perplexity silently changes the model behind its presets, and both vendors change their APIs monthly. A good setup makes the engine a replaceable part:
   - a provider interface;
   - a fixed evaluation set (the 20 hand-verified bake-off leads);
   - a monthly re-run for about $1.50.

   That is what turns the slide line "we monitor the best research engines" into something real rather than a promise.
3. **Registers and the company's own website first, LLM research second.** All three errors in the bake-off were founding years taken from a legal-entity or register date. A deterministic lookup removes that class of error for free:
   - KRS API (PL) and ARES (CZ) are official, free and keyless;
   - GLEIF is CC0;
   - reading the company's own product pages costs $1 per 1,000 URLs with Parallel Extract.

   Paying an LLM to guess what a register states is the wrong order. This is the "waterfall" pattern used by Clay and similar tools: cheap, authoritative sources first, and the expensive one only for the gaps.
4. **Enrichment and discovery are two epics.** Enrichment improves the 396 leads we already have. Discovery finds new ones, and it failed in the bake-off on both engines. Discovery is probably the bigger lever for revenue, so it should not hide inside "enrichment".
5. **Batch, not interactive, as the default.** At 396 leads, enriching every lead once costs about **$10** (Parallel Task `core`, $25 per 1,000) or **$20** (Responses `medium`), as a single run. After that the chat tool reads stored data in under a second, and the timeout question for claude.ai and ChatGPT largely disappears. Live web calls are needed only for "refresh this lead now".
6. **People and contacts are the biggest gap, and a policy question rather than a technical one.** We hold 0 LinkedIn URLs and 21 emails. Personal data on defence-industry staff in the EU falls under GDPR, and some prospects are sensitive. Decide the policy with Łukasz and Laser Components before building anything. Until then, the enrichment epic stays at **company level**.
7. **Every new provider is a change to the customer's data flow.** Moving enrichment to Parallel, or adding Monitor, sends lead lists to a new sub-processor. Laser Components must agree, and the documentation must match the payloads; see the DOC/CODE MISMATCH bead. Budget time for this, because it gates go-live more than the code does.
8. **Validate demand before building it out.** Ask Łukasz which 5 fields the reps actually look at, and measure whether the stored enrichment is opened at all. A pipeline full of provenance that nobody reads is the most likely failure.

## 2. Target design ("best-in-class" in practice)

```
 identity ─► deterministic facts ─► LLM research (gaps + fit) ─► score in code ─► signals ─► human review
 domain,      KRS / ARES / GLEIF,     Parallel Task/Responses      rubric from       Monitor:      review queue,
 register id  company site (Extract)  per-field citations+conf.    stored facts      news/tenders  sales notes = source
```

1. **Identity (entity resolution).** Each lead gets a canonical domain and a register ID (KRS number, IČO, LEI). This is the deduplication key for discovery and the join key for every other source. Today `website` is free text, and group subsidiaries are mixed with parents (Valeo, Jenoptik, Rheinmetall).
2. **Deterministic facts.** Legal name, address, founding or registration date, status, PKD/NACE codes, and the board where public. Then fetch and extract 3–5 pages of the company's own site (products, about, contact).
3. **Structured LLM research, only for what remains.**
   - Fields: `products[]`, `fit_evidence[]` (product, the LC part it implies, URL), `recent_news[]` and `signals[]`.
   - Batch runs use the **Parallel Task API**. Its per-field `basis` returns citations, reasoning and a high/medium/low confidence. Do not ask for these in the schema; threshold on them before writing anything.
   - Interactive refresh uses Responses `medium`, with Perplexity as the fallback.
   - Use `source_policy.include_domains` to pin the company's own domain where useful.
4. **Fit score computed in code**, from stored facts and a rubric written with Łukasz. Example: "builds a product with a laser rangefinder, LiDAR, laser sensor or APD receiver" scores +X; "seller or competitor" overrides to 0. No new web call is needed at scoring time. This replaces the regex-on-prose approach and makes scores explainable.
5. **Signals.** Parallel Monitor ($3–10 per 1,000 runs) or a scheduled job covering:
   - company news;
   - EU tenders (the TED API) and Polish procurement;
   - trade-fair exhibitor lists (MSPO, IDET, Eurosatory);
   - job ads for optics or laser engineers.

   A signal creates a note and notifies the lead owner. Signals answer "why call this week".
6. **Provenance and human review.**
   - A `lead_facts` table: lead_id, field, value, source_url, source_type (register / site / llm / human), provider, confidence, observed_at and job_id.
   - Machine values never overwrite values a human entered. A conflict goes to a review list.
   - A salesperson's note counts as a source with the highest trust.
   - Each field gets a time-to-live: founding year never expires, products after 6 months, news after 30 days.
7. **Evaluation harness.**
   - Freeze the 20 bake-off leads, with their verdicts, as a gold set, and grow it to 50.
   - Each month, re-run every candidate engine. Record accuracy, wrong-fact count, specific-relevance rate, p50/p90 latency, cost per lead, and the share of citations that resolve.
   - Switch engines per field type when the data says so.
   - This is the honest version of "we monitor the engines".

## 3. Epic breakdown (proposed beads, in order)

| # | Story | Size | Gate |
|---|---|---|---|
| E0 | **Decide with Łukasz**: the 5 fields reps need, the fit rubric (what counts as a buyer), and the policy on people and contacts | 1 meeting | Blocks E4 and E6 |
| E1 | **Data-flow approval**: Parallel DPA, retention and sub-processors in writing; correct the documented payloads; customer go | external | Blocks any Parallel production traffic |
| E2 | Identity: normalise the website domain, add `register_id` and `register_type`, write a backfill script (KRS by name or NIP, ARES by name) with a manual review list for ambiguous matches | 1–2 d | — |
| E3 | `lead_facts` provenance table, plus a write policy (never overwrite human values; conflicts go to review) | 1 d | — |
| E4 | Deterministic layer: KRS, ARES and GLEIF adapters; company-site extract; TTL per field | 2 d | E2 |
| E5 | Provider interface (`ResearchProvider`: enrich, refresh, discover) with Perplexity and Parallel adapters; per-field confidence threshold; cost logging | 1–2 d | coordinate with the agent editing `ai.ts` |
| E6 | Batch enrichment of all 396 leads: Parallel Task `core` through a task group, polled from the worker (ngrok quota rules out webhooks); hard cap of $25 | 1 d plus the run | E1, E3–E5 |
| E7 | Fit score computed in code from `lead_facts` and the rubric; show score components and evidence links on the lead card | 1 d | E0, E6 |
| E8 | Evaluation harness: gold set of 20 growing to 50, a monthly job, a results table, and a dated report in `docs/research/` | 1 d | — |
| E9 | Signals: Monitor or scheduled jobs for news and TED tenders on leads ranked A or B; notify the owner | 2 d | E1, E7 |
| E10 | Adoption metrics: how often enrichment and score are opened per user, and which fields are read | 0.5 d | — |
| (separate epic) | **Discovery**: Entity Search with buyer-framed objectives, domain dedupe against the base, enrichment of the shortlist, a human accept/reject step | — | E2 |
| (separate epic) | **People and contacts**, if E0 allows | — | E0 |

Running cost:
- One-off: about $10–25 for the full base, plus about $2 for the gold set per engine per month.
- Ongoing: signals and refreshes at roughly $5–20 per month at the current volume.

The cost is negligible either way. The real constraints are the customer's approval and whether the salespeople adopt the tool.

## 4. Slide wording (suggestion)

> **Research engines are interchangeable parts, chosen on evidence.** Every month we test the leading engines, currently Perplexity and Parallel, against a fixed set of your leads that we have verified by hand. We measure accuracy, speed and cost, and use the best engine for each task. Results are stored in LC Connect with their sources, so a change of engine does not change your data or your workflow.

Do not claim "best-in-class" on the slide until E8 has produced at least two monthly runs.

## Sources (fetched 2026-10-05)

- Parallel pricing: Task processors, Extract, FindAll, Entity Search, Monitor, Responses. https://docs.parallel.ai/getting-started/pricing
- Parallel Task API: output schema and basis with citations, reasoning and confidence per field. https://docs.parallel.ai/task-api/ and https://docs.parallel.ai/task-api/examples/task-enrichment.md
- Parallel Source Policy (`include_domains` / `exclude_domains`). https://parallel.ai/blog/source-policy
- Perplexity Agent API presets and tools (`web_search` $5/1k, `fetch_url` $0.50/1k, JSON Schema output). https://docs.perplexity.ai/docs/agent-api/presets and https://docs.perplexity.ai/docs/agent-api/tools
- The waterfall enrichment pattern. https://stacksheriff.com/tools/clay-waterfall-enrichment/ and https://university.clay.com/lessons/enrich-people-waterfalls-clay-101
- GLEIF (CC0, keyless API) and OpenCorporates (free tier of 500 calls a month). https://dev.to/0012303/9-free-company-data-apis-with-no-key-or-signup-2026-3dik and https://thegtmdirectory.com/tools/opencorporates/md
- Official KRS API (`api-krs.ms.gov.pl`) and ARES REST: used live in the bake-off, see `scratchpad/bakeoff/reg/`.
- TED API for EU tenders: not checked in this session. Verify before E9.
