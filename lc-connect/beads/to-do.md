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

## Phase 1 — this week
- [ ] OAuth state → Postgres tables (codes, clients, refresh tokens)
- [ ] Enforce PKCE (reject missing code_challenge) once both clients confirmed sending it
- [ ] Widget lib 0.2.0 → 0.4.0 (dark mode + mobile)
- [ ] pino JSON logging with user mixin + tool-call ledger; server.log rotation
- [ ] Watchdog: timer runs full login flow via public URL; restarts ngrok/node on failure (June ask, still open)
- [ ] jti deny-list / token revocation
- [ ] `export_data` take caps; `search_resources` select-only-needed columns

## Later / decision-gated
- [ ] Geography backfill: derive `country_id`/`region_id` from `leads.location` (10/396 have country today) — needed before region competencies mean anything
- [ ] Regions taxonomy per client (today: NA/EU/AS only; client wants France, Western Europe, Africa+emerging, Asia)
- [ ] Per-request McpServer rebuild → pooled server (measure first; ~580 KB garbage/request)
- [ ] SSE keep-alive on GET /mcp
- [ ] Widget coverage decision (15/42 tools have cards — by design?)
- [ ] Hosting off the company server (iKrystyna web?) — only if the client commits
