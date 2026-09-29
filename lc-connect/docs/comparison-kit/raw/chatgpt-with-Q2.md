# ChatGPT WITH LC Connect, Q2 (Czech Republic)

- Start (sent): 2026-09-29 15:53:42 CEST
- Completed: UI label "Przetwarzano przez 32s" (processed for 32 s); stop button gone by ~15:54:40 CEST → response time ~32 s (UI) / <60 s wall clock
- Model label in UI: "Myślenie" (Thinking) mode; account plan "Bezpłatny" (Free)
- Connector state: app "LC Connector" selected as a chip in the composer — see chatgpt-with-Q2-connectors.jpg (chip) and chatgpt-with-Q2-connectors-menu.jpg ("+" menu). No sign-in/connect prompt appeared.
- Chat URL: https://chatgpt.com/c/6abbc2d7-39cc-83eb-a83c-ce8ecc8a1d72
- Tools shown in UI: 17 "LC Connector" tool cards ("CSP wył."); the first renders a "Regions" widget (42 of 42 records, get_regions). Status line during thinking: "Ocena potencjalnych leadów". No web source chips this time.
- Server log proof (lc-connect/server.log, UTC, userId 12, 13:53:48–13:54:08Z): 30 tool calls = search_leads ×14, enrich_lead ×13, get_leads ×2, get_regions ×1 — **all 13 enrich_lead calls failed: "PERPLEXITY_API_KEY environment variable is not set"** (ChatGPT reports this in the answer).
- Companies named in the answer: 14
- Note: ChatGPT again calls the source "Łącznik Vendo" (wrong name).

## Prompt
List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.

## Answer (verbatim, from page text; answer is in Polish)

W Łączniku Vendo znalazłem 14 czeskich leadów związanych z PLD 905 nm oraz brak leadów dla 1550 nm. Ważne: są to przede wszystkim prospekty zidentyfikowane jako potencjalni odbiorcy, a nie dowód, że dana firma faktycznie montuje konkretną PLD w seryjnym produkcie.

| Firma | Miasto | Produkt / zastosowanie | Pewność |
|---|---|---|---|
| EVPU Defence a.s. | Uherské Hradiště | Wojskowe elektrooptyczne systemy celownicze; laser rangefinders (LRF), 50 m–32 km | Wysoka |
| Meopta – optika s.r.o. | Přerov | Optyka wojskowa, systemy celownicze i dalmierze laserowe | Wysoka/średnia |
| Argotech a.s. | Náchod | LiDAR sensors, montaż laser diodes/photodiodes, fotonika półprzewodnikowa | Wysoka dla LiDAR; średnia dla 905 nm |
| Primoco UAV SE | Prague | UAV; systemy obserwacyjne/detekcyjne, potencjalne wykorzystanie 905-nm PLD | Średnia |
| Elya Solutions s.r.o. | Prague | Optyka/optomechanika dla zastosowań obronnych; potencjalne systemy ranging | Średnia |
| Aero Vodochody Aerospace a.s. | Odolena Voda | Aerospace/defense; potencjalne systemy laserowego pomiaru odległości | Niska–średnia |
| Tatra Defence Vehicle a.s. | Kopřivnice | Pojazdy opancerzone; potencjalne systemy celownicze/rangefinding | Niska–średnia |
| Excalibur Army spol. s r.o. | Přelouč | Pojazdy opancerzone i systemy wojskowe; potencjalne LRF | Niska–średnia |
| Saab Czech Republic – Training Systems | Prague | Wojskowe systemy treningowe / symulacja laserowa | Średnia |
| Ray Service a.s. | Žamberk | Elektronika/wiązki dla obronności; integracja podzespołów | Niska |
| Lightigo s.r.o. | Prague | Laser spectroscopy / measurement | Niska–średnia |
| LASER-TECH spol. s r.o. | Prague | Przemysłowe systemy laserowe | Niska |
| SQS Vláknová optika a.s. | Nová Paka | Systemy laserowe, sterowniki diod laserowych i integracja optyczna | Średnia |
| Frentech Aerospace s.r.o. | Brno | Produkcja precyzyjna dla systemów optycznych/aerospace/defense | Niska |

Najciekawsze pozycje

Jeżeli celem jest realny prospecting dla PLD 905 nm, z danych Łącznika szczególnie wyróżniają się:

1. EVPU Defence — opis w bazie mówi wprost o produkcji wojskowych laser rangefinder modules, więc zastosowanie jest bardzo bliskie typowemu zastosowaniu PLD.
2. Meopta — producent wojskowej optyki i systemów celowniczych, zidentyfikowany w bazie również z tagiem rangefinder.
3. Argotech — najbardziej bezpośrednie powiązanie z LiDAR: firma wykonuje die-bonding/wire-bonding/flip-chip dla laser diodes i photodiodes i jest wskazana jako integrator modułów LiDAR.
4. Primoco UAV — interesujący ze względu na UAV i zastosowania detekcyjne, ale w bazie nie ma konkretnego potwierdzenia, że PLD 905 nm znajduje się w produkcie.
5. Elya Solutions — obronna optomechanika, potencjalnie blisko systemów laserowego pomiaru odległości.

Istotne zastrzeżenie: w bazie Łącznika nie ma obecnie czeskich leadów oznaczonych 1550 nm. Dla 905 nm jest 14 rekordów, ale część z nich to klasyczne leady prospectingowe, więc nie traktowałbym ich jako potwierdzonych użytkowników PLD bez dodatkowej weryfikacji produktu.

Próba automatycznego wzbogacenia tych firm o dane techniczne zewnętrzne nie powiodła się, ponieważ usługa enrichment w Łączniku nie ma obecnie skonfigurowanego klucza Perplexity. Zatem powyższa ocena opiera się na danych zapisanych w Łączniku i nie udaję, że zweryfikowałem ją z aktualnymi stronami producentów.
