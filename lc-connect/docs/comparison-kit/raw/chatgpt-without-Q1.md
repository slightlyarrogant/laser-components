# ChatGPT WITHOUT LC Connect, Q1 (Poland)

- Start (sent): 2026-09-29 ~15:28:05 CEST
- Completed: by 15:28:53 CEST; UI label "Przetwarzano przez 31s" (processed for 31 s) → response time ~31–48 s
- Model label in UI: "Myślenie" (Thinking) mode; account plan shown as "Bezpłatny" (Free)
- Connector state: no app selected in the composer. The "+" menu lists Vendo Connect, Zdrowie, OpenAI Platform, Visualize, GitHub (Połącz), Notion (Połącz) — LC Connect is NOT installed in this ChatGPT account. See chatgpt-without-Q1-connectors.jpg
- Chat URL: https://chatgpt.com/c/6abbbcd8-d6cc-83ed-bb2e-fddb6c0a1594
- Tools: ChatGPT searched the web on its own (source chips in the answer: Telesystem, test.altair.com.pl, toya24.pl, aiq-robotics.com, MILMAG, PCO S.A., GRUPA WB, Portal Obronny, Repozytorium BG WAT)

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; source chips kept as plain lines)

I found a relatively small number of Polish companies for which there is public evidence connecting an actual product/application with 905 nm or 1550 nm pulsed laser technology. The public documentation is much better for 905 nm than for 1550 nm.

One important distinction: “905 nm laser” does not by itself prove that the source is a pulsed laser diode (PLD). For several products the wavelength is public but the exact emitter is not. I therefore give a separate confidence level for the PLD identification.

| Company | City | Product / application | Wavelength | Evidence for pulsed diode | Confidence |
|---|---|---|---|---|---|
| CRW Telesystem-Mesko | Lubiczów / Stare Babice | Laser rangefinder modules; optoelectronic systems; Piorun proximity-fuze work | 905 nm | Strong – company describes a semiconductor laser-diode 905 nm rangefinder module; ToF ranging implies pulsed operation, although the public material doesn't explicitly call it “PLD” | High |
| TOYA S.A. / YATO | Wrocław | YATO YT-73129 / YT-731290 laser rangefinders | 905 nm | Wavelength and ranging are documented, but the exact laser-diode type/pulse characteristics aren't published | Medium |
| AiQ robotics P.S.A. | Pniewy | C16/C32 3D LiDAR scanners for mobile robotics | 905 nm | Strong for pulsed operation – manufacturer/distributor specifies “impulse” detection at 905 nm; exact PLD component isn't identified | Medium–high |
| MESKO S.A. | Skarżysko-Kamienna | PIORUN MANPADS, incorporating laser proximity fuze | Laser wavelength not publicly specified | The proximity fuze is explicitly laser/optoelectronic; development was primarily by CRW Telesystem-Mesko and WAT. I could not verify 905/1550 nm for the production fuze | Medium for laser fuze; low for 905/1550 PLD |
| PCO S.A. | Warsaw | GOD-1/GOC-1/GOS-1 optoelectronic heads with laser rangefinders, including ZSSW-30 | Not publicly specified | Laser rangefinder is confirmed, but I found no reliable public source identifying its wavelength or emitter | Medium for LRF; low for 905/1550 PLD |
| WB Electronics / WB Group | Warsaw | Fire-control / EO systems incorporating PCO laser rangefinders; e.g. ZSSW-30 and UAV systems | Not publicly specified | LRF integration is documented, but the underlying laser specification is not public | Medium for LRF; low for 905/1550 PLD |

1. CRW Telesystem-Mesko — the strongest match

This is the most interesting company I found.

CRW Telesystem-Mesko explicitly states that, together with the Military University of Technology, it developed a “silent” laser rangefinder using a semiconductor laser-diode module at λ = 905 nm. The described module has ~1 m accuracy, approximately 3 km range and a very low-divergence beam. The company says the solution was intended for a range of applications including security systems, robotics and automatic measurement systems.
[source: Telesystem +1]

The same company is also deeply involved in military optoelectronics. It develops and produces components for GROM/PIORUN, including the electronics of the optoelectronic proximity fuze. Public sources specifically identify CRW Telesystem-Mesko and WAT as the main developers of the laser proximity fuze used in Piorun.
[source: test.altair.com.pl +1]

Its current product portfolio also includes laser rangefinders and laser-detection modules; in 2026 it exhibited MWPL modules detecting pulsed laser radiation for precision-guided weapons.
[source: test.altair.com.pl +1]

My assessment: this is a genuine Polish company with demonstrated competence in exactly the technology you're asking about. The only caveat is that I would not claim from public sources that the Piorun fuze itself uses a 905- or 1550-nm PLD. That particular specification appears to be non-public.

2. TOYA / YATO — confirmed 905-nm rangefinder, but emitter uncertain

TOYA, based in Wrocław, sells YATO-branded laser rangefinders. The YT-73129 is specified as a 5–900 m rangefinder using a 905 nm laser, and the newer YT-731290 reaches 1,000 m and likewise specifies 905 nm.
[source: toya24.pl | TOYA S.A. +1]

This is very likely based on the standard pulsed-ToF architecture used by 905-nm semiconductor laser rangefinders. However, I did not find a TOYA/YATO document identifying the actual laser diode or giving pulse width/peak current.

So I would put it in the “probable PLD user, not publicly proven” category rather than calling it confirmed.

3. AiQ robotics — 905-nm pulsed LiDAR

AiQ robotics is based in Pniewy, Wielkopolskie. Its LiDAR portfolio includes the C16 and C32 3D scanners.

For both products the published specifications say:

- detection method: pulsed
- wavelength: 905 nm
- C16: 16 laser beams, up to 200 m
- C32: 32 laser beams, up to 200 m.
[source: aiq-robotics.com]

AiQ also explicitly describes its business as including LiDAR scanners for automotive, infrastructure, automation and mobile robotics.
[source: aiq-robotics.com]

The qualification is that AiQ is principally an integrator/distributor rather than the semiconductor-laser manufacturer. Its site carries LSLiDAR products, so I would not assume that the actual PLD is selected or designed by AiQ.

Technology match: high. Polish PLD-own-product match: medium.

4. MESKO — particularly interesting because of the proximity fuze

MESKO is based in Skarżysko-Kamienna and produces the PIORUN missile.

The PIORUN modernization introduced a proximity fuze in addition to the impact fuze. Historical reporting explicitly says that the laser proximity fuze work was performed principally by CRW Telesystem-Mesko and WAT.
[source: test.altair.com.pl +1]

More recent reporting confirms that the proximity fuze remains part of the modernized PIORUN configuration.
[source: MILMAG +1]

MESKO therefore belongs on the list if you're looking for potential users of pulsed laser technology in military products, but I would not put 905/1550 nm against MESKO without qualification. I could not find a credible public source giving the wavelength of the production fuze.

5. PCO — confirmed laser rangefinders, wavelength undisclosed

PCO in Warsaw produces stabilized electro-optical heads such as GOD-1, GOC-1 and GOS-1. PCO explicitly describes laser rangefinders as part of these systems.
[source: PCO S.A. +1]

The GOD-1/GOC-1 heads were supplied to WB Electronics for the ZSSW-30 turret, with each head incorporating a day camera, thermal camera and laser rangefinder.
[source: GRUPA WB +1]

What I could not establish is whether the production PCO rangefinder uses 905 nm, 1550 nm, or another wavelength. That information appears not to be openly specified.

So:

PCO = definitely a Polish manufacturer of products containing laser rangefinders; 905/1550-nm PLD = not publicly verified.

6. WB Group / WB Electronics — system-level user

WB Electronics/WB Group is another plausible customer/user rather than a confirmed PLD manufacturer.

Its systems integrate PCO electro-optical heads containing laser rangefinders. The clearest example is ZSSW-30, where WB Electronics is responsible for the fire-control system and PCO supplies the optoelectronic heads containing the LRF.
[source: GRUPA WB +1]

WB also uses EO/IR payloads with rangefinding capability on UAV systems. For example, its Gladius-related UAV configuration is described as carrying an optoelectronic head with cameras, a rangefinder and laser target designator.
[source: Portal Obronny]

Again, however, I found no sufficiently reliable public evidence for the 905/1550-nm specification of the actual laser source.

One particularly useful historical lead

There is an additional piece of evidence that strengthens the Polish 1550-nm ecosystem, although it is more R&D than a current commercial product.

A paper by researchers from the Military University of Technology and Bumar Soldier S.A. describes a complete laser-rangefinder prototype using a pulsed 1535-nm eye-safe microchip laser. The prototype was actually tested under real environmental conditions.
[source: Repozytorium BG WAT +1]

That is not a PLD in the strict semiconductor sense—the 1535-nm source is a microchip solid-state laser—so I would not count Bumar Soldier as a PLD user. But it demonstrates that Polish defence R&D has worked directly with the 1550-nm-class pulsed ranging technology.

My shortlist, if your purpose is identifying potential PLD customers

I'd divide the market this way:

Strongest prospects / evidence

1. CRW Telesystem-Mesko — Lubiczów — 905-nm semiconductor laser-diode rangefinder; military laser/proximity-fuze expertise.
2. AiQ robotics — Pniewy — 905-nm pulsed LiDAR products.
3. TOYA/YATO — Wrocław — 905-nm rangefinders; PLD very likely, but component not disclosed.

Very relevant defence companies, but wavelength needs verification
4. MESKO — Skarżysko-Kamienna — laser proximity fuze in PIORUN.
5. PCO — Warsaw — military EO systems with laser rangefinders.
6. WB Electronics/WB Group — Warsaw — fire-control and UAV systems incorporating laser rangefinders.

There is an important commercial distinction here: CRW Telesystem-Mesko is by far the clearest evidence of a Polish company actually developing around a 905-nm semiconductor laser-diode module, whereas PCO/WB/MESKO are much larger potential system-level users but their exact laser source specifications are not publicly exposed.
[source: Telesystem +1]

If your objective is selling 905-nm PLDs into Poland, I would therefore investigate the first three differently from the defence primes: Telesystem-Mesko looks like an actual technology/component-level target, while PCO/WB/MESKO look more like OEM/system-level targets where the PLD is buried several levels down the supply chain.
