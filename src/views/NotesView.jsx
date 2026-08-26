import { useState, useRef, useEffect } from 'react';
import {
  StickyNote,
  MoreVertical,
  Pencil,
  Trash2,
  CheckSquare,
  Calendar,
  MessageSquare,
  Check,
} from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';

function NoteCard({ note, onEdit, onDelete, onConvert, onToggleItem }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleAction = (actionFn) => {
    setMenuOpen(false);
    actionFn?.();
  };

  return (
    <div
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
      className="break-inside-avoid mb-4 border rounded-2xl p-4 flex flex-col justify-between relative group hover:border-stone-700 transition"
    >
      <div>
        <div className="flex items-center justify-between mb-2 relative">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-900/50 font-semibold">
            Prywatne
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition"
              title="Więcej opcji"
              aria-label="Więcej opcji"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div
                style={{ background: '#1E1E22', borderColor: '#33333C' }}
                className="absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-2xl py-1 z-30 animate-fadeIn text-xs text-stone-200 backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => handleAction(() => onEdit(note))}
                  className="w-full px-3 py-2 text-left hover:bg-stone-800 flex items-center gap-2.5 transition text-stone-200"
                >
                  <Pencil size={14} className="text-stone-400" />
                  <span>Edytuj</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAction(() => {
                      if (onConvert) {
                        onConvert(note, 'task');
                      } else {
                        console.log('Przekształć w Zadanie', note);
                      }
                    })
                  }
                  className="w-full px-3 py-2 text-left hover:bg-stone-800 flex items-center gap-2.5 transition text-stone-200"
                >
                  <CheckSquare size={14} className="text-amber-400" />
                  <span>Przekształć w Zadanie</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAction(() => {
                      if (onConvert) {
                        onConvert(note, 'event');
                      } else {
                        console.log('Przekształć w Wydarzenie', note);
                      }
                    })
                  }
                  className="w-full px-3 py-2 text-left hover:bg-stone-800 flex items-center gap-2.5 transition text-stone-200"
                >
                  <Calendar size={14} className="text-blue-400" />
                  <span>Przekształć w Wydarzenie</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAction(() => {
                      if (onConvert) {
                        onConvert(note, 'wall');
                      } else {
                        console.log('Opublikuj na tablicy', note);
                      }
                    })
                  }
                  className="w-full px-3 py-2 text-left hover:bg-stone-800 flex items-center gap-2.5 transition text-stone-200"
                >
                  <MessageSquare size={14} className="text-emerald-400" />
                  <span>Opublikuj na tablicy</span>
                </button>

                <div className="my-1 border-t border-stone-800" />

                <button
                  type="button"
                  onClick={() => handleAction(() => onDelete(note.id))}
                  className="w-full px-3 py-2 text-left hover:bg-red-950/40 flex items-center gap-2.5 transition text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} className="text-red-400" />
                  <span>Usuń</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {note.text && (
          <p className="text-sm whitespace-pre-wrap my-2 text-stone-200 leading-relaxed font-normal">
            {note.text}
          </p>
        )}

        {note.items?.length > 0 && (
          <div className="space-y-1.5 my-2.5">
            {note.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleItem(note.id, item.id)}
                className="flex items-center gap-2.5 w-full text-left group/item py-0.5"
              >
                <span
                  style={{
                    borderColor: item.done ? COLORS.success : COLORS.border,
                    background: item.done ? COLORS.success : 'transparent',
                  }}
                  className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition"
                >
                  {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                </span>
                <span
                  style={{ textDecoration: item.done ? 'line-through' : 'none' }}
                  className={`text-sm font-medium flex-1 transition ${
                    item.done ? 'text-stone-500' : 'text-stone-200'
                  }`}
                >
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-stone-800/80 mt-2 flex items-center justify-between">
        <span className="text-[10px] font-mono text-stone-500">
          {new Date(note.createdAt).toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

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
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {sorted.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onEdit={onEdit}
              onDelete={onDelete}
              onConvert={onConvert}
              onToggleItem={onToggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
