import { useState } from 'react';
import { Key, AlertCircle } from 'lucide-react';
import { PoweredByFooter } from '../components/ui/PoweredByFooter.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 border-stone-700';

export function ResetPasswordScreen({ supabase, onComplete }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Hasła nie są identyczne.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setSuccess(true);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Wystąpił błąd podczas zapisywania nowego hasła.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6 shadow-lg shadow-amber-900/20">
        <Key size={32} />
      </div>
      <h1 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-2">
        Ustaw nowe hasło
      </h1>
      <p className="text-sm text-stone-400 mb-8 text-center max-w-xs">Wprowadź i powtórz swoje nowe hasło dostępowe.</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl space-y-4"
      >
        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-300 text-sm p-4 rounded-xl text-center font-semibold">
            ✓ Hasło zostało zmienione! Przekierowywanie do aplikacji...
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Nowe hasło (min. 6 znaków)</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Powtórz nowe hasło</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
            </button>
          </>
        )}
      </form>
      <PoweredByFooter />
    </div>
  );
}
