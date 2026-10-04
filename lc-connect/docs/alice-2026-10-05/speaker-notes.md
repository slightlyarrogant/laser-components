# LC Connect briefing, 5 October 2026: speaker notes

Laser Components (Alice, probably Alex), 16:30 CET, in English. Slides 9 and 10 are backups; 4b follows 4 and 7b follows 7 (12 pages).

## 1. LC Connect: what it is and how it works
- The provider is AutoOffice, which builds and runs LC Connect.

## 2. We do not train a model. We build a harness.
- Alice asked about hardware for training on large data sets; the answer is that nothing is trained and no GPUs are needed.
- AutoOffice does not resell the model: the subscription is Laser Components' own, and switching the engine leaves the harness unchanged.
- The learning mechanism (stored corrections) exists, but it has barely been used so far; it grows with daily use in the formal pilot.

## 3. Diagram: how it fits together
- Where it runs today: AutoOffice's own server behind a secured tunnel; it moves to option A or B at the formal step.
- Sign-in today uses personal LC Connect accounts; the identity provider (e.g. Entra ID) is the target, which is ask 3 on slide 8.
- If Alex asks for the full construction, slide 10 is the unchanged service-package diagram.

## 4. Security depends on the contract, not the tool
- The comparison Alex has seen ran on individual accounts (ChatGPT on a Free plan), with public data only.
- Retention and EU residency differ per vendor and plan; the per-vendor table is on slide 4b.

## 4b. No business plan trains on your data; no chat app offers zero retention
- Microsoft 365 Copilot does not use Chinese models according to Microsoft's model documentation of 10 Sep 2026; the opt-in Kimi models exist only in GitHub Copilot and Microsoft Foundry, hosted on Fireworks AI in the US.
- Microsoft EU Data Boundary caveats: Flex Routing may run inference outside the EU at peak times and has been on by default since April 2026, and Anthropic models inside Copilot are outside the boundary.
- Anthropic: since June 2026 its newest models carry a mandatory 30-day retention even under zero data retention; a replacement with logs kept in the customer's own cloud was announced on 1 Sep 2026.
- LC Connect's own call to Perplexity goes to the endpoint covered by Perplexity's no-retention statement.

## 5. With LC Connect, the assistant finds every prospect in your base
- Source: the comparison of 29 September that Łukasz forwarded; without the connector, Claude named 12 Polish companies (8 in the base) and ChatGPT 6 (4 in the base).
- Not one company named with LC Connect was outside the base; in the Czech test, Claude also listed 9 LiDAR prospects alongside 15 pulsed-diode ones.
- The 65 % figure is Łukasz's own trade-fair test (the rest were absent or had empty stands), so let him tell it.

## 6. A lead-research connector
- Closing business stays in their existing tools; LC Connect finds, enriches and organises leads.
- Copilot speaks the same open protocol (MCP), but it is untested with LC Connect, so promise nothing beyond validating it in the pilot.

## 7. One connector in your ecosystem, not a system of its own
- The connector protocol (MCP) is open and vendor-neutral, so this does not lock Laser Components to one assistant.
- Combining connectors is where roles, the audit trail and the harness matter most: the assistant may only do what each person is allowed to do in each system.
- Nothing on this slide needs their internal data today; it needs the decision on slide 8.

## 7b. Next: from lead research to company knowledge
- These are Łukasz's wishes from daily use, none is in the current service scope.
- Anything touching ERP, CRM or other company data waits for their decision and a signed NDA and data processing agreement.

## 8. Seven decisions to start the formal pilot
- If asked what "formal pilot" means (duration, users, cost): terms follow in Munich, with no prices discussed today.
- Ask 4 answers Alice's point of 29 September about company data before an NDA.
- For ask 6, propose Alex if he is in the room.

## 9. Security pack in one page
- Watchdog in the pilot: a local full sign-in check every 5 minutes, plus an external probe every 30 minutes.
- Perplexity never receives notes, contacts or user data; it can be switched off.
- Exit terms: full source in their repository, and data exported and deleted within 30 days of the end of the agreement.

## 10. Same system as in the service package
- Its research label still says "company name + website only"; the accurate wording is on slides 3 and 9.
