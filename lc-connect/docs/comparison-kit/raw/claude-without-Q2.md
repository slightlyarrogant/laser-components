# Claude.ai WITHOUT LC Connect, Q2 (Czech Republic)

- Start (sent): 2026-09-29 15:20:08 CEST
- Completed: by 15:20:46 CEST (stop button gone) → response time ~38 s
- Model label in UI: Opus 5.5 · Medium
- Connector state: LC Connect OFF (Claude Docs and Vendo Connect on; Web search off; Memory on) — see claude-without-Q2-connectors.jpg
- Chat URL: https://claude.ai/chat/2ea4cf85-db6e-44f3-bbcb-d57819c2416a
- Tool calls: none

## Prompt
List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text)

Compiling a candidate list of relevant defense and industry firms.

This is from general knowledge only, without a live web search. Treat it as a starting list of prospects to verify, not confirmed facts. The Czech market has few makers of pulsed-laser end products. Most real demand sits in defence optronics, fibre test and sensing, and traffic or ADAS work.

| Company | City | Product / application using PLD | Wavelength (likely) | Confidence |
|---|---|---|---|---|
| Meopta – optika | Přerov | Rangefinding binoculars and riflescopes (sports optics); military fire-control and observation optics with LRF modules | 905 nm for civil LRF; 1550 nm plausible for military eye-safe LRF | Medium–high that they have LRF products; medium that they build them in-house rather than buying modules |
| Optokon | Jihlava | Fibre-optic test instruments, including OTDRs, which use pulsed lasers | 1310/1550 nm | Medium |
| Safibra | Říčany | Fibre-optic sensing systems (distributed and point sensors), often pulsed 1550 nm sources | 1550 nm | Low–medium |
| Valeo (R&D centre) | Prague | ADAS development. Valeo's SCALA LiDAR uses 905 nm PLDs, but Prague is mainly software and validation, not hardware design | 905 nm | Low–medium that the Czech site specifies or buys PLDs |
| Camea | Brno | Traffic monitoring and enforcement; possible laser or LiDAR-based vehicle detection alongside camera systems | 905 nm | Low–medium |
| Prototypa-ZM | Brno | Ammunition and fuze development; laser proximity fuzes would fit the portfolio, but I can't confirm they exist | 905 nm typical for laser fuzes | Low |
| MESIT (defence division) | Uherské Hradiště | Military electronics and avionics; possible fuze or optronic subsystems | unknown | Low |
| Varroc Lighting Systems | Nový Jičín (Šenov u N. J.) | Automotive lighting R&D; LiDAR integration into headlamps is an industry trend | 905 nm | Low |
| Primoco UAV / Workswell | Písek / Prague | Drones and airborne sensing; laser altimeters or LiDAR payloads, probably bought as modules | 905 nm | Low |
| VTÚ (Military Technical Institute) | Prague / Brno / Vyškov | State defence R&D; testing and development of LRF and fuze technology. A buyer of samples, not volume | 905 / 1550 nm | Medium as a research user, low as a volume customer |

Where I'm unsure. Several entries (Prototypa, MESIT, Varroc, Camea) are inferences from what the company does, not known PLD designs. Czech defence firms often integrate complete LRF modules from Jenoptik, Safran Vectronix or Newcon rather than designing around bare diodes. That matters if you're selling components rather than modules. I left out LiDAR service firms (surveying and drone mapping, such as Geodis Brno and Upvision) because they buy finished scanners.

Next steps to verify:

- Search the Czech defence industry association (AOBP ČR) member list for "dálkoměr" (rangefinder), "zapalovač" (fuze) and "LiDAR".
- Check exhibitor lists from IDET Brno and Future Forces Forum.
- Check CzechInvest supplier databases for automotive sensor work.

A proper market scan would cross-reference defence exhibitor lists, company registers and product datasheets across dozens of Czech firms. It could also confirm which companies design with bare PLDs rather than buying complete modules.

[UI card under the answer: "Suggested research — Broad multi-source scan of a national supplier market ... Start research (5–10 minutes)". Not clicked.]
