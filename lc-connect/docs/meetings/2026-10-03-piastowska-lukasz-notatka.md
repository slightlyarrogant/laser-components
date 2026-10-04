# Rozmowa z Łukaszem, Piastowska, sobota 3.10.2026 (46 min)

Źródło: `2026-10-03-piastowska-transkrypt.txt` (Whisper large-v3-turbo, 4.10). Uczestnicy: Łukasz, Bogdan, chwilami Maciek.

## Co Łukasz zrozumiał i chce przekazać dalej
- "Black box": dane w jednym bezpiecznym miejscu, agent zna firmę, sięga głębiej niż czat z ulicy, bo my mu podajemy dane (strona, baza).
- Trening = codzienne użycie i korygowanie, nie wrzucanie chmary danych. Wiedza z korekt musi być gdzieś zapisana, u nich (Azure albo gdziekolwiek).
- Potrzebuje od nas: strukturę rozpisaną w punktach "ich językiem" (05:48), diagram jak działa uprząż bez zdradzania know-how (31:41), parę slajdów na poniedziałek (42:49).

## Stan po stronie Laser Components
- Alice: nowa, po studiach z AI, pytała o hardware do treningu dużych danych, czyli nie rozumie, że to uprząż, nie fine-tuning. Techniczna, nie handlowiec. Spotkania po angielsku tylko z jej powodu.
- Alex (IT/security): ocenia LC Connect dobrze, ale "black box", chce wiedzieć co jest w środku i jaka konstrukcja.
- Strategia AI firmy (z telekonferencji): Copilot dla everyone, Claude dla inżynierów, coś dla marketingu, "no private accounts", główny nacisk na bezpieczeństwo danych; szkolenia przez cały kwartał w 2027. Zarząd rozumie AI jako hasło marketingowe.
- Firma przesadza z poufnością. Produkt niszowy, konkurencja na palcach jednej ręki, o wyborze decyduje czas dostawy, jakość, cena, nie wiedza o konkurencie. Większość danych i tak jest w sieci (biały wywiad). Wyjątek: wrażliwość wojenna (Rosja).
- Szwedzi (po prezentacji Łukasza) chcą testować LC Connect. Odpowiedź Łukasza: teoretycznie możliwe, czekamy na zielone światło i formalne domknięcie.
- Łukasz tłumaczy firmie, że konektor jest na jego prywatnym koncie, ale bez danych firmowych: tylko strona www i przykłady publiczne. Zakaz wrzucania danych firmy obowiązuje.

## Argumenty do użycia u klienta (uzgodnione)
1. Nie trenujemy modelu. Budujemy uprząż (harness): narzędzia, pamięć korekt, obieg danych. Trening modelu = setki tysięcy dolarów i model stoi w miejscu po zakończeniu.
2. Uprząż jest agnostyczna: silnik (OpenAI, Anthropic, inne) wymienny; "Audi Q5 z silnikiem Trabanta pojedzie, ale".
3. Bezpieczeństwo zależy od umowy, nie od narzędzia. Subskrypcje biznesowe OpenAI i Anthropic mają zero data retention; OpenAI ma modele hostowane w Europie. "Copilot bezpieczny, ChatGPT wycieka" to mit.
4. Copilot = słabe narzędzie do pracy badawczej i gromadzenia wiedzy. Do researchu: Perplexity (ok. 100 €/mies. dla całej firmy, w pakiecie) + mocny model.
5. Konektora nie podpinać do prywatnych subskrypcji: to element bezpieczeństwa, nie wygody.
6. Dane i wiedza zostają u nich (ich Azure albo wskazane miejsce), do ich dyspozycji.
7. Nie przesadzać z klasyfikacją: "jak wszystko poufne, to nic nie jest poufne".
8. Argument adopcji: pilot niewiele kosztuje, postaw i mierz, czy ludzie podłączają i używają; rosnąca baza interakcji = narzędzie potrzebne.

## Czego Łukasz naprawdę chce (roadmapa od strony użytkownika)
- Zarządzanie bazą wiedzy: gigantyczne dane nieużywane, brak wspólnych systemów z USA, know-how w głowach ludzi.
- Łączenie kropek: klient X robi 1, klient Y robi 2, razem zrobią 3 i będą potrzebowali LC.
- Ocena skuteczności wizyt per branża z kilkunastu lat raportów + dane sprzedażowe z ERP/CRM; śledzenie osób, które zmieniają firmy i ciągną za sobą projekty.
- Przygotowanie do targów: 65 % trafności (reszta: nieobecni albo puste stoiska).
- Dobór modułu (dioda + optyka) dla klienta, czego firma dziś odmawia; w przyszłości półautomatycznie.
- Humantic (analiza osoby z ruchu w sieci): atrakcyjne, ale RODO/AI Act, nie do wdrożenia w firmie bez sprawdzenia legalności.
- Ryzyko odwrotne: analiza efektywności pokaże też menedżerów; temat delikatny, decyzja właściciela.
- Dostęp uprzęży do większości CRM/ERP w dłuższej perspektywie; cykl projektów klienta 3 lata, walidacja efektów długa.

## Pieniądze
- Łukasz: trzeba rozdzielić "mały programik do utrzymania" od "strategia, większa współpraca = inne pieniądze". Alice nie decyduje o pieniądzach.
- Bogdan: lepiej domknąć formalnie, żeby się nie ciągnęło. Łukasz: w takiej firmie to się będzie ciągnąć.

## Terminy i ustalenia
- Poniedziałek 5.10, 16:30 (wpis Bogdana, może potrwać dłużej): spotkanie z Alice, prawdopodobnie z Alexem. Łukasz naciska na krótkie spotkania.
- Bogdan przygotuje parę slajdów + diagram uprzęży; Łukasz wygeneruje własną wersję, porównają i złożą jedną.
- Piątek 9.10: Łukasz w Monachium u Alice (dwudniowa integracja), pierwsze spotkanie na żywo.
- Łukasz zaproponuje kolejne spotkanie w 2. tygodniu listopada (Monachium 10–11.11).
- Przejście na MCP 2.0, gdy Anthropic i OpenAI zaczną używać.

## Usunięte z transkryptu
- Hasło do Wi-Fi (17:32). Prywatne uwagi o osobach nie trafiają do materiałów dla klienta.
