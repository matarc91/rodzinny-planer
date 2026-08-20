import { useState } from 'react';
import { Pin } from 'lucide-react';
import { COLORS, CARD_COLORS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Chip } from '../ui/Chip.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100';

export function AddWallMessageModal({ people, currentUserId, onClose, onSave }) {
  const [text, setText] = useState('');
  const [personId, setPersonId] = useState(currentUserId || people[0]?.id || '');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [isPinned, setIsPinned] = useState(false);

  const save = () => {
    if (text.trim()) {
      onSave({
        id: uid('w'),
        text: text.trim(),
        personId,
        color,
        isPinned,
        createdAt: new Date().toISOString(),
      });
      onClose();
    }
  };

  return (
    <ModalShell title="Wiadomość na tablicy" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wiadomość..."
            style={{ borderColor: COLORS.border }}
            className={`${inputStyle} h-28 resize-none`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Podpisane przez</label>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonId(p.id)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition ${
                  personId === p.id
                    ? 'bg-amber-400 text-stone-950 font-bold border-amber-400'
                    : 'bg-stone-800 text-stone-300 border-stone-700'
                }`}
              >
                <Chip person={p} size="sm" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Styl</label>
          <div className="flex gap-2">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-8 h-8 rounded-xl border transition ${
                  color === c ? 'border-amber-400 scale-110 ring-2' : 'border-stone-700'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="pinMsg"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700"
          />
          <label htmlFor="pinMsg" className="text-xs font-medium text-stone-300 flex items-center gap-1 cursor-pointer">
            <Pin size={14} className="text-amber-400" /> Przypnij na górze
          </label>
        </div>
        <button
          onClick={save}
          style={{ background: COLORS.accent, color: '#121214' }}
          className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2"
        >
          Przypnij
        </button>
      </div>
    </ModalShell>
  );
}
