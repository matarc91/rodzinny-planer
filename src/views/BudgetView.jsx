import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Landmark,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  Target,
  Plus,
  Pencil,
  Clock,
} from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import {
  COLORS,
  MONTHS,
  createDefaultMonthBudget,
  createDefaultBudgetGoals,
  createDefaultExpiringObligations,
} from '../utils/constants.js';
import { TransactionModal } from '../components/modals/TransactionModal.jsx';
import { ManageCategoriesModal } from '../components/modals/ManageCategoriesModal.jsx';
import { ManageGoalsModal } from '../components/modals/ManageGoalsModal.jsx';
import { ExpiringObligationModal } from '../components/modals/ExpiringObligationModal.jsx';
import { BudgetDetailsModal } from '../components/modals/BudgetDetailsModal.jsx';
import {
  ExpiringObligationsSection,
  getObligationMonthState,
} from '../components/budget/ExpiringObligationsSection.jsx';
import { Chip } from '../components/ui/Chip.jsx';

export function BudgetView({
  data,
  onUpdateData,
  currentPersonId = null,
  monthKey: propMonthKey,
  onMonthChange,
}) {
  // Aktualny miesiąc domyślnie 'YYYY-MM'
  const [internalMonthKey, setInternalMonthKey] = useState(() => format(new Date(), 'yyyy-MM'));
  const monthKey = propMonthKey || internalMonthKey;

  const setMonthKey = (newKey) => {
    setInternalMonthKey(newKey);
    onMonthChange?.(newKey);
  };

  const [activeModal, setActiveModal] = useState(null); // 'add-transaction' | 'edit-transaction' | 'manage-categories' | 'manage-goals' | 'add-obligation' | 'edit-obligation' | null
  const [selectedGoalForTx, setSelectedGoalForTx] = useState(null);
  const [selectedCategoryForTx, setSelectedCategoryForTx] = useState(null);
  const [initialTxType, setInitialTxType] = useState('expense');
  const [detailsModal, setDetailsModal] = useState(null); // { mode: 'category' | 'incomes' | 'fixedCosts', categoryId?: string } | null
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingObligation, setEditingObligation] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);

  // Dane bieżącego miesiąca
  const budgetState = useMemo(() => data?.budget || {}, [data?.budget]);
  const currentMonthBudget = budgetState[monthKey];

  // Cele finansowe i inwestycyjne (z automatyczną migracją Poduszki Finansowej jeśli była w emergencyFund)
  const budgetGoals = useMemo(() => {
    const rawGoals = data?.budgetGoals || createDefaultBudgetGoals();
    const hasPoduszka = rawGoals.some(
      (g) => g.id === 'goal_poduszka' || (g.name && g.name.toLowerCase().includes('poduszk'))
    );
    if (!hasPoduszka && data?.emergencyFund) {
      return [
        {
          id: 'goal_poduszka',
          name: 'Poduszka finansowa',
          targetAmount: data.emergencyFund.targetAmount || 50000,
          initialAmount: data.emergencyFund.currentAmount || 0,
          icon: '🛡️',
          isCompleted: false,
          createdAt: new Date().toISOString(),
        },
        ...rawGoals,
      ];
    }
    return rawGoals;
  }, [data?.budgetGoals, data?.emergencyFund]);

  const expiringObligations = useMemo(
    () => data?.expiringObligations || createDefaultExpiringObligations(),
    [data?.expiringObligations]
  );
  const people = data?.people || [];

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
    const totalInstallments = expiringObligations.reduce((acc, obl) => {
      const state = getObligationMonthState(obl, monthKey);
      return state.isPaidInMonth ? acc + (Number(obl.monthlyAmount) || 0) : acc;
    }, 0);

    if (!currentMonthBudget) {
      return {
        totalIncome: 0,
        totalFixedCosts: 0,
        totalExpenses: 0,
        totalInstallments,
        available: -totalInstallments,
        categoriesProgress: [],
        categoryExpenseCounts: {},
      };
    }

    const totalIncome = (currentMonthBudget.incomes || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalFixedCosts = (currentMonthBudget.fixedCosts || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpenses = (currentMonthBudget.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const available = totalIncome - totalFixedCosts - totalExpenses - totalInstallments;

    // Wydatki per kategoria (z wyłączeniem wpłat na cele)
    const categories = currentMonthBudget.categories || [];
    const validCategoryIds = new Set(categories.map((c) => c.id));
    const catMap = {};
    const categoryExpenseCounts = {};
    let uncategorizedSpent = 0;
    let uncategorizedCount = 0;

    for (const exp of currentMonthBudget.expenses || []) {
      if (exp.goalId) continue;
      const cId = exp.categoryId;
      if (cId && validCategoryIds.has(cId)) {
        catMap[cId] = (catMap[cId] || 0) + (Number(exp.amount) || 0);
        categoryExpenseCounts[cId] = (categoryExpenseCounts[cId] || 0) + 1;
      } else {
        uncategorizedSpent += Number(exp.amount) || 0;
        uncategorizedCount += 1;
      }
    }

    const categoriesProgress = categories.map((cat) => {
      const spent = catMap[cat.id] || 0;
      const count = categoryExpenseCounts[cat.id] || 0;
      const limit = Number(cat.limit) || 0;
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isExceeded = limit > 0 && spent > limit;
      const diff = spent - limit;

      return {
        ...cat,
        spent,
        count,
        limit,
        percent,
        isExceeded,
        diff,
        isFallback: false,
      };
    });

    if (uncategorizedCount > 0) {
      categoriesProgress.push({
        id: '__other__',
        name: 'Inne wydatki',
        icon: '📦',
        spent: uncategorizedSpent,
        count: uncategorizedCount,
        limit: 0,
        percent: 0,
        isExceeded: false,
        diff: 0,
        isFallback: true,
      });
    }

    return {
      totalIncome,
      totalFixedCosts,
      totalExpenses,
      totalInstallments,
      available,
      categoriesProgress,
      categoryExpenseCounts,
    };
  }, [currentMonthBudget, expiringObligations, monthKey]);

  // Wyliczenia dla Celów Finansowych (globalnie po wszystkich miesiącach)
  const { goalsProgress, goalsProgressMap } = useMemo(() => {
    const map = {};
    Object.values(budgetState).forEach((m) => {
      if (!m || !Array.isArray(m.expenses)) return;
      m.expenses.forEach((exp) => {
        if (exp.goalId) {
          map[exp.goalId] = (map[exp.goalId] || 0) + (Number(exp.amount) || 0);
        }
      });
    });

    const list = (budgetGoals || []).map((g) => {
      const initial = Number(g.initialAmount) || 0;
      const spent = (map[g.id] || 0) + initial;
      const hasTarget = g.targetAmount !== null && g.targetAmount !== undefined && Number(g.targetAmount) > 0;
      const target = hasTarget ? Number(g.targetAmount) : 0;
      const percent = hasTarget ? Math.min(100, Math.round((spent / target) * 100)) : 100;
      const rawPercent = hasTarget ? Math.round((spent / target) * 100) : null;
      const isReached = hasTarget && spent >= target;

      return {
        ...g,
        spent,
        target,
        hasTarget,
        percent,
        rawPercent,
        isReached,
      };
    });

    return {
      goalsProgress: list,
      goalsProgressMap: map,
    };
  }, [budgetState, budgetGoals]);

  // Zapis nowej lub edytowanej transakcji
  const handleSaveTransaction = (type, item, meta = {}) => {
    const nextBudgetState = { ...budgetState };

    // Jeśli to była EDYCJA -> usuń stary rekord z pierwotnego miesiąca i typu
    if (meta.isEdit && meta.originalItem) {
      const origMonthKey = meta.originalMonthKey || monthKey;
      const origType = meta.originalItem.type || (meta.originalItem.goalId ? 'expense' : meta.originalType);

      if (nextBudgetState[origMonthKey]) {
        const oldMonth = { ...nextBudgetState[origMonthKey] };
        if (origType === 'expense' || origType === 'goal') {
          oldMonth.expenses = (oldMonth.expenses || []).filter((x) => x.id !== meta.originalItem.id);
        } else if (origType === 'fixedCost') {
          oldMonth.fixedCosts = (oldMonth.fixedCosts || []).filter((x) => x.id !== meta.originalItem.id);
        } else if (origType === 'income') {
          oldMonth.incomes = (oldMonth.incomes || []).filter((x) => x.id !== meta.originalItem.id);
        }
        nextBudgetState[origMonthKey] = oldMonth;
      }
    }

    // Określ miesiąc docelowy na podstawie daty (jeśli wpis zawiera date np. '2026-09-15') lub aktualny monthKey
    const targetMonthKey = item.date && item.date.length >= 7 ? item.date.slice(0, 7) : monthKey;
    const targetMonth = nextBudgetState[targetMonthKey] || createDefaultMonthBudget();
    const updatedTargetMonth = { ...targetMonth };

    if (type === 'expense' || type === 'goal') {
      updatedTargetMonth.expenses = [item, ...(updatedTargetMonth.expenses || [])];
    } else if (type === 'fixedCost') {
      updatedTargetMonth.fixedCosts = [item, ...(updatedTargetMonth.fixedCosts || [])];
    } else if (type === 'income') {
      updatedTargetMonth.incomes = [item, ...(updatedTargetMonth.incomes || [])];
    }
    nextBudgetState[targetMonthKey] = updatedTargetMonth;

    onUpdateData({
      ...data,
      budget: nextBudgetState,
    });
  };

  // Zapisanie zmodyfikowanych celów finansowych
  const handleSaveGoals = (updatedGoals) => {
    onUpdateData({
      ...data,
      budgetGoals: updatedGoals,
    });
  };

  // Zapisanie nowej lub edytowanej raty 0% / zobowiązania terminowego
  const handleSaveObligation = (savedObligation) => {
    const exists = expiringObligations.some((o) => o.id === savedObligation.id);
    const nextObligations = exists
      ? expiringObligations.map((o) => (o.id === savedObligation.id ? savedObligation : o))
      : [savedObligation, ...expiringObligations];

    onUpdateData({
      ...data,
      expiringObligations: nextObligations,
    });
  };

  // Opłacenie raty w wybranym miesiącu (Model A)
  const handleIncrementObligationPaid = (id) => {
    const nextObligations = expiringObligations.map((o) => {
      if (o.id !== id) return o;
      const state = getObligationMonthState(o, monthKey);
      if (state.isMaxReached || state.isPaidInMonth) return o;

      const nextPaidMonths = [...state.paidMonths, monthKey];
      const nextPaid = Math.min(o.totalInstallments, state.basePaid + nextPaidMonths.length);
      return {
        ...o,
        initialPaidInstallments: state.basePaid,
        paidMonths: nextPaidMonths,
        paidInstallments: nextPaid,
        isCompleted: nextPaid >= o.totalInstallments,
      };
    });

    onUpdateData({
      ...data,
      expiringObligations: nextObligations,
    });
  };

  // Cofnięcie opłacenia raty w wybranym miesiącu
  const handleUndoObligationPaid = (id) => {
    const nextObligations = expiringObligations.map((o) => {
      if (o.id !== id) return o;
      const state = getObligationMonthState(o, monthKey);
      if (!state.isPaidInMonth) return o;

      const nextPaidMonths = state.paidMonths.filter((m) => m !== monthKey);
      const nextPaid = Math.max(0, state.basePaid + nextPaidMonths.length);
      return {
        ...o,
        initialPaidInstallments: state.basePaid,
        paidMonths: nextPaidMonths,
        paidInstallments: nextPaid,
        isCompleted: nextPaid >= o.totalInstallments,
      };
    });

    onUpdateData({
      ...data,
      expiringObligations: nextObligations,
    });
  };

  // Usunięcie zobowiązania terminowego
  const handleDeleteObligation = (id) => {
    onUpdateData({
      ...data,
      expiringObligations: expiringObligations.filter((o) => o.id !== id),
    });
  };

  // Zapisanie zmodyfikowanych kategorii
  const handleSaveCategories = (updatedCategories) => {
    if (!currentMonthBudget) return;

    const updatedMonth = {
      ...currentMonthBudget,
      categories: updatedCategories,
    };

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

  // Dane dla modalu szczegółów (Przychody / Koszty stałe / Kategoria)
  const activeDetailsData = useMemo(() => {
    if (!detailsModal || !currentMonthBudget) return null;

    if (detailsModal.mode === 'incomes') {
      return {
        mode: 'incomes',
        category: null,
        items: currentMonthBudget.incomes || [],
      };
    }

    if (detailsModal.mode === 'fixedCosts') {
      return {
        mode: 'fixedCosts',
        category: null,
        items: currentMonthBudget.fixedCosts || [],
      };
    }

    if (detailsModal.mode === 'category') {
      const cat = summary.categoriesProgress.find((c) => c.id === detailsModal.categoryId);
      if (!cat) return null;

      const validCategoryIds = new Set((currentMonthBudget.categories || []).map((c) => c.id));
      const items = (currentMonthBudget.expenses || [])
        .filter((exp) => {
          if (exp.goalId) return false;
          if (cat.isFallback) {
            return !exp.categoryId || !validCategoryIds.has(exp.categoryId);
          }
          return exp.categoryId === cat.id;
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      return {
        mode: 'category',
        category: cat,
        items,
      };
    }

    return null;
  }, [detailsModal, currentMonthBudget, summary.categoriesProgress]);

  return (
    <div className="space-y-5 animate-fadeIn pb-14">
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

      {/* 2. MIESIĘCZNY BUDŻET OPERACYJNY */}
      <div className="pt-1 space-y-4">
        <div className="px-1 flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold">
              Budżet operacyjny ({monthLabel})
            </h3>
            <p className="text-xs text-stone-400">Bieżące koszty, limity kategorii i wydatki w wybranym miesiącu</p>
          </div>
        </div>

        {!currentMonthBudget ? (
          <div
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
            className="rounded-2xl p-7 border text-center space-y-4 shadow-lg"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
              <PiggyBank size={32} />
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Brak planu na {monthLabel}
              </h4>
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
            {/* Kafelek bilansu głównego */}
            <div className="space-y-3">
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
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
                      <CheckCircle2 size={13} /> W budżecie
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-800/40">
                      <AlertTriangle size={13} /> Przekroczenie
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <h1
                    style={{ fontFamily: 'Fraunces' }}
                    className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                      summary.available >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatPLN(summary.available)}
                  </h1>
                </div>

                <p className="text-xs text-stone-400 mt-2">
                  Przychody ({formatPLN(summary.totalIncome)}) – Stałe ({formatPLN(summary.totalFixedCosts)}) – Wydatki ({formatPLN(summary.totalExpenses)}) – Raty ({formatPLN(summary.totalInstallments)})
                </p>
              </div>

              {/* Równanie / Kafelki składowe */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setDetailsModal({ mode: 'incomes' })}
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  className="p-3 sm:p-4 rounded-xl border flex flex-col justify-between text-left hover:border-emerald-500/40 hover:bg-stone-900/60 transition cursor-pointer group"
                  title="Kliknij, aby zobaczyć i modyfikować przychody"
                >
                  <div className="flex items-center justify-between gap-1 text-emerald-400 mb-1 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TrendingUp size={14} className="shrink-0" />
                      <span className="text-[11px] sm:text-xs font-semibold truncate">Przychody</span>
                    </div>
                    <ChevronRight size={13} className="text-stone-500 group-hover:text-emerald-400 transition shrink-0" />
                  </div>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-stone-100 font-mono truncate">
                    {formatPLN(summary.totalIncome)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailsModal({ mode: 'fixedCosts' })}
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  className="p-3 sm:p-4 rounded-xl border flex flex-col justify-between text-left hover:border-orange-500/40 hover:bg-stone-900/60 transition cursor-pointer group"
                  title="Kliknij, aby zobaczyć i modyfikować koszty stałe"
                >
                  <div className="flex items-center justify-between gap-1 text-orange-400 mb-1 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Landmark size={14} className="shrink-0" />
                      <span className="text-[11px] sm:text-xs font-semibold truncate">Koszty stałe</span>
                    </div>
                    <ChevronRight size={13} className="text-stone-500 group-hover:text-orange-400 transition shrink-0" />
                  </div>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-stone-100 font-mono truncate">
                    {formatPLN(summary.totalFixedCosts)}
                  </span>
                </button>

                <div
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  className="p-3 sm:p-4 rounded-xl border flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                    <TrendingDown size={14} className="shrink-0" />
                    <span className="text-[11px] sm:text-xs font-semibold truncate">Bieżące</span>
                  </div>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-stone-100 font-mono truncate">
                    {formatPLN(summary.totalExpenses)}
                  </span>
                </div>

                <div
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  className="p-3 sm:p-4 rounded-xl border flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 text-amber-300 mb-1">
                    <Clock size={14} className="shrink-0" />
                    <span className="text-[11px] sm:text-xs font-semibold truncate">Raty (opłacone)</span>
                  </div>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-stone-100 font-mono truncate">
                    {formatPLN(summary.totalInstallments)}
                  </span>
                </div>
              </div>
            </div>

            {/* KATEGORIE WYDATKÓW */}
            <div
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
              className="rounded-2xl p-4 sm:p-5 border space-y-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                    Kategorie wydatków
                  </h3>
                  <p className="text-xs text-stone-400">Kliknij kategorię, aby zobaczyć, dodać lub edytować jej operacje</p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal('manage-categories')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 transition border border-stone-700 cursor-pointer"
                  title="Modyfikuj, dodawaj lub usuwaj kategorie"
                >
                  <SlidersHorizontal size={14} className="text-amber-400" />
                  <span>Kategorie</span>
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {summary.categoriesProgress.map((cat) => {
                  const isOver = cat.isExceeded;
                  const barWidth = cat.isFallback ? 100 : Math.min(100, Math.max(2, cat.percent));

                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setDetailsModal({ mode: 'category', categoryId: cat.id })}
                      style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                      className="w-full text-left p-3 sm:p-3.5 rounded-xl border space-y-2.5 hover:border-amber-500/40 hover:bg-stone-800/40 transition cursor-pointer group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{cat.icon || '🏷️'}</span>
                          <span className="text-sm font-semibold text-stone-200 truncate">{cat.name}</span>
                          {cat.count > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-800 shrink-0">
                              {cat.count}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-xs font-mono">
                            <span className={isOver ? 'text-rose-400 font-bold' : 'text-stone-100 font-bold'}>
                              {formatPLN(cat.spent)}
                            </span>
                            {!cat.isFallback && (
                              <>
                                <span className="text-stone-500 mx-1">/</span>
                                <span className="text-stone-400">{formatPLN(cat.limit)}</span>
                              </>
                            )}
                          </div>

                          {!cat.isFallback &&
                            (isOver ? (
                              <span className="text-[11px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md border border-rose-500/30 font-semibold shrink-0">
                                +{formatPLN(cat.diff)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-500 font-mono shrink-0">
                                {cat.percent}%
                              </span>
                            ))}

                          <ChevronRight size={14} className="text-stone-500 group-hover:text-amber-400 transition shrink-0" />
                        </div>
                      </div>

                      {!cat.isFallback && (
                        <div className="w-full bg-stone-900 rounded-full h-2.5 overflow-hidden border border-stone-800">
                          <div
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: isOver ? COLORS.warn : COLORS.accent,
                            }}
                            className="h-full rounded-full transition-all duration-500"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}

                {summary.categoriesProgress.length === 0 && (
                  <div className="text-center py-5 border border-dashed border-stone-800 rounded-xl bg-stone-900/30 space-y-2">
                    <p className="text-xs text-stone-400">Brak zdefiniowanych kategorii w tym miesiącu.</p>
                    <button
                      type="button"
                      onClick={() => setActiveModal('manage-categories')}
                      style={{ color: COLORS.accent }}
                      className="text-xs font-bold hover:underline"
                    >
                      + Dodaj pierwszą kategorię
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. SUPER SEKCJA: CELE FINANSOWE I INWESTYCYJNE */}
      <div
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
        className="rounded-2xl p-4 sm:p-5 border space-y-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold flex items-center gap-2">
              <span>Cele finansowe i inwestycyjne</span>
            </h3>
            <p className="text-xs text-stone-400">
              Poduszka finansowa, emerytalne (IKZE), inwestycje (ETF) i plany długoterminowe
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingGoalId(null);
              setActiveModal('manage-goals');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 transition border border-stone-700 cursor-pointer"
            title="Modyfikuj, dodawaj lub edytuj cele"
          >
            <SlidersHorizontal size={14} className="text-amber-400" />
            <span>Zarządzaj celami</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {goalsProgress.map((goal) => {
            const hasTarget = goal.hasTarget;
            const isReached = goal.isReached;
            const isCompleted = goal.isCompleted;

            return (
              <div
                key={goal.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition ${
                  isCompleted ? 'opacity-70 border-emerald-500/30' : ''
                }`}
              >
                <div className="space-y-2.5">
                  {/* Górny wiersz celu */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0">{goal.icon || '🎯'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-semibold truncate ${isCompleted ? 'line-through text-stone-400' : 'text-stone-100'}`}>
                            {goal.name}
                          </span>
                          {isCompleted ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/30 flex items-center gap-0.5">
                              <CheckCircle2 size={10} /> Zrealizowany
                            </span>
                          ) : isReached ? (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-semibold border border-amber-500/30">
                              Osiągnięty!
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoalId(goal.id);
                          setActiveModal('manage-goals');
                        }}
                        className="p-1 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer"
                        title="Edytuj ten cel"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Kwoty i procenty */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-mono">
                      <span className="text-stone-100 font-bold">{formatPLN(goal.spent)}</span>
                      <span className="text-stone-500 mx-1">/</span>
                      {hasTarget ? (
                        <span className="text-stone-400">{formatPLN(goal.target)}</span>
                      ) : (
                        <span className="text-amber-400 font-bold text-xs">∞ otwarty</span>
                      )}
                    </div>

                    {hasTarget ? (
                      <span className="text-[11px] text-stone-400 font-mono">
                        {goal.rawPercent}%
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold font-mono">
                        Plan ciągły
                      </span>
                    )}
                  </div>

                  {/* Pasek postępu */}
                  {hasTarget ? (
                    <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
                      <div
                        style={{
                          width: `${Math.max(2, Math.min(100, goal.percent))}%`,
                          backgroundColor: isReached ? COLORS.success : COLORS.accent,
                        }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  ) : (
                    <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-amber-500/20 relative flex items-center">
                      <div className="h-full rounded-full w-full bg-gradient-to-r from-amber-500/30 via-amber-400/80 to-amber-500/30 animate-pulse transition-all duration-500" />
                    </div>
                  )}

                  {/* Informacja o stanie początkowym jeśli istnieje */}
                  {Number(goal.initialAmount) > 0 && (
                    <div className="text-[10px] text-stone-500">
                      Stan początkowy: <span className="font-mono text-stone-400">{formatPLN(goal.initialAmount)}</span>
                    </div>
                  )}

                  {/* Wpłaty na cel w wybranym miesiącu */}
                  {(() => {
                    const monthDeposits = (currentMonthBudget?.expenses || []).filter((e) => e.goalId === goal.id);
                    if (monthDeposits.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-stone-800/60 space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                          Wpłaty w tym miesiącu
                        </div>
                        {monthDeposits.map((dep) => (
                          <div
                            key={dep.id}
                            className="flex items-center justify-between gap-2 text-xs bg-stone-900/60 px-2.5 py-1.5 rounded-lg border border-stone-800/80"
                          >
                            <div className="min-w-0 flex-1 truncate text-stone-300">
                              <span className="font-mono text-[11px] text-stone-500 mr-1.5">
                                {dep.date ? dep.date.slice(5) : ''}
                              </span>
                              <span>{dep.description || 'Wpłata na cel'}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-mono font-bold text-amber-300 mr-1">
                                +{formatPLN(dep.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTransaction({ ...dep, type: 'goal' });
                                  setActiveModal('edit-transaction');
                                }}
                                className="p-1 rounded text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer"
                                title="Edytuj wpłatę"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem('expense', dep.id)}
                                className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition cursor-pointer"
                                title="Usuń wpłatę"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Akcja wpłaty na cel */}
                {!isCompleted && (
                  <div className="pt-1 border-t border-stone-800/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryForTx(null);
                        setSelectedGoalForTx(goal.id);
                        setInitialTxType('goal');
                        setActiveModal('add-transaction');
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Wpłać na cel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {goalsProgress.length === 0 && (
            <div className="col-span-full text-center py-6 border border-dashed border-stone-800 rounded-xl bg-stone-900/30 space-y-2">
              <p className="text-xs text-stone-400">Brak zdefiniowanych celów finansowych.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingGoalId(null);
                  setActiveModal('manage-goals');
                }}
                style={{ color: COLORS.accent }}
                className="text-xs font-bold hover:underline"
              >
                + Dodaj pierwszy cel finansowy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. RATY */}
      <ExpiringObligationsSection
        obligations={expiringObligations}
        monthKey={monthKey}
        onOpenAddModal={() => {
          setEditingObligation(null);
          setActiveModal('add-obligation');
        }}
        onOpenEditModal={(obl) => {
          setEditingObligation(obl);
          setActiveModal('edit-obligation');
        }}
        onIncrementPaid={handleIncrementObligationPaid}
        onUndoPaid={handleUndoObligationPaid}
        onDeleteObligation={handleDeleteObligation}
      />

      {/* MODAL SZCZEGÓŁÓW (PRZYCHODY / KOSZTY STAŁE / KATEGORIA) */}
      {activeDetailsData && (
        <BudgetDetailsModal
          mode={activeDetailsData.mode}
          category={activeDetailsData.category}
          items={activeDetailsData.items}
          people={people}
          onClose={() => setDetailsModal(null)}
          onAdd={() => {
            setEditingTransaction(null);
            setSelectedGoalForTx(null);
            if (activeDetailsData.mode === 'incomes') {
              setSelectedCategoryForTx(null);
              setInitialTxType('income');
            } else if (activeDetailsData.mode === 'fixedCosts') {
              setSelectedCategoryForTx(null);
              setInitialTxType('fixedCost');
            } else {
              setSelectedCategoryForTx(
                activeDetailsData.category?.isFallback ? null : activeDetailsData.category?.id || null
              );
              setInitialTxType('expense');
            }
            setActiveModal('add-transaction');
          }}
          onEdit={(item) => {
            const txType =
              activeDetailsData.mode === 'incomes'
                ? 'income'
                : activeDetailsData.mode === 'fixedCosts'
                ? 'fixedCost'
                : 'expense';
            setEditingTransaction({ ...item, type: txType });
            setActiveModal('edit-transaction');
          }}
          onDelete={(item) => {
            const txType =
              activeDetailsData.mode === 'incomes'
                ? 'income'
                : activeDetailsData.mode === 'fixedCosts'
                ? 'fixedCost'
                : 'expense';
            handleDeleteItem(txType, item.id);
          }}
        />
      )}

      {/* MODAL DODAWANIA I EDYCJI TRANSAKCJI */}
      {(activeModal === 'add-transaction' || activeModal === 'edit-transaction') && (
        <TransactionModal
          monthKey={editingTransaction?.date ? editingTransaction.date.slice(0, 7) : monthKey}
          categories={currentMonthBudget?.categories || []}
          goals={budgetGoals}
          people={people}
          currentPersonId={currentPersonId}
          initialGoalId={selectedGoalForTx}
          initialCategoryId={selectedCategoryForTx}
          initialType={selectedGoalForTx ? 'goal' : initialTxType}
          initialTransaction={activeModal === 'edit-transaction' ? editingTransaction : null}
          onClose={() => {
            setActiveModal(null);
            setSelectedGoalForTx(null);
            setSelectedCategoryForTx(null);
            setInitialTxType('expense');
            setEditingTransaction(null);
          }}
          onSave={handleSaveTransaction}
        />
      )}

      {/* MODAL ZARZĄDZANIA KATEGORIAMI */}
      {activeModal === 'manage-categories' && (
        <ManageCategoriesModal
          categories={currentMonthBudget?.categories || []}
          categoryExpenseCounts={summary.categoryExpenseCounts}
          onClose={() => setActiveModal(null)}
          onSave={handleSaveCategories}
        />
      )}

      {/* MODAL ZARZĄDZANIA CELAMI FINANSOWYMI */}
      {activeModal === 'manage-goals' && (
        <ManageGoalsModal
          goals={budgetGoals}
          goalsProgressMap={goalsProgressMap}
          initialEditingGoalId={editingGoalId}
          onClose={() => {
            setActiveModal(null);
            setEditingGoalId(null);
          }}
          onSave={handleSaveGoals}
        />
      )}

      {/* MODAL ZOBOWIĄZANIA TERMINOWEGO / RAT 0% */}
      {(activeModal === 'add-obligation' || activeModal === 'edit-obligation') && (
        <ExpiringObligationModal
          initialObligation={activeModal === 'edit-obligation' ? editingObligation : null}
          onClose={() => {
            setActiveModal(null);
            setEditingObligation(null);
          }}
          onSave={handleSaveObligation}
        />
      )}
    </div>
  );
}
