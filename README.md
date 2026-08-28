# 🏠 Rodzinny Planer (v3.1.0)

Nowoczesny, kompleksowy asystent organizacji życia rodzinnego z synchronizacją w czasie rzeczywistym, obsługą PWA i powiadomieniami Web Push w tle.

---

## 📖 Pełna Dokumentacja i Architektura

Szczegółowy opis architektury systemu, schematu bazy danych, mechanizmów synchronizacji oraz wszystkich modułów funkcjonalnych znajduje się w dedykowanym pliku:

👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## ✨ Główne Funkcjonalności

- **🌅 Dzisiaj (TodayView):** Centrum dowodzenia dnia, szybkie akcje, podsumowanie zadań, spotkań i posiłków.
- **✅ Zadania (TasksView):** Podział obowiązków, gamifikacja z punktami za zadania, kategorie, podzadania.
- **📅 Kalendarz (CalendarView):** Kolorystyczny podział per członek rodziny, widoki miesiąca/tygodnia/dnia.
- **💰 Budżet i Finanse (BudgetView v3.1.0):**
  - Kategorie wydatków z limitami miesięcznymi,
  - **Cele Finansowe** (cele otwarte oraz kwotowe z globalną kumulacją oszczędności),
  - Rejestr transakcji z podziałem na: *Wydatek*, *Stały koszt*, *Cele*, *Przychód*.
- **🍳 Planer Posiłków (MealsView):** Menu tygodniowe, rodzinna baza przepisów, generowanie listy zakupów.
- **📌 Tablica Rodzinna (WallView):** Wirtualna tablica ogłoszeń z reakcjami i przypinkami.
- **📝 Notatki (NotesView):** Fiszki, listy kontrolne i organizacja pomysłów.
- **🔔 Powiadomienia Web Push & PWA:** Powiadomienia w tle (Android/iOS/Desktop) z integracją Supabase Edge Functions i kluczami VAPID P-256.

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

