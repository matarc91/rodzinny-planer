import { useState } from 'react';
import { Check, ArrowRight, UserPlus, X } from 'lucide-react';
import { Chip } from '../components/ui/Chip.jsx';
import { AppLogo } from '../components/ui/AppLogo.jsx';
import { PoweredByFooter } from '../components/ui/PoweredByFooter.jsx';
import { PERSON_PALETTE, AVATAR_EMOJIS, uid, COLORS } from '../utils/constants.js';

export function ProfileSelection({ supabase, profile, data, onProfileSelected, onCreatePerson }) {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Stan formularza nowej osoby
  const [name, setName] = useState('');
  const [color, setColor] = useState(PERSON_PALETTE[0]);
  const [emoji, setEmoji] = useState('👨');

  const handleSelect = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({ person_id: selectedId }).eq('id', profile.id);
      onProfileSelected(selectedId);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCreateAndSelect = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const newPerson = {
        id: uid('p'),
        name: name.trim(),
        color,
        emoji,
      };

      if (onCreatePerson) {
        await onCreatePerson(newPerson);
      } else {
        // Fallback
        await supabase.from('profiles').update({ person_id: newPerson.id }).eq('id', profile.id);
        onProfileSelected(newPerson.id);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <AppLogo className="w-16 h-16 rounded-2xl shadow-lg shadow-amber-900/20 mb-6" iconSize={32} />
        <div className="w-full bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl space-y-4">
          <div>
            <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold mb-1">
              Kim jesteś?
            </h2>
            <p className="text-xs text-stone-400">
              Wybierz swój profil z poniższej listy lub utwórz nowy, aby aplikacja mogła Cię rozpoznawać.
            </p>
          </div>

          {!isCreating ? (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {data?.people?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full p-3.5 rounded-2xl flex items-center gap-3.5 transition border ${
                      selectedId === p.id
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : 'bg-stone-900 border-stone-800 hover:bg-stone-800 text-stone-200'
                    }`}
                  >
                    <Chip person={p} size="lg" />
                    <span className="font-bold text-sm text-left flex-1 truncate">{p.name}</span>
                    {selectedId === p.id && <Check size={18} className="text-amber-500 shrink-0" />}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-stone-900 border border-dashed border-stone-700 hover:border-amber-500/60 text-xs font-semibold text-stone-300 hover:text-amber-300 flex items-center justify-center gap-2 transition"
              >
                <UserPlus size={15} />
                + Dodaj swój profil domownika
              </button>

              <button
                onClick={handleSelect}
                disabled={!selectedId || loading}
                className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
              >
                {loading ? 'Zapisywanie...' : 'Wejdź do aplikacji'} <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <form onSubmit={handleCreateAndSelect} className="space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-stone-800">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <UserPlus size={14} /> Nowy domownik
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1 text-stone-400 hover:text-stone-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-stone-400">Imię / Rola</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. Ania, Kuba, Dziadek"
                  className="w-full border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm bg-stone-900 text-stone-100 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-stone-400">Ikona (Awatar)</label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-stone-900 border border-stone-800">
                  {AVATAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition ${
                        emoji === em ? 'bg-stone-800 shadow-md scale-110' : 'hover:bg-stone-800/50'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-stone-400">Kolor profilu</label>
                <div className="flex flex-wrap gap-1.5">
                  {PERSON_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-700 text-xs font-semibold text-stone-300 hover:bg-stone-800 transition"
                >
                  Wróć
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || loading}
                  style={{ background: COLORS.accent, color: '#121214' }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-50 shadow hover:opacity-90"
                >
                  {loading ? 'Tworzenie...' : 'Utwórz i wejdź'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <PoweredByFooter />
    </div>
  );
}

export default ProfileSelection;
