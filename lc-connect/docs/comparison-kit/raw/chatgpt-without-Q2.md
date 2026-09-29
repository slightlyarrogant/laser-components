# ChatGPT WITHOUT LC Connect, Q2 (Czech Republic)

- Start (sent): 2026-09-29 15:30:13 CEST
- Completed: 15:30:51 CEST (stop button gone) → response time ~38 s; UI label "Przetwarzano przez 27s"
- Model label in UI: "Myślenie" (Thinking) mode; plan "Bezpłatny" (Free)
- Connector state: no app selected; LC Connect not present in the "+" menu (see chatgpt-without-Q2-connectors.jpg)
- Chat URL: https://chatgpt.com/c/6abbbd5c-ac80-83eb-bc93-dc39d66096bf
- Tools: web search by ChatGPT itself (source chips: Archer-LPP, SEFOR Solutions, Night Pearl, Oxepower, Future Forces 2026, EVOLVEO.cz, Fomei, Šubrt Myśliwski, Astrum LT)

## Prompt
List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; source chips kept as bracketed lines)

I found a small number of Czech companies with public evidence of 905/1550 nm laser-ranging products. The strongest matches are in military/security electro-optics rather than automotive LiDAR.

| Company | City | Product / application | Wavelength | Confidence |
|---|---|---|---|---|
| ARCHER-LPP s.r.o. | Pardubice / Prague | Thermal/night-vision sights and multisensor binoculars with integrated LRF; e.g. Archer TSA-7 (5 km) and MSB-8 | 1550 nm; some products also 905 nm | Very high |
| SEFOR Solutions s.r.o. | Prague | SEFOR MSBi multispectral binocular for reconnaissance, surveillance, border patrol and targeting, with integrated LRF | 905/1550 nm, up to 8 km | High |
| OptiDynex s.r.o. / Night Pearl | Bystřice pod Hostýnem | Night Pearl thermal sights with integrated LRF, e.g. FOX 35 ELITE II LRF | 905 nm, up to 1 km | Medium |
| Abacus Electric / EVOLVEO | Planá / České Budějovice | EVOLVEO Range Finder 1K, hunting/target rangefinder | 905 nm, 5–1000 m | Medium-low |
| FOMEI s.r.o. | Hradec Králové / Prague | Danubia DJE 600 rangefinder sold under the FOMEI portfolio | 905 nm | Low–medium |

1. ARCHER-LPP — strongest match

ARCHER-LPP is probably the most interesting Czech company I found for your purpose.

Its Archer TSA-7 thermal sight has an integrated laser rangefinder specified at 1550 nm, with a maximum measured distance of 5,000 m and ±1 m accuracy.
[source: Archer-LPP]

Its Archer MSB-8 multisensor binocular likewise incorporates a compact 1550 nm LRF, together with thermal imaging, a digital day channel, GPS and magnetic compass.
[source: Archer-LPP]

Interestingly, Archer's NCN-LR night-vision clip-on is designed to work with a modular 905 nm rangefinder, measuring to 2,000 m.
[source: Archer-LPP]

The company gives its addresses as Dělnická 475, Pardubice and headquarters in Prague.
[source: Archer-LPP]

Confidence: very high that Archer uses 905/1550 nm laser rangefinder subsystems in its products.
The only qualification is that I did not find a public Archer document explicitly saying "pulsed laser diode" rather than simply specifying the LRF wavelength.

2. SEFOR Solutions — very strong

SEFOR Solutions makes professional electro-optical equipment in Prague.

Its MSBi multispectral binocular explicitly specifies:

- laser rangefinder
- 905/1550 nm
- range up to 8 km
- thermal + low-light cameras
- GPS/GLONASS
- compass
- military/security applications including reconnaissance, surveillance, border patrol and targeting.
[source: SEFOR Solutions +1]

SEFOR lists its headquarters at V Pláni 58/32, Prague 4 – Lhotka.
[source: SEFOR Solutions]

Confidence: high.

Again, the public specification confirms the wavelength and LRF, but not the exact semiconductor transmitter construction. Given the application and ToF LRF architecture, a pulsed semiconductor laser is the likely implementation, but I would not mark the PLD part as independently confirmed.

3. OptiDynex / Night Pearl — interesting potential customer

Night Pearl / OptiDynex is based in Bystřice pod Hostýnem. OptiDynex operates the Night Pearl European operation and lists its production/management facility there.
[source: Night Pearl +1]

A Night Pearl FOX 35 ELITE II LRF thermal sight has an integrated laser rangefinder specified as:

- 905 nm
- up to 1,000 m
- ±1 m accuracy.
[source: Oxepower]

There is additional evidence that the Czech company develops/manufactures its own and OEM night-vision/thermal products under the Night Pearl brand.
[source: Future Forces 2026]

Confidence: medium.

The important caveat is that I have not found documentation identifying the actual 905 nm emitter as a PLD. It could well be a conventional pulsed semiconductor LRF module supplied by an Asian OEM.

4. Abacus Electric / EVOLVEO

EVOLVEO sells the EVOLVEO Range Finder 1K, a hunting/ranging instrument with:

- 5–1,000 m range
- ±0.5 m accuracy
- speed/angle/height measurement
- 905 nm laser
- Class 1 eye-safe specification.
[source: EVOLVEO.cz]

The brand belongs to Abacus Electric, whose registered address is Planá 2, 370 01 Planá, near České Budějovice.
[source: EVOLVEO.cz]

Confidence: medium-low for PLD specifically.

There is good evidence that the product uses 905 nm laser ranging, but not that Abacus designed the optical subsystem or that the source is specifically a PLD. In fact, this looks more like an OEM product than an internally developed laser system.

5. FOMEI

FOMEI is a Czech optics company headquartered in Prague with its main operational site in Hradec Králové.
[source: Fomei +1]

The Danubia DJE 600 rangefinder in the FOMEI portfolio is documented as using a 905 nm laser.
[source: Šubrt Myśliwski +1]

Confidence: low–medium.

I would treat FOMEI as a possible commercial/OEM lead rather than a confirmed Czech PLD user. The available evidence establishes the 905 nm rangefinder but not the PLD architecture or Czech development/manufacturing of the optical module.

One additional company worth watching: Astrum LT

Astrum LT in Kralupy nad Vltavou is particularly interesting from the supplier rather than end-product perspective.

It operates a semiconductor-laser production facility in Czechia and works with EEL and VCSEL laser diodes, including custom wavelength semiconductor lasers. It explicitly mentions 3D sensing and LiDAR among the application areas.
[source: Astrum LT +1]

It also makes high-current pulsed laser-diode drivers, including a 300 A / 150 V driver with <25 µs rise/fall time.
[source: Astrum LT]

However, I would not count Astrum LT as a confirmed 905/1550-nm PLD supplier based on the public material I found. Its published semiconductor portfolio does not give me enough evidence to make that wavelength-specific connection.

Bottom line

For a target list of Czech companies potentially buying or integrating 905/1550-nm PLDs, I would prioritize:

- ARCHER-LPP — very strong
- SEFOR Solutions — strong
- OptiDynex / Night Pearl — plausible
- FOMEI — possible OEM/portfolio lead
- Abacus / EVOLVEO — possible OEM/portfolio lead

I found no solid public evidence of a Czech-made proximity fuze using a 905/1550 nm PLD. The Czech market appears substantially more concentrated around military observation/targeting systems, thermal sights, binoculars and standalone LRFs.

A useful next step would be to go one level deeper and identify the actual PLD/module suppliers inside these Czech products (e.g. Excelitas, ams OSRAM, Hamamatsu, Laser Components, ROHM, etc.) and, where possible, the exact diode/module part number. That would give a much stronger indication of which Czech companies are genuine PLD customers rather than simply resellers of complete Chinese LRFs.
