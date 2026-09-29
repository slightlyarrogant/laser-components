# ChatGPT WITH LC Connect, Q1 (Poland)

- Start (sent): 2026-09-29 15:51:18 CEST
- Completed: UI label "Przetwarzano przez 37s" (processed for 37 s); stop button gone by ~15:52:15 CEST → response time ~37 s (UI) / <60 s wall clock
- Model label in UI: "Myślenie" (Thinking) mode; account plan "Bezpłatny" (Free)
- Connector state: app "LC Connector" selected as a chip in the composer before sending — see chatgpt-with-Q1-connectors.jpg (chip) and chatgpt-with-Q1-connectors-menu.jpg ("+" menu listing "LC Connector"). Note: in ChatGPT the app is named **"LC Connector"**, not "LC Connect". No sign-in/connect prompt appeared.
- Chat URL: https://chatgpt.com/c/6abbc246-c9c0-83ed-bda5-24f721cb2e1b
- Tools shown in UI: 22 "LC Connector" tool cards (each with "CSP wył."), several rendering a "Leads — search" widget (e.g. "Semicon Sp. z o.o. … Pulsed Laser Diodes at 905 nm", "Etronika Sp. z o.o. … Pulsed Laser Diodes at 1550 nm"). The answer also shows web source chips (etronika.pl, PCO S.A., ioe.wat.edu.pl), i.e. ChatGPT additionally searched the web.
- Server log proof (lc-connect/server.log, UTC, userId 12, 13:51:24–13:51:46Z): 30 tool calls = search_leads ×18 (args query+country+limit), get_leads ×4 (3× productName+country+limit, 1× limit only), enrich_lead ×8 — **all 8 enrich_lead calls failed: "PERPLEXITY_API_KEY environment variable is not set"**.
- Companies named in the answer: 9
- Note: ChatGPT refers to the source as "Łącznik Vendo" / "baza Vendo" (wrong name — the data came from LC Connector), and says the base holds 10 Polish PLD-905 leads, 5 PLD-1550 leads and 7 LiDAR leads.

## Prompt
List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; answer is in Polish)

Na podstawie danych z Łącznika Vendo i dodatkowej weryfikacji publicznie dostępnych informacji, znalazłem kilka polskich firm, dla których związek z PLD 905/1550 nm jest szczególnie mocny. Ważne: „używa PLD” i „produkuje system wykorzystujący laser impulsowy w tej długości fali” nie zawsze oznacza, że publicznie wiadomo, kto jest dostawcą samej diody.

| Firma | Miasto | PLD / zastosowanie | Pewność |
|---|---|---|---|
| Etronika Sp. z o.o. | Warszawa | 1534/1540 nm, dalmierze laserowe DL, głowice GOSK i ZIG-T2-EC; zastosowania wojskowe, kierowanie ogniem | Bardzo wysoka |
| PCO S.A. | Warszawa | ~1,54 µm, laserowe dalmierze w głowicach optoelektronicznych GOD-1; systemy obserwacyjne i kierowania ogniem | Wysoka |
| Instytut Optoelektroniki WAT | Warszawa | 1550 nm, badania i rozwój dalmierzy laserowych, systemów laserowych i wojskowych sensorów optoelektronicznych | Wysoka |
| Zakłady Mechaniczne Tarnów S.A. | Tarnów | 905 nm, dalmierze laserowe w systemach uzbrojenia i systemach anty-UAV | Wysoka |
| Mesko S.A. | Skarżysko-Kamienna | 905 nm, zastosowania w optoelektronice, zapalnikach zbliżeniowych i systemach naprowadzania | Średnia–wysoka |
| Huta Stalowa Wola S.A. | Stalowa Wola | 1550 nm, integracja głowic optoelektronicznych z dalmierzami laserowymi, m.in. ZSSW-30 | Średnia–wysoka |
| WB Electronics / WB Group | Ożarów Mazowiecki | 1550 nm, systemy kierowania ogniem i głowice optoelektroniczne z dalmierzami; również UAV | Średnia–wysoka |
| Wojskowy Instytut Techniczny Uzbrojenia (WITU) | Zielonka | 905 nm, R&D w zakresie laserowych systemów szkoleniowych, optoelektroniki i uzbrojenia | Średnia |
| Semicon Sp. z o.o. | Warszawa | 905 nm, producent/integrator modułów laserowych; potencjalne zastosowanie diod 905 nm w modułach NIR/dalmierzach | Średnia |

Najmocniejszy przypadek: Etronika

Tutaj mamy praktycznie bezpośrednie potwierdzenie produktu. Etronika podaje, że jej dalmierze DL są impulsowymi dalmierzami TOF, z nadajnikiem opartym o diodowo pompowany laser o długości fali 1534 nm, pracującym do 10 Hz, oraz detektorem InGaAs APD.
[source: etronika.pl]

Jeszcze mocniejsze jest potwierdzenie dla głowic GOSK i ZIG-T2-EC: oba systemy mają dalmierz 1,54 µm, a ZIG-T2-EC podaje 10 Hz i zasięg >5 km.
[source: etronika.pl +1]
Etronika ma zakład produkcyjny w Warszawie.
[source: etronika.pl]

Zastrzeżenie: technicznie nie jest to dowód, że źródłem jest bezpośrednio PLD 1534/1550 nm — Etronika określa nadajnik jako diode-pumped solid-state laser. Czyli system wykorzystuje laser pompowany diodą, ale niekoniecznie samą pulsed laser diode jako źródło promieniowania. To istotna różnica przy poszukiwaniu odbiorców konkretnie dla PLD.

PCO

PCO oficjalnie podaje, że głowica GOD-1 zawiera laserowy dalmierz i jest stosowana w systemach wykrywania, obserwacji, śledzenia i celowania; głowica jest integrowana m.in. z wieżami dla Rosomaka i Borsuka.
[source: PCO S.A. +1]

Baza Vendo identyfikuje PCO jako odbiorcę PLD 1550 nm, z zastosowaniem w dalmierzach. Tu oceniłbym wysoką pewność co do użytkowania technologii 1,5 µm, ale nieco niższą co do tego, że konkretnym źródłem jest pulsed laser diode zamiast innego lasera pompowanego diodowo.

WAT

IOE WAT ma bardzo długą historię budowy wojskowych dalmierzy laserowych i systemów kierowania ogniem. Oficjalne materiały WAT wymieniają m.in. dalmierze laserowe, systemy ostrzegania laserowego i systemy kierowania ogniem; późniejsze prace obejmują również wojskowe sensory optoelektroniczne.
[source: ioe.wat.edu.pl +1]

W bazie Łącznika jest bezpośredni lead na PLD 1550 nm, opisujący WAT jako odbiorcę R&D dla dalmierzy i innych systemów optoelektronicznych. Dlatego jest to bardzo interesujący klient R&D, nawet jeśli nie jest to producent seryjnego urządzenia.

905 nm — najciekawsze firmy

ZMT Tarnów jest szczególnie interesujący, ponieważ baza łączy go bezpośrednio z PLD 905 nm i zastosowaniem w laserowych dalmierzach oraz systemach anty-UAV. To bardziej bezpośredni trop niż firmy, które jedynie integrują gotowe głowice optoelektroniczne.

Mesko jest drugim interesującym kandydatem: baza wskazuje 905 nm, zapalniki zbliżeniowe z czujnikami optoelektronicznymi oraz laserowe systemy naprowadzania. Tutaj jednak publiczne informacje nie pozwalają mi potwierdzić, że aktualnie stosowany element nadajnika jest konkretnie PLD 905 nm — dlatego nie daję „bardzo wysokiej” pewności.

Kogo potraktowałbym jako najbardziej prawdopodobnych odbiorców PLD

Jeżeli celem jest sprzedaż samych pulsed laser diodes, a nie ogólnie komponentów optoelektronicznych, rozdzieliłbym rynek tak:

Bezpośredni / bardzo mocny trop

1. Etronika — 1534/1550 nm, dalmierze.
2. IOE WAT — R&D, dalmierze i systemy laserowe.
3. ZMT Tarnów — 905 nm, dalmierze/systemy anty-UAV.
4. Mesko — 905 nm, zastosowania wojskowe i zapalniki zbliżeniowe.

Mocni integratorzy systemów
5. PCO — ~1,54 µm, głowice optoelektroniczne.
6. HSW — integracja systemów z dalmierzami.
7. WB Group — systemy kierowania ogniem/UAV/optoelektronika.
8. WITU — R&D i testowanie technologii.

Potencjalni odbiorcy komponentów, ale nie potwierdzone użycie PLD w produkcie
9. Semicon — 905 nm, moduły laserowe.

Najważniejsza obserwacja jest taka, że Polska ma wyraźny klaster 1,5 µm w wojskowej optoelektronice, szczególnie Warszawa/WAT–PCO–Etronika, natomiast 905 nm pojawia się mocniej po stronie zastosowań laserowych, szkoleniowych, pomiarowych i uzbrojenia.

W bazie Łącznika znalazłem 10 polskich leadów związanych z PLD 905 nm i 5 związanych z PLD 1550 nm; osobno jest 7 leadów dotyczących LiDAR. Nie wszystkie z nich są jednak rzeczywistymi użytkownikami PLD — część to potencjalni nabywcy lub integratorzy.
