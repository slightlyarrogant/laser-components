# LC Connect — beads (2026-09-15)

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
