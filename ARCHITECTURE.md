# Architektura i Funkcjonalności Aplikacji: Rodzinny Planer (v3.1.0)

Kompleksowa dokumentacja techniczna, architektoniczna oraz funkcjonalna aplikacji **Rodzinny Planer** – nowoczesnego, wieloplatformowego asystenta organizacji życia rodzinnego.

---

## 1. Przegląd Systemu (System Overview)

**Rodzinny Planer** to aplikacja internetowa (PWA) czasu rzeczywistego, zaprojektowana z myślą o ułatwieniu codziennej koordynacji obowiązków domowych, budżetu, kalendarza, planowania posiłków oraz komunikacji wewnątrz rodziny.

### Główne cele projektu:
- **Wspólna przestrzeń:** Jeden scentralizowany punkt dostępu dla wszystkich domowników (rodzice, dzieci, współlokatorzy).
- **Czas rzeczywisty (Realtime):** Natychmiastowa synchronizacja zmian między urządzeniami wszystkich członków rodziny.
- **Wieloplatformowość (PWA & Web Push):** Działa na telefonach z systemem Android, iOS oraz komputerach stacjonarnych z obsługą powiadomień w tle.
- **Prywatność i bezpieczeństwo:** Dedykowana izolacja danych rodzinnych z wykorzystaniem Row Level Security (RLS) w PostgreSQL/Supabase.

---

## 2. Architektura Technologiczna (Tech Stack)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Vite)                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│   │  TailwindCSS │  │ Lucide Icons │  │  PWA / SW.js │  │ Logger API │ │
│   └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTPS / WSS (WebSockets)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND & BAZA (Supabase)                       │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      Supabase Auth (JWT)                       │   │
│   └────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────┐           ┌──────────────────────────┐   │
│   │  PostgreSQL (RLS, JSON) │ ◄───────► │  Realtime Engine (WS)    │   │
│   └─────────────────────────┘           └──────────────────────────┘   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │         Supabase Edge Functions (Deno + web-push VAPID)        │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Web Push Protocol
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    URZĄDZENIA KOŃCOWE (Android / iOS)                  │
│       Powiadomienia Push w tle, Badges, Dźwięki i Wibracje             │
└────────────────────────────────────────────────────────────────────────┘
```

### Stos technologiczny:
- **Warstwa UI:** React 18, Vite, Tailwind CSS (estetyka *Dark Obsidian* z akcentami Amber i Emerald), Lucide React.
- **Zarządzanie stanem:** React Hooks (`useMemo`, `useCallback`, `useReducer`), lokalny bufor stanu z automatyczną synchronizacją do bazy danych.
- **Baza danych i uwierzytelnianie:** Supabase (PostgreSQL 15+, Supabase Auth, Realtime Postgres Changes).
- **Mechanizm Push:** Service Worker (`public/sw.js`), Web Push API z kluczami kryptograficznymi **VAPID P-256 (NIST prime256v1)**.
- **Funkcje Serverless:** Supabase Edge Functions (`supabase_edge_function_send_push.ts`) w środowisku Deno.

---

## 3. Schemat Bazy Danych i Model Danych

Struktura bazy danych opiera się na separacji grup rodzinnych i bezpiecznym dostępie przez mechanizm RLS:

### 1. `families`
Główna tabela reprezentująca gospodarstwo domowe / grupę rodzinną.
- `id` (UUID, Primary Key)
- `name` (TEXT) – nazwa rodziny (np. *„Rodzina Kowalskich”*)
- `join_code` (TEXT, UNIQUE) – 6-znakowy unikalny kod dołączania nowych członków
- `created_at` (TIMESTAMPTZ)
- `created_by` (UUID) – identyfikator założyciela rodziny

### 2. `family_members`
Relacja łącząca konto użytkownika (`auth.users`) z rodziną.
- `id` (UUID, Primary Key)
- `family_id` (UUID, Foreign Key do `families.id`)
- `user_id` (UUID, Foreign Key do `auth.users.id`)
- `role` (TEXT) – rola w rodzinie (`owner`, `parent`, `child`, `member`)
- `person_id` (TEXT) – przypisany profil fizycznego członka rodziny
- `joined_at` (TIMESTAMPTZ)

### 3. `family_data`
Struktura dokumentowa przechowująca stan modułów operacyjnych rodziny w formacie JSONB:
- `family_id` (UUID, Primary Key)
- `calendar_events` (JSONB) – tablica wydarzeń w kalendarzu
- `tasks` (JSONB) – tablica zadań i checklist
- `budget` (JSONB) – słownik budżetów miesięcznych (`YYYY-MM`) zawierający:
  - `income` (wpływy)
  - `fixedCosts` (koszty stałe)
  - `expenses` (wydatki bieżące z podziałem na kategorie)
  - `categories` (zdefiniowane limity kategorii)
- `budget_goals` (JSONB) – globalne cele oszczędnościowe i inwestycyjne
- `meal_plan` (JSONB) – plan posiłków w ujęciu tygodniowym
- `recipes` (JSONB) – książka przepisów kulinarnych
- `notes` (JSONB) – tablica notatek
- `wall_messages` (JSONB) – wpisy i wiadomości na tablicy rodzinnej
- `people` (JSONB) – lista profili domowników (imię, awatar, kolor, punkty)

### 4. `push_subscriptions`
Kolekcja aktywnych tokenów subskrypcji Web Push dla poszczególnych urządzeń:
- `id` (BIGINT / UUID, Primary Key)
- `user_id` (UUID) – użytkownik
- `family_id` (UUID) – powiązana rodzina
- `endpoint` (TEXT, UNIQUE) – unikalny endpoint dostawcy powiadomień (Google FCM, Mozilla, Apple)
- `p256dh` (TEXT) – klucz publiczny klienta
- `auth` (TEXT) – klucz autoryzacyjny
- `updated_at` (TIMESTAMPTZ)

---

## 4. Szczegółowy Opis Modułów Funkcjonalnych

### 4.1. Widok „Dzisiaj” (TodayView)
*Pulpit główny i centrum dowodzenia bieżącego dnia.*
- **Wybór aktywnego profilu:** Szybkie przełączanie kontekstu (kto w danej chwili korzysta z aplikacji).
- **Statystyki dnia:** Liczba zaplanowanych zadań, spotkań i bilans dnia.
- **Szybkie akcje:** Błyskawiczne dodawanie zadania, wydatku, wydarzenia lub notatki jednym kliknięciem.
- **Plan dnia w pigułce:** Zintegrowana oś czasu z zadaniami na dziś, nadchodzącymi wydarzeniami oraz zaplanowanym menu obiadowym.

### 4.2. Zadania i Obowiązki (TasksView)
*Zarządzanie listami to-do, podziałem obowiązków i gamifikacją.*
- **System ról i przypisań:** Możliwość przypisania zadania do konkretnej osoby lub całej rodziny.
- **Gamifikacja (Punkty i Nagrody):** Za ukończenie zadań domownicy zdobywają punkty, które zasilają ich profil.
- **Podział na kategorie:** Dom, Szkoła, Zakupy, Praca, Osobiste.
- **Filtrowanie i Sortowanie:** Po terminie wykonania, priorytecie, osobie odpowiedzialnej i statusie ukończenia.
- **Podzadania (Subtasks):** Rozbijanie złożonych czynności na mniejsze etapy z paskiem postępu.

### 4.3. Kalendarz Rodzinny (CalendarView)
*Wizualizacja harmonogramu całej rodziny w jednym miejscu.*
- **Elastyczne widoki:** Widok pełnego miesiąca, agendy tygodniowej oraz listy nadchodzących zdarzeń.
- **Kolorystyka per osoba:** Każde wydarzenie jest automatycznie oznaczane kolorem przypisanego członka rodziny.
- **Wydarzenia całodniowe i godzinowe:** Obsługa ram czasowych, lokalizacji, opisów i powiadomień przypominających.
- **Filtrowanie:** Szybkie wyodrębnienie kalendarza wybranej osoby.

### 4.4. Budżet i Finanse (BudgetView v3.1.0)
*Kompleksowe zarządzanie domowymi finansami i oszczędnościami.*
- **Podsumowanie finansowe miesiąca:**
  - Przychody, Stałe koszty, Wydatki bieżące, Bilans netto oraz wskaźnik oszczędności.
- **Kategorie wydatków z limitami:**
  - Konfigurowalne kategorie (np. Jedzenie, Rozrywka, Rachunki, Transport).
  - Paski postępu ostrzegające o zbliżaniu się lub przekroczeniu założonego limitu.
- **Cele Finansowe (Moduł Długoterminowy):**
  - Definiowanie celów kwotowych (np. *„Wakacje w Grecji” – 8 000 zł*) oraz celów otwartych/bez limitu (ze wskaźnikiem nieskończoności **∞**).
  - Globalna kumulacja oszczędności – postęp celu nie zeruje się wraz z nowym miesiącem.
  - Dedykowany przycisk *„+ Dodaj wydatek na ten cel”* ułatwiający szybkie odkładanie środków.
- **Modal transakcji z podziałem na 4 sekcje:**
  1. **Wydatek** (kategoria budżetowa, kwota, data, osoba, opis).
  2. **Stały koszt** (comiesięczne zobowiązania: kredyty, czynsz, subskrypcje).
  3. **Cele** (wpłata/wydatek przypisany do konkretnego celu finansowego).
  4. **Przychód** (pensja, premie, inne wpływy).
- **Historia i Filtrowanie Operacji:** Możliwość filtrowania transakcji według typu: *Wszystkie*, *Wydatki*, *Stałe koszty*, *Cele*, *Przychody*.

### 4.5. Planer Posiłków i Przepisy (MealsView)
*Organizacja domowej kuchni i zakupów spożywczych.*
- **Tygodniowe Menu:** Rozpiska dań na 7 dni z podziałem na Śniadanie, Drugie śniadanie, Obiad, Podwieczorek i Kolację.
- **Książka Przepisów:** Baza rodzinnych przepisów ze składnikami, czasem przygotowania i instrukcją krok po kroku.
- **Inteligentna Lista Zakupów:** Automatyczne generowanie listy zakupów na podstawie zaplanowanych posiłków i brakujących składników.

### 4.6. Tablica Rodzinna (WallView)
*Interaktywna, wirtualna tablica ogłoszeń i wspomnień.*
- **Wiadomości i notatki:** Szybkie zostawianie wiadomości dla innych domowników (jak karteczki na lodówce).
- **Emotikony i Reakcje:** Możliwość reagowania na wpisy serduszkami, kciukami w górę i komentarzami.
- **Przypinanie ogłoszeń:** Ważne komunikaty mogą być przypięte na samej górze tablicy.

### 4.7. Notatki i Dokumenty (NotesView)
*Podręczny notes na ważne informacje, kody, wymiary i pomysły.*
- **Kolorowe fiszki:** Wizualna organizacja za pomocą barwnych etykiet.
- **Formatowanie i listy kontrolne:** Tworzenie notatek tekstowych oraz list do odhaczania.
- **Wyszukiwarka:** Szybkie przeszukiwanie treści notatek i tytułów.

### 4.8. Ustawienia, Bezpieczeństwo i Powiadomienia (SettingsView)
*Centrum konfiguracji konta, rodziny i diagnostyki urządzenia.*
- **Zarządzanie profilem rodziny:** Edycja nazwy, udostępnianie kodu zaproszenia (`join_code`), zarządzanie członkami.
- **Silnik Web Push (Android / iOS / Desktop):**
  - Monitorowanie statusu uprawnień systemowych w czasie rzeczywistym (`granted`, `denied`, `default`).
  - Dedykowany przycisk *„Nadaj uprawnienia teraz / Zezwól na powiadomienia”*.
  - Synchronizacja tokenów subskrypcji z bazą danych Supabase.
  - Funkcja wysyłania testowych powiadomień przez chmurę.
- **Dziennik Zdarzeń (App Logs):** Wbudowana konsola diagnostyczna rejestrująca zdarzenia sieciowe, operacje na bazie i błędy w czasie rzeczywistym.

---

## 5. Przepływ Danych i Synchronizacja Czasu Rzeczywistego

```
[Użytkownik A wykonuje akcję (np. ukończenie zadania)]
                       │
                       ▼
         [Lokalna aktualizacja stanu w React]
                       │
                       ▼
       [Zapis do tabeli 'family_data' w Supabase]
                       │
                       ▼
       [PostgreSQL trigger / Realtime Broadcast]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[WebSocket do Użytkownika B]   [Supabase Edge Function: send-push]
         │                                   │
         ▼                                   ▼
[Natychmiastowe odświeżenie UI]   [Wysłanie powiadomienia Web Push]
                                             │
                                             ▼
                                  [Service Worker w telefonie]
                                  [Wyświetlenie powiadomienia 🔔]
```

---

## 6. Struktura Katalogów Projektu

```
rodzinny-planer/
├── public/
│   ├── favicon.svg               # Ikona aplikacji
│   ├── manifest.json             # Manifest PWA
│   └── sw.js                     # Service Worker do obsługi cache i powiadomień w tle
├── src/
│   ├── assets/                   # Pliki graficzne i ikony
│   ├── components/
│   │   ├── modals/               # Okna modalne (transakcje, zadania, cele, kategorie itp.)
│   │   │   ├── ManageGoalsModal.jsx
│   │   │   ├── TransactionModal.jsx
│   │   │   ├── AddTaskModal.jsx
│   │   │   ├── AddEventModal.jsx
│   │   │   └── ...
│   │   └── ui/                   # Komponenty atomowe (Button, ModalShell, Chip itp.)
│   ├── utils/
│   │   ├── constants.js          # Stałe kolorów, domyślne konfiguracje, kategorie
│   │   ├── dateUtils.js          # Formatery dat i kalendarza
│   │   ├── logger.js             # Rejestrator logów i diagnostyki
│   │   ├── pushService.js        # Wrapper usług powiadomień Push
│   │   └── supabaseClient.js     # Klient Supabase z obsługą sesji
│   ├── views/                    # Główne ekrany aplikacji
│   │   ├── TodayView.jsx         # Pulpit „Dzisiaj”
│   │   ├── TasksView.jsx         # Zadania i obowiązki
│   │   ├── CalendarView.jsx      # Kalendarz rodzinny
│   │   ├── BudgetView.jsx        # Budżet, finanse i cele
│   │   ├── MealsView.jsx         # Planer posiłków i przepisy
│   │   ├── WallView.jsx          # Tablica rodzinna
│   │   ├── NotesView.jsx         # Notatki
│   │   ├── SettingsView.jsx      # Ustawienia i powiadomienia
│   │   └── AuthScreen.jsx        # Logowanie i rejestracja
│   ├── App.jsx                   # Główny kontroler aplikacji i routing widoków
│   ├── main.jsx                  # Punkt wejścia React
│   └── pushManager.js            # Niskopoziomowa obsługa rejestracji VAPID / Web Push
├── supabase_edge_function_send_push.ts # Kod funkcji brzegowej Supabase do wysyłania Push
├── supabase_notifications_setup.sql    # Skrypt SQL definiujący tabele powiadomień
├── package.json
└── README.md
```

---

## 7. Instrukcja Uruchomienia i Wdrożenia

### Wymagania wstępne:
- Node.js 18+ lub Bun
- Konto w Supabase (ze skonfigurowanym projektem)

### Uruchomienie lokalne:
```bash
# 1. Klonowanie repozytorium i instalacja zależności
npm install

# 2. Utworzenie pliku ze zmiennymi środowiskowymi (.env.local)
VITE_SUPABASE_URL=twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=twoj-anon-key
VITE_VAPID_PUBLIC_KEY=twoj-klucz-publiczny-vapid

# 3. Uruchomienie serwera deweloperskiego
npm run dev
```

### Budowanie wersji produkcyjnej:
```bash
npm run build
```

---
*Dokumentacja wygenerowana dla wersji: **Rodzinny Planer v3.1.0**.*
