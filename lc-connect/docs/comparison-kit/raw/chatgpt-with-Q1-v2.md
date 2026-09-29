# ChatGPT WITH LC Connect, Q1 (Poland) — v2, after custom-instruction change

- Start (sent): 2026-09-29 ~22:43:38 CEST (clock read 22:43:40 right after Enter)
- Completed: UI label "Przetwarzano przez 9s" (processed for 9 s); complete by ~22:44:15 CEST
- Model label in UI: "Myślenie" (Thinking) chip; account "viper73", plan "Bezpłatny" (Free)
- Connector state: "LC Connector" chosen from the "+" menu and shown as a chip in the composer — see chatgpt-with-Q1-v2-connectors-menu.jpg and chatgpt-with-Q1-v2-connectors.jpg. No connect/sign-in prompt appeared.
- Chat URL: https://chatgpt.com/c/6abc22ed-3aa4-83eb-82a9-bd300a555dbf
- Tools shown in UI: 22 "Opened Search leads" cards (each "CSP wył."), several rendering "Leads — search" widgets (e.g. 10-row 905 nm list, 5-row 1550 nm list, 9-row list incl. Inframet/PIT-RADWAR/PCO, single-row WITU/Perspectiva/CTL checks). Answer ends "Narzędzie użyte: LC Connect (search_leads)."
- Web search: no (no source chips; cities marked * are "from the name/publicly known location", not from a search)
- Server log (UTC, userId 12, IP 150.228.91.136, 20:43:43–20:43:49Z): 22 tool calls = search_leads ×22 (20× query+country+limit, 2× country+productName+limit) — all "ok". No enrich_lead calls.
- Data source named as: "LC Connect"
- Language: answered in Polish although the prompt was English.
- Companies named: 16 (the intro says 15) — all 16 in the LC Poland list (25); 12 of the 16 PLD-linked leads (missing Solaris Optics, FIBRAIN, Fluence Technology, TopGaN); the other 4 (PIT-RADWAR, PCO, CRW Telesystem-Mesko, LiDAR3D) are LiDAR-linked leads, marked "nieokreślone" (unspecified) wavelength.

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; answer is in Polish)

Na podstawie LC Connect znalazłem 15 polskich leadów bezpośrednio powiązanych z PLD 905/1550 nm lub LiDAR/rangefinder. LC Connect nie zawiera jednak lokalizacji ani szczegółowego opisu konkretnego produktu dla większości z nich, więc nie będę tego uzupełniał jako danych z bazy.

| Firma | Miasto | Produkt / zastosowanie | PLD | Pewność |
|---|---|---|---|---|
| Semicon Sp. z o.o. | brak w LC | moduły laserowe | 905 nm | wysoka |
| WITU | brak w LC | obronność / systemy wykorzystujące PLD | 905 nm | wysoka |
| Perspectiva Solutions | brak w LC | fotonika / moduły laserowe | 905 nm | wysoka |
| CTL Laserinstruments | brak w LC | lasery medyczne i przemysłowe | 905 nm | wysoka |
| OEM Tech | brak w LC | elektronika laserowa | 905 nm | wysoka |
| Zakłady Mechaniczne Tarnów (ZMT) | Tarnów* | systemy uzbrojenia, prawdopodobnie dalmierze | 905 nm | wysoka |
| Autocomp Management | brak w LC | symulatory wojskowe | 905 nm | średnia–wysoka |
| Mesko S.A. | brak w LC | amunicja / systemy rakietowe, zastosowania zapalników/proximity | 905 nm | wysoka |
| Instytut Optoelektroniki WAT | Warszawa* | obronność, dalmierze / optoelektronika | 1550 nm | wysoka |
| Huta Stalowa Wola (HSW) | Stalowa Wola* | wieże i systemy pojazdów bojowych | 1550 nm | średnia–wysoka |
| WB Electronics / WB Group | Ożarów Mazowiecki* | elektronika obronna, systemy obserwacyjne/LiDAR | 1550 nm | wysoka |
| Etronika | brak w LC | optoelektronika obronna | 1550 nm | wysoka |
| PIT-RADWAR | Warszawa* | LiDAR / elektronika obronna | nieokreślone | średnia |
| PCO S.A. | Warszawa* | optoelektronika obronna / LiDAR | nieokreślone | średnia |
| CRW Telesystem-Mesko | Lubicz?* | optoelektronika obronna / LiDAR | nieokreślone | średnia |
| LiDAR3D | brak w LC | LiDAR, pomiary geodezyjne/mapping | nieokreślone | średnia |

\* Miasto oznaczone gwiazdką nie pochodzi z LC Connect — jest jedynie identyfikacją siedziby firmy z nazwy/publicznie znanej lokalizacji. LC Connect samo w sobie nie ma dla tych rekordów pola location.

Najbardziej interesujące leady pod kątem rzeczywistego odbiorcy PLD

Jeżeli celem jest znalezienie firm, które potencjalnie rzeczywiście kupują PLD do swoich urządzeń, a nie tylko firm zajmujących się ogólnie laserami, z danych LC Connect szczególnie wyróżniają się:

1. WITU — 905 nm — badania i systemy obronne.
2. ZMT — 905 nm — systemy uzbrojenia.
3. Mesko — 905 nm — amunicja/systemy rakietowe; LC Connect dodatkowo wiąże ten lead z zapytaniem dotyczącym fuse.
4. Instytut Optoelektroniki WAT — 1550 nm — bezpośrednie powiązanie z PLD.
5. WB Electronics — 1550 nm — elektronika obronna.
6. HSW — 1550 nm — pojazdy i wieże.
7. Etronika — 1550 nm — optoelektronika obronna.

Narzędzie użyte: LC Connect (search_leads).

## Screenshots
- chatgpt-with-Q1-v2-connectors-menu.jpg — "+" menu with "LC Connector"
- chatgpt-with-Q1-v2-connectors.jpg — "LC Connector" chip in composer before typing
- chatgpt-with-Q1-v2.jpg — top: first "Opened Search leads" card + widget (10 records)
- chatgpt-with-Q1-v2-end.jpg — end of answer (last table rows, top-leads list, tool used)
