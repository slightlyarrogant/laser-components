# Parallel Web Systems vs Perplexity for LC Connect research calls

Date: 2026-10-04. Scope: the web-research calls in `lc-connect/src/tools/ai.ts`. Sources are vendor docs and pages fetched today unless a date says otherwise. Prices are in USD, as both vendors bill. Budget assumption: ≤ €100/month, roughly $110–120 (FX rate not checked).

## What LC Connect does today (from `src/tools/ai.ts`)

- One client, `PerplexityClient.analyze()`, sends `POST https://api.perplexity.ai/chat/completions` with `model: sonar-pro` (override: `PERPLEXITY_MODEL`), a fixed photonics system prompt, `temperature: 0.7`, `max_tokens: 1500` and `AbortSignal.timeout(30_000)`. It sends no `web_search_options` and no `response_format`.
- Parsing: the code reads only `choices[0].message.content` as **prose**. It drops Perplexity's `citations`/`search_results`, so users never see the sources. For `generate_lead_score`, the numbers come from regexes over that prose (`extractFactorScore`, `extractOverallScore`), and when a regex misses, the tile shows "—".
- Six tools call Perplexity: `analyze_product_market`, `discover_applications`, `enrich_lead`, `analyze_competition`, `generate_insights` and `generate_lead_score`.
- `enrich_lead` with the default `["all"]` makes **4 sequential calls** (company_info, market_position, technology_stack, growth_potential). Each call has its own 30 s budget, so the tool can take up to about 120 s.
- No current tool answers "which companies use product X in country Y". `discover_applications` returns *applications/industries* for a product, not companies. A company-finder would be a new tool.
- Logs: the only successful AI call in the retained logs is `enrich_lead` on 2026-09-29 at 21:07 UTC, which took 23.6 s. That was after Perplexity's Sonar end-of-support date (see below), so sonar-pro still answered at that point. Earlier errors were a missing key and the retired model name `llama-3.1-sonar-small-128k-online`.

## (a) Executive summary

1. **Perplexity has already moved under us.** Support for Sonar Chat Completions ended on **2026-09-27**. Synchronous requests "keep working: they are being reformulated as Agent API requests, rolling out gradually by model". Perplexity's own mapping sends sonar-pro to a preset (`fast` or `low`) that runs **`openai/gpt-6-luna`**. Keeping Perplexity therefore means migrating to its Agent API anyway, so this is not a "do nothing" choice.
2. **Perplexity's "no retention" claim is now narrower than we assumed.** The ZDR statement covers "the Chat Completions API". The Agent API "persists response and conversation state server-side" (`store:false` only hides a response). It also routes our prompts to a third-party model (OpenAI). Re-check the data terms before we cite "no retention" to the customer.
3. **Parallel fits lead-gen better in shape.** The Task API takes a JSON `output_schema` and returns structured fields. Each field (and since 2026-08-24, each list element) carries a *Basis*: citations, excerpts, reasoning and a calibrated confidence. That is exactly "name, website, country, evidence" rows, with no regex parsing of prose.
4. **Latency is the catch.** Task API observed p50 is 45 s (`lite`) and 50 s (`base`), with p90 at 1.5–2 min, which is more than our 30 s timeout. A synchronous MCP tool needs Parallel's **Responses API** (OpenAI-compatible, `low` 5–10 s, `medium` 15–20 s, `high` 30–60 s, `json_schema` structured output supported) or **Entity Search** (synchronous, "seconds").
5. **Quality:** every benchmark that favours Parallel's Task API was **run by Parallel** (for example BrowseComp `core` 91% vs "Perplexity high" 86%). The only independent index, Artificial Analysis Search Index (Aug–Sep 2026), covers the raw *Search API* layer: Perplexity Search (medium) 80, Parallel Search (advanced) 75, Exa 74. Neither source tests B2B company enrichment in EU photonics. Only a bake-off on our own leads can settle quality.
6. **Cost is not the deciding factor.** Every realistic mix for 300 enrichments + 60 discovery + 100 scores costs about **$5–$75/month** on either vendor. The one exception is FindAll `core`/`pro` for discovery, which goes over budget (about $345+).
7. **Data terms are the real gate.** Parallel by default **stores** run data. ZDR is enterprise-only (or via the GCP Marketplace ZDR listing for grounding). Its EU endpoint covers **only the Search API**, and data sits in US data centres. Parallel holds SOC 2 Type I+II and does not train on customer data.
8. **Recommendation: hybrid, with a bake-off first.**
   - Move `enrich_lead` to **Parallel**: one call with a JSON schema instead of 4 prose calls. Use the Responses API `medium` + `json_schema` for interactive calls, and the Task API `core` + webhook for batch enrichment written to the DB.
   - Add a new `find_companies` tool on **Entity Search** (sync), with an optional FindAll `base` for verified lists.
   - Move `generate_lead_score` to Parallel structured output, which removes the regex parsing.
   - Keep `generate_insights`, `analyze_product_market`, `analyze_competition` and `discover_applications` on Perplexity, migrated explicitly to the Agent API (`low` preset, frozen config). They are prose analysis, and this way Perplexity's auto-reformulation does not decide our output for us.
9. **Before any switch:** run 20 real LC leads through both vendors, scoring field accuracy and verified URLs, and get Parallel's DPA, retention period and sub-processor list in writing. A customer-facing data-flow change needs Bogdan's and the customer's go.
10. **Do now, whatever we decide:** stop discarding citations. Both vendors return sources, and our users currently see none.

## (b) Comparison: Parallel vs Perplexity

| Dimension | Parallel Web Systems | Perplexity (API) |
|---|---|---|
| Product surface | Search API (`turbo`/`fast` $1/1k, `basic`/`advanced` $5/1k); Extract ($1/1k URLs); **Task API** (9 processors `lite`…`ultra8x`, JSON `output_schema`, Basis per field, webhooks/SSE, Task Groups for batches, `interaction_id` follow-ups); **Responses API** (OpenAI Responses-compatible, model `parallel`, effort low/medium/high, `text.format: json_schema`, MCP tools, launched 2026-07-21); Chat Completions `/v1beta/chat/completions` (beta, can run Task processors); **FindAll** (async entity discovery with match conditions + enrichments); **Entity Search** (sync company/people search, 5–1000 results: name, url, description; beta); Monitor (GA 2026-05-06); Memory (stores past research). | **Agent API** (`/v1/agent`, alias `/v1/responses`; presets fast/low/medium/high/xhigh over OpenAI/Anthropic/Google/… models; tools web_search, fetch_url, people_search, finance_search, sandbox, MCP; `json_schema` output; background mode); Search API ($5/1k, fast $1/1k); legacy Sonar Chat Completions (support ended 2026-09-27, sync requests auto-reformulated). |
| Maps to our tools | enrich_lead → Task/Responses + schema; find companies (new) → Entity Search / FindAll; lead_score → Responses + schema; insights/market/competition → Responses `medium`/`high` (prose) | All six tools as today (prose), or Agent API presets with `json_schema` |
| Structured lead rows | Native. Schema in, typed fields out, **per-field and per-list-element citations + confidence** (GA 2026-08-24). | Possible with `response_format: json_schema` on the Agent API. Citations come back as a separate `search_results` list, not per field. Docs warn that links requested *inside* JSON "may… result in hallucinations or broken links". The first request with a new schema adds 10–30 s. |
| Benchmarks (vendor-run) | Parallel's page, run by Parallel: Task API BrowseComp `lite` 88% @ $5 CPM, `core` 91% @ $25, `ultra4x` 94%, vs "Perplexity high" 86% @ $441.5 (tested 2026-08-26, 100 questions). DeepSearchQA: `lite` 76%, `pro` 83% vs Perplexity high 68%. Search API SimpleQA Verified: Parallel fast 94%, Perplexity low-cost 94%, frontier 95% (2026-09-09). | Perplexity's migration page claims Agent API presets beat every Sonar model on BrowseComp/DSQA/WideSearch. No numeric table was extracted. |
| Independent evals | Artificial Analysis Search Index (Search API layer only, GPT-5.6 Luna agent, 1,700 questions): Parallel advanced 75, basic 73, turbo 67. | Same index: **Perplexity Search (medium) 80**, the top score (reported 2026-08-28, snapshot 2026-09-02). It does not test Sonar/Agent answers. |
| Latency | Task: `lite` 10 s–2 min (p50 45 s), `base` 15 s–3 min (p50 50 s), `core` 60 s–5 min (p50 1.5 min), `pro`+ minutes, plus queue time. Responses: low 5–10 s, medium 15–20 s, high 30–60 s. Entity Search: "seconds". Search fast ~700 ms, turbo p50 200 ms. | sonar-pro observed 23.6 s for one enrich_lead (our log). Agent API preset latency is not published as numbers. |
| Fits a 30 s sync MCP call | Responses `low`/`medium`, Entity Search, Search. **Not** the Task API (any processor) or FindAll, which need async plus a webhook or poll. | `fast`/`low` presets (likely). `medium`+ not guaranteed. |
| Rate limits (default) | Task 2,000/min, Responses/Chat 300/min, Search 600/min, FindAll 300/hour, Entity Search 600/min | Tiered by lifetime spend (Tier 0 $0 → Tier 5 $5k+). Agent API QPS per org. |
| Free credits | $5/month for orgs with a card on file (changelog 2026-07-15). The pricing page also says "up to $80 at registration" (not reconciled). Search MCP free without a key (2026-04-23). | None found. |
| Funding / maturity | Series B $100M at $2B (Sequoia, 2026-04-29). About $230M raised in total. Customers: Clay, Harvey, Notion, Opendoor. Claims 100k+ developers. Very frequent API changes: `/v1beta`→`/v1` for Search/Extract with 422 on the old body shape. FindAll/Entity Search are beta (30-day breaking-change notice). | Large and mature company, but the API surface was just replaced (Sonar → Agent API, async Sonar killed 2026-09-27). Presets change their underlying model silently (Sept 2026: low/medium/high moved to GPT-6; xhigh moved to Claude Opus 5.5). Pin a frozen config if stability matters. |
| Status / incidents 2026 | status.parallel.ai. March 2026: failures on Ultra processors in the Task API. April 2026: DNS disruption on search-mcp (~10 min, then OAuth reconnect errors up to 30 min). | Status page exists (docs "System Status"). Incident history not reviewed. Third-party gateways (llmgateway, Dify, Bifrost, TrueFoundry) published migration notices: abrupt sunset, and the deadline was "poorly announced". |
| SDK (TypeScript) | `parallel-web` on npm, v1.3.5 (2026-09-30). The Responses API also works with the plain `openai` npm SDK (change baseURL/model). | `@perplexity-ai/perplexity_ai` v0.38.7 (2026-10-02). We use raw `fetch`, so no SDK is required. |
| MCP | Hosted Search MCP (free) and Task MCP, plus OAuth endpoint `search.parallel.ai/mcp-oauth`. | Agent API can *call* MCP servers. No hosted Perplexity MCP for our use was checked. |
| Lock-in | Responses API is OpenAI-compatible, so it is easy to swap. Task/FindAll schemas are proprietary but simple JSON. | Agent API follows "Open Responses" and is OpenAI-shaped. Presets are opaque but can be frozen. |

## (c) Cost estimate: 300 enrichments + 60 discovery queries + 100 scores per month

Assumptions: about 300 input and 700 output tokens per prose call (cap 1,500). Our payload sets no `search_context_size`, so the lowest sonar-pro fee is the low case and `high` is the upper bound (the default could not be confirmed in current docs). Agent API cost assumes 3–5 `web_search` calls and 15–30k input tokens per answer. That is an estimate, because Perplexity publishes no per-preset cost.

| Scenario | Calls | Unit cost | Monthly |
|---|---|---|---|
| **P0** Perplexity sonar-pro, legacy rate card ($3/M in, $15/M out, $6–14 per 1k requests), code as-is (enrich = 4 calls) | 1,200 + 60 + 100 = 1,360 | $0.017–0.037 | **$24–51** |
| P0b Same, enrich collapsed to 1 call | 460 | $0.017–0.037 | $8–17 |
| **P1** Perplexity Agent API `low` preset (gpt-6-luna $0.10/$0.50 per M + web_search $2.50/1k), code as-is | 1,360 | ≈ $0.010–0.016 (est.) | ≈ $13–22 |
| P1b Same, enrich collapsed to 1 call | 460 | ≈ $0.010–0.016 | ≈ $4–7 |
| **X1** Parallel Responses API only, 1 call per tool use | 460 | low $0.01 / medium $0.05 | $4.60 (low) / $23 (medium) |
| **X2** Parallel recommended mix: enrich Task `core` ($25/1k) + discovery Entity Search ($5/1k) + score Responses `medium` ($50/1k) | 300 + 60 + 100 | — | $7.50 + $0.30 + $5.00 = **$12.80** |
| X2b Same, enrich on Task `base` ($10/1k) | | | $8.30 |
| **X3** X2, but discovery on FindAll `base` ($0.25 + $0.03/match, 25 matches each) | 60 runs | $1.00/run | $7.50 + $60 + $5 = **$72.50** |
| X3' Discovery on FindAll `core` ($2 + $0.15/match, 25 matches) | 60 runs | $5.75/run | $345 for discovery alone: **over budget** |
| Parallel Search only (fast) + our own LLM for synthesis | per search | $0.001 | <$2 search + LLM tokens |

Notes: Parallel bills only completed runs. FindAll enrichments add Task-processor price × matches. The $5/month free credit applies to Parallel. Every scenario except FindAll `core`/`pro` fits under €100. Discovery volume decides the bill.

## (d) Integration sketch

| LC Connect tool | Parallel endpoint / processor | Mode | Expected latency | Notes |
|---|---|---|---|---|
| `enrich_lead` (interactive) | `POST /v1/responses`, `model: "parallel"`, `reasoning.effort: "medium"`, `text.format: json_schema` {size, founded, hq_country, products[], laser_photonics_use, recent_news[], growth_signals} | sync | 15–20 s | Replaces 4 serial prose calls with 1. Map `web_search_call` and annotations to sources. Timeout ≥ 60 s for safety; 30 s is enough for `low`. |
| `enrich_lead` (batch / "enrich all new leads") | `POST /v1/tasks/runs` (Task Groups for many) with processor `core` (`base` if ≤ 5 fields), `task_spec.output_schema` JSON, `webhook` | async | p50 1.5 min, p90 3 min (+ queue) | Return "queued", write the result plus Basis (citations/confidence per field) to the lead record on webhook. Persist the result, because ZDR accounts lose it and we should not depend on Parallel storage. |
| **new** `find_companies` (product X in country Y) | `POST /v1beta/findall/entity-search` {entity_type: companies, objective, match_limit 25–100} | sync | seconds | Recall-oriented and not verified: present as candidates. Optional follow-up: FindAll `base` run with match conditions (for example "uses avalanche photodiodes", "HQ in DE") + webhook for a verified list. |
| `discover_applications` | Responses `medium` + schema {application, sector, use_case, requirements, evidence_url}, or keep Perplexity | sync | 15–20 s | Low priority: this is ideation, not facts. |
| `generate_lead_score` | Responses `medium` + schema {factors:[{factor, score 0–100, reasoning}], overall, next_steps} | sync | 15–20 s | Removes `extractFactorScore` regex. Web research only adds value for company-fit facts. Pure scoring could run on any LLM. |
| `generate_insights`, `analyze_product_market`, `analyze_competition` | Keep Perplexity, migrated to Agent API `preset: "low"` (or frozen config) | sync | likely < 30 s for `low` (unverified) | Prose analysis. Alternative: Parallel Responses `high` (30–60 s), which needs the timeout raised. |

Implementation notes: use the `openai` npm SDK with `baseURL: "https://api.parallel.ai/v1"` for the Responses API, or `parallel-web` for Task/FindAll. A webhook needs a public endpoint: our ngrok URL works, but the watchdog ngrok request quota applies (≤ 1 probe/30 min, see memory), so polling `GET /v1/tasks/runs/{id}/result` from a worker is the quota-safe option. Keep `PerplexityClient` behind an interface so that each tool can choose its provider.

## (e) Data terms

| Provider | Trains on API data | Retention (default) | ZDR | DPA | EU residency | SOC 2 | Notes |
|---|---|---|---|---|---|---|---|
| **Parallel** | No ("Never… We do not use customer data to train any models", FAQ) | Runs are stored and retrievable. Memory feature retains research unless disabled. Period not published. | Enterprise agreement only, or GCP Marketplace ZDR listing (grounding). ZDR disables stateful features. | Yes, DPA referenced in the privacy policy (processor role) | **Search API only**, via the EU endpoint (processed in the EU, no content retained). Other data in US data centres. | Type I + II (as of Apr 2025) | Sub-processor list not public (trust.parallel.ai is gated). Claims HIPAA. |
| **Perplexity** | No | Chat Completions: none, billing metadata only. **Agent API: state persisted server-side** (`store:false` only hides it). | Agreement via account team. Docs say to check stateful features under ZDR. | Via sales, with SCCs (third-party review, not seen first-hand) | Not offered by default (US). Nothing in the docs. | Type II | Presets run on OpenAI/Anthropic models, which makes them sub-processors. EU-US DPF certification noted as ending 2026-10-08 (third-party source, unverified). |
| Exa | No (enterprise) | Not checked | Enterprise plans | Not checked | Not stated | Type II | — |
| Tavily | Not checked | Not checked | Claimed ZDR | Not checked | Not stated | SOC 2 | — |
| Brave Search API | No | Queries kept ≤ 90 days for billing/troubleshooting | Enterprise plan | Yes (DPA) | Not stated | Not checked | Raw search only, so an LLM is needed on top. |
| Firecrawl (/search + LLM) | Not checked | Not checked | Enterprise (email support) | Not checked | Not stated | Not checked | Scrape/search, needs our own LLM. |
| OpenAI web_search tool | No (API) | 30-day abuse logs unless ZDR | Listed as ZDR-eligible (docs table; live web search not BAA-covered) | Yes | **Yes**, EU project (regional processing EEA + CH) | Yes | Strongest EU story of the LLM-native options. |
| Anthropic web_search tool | No (API) | Standard API retention | `web_search_20250305` eligible. Newer dynamic-filtering versions only with `allowed_callers:["direct"]`. | Yes | Not checked | Yes | $10/1k searches + tokens. Third-party reports say Fable 5/Mythos 5 require 30-day retention (not verified). |
| Google Gemini grounding | Developer API may use data unless paid/opt-out | Google Search grounding ToS has its own retention | Parallel-on-GCP ZDR listing exists. Native Google grounding ZDR not confirmed. | Yes (Cloud) | Vertex regions | Yes | About $14/1k grounded queries after free quota. |
| You.com | No (claimed) | Not checked | Claimed ZDR | Not checked | Not stated | SOC 2 (claimed) | Research API $12–$2,000+/1k by depth. $100 free credit. |

One-line verdicts on the alternatives: **Exa**: strong neural company search, close to Parallel on the AA index (74), more expensive at the frontier tier. **Tavily**: cheap and popular, weakest on the hard benchmarks. **Brave**: the only one with an explicit 90-day cap and DPA by default, but it returns raw results only. **Firecrawl**: DIY. **OpenAI web search**: the best EU residency + ZDR option if we are willing to build the research loop ourselves. **Anthropic web search**: ZDR-eligible basic version, fits if we already pay for Claude. **Gemini grounding**: retention terms are awkward under GDPR. **You.com**: an almost identical product line to Parallel, at higher prices for low tiers.

## (f) Sources (all fetched 2026-10-04 unless noted)

- Parallel pricing: https://parallel.ai/pricing and https://docs.parallel.ai/getting-started/pricing (undated)
- Parallel rate limits: https://docs.parallel.ai/getting-started/rate-limits
- Parallel processors and observed latency: https://docs.parallel.ai/task-api/guides/choose-a-processor
- Parallel Responses API: https://docs.parallel.ai/responses-api/responses-quickstart; structured outputs: …/features/structured-outputs; statefulness/ZDR: …/features/statefulness
- Parallel Entity Search: https://docs.parallel.ai/findall-api/entity-search; FindAll generators: …/core-concepts/findall-generator-pricing
- Parallel full docs dump: https://docs.parallel.ai/llms-full.txt (changelog entries 2026-03-10 → 2026-09-24)
- Parallel benchmarks: https://parallel.ai/benchmarks (tests dated 2026-08-26 and 2026-09-09, run by Parallel)
- Parallel FAQ (SOC 2, training, US data centres): https://docs.parallel.ai/resources/faqs
- Parallel privacy policy (DPA, EU Search endpoint): https://parallel.ai/privacy-policy (undated)
- Parallel status history: https://status.parallel.ai/history
- Funding: TechCrunch 2026-04-29, https://techcrunch.com/2026/04/29/parallel-web-systems-hits-2b-valuation-five-months-after-its-last-big-raise/
- Artificial Analysis Search Index: https://artificialanalysis.ai/articles/search-api ; Perplexity entry: https://cryptobriefing.com/perplexity-tops-artificial-analysis-search-index/ (2026-08-28, snapshot 2026-09-02)
- Perplexity pricing: https://docs.perplexity.ai/getting-started/pricing (Sonar rate card rendered by the calculator; Agent API tool prices)
- Perplexity Sonar → Agent API: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview , …/benchmarks , …/how-to ; presets: https://docs.perplexity.ai/docs/agent-api/presets ; changelog Sept 2026
- Perplexity privacy and security: https://docs.perplexity.ai/docs/resources/privacy-security ; rate limits: …/docs/admin/rate-limits-usage-tiers
- Perplexity full docs dump: https://docs.perplexity.ai/llms-full.txt
- Sonar retirement coverage: https://llmgateway.io/blog/perplexity-sonar-api-retirement , https://dev.to/kashif_manzer/two-ai-apis-die-this-weekend-perplexity-sonar-sep-27-and-appsmith-ai-sep-30-599h (Sept 2026)
- Perplexity DPA/DPF (third-party review): https://companyscope.io/vendors/perplexity
- Anthropic web search + ZDR: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool , …/server-tools
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data ; EU residency: https://openai.com/index/introducing-data-residency-in-europe/
- Brave ZDR: https://brave.com/blog/search-api-zero-data-retention/ ; Exa security: https://docs.exa.ai/reference/security
- You.com pricing: https://parallel.ai/articles/you-com-vs-parallel (2026-07-27, competitor-authored) and https://docs.you.com/administration/billing
- npm: `parallel-web` 1.3.5 (2026-09-30), `@perplexity-ai/perplexity_ai` 0.38.7 (2026-10-02)
- LC Connect logs: `lc-connect/server.log*` (2026-09-15 → 2026-10-04)

## (g) Could not verify

- **How reformulated sonar-pro calls are billed** after 2026-09-27 (legacy Sonar rate vs Agent API tokens + tools), and **which preset** sonar-pro maps to. The docs contradict each other: the benchmarks page says `fast`, the AG2 page says `low`.
- Whether reformulated Sonar requests are covered by the Chat Completions ZDR statement or persisted like native Agent API calls.
- The default `search_context_size` for sonar-pro (the current docs no longer state it).
- Agent API preset latency figures. Perplexity EU data residency. Perplexity's sub-processor list. EU-US DPF expiry on 2026-10-08 (third-party claim only).
- Parallel's **default retention period** for Task/Responses data, the **sub-processor list** and model providers (trust.parallel.ai is gated), whether the EU endpoint will cover Task/Responses, and DPA terms. These need a sales contact.
- Parallel free credits: "$5/month" (changelog) vs "up to $80 at registration" (pricing page).
- An "-fast" processor variant mentioned in third-party articles. It is not in the current processor docs, so it is treated as non-existent.
- Any **independent** evaluation of Parallel Task/Responses vs Perplexity Agent API answers. All answer-level benchmarks found are vendor-run, and none covers B2B company enrichment in EU niche manufacturing.
- Tavily, Firecrawl and You.com retention/EU details, and Exa EU residency. These come from search snippets and were not read from primary docs.
- The MCP client-side tool timeout in claude.ai/ChatGPT, which caps how long any sync research call may take.
