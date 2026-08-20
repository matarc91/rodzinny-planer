import { useState } from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { AppLogo } from '../components/ui/AppLogo.jsx';
import { PoweredByFooter } from '../components/ui/PoweredByFooter.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 border-stone-700';

export function AuthScreen({ supabase }) {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (authMode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else if (authMode === 'register') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccessMessage(
          'Konto zostało utworzone! Jeśli w połączonym projekcie Supabase włączono weryfikację e-mail, wysłano wiadomość z potwierdzeniem na Twój adres e-mail (sprawdź też folder SPAM).'
        );
      } else if (authMode === 'forgot') {
        if (!email.trim()) {
          throw new Error('Podaj swój adres e-mail.');
        }
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        setSuccessMessage(
          'Wysłano wiadomość z linkiem do resetowania hasła! Sprawdź swoją skrzynkę odbiorczą oraz folder SPAM.'
        );
      }
    } catch (err) {
      setError(err.message || 'Wystąpił błąd.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <AppLogo className="w-16 h-16 rounded-2xl shadow-lg shadow-amber-900/20 mb-6" iconSize={32} />
      <h1 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-2">
        Rodzinny Planer
      </h1>
      <p className="text-sm text-stone-400 mb-8 text-center max-w-xs">
        Współdziel kalendarz i obowiązki z całą rodziną w jednym miejscu.
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl"
      >
        <h2 className="text-lg font-bold mb-1">
          {authMode === 'login' && 'Zaloguj się'}
          {authMode === 'register' && 'Utwórz darmowe konto'}
          {authMode === 'forgot' && 'Resetowanie hasła'}
        </h2>

        {authMode === 'forgot' && (
          <p className="text-xs text-stone-400 mb-4 leading-relaxed">
            Podaj swój e-mail rejestracyjny. Wyślemy Ci instrukcję do ustawienia nowego hasła.
          </p>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-300 text-xs p-3.5 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <Mail size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Adres e-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            className={inputStyle}
          />
        </div>

        {authMode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-400">Hasło (min. 6 znaków)</label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[11px] text-amber-400/90 hover:text-amber-300 transition"
                >
                  Zapomniałeś/aś?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputStyle}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading
            ? 'Ładowanie...'
            : authMode === 'login'
            ? 'Zaloguj'
            : authMode === 'register'
            ? 'Zarejestruj się'
            : 'Wyślij link do resetu'}
        </button>

        <div className="text-center pt-2 border-t border-[#2A2A32] mt-4 space-y-2">
          {authMode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="text-xs text-stone-400 hover:text-amber-400 transition"
            >
              Nie masz konta? <span className="text-amber-400 font-medium underline">Zarejestruj się</span>
            </button>
          )}

          {authMode === 'register' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-stone-400 hover:text-amber-400 transition"
            >
              Masz już konto? <span className="text-amber-400 font-medium underline">Zaloguj się</span>
            </button>
          )}

          {authMode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-stone-400 hover:text-amber-400 transition"
            >
              ← Wróć do ekranu logowania
            </button>
          )}
        </div>
      </form>

      <PoweredByFooter />
    </div>
  );
}
