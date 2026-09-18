# Weryfikacja interfejsu — 10.09.2026

Testy wykonano w działającej przeglądarce na localhost:3000 przez dostępnościowy interfejs CUA oraz lokatory Playwright. Nie są to tylko testy źródeł ani samego planera.

## Odtworzony błąd

Po wybraniu materiału i wpisaniu 777 mm kliknięcie „Dodaj” w zamówieniu oraz magazynie nie tworzyło rekordu. Odczyt DOM potwierdził `type="button"` na obu przyciskach oraz „Dodaj materiał”. Komponent Base UI domyślnie nie wysyła formularza. Wszystkie trzy przyciski formularzy mają teraz jawne `type="submit"`.

## Wyniki

- Dodanie materiału Test UI 0910 / Test 20x20 przyciskiem: rekord widoczny, formularz wyczyszczony, materiał wybrany w magazynie.
- Dodanie zapasu 5000 mm × 2 przyciskiem: nowy wiersz w magazynie, materiał pozostaje wybrany.
- Przejście do listy cięcia: fokus na długości; lista dotyczy wyłącznie Test UI 0910.
- Dwa kolejne odcinki 1200 × 2 i 800 × 3 dodane klawiaturą przez długość → Tab → ilość → Enter. Po każdym Enter fokus na pustej długości, ilość zresetowana do 1, ten sam materiał.
- Osobny test po poprawce zaznaczania: 1234 → Tab → 2 → Enter, bez Ctrl/Cmd+A. Powstał odcinek 1234 × 2, nie × 12; fokus wrócił na długość.
- Bezpośrednia edycja pierwszego wiersza do 1250 × 1 i Enter: zapisane wartości, fokus na długości następnego wiersza.
- Edycja do długości 0 i Enter: błąd walidacji; Esc przywraca poprzedni poprawny wiersz.
- Edycja opisu i „Zapisz”: tekst zachowany po odświeżeniu.
- Przełączenie materiału po odświeżeniu: wcześniejsza lista stali i osobna lista testowa zachowane, bez mieszania odcinków. Po wyborze fokus na długości.
- Dodanie przyciskiem 450 mm i edycja do 500 mm bez osobnego zapisu, następnie „Oblicz plan”: plan uwzględnia 500 mm i zapisuje tę edycję.
- Plan tylko dla testowego materiału: 1250 + 800 + 800 + 800 + 500, jedna sztanga 5000 mm, 15 mm rzazu, 835 mm pozostałości, zero zakupów.
- Odczyt WebMCP read_cutting_plan zwraca ten sam zakres i bilans; niepoprawny argument jest odrzucany.
- Konsola po testach: brak błędów aplikacji.
- Wcześniejsze dane magazynu i listy zostały zachowane. Wprowadzane do testów rekordy usunięto po kontroli.

Testy jednostkowe (npm test) obejmują osobno ukończenie planu jednej listy bez zmiany innych list i ich zapasów, obsługę starych danych, rzaz, zakupy, pozostałości i odrzucanie starych planów. 15 testów zakończonych powodzeniem. Build produkcyjny również przechodzi.

## Archiwum i wydruk — 11.09.2026

- Zapisano listę „Rama — lista 10.09.2026” i odczytano po ponownym otwarciu strony następnego dnia.
- Zmieniono bieżący odcinek 1200 na 1255 mm, zapisano go i odświeżono stronę. Archiwalna lista nadal pokazywała 1200 mm × 4. Następnie przywrócono bieżącą wartość 1200 mm.
- Zapisano pełny plan „Rama — plan 11.09.2026”. Po odświeżeniu odczytano identyczną kolejność: sztangi 1850, 1850, 6000 i 6000 mm; odcinki 1200 × 4 i 800 × 6. Archiwum nie ma przycisku zatwierdzenia wykonania.
- Stan zapasów pozostał 7 sztuk, w tym 2 pozostałości; zamówienie pozostało 10 odcinków. Nie wykonano rzeczywistego zlecenia podczas testu.
- Przycisk drukowania wywołuje druk dokumentu iframe; brak błędów JS. Nie wysyłano pracy do fizycznej drukarki. Wbudowana przeglądarka nie pokazała dostępnego do inspekcji systemowego dialogu; wygląd drukowanego dokumentu potwierdzono osobnym renderowaniem tego samego HTML przez Chrome.
- Zrenderowano rzeczywiste PDF-y szablonu: lista 75 pozycji = 5 stron A4, plan = 1 strona A4. Sprawdzono wizualnie wszystkie strony po konwersji Poppler do PNG. Nagłówki i materiał powtarzają się na każdej stronie, wiersze pozostają całe, polskie znaki działają, brak diagramów i elementów interfejsu. Numery stron są widoczne.
- Dodano testy niezależności kopii, zachowania archiwum po wykonaniu, zakazu wykonania kopii, JSON round-trip ze skasowanym pierwotnym materiałem, odrzucenia uszkodzonego archiwum i niezgodności planu z listą, escapowania tekstu wydruku i zachowania kolejności.
- Końcowy przycisk „Pobierz wydruk HTML” przetestowano w UI. Powstał samodzielny plik `wydruk-80080fbd.html` w Pobranych; sprawdzono jego nazwę dokumentu, wartości 1200 i 800 mm, format A4 i brak skryptów/przycisków. Wbudowany mechanizm obserwacji zdarzeń pobrania nie zgłosił zdarzenia, ale plik został prawidłowo zapisany.
- Finalny stan: 22 testy jednostkowe przeszły; build po dodaniu archiwum i opcji pobrania zakończył się poprawnie. Końcowe PDF-y po korekcie kolumn obejrzano ponownie na wszystkich sześciu stronach; kolumna „Kolejność” mieści się bez łamania słowa, a obramowanie tabel jest pełne.
