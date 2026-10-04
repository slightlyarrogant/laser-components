# LC Connect briefing, 5 October 2026: speaker notes

Meeting with Laser Components (Alice, probably Alex), 16:30 CET, in English. Aim: 20 minutes of slides at most, then questions. Slides 9 and 10 are backups for security and architecture questions.

## 1. LC Connect: what it is and how it works
- Thank them for the time. Say up front: short, eight slides plus two backups (9 and 10) for security and architecture questions.
- Purpose today: make clear what LC Connect is, how it is built, and what we need to go formal.
- The provider is AutoOffice; we build and run it.

## 2. We do not train a model. We build a harness.
- Answer the hardware question directly: there is no training and no GPU purchase. The models from OpenAI and Anthropic are the engine, rented by you under your own business plan; AutoOffice does not resell them.
- Bridge to what they have read: the connector from the service package of 15 September is what we call the harness.
- The harness is everything around the engine: tools that know your products, your lead base and your rules, designed to learn from every correction.
- "Training" for us means daily use: when a user corrects an answer, the correction is stored and later answers use it. That knowledge stays with Laser Components.
- Training your own model costs hundreds of thousands and is frozen the day it is finished. The engine is your choice: you can switch it; the harness does not change.

## 3. Diagram: how it fits together
- Walk left to right: your team works in its Claude or ChatGPT business workspace; the connector signs each person in individually, with a role. Today: personal accounts; target: your identity provider (e.g. Entra ID) with your MFA.
- The LC Connect server decides what each person may do and logs every change; the database holds leads, products, knowledge and the memory of corrections. AutoOffice operates and monitors it and deploys from your repository.
- The orange area is where the data lives: one place you choose, your Azure (option A) or an AutoOffice-managed server in the EU (option B).
- Be precise about the engine: it receives the conversation, including the lead rows needed to answer, under your business contract. Market research (Perplexity) receives company names, websites and product/market questions; never notes, contacts or users. It can be switched off.
- Where it runs today: AutoOffice's own server behind a secured tunnel for the pilot; it moves to option A or B at the formal step.
- For Alex: this is the construction; slide 10 shows the same system exactly as drawn in the service package. The know-how is in how the tools and the memory are designed, not in hidden data flows.

## 4. Security depends on the contract, not on the tool
- Copilot, ChatGPT and Claude are equally safe or unsafe; what matters is whether you use a business plan with the right terms.
- Business plans: no training on your data by default. Data retention and EU data residency are set in your contract with the vendor; check the current terms of the chosen plan.
- Our rule: the connector is enabled only in company business workspaces, never in private subscriptions. That is a security measure, not a convenience.
- Be open about the past: the pilot tests so far ran on personal accounts (the comparison used a ChatGPT Free plan) with public data only, website and public registers. From the formal pilot on, business workspaces only (ask 5 on slide 8).

## 5. What it already does
- The test from 29 September (the comparison Łukasz forwarded): same question to Claude and ChatGPT, once without and once with LC Connect.
- Without: the assistants guess from memory; only part of what they name is in your lead base (Poland 4 to 8, Czech Republic 0 to 4), the rest has to be checked by hand.
- With: Poland, all 16 pulsed-diode prospects (Claude); Czech Republic, all 14 (ChatGPT). Not a single company outside the base.
- Trade fairs: let Łukasz tell it himself; in his test about 65 % of the suggested companies were worth the visit (the rest absent or empty stands).
- Every person signs in individually and every change is in the audit log.

## 6. What it is not
- Not a replacement for Copilot for e-mail and documents. Copilot can use the same open protocol (MCP); that is to be validated in the pilot, no promise beyond that.
- Not a CRM, not a model fine-tune, not a data lake.
- It is a lead-research connector, the harness around your AI assistant: finding, enriching and organising leads. Closing business stays in your existing tools.

## 7. Where it could go
- Frame it clearly: ideas from Łukasz's daily use, not in the current scope.
- Knowledge base, connecting the dots, visit effectiveness by industry and module fit all need internal data, so each needs your data decision first.
- Trade-fair planning for the whole team extends what Łukasz already tested.
- Nothing touching ERP, CRM or other company data is connected without your decision and a signed NDA and data processing agreement.

## 8. What we need from you
- Green light for the formal pilot; terms follow in Munich (have one sentence ready on duration, users and scope if asked).
- Hosting choice: A, your Azure, or B, an AutoOffice-managed EU server (faster to start, can move to A later). Identity provider for sign-in: Entra ID, Google or Okta.
- NDA and data processing agreement signed before any company data goes in (this answers Alice's point from 29 September).
- Business workspace accounts for the pilot users; confirm the IT contact for security questions (Alex, if he is in the room).
- A date in Munich in the second week of November for the next step.

## 9. Backup: security pack in one page
- Use only if asked. Every line is in place today or written into the service terms; sign-in through your identity provider is the target, personal accounts are today's state.
- Watchdog, precisely: in the pilot a local full sign-in check runs every 5 minutes and an external probe every 30 minutes.
- If Alex wants depth: offer the data processing agreement draft and the architecture brief as a follow-up document.

## 10. Backup: the same system, as in the service package
- Use if Alex asks about the construction or about consistency with the documents of 15 September.
- It is the context diagram from the service package, unchanged; slide 3 is its simplified view (team, assistant, connector, identity provider, operator, market research).
- Its research label says "company name + website only", as all earlier documents do; the accurate wording is on slides 3 and 9 (company names, websites and product/market questions; never notes, contacts or users).
