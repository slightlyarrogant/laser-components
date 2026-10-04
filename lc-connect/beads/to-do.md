# LC Connect — beads (2026-09-15)

## HANDOFF 2026-10-04 (read first after compaction)
- [ ] Monday 5.10, 16:30: meeting with Alice (+ probably Alex). Deliverable agreed with Łukasz 3.10: short English deck + harness diagram "in their language" (not training, harness; contract not tool; ZDR; no private subscriptions; what it does; what we need). Being built in docs/alice-2026-10-05/. Łukasz makes his own version, merge before 16:30. Security one-pager = backup slide in the deck.
- [x] 3.10 meeting with Łukasz: notes docs/meetings/2026-10-03-piastowska-lukasz-notatka.md (+ transcript). Money: not settled; Łukasz: "small program vs strategy = different money", Alice does not decide. Next: Łukasz at Alice in Munich Fri 9.10; proposes next step 2nd week of November. Swedes asked to test after his presentation — parked until formal green light.
- [ ] After green light: 3-step package for Alice (pilot → implementation project 25–35 k → partnership 8 k/mo from 1.01.2027), docs/pricing/.
- [ ] RESEARCH PROVIDER (found 4.10, docs/research/2026-10-04-parallel-vs-perplexity.md): Perplexity ended Sonar Chat Completions support 27.09.2026; our sonar-pro calls are silently reformulated into the Agent API (stored state, OpenAI model underneath) → the "not retained" claim no longer holds. Plan: (1) bake-off 20 real leads Perplexity Agent API vs Parallel (Responses API medium + json_schema for enrich/score, Entity Search for a new find_companies tool); (2) get Parallel DPA/retention/sub-processors in writing (ZDR enterprise-only, EU endpoint = Search API only); (3) whichever wins: show citations to users (code drops them today), collapse enrich_lead from 4 serial calls to 1 structured call, put PerplexityClient behind a provider interface. Cost either way $5–75/month at our volume. Provider switch = customer data-flow change → Bogdan + customer go.
- [ ] DOC/CODE MISMATCH (found 4.10 consistency review): brief, blueprint, service package and dossier say Perplexity gets "company name + website only", but src/tools/ai.ts also sends lead status, product of interest, revenue/employees (generate_lead_score), product interest counts (generate_insights), LC product data (analyze_product_market). Decide: trim payloads or correct the wording in all four docs before Alex asks. Same docs still say "sign-in check through the public address every 5 min" — reality: local 5 min, public 30 min.
- [ ] After green light: define "formal pilot" on paper (duration, users, cost) — Alice has only the 12-month service package; the 3-step path exists only internally.
- [ ] Łukasz's 24.09 WhatsApp batch (11 photos + 8 videos) LOST (bridge purge). Ask Bogdan to export from phone to docs/comparison-kit/raw/lukasz-mail/2026-09-24/ or ask Łukasz to resend; then transcribe.
- [ ] Munich visit 10–11.11 (two days; fly together, Łukasz continues to Sofia): demos planned = CAD fit-check, photo-of-list → visit plan on real data, Germany discovery live. Sales training on site after 6–7.12.
- [ ] Humantic AI: take 7-day trial, test on Łukasz's Romania/Bulgaria trip (10–20 known people), compare prompts.
- [ ] Restore Bogdan's personal instructions in claude.ai ("only Vendo") and ChatGPT custom instructions after the evaluation period.
- [ ] Majordomo: Hermes media retention fix (saved in majordomo memory f5).


Source: docs/audit-2026-09-15.md. Decisions (Bogdan, 2026-09-15): internal single-company; per-user ownership + roles by region;
open visibility (everyone reads everything); hosting stays on the company server (Sinktank) + ngrok; Phase 0 + ownership repairs today, restart, hand structure to client.

## Phase 0 — emergency (DONE 2026-09-15, live since 14:52)
- [x] OAuth state files → absolute `STATE_DIR` (survive re-clone), gitignored, chmod 600
- [x] `WHATSAPP_URL` → :3092 in .env; 30 s timeout on WhatsApp + Perplexity fetches; `.max()` on report fields
- [x] Demo credentials off the public landing page; rotate demo password; store in gitignored access sheet
- [x] Deactivate legacy users (admin, admin@example.com, test@example.com) — `is_active=false`, login rejects inactive
- [x] Bearer on `/session-log*`; dataset CSV handle → full UUID, 30 min TTL, no CORS `*`
- [x] PKCE S256 verified when present; redirect_uris stored at /register and exact-matched at /authorize + /token
- [x] Rate limit /authorize /token /register; global 1 MB body limit
- [x] JWT iss/aud + TTL 4 h
- [x] `process.on` handlers + SIGTERM graceful (server.close + prisma.$disconnect); transport.close() in finally
- [x] datasets store cap (50 entries / 50 MB / 30 min, interval prune); logEmitter.setMaxListeners
- [x] Unit: MemoryMax=1500M, Restart=always, NoNewPrivileges, PrivateTmp; ngrok unit: drop StartLimit cap
- [x] `npm audit fix` (hono 4.13)
- [x] Commit + push landing polish (uncommitted since June)
- [x] Build → restart → verify register/authorize/token/mcp end-to-end via public URL → tell customer to re-add connector

## Ownership + roles (DONE 2026-09-15; unknown geography falls OPEN by decision)
- [x] Migration: `users.is_active`, `users.display_name`, `user_regions(user_id, region_id)`, `leads.owner_user_id`, indexes on leads(owner/created_by/region/country/status/product/created_at), notes(lead_id)
- [x] `src/core/access.ts`: `canEditLead`, `requireRole`; current user resolved from tenant sub per request
- [x] Creates stamp `createdByUserId` + `ownerUserId`; notes stamp `user_id` from context (drop caller-supplied userId)
- [x] Gating: delete_*/batch_update → ADMIN; catalogue/knowledge writes → ADMIN|RESEARCHER; lead edits → canEditLead
- [x] New tools: `whoami`, `assign_lead`, `manage_users` (ADMIN: list/create/set_role/set_regions/deactivate)
- [x] Filters `mine` / `ownerUserId` / `regionId` on get_leads + search_leads; `get_leads.limit.max(1000)`
- [x] `npm test` (node:test) for access rules; wire `_smoke.mjs` as `npm run smoke`
- [x] Tool descriptions: first line starts with the tool's own name (Vendo routing fix)
- [x] README rewrite; delete stale TODO block in tools/index.ts
- [x] Doc for the client: roles/regions structure + how to add users (`docs/roles-and-regions.md`)

## Gap-closing pass (2026-09-15, after "is this state-of-the-art?" review)
Verdict: connector core = current standard (Hono + McpServer + OAuth 2.1 DCR/PKCE + metadata endpoints). Gaps were identity, ops, data.
- [ ] **SSO / identity federation** — QUESTION TO CUSTOMER: which IdP (Entra ID / Google Workspace / Okta)? Then broker /authorize → their OIDC, map email → user row (2–3 d). Until answered: local accounts via manage_users.
- [x] Nightly DB backup: `deploy/backup-db.sh` → ~/backups/laser_components (30 d) + NAS /mnt/dysk/backups/laser_components; user timer `lc-backup.timer` 02:15; first run OK (190 KB)
- [x] Watchdog: `deploy/watchdog.sh` runs full public login flow every 5 min (`lc-watchdog.timer`), restarts ngrok or node by layer, Pushover on 2nd failure + on recovery; user `watchdog@lc-connect.local` (SALES); creds in gitignored deploy/watchdog.env
- [x] logrotate for server.log + deploy/*.log (weekly, 8, copytruncate)
- [x] Audit trail: ActivityLog on every write + refusals; `get_audit_log` (ADMIN|RESEARCHER); feed merges audit rows, user.* hidden from non-admins
- [x] OAuth state → Postgres (oauth_clients / codes / refresh tokens sha256) with one-time import of state/*.json (imported on 2026-09-15 restart)
- [x] Widget lib 0.2.0 → 0.4.0 dark mode + mobile (no breaking changes; LC amber accent falls back to library accent in dark — needs `themeDark` upstream)
- [x] Geography: 10 → 150 leads with country+region (website ccTLD allowlist, tag `geo:tld`, `--revert-tld`); +3 regions +26 countries; Turkey → Middle East; backlog 246 in scripts/README-geography.md
- [x] pino JSON logging + tool-call ledger (argsKeys only, no PII), redaction, userId mixin; old raw-args line removed
- [x] Client-facing structure doc: `docs/lc-connect-structure.md`
- [ ] Own R2 bucket/prefix for LC backups (today: local + NAS only)
- [ ] Region taxonomy per client (France / Western Europe / Africa+emerging / Asia) — needs customer input, after geography backfill

## After deployment to the customer's environment (re-test there; different hosting = different wiring)
- [ ] `report_issue` delivery: hermes bridge :3092 expects `{chatId, message}` (fixed) and answers `{success:true}` (check fixed); last live test 2026-09-15 still returned "delivery failed" — untested root cause, deliberately parked (Bogdan: not deployed yet, don't spend time now). In the new environment the bridge will not be on localhost: decide the channel (bridge over VPN / Pushover / email) and re-test end to end
- [ ] Watchdog + backup timers re-created for the new host; Pushover keys; NAS off-site copy replaced by the provider's storage
- [ ] Identity-provider (Entra ID) sign-in once the customer answers; then the public login flow in the watchdog switches to a service account or a synthetic check
- [ ] Full SLA verification checklist before go-live: register → sign-in → token → tools/list → whoami → get_leads → widget render (light/dark) → report_issue → audit row → backup restore drill

## Phase 1 — this week
- [x] OAuth state → Postgres tables (codes, clients, refresh tokens)
- [ ] Enforce PKCE (reject missing code_challenge) once both clients confirmed sending it
- [x] Widget lib 0.2.0 → 0.4.0 (dark mode + mobile)
- [x] pino JSON logging with user mixin + tool-call ledger; server.log rotation
- [x] Watchdog: timer runs full login flow via public URL; restarts ngrok/node on failure (DONE 2026-09-15, see gap-closing pass)
- [ ] jti deny-list / token revocation
- [ ] `export_data` take caps; `search_resources` select-only-needed columns

## Findings from the claude.ai end-to-end test (2026-09-17, as Łukasz/RESEARCHER)
- [x] `unowned` filter on get_leads/search_leads (model reached for export_data to find unowned leads)
- [ ] `get_regions` card renders "No data." in claude.ai although the model received the regions — check the envelope for that tool
- [ ] Widget-first brevity hides owner from the model: the dataset card carried 90 rows but the model saw only a slim summary and could not filter by owner. Consider a compact per-row summary (id, name, owner, status) in structuredContent up to ~50 rows
- [ ] Cap `export_data` (unbounded today) — it is the model's fallback whenever a filter is missing
- [ ] Connector icon in claude.ai shows the ngrok logo (no icon in server metadata) — add an LC Connect icon
- [ ] Sign-in page is the old dark template (green button, "Laser Components MCP Server") — restyle to the brand
- [ ] Landing page: Claude moved connectors to Customize → Connectors (was Settings → Connectors) — update the install steps + screenshot

## From Łukasz's own report + trip/fair maps (2026-09-29, sent to 9 LC colleagues)
- [ ] Trip planner from real base data: `plan_visits(country|region, days)` → route + list of leads with owner/status/notes, rendered on the existing map widget (replaces AI-drawn maps with invented detail like "100% local production")
- [ ] Trade-fair mode: import an exhibitor list (CSV/URL) → match against the base + candidates → hall route with stand numbers, flagged as approximate where the plan is not official
- [ ] "Today vs LC Connect+" one-liner in every customer doc: today = curated lead base + public-source enrichment; CRM history, quotations, internal contacts = after ERP integration
- [ ] Germany as first server-side discovery job (Exa/Tavily + Claude extraction → candidate leads with evidence, human approval)
- [ ] Restore Bogdan's personal instructions in claude.ai and ChatGPT after the evaluation period

## Later / decision-gated
- [ ] Lithuania (and other backlog countries) missing from `countries` — seed when the customer confirms geography blocks
- [ ] `themeDark` config surface upstream in @cfi/mcp-widgets so LC amber survives dark mode
- [ ] Activity feed: consider hiding `user.*` also from RESEARCHER (today ADMIN-only)
- [ ] Geography backfill: derive `country_id`/`region_id` from `leads.location` (10/396 have country today) — needed before region competencies mean anything
- [ ] Regions taxonomy per client (today: NA/EU/AS only; client wants France, Western Europe, Africa+emerging, Asia)
- [ ] Per-request McpServer rebuild → pooled server (measure first; ~580 KB garbage/request)
- [ ] SSE keep-alive on GET /mcp
- [ ] Widget coverage decision (15/42 tools have cards — by design?)
- [ ] Hosting off the company server (iKrystyna web?) — only if the client commits
