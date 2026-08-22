import { useState } from 'react';
import { Users, Plus, ChevronLeft } from 'lucide-react';
import { emptyData } from '../utils/constants.js';
import { PoweredByFooter } from '../components/ui/PoweredByFooter.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 border-stone-700';

export function FamilyOnboarding({ supabase, session, onFamilyJoined }) {
  const [mode, setMode] = useState('choose'); // choose, create, join
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const joinCode = genCode();
    try {
      const { data: fam, error: err1 } = await supabase
        .from('families')
        .insert({ name: name.trim(), join_code: joinCode })
        .select()
        .single();
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from('family_state')
        .insert({ family_id: fam.id, data: emptyData() });
      if (err2) throw err2;

      const { error: err3 } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, family_id: fam.id, person_id: null });
      if (err3) throw err3;

      onFamilyJoined(fam, { id: session.user.id, family_id: fam.id, person_id: null });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data: fam, error: err1 } = await supabase
        .from('families')
        .select('*')
        .eq('join_code', code.trim().toUpperCase())
        .single();
      if (err1 || !fam) throw new Error('Nie znaleziono rodziny z takim kodem.');

      const { error: err2 } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, family_id: fam.id, person_id: null });
      if (err2) throw err2;

      onFamilyJoined(fam, { id: session.user.id, family_id: fam.id, person_id: null });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-[#121214] text-stone-100 animate-fadeIn">
        <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-8 text-center">
            Dołącz do Rodziny
          </h2>
          <div className="w-full space-y-4">
            <button
              onClick={() => setMode('join')}
              className="w-full bg-[#1E1E22] border border-[#33333C] p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-amber-500/50 transition"
            >
              <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-amber-400">
                <Users size={24} />
              </div>
              <span className="font-bold text-lg">Mam kod od domownika</span>
              <span className="text-xs text-stone-400 text-center">
                Ktoś z Twojej rodziny założył już kalendarz i udostępnił Ci 6-znakowy kod.
              </span>
            </button>
            <button
              onClick={() => setMode('create')}
              className="w-full bg-[#1E1E22] border border-[#33333C] p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-amber-500/50 transition"
            >
              <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-amber-400">
                <Plus size={24} />
              </div>
              <span className="font-bold text-lg">Załóż nową rodzinę</span>
              <span className="text-xs text-stone-400 text-center">
                Jesteś tu pierwszy? Załóż wirtualny dom i wygeneruj kod dla pozostałych.
              </span>
            </button>
            <button onClick={async () => await supabase.auth.signOut()} className="w-full py-4 text-xs font-semibold text-stone-500 hover:text-stone-400 transition">
              Wyloguj mnie
            </button>
          </div>
        </div>
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <button onClick={() => setMode('choose')} className="mb-6 p-2 rounded-full bg-stone-900 text-stone-400 self-start hover:bg-stone-800 transition">
          <ChevronLeft size={24} />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'create') {
              handleCreate();
            } else {
              handleJoin();
            }
          }}
          className="w-full space-y-4 bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl"
        >
          <h2 className="text-xl font-bold mb-4">{mode === 'create' ? 'Nazwij swoją rodzinę' : 'Podaj kod dostępu'}</h2>
          {error && <div className="bg-red-950/50 border border-red-900 text-red-300 text-xs p-3 rounded-xl">{error}</div>}

          {mode === 'create' ? (
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Nazwa wyświetlana</label>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Rodzina Kowalskich"
                className={inputStyle}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Kod 6-znakowy</label>
              <input
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="np. A8F9K2"
                className={`${inputStyle} uppercase font-mono text-center tracking-widest text-lg`}
                maxLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition mt-4 disabled:opacity-50"
          >
            {loading ? 'Ładowanie...' : 'Dalej'}
          </button>
        </form>
      </div>
      <PoweredByFooter />
    </div>
  );
}
