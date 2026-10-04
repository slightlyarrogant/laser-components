# Consistency review: 5.10 briefing deck against the material Laser Components already has

Reviewed on 2026-10-04 (read-only). The deck (`briefing.src.html`, `harness-diagram.svg`, `speaker-notes.md`) was compared with:

- **Structure brief / Blueprint**: `lc-connect/docs/lc-connect-structure.md` and `lc-connect-blueprint.html`. The PDF went to Alice on 15.09.
- **Service package (SP)**: `lc-connect/docs/lc-connect-service-package.html`, version 2026-09-16. It also went to Alice on 15.09.
- **Bogdan's 15.09 cover mail** to Alice, "LC Connect: architecture, deployment and draft service agreement" (Gmail, sent).
- **Alice's 29.09 mail**: `comparison-kit/raw/lukasz-mail/alice-mail-2026-09-29-from-screenshots.md`.
- **Sales comparison**: `comparison-kit/LC-Connect-Comparison-Sales.html`. **Łukasz forwarded it on 29.09 to nine colleagues, Alice and Alexander Faulstroh among them** ("LC Connect – first examples and AI concept"). Alex has read it, or can.
- **Technical comparison**: `comparison-kit/LC-Connect-Comparison.md`.
- **AutoOffice dossier**: `autooffice-dossier/dossier.html`.
- **Internal reference** for the ground truth: the 3.10 meeting notes (`meetings/2026-10-03-piastowska-lukasz-notatka.md`), the watchdog code, `src/tools/ai.ts` and the live database.

**Not found:** Bogdan's reply to Alice's 29.09 mail and the e-mail that sent the dossier. Neither is in the repo, and neither is in the slightlyarrogant Gmail; they were probably sent from the cfi.pl mailbox. So I could not check the positions Bogdan took there (SSO left to the customer, data before NDA, provider contact). **Bogdan needs to compare items D1–D3 below against those two mails himself.**

---

## 1. Discrepancies

Severity levels:
- **contradiction**: the deck says something an earlier document, or the facts, say differently.
- **drift**: the same thing under a new name or framing.
- **missing**: earlier material had it and the deck drops it.

| # | Slide | Deck wording | Earlier wording (file) | Severity | Suggested fix (one line) |
|---|---|---|---|---|---|
| A1 | 3 (headline + diagram) | "Your data stays with you." / zone "YOUR DATA STAYS HERE · A: your Azure · B: AutoOffice EU server" | SP: "Option A keeps the data inside your tenant… option B… EU data centre (OVH or Hetzner), AutoOffice account; AutoOffice is processor for hosting" | contradiction (true only for option A) | Headline: "Your data stays in one place you choose. The engine is rented." |
| A2 | 3 (diagram), notes 3 | AI engine "sees only the conversation" / "conversation only" | SP flow table: Assistant ↔ connector carries "The user's request, **and the data needed to answer it (leads, products, notes, analytics)**" | contradiction (by implication: Alex will read it as "no lead data reaches OpenAI/Anthropic") | Arrow label: "conversation, incl. the lead rows returned to answer it · under your business contract" |
| A3 | 2, 3 | "The engine… **Rented** as it is"; legend "rented service, replaceable" next to "built and run for you"; notes: "if a better model appears, **we switch it**" | SP: "AI assistant subscription: Laser Components, directly with the AI provider… **Not part of AutoOffice fees and not resold: you bring your own assistant**"; dossier: "AutoOffice… **resells no AI capacity**" | contradiction (it reads as if AutoOffice rents the model) | "Rented **by you**, under your business plan"; notes: "you can switch it; the harness does not change" |
| A4 | 3 (diagram), 9 | Sign-in = "MCP connector · personal sign-in · OAuth 2.1 · role"; slide 9: "One account per person… Passwords stored hashed (bcrypt)" | SP context diagram has an **Identity provider box: "Microsoft Entra ID (proposed) · your tenant"**; SP Security: "Sign-in via the customer's identity provider"; dossier: "Through the customer's own identity provider. **No separate password estate.**" | contradiction (the deck shows the pilot's local passwords as the design) | Add an IdP box on the sign-in arrow ("your Entra ID, later"); slide 9: "Today: personal accounts. Target: your Entra ID with your MFA" |
| A5 | 3 (diagram) | No operator box | SP context: "AutoOffice · monitoring · updates · support"; deployment: staging/dev and monitoring "stay with AutoOffice in both cases"; "Source repository: your GitHub or Azure DevOps" | missing | Add a small box "AutoOffice: operates, monitors, deploys from your repository" |
| A6 | 3, 2, 6 | Team box "Claude or ChatGPT business workspace"; engine "OpenAI, Anthropic"; slide 6: "Not a replacement for Copilot for emails" | SP: assistant "Claude · ChatGPT · **Copilot**"; platforms "Anthropic · OpenAI · **Microsoft**"; licences row: "or Microsoft 365 Copilot"; dossier also lists Copilot | drift (Copilot silently disappears; LC's strategy is "Copilot for everyone", per the 3.10 notes) | Notes or small print: "Copilot: same open protocol; to be validated in the pilot". Do not promise more |
| A7 | 2, 3, 6 | "harness" as the name of the thing; slide 6: "It is a **research and knowledge harness** for leads" | No earlier customer document uses "harness" (0 hits in brief, SP, dossier, Sales, technical comparison). They say "connector" (SP 17×, dossier 16×), "LC Connect server", "add-on" (Łukasz) | drift | Bridge once: "the connector you saw in the service package is the harness". Slide 6: "a lead-research connector: the harness around your AI assistant" |
| A8 | 3 (diagram) | "Research engine **(optional)** · Perplexity · public web only" | SP: "Market research API · Perplexity · multi-source web research", "usage included in fee", named sub-processor in the DPA | drift (renamed; "optional" is new) | Keep the SP name "Market research (Perplexity)"; drop "optional" or say "can be switched off" |
| A9 | 3, 9 | Perplexity receives "company name + website only" / "a public company name and website only" | Same claim in brief, Blueprint and SP. **Code disagrees:** `generate_lead_score` sends lead status, product of interest, revenue and employees; `generate_insights` sends top products by lead interest and lead counts; `analyze_product_market` sends LC product data (`src/tools/ai.ts` ~L314, 630–685, 780) | contradiction with the facts (shared by all documents, not new in the deck) | "Perplexity receives company names, websites and product/market questions; never notes, contacts or users." Fix the code or the wording before Alex asks |
| A10 | 4 | "OpenAI and Anthropic: no training on your data, **zero data retention by contract**. OpenAI offers EU-hosted models." | Not in any earlier document. SP: "The assistant platforms are the customer's own processors under the customer's subscriptions." The deck's own notes: "zero data retention and EU hosting are **contract options** (check the current terms…)" | contradiction (slide vs notes; ZDR is not a default term of Team/Enterprise plans) | Slide: "No training on your data by default. Retention and EU data residency are set in your contract." |
| A11 | 4 vs 5 | "Our rule: the connector runs only in company business accounts, **never in private subscriptions**" | Sales PDF (which Alex has), Assistants table: ChatGPT "**Free plan**, Thinking mode"; 3.10 notes: Łukasz's connector "jest na jego prywatnym koncie" | contradiction (the slide 5 evidence comes from private accounts, and Alex can see that) | Small print on 4: "Pilot tests ran on personal accounts with public data only; from the formal pilot on, business workspaces only." This motivates ask 3 |
| A12 | 5 | "With LC Connect · Poland **16 of 16** · Czech Republic **14 of 14**" (no assistant named on the slide) | Sales: Poland 16/16 = **Claude**; ChatGPT named 16 = "12 PLD prospects and 4 LiDAR prospects". Czech 14/14 = **ChatGPT**; Claude returned "24 Czech leads… (15… pulsed laser diodes, 9… LiDAR)" | drift (best-of per country without attribution; the notes say it, the slide does not) | Add "(Claude)" / "(ChatGPT)" under each figure |
| A13 | 5 | "Without… 4–8 of 6–12 names" (PL), "0–4 of 5–11" (CZ) | Sales matches (Claude 12→8, ChatGPT 6→4; CZ "4 of Claude's 11 and none of ChatGPT's 5"). The technical MD says Claude CZ "named **10**" | OK in the deck; a minor 10/11 inconsistency inside the earlier kit | None in the deck; keep 11 (the Sales figure Alice has) |
| A14 | 5 | "Trade-fair preparation: In Łukasz's own use, about **65 %** of suggested contacts confirmed." | No written customer document has 65 %. Łukasz's 29.09 mail: "A large proportion of the companies I visited turned out to be very interesting". The source is oral (3.10 notes: "65 % trafności", i.e. 65 % accuracy) and measured on companies/stands, not contacts | drift (unsourced in writing; "contacts" vs "companies") | "about 65 % of suggested companies were worth the visit (Łukasz)", and let Łukasz say it himself |
| A15 | 2 | "Learns every working day"; "A memory of corrections that grows with daily use" | No earlier document mentions a memory of corrections. Live DB: `learning_events` = **1 row**; tools `save_learning`/`get_pending_learnings` exist | drift / over-claim relative to the current state | "Designed to learn from every correction" (the mechanism exists; usage does not yet) |
| A16 | 4 | "The pilot today holds public data only… No company data has been uploaded." | Matches the 3.10 notes and the DB: 5 notes (dated 2025/2026-06), no user writes since 16.09. But the 6 knowledge resources ("Sales Objection Responses", "Lead Scoring Guide", …, 2026-05-21) are unverified | OK (verify) | Check that those 6 resources contain nothing internal to LC; then keep the sentence verbatim |
| A17 | 9 | "Watchdog: Full sign-in check every 5 minutes." | Brief/Blueprint/SP: "signs in **through the public address** every 5 minutes"; dossier: "every five minutes a monitor signs in". Reality (`deploy/watchdog.sh`): full sign-in **locally** every 5 min, public `/health` probe every **30 min** (ngrok quota) | OK in the deck; the earlier documents are stale | Leave the slide; notes: "local full check 5 min, external probe 30 min in the pilot; 5-min external check in production" |
| A18 | 3, 9 | Only target hosting A/B is shown | Brief: "Hosting: Dedicated server with backup power; operated by AutoOffice". Pilot reality: Sinktank + ngrok tunnel | missing (Alex's first question will be "where does it run now?") | One line in the notes for slide 3: the current pilot location and that it moves to A or B on the formal step |
| A19 | 9 | Sign-in 4 h + silent refresh; ADMIN/RESEARCHER/SALES; audit incl. refused; backups nightly, 30 days, on- and off-site; AVV annex; EU storage; exit 30 days | Identical in brief / SP (SP adds "encrypted" backup and lists sub-processors) | consistent | Optional: "nightly **encrypted** backup" to match SP |
| A20 | 9 | "Exit: Full source in your repository." | SP: the source sits in the customer's repository *under the agreement*; today it does not | drift (tense) | "Exit (in the agreement): …", or rely on the notes' "in place today **or written into the service terms**" |
| A21 | 8 | Five asks (green light, hosting, workspace accounts, IT contact, Munich) | See section 4: drops IdP, region structure, user list, data-before-NDA | missing | See section 4 |
| A22 | 7 | "Know-how out of heads", "Connecting the dots", "Module fit before design" have **no** later-phase tag; only "Visit effectiveness" is tagged | SP scope: connector + 15 dev h/month; the brief scopes it to "finding, enriching and organising leads". These three need non-public company data, which conflicts with slide 4 "public data only" and Alice's NDA question | drift / over-promise | Eyebrow: "Ideas from daily use, not in the current scope"; tag everything that needs internal data "needs your data decision" |
| A23 | 7 vs 5 | "Trade-fair planning: Who to meet, prepared before the fair." listed as future | Slide 5 already claims it is done (65 %) | drift (internal) | Drop it from slide 7, or rename it "trade-fair planning for the whole team" |

---

## 2. Terminology map

| Concept | Earlier material | Deck | Note |
|---|---|---|---|
| The product | "connector" / "LC Connect server" (brief, SP, dossier); "add-on" (Łukasz to colleagues) | "harness", "MCP connector", "LC Connect server" | "harness" is new. It fits Alice's training misconception, but bridge it to "connector" once |
| The AI | "AI assistant · Claude · ChatGPT · Copilot", "your subscription", "bring your own intelligence" | "AI engine (OpenAI, Anthropic), rented, replaceable" + "business workspace" | The deck splits the assistant into workspace + engine. That is good pedagogy, but "rented" must say "by you" |
| Research | "Market research API · Perplexity" / "external research model" | "Research engine (optional)" | Rename back to SP wording |
| Identity | "Identity provider · Entra ID (proposed)", SSO via IdP | "personal sign-in · OAuth 2.1 · role" | The IdP is gone from the deck |
| Roles | ADMIN / RESEARCHER / SALES (SP diagram: "sales · research · admin") | Same | Consistent |
| Hosting | "Production option A · your Azure tenant" / "option B · AutoOffice-managed server, EU (OVH/Hetzner)" | "A: your Azure · B: AutoOffice EU server" | Consistent |
| Data store | "Lead database · PostgreSQL" | "Database: leads · products · knowledge base · memory of corrections" | "memory of corrections" is new |

**Does the "engine rented / harness built" framing conflict with the structure brief?** Not architecturally. The brief's diagram (`Claude/ChatGPT → LC Connect server → lead DB`, OAuth loop) is the same chain, and the harness diagram is a faithful superset. The conflict is commercial (A3): the brief and SP put the assistant on Laser Components' own subscription, and the deck's "rented… built and run for you" legend blurs who rents it.

---

## 3. Diagram inventory

**Structure brief / Blueprint diagram**
- Boxes: Claude/ChatGPT, LC Connect server, Laser Components lead database (PostgreSQL).
- Arrows: HTTPS; sign-in (OAuth 2.1) loop back to the assistant.

**SP context diagram**
- Boxes: Identity provider (Entra ID proposed, your tenant); Laser Components team (sales · research · admin); AI assistant (Claude · ChatGPT · Copilot); LC Connect (connector · roles · audit trail); Lead database (PostgreSQL); AutoOffice (monitoring, updates · support); Market research API (Perplexity · multi-source web research).
- Arrows: team → assistant "questions"; assistant → connector "HTTPS"; connector → IdP "sign-in, per user"; connector → Perplexity "company name + website only"; AutoOffice → connector (operations).

**SP deployment diagram, three lanes**
- Laser Components lane: users' devices; IdP (Entra ID, existing); Production A (your Azure tenant: container 1 vCPU/1 GB Container Apps, managed PostgreSQL 15+, "data never leaves your tenant", "operator has deploy access only").
- AutoOffice lane: staging and development; monitoring "full sign-in check every 5 min · alerts"; Production B (AutoOffice-managed EU server, Docker, PostgreSQL, off-site backup, "data processing agreement applies").
- Third parties lane: AI assistant platforms (Anthropic · OpenAI · Microsoft, "your subscriptions, paid directly"); Perplexity ("usage included in fee"); hosting provider (Azure or OVH/Hetzner); source repository (your GitHub or Azure DevOps); domain and certificate (connect.lasercomponents.com).

**Dossier Figure 1**
- Boxes: Your AI assistant (Claude · ChatGPT · Microsoft Copilot, "YOUR SUBSCRIPTION") → Connector (sign-in, roles, audit trail, result cards, "BUILT BY AUTOOFFICE") → Your system of record ("YOUR DATA, YOUR SERVER").

**Harness diagram**
- Boxes: Your team (Claude or ChatGPT business workspace); AI engine, rented (OpenAI, Anthropic: "replaceable", "conversation only", "business contract"); MCP connector ("personal sign-in · OAuth 2.1 · role"); LC Connect server (tools, access rules per person, audit log); Database (leads · products, knowledge base, memory of corrections, PostgreSQL); zone "YOUR DATA STAYS HERE · A: your Azure · B: AutoOffice EU server"; Research engine (optional, Perplexity, "company name + website only").
- Legend: "built and run for you" / "rented service, replaceable".

**Compared with the earlier diagrams, the harness diagram:**
- **Lacks:** the Identity provider (A4), the AutoOffice operator/monitoring and staging (A5), the source repository, Microsoft/Copilot (A6), the domain.
- **Renames:** AI assistant → workspace + engine; Market research API → Research engine (optional); Lead database → Database.
- **Adds:** "memory of corrections", the engine/harness split, the "your data stays here" zone.
- **Data location** is consistent with SP (A/B), apart from the "stays with you" wording (A1). ngrok and Sinktank appear in no customer document and the deck does not mention them either (A18). That is acceptable, provided the speaker has an answer ready.
- **Auth:** OAuth 2.1 is consistent; the IdP is missing.
- **Perplexity:** the same claim everywhere, and the code does not fully match it (A9).
- **What the model vendor sees:** the deck understates it compared with the SP flow table (A2).

**Replace or align?** Align; do not replace. The SP context diagram has seven boxes and no engine/harness split, so it cannot carry slide 2's message ("no training, the model is a rented engine"), which is the main misunderstanding Alice has. For a non-technical audience, swapping it in costs that clarity. Aligning costs very little:
1. Rename the boxes to the SP vocabulary: connector, market research (Perplexity), lead database.
2. Add the IdP box on the sign-in arrow and a small AutoOffice operator box.
3. Fix the labels from A1–A3.

Then add the unchanged SP context diagram as a **backup slide 10 for Alex**, captioned "the same diagram as in the service package you received on 15 September". That shows continuity rather than a new story.

---

## 4. Asks and commitments

| Asked before | Where | In the deck (slide 8)? |
|---|---|---|
| Which identity provider for SSO (Entra ID / Google Workspace / Okta) | 15.09 mail ("which identity provider you use for single sign-on"), brief §6.1, SP (Entra app registration) | **Dropped.** Identity management is also on Alice's own agenda for the separate Alice/Alex technical session (29.09 mail) |
| Hosting option | 15.09 mail, SP | Kept (ask 2) ✔ |
| Regional team structure | 15.09 mail, brief §6.2 | **Dropped** |
| Initial user list (names, emails, roles) | 15.09 mail, brief §6.3 | Partly replaced by "Business workspace accounts for pilot users". That asks for something different (assistant licences, not LC Connect users) |
| Geography confirmation (246 leads), Turkey placement | brief §6.4–5 | Dropped. Fine for this audience |
| DNS name, repository (GitHub/Azure DevOps), staging acceptance | SP | Dropped. Fine at this stage |
| Named contact | SP responsibilities | Kept, as "named IT contact" (ask 4). Alex will probably be in the room, so ask "confirm Alex as our IT contact" |
| **Data before NDA/contract**: Alice's own point 1 (29.09) | Alice's mail | **Not addressed as a decision.** Slide 4's "public data only" is the answer. Say so explicitly, e.g. ask: "NDA + DPA signed before any company data goes in" |
| DPA (AVV) | SP, slide 9 | Only in the backup slide. Add it to the asks as part of the formal step |
| Green light for a "formal pilot" | new | The **"pilot" is not defined in anything Alice has.** SP proposes a 12-month service agreement (EUR 1,800/month + EUR 3,500 setup). The 3-step path (pilot → implementation 25–35 k → partnership) exists only internally (`docs/pricing/`). Have one sentence ready on what "formal pilot" means (duration, users, cost, or "terms follow in Munich") |
| Munich date, second week of November | new | Consistent with the 3.10 notes (Munich 10–11.11) |

**Possible conflicts with Bogdan's mails (D1–D3, could not be verified):**
- **D1 (SSO):** if Bogdan wrote that SSO is left to the customer, slide 9's "one account per person / bcrypt" is consistent with that, but the SP and dossier ("no separate password estate") are not. Pick one line and say it.
- **D2 (data before NDA):** the deck's position (public data only, nothing uploaded) must match what Bogdan answered to Alice's point 1.
- **D3 (provider contact):** the deck carries no contact. The dossier lists "bogdan.czarnecki@**cfi.pl**", which conflicts with "AutoOffice is the provider". If the reply mail went from cfi.pl, add an AutoOffice contact line to slide 1 or 8.

---

## 5. Tone and positioning

- **Slide 6 fits the earlier positioning.** "Not a CRM… research and knowledge harness for leads" matches the brief's "LC Connect is for finding, enriching and organising leads. Closing business stays in your existing tools."
- **Slide 7 is the risk.** The Sales PDF already says "Connecting the ERP and contact history is the next step", and Łukasz told nine colleagues the tool "can be expanded significantly and enriched with data from our internal systems". So the expectation exists. But slide 7 tags only one of five ideas "later phase", and three untagged ideas need internal data. That contradicts slide 4 ("public data only") and the open NDA question (A22). None of them is in the SP scope (15 dev h/month).
- **Recommendation:** label the whole slide "ideas from Łukasz's daily work, not in the current scope", and keep the existing footer line ("Access to ERP or CRM data is a later phase and needs your decision").
- **Slide 2's "Hundreds of thousands"** is not in any earlier document. It is Łukasz's argument and harmless.

---

## Verdict

**Keep the deck, with about 12 small edits; no rework.** The architecture it shows is the same chain as the Blueprint and a simplified version of the service-package context diagram. Hosting A/B, roles, the 4-hour session, the audit trail, backups, the AVV and the exit terms all match word for word. The 16/16, 14/14 and "without" ranges match the Sales PDF.

The problems are wording and omissions, but several are ones Alex can catch with documents he already holds:

**Must fix before 16:30:**
- "Your data stays with you" (A1)
- "conversation only" (A2)
- "rented" without "by you" (A3)
- the missing identity provider (A4)
- "zero data retention by contract" (A10)
- the private-account rule versus the Free-plan test he has in the Sales PDF (A11)

**Fix if time allows:**
- assistant attribution on slide 5 (A12)
- the 65 % wording (A14)
- "learns every day" (A15)
- slide 7 labelling (A22, A23)
- adding the IdP and the data-before-NDA decision back to slide 8 (section 4)

**Fix in the code or wording within days:** the Perplexity "name + website only" claim (A9). The deck repeats it from every earlier document, but the code sends more.

Align the harness diagram to the SP vocabulary (IdP box, operator box, SP names) rather than replacing it, and append the SP context diagram as a backup slide for Alex. That keeps the simple "engine vs harness" picture for Alice and shows Alex it is the same system he was shown on 15 September.
