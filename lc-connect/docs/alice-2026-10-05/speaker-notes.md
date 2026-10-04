# LC Connect briefing, 5 October 2026: speaker notes

Meeting with Laser Components (Alice, probably Alex), 16:30 CET, in English. Aim: 20 minutes of slides at most, then questions. Slide 9 is a backup for security questions.

## 1. LC Connect: what it is and how it works
- Thank them for the time. Say up front: short, nine slides, the last one is a backup for security questions.
- Purpose today: make clear what LC Connect is, how it is built, and what we need to go formal.
- The provider is AutoOffice; we build and run it.

## 2. We do not train a model. We build a harness.
- Answer the hardware question directly: there is no training and no GPU purchase. The models from OpenAI and Anthropic are the engine, rented as they are.
- The harness is everything around the engine: tools that know your products, your lead base and your rules, plus a memory of corrections.
- "Training" for us means daily use: when a user corrects an answer, the correction is stored and the next answer is better. That knowledge stays with Laser Components.
- Training your own model costs hundreds of thousands and is frozen the day it is finished; the engine underneath a harness improves with every model release, for free.

## 3. Diagram: how it fits together
- Walk left to right: your team works in its Claude or ChatGPT business workspace; the connector signs each person in individually (OAuth 2.1) with their role.
- The LC Connect server decides what each person may do and logs every change; the database holds leads, products, knowledge and the memory of corrections.
- The orange area is where the data lives: your Azure (option A) or an AutoOffice-managed server in the EU (option B). You choose.
- The model vendor sees only the conversation, under your business contract. The research engine (Perplexity) gets a public company name and website, nothing internal.
- The engine is replaceable: if a better model appears, we switch it without rebuilding the harness. For Alex: this is the construction; the know-how is in how the tools and the memory are designed, not in hidden data flows.

## 4. Security depends on the contract, not on the tool
- Copilot, ChatGPT and Claude are equally safe or unsafe; what matters is whether you use a business plan with the right terms.
- Business plans: no training on your data; zero data retention and EU hosting are contract options (check the current terms of your chosen plan with the vendor).
- Our rule: the connector is enabled only in company business workspaces, never in private subscriptions. That is a security measure, not a convenience.
- Today the pilot contains public data only: the website and public registers. No company data has been uploaded.

## 5. What it already does
- The test from 29 September: same question to Claude and ChatGPT, once without and once with LC Connect.
- Without: the assistants guess from memory; only part of what they name is in your lead base (Poland 4 to 8, Czech Republic 0 to 4), the rest has to be checked by hand.
- With: Poland, all 16 pulsed-diode prospects (Claude); Czech Republic, all 14 (ChatGPT). Not a single company outside the base.
- Trade fairs: in Łukasz's own use, about 65 % of the suggested contacts were confirmed; the rest were absent or had empty stands.
- Every person signs in individually and every change is in the audit log.

## 6. What it is not
- Not a replacement for Copilot: emails and documents stay in Copilot.
- Not a CRM, and not a model fine-tune or a data lake.
- It is a research and knowledge harness for leads: finding, enriching and organising them. Closing business stays in your existing tools.

## 7. Where it could go
- These come from the user side, from what Łukasz wants in daily work.
- Knowledge base: get know-how out of people's heads into something the whole team can ask.
- Connecting the dots, visit effectiveness by industry, module fit (diode plus optics) before design, trade-fair planning.
- Anything that touches ERP or CRM data is a later phase and needs your decision; nothing is connected without it.

## 8. What we need from you
- Green light to make the pilot formal.
- Hosting choice: A, your Azure, or B, an AutoOffice-managed EU server (faster to start, can move to A later).
- Business workspace accounts for the pilot users, and a named IT contact for the data processing agreement and security questions.
- A date in Munich in the second week of November for the next step.

## 9. Backup: security pack in one page
- Use only if asked. Every line is in place today or written into the service terms.
- If Alex wants depth: offer the data processing agreement draft and the architecture brief as a follow-up document.
