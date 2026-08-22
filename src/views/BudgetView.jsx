import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  TrendingUp,
  Landmark,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import { COLORS, MONTHS, createDefaultMonthBudget } from '../utils/constants.js';
import { TransactionModal } from '../components/modals/TransactionModal.jsx';

export function BudgetView({ data, onUpdateData }) {
  // Aktualny miesiąc domyślnie 'YYYY-MM'
  const [monthKey, setMonthKey] = useState(() => format(new Date(), 'yyyy-MM'));
  const [activeModal, setActiveModal] = useState(null); // 'add-transaction' | null
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'fixedCost' | 'income'

  // Dane bieżącego miesiąca
  const budgetState = data?.budget || {};
  const currentMonthBudget = budgetState[monthKey];

  // Parsowanie etykiety miesiąca do wyświetlenia
  const { monthLabel } = useMemo(() => {
    try {
      const parsed = parseISO(`${monthKey}-01`);
      const y = parsed.getFullYear();
      const m = parsed.getMonth();
      return {
        monthLabel: `${MONTHS[m]} ${y}`,
      };
    } catch {
      return { monthLabel: monthKey };
    }
  }, [monthKey]);

  // Zmiana miesiąca (poprzedni / następny)
  const handlePrevMonth = () => {
    try {
      const prevDate = addMonths(parseISO(`${monthKey}-01`), -1);
      setMonthKey(format(prevDate, 'yyyy-MM'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextMonth = () => {
    try {
      const nextDate = addMonths(parseISO(`${monthKey}-01`), 1);
      setMonthKey(format(nextDate, 'yyyy-MM'));
    } catch (e) {
      console.error(e);
    }
  };

  // Inicjalizacja nowego miesiąca (kopiowanie ze starego lub tworzenie domyślnego)
  const handleStartMonth = () => {
    // 1. Sprawdź, czy istnieje poprzedni miesiąc
    const prevDate = addMonths(parseISO(`${monthKey}-01`), -1);
    const prevMonthKey = format(prevDate, 'yyyy-MM');
    const prevMonthData = budgetState[prevMonthKey];

    let newMonthData;
    if (prevMonthData && (prevMonthData.categories?.length || prevMonthData.fixedCosts?.length || prevMonthData.incomes?.length)) {
      // Kopiujemy strukturę (przychody, koszty stałe, kategorie z limitami), ale resetujemy bieżące wydatki
      newMonthData = {
        incomes: (prevMonthData.incomes || []).map((inc) => ({ ...inc })),
        fixedCosts: (prevMonthData.fixedCosts || []).map((fc) => ({ ...fc })),
        categories: (prevMonthData.categories || []).map((cat) => ({ ...cat })),
        expenses: [],
      };
    } else {
      newMonthData = createDefaultMonthBudget();
    }

    onUpdateData({
      ...data,
      budget: {
        ...budgetState,
        [monthKey]: newMonthData,
      },
    });
  };

  // Wyliczenia finansowe (Dashboard)
  const summary = useMemo(() => {
    if (!currentMonthBudget) {
      return {
        totalIncome: 0,
        totalFixedCosts: 0,
        totalExpenses: 0,
        available: 0,
        categoriesProgress: [],
      };
    }

    const totalIncome = (currentMonthBudget.incomes || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalFixedCosts = (currentMonthBudget.fixedCosts || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpenses = (currentMonthBudget.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const available = totalIncome - totalFixedCosts - totalExpenses;

    // Wydatki per kategoria
    const catMap = {};
    for (const exp of currentMonthBudget.expenses || []) {
      const cId = exp.categoryId || 'other';
      catMap[cId] = (catMap[cId] || 0) + (Number(exp.amount) || 0);
    }

    const categoriesProgress = (currentMonthBudget.categories || []).map((cat) => {
      const spent = catMap[cat.id] || 0;
      const limit = Number(cat.limit) || 0;
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isExceeded = limit > 0 && spent > limit;
      const diff = spent - limit;

      return {
        ...cat,
        spent,
        limit,
        percent,
        isExceeded,
        diff,
      };
    });

    return {
      totalIncome,
      totalFixedCosts,
      totalExpenses,
      available,
      categoriesProgress,
    };
  }, [currentMonthBudget]);

  // Zapis nowej transakcji
  const handleSaveTransaction = (type, item) => {
    if (!currentMonthBudget) return;

    const updatedMonth = { ...currentMonthBudget };
    if (type === 'expense') {
      updatedMonth.expenses = [item, ...(updatedMonth.expenses || [])];
    } else if (type === 'fixedCost') {
      updatedMonth.fixedCosts = [...(updatedMonth.fixedCosts || []), item];
    } else if (type === 'income') {
      updatedMonth.incomes = [...(updatedMonth.incomes || []), item];
    }

    onUpdateData({
      ...data,
      budget: {
        ...budgetState,
        [monthKey]: updatedMonth,
      },
    });
  };

  // Usuwanie pozycji
  const handleDeleteItem = (type, id) => {
    if (!currentMonthBudget) return;

    const updatedMonth = { ...currentMonthBudget };
    if (type === 'expense') {
      updatedMonth.expenses = (updatedMonth.expenses || []).filter((x) => x.id !== id);
    } else if (type === 'fixedCost') {
      updatedMonth.fixedCosts = (updatedMonth.fixedCosts || []).filter((x) => x.id !== id);
    } else if (type === 'income') {
      updatedMonth.incomes = (updatedMonth.incomes || []).filter((x) => x.id !== id);
    }

    onUpdateData({
      ...data,
      budget: {
        ...budgetState,
        [monthKey]: updatedMonth,
      },
    });
  };

  // Format waluty PLN
  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // Połączona lista operacji
  const combinedTransactions = useMemo(() => {
    if (!currentMonthBudget) return [];

    const list = [];
    if (filterType === 'all' || filterType === 'income') {
      (currentMonthBudget.incomes || []).forEach((item) => {
        list.push({
          ...item,
          type: 'income',
          displayDate: 'Miesiąc',
          displayTitle: item.title,
          categoryName: 'Przychód stały',
        });
      });
    }

    if (filterType === 'all' || filterType === 'fixedCost') {
      (currentMonthBudget.fixedCosts || []).forEach((item) => {
        list.push({
          ...item,
          type: 'fixedCost',
          displayDate: 'Miesiąc',
          displayTitle: item.title,
          categoryName: 'Koszt stały',
        });
      });
    }

    if (filterType === 'all' || filterType === 'expense') {
      (currentMonthBudget.expenses || []).forEach((item) => {
        list.push({
          ...item,
          type: 'expense',
          displayDate: item.date,
          displayTitle: item.description || item.categoryName || 'Wydatek',
        });
      });
    }

    // Sortowanie: najnowsze wydatki na górze
    return list.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [currentMonthBudget, filterType]);

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 1. SELEKTOR MIESIĄCA */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={handlePrevMonth}
          className="p-2.5 rounded-xl hover:bg-stone-800 transition text-stone-300 border border-stone-800"
          title="Poprzedni miesiąc"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center">
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold capitalize">
            {monthLabel}
          </h2>
          <span className="text-[11px] font-mono tracking-wider text-stone-500 uppercase">{monthKey}</span>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2.5 rounded-xl hover:bg-stone-800 transition text-stone-300 border border-stone-800"
          title="Następny miesiąc"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 2. JEŚLI MIESIĄC NIE JEST ROZPOCZĘTY -> PUSTY STAN Z PRZYCISKIEM */}
      {!currentMonthBudget ? (
        <div
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
          className="rounded-2xl p-7 border text-center space-y-4 shadow-lg"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
            <PiggyBank size={32} />
          </div>

          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold">
              Brak planu na {monthLabel}
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Miesiąc nie został jeszcze zainicjalizowany. Możesz skopiować swoje stałe koszty, przychody i limity kategorii z poprzedniego miesiąca jednym kliknięciem.
            </p>
          </div>

          <button
            onClick={handleStartMonth}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm shadow hover:opacity-90 transition flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <Sparkles size={18} />
            Rozpocznij ten miesiąc (Skopiuj stałe koszty i limity)
          </button>
        </div>
      ) : (
        <>
          {/* 3. GŁÓWNY DASHBOARD: [Przychody] - [Koszty Stałe] - [Wydatki] = [Pozostałe Środki] */}
          <div className="space-y-3">
            {/* Kafelek bilansu głównego */}
            <div
              style={{
                background: summary.available >= 0 ? 'linear-gradient(135deg, #1e261f 0%, #151d16 100%)' : 'linear-gradient(135deg, #2d1818 0%, #1c1212 100%)',
                borderColor: summary.available >= 0 ? '#38573b' : '#6b2d2d',
              }}
              className="p-5 rounded-2xl border shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Dostępne wolne środki
                </span>
                {summary.available >= 0 ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                    <CheckCircle2 size={12} /> W budżecie
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/40">
                    <AlertTriangle size={12} /> Przekroczenie
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <h1
                  style={{ fontFamily: 'Fraunces' }}
                  className={`text-3xl font-extrabold tracking-tight ${
                    summary.available >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPLN(summary.available)}
                </h1>
              </div>

              <p className="text-[11px] text-stone-400 mt-1">
                Przychody ({formatPLN(summary.totalIncome)}) – Stałe ({formatPLN(summary.totalFixedCosts)}) – Wydatki ({formatPLN(summary.totalExpenses)})
              </p>
            </div>

            {/* Równanie / Kafelki składowe */}
            <div className="grid grid-cols-3 gap-2">
              <div
                style={{ background: COLORS.surface, borderColor: COLORS.border }}
                className="p-3.5 rounded-xl border flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-[11px] font-semibold">Przychody</span>
                </div>
                <span className="text-sm sm:text-base font-bold text-stone-100 font-mono">
                  {formatPLN(summary.totalIncome)}
                </span>
              </div>

              <div
                style={{ background: COLORS.surface, borderColor: COLORS.border }}
                className="p-3.5 rounded-xl border flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-orange-400 mb-1">
                  <Landmark size={14} />
                  <span className="text-[11px] font-semibold">Koszty stałe</span>
                </div>
                <span className="text-sm sm:text-base font-bold text-stone-100 font-mono">
                  {formatPLN(summary.totalFixedCosts)}
                </span>
              </div>

              <div
                style={{ background: COLORS.surface, borderColor: COLORS.border }}
                className="p-3.5 rounded-xl border flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                  <TrendingDown size={14} />
                  <span className="text-[11px] font-semibold">Bieżące</span>
                </div>
                <span className="text-sm sm:text-base font-bold text-stone-100 font-mono">
                  {formatPLN(summary.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. SEKCJA: KATEGORIE I LIMITY (PASKI POSTĘPU) */}
          <div
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
            className="rounded-2xl p-4.5 border space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                  Limity kategorii
                </h3>
                <p className="text-[11px] text-stone-400">Kontrola wydatków w bieżącym miesiącu</p>
              </div>

              <button
                onClick={() => setActiveModal('add-transaction')}
                style={{ background: COLORS.accent, color: '#121214' }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow hover:opacity-90 transition cursor-pointer"
              >
                <Plus size={14} />
                Dodaj operację
              </button>
            </div>

            <div className="space-y-3.5 pt-1">
              {summary.categoriesProgress.map((cat) => {
                const isOver = cat.isExceeded;
                const barWidth = Math.min(100, Math.max(2, cat.percent));

                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                        {cat.icon && <span>{cat.icon}</span>}
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-300">
                          <span className={isOver ? 'text-rose-400 font-bold' : 'text-stone-100'}>
                            {formatPLN(cat.spent)}
                          </span>{' '}
                          / <span className="text-stone-400">{formatPLN(cat.limit)}</span>
                        </span>
                        {isOver && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 font-semibold">
                            +{formatPLN(cat.diff)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-stone-900 rounded-full h-2.5 overflow-hidden border border-stone-800">
                      <div
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: isOver ? COLORS.warn : COLORS.accent,
                        }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}

              {summary.categoriesProgress.length === 0 && (
                <p className="text-xs text-stone-500 italic py-2">Brak zdefiniowanych limitów w tym miesiącu.</p>
              )}
            </div>
          </div>

          {/* 5. LISTA OPERACJI Z DANEGO MIESIĄCA */}
          <div
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
            className="rounded-2xl p-4.5 border space-y-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Operacje ({combinedTransactions.length})
              </h3>

              {/* Filtry */}
              <div
                style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                className="flex p-0.5 rounded-xl border text-[11px] font-semibold overflow-x-auto no-scrollbar"
              >
                <button
                  onClick={() => setFilterType('all')}
                  style={{
                    background: filterType === 'all' ? COLORS.accent : 'transparent',
                    color: filterType === 'all' ? '#121214' : COLORS.inkSoft,
                  }}
                  className="px-2.5 py-1 rounded-lg transition shrink-0"
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  style={{
                    background: filterType === 'expense' ? COLORS.accent : 'transparent',
                    color: filterType === 'expense' ? '#121214' : COLORS.inkSoft,
                  }}
                  className="px-2.5 py-1 rounded-lg transition shrink-0"
                >
                  Wydatki
                </button>
                <button
                  onClick={() => setFilterType('fixedCost')}
                  style={{
                    background: filterType === 'fixedCost' ? COLORS.accent : 'transparent',
                    color: filterType === 'fixedCost' ? '#121214' : COLORS.inkSoft,
                  }}
                  className="px-2.5 py-1 rounded-lg transition shrink-0"
                >
                  Stałe koszty
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  style={{
                    background: filterType === 'income' ? COLORS.accent : 'transparent',
                    color: filterType === 'income' ? '#121214' : COLORS.inkSoft,
                  }}
                  className="px-2.5 py-1 rounded-lg transition shrink-0"
                >
                  Przychody
                </button>
              </div>
            </div>

            {/* Lista wpisów */}
            <div className="space-y-2 pt-1">
              {combinedTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const isFixed = tx.type === 'fixedCost';

                return (
                  <div
                    key={tx.id}
                    style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                    className="flex items-center justify-between p-3 rounded-xl border transition hover:border-stone-700"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isFixed
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isIncome && <TrendingUp size={16} />}
                        {isFixed && <Landmark size={16} />}
                        {!isIncome && !isFixed && <TrendingDown size={16} />}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-stone-100">{tx.displayTitle}</div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-2">
                          <span>{tx.categoryName || 'Brak kategorii'}</span>
                          {tx.date && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar size={10} /> {tx.date}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-sm font-bold ${
                          isIncome ? 'text-emerald-400' : 'text-stone-100'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatPLN(tx.amount)}
                      </span>

                      <button
                        onClick={() => handleDeleteItem(tx.type, tx.id)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition"
                        title="Usuń wpis"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {combinedTransactions.length === 0 && (
                <div className="text-center py-6 text-stone-500 text-xs italic">
                  Brak operacji dla wybranego filtru w tym miesiącu.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL DODAWANIA TRANSAKCJI */}
      {activeModal === 'add-transaction' && (
        <TransactionModal
          monthKey={monthKey}
          categories={currentMonthBudget?.categories || []}
          onClose={() => setActiveModal(null)}
          onSave={handleSaveTransaction}
        />
      )}
    </div>
  );
}
