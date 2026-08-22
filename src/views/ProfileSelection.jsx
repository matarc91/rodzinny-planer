import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Chip } from '../components/ui/Chip.jsx';
import { PoweredByFooter } from '../components/ui/PoweredByFooter.jsx';

export function ProfileSelection({ supabase, profile, data, onProfileSelected }) {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl">
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold mb-2">
            Kim jesteś?
          </h2>
          <p className="text-xs text-stone-400 mb-6">
            Wybierz swój profil z poniższej listy, aby aplikacja mogła Cię rozpoznawać.
          </p>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto pr-2">
            {data?.people?.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition border ${
                  selectedId === p.id ? 'bg-amber-500/10 border-amber-500' : 'bg-stone-900 border-stone-800 hover:bg-stone-800'
                }`}
              >
                <Chip person={p} size="lg" />
                <span className="font-bold text-sm">{p.name}</span>
                {selectedId === p.id && <Check size={20} className="ml-auto text-amber-500" />}
              </button>
            ))}
          </div>

          <button
            onClick={handleSelect}
            disabled={!selectedId || loading}
            className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Wejdź do aplikacji <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <PoweredByFooter />
    </div>
  );
}
