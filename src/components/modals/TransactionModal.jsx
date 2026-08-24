import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { todayStr } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Chip } from '../ui/Chip.jsx';
import { TrendingDown, TrendingUp, Landmark, User, Target } from 'lucide-react';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function TransactionModal({
  monthKey,
  categories = [],
  goals = [],
  people = [],
  currentPersonId = null,
  initialGoalId = null,
  onClose,
  onSave,
  initialType = 'expense',
}) {
  const [type, setType] = useState(initialType); // 'expense' | 'fixedCost' | 'income'
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [goalId, setGoalId] = useState(initialGoalId || '');
  const [personId, setPersonId] = useState(currentPersonId || people[0]?.id || null);

  // Domyślna data: jeśli dziś należy do wybranego miesiąca -> dzisiaj, w przeciwnym razie 1. dzień wybranego miesiąca
  const [date, setDate] = useState(() => {
    const today = todayStr();
    if (monthKey && today.startsWith(monthKey)) {
      return today;
    }
    return monthKey ? `${monthKey}-01` : today;
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (type === 'expense') {
      const selectedCategory = categories.find((c) => c.id === categoryId);
      const selectedGoal = goals.find((g) => g.id === goalId);
      onSave('expense', {
        id: uid('exp'),
        amount: numAmount,
        date: date || `${monthKey}-01`,
        categoryId: categoryId || 'other',
        categoryName: selectedCategory ? selectedCategory.name : 'Inne',
        goalId: goalId || null,
        goalName: selectedGoal ? selectedGoal.name : null,
        goalIcon: selectedGoal ? selectedGoal.icon : null,
        description: title.trim(),
        personId: personId || null,
        createdAt: new Date().toISOString(),
      });
    } else if (type === 'fixedCost') {
      if (!title.trim()) return;
      onSave('fixedCost', {
        id: uid('fc'),
        title: title.trim(),
        amount: numAmount,
        personId: personId || null,
        createdAt: new Date().toISOString(),
      });
    } else if (type === 'income') {
      if (!title.trim()) return;
      onSave('income', {
        id: uid('inc'),
        title: title.trim(),
        amount: numAmount,
        personId: personId || null,
        createdAt: new Date().toISOString(),
      });
    }

    onClose();
  };

  const getTitle = () => {
    if (type === 'expense') return 'Dodaj wydatek';
    if (type === 'fixedCost') return 'Dodaj stały koszt';
    return 'Dodaj przychód';
  };

  return (
    <ModalShell title={getTitle()} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Przełącznik rodzaju operacji */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="grid grid-cols-3 p-1 rounded-xl border gap-1"
        >
          <button
            type="button"
            onClick={() => setType('expense')}
            style={{
              background: type === 'expense' ? COLORS.accent : 'transparent',
              color: type === 'expense' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition"
          >
            <TrendingDown size={14} />
            Wydatek
          </button>
          <button
            type="button"
            onClick={() => setType('fixedCost')}
            style={{
              background: type === 'fixedCost' ? COLORS.accent : 'transparent',
              color: type === 'fixedCost' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition"
          >
            <Landmark size={14} />
            Stały koszt
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            style={{
              background: type === 'income' ? COLORS.accent : 'transparent',
              color: type === 'income' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition"
          >
            <TrendingUp size={14} />
            Przychód
          </button>
        </div>

        {/* Wybór osoby / kto dodał */}
        {people && people.length > 0 && (
          <div>
            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-stone-400">
              <User size={13} className="text-amber-400" />
              Kto ponosi / otrzymuje?
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPersonId(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  personId === null
                    ? 'bg-stone-800 border-amber-500/50 text-amber-400'
                    : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-300'
                }`}
              >
                Cała rodzina
              </button>
              {people.map((p) => {
                const isSelected = personId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonId(p.id)}
                    style={{
                      borderColor: isSelected ? p.color : COLORS.border,
                      background: isSelected ? `${p.color}22` : COLORS.surfaceHighlight,
                      color: isSelected ? p.color : COLORS.inkSoft,
                    }}
                    className="px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Chip person={p} size="sm" />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Kwota */}
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">
            Kwota (PLN) <span className="text-amber-500">*</span>
          </label>
          <div className="relative">
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ borderColor: COLORS.border }}
              className={`${inputStyle} text-lg font-semibold pr-10`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
              zł
            </span>
          </div>
        </div>

        {/* Pola specyficzne dla Wydatku */}
        {type === 'expense' && (
          <>
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">
                Kategoria <span className="text-amber-500">*</span>
              </label>
              {categories.length > 0 ? (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{ borderColor: COLORS.border }}
                  className={`${inputStyle} cursor-pointer`}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-stone-900 text-stone-100">
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name} {c.limit ? `(Limit: ${c.limit} zł)` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-stone-400 italic">Brak zdefiniowanych kategorii w tym miesiącu.</p>
              )}
            </div>

            {/* Powiązanie z Celem Finansowym */}
            {goals && goals.length > 0 && (
              <div>
                <label className="text-xs font-semibold mb-1 flex items-center justify-between text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Target size={13} className="text-amber-400" />
                    Powiąż z celem finansowym (opcjonalnie)
                  </span>
                  {goalId && (
                    <button
                      type="button"
                      onClick={() => setGoalId('')}
                      className="text-[11px] text-stone-500 hover:text-stone-300"
                    >
                      Wyczyść
                    </button>
                  )}
                </label>
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  style={{ borderColor: COLORS.border }}
                  className={`${inputStyle} cursor-pointer`}
                >
                  <option value="" className="bg-stone-900 text-stone-400">
                    -- Standardowy wydatek (bez przypisania do celu) --
                  </option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id} className="bg-stone-900 text-stone-100">
                      {g.icon ? `${g.icon} ` : '🎯 '}
                      {g.name} {g.targetAmount ? `(Cel: ${g.targetAmount} zł)` : '(Cel: ∞ otwarty)'}
                      {g.isCompleted ? ' [Zakończony]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Data wydatku</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ borderColor: COLORS.border }}
                className={inputStyle}
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Opis (opcjonalnie)</label>
              <input
                type="text"
                placeholder="np. Zakupy spożywcze, weterynarz..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ borderColor: COLORS.border }}
                className={inputStyle}
              />
            </div>
          </>
        )}

        {/* Pola dla Kosztu Stałego / Przychodu */}
        {(type === 'fixedCost' || type === 'income') && (
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">
              {type === 'fixedCost' ? 'Nazwa kosztu stałego' : 'Źródło / Tytuł przychodu'}{' '}
              <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={type === 'fixedCost' ? 'np. Czynsz, Rata kredytu, Internet' : 'np. Wypłata, Działalność, Premia'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ borderColor: COLORS.border }}
              className={inputStyle}
            />
          </div>
        )}

        <button
          type="submit"
          style={{ background: COLORS.accent, color: '#121214' }}
          className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2 cursor-pointer"
        >
          {type === 'expense' && 'Zapisz wydatek'}
          {type === 'fixedCost' && 'Dodaj koszt stały'}
          {type === 'income' && 'Dodaj przychód'}
        </button>
      </form>
    </ModalShell>
  );
}
