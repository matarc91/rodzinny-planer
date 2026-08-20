import { useState } from 'react';
import { Check, UserCheck } from 'lucide-react';
import { COLORS, PERSON_PALETTE, AVATAR_EMOJIS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100';

export function PersonModal({ editPerson, existingCount, isCurrentProfile, onSelectAsMyProfile, onClose, onSave }) {
  const [name, setName] = useState(editPerson?.name || '');
  const [color, setColor] = useState(editPerson?.color || PERSON_PALETTE[existingCount % PERSON_PALETTE.length]);
  const [emoji, setEmoji] = useState(editPerson?.emoji || '👨');

  const save = () => {
    if (name.trim()) {
      onSave({ id: editPerson?.id || uid('p'), name: name.trim(), color, emoji });
      onClose();
    }
  };

  return (
    <ModalShell title={editPerson ? 'Edytuj członka rodziny' : 'Dodaj osobę'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Imię / Rola</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ borderColor: COLORS.border }}
            className={inputStyle}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-stone-400">Ikona</label>
          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-stone-900 border border-stone-800">
            {AVATAR_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                  emoji === em ? 'bg-stone-800 shadow-md scale-110' : 'hover:bg-stone-800/50'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-stone-400">Kolor</label>
          <div className="flex flex-wrap gap-2">
            {PERSON_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'opacity-80'
                }`}
              />
            ))}
          </div>
        </div>

        {editPerson && onSelectAsMyProfile && (
          <div className="pt-2 border-t border-[#33333C]">
            {isCurrentProfile ? (
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Check size={15} className="text-amber-400" /> To Twoje aktualne konto (To ja)
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSelectAsMyProfile();
                  onClose();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-stone-900 border border-amber-500/40 hover:bg-amber-500/10 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <UserCheck size={16} className="text-amber-400" />
                Ustaw ten profil jako mój (To ja)
              </button>
            )}
          </div>
        )}

        <button
          onClick={save}
          style={{ background: COLORS.accent, color: '#121214' }}
          className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2"
        >
          {editPerson ? 'Zapisz' : 'Dodaj osobę'}
        </button>
      </div>
    </ModalShell>
  );
}
