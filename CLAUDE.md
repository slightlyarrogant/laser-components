# CLAUDE.md — Laser Components / LC Connect

## Projekt
LC Connect (`lc-connect/`) to zdalny serwer MCP dla Laser Components: baza leadów (PostgreSQL) jako narzędzia, widgety i zasoby w Claude.ai i ChatGPT, z własnym OAuth, Streamable HTTP pod `/mcp` i stroną `/demo`. Szczegóły w `lc-connect/README.md` i `lc-connect/docs/`. Stroną projektu jest **AutoOffice sp. z o.o.** (NDA Photona–AutoOffice z 5.10.2026). Umowy z Laser Components jeszcze nie ma.

## Cel na teraz: DEMO / MVP (listopad 2026)
Pierwszy krok to przetestować obecny konektor, a potem przebudować go do poziomu demo, czyli MVP, które obroni się na spotkaniach z firmami w Monachium (XI/XII 2026). Demo ma działać na żywo, bez wpadek, na prawdziwych lub zanonimizowanych danych, w Claude.ai i ChatGPT.

## Umowa o dzieło: dokładna ewidencja pracy (obowiązkowo)
Ta praca to **umowa o dzieło Bogdan Czarnecki → AutoOffice**: „wersja demonstracyjna konektora LC Connect”, okres od X do XI 2026, odbiór i wypłata w listopadzie. Zasady: docs/active/STRATEGIA_WYNAGRODZENIE_Q4_2026.md w repo iKrystyna. Dzieło trzeba udowodnić rezultatem i twórczym wkładem Bogdana, dlatego:

- **Commity przypisane do dzieła.** Każdy commit dotyczący demo ma w treści `[dzieło LC-DEMO]`. Treść commita mówi, co powstało i dlaczego, a nie tylko „fix”. Commituj małymi, sensownymi krokami, nigdy sztucznie i nigdy nie dziel jednej zmiany na kilka commitów dla liczby. Liczy się treść, nie liczba commitów.
- **Dziennik czasu.** Dopisuj wpis do `lc-connect/docs/dzielo-lc-demo/DZIENNIK.md` po każdej sesji: data, godziny od–do, co zrobiono, jakie decyzje podjął Bogdan (wybór rozwiązań, odrzucone warianty, kierunek). Te decyzje są dowodem jego twórczego wkładu przy pracy z AI.
- **Testy.** Każda funkcja demo ma test albo scenariusz w `lc-connect/tests/`. Wyniki prób konektora, zanim zaczniemy przebudowę, zapisz w `lc-connect/docs/dzielo-lc-demo/PROBY.md`.
- **Kryteria odbioru.** Na początku dzieła spisz je w `lc-connect/docs/dzielo-lc-demo/ODBIOR.md`: konkretnie, co demo pokazuje i po czym poznać, że działa. Protokół odbioru powstaje z tego pliku i z dziennika.
- **Tylko nowa praca.** Do dzieła wchodzi wyłącznie praca od dnia podpisania umowy. Utrzymanie i poprawki istniejących rzeczy nie są dziełem: oznaczaj je w commitach `[utrzymanie]`.
