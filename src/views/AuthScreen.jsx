import { useState } from 'react';
import { AlertCircle, Mail, CheckCircle2, RefreshCw, Send } from 'lucide-react';
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
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const translateAuthError = (err) => {
    if (!err) return 'Wystąpił nieznany błąd.';
    const msg = typeof err === 'string' ? err : err.message || '';

    if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
      return 'Twój adres e-mail nie został jeszcze aktywowany. Kliknij w link potwierdzający wysłany na Twoją skrzynkę pocztową (sprawdź też folder SPAM).';
    }
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
      return 'Nieprawidłowy adres e-mail lub hasło.';
    }
    if (msg.includes('User already registered') || msg.includes('user_already_exists')) {
      return 'Konto o tym adresie e-mail już istnieje. Zaloguj się lub skorzystaj z opcji resetowania hasła.';
    }
    if (msg.includes('Password should be at least 6 characters')) {
      return 'Hasło musi mieć co najmniej 6 znaków.';
    }
    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
      return 'Zbyt wiele prób wysyłki wiadomości e-mail. Odczekaj chwilę przed kolejną próbą.';
    }
    if (msg.includes('To signup, please provide your email')) {
      return 'Wprowadź poprawny adres e-mail.';
    }
    return msg;
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) return;
    setResending(true);
    setResendStatus(null);
    try {
      if (supabase?.auth?.resend) {
        const { error: resendErr } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim().toLowerCase(),
        });
        if (resendErr) throw resendErr;
      }
      setResendStatus('Wysłano ponownie link aktywacyjny! Sprawdź skrzynkę oraz folder SPAM.');
    } catch (err) {
      setResendStatus(`Błąd wysyłki: ${translateAuthError(err)}`);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setCanResendConfirmation(false);
    setResendStatus(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (authMode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (err) {
          if (err.message?.includes('Email not confirmed') || err.message?.includes('email_not_confirmed')) {
            setCanResendConfirmation(true);
          }
          throw err;
        }
      } else if (authMode === 'register') {
        const { data: signUpData, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (err) throw err;

        // Sprawdzenie czy konto już istniało (Supabase z ochroną zwraca puste identities)
        if (signUpData?.user?.identities && signUpData.user.identities.length === 0) {
          throw new Error('Konto o tym adresie e-mail już istnieje. Zaloguj się lub skorzystaj z resetowania hasła.');
        }

        // Zapiszmy profil jeśli to możliwe
        if (signUpData?.user?.id) {
          try {
            await supabase.from('profiles').upsert({
              id: signUpData.user.id,
              email: cleanEmail,
              family_id: null,
              person_id: null,
            });
          } catch {
            // Ignorujemy błąd jeśli tabela ma inne reguły
          }
        }

        // Jeśli sesja jest pusta, to wymagane jest potwierdzenie e-mail
        if (!signUpData?.session) {
          setCanResendConfirmation(true);
          setSuccessMessage(
            `Konto zostało zarejestrowane! Na adres ${cleanEmail} wysłano wiadomość z linkiem aktywacyjnym. Kliknij go, aby aktywować konto przed pierwszym logowaniem (sprawdź też folder SPAM).`
          );
        } else {
          setSuccessMessage('Konto zostało utworzone i jesteś zalogowany!');
        }
      } else if (authMode === 'forgot') {
        if (!cleanEmail || !cleanEmail.includes('@')) {
          throw new Error('Wprowadź poprawny adres e-mail.');
        }

        // Weryfikacja czy użytkownik istnieje w tabeli profiles
        try {
          const { data: existingProfiles, error: checkErr } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', cleanEmail);

          if (!checkErr && existingProfiles && existingProfiles.length === 0) {
            throw new Error('Nie znaleziono zarejestrowanego użytkownika o podanym adresie e-mail.');
          }
        } catch (checkErr) {
          if (checkErr.message?.includes('Nie znaleziono zarejestrowanego użytkownika')) {
            throw checkErr;
          }
          // Jeśli zapytanie do profiles nie ma kolumny email lub RLS blokuje, kontynuujemy z resetPasswordForEmail
        }

        const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });

        if (err) throw err;

        setSuccessMessage(
          `Wysłano wiadomość z linkiem do resetowania hasła na adres ${cleanEmail}! Sprawdź swoją skrzynkę odbiorczą oraz folder SPAM.`
        );
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setError(null);
    setSuccessMessage(null);
    setCanResendConfirmation(false);
    setResendStatus(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
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
            Podaj swój e-mail rejestracyjny. Wyślemy Ci instrukcję z jednorazowym linkiem do ustawienia nowego hasła.
          </p>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-300 text-xs p-3.5 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {canResendConfirmation && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="w-full mt-2 py-2 px-3 bg-red-900/40 hover:bg-red-900/70 border border-red-800 text-red-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                {resending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                Wyślij link aktywacyjny ponownie
              </button>
            )}
          </div>
        )}

        {resendStatus && (
          <div className="bg-stone-900 border border-amber-500/40 text-amber-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-amber-400" />
            <span>{resendStatus}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-300 text-xs p-3.5 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <Mail size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
            {canResendConfirmation && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="w-full mt-2 py-2 px-3 bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-800 text-emerald-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                {resending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                Nie doszło? Wyślij link aktywacyjny ponownie
              </button>
            )}
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
      </div>

      <PoweredByFooter />
    </div>
  );
}
