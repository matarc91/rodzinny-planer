import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Plus, Trash2, Edit2, Check, Sparkles } from 'lucide-react';

const COMMON_EMOJIS = ['🛒', '👶', '🐕', '🔨', '🚗', '💊', '🎬', '👗', '✈️', '⚡', '☕', '📚', '🎁', '🍔', '🏋️', '🏠'];

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function ManageCategoriesModal({ categories = [], onClose, onSave }) {
  const [catList, setCatList] = useState(() => JSON.parse(JSON.stringify(categories)));
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editIcon, setEditIcon] = useState('🏷️');

  // Formularz nowej kategorii
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newIcon, setNewIcon] = useState('🛒');
  const [showAddForm, setShowAddForm] = useState(false);

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditLimit(cat.limit ? String(cat.limit) : '');
    setEditIcon(cat.icon || '🏷️');
  };

  const saveEdit = (id) => {
    if (!editName.trim()) return;
    const numLimit = parseFloat(editLimit.replace(',', '.'));
    setCatList((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: editName.trim(),
              limit: isNaN(numLimit) || numLimit < 0 ? 0 : numLimit,
              icon: editIcon || '🏷️',
            }
          : c
      )
    );
    setEditingId(null);
  };

  const deleteCategory = (id) => {
    setCatList((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCategory = (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    const numLimit = parseFloat(newLimit.replace(',', '.'));
    const newCat = {
      id: uid('cat'),
      name: newName.trim(),
      limit: isNaN(numLimit) || numLimit < 0 ? 0 : numLimit,
      icon: newIcon || '🏷️',
    };
    setCatList((prev) => [...prev, newCat]);
    setNewName('');
    setNewLimit('');
    setNewIcon('🛒');
    setShowAddForm(false);
  };

  const handleSaveAll = () => {
    onSave(catList);
    onClose();
  };

  return (
    <ModalShell title="Zarządzaj limitami kategorii" onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-xs text-stone-400">
          Zmiany limitów i kategorii zapisują się dla wybranego miesiąca bez wpływu na historię.
        </p>

        {/* Lista kategorii */}
        <div className="space-y-2">
          {catList.map((cat) => {
            const isEditing = editingId === cat.id;

            if (isEditing) {
              return (
                <div
                  key={cat.id}
                  style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                  className="p-3 rounded-xl border space-y-2.5"
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
                      placeholder="Nazwa kategorii"
                      style={{ borderColor: COLORS.border }}
                      className={inputStyle}
                    />
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        min="0"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        placeholder="Limit (PLN)"
                        style={{ borderColor: COLORS.border }}
                        className={`${inputStyle} pr-8 font-mono`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">zł</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveEdit(cat.id)}
                      style={{ background: COLORS.accent, color: '#121214' }}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow"
                    >
                      <Check size={14} /> Zapisz
                    </button>
                  </div>

                  {/* Szybki wybór emotki */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {COMMON_EMOJIS.slice(0, 8).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditIcon(emoji)}
                        className="w-7 h-7 text-xs bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center justify-center border border-stone-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={cat.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
                className="flex items-center justify-between p-3 rounded-xl border"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg w-7 text-center">{cat.icon || '🏷️'}</span>
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{cat.name}</div>
                    <div className="text-xs font-mono text-stone-400">
                      Limit: <span className="text-amber-400 font-bold">{cat.limit || 0} zł</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
                    title="Edytuj kategorię"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    className="p-2 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                    title="Usuń kategorię"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {catList.length === 0 && (
            <p className="text-xs text-stone-500 italic text-center py-3">
              Brak zdefiniowanych kategorii. Dodaj pierwszą poniżej.
            </p>
          )}
        </div>

        {/* Formularz dodawania nowej kategorii */}
        {showAddForm ? (
          <form
            onSubmit={handleAddCategory}
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="p-3.5 rounded-xl border space-y-3"
          >
            <div className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Nowa kategoria wydatków
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                maxLength={2}
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                className="w-10 text-center py-2 rounded-xl bg-stone-900 border border-stone-700 text-base"
              />
              <input
                type="text"
                required
                placeholder="np. Samochód, Apteka, Hobby..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ borderColor: COLORS.border }}
                className={inputStyle}
              />
            </div>

            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                required
                placeholder="Limit miesięczny (PLN)"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                style={{ borderColor: COLORS.border }}
                className={`${inputStyle} pr-8 font-mono`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">zł</span>
            </div>

            {/* Szybki wybór emotek */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewIcon(emoji)}
                  className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center border transition ${
                    newIcon === emoji ? 'bg-amber-500/20 border-amber-500/50' : 'bg-stone-900 border-stone-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 transition"
              >
                Anuluj
              </button>
              <button
                type="submit"
                style={{ background: COLORS.accent, color: '#121214' }}
                className="flex-1 py-2 rounded-xl text-xs font-bold shadow hover:opacity-90 transition"
              >
                Dodaj kategorię
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-stone-700 hover:border-amber-500/50 text-stone-300 hover:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition bg-stone-900/40"
          >
            <Plus size={15} /> Dodaj nową kategorię
          </button>
        )}

        {/* Zapisz wszystkie zmiany */}
        <div className="pt-2 border-t border-stone-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 transition"
          >
            Zamknij
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="w-2/3 py-2.5 rounded-xl text-xs font-bold shadow hover:opacity-90 transition"
          >
            Zatwierdź zmiany
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
