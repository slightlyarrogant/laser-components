# iKrystyna

## What it does for a business owner

iKrystyna is AutoOffice's own software product and its core business: statutory accounting for Polish limited
liability companies (sp. z o.o.), run on software AutoOffice built itself. Documents go to one e-mail address in any
format; back comes a single message: what is missing, what it blocks, by when. Books, VAT, payroll, declarations and
deadlines are kept by the system; an accountant reviews what the law or judgement requires. More than twenty companies
are registered.

## The automated accounting engine

Documents arrive from KSeF (Poland's national e-invoicing system), from e-mail and scans, and from banks. Each is
stamped into a processing registry before it is touched; extraction reads type, header and lines, then tax-ID, VAT-rate and
duplicate checks run. Posting into the double-entry ledger is deterministic: a rule set and account
dictionary, not a model guess. Payroll covers all Polish contract types and computes ZUS (state social insurance)
contributions; bank statements are matched against invoices. Month-end is gated: the bank account must reconcile to
the statement to the cent, and ledger, VAT records and KSeF must agree. Only then are the JPK_V7M file (the monthly
VAT ledger and return), KSeF submissions and ZUS and income-tax declarations generated. Anything ambiguous goes to a
person, every outgoing message is human-approved, and a person signs and files the declarations.

## iKrystyna Connect

Connect is an MCP server that lets the owner query their own books from Claude or ChatGPT in plain language: what is
due this month, what sits in the KSeF inbox, last month's profit and loss, overdue receivables, the state of the
close, whether a contractor is on the Ministry's VAT white list. Answers are figures and interactive widgets built
from the live ledger, not the model's general knowledge. Forty-five tools are registered, read-only by design; issuing
a sales invoice is the one exception, a prepare → confirm → issue sequence. Every other change is an audited request
to the office.

## Engineering facts

- **Isolation in the database, not in application code.** PostgreSQL row-level security covers the company-scoped
  tables; Connect takes the tenant from the JWT, never from a tool argument.
- **Tamper-evident audit trail.** An immutable log with a SHA-256 hash chain records financial actions; middleware logs
  every tool call with user, company and arguments.
- **Tested on CI.** 238 pytest files under `tests/`, including a tenant-isolation suite, behind 12 GitHub Actions
  workflows.
- **Operated as a service estate.** Around 40 systemd units on a Warsaw VPS behind Caddy with automatic TLS.
- **Monitored and backed up.** Prometheus, Grafana and Loki scrape the API, MCP server and PostgreSQL; timers watch filing deadlines and anchors; data is held in the EU, with nightly off-site backups and GDPR purges.

## Public addresses

- Marketing site: `https://ikrystyna.pl` — client panel at `https://ikrystyna.pl/panel/`
- iKrystyna Connect (MCP endpoint for Claude / ChatGPT): `https://connect.ikrystyna.pl/mcp`

## Figures in this folder

- `ikrystyna-architecture.svg` / `.png` — the pipeline diagram (landscape, 1600 × 800 viewBox)
- `ikrystyna-demo-monthly-summary.png` — monthly financial summary, demo company TechCode, July 2026
- `ikrystyna-demo-vat-report.png` — VAT position plus six closed months, same demo company
- `logo-krystyna.png`, `k-mark.png` — wordmark and monogram
- `demo-screenshots-plan.md` — provenance of the demo screenshots and what is still missing

---

## Evidence appendix

Every claim above, with the file it is taken from. All paths are on the AutoOffice development machine.

**Product and scope**

| Claim | Source |
|---|---|
| Full accounting for sp. z o.o.; single e-mail intake, any format; KSeF invoices pulled by the office | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/components/Steps.tsx`; `/home/bogdan/Desktop/ikrystyna-marketing-site/src/pages/LandingPage.tsx` (FAQ "Jak wysyłam dokumenty?") |
| One summary message: what is missing, what it blocks, by when | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/components/Steps.tsx` |
| KSeF 2.0, FA(3) schema, KSeF numbers kept in the records, JPK_V7M with correct markings | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/pages/LandingPage.tsx` (FAQ "Czy obsługujecie KSeF?") |
| Every outgoing message checked and approved by a human; unusual matters go to an accountant | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/components/BentoGrid.tsx` |
| Declarations filed by the office under UPL-1 / ZUS-PEL powers of attorney, or by the client from a ready file | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/pages/LandingPage.tsx` (FAQ "Kto składa deklaracje?") |
| Separate space per company, data stored in the EU, encrypted connections | `/home/bogdan/Desktop/ikrystyna-marketing-site/src/pages/LandingPage.tsx` (FAQ "Czy moje dane są bezpieczne?") |
| "More than twenty companies registered" | Stated by the owner (AutoOffice) for this dossier; not derived from a file in the repository. |

**Pipeline stages** (system map, generated 2026-08-14)

| Claim | Source |
|---|---|
| Registry stamp before processing; attachment guard; only PDF/image to the pending folder; uncertain mail to a person | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, process `faktura-ingest` |
| Classification and extraction, tax-ID/VAT validation and duplicate detection, then **deterministic** posting (dictionary + rules; AI classifier flag OFF) into journal and VAT entries | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, process `faktura-ingest` |
| Monthly close per company; bank anchor (account 130 = statement to the cent, zero plug entries); `run_monthly_close_checks` plus a ledger = JPK = KSeF gate; deterministic JPK_V7M XML generation; signed and filed by a person; confirmation of receipt parsed back into the books | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, process `zamkniecie-jpk` |
| Invoice issuance = prepare → confirm → issue, with a preflight quality gate (tax ID, rates, totals), FA(3) XML, per-company KSeF token, KSeF reference number and confirmation; inbox import of purchase invoices | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, process `ksef-wystawienie` |
| Connect: OAuth with dynamic client registration, per-tenant JWT, company ID never from arguments, no writes — only an audited request to the office | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, process `connect-read` |
| Payroll for all contract types, contributions, KEDU XML for the ZUS Płatnik application, accrual posting | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `payroll` |
| Declarations: JPK_V7M(3) with control totals, CIT-8, PIT-4/11, IFT-2R; XML written to a filing directory | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, nodes `deklaracje`, `eus` |
| Bank statement import and matching to invoices and liabilities | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `bank-recon` |
| Contractor verification against the VAT white list, KRS, REGON/GUS; NBP exchange rates | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `rejestry` |
| PostgreSQL `polish_accounting`: 104 tables, row-level security for multi-tenancy | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `postgres` |

**iKrystyna Connect**

| Claim | Source |
|---|---|
| 45 registered tools (41 read + 4 request-rail) | `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/tools/read.ts`; `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/tools/requests.ts`; registration at `src/index.ts:124-125` |
| `prepare_sales_invoice` + `issue_sales_invoice` as an atomic pair, preview → explicit confirmation → issue | `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/index.ts:105`; `src/tools/read.ts:3197,3312` |
| Interactive widgets (list, KPI, analytics, close status, invoice inbox) | `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/index.ts:119-123`; `src/widgets/statusKsiegowy.ts`; `src/widgets/invoiceInbox.ts` |
| Tenant from JWT, never from arguments; fail closed without a company-scoped token; cross-tenant document read rejected | `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/core/tenant.ts`; `src/tools/requests.ts:121`; `src/core/proxy.ts:38`; `src/index.ts:214` |
| OAuth authorization server with RFC 7591 dynamic client registration, single-use 5-minute codes, refresh-token rotation | `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/auth/oauth.ts`; `src/auth/refreshTokens.ts`; `src/auth/middleware.ts` |
| Public MCP endpoint `https://connect.ikrystyna.pl/mcp` | `/home/bogdan/Desktop/iKrystyna/src/api/endpoints/panel.py:965`; `/home/bogdan/Desktop/iKrystyna/deploy/vps/Caddyfile:150` |

**Engineering**

| Claim | Source |
|---|---|
| Row-level security policies over the company-scoped tables; every query inside an RLS context | `/home/bogdan/Desktop/iKrystyna/src/database/migrations/003_row_level_security.sql:12-13`; `/home/bogdan/Desktop/iKrystyna/src/database/rls_context.py`; `/home/bogdan/Desktop/iKrystyna/src/mcp/middleware/auth.py` |
| Immutable audit log with SHA-256 hash chain for tamper detection | `/home/bogdan/Desktop/iKrystyna/src/services/audit_log_service.py:1` |
| Every MCP tool call logged with user, company, tool, arguments, rows returned, IP, execution time | `/home/bogdan/Desktop/iKrystyna/src/mcp/middleware/audit_logger.py` |
| 238 test files under `tests/`; pytest with a `security` marker for tenant isolation, auth and RLS | `/home/bogdan/Desktop/iKrystyna/pytest.ini`; `/home/bogdan/Desktop/iKrystyna/tests/security/test_tenant_isolation.py` |
| 12 GitHub Actions workflows: CI, CD, E2E full suite, E2E integration, nightly, release, compliance audit, weekly compliance, dependency security, dependency update, cache safety scan | `/home/bogdan/Desktop/iKrystyna/.github/workflows/` |
| Deployment: VPS in Warsaw, Caddy with automatic TLS, ~40 systemd units; Connect unit with `Restart=always` and `MemoryMax=1G`; secrets in `/etc/ikrystyna/*.env` at mode 0600 | `/home/bogdan/Desktop/iKrystyna/deploy/vps/Caddyfile:1,150-160`; `/home/bogdan/Desktop/iKrystyna/deploy/vps/systemd/ikrystyna-connect.service`; `/home/bogdan/Desktop/iKrystyna/deploy/vps/SECRETS_INVENTORY.md:42` |
| Monitoring stack (Prometheus, Grafana, Alertmanager, Loki, Promtail, blackbox, postgres-exporter) scraping the main API, MCP server, e-mail service and PostgreSQL | `/home/bogdan/Desktop/iKrystyna/monitoring/prometheus/prometheus.yml`; `/home/bogdan/Desktop/iKrystyna/monitoring/` |
| Health endpoints `/health`, `/health/ready`, `/health/detailed` | `/home/bogdan/Desktop/iKrystyna/src/main.py:423-425` |
| Scheduled watchdogs: deadline watch, register-anchor verifier, month-end deadman, overdue alerts, twice-daily digests | `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `watchdogi` |
| Nightly off-site backup to object storage; GDPR purge job; audit-controller timers | `/home/bogdan/Desktop/iKrystyna/deploy/vps/systemd/krystyna-backup-r2.timer`, `krystyna-audit-controller.timer`; `/home/bogdan/Desktop/iKrystyna/docs/map/model.json`, node `hausekeeping` |
| Client panel served at `ikrystyna.pl/panel/` | `/home/bogdan/Desktop/iKrystyna/deploy/vps/Caddyfile` (`handle_path /panel/*`); `/home/bogdan/Desktop/iKrystyna/panel/` |

**Deliberately not claimed.** The connector itself has no unit-test framework — only four hand-written end-to-end
scripts (`/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/e2e/`) and a tool-discoverability gate
(`ikrystyna-connect/scripts/bm25_gate.py`); port 3002 is not a Prometheus scrape target, and its liveness check is a
401 from the root path (`/home/bogdan/Desktop/iKrystyna/deploy/vps/deploy.sh:472-480`). Bank auto-matching is noted in
the system map as having an open duplication defect, so the copy says statements are "imported and matched" and does
not claim unattended reconciliation. `app.ikrystyna.pl` appears only as a default string in onboarding e-mail
templates and is not a deployed surface — the panel address above is the correct one.
