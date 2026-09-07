# 🏠 Rodzinny Planer (v3.2.0)

Nowoczesny, kompleksowy asystent organizacji życia rodzinnego z synchronizacją w czasie rzeczywistym, obsługą PWA, dedykowaną architekturą nawigacji 4+1 i powiadomieniami Web Push w tle.

---

## 📖 Pełna Dokumentacja i Architektura

Szczegółowy opis architektury systemu, schematu bazy danych, mechanizmów synchronizacji oraz wszystkich modułów funkcjonalnych znajduje się w dedykowanym pliku:

👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## ✨ Główne Funkcjonalności

- **🌅 Dziś (TodayView):** Centrum dowodzenia dnia, kontekstowe powitanie domownika (*„Dzień dobry, Aniu! ☀️”*), podsumowanie agendy i szybki podgląd zakupów.
- **📅 Kalendarz (CalendarView):** Kolorystyczny podział per członek rodziny, widoki miesiąca/tygodnia/dnia, czysty interfejs zintegrowany z Floating Action Button (FAB).
- **✅ Zadania (TasksView):** Podział obowiązków, gamifikacja z punktami za zadania, kategorie, podzadania.
- **🛒 Wspólna Lista Zakupów (ShoppingView):** 9 kategorii sklepowych, auto-wykrywanie kategorii, tryb odhaczania w sklepie, liczniki pozycji.
- **📝 Notatki (NotesView):** Fiszki, edytor TipTap, listy kontrolne i konwersja notatek na zadania.
- **📱 Nowoczesna Nawigacja 4+1:** Główny dolny pasek z 4 stałymi modułami oraz wysuwanym arkuszem *„Więcej”* (Zakupy, Tablica, Budżet, Ustawienia).
- **💰 Budżet i Finanse (BudgetView):**
  - Kategorie wydatków z limitami miesięcznymi,
  - **Długoterminowe Cele Finansowe** (cele otwarte oraz kwotowe z globalną kumulacją oszczędności),
  - Rejestr transakcji z podziałem na: *Wydatek*, *Stały koszt*, *Cele*, *Przychód* oraz klawiaturą `inputMode="decimal"`.
- **📌 Tablica Rodzinna (WallView):** Wirtualna lodówka z przypinaniem ważnych ogłoszeń.
- **🔔 Powiadomienia Web Push & PWA:** Powiadomienia w tle (Android/iOS/Desktop) z integracją Supabase Edge Functions (Deno.serve) i certyfikowanymi kluczami VAPID P-256.

---

## 🗄️ Konfiguracja Bazy Danych i Bezpieczeństwa (Supabase & RLS)

Aby skonfigurować bazę danych, włączyć pełne bezpieczeństwo **Row-Level Security (RLS)** i wyeliminować ostrzeżenia Supabase:
1. Otwórz swój projekt w **Supabase Dashboard**,
2. Przejdź do zakładki **SQL Editor** -> **New Query**,
3. Wklej i uruchom zawartość pliku [`supabase_complete_setup.sql`](./supabase_complete_setup.sql).

---

## 🚀 Uruchomienie

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego
npm run dev

# Zbudowanie wersji produkcyjnej
npm run build
```
