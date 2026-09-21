# TechCode demo screenshots — what exists, what does not, and why

Investigation was read-only: no database connection, no seed/refresh/migration run, no login to any hosted
surface, no `.env` or secret file read.

## 1. Where the TechCode demo tenant lives

TechCode is **not a fixture file**. It is a row in the live production PostgreSQL database `polish_accounting`:

- `company_id = 25`, NIP `5260250995`, company name carries a `[DEMO]` marker, `ksef_enabled = false`
- the same database also holds the real client companies — there is **no separate demo database**
- host, per `/home/bogdan/Desktop/iKrystyna/docs/active/PLAN_CHMURA_TRWALOSC.md`: the production VPS in Warsaw
  (OVH), PostgreSQL 18, database size ~173 MB

What defines it are Python writer scripts in `/home/bogdan/Desktop/iKrystyna/scripts/`:

| Script | Role |
|---|---|
| `reseed_techcode_coherent_2025_2026.py` | the master model — a per-month target table (headcount, sales, gross payroll, opex) for Jan 2025 → Jul 2026; wipes and rebuilds company 25 |
| `rebuild_techcode_phase1..5.py`, `rebuild_techcode_pdfs.py` | original build: company row, chart of accounts, counterparties, cars, contracts, settlements, invoice PDFs |
| `extend_techcode_current_month.py` | additive single-month append (has model entries pre-wired for 2026-08 and 2026-09) |
| `trim_techcode_june_2026_in_progress.py` | dials the current month back to "in progress" at a cutoff date |
| `close_techcode_payroll_month.py`, `settle_techcode_receivables.py` | close a payroll month; roll receivables aging forward |

Read-only artifacts of the dataset also sit on disk at `/home/bogdan/Desktop/iKrystyna/clients/5260250995/` —
`company_card.md`, `monthly/<YYMM>/closing_report.json` for each month, `annual/2025/`, car and ZUS documents.
**These on-disk closing reports are the source of the figures in the screenshots below.**

## 2. How current the data is

- Last **closed** month on disk: `monthly/2607/closing_report.json`, period `2026-07`, closed `2026-08-05`.
  There is no `2608` directory.
- The master model's month table ends at 2026-07.
- A commit dated 2026-08-18 records that August 2026 was written into the database up to the 18th
  (6 sales invoices, 12 purchases, 20 journal entries).
- The demo access note `docs/active/DEMO_DOSTEP_TECHCODE.md` still says "data refreshed 2026-07-22" — it was
  never updated after the August run.

**Against today (2026-09-21): the demo tenant is roughly one month behind, with no September rows at all.**
A prospect opening the demo panel today would see a company that appears to have stopped trading in August.
That is exactly what the owner means by "after updating".

## 3. What "updating" means

The lower-blast-radius path, documented only in the script docstrings (not in any runbook):

```
cd /home/bogdan/Desktop/iKrystyna
python3 scripts/extend_techcode_current_month.py --dry-run
python3 scripts/extend_techcode_current_month.py            # --wipe to redo the month
python3 scripts/settle_techcode_receivables.py --dry-run
python3 scripts/settle_techcode_receivables.py
python3 scripts/close_techcode_payroll_month.py --dry-run
python3 scripts/close_techcode_payroll_month.py
```

For September 2026 the extend script already carries a model entry, so
`--year 2026 --month 9 --cutoff 2026-09-20` works as-is. Two caveats: `close_techcode_payroll_month.py`
refuses any month absent from the master target table, which stops at 2026-07, so closing August or September
payroll needs that table edited first; and October 2026 has no model entry at all.

The older documented two-step in `docs/active/DEMO_DOSTEP_TECHCODE.md` (full reseed + trim) still works but
wipes and renumbers every transactional row of company 25.

`docs/TEST_DATA_GENERATION.md` is a different, obsolete system (Faker anonymisation) and does not touch
company 25. There is no Makefile target and no npm script for TechCode.

### Risk

**Every one of these scripts writes to the production database.** They resolve their connection from
`TECHCODE_DATABASE_URL`, or by parsing `DATABASE_URL` out of a `.env` file, and there is no `--dsn` flag, no
staging profile and no local containerised database in any of these paths. Protection is in-script only:
NIP + `[DEMO]` name + `ksef_enabled = false` gating, a per-company row-count snapshot inside the same
transaction, a rollback if any other `company_id` moves, and double-entry / VAT / invoice-linkage verification
before commit. **This is the owner's call to run, not an automated step** — and it should be run from the
production host with a fresh backup in hand.

## 4. Screenshots that were produced

Two were produced, entirely locally and without credentials, and both carry only TechCode `[DEMO]` figures.

| File | Content | Size |
|---|---|---|
| `ikrystyna-demo-monthly-summary.png` | "Podsumowanie finansowe" — the KPI card returned by `get_monthly_financial_summary`, TechCode July 2026 | 3300 × 600 px |
| `ikrystyna-demo-vat-report.png` | "Raport VAT" — the KPI card returned by `get_vat_summary_report`, plus a six-month table of closed periods | 3300 × 1260 px |

**How they were made (reproducible, read-only).** The shared widget package
`/home/bogdan/Desktop/AI/src/Zgredek/mcp-widgets` exports `KPI_WIDGET_HTML(baseUrl, config)`, a pure function
with no database or network dependency. It was called with the connector's own iKrystyna theme configuration
(copied verbatim from `/home/bogdan/Desktop/iKrystyna/ikrystyna-connect/src/index.ts`, the "spokojny dokument"
palette and the self-hosted Hanken Grotesk / Spectral faces from
`ikrystyna-connect/assets/fonts/`). The widget loads its data through `window.__SDK_URL__`; that module was
replaced with the same kind of offline stub the connector already ships in
`ikrystyna-connect/widget-mockups/widget-sdk/app.js`, firing one tool result whose payload was built from
`clients/5260250995/monthly/26{02..07}/closing_report.json`. The pages were served by a throwaway static
server on a scratch port and captured with Playwright at `deviceScaleFactor: 3`; the server was stopped
afterwards. So: real shipped widget code, real brand typography, real demo-tenant figures, nothing invented.

Every figure shown traces to a file:

| Shown | Value | Source key |
|---|---|---|
| Przychód netto (July 2026) | 324 475,86 | `revenue_net` in `monthly/2607/closing_report.json` |
| Koszty | 271 703,86 | `costs_class4_net` |
| Wynik netto | 52 772,00 | `profit_before_tax` |
| VAT należny / naliczony / do zapłaty | 67 090,35 / 11 295,30 / 55 795,05 | `output_vat` / `input_vat` / `vat_payable` |
| Six-month table | Feb–Jul 2026 | `monthly/2602..2607/closing_report.json` |
| "miesiąc zamknięty 05.08.2026" | — | `closed_at` |

The widgets render in Polish because that is the product: a German reader sees the real interface an iKrystyna
client sees, not a translated mock-up. Add an English caption in the dossier layout rather than editing the
screenshot.

## 5. Screenshots that were NOT produced, and what they need

**Pending invoices / KSeF inbox list** (`get_pending_invoices`, `list_ksef_inbox`) and **monthly close status**
(`get_monthly_close_status`, the bespoke "Status księgowy" checklist widget).

Blocker: these are per-document and per-check views, and there is **no on-disk TechCode data for them**. The
`clients/5260250995/` tree holds month-level closing summaries only — no invoice list, no KSeF inbox, no
checklist state. Those live exclusively in the production database. Filling the widgets would mean inventing
invoice numbers, counterparty names and check results, which this dossier does not do.

To get them honestly, one of the following is needed — all are the owner's calls:

1. **Preferred — export, then render offline.** From the production host, run a read-only query for company 25
   (pending invoices, KSeF inbox rows, and the output of `run_monthly_close_checks`), save it as JSON, and
   hand that file over. The render harness described in section 4 then produces both screenshots in minutes
   with no further access. The connector's bespoke widget HTML is already available offline at
   `ikrystyna-connect/src/widgets/invoiceInbox.ts` and `src/widgets/statusKsiegowy.ts`.
2. **Or — capture from the live connector.** The demo tenant has published read-only credentials
   (`docs/active/DEMO_DOSTEP_TECHCODE.md`) for `https://connect.ikrystyna.pl/mcp`; connecting from a Claude or
   ChatGPT account and screenshotting the returned widgets gives the most authentic result, including the
   assistant's surrounding chat. This requires the owner to drive it — it is a login, not a local render.
3. **Either way, refresh the tenant first** (section 3), or a close-status card will show August as the last
   month and a pending-invoices list will be empty.

## 6. Also worth the owner's attention

- `docs/active/DEMO_DOSTEP_TECHCODE.md` contains a live, read-only demo password committed to git, and
  `e2e-tests/fixtures/expected-company-data.json` contains stale plaintext test credentials for five companies.
  Neither is a dossier problem, but both are in version control.
- That same document still points at the retired `ikrystyna-connect.ngrok.app` address; the live endpoint is
  `https://connect.ikrystyna.pl/mcp`.
