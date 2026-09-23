import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Plus, Trash2, Edit2, Check, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';

const COMMON_GOAL_EMOJIS = ['💰', '🛡️', '💼', '👛', '📈', '🏠', '🏖️', '🚗', '🏡', '👶', '🎁', '🎓', '💻', '💍', '🚴', '📱', '✈️', '⚡', '🐾', '🎯'];

export const GOAL_PRESETS = [
  { name: 'Poduszka finansowa', icon: '🛡️', target: 50000, isInfinite: false },
  { name: 'IKZE Mąż (JDG)', icon: '💼', target: 14083, isInfinite: false },
  { name: 'IKZE Żona (Etat)', icon: '👛', target: 9389, isInfinite: false },
  { name: 'Portfel ETF', icon: '📈', target: null, isInfinite: true },
  { name: 'Nadpłata hipoteki', icon: '🏠', target: null, isInfinite: true },
  { name: 'Wakacje', icon: '🏖️', target: 10000, isInfinite: false },
];

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function ManageGoalsModal({
  goals = [],
  goalsProgressMap = {},
  initialEditingGoalId = null,
  onClose,
  onSave,
}) {
  const [goalList, setGoalList] = useState(() => JSON.parse(JSON.stringify(goals)));
  const initialTargetGoal = goals.find((g) => g.id === initialEditingGoalId);
  const [editingId, setEditingId] = useState(() => initialEditingGoalId || null);
  const [editName, setEditName] = useState(() => initialTargetGoal?.name || '');
  const [editTarget, setEditTarget] = useState(() => (initialTargetGoal?.targetAmount ? String(initialTargetGoal.targetAmount) : ''));
  const [editInitial, setEditInitial] = useState(() => (initialTargetGoal?.initialAmount ? String(initialTargetGoal.initialAmount) : ''));
  const [editIsInfinite, setEditIsInfinite] = useState(() =>
    initialTargetGoal ? (initialTargetGoal.targetAmount === null || initialTargetGoal.targetAmount === undefined || initialTargetGoal.targetAmount <= 0) : false
  );
  const [editIcon, setEditIcon] = useState(() => initialTargetGoal?.icon || '💰');

  // Formularz nowego celu
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newInitial, setNewInitial] = useState('');
  const [newIsInfinite, setNewIsInfinite] = useState(false);
  const [newIcon, setNewIcon] = useState('💰');
  const [showAddForm, setShowAddForm] = useState(false);

  const startEdit = (goal) => {
    setEditingId(goal.id);
    setEditName(goal.name);
    setEditIsInfinite(goal.targetAmount === null || goal.targetAmount === undefined || goal.targetAmount <= 0);
    setEditTarget(goal.targetAmount ? String(goal.targetAmount) : '');
    setEditInitial(goal.initialAmount ? String(goal.initialAmount) : '');
    setEditIcon(goal.icon || '💰');
  };

  const saveEdit = (id) => {
    if (!editName.trim()) return;
    let targetAmount = null;
    if (!editIsInfinite) {
      const num = parseFloat(editTarget.replace(',', '.'));
      targetAmount = isNaN(num) || num <= 0 ? null : num;
    }
    const initNum = parseFloat(editInitial.replace(',', '.'));
    const initialAmount = isNaN(initNum) || initNum <= 0 ? 0 : initNum;

    setGoalList((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              name: editName.trim(),
              targetAmount,
              initialAmount,
              icon: editIcon || '💰',
            }
          : g
      )
    );
    setEditingId(null);
  };

  const toggleCompleteGoal = (id) => {
    setGoalList((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const nowCompleted = !g.isCompleted;
        return {
          ...g,
          isCompleted: nowCompleted,
          completedAt: nowCompleted ? new Date().toISOString() : null,
        };
      })
    );
  };

  const deleteGoal = (id) => {
    setGoalList((prev) => prev.filter((g) => g.id !== id));
  };

  const handleAddGoal = (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    let targetAmount = null;
    if (!newIsInfinite) {
      const num = parseFloat(newTarget.replace(',', '.'));
      targetAmount = isNaN(num) || num <= 0 ? null : num;
    }

    const initNum = parseFloat(newInitial.replace(',', '.'));
    const initialAmount = isNaN(initNum) || initNum <= 0 ? 0 : initNum;

    const newGoal = {
      id: uid('goal'),
      name: newName.trim(),
      targetAmount,
      initialAmount,
      icon: newIcon || '💰',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    setGoalList((prev) => [...prev, newGoal]);
    setNewName('');
    setNewTarget('');
    setNewInitial('');
    setNewIsInfinite(false);
    setNewIcon('💰');
    setShowAddForm(false);
  };

  const handleSaveAll = () => {
    onSave(goalList);
    onClose();
  };

  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <ModalShell title="Zarządzaj celami finansowymi" onClose={onClose}>
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
        <p className="text-xs text-stone-400">
          Cele finansowe działają globalnie i nie resetują się z nowym miesiącem. Wydatki i oszczędności przypisane do celu sumują się aż do jego zakończenia.
        </p>

        {/* Lista celów */}
        <div className="space-y-2.5">
          {goalList.map((goal) => {
            const isEditing = editingId === goal.id;
            const spent = goalsProgressMap[goal.id] || 0;
            const hasTarget = goal.targetAmount !== null && goal.targetAmount !== undefined && goal.targetAmount > 0;

            if (isEditing) {
              return (
                <div
                  key={goal.id}
                  style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                  className="p-3.5 rounded-xl border space-y-3"
                >
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      maxLength={2}
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="w-10 text-center py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-base"
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nazwa celu (np. Wakacje)"
                      style={{ borderColor: COLORS.border }}
                      className={inputStyle}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editIsInfinite}
                        onChange={(e) => setEditIsInfinite(e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Cel otwarty / bez kwoty docelowej (∞)</span>
                    </label>

                    {!editIsInfinite && (
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="1"
                          min="1"
                          value={editTarget}
                          onChange={(e) => setEditTarget(e.target.value)}
                          placeholder="Kwota docelowa (PLN)"
                          style={{ borderColor: COLORS.border }}
                          className={`${inputStyle} pr-8`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-semibold">
                          zł
                        </span>
                      </div>
                    )}

                    <div className="relative">
                      <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                        Stan początkowy / odłożone wcześniej (opcjonalnie)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        min="0"
                        value={editInitial}
                        onChange={(e) => setEditInitial(e.target.value)}
                        placeholder="0 zł"
                        style={{ borderColor: COLORS.border }}
                        className={`${inputStyle} pr-8`}
                      />
                      <span className="absolute right-3 top-[27px] text-xs text-stone-500 font-semibold">
                        zł
                      </span>
                    </div>
                  </div>

                  {/* Szybkie wybieranie ikon */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {COMMON_GOAL_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditIcon(emoji)}
                        className={`w-7 h-7 text-sm rounded-lg flex items-center justify-center transition ${
                          editIcon === emoji ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-stone-900 hover:bg-stone-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-stone-800">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-400 hover:text-stone-200"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(goal.id)}
                      style={{ background: COLORS.accent, color: '#121214' }}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Check size={14} /> Zapisz cel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={goal.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                  goal.isCompleted ? 'opacity-70 border-emerald-500/30' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl shrink-0">{goal.icon || '💰'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${goal.isCompleted ? 'line-through text-stone-400' : 'text-stone-100'}`}>
                        {goal.name}
                      </span>
                      {goal.isCompleted && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold border border-emerald-500/30 shrink-0 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Zakończony
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span>
                        Zgromadzono: <b className="text-stone-200">{formatPLN(spent + (Number(goal.initialAmount) || 0))}</b>
                      </span>
                      {Number(goal.initialAmount) > 0 && (
                        <span className="text-[10px] text-stone-500 font-mono">
                          (w tym start: {formatPLN(goal.initialAmount)})
                        </span>
                      )}
                      <span>•</span>
                      <span>Cel: <b className="text-amber-400 font-mono">{hasTarget ? formatPLN(goal.targetAmount) : '∞ (otwarty)'}</b></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCompleteGoal(goal.id)}
                    className={`p-1.5 rounded-lg transition ${
                      goal.isCompleted
                        ? 'text-emerald-400 hover:bg-emerald-500/20'
                        : 'text-stone-400 hover:text-emerald-400 hover:bg-stone-800'
                    }`}
                    title={goal.isCompleted ? 'Wznów cel' : 'Zakończ cel jako zrealizowany'}
                  >
                    {goal.isCompleted ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(goal)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition"
                    title="Edytuj cel"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition"
                    title="Usuń cel"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {goalList.length === 0 && (
            <div className="text-center py-6 border border-dashed border-stone-800 rounded-xl bg-stone-900/30">
              <p className="text-xs text-stone-400 italic">Brak zdefiniowanych celów finansowych.</p>
            </div>
          )}
        </div>

        {/* Dodawanie nowego celu */}
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            style={{ borderColor: COLORS.border }}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-bold text-amber-400 hover:bg-stone-800/60 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            Dodaj nowy cel finansowy
          </button>
        ) : (
          <form
            onSubmit={handleAddGoal}
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="p-4 rounded-xl border space-y-3 animate-fadeIn"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Sparkles size={14} /> Nowy cel finansowy
              </span>
            </div>

            {/* Szybkie szablony celów */}
            <div>
              <span className="text-[11px] text-stone-400 block mb-1">Popularne szablony celów:</span>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setNewName(preset.name);
                      setNewIcon(preset.icon);
                      setNewIsInfinite(preset.isInfinite);
                      setNewTarget(preset.target ? String(preset.target) : '');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                maxLength={2}
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                className="w-10 text-center py-2 rounded-lg bg-stone-900 border border-stone-700 text-base"
              />
              <input
                type="text"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="np. Oszczędności, Wakacje 2026, Auto"
                style={{ borderColor: COLORS.border }}
                className={inputStyle}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newIsInfinite}
                  onChange={(e) => setNewIsInfinite(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Cel bez limitu kwotowego (odkładanie bez limitu ∞)</span>
              </label>

              {!newIsInfinite && (
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="1"
                    required={!newIsInfinite}
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="Kwota docelowa (np. 5000)"
                    style={{ borderColor: COLORS.border }}
                    className={`${inputStyle} pr-8`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-semibold">
                    zł
                  </span>
                </div>
              )}

              <div className="relative">
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  Stan początkowy / odłożone wcześniej (opcjonalnie)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={newInitial}
                  onChange={(e) => setNewInitial(e.target.value)}
                  placeholder="0 zł"
                  style={{ borderColor: COLORS.border }}
                  className={`${inputStyle} pr-8`}
                />
                <span className="absolute right-3 top-[27px] text-xs text-stone-500 font-semibold">
                  zł
                </span>
              </div>
            </div>

            {/* Popularne emotikony */}
            <div>
              <span className="text-[11px] text-stone-400 block mb-1">Wybierz ikonkę:</span>
              <div className="flex flex-wrap gap-1">
                {COMMON_GOAL_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewIcon(emoji)}
                    className={`w-7 h-7 text-sm rounded-lg flex items-center justify-center transition ${
                      newIcon === emoji ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-stone-900 hover:bg-stone-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-400 hover:text-stone-200"
              >
                Anuluj
              </button>
              <button
                type="submit"
                style={{ background: COLORS.accent, color: '#121214' }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold shadow hover:opacity-90 transition"
              >
                Dodaj cel
              </button>
            </div>
          </form>
        )}

        {/* Zapisz wszystkie zmiany */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveAll}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check size={16} />
            Zapisz cele finansowe
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
