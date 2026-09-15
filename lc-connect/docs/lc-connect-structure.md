# LC Connect — how it is built and where it is going

*Prepared for Laser Components, September 2026. Current state as of 2026-09-16, plus the work landing in the following days.*

## 1. What it is

LC Connect is a connector that plugs your lead intelligence base into the AI assistants your team already uses (Claude and ChatGPT). People ask questions in plain language; the assistant answers from your own data — leads, products, applications, notes, market knowledge — and shows results as interactive cards (tables, charts, maps) instead of walls of text. New leads and notes can be added from the same conversation. Closing business stays in your existing tools; LC Connect is for finding, enriching and organising leads.

## 2. How it works

```
Claude / ChatGPT  ──HTTPS──▶  LC Connect server  ──▶  Laser Components lead database (PostgreSQL)
      ▲                              │
      └── sign-in (OAuth 2.1) ───────┘
```

- **One account per person.** Each user signs in once with their own email and password; the assistant then acts as that person. Nothing is shared between users' sessions.
- **Standards-based.** The connector implements the Model Context Protocol (the open standard both Claude and ChatGPT use for connectors) and OAuth 2.1 with PKCE for sign-in — the same mechanisms used by other enterprise connectors.
- **Rich results.** 45 tools cover leads, products, applications, regions, analytics, market intelligence, knowledge base and reporting. Larger result sets come with a downloadable CSV.

## 3. Users, roles and regions

| Role | Can do |
|---|---|
| **ADMIN** | Everything, including managing users, deleting records and bulk updates, and reading the audit log |
| **RESEARCHER** | Everything a salesperson can, plus maintaining the product catalogue and the knowledge base, and reading the audit log |
| **SALES** | Read everything; create leads and notes; edit leads they own, created, or that fall within their region competency |

- **Ownership.** Every lead has an owner. Leads you create are yours; an admin (or the current owner) can reassign them.
- **Region competency.** A user can be limited to one or more regions (for example Europe, or Middle East). A user with no region set has global competency. Competency governs *editing* unowned leads — reading is open to the whole team, by design: this is an internal tool for one company.
- **Managing users** is done in chat by an admin (`manage_users`: create, change role, set regions, deactivate). Deactivated accounts cannot sign in and their existing sessions stop working within a minute.
- **Regions today:** North America, Europe, Asia, South America, Middle East, Oceania. Your own team structure (e.g. France / Western Europe / Africa & emerging markets / Asia) can be mapped onto this — see section 6.

## 4. Security and operations

| Area | In place |
|---|---|
| Sign-in | OAuth 2.1 with PKCE, per-user accounts, bcrypt-hashed passwords, session tokens valid 4 hours with silent refresh, rate limiting on the login endpoints |
| Authorisation | Role and ownership rules enforced on every write; destructive actions restricted to ADMIN |
| Audit trail | Every create, update, delete, assignment, bulk operation and user-management action is recorded with who, when, and before/after values — including refused attempts. Admins and researchers can query it in chat (`get_audit_log`) |
| Transport | HTTPS end to end; no data is exposed without a valid session |
| Backups | Nightly database backup, kept 30 days, stored on-site and off-site |
| Monitoring | An automated check signs in through the public address every 5 minutes, exercising the full login and query path; on failure it restarts the affected component and alerts the operator. Structured logs are kept for diagnosis |
| Hosting | Dedicated server with backup power; operated by AutoOffice |
| External AI | Market-intelligence tools call an external research model (Perplexity) with the lead's public company name and website only; no notes or internal data leave the system |

## 5. Your data today

| | count |
|---|---|
| Leads | 396 |
| Products | 245 |
| Applications | 7 |
| Leads with country and region assigned | 150 |
| Leads still without geography | 246 (218 on generic web domains, 28 without a website) |

Geography drives region competency, so completing it matters. The remaining 246 leads were researched country by country and sit in contiguous blocks, so they can be confirmed in bulk (one confirmation per country) rather than one by one.

## 6. What we need from you

1. **Sign-in with your company accounts.** We can connect LC Connect to your identity provider (Microsoft Entra ID, Google Workspace, Okta) so your team signs in with their existing corporate login, with your MFA and automatic offboarding. Tell us which one you use.
2. **Your region structure.** Which teams exist and which countries each covers (e.g. France; Western Europe; Africa & emerging markets; Asia). We map it onto the region table.
3. **Initial user list.** Names, emails and roles for the first users.
4. **Geography confirmation** for the 246 leads without a country — a country per block is enough.
5. One placement decision: Turkey is currently under Middle East (emerging markets). Say if you prefer Europe.

## 7. Landing in the next days

- Structured logging with per-user tracing for faster support (in progress)
- Dark-mode and mobile-ready result cards (done, rolling out with the next restart)
- Sign-in through your identity provider — as soon as item 1 above is answered
- Region taxonomy and user onboarding — as soon as items 2 and 3 are answered
