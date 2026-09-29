# ChatGPT WITHOUT LC Connect (no app selected), Q1 (Poland) — v2, after custom-instruction change

- Start (sent): 2026-09-29 ~22:39:58 CEST (Enter pressed; clock read 22:40:02 right after)
- Completed: UI label "Przetwarzano przez 23s" (processed for 23 s); complete by 22:40:40 CEST
- Model label in UI: "Myślenie" (Thinking) chip in composer; account "viper73", plan "Bezpłatny" (Free)
- Connector state before sending: NO app selected (no chip in the composer) — see chatgpt-without-Q1-v2-connectors.jpg ("+" menu open, nothing selected). "LC Connector" is now installed in the account and listed in the "+" menu (see chatgpt-without-Q2-v2-connectors-menu.jpg).
- Chat URL: https://chatgpt.com/c/6abc221c-f7f8-83ed-95bc-5e601e8d3c61
- **ChatGPT called LC Connect anyway, although no app was selected.** UI shows 7 "Opened Search leads" tool cards (each "CSP wył."), with "Leads — search" widgets. The answer opens "I checked LC Connect first" and ends "Tools used: LC Connect (search_leads, get_lead_notes) first; web search only to supplement missing city/address information." This run is therefore NOT a clean no-connector baseline.
- Web search: yes (source chips: ctl.com.pl, OEM Tech, Huta Stalowa Wola S.A., Portal Przedsiębiorcy Sektora Obronnego, ac-m.pl, GRUPA WB, Mesko S.A.)
- Server log (lc-connect/server.log, UTC, userId 12, ChatGPT egress IP 150.228.91.136, 20:40:08–20:40:17Z): 23 tool calls = search_leads ×7 (3× country+productName+limit, 4× query+country+limit), get_lead_notes ×16 — all outcome "ok". (One search_products call at 20:39:56Z came from a different IP, 80.187.75.148, before this prompt was sent — not attributed to this run.)
- Data source named as: "LC Connect" (no "Vendo" wording any more)
- Companies named: 15 — all 15 in the LC Poland list (25); 15 of the 16 PLD-linked leads (missing only FIBRAIN)

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; source chips kept as plain lines)

I checked LC Connect first. It contains 15 Polish leads explicitly associated with pulsed laser diodes at 905 nm or 1550 nm. The LC data does not contain city or detailed product descriptions for most records, so I supplemented city only from public sources; those additions are marked accordingly.

| Company | City* | PLD / application indicated by LC Connect | Confidence |
|---|---|---|---|
| Semicon Sp. z o.o. | Warsaw* (chip: Semicon) | 905 nm PLD; laser modules / laser electronics | High |
| Instytut Optoelektroniki WAT | Warsaw* | 1550 nm PLD; defence R&D, laser rangefinding / electro-optics | High |
| Wojskowy Instytut Techniczny Uzbrojenia (WITU) | Zielonka* | 905 nm PLD; defence R&D, rangefinding / weapon systems | High |
| Perspectiva Solutions | Warsaw* | 905 nm PLD; photonics manufacturing | Medium–high |
| CTL Laserinstruments Sp. z o.o. | Warsaw (chip: ctl.com.pl +1) | 905 nm PLD; medical/industrial laser and measurement systems | Medium–high |
| Solaris Optics S.A. | Warsaw* | 1550 nm PLD; optical components / photonics | Medium |
| OEM Tech Sp. z o.o. | Warsaw (chip: OEM Tech) | 905 nm PLD; pulsed-laser diode electronics/drivers | High |
| Huta Stalowa Wola S.A. (HSW) | Stalowa Wola (chip: Huta Stalowa Wola S.A.) | 1550 nm PLD; defence vehicles/turrets, electro-optical/rangefinding systems | Medium–high |
| Zakłady Mechaniczne Tarnów S.A. (ZMT) | Tarnów (chip: Portal Przedsiębiorcy Sektora Obronnego) | 905 nm PLD; weapon systems / remote weapon stations | Medium–high |
| Autocomp Management Sp. z o.o. | Szczecin (chip: ac-m.pl +1) | 905 nm PLD; military/weapon-system simulators | Medium |
| WB Electronics S.A. / WB Group | Ożarów Mazowiecki (chip: GRUPA WB) | 1550 nm PLD; defence electronics, rangefinding / EO systems | High |
| Etronika Sp. z o.o. | Warsaw (chip: Portal Przedsiębiorcy Sektora Obronnego) | 1550 nm PLD; laser rangefinders, observation heads and fire-control systems | High |
| MESKO S.A. | Skarżysko-Kamienna (chip: Mesko S.A.) | 905 nm PLD; defence ammunition/missile systems | Medium |
| Fluence Technology Sp. z o.o. | Warsaw* | 905 nm PLD; laser manufacturing | Medium |
| TopGaN Sp. z o.o. | Warsaw* | 905 nm PLD; laser-diode manufacturing | Medium |

\* City is not present in LC Connect; where I have not cited a public source, treat the city as supplemental/unverified. The PLD association itself comes from LC Connect.

Most relevant prospects

If the purpose is specifically to identify potential users of 905/1550-nm PLDs in finished systems, rather than companies manufacturing laser components, I would concentrate on:

- Etronika — particularly interesting because LC Connect associates it with 1550-nm PLDs, while public company information explicitly lists laser rangefinders, observation heads and fire-control systems.
  Portal Przedsiębiorcy Sektora Obronnego
- WB Electronics / WB Group — 1550 nm + defence electronics.
- Instytut Optoelektroniki WAT — 1550 nm + defence R&D/rangefinding.
- HSW — 1550 nm + defence vehicles/turrets.
- ZMT — 905 nm + weapon systems.
- WITU — 905 nm + defence R&D.
- Semicon — 905 nm + laser-module manufacturing.
- OEM Tech — 905 nm; particularly relevant as it explicitly manufactures electronics for pulsed laser diodes. Its site lists both pulsed-laser-diode drivers and other laser electronics.
  OEM Tech +1

Important qualification: LC Connect's records establish a lead's association with the specified PLD wavelength, but for several companies they do not establish the exact commercial product in which the diode is installed. Therefore I would treat the "High" confidence as high confidence that LC Connect has identified the company as a 905/1550-nm PLD lead, not necessarily as independently verified proof of a particular production model.

Tools used: LC Connect (search_leads, get_lead_notes) first; web search only to supplement missing city/address information.

## Screenshots
- chatgpt-without-Q1-v2-connectors.jpg — "+" menu open, no app selected
- chatgpt-without-Q1-v2.jpg — top of answer: "Opened Search leads" card + Leads — search widget (15 of 16 rows visible)
- chatgpt-without-Q1-v2-end.jpg — answer table (middle/lower rows)
