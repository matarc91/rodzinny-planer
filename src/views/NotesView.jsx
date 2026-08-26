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
import { migrateNoteToTipTapFormat } from '../utils/noteMigration.js';

function RenderMarks({ text, marks }) {
  if (!marks || marks.length === 0) return text;
  let element = text;
  marks.forEach((mark) => {
    if (mark.type === 'bold') element = <strong className="font-bold text-stone-100">{element}</strong>;
    if (mark.type === 'italic') element = <em className="italic">{element}</em>;
    if (mark.type === 'code')
      element = (
        <code className="bg-stone-950 px-1 py-0.5 rounded text-[11px] font-mono text-amber-300 border border-stone-800">
          {element}
        </code>
      );
  });
  return element;
}

function RenderInlineContent({ content }) {
  if (!content || !Array.isArray(content)) return null;
  return content.map((child, idx) => {
    if (child.type === 'text') {
      return <RenderMarks key={idx} text={child.text} marks={child.marks} />;
    }
    return null;
  });
}

function TipTapDocRenderer({ doc, noteId, onToggleItem }) {
  if (!doc || !Array.isArray(doc.content)) return null;

  let taskCounter = 0;

  const renderNode = (node, index) => {
    if (!node) return null;

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const headingClasses =
          level === 1
            ? 'text-base font-bold text-stone-100 my-2'
            : level === 2
            ? 'text-sm font-semibold text-stone-200 my-1.5'
            : 'text-xs font-semibold text-stone-300 my-1';
        return (
          <div key={index} className={headingClasses}>
            <RenderInlineContent content={node.content} />
          </div>
        );
      }

      case 'paragraph': {
        if (!node.content || node.content.length === 0) {
          return <div key={index} className="h-2" />;
        }
        return (
          <p key={index} className="text-xs text-stone-300 leading-relaxed my-1">
            <RenderInlineContent content={node.content} />
          </p>
        );
      }

      case 'taskList': {
        return (
          <div key={index} className="space-y-1.5 my-2">
            {(node.content || []).map((taskNode, taskIdx) => {
              const currentTaskIndex = taskCounter++;
              const isChecked = Boolean(taskNode.attrs?.checked);
              return (
                <button
                  key={taskIdx}
                  type="button"
                  onClick={() => onToggleItem?.(noteId, currentTaskIndex)}
                  className="flex items-start gap-2.5 w-full text-left group/task py-0.5 transition"
                >
                  <span
                    style={{
                      borderColor: isChecked ? COLORS.success : '#57534e',
                      backgroundColor: isChecked ? COLORS.success : '#1c1917',
                    }}
                    className="w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition hover:border-amber-400"
                  >
                    {isChecked && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-xs leading-snug flex-1 transition ${
                      isChecked ? 'line-through text-stone-500' : 'text-stone-200 font-medium'
                    }`}
                  >
                    {(taskNode.content || []).map((p, pIdx) => (
                      <span key={pIdx}>
                        <RenderInlineContent content={p.content} />
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        );
      }

      case 'bulletList': {
        return (
          <ul key={index} className="list-disc list-inside space-y-1 my-1.5 text-stone-300 text-xs">
            {(node.content || []).map((li, liIdx) => (
              <li key={liIdx}>
                {(li.content || []).map((p, pIdx) => (
                  <span key={pIdx}>
                    <RenderInlineContent content={p.content} />
                  </span>
                ))}
              </li>
            ))}
          </ul>
        );
      }

      case 'orderedList': {
        return (
          <ol key={index} className="list-decimal list-inside space-y-1 my-1.5 text-stone-300 text-xs">
            {(node.content || []).map((li, liIdx) => (
              <li key={liIdx}>
                {(li.content || []).map((p, pIdx) => (
                  <span key={pIdx}>
                    <RenderInlineContent content={p.content} />
                  </span>
                ))}
              </li>
            ))}
          </ol>
        );
      }

      case 'blockquote': {
        return (
          <blockquote
            key={index}
            className="border-l-2 border-amber-500/70 pl-2.5 my-2 text-xs italic text-stone-300 bg-amber-950/20 py-1 rounded-r-lg"
          >
            {(node.content || []).map((p, pIdx) => (
              <p key={pIdx} className="my-0.5">
                <RenderInlineContent content={p.content} />
              </p>
            ))}
          </blockquote>
        );
      }

      case 'codeBlock': {
        const rawCode = (node.content || []).map((c) => c.text || '').join('');
        return (
          <pre
            key={index}
            className="bg-stone-950/90 border border-stone-800/80 rounded-xl p-2.5 my-2 text-[11px] font-mono text-amber-300 overflow-x-auto"
          >
            <code>{rawCode}</code>
          </pre>
        );
      }

      case 'horizontalRule': {
        return <hr key={index} className="border-stone-800 my-2.5" />;
      }

      default:
        return null;
    }
  };

  return <div className="space-y-0.5">{doc.content.map(renderNode)}</div>;
}

function NoteCard({ note, onEdit, onDelete, onConvert, onToggleItem }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const doc = migrateNoteToTipTapFormat(note);

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
      className="break-inside-avoid mb-4 border rounded-2xl p-4 flex flex-col justify-between relative group hover:border-stone-700 transition shadow-sm"
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

        {/* Dynamic TipTap AST Content Renderer */}
        <div className="my-2">
          <TipTapDocRenderer doc={doc} noteId={note.id} onToggleItem={onToggleItem} />
        </div>
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
        <p className="text-xs text-stone-400">Prywatne notatki, listy i szybkie zapiski</p>
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
