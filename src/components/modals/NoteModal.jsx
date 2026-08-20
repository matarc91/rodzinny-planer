import { useState } from 'react';
import { Info } from 'lucide-react';
import { COLORS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { ChecklistContainer } from '../ui/ChecklistContainer.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100';

export function NoteModal({ editItem, currentUserId, onClose, onSave }) {
  const isEdit = !editItem;
  const [text, setText] = useState(editItem?.text || '');
  const [items, setItems] = useState(editItem?.items || []);

  const save = () => {
    if (!text.trim() && items.length === 0) return;
    onSave({
      id: editItem?.id || uid('note'),
      text: text.trim(),
      items,
      createdAt: editItem?.createdAt || new Date().toISOString(),
      personId: editItem?.personId || currentUserId,
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj notatkę' : 'Nowa notatka'} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-3 flex items-start gap-2 text-amber-200/80 text-xs">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>
            Notatki są <b>prywatne</b> i widoczne tylko dla Ciebie. Inni domownicy zobaczą je dopiero, gdy zamienisz je w
            Zadanie lub Wydarzenie.
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Treść</label>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ borderColor: COLORS.border }}
            className={`${inputStyle} h-24 resize-none`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Lista pozycji</label>
          <ChecklistContainer
            items={items}
            onToggleItem={(id) => setItems((p) => p.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))}
            onAddItem={(text) => setItems((p) => [...p, { id: uid('it'), text, done: false }])}
            onRemoveItem={(id) => setItems((p) => p.filter((i) => i.id !== id))}
          />
        </div>
        <button
          onClick={save}
          style={{ background: COLORS.accent, color: '#121214' }}
          className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2"
        >
          {isEdit ? 'Zapisz' : 'Zapisz notatkę'}
        </button>
      </div>
    </ModalShell>
  );
}
