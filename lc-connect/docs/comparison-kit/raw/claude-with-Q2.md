# Claude.ai WITH LC Connect, Q2 (Czech Republic)

- Start (sent): 2026-09-29 15:24:30 CEST
- Completed: by 15:25:11 CEST (stop button gone) → response time ~40 s
- Model label in UI: Opus 5.5 · Medium
- Connector state: LC Connect ON for this chat (also on: Claude Docs, Vendo Connect; Web search off; Memory on) — see claude-with-Q2-connectors.jpg
- Chat URL: https://claude.ai/chat/9e055d89-edb9-4669-8fea-ad13920ba843
- Tool calls: NONE. No permission dialog. LC Connect server log shows no request from Anthropic IPs during the run.
- WHY (stated by the assistant, see claude-with-Q2-end.jpg): "Per your standing rule I haven't used any connector other than Vendo". The owner's claude.ai account carries a personal instruction/memory restricting connector use to Vendo. This confounds both "Claude + LC" runs: the connector was on but the account-level rule kept the model from calling it. Not changed (account settings are out of scope for this test).

## Prompt
List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text)

Weighing lidar and fuze makers against sensor evidence.

Web search is off, so this comes from my own knowledge only, and I can't verify it. Treat "confidence" as how sure I am that the company both exists as described and actually uses 905/1550 nm pulsed diodes, not just laser products in general. Several entries are integrators that buy finished LiDAR or rangefinder modules, so the diode sits inside someone else's product.

| Company | City | Product / application | Confidence |
|---|---|---|---|
| Meopta – optika | Přerov | Military and sport optics, including rangefinding sights and binoculars (LRF modules, typically 905 nm) | Medium. The rangefinding products exist, but the LRF module may be bought in rather than built |
| Optokon | Jihlava | Fibre-optic test equipment (OTDR-class instruments use pulsed 1310/1550 nm diodes) | Medium-low. I'm unsure whether they build OTDRs themselves or only resell them |
| Safibra | Říčany | Fibre-optic sensing systems (pulsed 1550 nm sources in distributed sensing) | Low |
| Poličské strojírny | Polička | Artillery and mortar fuzes. Laser proximity fuzes would be the relevant line | Low. I know they make fuzes, but not that any of them are laser-based |
| Valeo (R&D centre) | Prague | Automotive ADAS development, including Valeo's SCALA LiDAR (905 nm) | Medium-low. This is mostly software and validation work; the hardware is made elsewhere |
| Geodis Brno | Brno | Mobile and airborne laser scanning (1550 nm scanners from Riegl and others) | Medium, but they are an end user and integrator, not a diode customer |
| Upvision | Liberec | Drone LiDAR surveying | Low-medium, also an end user |
| VOP CZ | Šenov u Nového Jičína | Vehicle modernisation with fire-control and observation systems that include LRFs | Low. The LRFs come from subcontractors |
| Retia | Pardubice | Defence electronics and fire-control systems | Low. They are mainly a radar company, and laser content is speculative |

What's missing and why it matters:

- Few actual diode buyers. Most of these firms buy finished LRF or LiDAR modules. If you're prospecting for a pulsed-diode supplier, the real diode buyers are probably Meopta, possibly a fuze maker, and possibly the fibre-sensing firms. The rest are one step removed.
- No confirmed laser proximity fuze maker. I can't name a Czech company I'm confident makes laser proximity fuzes. The Czech defence sector (CSG group companies, STV Group, Explosia) is the place to look, but I'd only be guessing at which one.
- Industrial ToF sensor makers. Distance and level sensors for industry are another likely diode market that I can't cover reliably from memory.

The LC Connect lead database would be the obvious place to cross-check this. Per your standing rule I haven't used any connector other than Vendo, so tell me if you want an exception for this. Turning on web search would let me verify each entry against current company sources.

[UI note under the answer: "Web search is off — Turn it on so Claude can check current sources for this."]
