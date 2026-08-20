import { useState, useEffect } from 'react';
import {
  LogOut,
  Wifi,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ToggleRight,
  ToggleLeft,
  Key,
  AlertCircle,
  Bell,
  CheckCircle,
  X,
  Smartphone,
  HelpCircle,
  Code,
  Terminal,
  UserX,
} from 'lucide-react';
import { Chip } from '../components/ui/Chip.jsx';
import { AppLogsSection } from './AppLogsSection.jsx';
import { addLog } from '../utils/logger.js';
import {
  checkPushSubscription,
  subscribeToPushNotifications,
  sendSystemNotification,
  unsubscribeFromPushNotifications,
} from '../utils/pushService.js';

export function SettingsView({
  family,
  profile,
  settings,
  onUpdateSettings,
  people,
  onAddPerson,
  onEditPerson,
  onDeletePerson,
  onSignOut,
  supabase,
  showToast,
  onLeaveFamily,
  onDeleteFamily,
  onDeleteUserAccount,
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState(null);
  const [notifErrorDetails, setNotifErrorDetails] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const toggleSection = (sectionId) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  };

  useEffect(() => {
    async function checkSub() {
      const res = await checkPushSubscription();
      setPushSubscribed(res.subscribed);
    }
    checkSub();
  }, []);

  const handleEnableNotifications = async () => {
    setNotifErrorDetails(null);
    setNotifLoading(true);
    addLog('info', 'Uruchomiono konfiguracj? powiadomie里 Web Push...');

    try {
      const sub = await subscribeToPushNotifications(supabase, profile, family?.id);
      setNotifPermission(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted'
      );
      setPushSubscribed(Boolean(sub));
      showToast('Powiadomienia Web Push w tle zosta?y aktywowane!');
      addLog('success', 'Pomy?lnie w??czono i zsynchronizowano Web Push.');
    } catch (e) {
      const errFormatted = `${e.name || 'B??d'}: ${e.message || e}`;
      addLog('error', `B??d podczas w??czania Web Push: ${errFormatted}`);
      setNotifErrorDetails(e.message || 'Wyst?pi? problem z rejestracj? powiadomie里.');
      showToast('Nie uda?o si? w??czy? powiadomie里.');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      addLog('info', 'Wysy?anie testowego powiadomienia przez chmur?...');
      showToast('Wysy?anie powiadomienia testowego...');

      await sendSystemNotification('Rodzinny Planer', 'Test powiadomie里 systemowych!');

      if (supabase && family?.id) {
        const { data, error } = await supabase.functions.invoke('send-push', {
          body: {
            family_id: family.id,
            title: 'Test z Chmury (Web Push)',
            body: 'Powiadomienia w tle z Supabase dzia?aj? prawid?owo!',
          },
        });
        if (error) {
          addLog('warn', `Edge function zwr車ci?a: ${error.message}`);
        } else {
          addLog('success', 'Wys?ano ??danie Push do chmury Supabase!', data);
          showToast('Wys?ano sygna? Push przez chmur?!');
        }
      }
    } catch (e) {
      addLog('error', `B??d testu powiadomie里: ${e.message}`);
      setNotifErrorDetails(e.message);
    }
  };

  const handleDisableNotifications = async () => {
    if (!confirm('Czy na pewno chcesz wy??czy? powiadomienia Push na tym urz?dzeniu?')) return;
    setNotifLoading(true);
    try {
      await unsubscribeFromPushNotifications(supabase, profile);
      setPushSubscribed(false);
      showToast('Wy??czono powiadomienia Push na tym urz?dzeniu.');
    } catch (e) {
      showToast('B??d wy??czania powiadomie里: ' + e.message);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPwdMessage({ type: 'error', text: 'Has?o musi mie? co najmniej 6 znak車w.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'Has?a nie s? identyczne.' });
      return;
    }

    setPwdLoading(true);
    setPwdMessage(null);

    try {
      const { error } = (await supabase?.auth?.updateUser({ password: newPassword })) || {};
      if (error) {
        setPwdMessage({ type: 'error', text: error.message || 'Nie uda?o si? zmieni? has?a.' });
      } else {
        setPwdMessage({ type: 'success', text: 'Has?o zosta?o pomy?lnie zmienione!' });
        setNewPassword('');
        setConfirmPassword('');
        if (showToast) showToast('Has?o zmienione pomy?lnie!');
      }
    } catch {
      setPwdMessage({ type: 'error', text: 'Wyst?pi? b??d podczas zmiany has?a.' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">
            Ustawienia
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">Zarz?dzaj profilem, rodzin? i powiadomieniami</p>
        </div>
        <button
          onClick={onSignOut}
          className="px-3.5 py-2 bg-stone-800 rounded-xl border border-stone-700 text-xs font-bold flex items-center gap-2 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/50 transition active:scale-95"
        >
          <LogOut size={14} /> Wyloguj
        </button>
      </div>

      <div className="bg-[#1E1E22] border border-emerald-900/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center shrink-0">
            <Wifi size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              Po??czono z chmur?
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xs text-stone-400">Synchronizacja danych w czasie rzeczywistym jest aktywna.</div>
          </div>
        </div>
      </div>

      {/* SEKCJA 1: Twoja Rodzina */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('family')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-800/40 transition active:bg-stone-800/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100">Twoja rodzina</div>
              <div className="text-xs text-stone-400">
                {family?.name ? `${family.name} (kod: ${family.join_code || 'brak'})` : 'Dane Twojej grupy rodzinnej'}
              </div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'family' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'family' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-4 bg-stone-900/40">
            <div>
              <label className="text-xs font-semibold mb-1.5 block text-stone-400">Nazwa Rodziny</label>
              <input
                type="text"
                value={family?.name || ''}
                readOnly
                className="w-full border border-[#33333C] rounded-xl px-3.5 py-2 text-sm bg-stone-900 text-stone-300 cursor-not-allowed font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block text-stone-400">Kod do??czenia dla innych</label>
              <div className="text-lg font-mono font-bold tracking-widest text-amber-400 bg-amber-900/20 px-4 py-2.5 rounded-xl inline-block border border-amber-900/50">
                {family?.join_code}
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                Podaj ten kod innym domownikom, by do??czyli do tej rodziny na swoich telefonach.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA 2: Cz?onkowie Rodziny */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('members')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-800/40 transition active:bg-stone-800/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100">Cz?onkowie rodziny</div>
              <div className="text-xs text-stone-400">
                {people.length} {people.length === 1 ? 'osoba' : people.length < 5 ? 'osoby' : 'os車b'} w grupie
              </div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'members' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'members' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-3 bg-stone-900/40">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-stone-400 font-medium">Lista domownik車w</span>
              <button
                onClick={onAddPerson}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
              >
                <Plus size={14} /> Dodaj osob?
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {people.map((p) => {
                const isCurrent = profile?.person_id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`bg-stone-900 border ${
                      isCurrent ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#33333C]'
                    } rounded-xl p-3 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <Chip person={p} size="lg" />
                      <div>
                        <div className="text-sm font-bold text-stone-100 flex items-center gap-2">
                          {p.name}
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                              To ja
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">ID: {p.id}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onEditPerson(p)}
                        className="p-2 text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-lg transition"
                        title="Edytuj profil"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDeletePerson(p.id)}
                        className="p-2 text-stone-400 hover:text-red-400 bg-stone-800 hover:bg-red-950/60 rounded-lg transition"
                        title="Usu里 profil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA: Modu?y */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl p-4 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold border-b border-[#33333C] pb-2 text-stone-100 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" /> Modu?y aplikacji
        </h3>
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-stone-200">Tablica (Lod車wka)</div>
            <div className="text-xs text-stone-400">Wsp車lna przestrze里 na wiadomo?ci i notatki domownik車w.</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, enableWall: !settings.enableWall })}
            className="p-1 transition active:scale-90"
          >
            {settings.enableWall ? (
              <ToggleRight size={32} className="text-amber-400" />
            ) : (
              <ToggleLeft size={32} className="text-stone-600" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between py-1 pt-2 border-t border-stone-800">
          <div>
            <div className="text-sm font-semibold text-stone-200">Posi?ki (Jad?ospis)</div>
            <div className="text-xs text-stone-400">Tygodniowy planer obiad車w i posi?k車w.</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, enableMeals: !settings.enableMeals })}
            className="p-1 transition active:scale-90"
          >
            {settings.enableMeals ? (
              <ToggleRight size={32} className="text-amber-400" />
            ) : (
              <ToggleLeft size={32} className="text-stone-600" />
            )}
          </button>
        </div>
      </div>

      {/* SEKCJA 3: Ustawienia konta */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('account')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-800/40 transition active:bg-stone-800/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Key size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100">Ustawienia konta</div>
              <div className="text-xs text-stone-400">Zmiana has?a i dane logowania</div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'account' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'account' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-3.5 bg-stone-900/40">
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block text-stone-400">Nowe has?o</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 znak車w"
                  className="w-full border border-[#33333C] rounded-xl px-3.5 py-2 text-sm bg-stone-900 text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block text-stone-400">Powt車rz nowe has?o</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Wpisz ponownie nowe has?o"
                  className="w-full border border-[#33333C] rounded-xl px-3.5 py-2 text-sm bg-stone-900 text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              {pwdMessage && (
                <div
                  className={`text-xs p-3 rounded-xl flex items-center gap-2 ${
                    pwdMessage.type === 'error'
                      ? 'bg-red-950/50 text-red-400 border border-red-900/50'
                      : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50'
                  }`}
                >
                  <AlertCircle size={15} className="shrink-0" /> {pwdMessage.text}
                </div>
              )}
              <button
                type="submit"
                disabled={pwdLoading}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {pwdLoading ? 'Zapisywanie...' : 'Zmie里 has?o'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* SEKCJA 4: Powiadomienia w tle (Web Push) */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('notifications')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-800/40 transition active:bg-stone-800/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100">Powiadomienia w tle (Web Push)</div>
              <div className="text-xs text-stone-400">
                {pushSubscribed ? 'Aktywne w chmurze' : 'Konfiguracja alert車w na telefon'}
              </div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'notifications' ? (
              <ChevronDown size={18} className="text-amber-400" />
            ) : (
              <ChevronRight size={18} />
            )}
          </div>
        </button>

        {expandedSection === 'notifications' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-4 bg-stone-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400 font-medium">Status urz?dzenia</span>
              <button
                type="button"
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle size={13} /> Instrukcja chmury
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800 space-y-1">
                <div className="text-stone-400 font-medium">Uprawnienia systemowe</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {notifPermission === 'granted' && (
                    <>
                      <CheckCircle size={14} className="text-emerald-400" />{' '}
                      <span className="text-emerald-400">Zezwolono</span>
                    </>
                  )}
                  {notifPermission === 'denied' && (
                    <>
                      <X size={14} className="text-red-400" /> <span className="text-red-400">Zablokowane</span>
                    </>
                  )}
                  {notifPermission === 'default' && (
                    <>
                      <AlertCircle size={14} className="text-amber-400" />{' '}
                      <span className="text-amber-400">Wymaga zgody</span>
                    </>
                  )}
                  {notifPermission === 'unsupported' && <span className="text-stone-500">Brak wsparcia</span>}
                </div>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800 space-y-1">
                <div className="text-stone-400 font-medium">Subskrypcja Push (w tle)</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {pushSubscribed ? (
                    <>
                      <CheckCircle size={14} className="text-emerald-400" />{' '}
                      <span className="text-emerald-400">Aktywna w chmurze</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-amber-400" />{' '}
                      <span className="text-amber-400">Niepo??czona</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={notifLoading || notifPermission === 'unsupported'}
                className="flex-1 py-2.5 px-4 bg-amber-500 text-stone-950 rounded-xl text-xs font-bold hover:bg-amber-400 transition flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[160px] active:scale-95 shadow-sm"
              >
                <Smartphone size={14} />{' '}
                {notifLoading
                  ? 'Aktywowanie...'
                  : pushSubscribed
                  ? 'Od?wie? Web Push'
                  : 'W??cz Web Push w tle'}
              </button>

              <button
                type="button"
                onClick={handleSendTestNotification}
                className="py-2.5 px-3.5 bg-stone-800 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold hover:bg-stone-700 transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Bell size={14} /> Test
              </button>

              {pushSubscribed && (
                <button
                  type="button"
                  onClick={handleDisableNotifications}
                  disabled={notifLoading}
                  className="py-2.5 px-3 bg-stone-900 text-red-400 border border-red-900/40 rounded-xl text-xs font-semibold hover:bg-red-950/40 transition active:scale-95"
                  title="Wy??cz na tym telefonie"
                >
                  Wy??cz
                </button>
              )}
            </div>

            {notifErrorDetails && (
              <div className="bg-red-950/50 border border-red-900/60 p-3 rounded-xl text-xs text-red-300 space-y-1">
                <div className="font-bold flex items-center gap-1 text-red-400">
                  <AlertCircle size={14} /> Wykryty problem z powiadomieniami:
                </div>
                <p className="leading-relaxed">{notifErrorDetails}</p>
              </div>
            )}

            {showSqlGuide && (
              <div className="bg-stone-900 p-4 rounded-xl border border-amber-500/30 text-xs text-stone-300 space-y-3">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Code size={15} /> Jak dzia?a Web Push przy zamkni?tej aplikacji?
                </div>
                <p className="text-stone-300 leading-relaxed text-[11px]">
                  Gdy zamykasz aplikacj?, Tw車j telefon rejestruje token subskrypcji w tabeli{' '}
                  <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">push_subscriptions</code> w
                  Supabase. Aby serwer Supabase sam wysy?a? powiadomienia o terminach i wydarzeniach, uruchom plik{' '}
                  <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">
                    supabase_notifications_setup.sql
                  </code>{' '}
                  w SQL Editorze w Supabase.
                </p>
              </div>
            )}

            <p className="text-[11px] text-stone-400 leading-relaxed bg-stone-900/70 p-3 rounded-xl border border-stone-800">
              <strong>Wskaz車wka (Dzia?anie jak aplikacja ze sklepu):</strong> Na telefonie (Android / iPhone) w menu
              przegl?darki wybierz <span className="text-amber-400 font-medium">&quot;Dodaj do ekranu g?車wnego&quot;</span> /{' '}
              <span className="text-amber-400 font-medium">&quot;Zainstaluj aplikacj?&quot;</span>. Dzi?ki temu system
              operacyjny traktuje aplikacj? jako PWA i nie ubija powiadomie里 w tle.
            </p>
          </div>
        )}
      </div>

      {/* SEKCJA 5: Logi Aplikacji */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('logs')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-800/40 transition active:bg-stone-800/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Terminal size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100">Logi Aplikacji i Diagnostyka</div>
              <div className="text-xs text-stone-400">Podgl?d zdarze里 systemowych, b??d車w i synchronizacji</div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'logs' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'logs' && (
          <div className="p-4 pt-3 border-t border-[#33333C] bg-stone-900/40">
            <AppLogsSection />
          </div>
        )}
      </div>

      {/* SEKCJA 6: Strefa niebezpieczna */}
      <div className="bg-[#1E1E22] border border-red-900/40 rounded-2xl overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('danger')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-red-950/20 transition active:bg-red-950/40"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400 shrink-0">
              <Trash2 size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-red-400 flex items-center gap-1.5">Strefa niebezpieczna</div>
              <div className="text-xs text-stone-400">Odpi?cie od rodziny, usuwanie konta lub usuwanie ca?ej rodziny</div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'danger' ? (
              <ChevronDown size={18} className="text-red-400" />
            ) : (
              <ChevronRight size={18} className="text-red-400/70" />
            )}
          </div>
        </button>

        {expandedSection === 'danger' && (
          <div className="p-4 pt-3 border-t border-red-900/40 space-y-4 bg-red-950/10">
            {/* Opcja 1: Tylko odpi?cie od rodziny */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <Users size={14} className="text-amber-400" /> Odpi?cie od bie??cej rodziny (Opu?? rodzin?)
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Od??cza Twoje konto od rodziny <strong className="text-stone-200">{family?.name}</strong>. Twoje konto
                u?ytkownika pozostanie aktywne, a aplikacja przekieruje Ci? do menu do??czenia z kodem lub stworzenia nowej rodziny.
              </p>
              <button
                type="button"
                onClick={onLeaveFamily}
                className="w-full py-2.5 bg-stone-900 border border-amber-500/40 text-amber-300 hover:bg-stone-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <Users size={15} /> Odepnij si? od rodziny i przejd? do wyboru
              </button>
            </div>

            {/* Opcja 2: Usuwanie konta */}
            <div className="space-y-2 pt-3 border-t border-red-900/30">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <UserX size={14} className="text-red-400" /> Usuwanie konta u?ytkownika
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Spowoduje wyczyszczenie Twoich prywatnych notatek, odpi?cie profilu od cz?onka rodziny oraz wylogowanie
                z aplikacji.
              </p>
              <button
                type="button"
                onClick={onDeleteUserAccount}
                className="w-full py-2.5 bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <UserX size={15} /> Usu里 moje konto i odepnij od rodziny
              </button>
            </div>

            {/* Opcja 3: Usuwanie ca?ej rodziny */}
            <div className="space-y-2 pt-3 border-t border-red-900/30">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <Trash2 size={14} className="text-red-400" /> Usuwanie ca?ej rodziny
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Usuni?cie rodziny spowoduje skasowanie ca?ego wsp車lnego kalendarza, zada里, notatek i ca?ej listy domownik車w
                z bazy.
              </p>
              <button
                type="button"
                onClick={onDeleteFamily}
                className="w-full py-2.5 bg-red-950/90 border border-red-800/90 text-red-400 hover:bg-red-900 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <Trash2 size={15} /> Usu里 ca?? rodzin? i zresetuj dane
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}