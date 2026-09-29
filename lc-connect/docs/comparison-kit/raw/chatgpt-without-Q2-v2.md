# ChatGPT WITHOUT LC Connect (no app selected), Q2 (Czech Republic) — v2, after custom-instruction change

- Start (sent): 2026-09-29 ~22:42:05 CEST (clock read 22:42:03 just before Enter)
- Completed: UI label "Przetwarzano przez 16s" (processed for 16 s); complete by ~22:42:40 CEST
- Model label in UI: "Myślenie" (Thinking) chip; account "viper73", plan "Bezpłatny" (Free)
- Connector state before sending: NO app selected — see chatgpt-without-Q2-v2-connectors.jpg (menu top) and chatgpt-without-Q2-v2-connectors-menu.jpg (menu scrolled: Vendo Connect, Plugin Creator, **LC Connector**, Zdrowie, OpenAI Platform, Visualize, GitHub/Notion "Połącz" — nothing selected)
- Chat URL: https://chatgpt.com/c/6abc2296-bd7c-83eb-beb1-27c3b81e5a53
- **ChatGPT called LC Connect anyway, although no app was selected.** UI shows 1 "Opened Search leads" card with a "Leads — search" widget (14 of 14 records). Answer opens "Using LC Connect first". NOT a clean no-connector baseline.
- Web search: yes (source chips rayservice.com +3, vrg.cz +1, tatradv.cz +1)
- Server log (UTC, userId 12, IP 150.228.91.136, 20:42:10–20:42:13Z): 15 tool calls = search_leads ×1 (country+productName+limit, ok) + enrich_lead ×14 — **all 14 enrich_lead calls failed: "PERPLEXITY_API_KEY environment variable is not set"** (research key still missing). ChatGPT reported the failure in the answer. (A search_leads from 160.79.106.181 = claude.ai and a local whoami in the same minute belong to other sessions, excluded.)
- Data source named as: "LC Connect"
- Companies named: 14 — all 14 in the LC Czech list (29); 14 of 14 PLD-linked leads

## Prompt
List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; source chips kept as plain lines)

Using LC Connect first, I found 14 Czech leads associated with 905 nm pulsed laser diodes. LC Connect does not currently contain city or detailed product/application evidence for these records. The enrichment function also failed because the connector's PERPLEXITY_API_KEY is not configured, so I have marked the application/confidence conservatively rather than presenting inference as confirmed fact.

| Company | City | Product / application indicated by LC Connect | Confidence |
|---|---|---|---|
| Ray Service a.s. | Staré Město* | Defense electronics / cable harnesses; 905 nm PLD | Medium |
| Lightigo s.r.o. | Brno* | Laser spectroscopy / measurement; 905 nm PLD | Medium–low |
| LASER-TECH spol. s r.o. | — | Industrial laser processing; 905 nm PLD | Low–medium |
| Saab Czech s.r.o. | Slavkov u Brna* | Military training / simulation; 905 nm PLD | Medium |
| IPG Photonics (Czech Republic) s.r.o. | Prague* | Industrial laser systems; 905 nm PLD | Low–medium |
| Aero Vodochody Aerospace a.s. | Odolena Voda* | Aerospace / defense; 905 nm PLD | Low–medium |
| Tatra Defence Vehicle a.s. | Kopřivnice* | Armoured vehicles / defense systems; 905 nm PLD | Low–medium |
| Excalibur Army spol. s r.o. | Šternberk* | Military vehicles / systems; 905 nm PLD | Low–medium |
| Narran s.r.o. | Brno* | Industrial laser systems; 905 nm PLD | Low |
| Glomex Military Supplies s.r.o. | Prague* | Defense-system integration; 905 nm PLD | Medium–low |
| L.P.P. Holding a.s. | Prague* | Defense electronics / optoelectronics; 905 nm PLD | Medium |
| Elya Solutions s.r.o. | Prague* | Defense optics / optomechanics; 905 nm PLD | Medium |
| Primoco UAV SE | Prague* | UAV / defense applications; 905 nm PLD | Medium–low |
| VR Group a.s. | Prague* | Laser combat / military training simulation; 905 nm PLD | Medium–high |

\*City comes from supplementary public company information, not LC Connect. For example, Ray Service lists its headquarters in Staré Město, Lightigo in Brno, Elya in Prague, and VR Group in Prague.
rayservice.com +3

Important qualification

The LC Connect evidence is strongest at the lead level: all 14 records are explicitly tagged "Pulsed Laser Diodes at 905 nm." However, that does not necessarily prove that the company manufactures a finished product containing a PLD. Some records may represent a potential component/application lead rather than a technically verified end-product user.

The particularly interesting case is VR Group: its own documentation confirms the STING laser combat simulator, developed using Czech components for live military tactical training. That makes the LC Connect association with laser-based military training substantially more plausible, although I did not obtain independent confirmation that the specific emitter is a 905 nm PLD.
vrg.cz +1

Similarly, Tatra Defence Vehicle and Excalibur Army are definitely Czech military-vehicle manufacturers, but the public material I found does not establish that their vehicles themselves use 905 nm PLDs.
tatradv.cz +1

Tools used: LC Connect search_leads; web search for public company/location verification. The LC Connect enrich_lead call failed because PERPLEXITY_API_KEY is unavailable.

There is therefore a connector problem with enrichment. Please use report_issue to report it to the LC Connect administrator.

## Screenshots
- chatgpt-without-Q2-v2-connectors.jpg, chatgpt-without-Q2-v2-connectors-menu.jpg — "+" menu, nothing selected; LC Connector listed but not chosen
- chatgpt-without-Q2-v2.jpg — "Opened Search leads" card + widget (14 of 14 records)
- chatgpt-without-Q2-v2-end.jpg — end of answer (qualification, tools used, enrichment failure)
