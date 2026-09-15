# LC Connect

Remote MCP server that exposes the Laser Components lead-generation database
(PostgreSQL) to Claude.ai and ChatGPT as tools, widgets, resources and prompts.

It is a **first-class connector living in this repository root** (`lc-connect/`)
— not an archived copy. It is built with the MCP TypeScript SDK on Hono, speaks
Streamable HTTP at `/mcp`, authenticates with its own OAuth 2.0 authorization
server (`/authorize`, `/token`, `/register`), and renders results through the
shared `@cfi/mcp-widgets` package (KPI cards, dataset tables, action cards,
message lists, maps) — the same widget library VendoConnect uses.

LC Connect is a **lead-generation** tool: it finds, enriches and organizes
leads. Closing and account management happen elsewhere.

---

## What it exposes

| Domain | Tools |
| --- | --- |
| Identity & admin | `whoami`, `manage_users` |
| Leads | `get_leads`, `search_leads`, `create_lead`, `update_lead`, `delete_lead`, `assign_lead`, `batch_create_leads`, `batch_update_leads`, `get_lead_notes`, `create_lead_note` |
| Catalog | `get_products`, `search_products`, `create_product`, `delete_product`, `get_categories`, `find_category_like_products` |
| Applications & geography | `get_applications`, `create_application`, `get_product_applications`, `create_product_application`, `get_regions`, `advanced_search` |
| Knowledge base | `list_resources`, `get_resource`, `find_workflow_guidance`, `read_workflow_guide`, `create_resource`, `update_resource`, `save_learning`, `get_pending_learnings` |
| AI / market intel | `analyze_product_market`, `discover_applications`, `enrich_lead`, `analyze_competition`, … (Perplexity-backed) |
| Analytics | `get_statistics`, `leads_analytics`, `leads_by_country` |
| Ops | `ping`, `report_issue` |

Plus DB-backed resources (`lc://resources/<slug>`), the `lc_session_start`
prompt, and a customer landing page served at `/demo`.

Every tool description starts with the tool's own name (`get_leads — list…`).
That is not cosmetic: VendoConnect measured host-side tool search dropping
tools whose description does not lead with the name.

---

## Roles & ownership (summary)

One company, many users. **Reading is open — everybody sees every lead.**
Writing is governed by role, ownership and region competency.

| Role | May do |
| --- | --- |
| `ADMIN` | Everything: delete leads and products, bulk-update leads, administer users (`manage_users`), edit any lead. |
| `RESEARCHER` | Everything SALES may do, plus writes to **shared company data**: product catalog, applications, product↔application mappings, knowledge base. |
| `SALES` | Create and import leads, edit leads they own or created (and unowned leads in their region), assign their own leads, add notes anywhere. |

**Ownership rule (`src/core/access.ts`, pure and unit-tested):** a lead may be
edited by its **owner**, by its **creator**, by an **ADMIN**, or — while it has
no owner — by anyone whose **region competency** covers it. A user with **no
regions assigned has global competency**. A lead someone else owns is off-limits
to everyone but its owner, its creator, and an admin.

**Notes are deliberately open**: any active user may add a note to any lead, and
the note is always attributed to the caller (there is no "write as" argument).

**Deactivated accounts** (`users.is_active = false`) cannot sign in — the login
returns the same message as a wrong password, so it is not an account-enumeration
oracle — and any still-valid access token they hold is refused at the tool layer.

Client-facing write-up: [`docs/roles-and-regions.md`](docs/roles-and-regions.md).
Codebase audit: [`docs/audit-2026-09-15.md`](docs/audit-2026-09-15.md).

---

## Run

```bash
npm install
npm run prisma:generate      # Prisma client from prisma/schema.prisma
npm run build                # tsc -> dist/
npm start                    # node dist/index.js
npm run dev                  # tsx watch, reads .env
npm run typecheck            # tsc --noEmit
```

The production instance runs as the user systemd unit `lc-connect.service` on
port 3003, published through ngrok. **Do not restart it casually** — it is live
with a client. To try a change, start a throwaway instance on another port with
its own `STATE_DIR`:

```bash
PORT=3114 PUBLIC_URL=http://localhost:3114 STATE_DIR=/tmp/lc-state \
  node --env-file=.env dist/index.js
```

### Environment (`.env`, gitignored — see `.env.example`)

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (`?schema=public`). |
| `LC_JWT_SECRET` | HS256 secret for access tokens. Placeholder values are rejected at boot. |
| `PUBLIC_URL` | Public base URL; also the JWT issuer and OAuth discovery base. |
| `PORT` | Listen port (default 3003). |
| `STATE_DIR` | Absolute path for the OAuth client registry and refresh tokens. Must live outside the checkout. |
| `PERPLEXITY_API_KEY` | Optional; required only by the AI market-intel tools. |
| `WHATSAPP_URL`, `WHATSAPP_RECIPIENT` | Optional; used by `report_issue`. |

---

## Database & migrations

**This project has no `prisma/migrations` directory** — the schema was applied
ad hoc before Prisma was introduced, so `prisma migrate` and `prisma db push`
must **not** be run against the live database. Schema changes are hand-written,
idempotent SQL in `db/migrations/`, applied with `psql` and then mirrored into
`prisma/schema.prisma`:

```bash
# apply (strip the ?schema=public suffix psql does not understand)
PGURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's/[?&]schema=public//')
psql "$PGURL" -v ON_ERROR_STOP=1 -f db/migrations/2026-09-15-ownership.sql

# then mirror into prisma/schema.prisma and check the result is drift-free
npm run prisma:generate
npx prisma migrate diff --from-url "$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" \
  --to-schema-datamodel prisma/schema.prisma --script
```

`db/migrations/2026-09-15-ownership.sql` adds `users.is_active`,
`users.display_name`, the `user_regions` competency table, `leads.owner_user_id`,
and the lead/note indexes (the live `leads` and `notes` tables previously had no
index beyond their primary key).

---

## Scripts

```bash
# create or update an account (re-running leaves the password alone)
npx tsx --env-file=.env scripts/add-user.ts <email> <password> <ADMIN|RESEARCHER|SALES> [displayName] [regionCodes,comma]
npx tsx --env-file=.env scripts/add-user.ts anna@lc.de S3cretPass1 SALES "Anna Weber" EU

# reset a password (bcrypt cost 12, same format the login path verifies)
npx tsx --env-file=.env scripts/set-password.ts <email> <newPassword>

# seeds
npx tsx --env-file=.env scripts/seed-test-user.ts
npx tsx --env-file=.env scripts/seed-knowledge.ts
```

Day to day, an admin does the same things in chat with `manage_users`
(`list` / `create` / `set_role` / `set_regions` / `deactivate` / `reactivate` /
`reset_password`). The scripts exist for bootstrap and for when nobody can sign
in.

---

## Tests

```bash
npx tsx --test tests/*.test.ts
```

`tests/access.test.ts` covers the authorization rules end to end without a
database: admin edits anything; owner and creator edit their own; a
global-competency user claims unowned leads; a regional user claims unowned
leads in region and is refused out of region; and everyone but the owner,
creator and admins is refused on an owned lead.

---

## Conventions

- Resolve names to IDs with a lookup tool before calling a write tool. Never
  guess `productId`, `applicationId`, `leadId`, `regionId` or `countryId`.
- Tool descriptions follow `USE WHEN` / `DON'T USE WHEN` / `RETURNS` /
  `GOTCHAS`, with an `OWNERSHIP` or `ROLES` line on every gated write tool.
- Large result sets return a dataset widget (sortable table + CSV), not inline
  JSON. The widget is the answer — do not restate its rows in prose.
