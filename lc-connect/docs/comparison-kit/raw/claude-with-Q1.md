# Claude.ai WITH LC Connect, Q1 (Poland)

- Start (sent): 2026-09-29 15:22:06 CEST
- Completed: by 15:22:50 CEST (stop button gone) → response time ~44 s
- Model label in UI: Opus 5.5 · Medium
- Connector state: LC Connect toggled ON for this chat (also on: Claude Docs, Vendo Connect; Web search off; Memory on) — see claude-with-Q1-connectors.jpg
- Chat URL: https://claude.ai/chat/2e1326f0-01c2-4282-819b-6a863d366e8a
- Tool calls: NONE visible in the UI; no permission dialog appeared. The LC Connect server log (lc-connect/server.log) shows no request from Anthropic IPs between 13:21:50Z and 13:23:15Z — only the local watchdog. The last claude.ai traffic before the run was at 13:17:40Z (connector session/tool listing when the "+" menu was first opened, userId 12). The answer itself says "Vendo Connect isn't a market-research source" and does not mention LC Connect.

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text)

Cataloguing candidate firms across optics, fuzes, and sensors.

No live source was available for this list; it comes from what I know as of mid-2026. One caveat affects every row: a laser rangefinder is not automatically a pulsed laser diode (PLD) application. Many military eye-safe rangefinders use 1535 nm Er:glass solid-state lasers, which are not diodes. Where I'm unsure which source a product uses, I've marked it.

| Company | City | Product / application | Confidence |
|---|---|---|---|
| PCO S.A. (Przemysłowe Centrum Optyki) | Warsaw | Observation and targeting devices and fire-control sights with integrated laser rangefinders | High that they use laser rangefinding. Medium-low that it's a PLD rather than Er:glass. |
| MESKO S.A. | Skarżysko-Kamienna | Piorun man-portable air-defence missile, which has a proximity fuze. Laser proximity fuzes typically use 905 nm PLDs. | Medium on the fuze, low-medium that it's PLD-based |
| WB Electronics / WB Group | Ożarów Mazowiecki | Loitering munitions (Warmate), UAVs (FlyEye), fire-control systems. Laser altimeters, rangefinders or fuze sensors are plausible. | Low-medium |
| Dezamet S.A. (PGZ) | Nowa Dęba | Fuzes for mortar and grenade ammunition. Laser proximity variants are possible but I can't confirm them. | Low |
| Advanced Protection Systems | Gdynia | SKYctrl counter-drone system. Its sensor suite may include laser ranging, but it relies mainly on radar and EO/IR. | Low |
| Hertz Systems | Zielona Góra | Counter-UAV and surveillance systems | Low |
| Łukasiewicz – PIAP | Warsaw | Mobile and military robots using LiDAR. It buys LiDAR modules rather than designing PLDs. | Medium that it uses LiDAR, high that it's an integrator |
| Aptiv (Kraków Technical Center) | Kraków | Automotive ADAS engineering, which may involve LiDAR sensor fusion | Low-medium |
| Łukasiewicz – Instytut Mikroelektroniki i Fotoniki | Warsaw | Research institute that develops and makes semiconductor laser diodes. It's a potential supplier or partner rather than an end user. | Medium-high |
| Military University of Technology (WAT), Institute of Optoelectronics | Warsaw | R&D on laser rangefinders, LiDAR and laser fuze technology, often partnered with PGZ companies | High that it works in the field, but it isn't a company |
| VIGO Photonics | Ożarów Mazowiecki | Infrared detectors and photonic components. It's on the detector side of a LiDAR/LRF chain, not a PLD user. | Medium as an adjacent player |

How to verify:

- The PGZ group (Polska Grupa Zbrojeniowa) companies are the most likely PLD users, especially for proximity fuzes and handheld rangefinders.
- MSPO trade-fair exhibitor catalogues (Kielce) name specific products.
- Tender notices on the Agencja Uzbrojenia (Armament Agency) site give specifications.
- Civilian users (robotics, drones, surveying, automotive) are mostly integrators buying finished LiDAR modules, so they matter less if you're selling bare PLDs.

Vendo Connect isn't a market-research source, so this couldn't go through it. Turning on web search would let me check current company product pages and exhibitor lists.

[UI note under the answer: "Web search is off — Turn it on so Claude can check current sources for this."]
