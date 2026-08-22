import { StickyNote, Pencil, Trash2, CheckSquare, Calendar, Check } from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export function NotesView({ notes, onDelete, onConvert, onEdit, onToggleItem }) {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="px-1">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">
          Notatki
        </h2>
        <p className="text-xs text-stone-400">Prywatne notatki i listy</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState text="Brak zapisanych notatek" icon={StickyNote} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((n) => (
            <div
              key={n.id}
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
              className="border rounded-2xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/30 text-amber-500 border border-amber-900/50 font-semibold flex items-center gap-1">
                    Prywatne
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(n)} className="p-1 text-stone-500 hover:text-stone-300">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(n.id)} className="p-1 text-stone-500 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {n.text && <p className="text-sm whitespace-pre-wrap my-1 text-stone-200">{n.text}</p>}
                {n.items?.length > 0 && (
                  <div className="space-y-1.5 my-2">
                    {n.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onToggleItem(n.id, item.id)}
                        className="flex items-center gap-2.5 w-full text-left"
                      >
                        <span
                          style={{
                            borderColor: item.done ? COLORS.success : COLORS.border,
                            background: item.done ? COLORS.success : 'transparent',
                          }}
                          className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                        >
                          {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                        </span>
                        <span
                          style={{ textDecoration: item.done ? 'line-through' : 'none' }}
                          className={`text-sm font-medium flex-1 ${item.done ? 'text-stone-500' : 'text-stone-100'}`}
                        >
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-stone-800 mt-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-stone-500">
                  {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onConvert(n, 'task')}
                    className="border border-stone-700 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800"
                  >
                    <CheckSquare size={12} /> Zadanie
                  </button>
                  <button
                    onClick={() => onConvert(n, 'event')}
                    className="border border-stone-700 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800"
                  >
                    <Calendar size={12} /> Wydarz.
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
