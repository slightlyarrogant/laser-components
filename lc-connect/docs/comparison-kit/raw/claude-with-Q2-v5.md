**Run:** claude.ai, new chat, LC Connect on. Verification run via Claude-in-Chrome (owner's browser), owner account Bogdan.

**Start time:** 2026-09-29 23:02:09 CEST (prompt sent).
**Model (UI label):** Opus 5.5 · Medium.
**Response time:** ~90 s (23:02:09 → answer complete ~23:03:40 CEST). No permission dialog appeared this run (the connector's "Always allow" grant was already in effect from the earlier Q1/Q2 runs the same day), so no dialog wait to exclude.
**Tools called:** `search_leads` (LC Connect) — 2 calls total:
1. Combined country + product filter ("Czech Republic" + a PLD/LiDAR product filter) → 14-of-14 / then widened result.
2. Free-text "Czech" search (to also catch leads with no country assigned) → 30-of-30 records.
No `enrich_lead` or other tool calls. No unfiltered "dump the whole country" widget-only defect this time — the model read the rows and wrote a full per-company text table.

**Chat URL:** https://claude.ai/chat/decbb779-2c28-4fac-b2ef-d334d625f3cd

---

## Answer (verbatim)

Claude responded: LC Connect has 22 Czech leads linked to pulsed laser diodes or LiDAR.

LC Connect has 22 Czech leads linked to pulsed laser diodes or LiDAR. None are linked to a 1550 nm product, and none to a proximity-fuze application. I used search_leads twice: once with country + product filter, once as a free-text "Czech" search, which also finds leads that have no country assigned.

How to read this: in LC Connect, a product link means the lead is a sales fit for that product. It does not confirm the company uses it. The search results carry no evidence of actual PLD use, so every confidence rating below is my judgement. Cities marked † and all confidence reasoning are general knowledge, unverified. All 22 leads are status NEW and unowned.

### Linked to "Pulsed Laser Diodes at 905 nm"

| Lead | City | Application (LC Connect industry) | Confidence they actually use PLDs |
|---|---|---|---|
| Saab Czech Republic (Training Systems) | – | Defense training / simulation | Medium. Laser engagement simulators typically use ~905 nm pulsed emitters.† |
| VR Group a.s. | – | Defense training & simulation | Medium. Same logic as Saab, if they build laser engagement kit.† |
| Metrodat s.r.o. | – (no country set) | Defense laser systems | Medium. The sector fits; I can't verify the product. |
| LPP Holding a.s. | – | Defense electronics / optoelectronics | Low–medium |
| Elya Solutions s.r.o. | – | Defense optics / optomechanics | Low–medium |
| Primoco UAV SE | Písek† | UAV | Low–medium. A laser altimeter is possible; more likely bought as a module. |
| Excalibur Army | Šternberk† | Armored vehicles | Low. An integrator buys finished rangefinders, not diodes. |
| Tatra Defence Vehicle | Kopřivnice† | Armored vehicles | Low. Same reason. |
| Aero Vodochody | Odolena Voda† | Aerospace | Low |
| Glomex Military Supplies | – | Defense integration | Low |
| Ray Service a.s. | Staré Město | Cable harnesses / EMS | Low. A contract manufacturer, not a designer. |
| Lightigo s.r.o. | – | Spectroscopy | Low |
| Narran s.r.o. | – | Industrial laser systems | Low |
| LASER-TECH | Olomouc | Laser material processing | Very low. Wrong laser class. |
| IPG Photonics CZ | Prague | Fiber lasers | Very low. A competitor-adjacent laser maker, not a PLD user. |

### Linked to "LiDAR" (these leads have LiDAR stored as their product rather than as an application)

| Lead | City | Industry | Confidence |
|---|---|---|---|
| Meopta – optika | Přerov† | Defense optics | Medium. Makes rangefinding sport/defense optics.† |
| EVPU Defence | Uherský Brod† | Electro-optics | Medium. Makes surveillance systems that typically include rangefinders. |
| RETIA a.s. | Pardubice | Defense electronics | Medium. Makes fire-control and radar systems. |
| Pramacom-HT | – | Defense systems (infrared.cz) | Low–medium |
| OPTOKON a.s. | Jihlava | Fiber optics / defense | Low–medium |
| Argotech a.s. | Náchod | Semiconductor photonics | Low–medium. Possibly a packaging/assembly partner rather than an end user. |
| CRYTUR | Turnov | Laser crystals | Low for PLD. Its crystals serve solid-state rangefinders, a competing approach.† |
| SQS Vláknová optika | Nová Paka | Fiber optics | Low |
| Frentech Aerospace | Brno | Precision manufacturing | Low |

Six other Czech leads (URC Systems, Optaglio, VUTS, GenEvo, Micro-Epsilon CZ, Workswell) are linked only to Si-PIN photodiodes, so I left them out.

The data has three gaps worth fixing: Metrodat has no country set, the LiDAR leads carry an application in the product field, and no leads cover 1550 nm or fuzes. If you'd like these escalated, tell me to use `report_issue`.
