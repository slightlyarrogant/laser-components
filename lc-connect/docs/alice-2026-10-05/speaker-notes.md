# LC Connect briefing, 5 October 2026: speaker notes

Laser Components (Alice, probably Alex), 16:30 CET, in English. 9 slides; 8 and 9 are backups.

## 1. LC Connect: what it is and how it works
- The provider is AutoOffice, which builds and runs LC Connect.

## 2. We do not train a model. We build a harness.
- Alice asked about hardware for training on large data sets; the answer is that nothing is trained and no GPUs are needed.
- AutoOffice does not resell the model: the subscription is Laser Components' own, and switching the engine leaves the harness unchanged.
- Closing business stays in their existing tools; Copilot can use the same open protocol (MCP), to be validated in the pilot, no promise beyond that.

## 3. Diagram: how it fits together
- Where it runs today: AutoOffice's own server behind a secured tunnel; it moves to option A or B at the formal step.
- Sign-in through your identity provider is the target; AutoOffice operates and monitors; both shown on the backup diagram (slide 9).
- Sign-in today uses personal LC Connect accounts; choosing the identity provider is ask 3 on slide 7.

## 4. Security depends on the contract, not on the tool
- The comparison Alex has seen ran on individual accounts (ChatGPT on a Free plan), with public data only.
- Microsoft 365 Copilot does not use Chinese models according to Microsoft's model documentation of 10 Sep 2026; the opt-in Kimi models exist only in GitHub Copilot and Microsoft Foundry, hosted on Fireworks AI in the US.
- Microsoft EU Data Boundary caveats: Flex Routing may run inference outside the EU at peak times and has been on by default since April 2026, and Anthropic models inside Copilot are outside the boundary.
- Anthropic: since June 2026 its newest models carry a mandatory 30-day retention even under zero data retention; a replacement with logs kept in the customer's own cloud was announced on 1 Sep 2026.
- LC Connect's own call to Perplexity goes to the endpoint covered by Perplexity's no-retention statement.

## 5. With LC Connect, the assistant finds every prospect in your base
- Source: the comparison of 29 September that Łukasz forwarded; without the connector, Claude named 12 Polish companies (8 in the base) and ChatGPT 6 (4 in the base).
- Not one company named with LC Connect was outside the base; in the Czech test, Claude also listed 9 LiDAR prospects alongside 15 pulsed-diode ones.
- The 65 % figure is Łukasz's own trade-fair test (the rest were absent or had empty stands), so let him tell it.

## 6. One connector in your ecosystem, not a system of its own
- The connector protocol (MCP) is open and vendor-neutral, so this does not lock Laser Components to one assistant.
- Combining connectors is where roles, the audit trail and the harness matter most: the assistant may only do what each person is allowed to do in each system.
- Nothing on this slide needs their internal data today; it needs the decisions on slide 7.
- If asked what else it could do (Łukasz's ideas, none in the current scope, all but the last need their data decision):
  - Know-how out of heads: a knowledge base the team can ask.
  - Connecting the dots: customers who together will need Laser Components.
  - Visit effectiveness by industry: visit reports plus ERP data.
  - Module fit before design: diode plus optics for a request.
  - Trade-fair planning for the whole team: who to meet, before every fair.

## 7. Seven decisions. Then daily use becomes routine.
- The confirmation prompt is a feature of the assistant app (Claude and ChatGPT tool approval) and is configurable per tool.
- LC Connect enforces roles, access rules and the audit log on every write; it does not add its own confirmation gate.
- Voice mode exists in the Claude and ChatGPT apps today.
- On the asks: "formal pilot" means terms follow in Munich; ask 4 answers Alice's 29 September point on company data before an NDA; propose Alex as the IT contact.

## 8. Security pack in one page
- Watchdog in the pilot: a local full sign-in check every 5 minutes, plus an external probe every 30 minutes.
- Perplexity never receives notes, contacts or user data; it can be switched off.
- Exit terms: full source in their repository, and data exported and deleted within 30 days of the end of the agreement.

## 9. Same system as in the service package
- Its research label still says "company name + website only"; the accurate wording is on slides 3 and 8.
