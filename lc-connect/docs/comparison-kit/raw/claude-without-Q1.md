# Claude.ai WITHOUT LC Connect, Q1 (Poland)

- Start (sent): 2026-09-29 15:18:12 CEST
- Completed: by 15:18:55 CEST (stop button gone) → response time ~43 s
- Model label in UI: Opus 5.5 · Medium
- Connector state: LC Connect OFF (Claude Docs and Vendo Connect were on; Web search off; Memory on) — see claude-without-Q1-connectors.jpg
- Chat URL: https://claude.ai/chat/1b526ef4-28ea-4620-b656-61b906b3710a
- Tool calls: none (no connector/web tools used)

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text)

Expanding the search to research institutes and radar integrators.

I can't browse right now, so this comes from my training knowledge (through mid-2026). Companies rarely publish which emitter technology they use, so the PLD-specific part is the weakest link in almost every row below. There's also an important distinction to keep in mind. Many military rangefinders use solid-state lasers (1064 nm Nd:YAG or 1535 nm Er:glass) rather than pulsed laser diodes. A company that makes a rangefinder is therefore not automatically a PLD user.

Confidence scale: High = I'm fairly sure they make the product. Medium = product is likely but the PLD use is inferred. Low = plausible lead only.

| Company | City | Product / application | Confidence |
|---|---|---|---|
| PCO S.A. | Warsaw | Laser rangefinders for fire-control systems, observation devices and turret sights (e.g. ZSSW-30), laser warning systems | High for rangefinders; Medium for PLD (some may be solid-state) |
| CRW Telesystem-Mesko | Warsaw | Electronics for the Grom/Piorun MANPADS, including the proximity fuze | Medium for fuze work; Low–Medium that the fuze is laser-based |
| Mesko S.A. | Skarżysko-Kamienna | Piorun system integrator, plus fuzes and ammunition | Medium (integrator rather than the PLD designer) |
| Dezamet S.A. | Nowa Dęba | Mortar and artillery fuzes, including electronic fuzes | Low (proximity sensing could be RF rather than laser) |
| WB Group (WB Electronics) | Ożarów Mazowiecki | Warmate loitering munition, FlyEye UAV, fire-control electronics | Low–Medium |
| PIT-RADWAR | Warsaw | Air-defence systems (e.g. Poprad) with optoelectronic heads that include rangefinders | Medium for rangefinders, likely sourced from PCO; Low for PLD |
| Huta Stalowa Wola | Stalowa Wola | Fire-control systems and turrets that integrate laser rangefinders | Low (integrator) |
| Advanced Protection Systems | Gdynia | SKYctrl counter-drone system, whose optoelectronic sensors may include a laser rangefinder | Low |
| Delta Optical | Nowe Osiny (near Mińsk Maz.) | Branded hunting and sport rangefinders and rangefinder binoculars, probably 905 nm and probably OEM-sourced | Medium for the product; Medium for 905 nm PLD |
| Łukasiewicz – Institute of Microelectronics and Photonics | Warsaw | Research on high-power and pulsed laser diodes; a supplier/R&D body rather than a user | Medium |
| Military University of Technology (WAT), Institute of Optoelectronics | Warsaw | R&D on laser rangefinders, laser proximity fuzes and LiDAR | High for R&D; not a company |
| VIGO Photonics | Ożarów Mazowiecki | IR detectors that can serve as LiDAR and rangefinder receivers, i.e. the receiver side rather than an emitter user | Medium (adjacent market) |

Gaps you should expect:

- Industrial distance sensors and speed-enforcement devices made in Poland, where 905 nm PLDs are common. I don't have reliable Polish names for these.
- Automotive and robotics engineering centres in Kraków, Wrocław and Łódź. These mostly integrate foreign LiDAR units rather than design around PLDs.
- Small defence startups founded in 2024–2026, which are likely to be missing from my knowledge entirely.

If this is for sales prospecting, the most useful next step is to check sources that name suppliers directly: MSPO exhibitor lists, the PGZ group's company list, and NCBR/Agency for Armament Technology grant records. Turning on web search would let me check current sources and fill the gaps above.

[UI note under the answer: "Web search is off — Turn it on so Claude can check current sources for this."]
