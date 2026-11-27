import { Plus, Pencil, Trash2, Calendar, TrendingUp, Landmark, TrendingDown } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Chip } from '../ui/Chip.jsx';

export function BudgetDetailsModal({
  mode, // 'category' | 'incomes' | 'fixedCosts'
  category = null, // { id, name, icon, spent, limit, percent, isExceeded, diff, isFallback }
  items = [], // expenses / incomes / fixedCosts
  people = [],
  onClose,
  onAdd,
  onEdit,
  onDelete,
}) {
  const formatPLN = (val) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2,
    }).format(val || 0);

  const getPerson = (pId) => {
    if (!pId) return null;
    return people.find((p) => p.id === pId) || null;
  };

  const totalAmount = items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const getModalTitle = () => {
    if (mode === 'incomes') return 'Przychody w miesiącu';
    if (mode === 'fixedCosts') return 'Koszty stałe w miesiącu';
    if (mode === 'category' && category) return `${category.icon || '🏷️'} ${category.name}`;
    return 'Szczegóły';
  };

  const addLabel =
    mode === 'incomes'
      ? 'Dodaj przychód'
      : mode === 'fixedCosts'
      ? 'Dodaj koszt stały'
      : 'Dodaj wydatek';

  const headerAction = (
    <button
      type="button"
      onClick={onAdd}
      style={{ background: COLORS.accent, color: '#121214' }}
      className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow hover:opacity-90 transition cursor-pointer"
    >
      <Plus size={14} />
      <span>{addLabel}</span>
    </button>
  );

  return (
    <ModalShell title={getModalTitle()} onClose={onClose} headerAction={headerAction} maxWidth="sm:max-w-lg">
      <div className="space-y-4">
        {/* Podsumowanie nagłówkowe */}
        {mode === 'category' && category && !category.isFallback ? (
          <div
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="p-3.5 rounded-xl border space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-stone-400">
                Wykorzystano ({items.length} {items.length === 1 ? 'operacja' : items.length < 5 ? 'operacje' : 'operacji'})
              </span>
              <div>
                <span className={category.isExceeded ? 'text-rose-400 font-bold' : 'text-stone-100 font-bold'}>
                  {formatPLN(category.spent)}
                </span>
                <span className="text-stone-500 mx-1">/</span>
                <span className="text-stone-400">{formatPLN(category.limit)}</span>
              </div>
            </div>
            <div className="w-full bg-stone-900 rounded-full h-2.5 overflow-hidden border border-stone-800">
              <div
                style={{
                  width: `${Math.min(100, Math.max(2, category.percent))}%`,
                  backgroundColor: category.isExceeded ? COLORS.warn : COLORS.accent,
                }}
                className="h-full rounded-full transition-all duration-300"
              />
            </div>
          </div>
        ) : (
          <div
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="p-3.5 rounded-xl border flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-xs text-stone-400">
              {mode === 'incomes' ? (
                <TrendingUp size={15} className="text-emerald-400" />
              ) : mode === 'fixedCosts' ? (
                <Landmark size={15} className="text-orange-400" />
              ) : (
                <TrendingDown size={15} className="text-amber-400" />
              )}
              <span>
                Łącznie ({items.length} {items.length === 1 ? 'pozycja' : items.length < 5 ? 'pozycje' : 'pozycji'})
              </span>
            </div>
            <span
              className={`font-mono text-sm font-bold ${
                mode === 'incomes' ? 'text-emerald-400' : 'text-stone-100'
              }`}
            >
              {mode === 'incomes' ? '+' : ''}
              {formatPLN(totalAmount)}
            </span>
          </div>
        )}

        {/* Lista operacji */}
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {items.map((item) => {
            const person = getPerson(item.personId);
            const itemTitle = item.description || item.title || item.categoryName || 'Operacja';
            const isIncome = mode === 'incomes';

            return (
              <div
                key={item.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                className="p-3 rounded-xl border flex items-center justify-between gap-2.5 hover:border-stone-700 transition"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-semibold text-stone-100 truncate">{itemTitle}</div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-400">
                    {item.date && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Calendar size={11} /> {item.date}
                      </span>
                    )}
                    {!item.date && (mode === 'incomes' || mode === 'fixedCosts') && (
                      <span className="px-1.5 py-0.5 rounded bg-stone-800/80 border border-stone-700/50 text-stone-300">
                        Stały (przenoszony co msc)
                      </span>
                    )}
                    {person && (
                      <span
                        style={{
                          borderColor: `${person.color}40`,
                          background: `${person.color}15`,
                          color: person.color,
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-medium"
                      >
                        <Chip person={person} size="sm" />
                        <span>{person.name}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono text-sm font-bold whitespace-nowrap ${
                      isIncome ? 'text-emerald-400' : 'text-stone-100'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatPLN(item.amount)}
                  </span>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Edytuj"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Usuń"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-8 text-stone-500 text-xs italic border border-dashed border-stone-800 rounded-xl">
              Brak zapisanych pozycji w tej sekcji dla wybranego miesiąca.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
