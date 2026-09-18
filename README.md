# Opticutter 1D

Lokalna aplikacja po polsku do planowania cięcia sztang, profili, rur i drewna na długość.

## Uruchomienie

Wymagany Node.js 22.13 lub nowszy.

```sh
npm install
npm run dev
```

Otwórz adres wypisany w terminalu (domyślnie http://localhost:3000).

```sh
npm test
npm run build
```

## Praca z aplikacją

1. Na start dostępne są domyślne przekroje: profile 40 × 40 × 2, 40 × 20 × 2, 20 × 20 × 2, 20 × 20 × 1,5 oraz płaskowniki 40 × 2 i 80 × 5. W Magazynie możesz też dodać własny rodzaj, przekrój i długość handlową do zakupów.
2. Wprowadź pełne materiały i pozostałości, podając długość oraz ilość.
3. W zakładce Odcinki wybierz materiał listy cięcia. Każdy materiał ma osobną listę; zmiana wyboru zachowuje pozostałe listy. Wpisz długość, naciśnij Tab, wpisz ilość i Enter. Po dodaniu kursor wraca na pustą długość, ilość wraca do 1, a materiał pozostaje wybrany. Ustaw rzaz i minimalną zachowywaną pozostałość.
4. Oblicz plan. Sprawdź diagramy i listę zakupów; można wydrukować plan.
5. Po rzeczywistym wykonaniu zatwierdź plan. Zakupy trzeba oznaczyć jako dostępne. Aplikacja odejmie zużyte zapasy, doda pozostałości i wyczyści tylko listę cięcia tego materiału.

Długość, ilość i opis można edytować bezpośrednio w tabeli. Enter lub „Zastosuj” zapisuje wiersz; Enter przenosi fokus do następnego wiersza, a w ostatnim — do dodawania. Esc cofa niezapisane zmiany wiersza. Obliczenie planu zapisuje i uwzględnia poprawne edycje bieżącej listy. Zmiany należy zatwierdzić przed odświeżeniem strony.

## Zapis i ograniczenia

- Dane są trwale zapisywane w localStorage tej przeglądarki i tego adresu. Nie są współdzielone między urządzeniami. Usunięcie danych przeglądarki je kasuje. Eksport JSON i import służą do kopii zapasowych oraz przenoszenia danych.
- Brak zewnętrznej publikacji, kont użytkowników i usług chmurowych. Nie traktować jako magazynu do równoczesnej pracy wielu osób. Zmiana danych w innej karcie unieważnia plan.
- Heurystyka best-fit decreasing: najdłuższe odcinki najpierw, otwarte zapasy i najmniejszy odpowiedni zapas przed zakupem. Bez gwarancji globalnie minimalnego odpadu/liczby zakupów.
- Materiały łączą się wyłącznie w ramach identycznego identyfikatora rodzaju i przekroju. Każdy materiał ma jedną długość zakupu.
- Dokładność 0,1 mm, maks. 10 000 zamawianych odcinków. Obliczenia na całkowitych dziesiątych mm. Rzaz naliczany za każde odcięcie; przy dokładnym wykorzystaniu końca sztangi ostatni odcinek nie wymaga cięcia. Bez dodatkowego wyrównania końców.
- Próg pozostałości obejmuje wartość równą progowi. Zerowy odpad nie trafia do magazynu.
- Stare pliki i zapisane dane są odczytywane bez zmiany identyfikatorów i bez kasowania rekordów: listy grupują dotychczasowe odcinki po materialId.
- Zatwierdzenie obejmuje cały plan jednej wybranej listy. Odcinki bez dopasowania blokują zatwierdzenie.
- Opcjonalny odczyt WebMCP `read_cutting_plan` jest rejestrowany tylko w obsługujących go przeglądarkach. Zweryfikowano odczyt bieżącej listy i odrzucenie nieprawidłowego argumentu w przeglądarce.

Testy obejmują także zachowanie starszych danych i ukończenie jednej listy bez zmiany innych list. Testy w przeglądarce opisano w UI-TESTS.md. Import XLSX/Excel pozostaje przyszłym etapem; obecny import obsługuje kopie JSON.

Testy obejmują rzaz, dopasowanie, priorytet zapasów, oddzielenie przekrojów, braki, zakupy, odrzucanie starych planów, aktualizację magazynu i bilans długości w 100 wariantach.

## Archiwum i wydruk dla operatora piły

- Zapis jest dostępny wyłącznie przy obliczonym, kompletnym i aktualnym planie. W Wyniku podaj opcjonalną nazwę i wybierz **Zapisz plan**. Ponowny zapis tego samego planu aktualizuje wpis. Nie można zapisywać ani drukować nowych nieprzeliczonych list. Starsze dokumenty pozostają dostępne. Robocze odcinki są nadal automatycznie zachowywane w przeglądarce, aby nie utracić pracy.
- Zakładka **Zapisane plany** pokazuje datę, materiał, rodzaj dokumentu oraz liczbę sztuk. **Otwórz / drukuj** otwiera zapisaną kopię, także po odświeżeniu aplikacji.
- **Drukuj plan** otwiera dokument bez konieczności zapisywania go w archiwum. Dalej wybierz **Drukuj / zapisz PDF**. Ustaw A4, pionowo, 100% i wyłącz nagłówki/stopki przeglądarki. W przeglądarce wbudowanej w aplikację, która nie udostępnia systemowego okna drukowania, wybierz **Pobierz wydruk HTML**, otwórz pobrany plik w zwykłej przeglądarce i użyj Ctrl/Cmd+P. Plik zawiera kompletny dokument i nie wymaga przenoszenia magazynu.
- Wydruk zawiera wyłącznie tabelę: materiał i przekrój, długości, ilości, opis i miejsce na oznaczenie wykonania. Plan dodatkowo pokazuje numer i długość sztangi, kolejność cięć oraz końcową pozostałość. Sąsiadujące identyczne odcinki są zgrupowane ilościowo bez zmiany kolejności. Bez diagramów i interfejsu aplikacji.
- Archiwum przechowuje niezależne kopie materiału, odcinków, ustawień i kolejności cięcia. Późniejsza edycja listy, usunięcie materiału lub zatwierdzenie wykonania nie zmienia zapisanych dokumentów. Archiwalnego dokumentu nie można zatwierdzić jako planu do wykonania.
- Sam zapis, odczyt i druk nie zmieniają zapasów. Archiwum jest częścią eksportu/importu JSON; starsze kopie bez archiwum nadal działają. Pamięć przeglądarki jest ograniczona; nieudany zapis jest sygnalizowany, a wcześniejsze dane pozostają zapisane.
- Stara historia zawierała jedynie statystyki. Nie da się z niej odtworzyć dawnych długości; nowe pełne dokumenty powstają przez przyciski zapisu.

Weryfikacja szablonów: `node scripts/print-fixtures.mjs` tworzy HTML listy 75 pozycji i planu w `tmp/pdfs/`. Ten sam renderer HTML jest używany w podglądzie i wydruku aplikacji.
