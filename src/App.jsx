import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  Calendar,
  CheckSquare,
  StickyNote,
  Settings,
  Sparkles,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { COLORS, FONT_IMPORT, emptyData, createDefaultMonthBudget, createDefaultBudgetGoals } from './utils/constants.js';
import {
  todayStr,
  toDateStr,
  addDaysStr,
  occursOnDate,
  isTaskDoneForPeriod,
  getPeriodKey,
} from './utils/dateUtils.js';
import { getSupabaseClient } from './utils/supabaseClient.js';
import { addLog } from './utils/logger.js';
import { getInitialSentReminders, recordFamilyNotification } from './utils/pushService.js';

import { AppLogo, Chip, PoweredByFooter, FloatingActionButton, MoreMenuSheet } from './components/ui/index.js';
import {
  migrateNoteToTipTapFormat,
  extractTextSummaryFromDoc,
  toggleTaskItemInDoc,
} from './utils/noteMigration.js';
import {
  AddEventModal,
  AddTaskModal,
  NoteModal,
  AddWallMessageModal,
  PersonModal,
  EventDetailModal,
  TaskDetailModal,
  TransactionModal,
} from './components/modals/index.js';
import {
  TodayView,
  CalendarView,
  TasksView,
  ShoppingView,
  NotesView,
  WallView,
  BudgetView,
  SettingsView,
  ResetPasswordScreen,
  AuthScreen,
  FamilyOnboarding,
  ProfileSelection,
} from './views/index.js';

export default function App() {
  const [supabaseClient] = useState(() => getSupabaseClient());

  // Auth state
  const [session, setSession] = useState(null);
  const [family, setFamily] = useState(null);
  const [profile, setProfile] = useState(null);

  // App state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [tab, setTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t && ['today', 'calendar', 'tasks', 'shopping', 'notes', 'wall', 'budget', 'settings'].includes(t)) {
        return t;
      }
    }
    return 'today';
  });
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState(() => todayStr().slice(0, 7));
  const [modal, setModal] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const p = new URLSearchParams(window.location.search);
      const a = p.get('action');
      if (a === 'add-event') return 'event';
      if (a === 'add-task') return 'task';
      if (a === 'add-wall') return 'wall';
      if (a === 'add-note') return 'note';
    }
    return null;
  });
  const [modalPayload, setModalPayload] = useState(null);
  const [addEventDate, setAddEventDate] = useState(todayStr());
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [toast, setToast] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(() =>
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'))
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Auth Listener
  useEffect(() => {
    if (!supabaseClient) return;

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
      if (!session) {
        setFamily(null);
        setProfile(null);
        setData(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  // Load Profile & Family
  useEffect(() => {
    if (!supabaseClient || !session) return;

    async function loadUserMeta() {
      try {
        const { data: prof } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (prof) {
          // Upewnij się, że profil ma zapisany aktualny adres email
          if (session.user.email && prof.email !== session.user.email) {
            supabaseClient
              .from('profiles')
              .update({ email: session.user.email.toLowerCase() })
              .eq('id', session.user.id)
              .then(() => {})
              .catch(() => {});
          }
          setProfile(prof);
          if (prof.family_id) {
            const { data: fam } = await supabaseClient
              .from('families')
              .select('*')
              .eq('id', prof.family_id)
              .single();
            setFamily(fam);
          }
        } else {
          // Inicjalizacja profilu
          const initialProf = {
            id: session.user.id,
            email: session.user.email ? session.user.email.toLowerCase() : null,
            family_id: null,
            person_id: null,
          };
          try {
            await supabaseClient.from('profiles').upsert(initialProf);
          } catch {
            // Ignorujemy błędy schematu
          }
          setProfile(initialProf);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    loadUserMeta();
  }, [supabaseClient, session]);

  const dataRef = useRef(null);
  const profileRef = useRef(profile);
  const sentRemindersRef = useRef(getInitialSentReminders());

  const markReminderSent = useCallback((key) => {
    sentRemindersRef.current.add(key);
    try {
      localStorage.setItem('rp_sent_reminders', JSON.stringify(Array.from(sentRemindersRef.current)));
    } catch {
      // Ignorujemy błędy localStorage
    }
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Pomocnicza funkcja inteligentnego dostarczania powiadomień wewnątrz aplikacji:
  // - W interfejsie użytkownika wyświetla Toast
  // - Powiadomienia systemowe/OS w tle obsługiwane są bezpośrednio przez Web Push (Service Worker)
  const deliverNotification = useCallback((title, body, toastMsg) => {
    showToast(toastMsg || (body ? `${title}: ${body}` : title));
  }, []);

  // System sprawdzania i wysyłania przypomnień czasowych dla wydarzeń i zadań
  // Uwzględnia TYLKO wydarzenia i zadania przypisane do bieżącego użytkownika (currentPersonId)
  useEffect(() => {
    if (!data) return;

    const checkReminders = () => {
      try {
        const currentPersonId = profileRef.current?.person_id;
        if (!currentPersonId) return;

        const now = new Date();
        const today = toDateStr(now);
        const tomorrow = addDaysStr(today, 1);

        // 1. Sprawdzanie wydarzeń (tylko przypisane do bieżącego profilu)
        if (Array.isArray(data.events)) {
          data.events.forEach((ev) => {
            if (!ev.personIds?.includes(currentPersonId)) return;

            const reminderHours = ev.reminder?.hours ?? ev.reminderHours;
            if (reminderHours === null || reminderHours === undefined) return;

            [today, tomorrow].forEach((dateStr) => {
              if (occursOnDate(ev, dateStr)) {
                const timeStr = ev.time || '09:00';
                const [yh, mh, dh] = dateStr.split('-').map(Number);
                const [hh, mm] = timeStr.split(':').map(Number);
                const eventDate = new Date(yh, mh - 1, dh, hh, mm, 0);

                const reminderDate = new Date(eventDate.getTime() - Number(reminderHours) * 60 * 60 * 1000);
                const diffMs = now.getTime() - reminderDate.getTime();
                const key = `event_${ev.id}_${dateStr}_${reminderHours}_${timeStr}`;

                if (diffMs >= 0 && diffMs < 15 * 60 * 1000 && !sentRemindersRef.current.has(key)) {
                  markReminderSent(key);

                  let labelText = 'O czasie wydarzenia';
                  if (reminderHours === 1) labelText = 'Za 1 godz.';
                  else if (reminderHours === 2) labelText = 'Za 2 godz.';
                  else if (reminderHours === 24) labelText = 'Jutro';

                  const body =
                    reminderHours === 0
                      ? `Nadszedł czas wydarzenia: "${ev.title}"${ev.time ? ' (' + ev.time + ')' : ''} 🔔`
                      : `Przypomnienie (${labelText}): "${ev.title}"${ev.time ? ' o ' + ev.time : ''} 🔔`;

                  addLog('info', `Wyzwalanie przypomnienia o wydarzeniu: ${body}`);
                  deliverNotification('Nadchodzące wydarzenie 🔔', body, `🔔 ${body}`);
                }
              }
            });
          });
        }

        // 2. Sprawdzanie zadań (tylko przypisane do bieżącego profilu)
        if (Array.isArray(data.tasks)) {
          data.tasks.forEach((t) => {
            if (!t.personIds?.includes(currentPersonId)) return;
            if (isTaskDoneForPeriod(t, today)) return;

            const reminderHours = t.reminder?.hours ?? t.reminderHours;
            if (reminderHours === null || reminderHours === undefined) return;

            const targetDateStr = t.dueDate || today;
            [targetDateStr].forEach((dateStr) => {
              const timeStr = t.time || '09:00';
              const [yh, mh, dh] = dateStr.split('-').map(Number);
              const [hh, mm] = timeStr.split(':').map(Number);
              const taskDate = new Date(yh, mh - 1, dh, hh, mm, 0);

              const reminderDate = new Date(taskDate.getTime() - Number(reminderHours) * 60 * 60 * 1000);
              const diffMs = now.getTime() - reminderDate.getTime();
              const key = `task_${t.id}_${dateStr}_${reminderHours}_${timeStr}`;

              if (diffMs >= 0 && diffMs < 15 * 60 * 1000 && !sentRemindersRef.current.has(key)) {
                markReminderSent(key);

                let labelText = 'Termin zadania';
                if (reminderHours === 1) labelText = 'Za 1 godz.';
                else if (reminderHours === 2) labelText = 'Za 2 godz.';
                else if (reminderHours === 24) labelText = 'Jutro';

                const body =
                  reminderHours === 0
                    ? `Nadszedł czas na zadanie: "${t.title}"! 📝`
                    : `Przypomnienie o zadaniu (${labelText}): "${t.title}" 📝`;

                addLog('info', `Wyzwalanie przypomnienia o zadaniu: ${body}`);
                deliverNotification('Przypomnienie o zadaniu 📝', body, `📝 ${body}`);
              }
            });
          });
        }
      } catch (err) {
        console.warn('Błąd sprawdzania przypomnień:', err);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, [data, deliverNotification, markReminderSent]);

  // Zaawansowana detekcja zmian (DODANE, ZMODYFIKOWANE, USUNIĘTE)
  // z precyzyjnym podziałem na odbiorców (Tablica = cała rodzina, Zadania/Wydarzenia = przypisani domownicy)
  const handleRemoteDataUpdate = useCallback(
    (newData) => {
      if (!newData) return;
      const oldData = dataRef.current;

      if (!oldData) {
        setData(newData);
        dataRef.current = newData;
        return;
      }

      // Szybkie sprawdzenie znacznika czasu synchronizacji
      if (oldData.lastUpdatedAt && newData.lastUpdatedAt) {
        if (oldData.lastUpdatedAt === newData.lastUpdatedAt) return;
      } else {
        if (JSON.stringify(oldData) === JSON.stringify(newData)) return;
      }

      const currentPersonId = profileRef.current?.person_id;

      const oldEventsMap = new Map((oldData.events || []).map((e) => [e.id, e]));
      const newEventsMap = new Map((newData.events || []).map((e) => [e.id, e]));

      const oldTasksMap = new Map((oldData.tasks || []).map((t) => [t.id, t]));
      const newTasksMap = new Map((newData.tasks || []).map((t) => [t.id, t]));

      const oldWallMap = new Map((oldData.wall || []).map((w) => [w.id, w]));
      const newWallMap = new Map((newData.wall || []).map((w) => [w.id, w]));

      setData(newData);
      dataRef.current = newData;

      let hasNotified = false;

      // 1. TABLICA (WALL)
      (newData.wall || []).forEach((newMsg) => {
        if (!oldWallMap.has(newMsg.id)) {
          deliverNotification('Wiadomość na lodówce 💬', newMsg.text, `Nowa wiadomość na lodówce: "${newMsg.text}" 💬`);
          hasNotified = true;
        }
      });

      (newData.wall || []).forEach((newMsg) => {
        const oldMsg = oldWallMap.get(newMsg.id);
        if (oldMsg && JSON.stringify(oldMsg) !== JSON.stringify(newMsg)) {
          if (oldMsg.isPinned !== newMsg.isPinned) {
            const pinText = newMsg.isPinned ? 'Przypięto wpis na lodówce 📌' : 'Odepnięto wpis z lodówki 📌';
            deliverNotification('Tablica rodzinna 📌', pinText, pinText);
          } else {
            deliverNotification(
              'Zmieniono wiadomość na lodówce 💬',
              newMsg.text,
              `Zmieniono wpis na lodówce: "${newMsg.text}" 💬`
            );
          }
          hasNotified = true;
        }
      });

      (oldData.wall || []).forEach((oldMsg) => {
        if (!newWallMap.has(oldMsg.id)) {
          deliverNotification('Tablica rodzinna 🗑️', 'Usunięto wiadomość z lodówki', 'Usunięto wpis z lodówki 🗑️');
          hasNotified = true;
        }
      });

      // 2. WYDARZENIA & ZADANIA
      if (currentPersonId) {
        // WYDARZENIA
        (newData.events || []).forEach((newEv) => {
          if (!oldEventsMap.has(newEv.id)) {
            if (newEv.personIds?.includes(currentPersonId)) {
              const timeInfo = newEv.time ? ` (${newEv.time})` : '';
              deliverNotification(
                'Nowe wydarzenie 📅',
                `Współdomownik dodał wydarzenie: "${newEv.title}"${timeInfo}`,
                `Nowe wydarzenie: "${newEv.title}" 📅`
              );
              hasNotified = true;
            }
          }
        });

        (newData.events || []).forEach((newEv) => {
          const oldEv = oldEventsMap.get(newEv.id);
          if (oldEv && JSON.stringify(oldEv) !== JSON.stringify(newEv)) {
            const wasAssigned = oldEv.personIds?.includes(currentPersonId);
            const isAssigned = newEv.personIds?.includes(currentPersonId);
            if (wasAssigned || isAssigned) {
              deliverNotification(
                'Zaktualizowano wydarzenie 📅',
                `Ktoś edytował wydarzenie: "${newEv.title}"`,
                `Ktoś edytował wydarzenie: "${newEv.title}" 📅`
              );
              hasNotified = true;
            }
          }
        });

        (oldData.events || []).forEach((oldEv) => {
          if (!newEventsMap.has(oldEv.id)) {
            if (oldEv.personIds?.includes(currentPersonId)) {
              deliverNotification(
                'Anulowano wydarzenie 📅',
                `Usunięto wydarzenie: "${oldEv.title}"`,
                `Anulowano wydarzenie: "${oldEv.title}" 🗑️`
              );
              hasNotified = true;
            }
          }
        });

        // ZADANIA
        (newData.tasks || []).forEach((newTask) => {
          if (!oldTasksMap.has(newTask.id)) {
            if (newTask.personIds?.includes(currentPersonId)) {
              deliverNotification(
                'Nowe zadanie 📝',
                `Współdomownik przypisał Ci zadanie: "${newTask.title}"`,
                `Nowe zadanie: "${newTask.title}" 📝`
              );
              hasNotified = true;
            }
          }
        });

        (newData.tasks || []).forEach((newTask) => {
          const oldTask = oldTasksMap.get(newTask.id);
          if (oldTask && JSON.stringify(oldTask) !== JSON.stringify(newTask)) {
            const wasAssigned = oldTask.personIds?.includes(currentPersonId);
            const isAssigned = newTask.personIds?.includes(currentPersonId);
            if (wasAssigned || isAssigned) {
              const completionsChanged = JSON.stringify(oldTask.completions) !== JSON.stringify(newTask.completions);
              const msg = completionsChanged
                ? `Zaktualizowano status zadania: "${newTask.title}"`
                : `Ktoś edytował zadanie: "${newTask.title}"`;
              deliverNotification('Zadanie rodzinne 📝', msg, `${msg} 📝`);
              hasNotified = true;
            }
          }
        });

        (oldData.tasks || []).forEach((oldTask) => {
          if (!newTasksMap.has(oldTask.id)) {
            if (oldTask.personIds?.includes(currentPersonId)) {
              deliverNotification(
                'Anulowano zadanie 📝',
                `Usunięto zadanie: "${oldTask.title}"`,
                `Anulowano zadanie: "${oldTask.title}" 🗑️`
              );
              hasNotified = true;
            }
          }
        });
      }

      if (!hasNotified) {
        showToast('Zsynchronizowano zmiany od domownika 🔄');
      }
    },
    [deliverNotification]
  );

  // Load Data, Realtime Sync & Polling Fallback
  useEffect(() => {
    let isMounted = true;
    let channel = null;
    let pollInterval = null;

    async function fetchAndSync() {
      if (!supabaseClient || !family || !profile) return;

      try {
        const { data: stateRow, error } = await supabaseClient
          .from('family_state')
          .select('data')
          .eq('family_id', family.id)
          .single();

        if (error && error.code === 'PGRST116') {
          const init = emptyData();
          await supabaseClient.from('family_state').insert({ family_id: family.id, data: init });
          if (isMounted) {
            setData(init);
            dataRef.current = init;
          }
        } else if (stateRow && stateRow.data) {
          if (isMounted) {
            setData(stateRow.data);
            dataRef.current = stateRow.data;
          }
        }

        // 1. Kanał Realtime Supabase (WebSocket)
        channel = supabaseClient
          .channel(`public:family_state:${family.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'family_state',
              filter: `family_id=eq.${family.id}`,
            },
            (payload) => {
              if (isMounted && payload.new && payload.new.data) {
                handleRemoteDataUpdate(payload.new.data);
              }
            }
          )
          .subscribe();

        // 2. Backup Polling (co 6 sekund)
        pollInterval = setInterval(async () => {
          if (!isMounted) return;
          try {
            const { data: row } = await supabaseClient
              .from('family_state')
              .select('data')
              .eq('family_id', family.id)
              .single();
            if (isMounted && row && row.data) {
              handleRemoteDataUpdate(row.data);
            }
          } catch {
            // Bezgłośny błąd sieci
          }
        }, 6000);
      } catch (err) {
        console.warn('Błąd ładowania danych:', err);
      }
      if (isMounted) setLoading(false);
    }

    if (family && profile) fetchAndSync();

    return () => {
      isMounted = false;
      if (channel && supabaseClient) supabaseClient.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [supabaseClient, family, profile, handleRemoteDataUpdate]);

  const persist = useCallback(
    async (next) => {
      const updated = { ...next, lastUpdatedAt: Date.now() };
      setData(updated);
      dataRef.current = updated;
      if (supabaseClient && family) {
        try {
          await supabaseClient.from('family_state').upsert({
            family_id: family.id,
            data: updated,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn(e);
        }
      }
    },
    [supabaseClient, family]
  );

  // Routing / Render State
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121214] text-stone-100 font-mono text-sm">
        Ładowanie...
      </div>
    );
  if (!supabaseClient)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121214] text-red-400 p-6 text-center">
        Brak połączenia z bazą (Brak kluczy .env).
      </div>
    );

  if (isResettingPassword) {
    return (
      <ResetPasswordScreen
        supabase={supabaseClient}
        onComplete={() => {
          setIsResettingPassword(false);
          showToast('Nowe hasło zostało zapisane!');
        }}
      />
    );
  }

  if (!session) return <AuthScreen supabase={supabaseClient} />;
  if (!family)
    return (
      <FamilyOnboarding
        supabase={supabaseClient}
        session={session}
        onFamilyJoined={(fam, prof) => {
          setFamily(fam);
          setProfile(prof);
        }}
      />
    );
  if (!data)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121214] text-stone-100 font-mono text-sm gap-4">
        Pobieranie danych rodziny... <RefreshCw size={20} className="animate-spin text-amber-500" />
      </div>
    );
  if (!profile?.person_id)
    return (
      <ProfileSelection
        supabase={supabaseClient}
        profile={profile}
        data={data}
        onProfileSelected={(pid) => setProfile({ ...profile, person_id: pid })}
        onCreatePerson={async (newPerson) => {
          const updatedPeople = [...(data.people || []), newPerson];
          await persist({ ...data, people: updatedPeople });
          await supabaseClient.from('profiles').update({ person_id: newPerson.id }).eq('id', profile.id);
          setProfile({ ...profile, person_id: newPerson.id });
          showToast(`Witaj w rodzinie, ${newPerson.name}! 👋`);
        }}
      />
    );

  // User is fully authenticated, in a family, and picked an avatar.
  const currentUserId = profile.person_id;

  // PRYWATNE NOTATKI - Filtruje tylko te przypisane do currentUserId
  const visibleNotes = (data.notes || []).filter((n) => n.personId === currentUserId);

  // Handlers
  const upsertEvent = (ev) => {
    const convertedNoteId = modalPayload?.convertedNoteId || modalPayload?.noteId;
    let nextNotes = data.notes;
    if (convertedNoteId) {
      const wantDelete = window.confirm(
        'Pomyślnie utworzono wydarzenie! Czy chcesz usunąć oryginalną, prywatną notatkę?'
      );
      if (wantDelete) {
        nextNotes = (data.notes || []).filter((n) => n.id !== convertedNoteId);
      }
    }
    const exists = data.events.some((e) => e.id === ev.id);
    persist({
      ...data,
      events: exists ? data.events.map((e) => (e.id === ev.id ? ev : e)) : [...data.events, ev],
      notes: nextNotes,
    });
    const authorName = data?.people?.find((p) => p.id === currentUserId)?.name || 'Współdomownik';

    if (!exists) {
      showToast('Dodano wydarzenie! 📅');
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          userId: session?.user?.id || profile?.id,
          targetPersonIds: ev.personIds && ev.personIds.length > 0 ? ev.personIds : null,
          title: 'Nowe wydarzenie w kalendarzu 📅',
          body: `${authorName} dodał(a): "${ev.title}"${ev.time ? ` (${ev.time})` : ''}`,
          type: 'event',
          tag: `event_new_${ev.id}`,
        });
      }
    } else {
      showToast('Zaktualizowano wydarzenie 📅');
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          userId: session?.user?.id || profile?.id,
          targetPersonIds: ev.personIds && ev.personIds.length > 0 ? ev.personIds : null,
          title: 'Zaktualizowano wydarzenie 📅',
          body: `${authorName} zaktualizował(a) wydarzenie: "${ev.title}"${ev.time ? ` (${ev.time})` : ''}`,
          type: 'event_update',
          tag: `event_upd_${ev.id}`,
        });
      }
    }
  };

  const upsertTask = (t) => {
    const convertedNoteId = modalPayload?.convertedNoteId || modalPayload?.noteId;
    let nextNotes = data.notes;
    if (convertedNoteId) {
      const wantDelete = window.confirm(
        'Pomyślnie utworzono zadanie! Czy chcesz usunąć oryginalną, prywatną notatkę?'
      );
      if (wantDelete) {
        nextNotes = (data.notes || []).filter((n) => n.id !== convertedNoteId);
      }
    }
    const exists = data.tasks.some((x) => x.id === t.id);
    persist({
      ...data,
      tasks: exists ? data.tasks.map((x) => (x.id === t.id ? t : x)) : [...data.tasks, t],
      notes: nextNotes,
    });
    const authorName = data?.people?.find((p) => p.id === currentUserId)?.name || 'Współdomownik';

    if (!exists) {
      showToast('Dodano zadanie! 📝');
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          userId: session?.user?.id || profile?.id,
          targetPersonIds: t.personIds && t.personIds.length > 0 ? t.personIds : null,
          title: 'Nowe zadanie dla rodziny 📝',
          body: `${authorName} przypisał(a) zadanie: "${t.title}"`,
          type: 'task',
          tag: `task_new_${t.id}`,
        });
      }
    } else {
      showToast('Zaktualizowano zadanie 📝');
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          userId: session?.user?.id || profile?.id,
          targetPersonIds: t.personIds && t.personIds.length > 0 ? t.personIds : null,
          title: 'Zaktualizowano zadanie 📝',
          body: `${authorName} zaktualizował(a) zadanie: "${t.title}"`,
          type: 'task_update',
          tag: `task_upd_${t.id}`,
        });
      }
    }
  };

  const upsertNote = (n) => {
    const exists = data.notes.some((x) => x.id === n.id);
    persist({ ...data, notes: exists ? data.notes.map((x) => (x.id === n.id ? n : x)) : [...data.notes, n] });
    if (!exists) {
      showToast('Dodano notatkę! 📌');
    } else {
      showToast('Zapisano notatkę 📌');
    }
  };

  const addWallMessage = (msg) => {
    const convertedNoteId = modalPayload?.convertedNoteId || modalPayload?.noteId;
    let nextNotes = data.notes;
    if (convertedNoteId) {
      const wantDelete = window.confirm(
        'Pomyślnie opublikowano na tablicy! Czy chcesz usunąć oryginalną, prywatną notatkę?'
      );
      if (wantDelete) {
        nextNotes = (data.notes || []).filter((n) => n.id !== convertedNoteId);
      }
    }
    persist({
      ...data,
      wall: [msg, ...(data.wall || [])],
      notes: nextNotes,
    });
    showToast('Wysłano na tablicę 💬');
    if (family?.id && supabaseClient) {
      const author = data?.people?.find((p) => p.id === msg.personId)?.name || 'Ktoś';
      const targetPersonIds = (data?.people || []).filter((p) => p.id !== msg.personId).map((p) => p.id);
      recordFamilyNotification(supabaseClient, {
        familyId: family.id,
        userId: session?.user?.id || profile?.id,
        targetPersonIds: targetPersonIds.length > 0 ? targetPersonIds : null,
        title: `${author} napisał(a) na Tablicy 💬`,
        body: msg.text,
        type: 'wall_message',
        tag: `wall_msg_${msg.id}`,
      });
    }
  };

  const deleteWallMessage = (id) => {
    persist({ ...data, wall: (data.wall || []).filter((w) => w.id !== id) });
  };

  const togglePinWallMessage = (id) => {
    persist({
      ...data,
      wall: (data.wall || []).map((w) => (w.id === id ? { ...w, isPinned: !w.isPinned } : w)),
    });
  };

  const upsertPerson = (p) => {
    const exists = data.people.some((x) => x.id === p.id);
    persist({
      ...data,
      people: exists ? data.people.map((x) => (x.id === p.id ? p : x)) : [...data.people, p],
    });
    showToast('Zapisano osobę');
  };

  const selectPerson = async (id) => {
    if (!supabaseClient || !profile?.id) return;
    try {
      const { error } = await supabaseClient.from('profiles').update({ person_id: id }).eq('id', profile.id);
      if (error) throw error;
      setProfile((prev) =>
        prev
          ? { ...prev, person_id: id }
          : { id: session.user.id, family_id: family?.id, person_id: id }
      );
      const pName = data?.people?.find((p) => p.id === id)?.name || 'nową osobę';
      showToast(`Połączono Twoje konto z: ${pName} 👤`);
    } catch (e) {
      console.error(e);
      showToast('Błąd łączenia profilu');
    }
  };

  const updateShopping = (nextList) => persist({ ...data, shopping: nextList });

  const updateSettings = (newSettings) => persist({ ...data, settings: newSettings });

  const deletePerson = async (id) => {
    const person = data.people.find((p) => p.id === id);
    const personName = person ? person.name : 'tę osobę';
    if (
      !confirm(
        `Czy na pewno chcesz usunąć członka rodziny "${personName}"?\n\nOsoba zostanie usunięta z listy domowników, jej prywatne notatki wyczyszczone, a połączone konto odpięte.`
      )
    )
      return;

    const nextPeople = data.people.filter((p) => p.id !== id);
    const nextNotes = (data.notes || []).filter((n) => n.personId !== id);
    persist({ ...data, people: nextPeople, notes: nextNotes });

    if (supabaseClient) {
      try {
        await supabaseClient.from('profiles').update({ person_id: null }).eq('person_id', id);
      } catch (e) {
        console.warn('Błąd odpinania profilu w Supabase:', e);
      }
    }

    if (id === currentUserId) {
      setProfile((prev) => (prev ? { ...prev, person_id: null } : null));
      showToast(`Odpięto i usunięto profil ${personName}. Wybierz nowy profil.`);
    } else {
      showToast(`Usunięto członka rodziny: ${personName}`);
    }
  };

  const leaveFamily = async () => {
    const famName = family ? `"${family.name}"` : 'rodziny';
    if (
      !confirm(
        `Czy na pewno chcesz odpiąć się od ${famName}?\n\n- Twoje konto logowania pozostanie aktywne.\n- Zostaniesz przeniesiony(a) do menu wyboru: dołączenie z kodem do innej rodziny lub stworzenie nowej.\n- Dane wspólne obecnej rodziny nie zostaną skasowane.`
      )
    )
      return;

    try {
      if (supabaseClient && profile?.id) {
        await supabaseClient
          .from('profiles')
          .update({
            family_id: null,
            person_id: null,
          })
          .eq('id', profile.id);
      }

      setFamily(null);
      setProfile((prev) => (prev ? { ...prev, family_id: null, person_id: null } : null));
      setData(null);
      setTab('today');
      showToast('Odpięto od rodziny. Możesz teraz dołączyć do innej lub stworzyć nową.');
    } catch (err) {
      console.error('Błąd podczas odpinania od rodziny:', err);
      showToast('Wystąpił błąd podczas odpinania od rodziny.');
    }
  };

  const deleteUserAccount = async () => {
    if (
      !confirm(
        'CZY NA PEWNO CHCESZ USUNĄĆ SWOJE KONTO UŻYTKOWNIKA?\n\n- Twoje prywatne notatki zostaną wyczyszczone z bazy danych.\n- Twój profil zostanie odpięty od członka rodziny.\n- Nastąpi wylogowanie z aplikacji.'
      )
    )
      return;

    try {
      if (data) {
        const nextNotes = (data.notes || []).filter((n) => n.personId !== currentUserId);
        await persist({ ...data, notes: nextNotes });
      }

      if (supabaseClient && profile?.id) {
        await supabaseClient
          .from('profiles')
          .update({
            family_id: null,
            person_id: null,
          })
          .eq('id', profile.id);
      }

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

      setFamily(null);
      setProfile(null);
      setData(null);
      setSession(null);
      setTab('today');
      showToast('Konto użytkownika zostało usunięte i odpięte od rodziny.');
    } catch (err) {
      console.error('Błąd podczas usuwania konta użytkownika:', err);
      showToast('Wystąpił błąd podczas usuwania konta.');
    }
  };

  const deleteEvent = (id) => {
    const ev = (data.events || []).find((e) => e.id === id);
    persist({ ...data, events: (data.events || []).filter((e) => e.id !== id) });
    showToast('Usunięto wydarzenie 🗑️');
    if (ev && family?.id && supabaseClient) {
      const authorName = data?.people?.find((p) => p.id === currentUserId)?.name || 'Współdomownik';
      recordFamilyNotification(supabaseClient, {
        familyId: family.id,
        userId: session?.user?.id || profile?.id,
        targetPersonIds: ev.personIds && ev.personIds.length > 0 ? ev.personIds : null,
        title: 'Usunięto wydarzenie 🗑️',
        body: `${authorName} usunął(a) wydarzenie: "${ev.title}"`,
        type: 'event_delete',
        tag: `event_del_${id}`,
      });
    }
  };

  const excludeEventDate = (eventId, dateStr) => {
    const ev = (data.events || []).find((e) => e.id === eventId);
    if (!ev) return;
    const nextExcluded = Array.from(new Set([...(ev.excludedDates || []), dateStr]));
    const updatedEv = { ...ev, excludedDates: nextExcluded };
    persist({
      ...data,
      events: (data.events || []).map((e) => (e.id === eventId ? updatedEv : e)),
    });
    showToast(`Usunięto wystąpienie (${dateStr}) 🗑️`);
    if (family?.id && supabaseClient) {
      const authorName = data?.people?.find((p) => p.id === currentUserId)?.name || 'Współdomownik';
      recordFamilyNotification(supabaseClient, {
        familyId: family.id,
        userId: session?.user?.id || profile?.id,
        targetPersonIds: ev.personIds && ev.personIds.length > 0 ? ev.personIds : null,
        title: 'Usunięto wystąpienie wydarzenia 🗑️',
        body: `${authorName} usunął(a) wystąpienie "${ev.title}" z dnia ${dateStr}`,
        type: 'event_delete_instance',
        tag: `event_del_inst_${eventId}_${dateStr}`,
      });
    }
  };

  const openDetailEvent = (ev, dateStr) => {
    setDetailEvent({ ...ev, occurrenceDate: dateStr || ev.date });
  };

  const deleteTask = (id) => {
    const t = (data.tasks || []).find((x) => x.id === id);
    persist({ ...data, tasks: (data.tasks || []).filter((x) => x.id !== id) });
    showToast('Usunięto zadanie 🗑️');
    if (t && family?.id && supabaseClient) {
      const authorName = data?.people?.find((p) => p.id === currentUserId)?.name || 'Współdomownik';
      recordFamilyNotification(supabaseClient, {
        familyId: family.id,
        userId: session?.user?.id || profile?.id,
        targetPersonIds: t.personIds && t.personIds.length > 0 ? t.personIds : null,
        title: 'Usunięto zadanie 🗑️',
        body: `${authorName} usunął(a) zadanie: "${t.title}"`,
        type: 'task_delete',
        tag: `task_del_${id}`,
      });
    }
  };

  const deleteNote = (id) => persist({ ...data, notes: data.notes.filter((n) => n.id !== id) });

  const toggleTask = (task) => {
    const freq = task.recurrence?.freq || 'none';
    const key = getPeriodKey(freq, todayStr());
    const isDone = Boolean(task.completions && task.completions[key]);
    const nextCompletions = { ...(task.completions || {}) };
    if (isDone) delete nextCompletions[key];
    else nextCompletions[key] = true;
    persist({
      ...data,
      tasks: data.tasks.map((t) => (t.id === task.id ? { ...t, completions: nextCompletions } : t)),
    });
  };

  const toggleNoteItem = (noteId, itemIdOrIndex) =>
    persist({
      ...data,
      notes: data.notes.map((n) => {
        if (n.id !== noteId) return n;
        if (n.content && n.content.type === 'doc') {
          const nextDoc = toggleTaskItemInDoc(n.content, itemIdOrIndex);
          return {
            ...n,
            content: nextDoc,
            text: extractTextSummaryFromDoc(nextDoc),
          };
        }
        return {
          ...n,
          items: (n.items || []).map((i, idx) =>
            i.id === itemIdOrIndex || idx === itemIdOrIndex ? { ...i, done: !i.done } : i
          ),
        };
      }),
    });

  const toggleSubItem = (parentId, itemId, type) => {
    if (type === 'task') {
      persist({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === parentId
            ? {
                ...t,
                items: (t.items || []).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
              }
            : t
        ),
      });
      if (detailTask?.id === parentId)
        setDetailTask((p) => ({
          ...p,
          items: p.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
        }));
    } else if (type === 'event') {
      persist({
        ...data,
        events: data.events.map((e) =>
          e.id === parentId
            ? {
                ...e,
                items: (e.items || []).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
              }
            : e
        ),
      });
      if (detailEvent?.id === parentId)
        setDetailEvent((p) => ({
          ...p,
          items: p.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
        }));
    }
  };

  const openAddEvent = (dateStr) => {
    const targetDate = dateStr || (tab === 'calendar' && addEventDate ? addEventDate : todayStr());
    setAddEventDate(targetDate);
    setModalPayload(null);
    setModal('event');
  };

  const openAddTask = (dateStr) => {
    setModalPayload(dateStr ? { initialDate: dateStr } : null);
    setModal('task');
  };

  const openConvertNote = (note, type) => {
    const doc = migrateNoteToTipTapFormat(note);
    const summaryText = extractTextSummaryFromDoc(doc);

    setModalPayload({
      initial: {
        note: doc,
        content: doc,
        text: summaryText,
      },
      convertedNoteId: note.id,
    });
    if (type === 'event') setAddEventDate(todayStr());
    setModal(type);
  };

  const openEditEvent = (ev) => {
    setDetailEvent(null);
    setModalPayload({ editItem: ev });
    setAddEventDate(ev.date);
    setModal('event');
  };

  const openEditTask = (t) => {
    setDetailTask(null);
    setModalPayload({ editItem: t });
    setModal('task');
  };

  const openEditNote = (n) => {
    setModalPayload({ editItem: n });
    setModal('note');
  };

  const openEditPerson = (p) => {
    setEditingPerson(p);
    setModal('person');
  };

  const openAddBudget = (monthKey) => {
    setSelectedBudgetMonth(monthKey || todayStr().slice(0, 7));
    setModal('budget');
  };

  const handleSaveBudgetTransaction = (type, item) => {
    const targetMonthKey = item.date ? item.date.slice(0, 7) : selectedBudgetMonth || todayStr().slice(0, 7);
    const budgetState = data?.budget || {};
    const curMonthBudget = budgetState[targetMonthKey] || createDefaultMonthBudget();
    const updatedMonth = { ...curMonthBudget };
    if (type === 'expense') {
      updatedMonth.expenses = [item, ...(updatedMonth.expenses || [])];
    } else if (type === 'fixedCost') {
      updatedMonth.fixedCosts = [...(updatedMonth.fixedCosts || []), item];
    } else if (type === 'income') {
      updatedMonth.incomes = [...(updatedMonth.incomes || []), item];
    }

    persist({
      ...data,
      budget: {
        ...budgetState,
        [targetMonthKey]: updatedMonth,
      },
    });
    closeModal();
    showToast('Wpis został zapisany w budżecie!');
  };

  const closeModal = () => {
    setModal(null);
    setModalPayload(null);
    setEditingPerson(null);
  };

  const handleSignOut = async () => {
    if (confirm('Czy na pewno chcesz się wylogować?')) await supabaseClient.auth.signOut();
  };

  const deleteFamily = async () => {
    if (
      !confirm(
        'CZY NA PEWNO CHCESZ USUNĄĆ TĘ RODZINĘ?\n\nWszystkie wydarzenia, zadania, notatki, posiłki oraz osoby zostaną trwale usunięte z bazy danych. Nastąpi przekierowanie do ekranu startowego.'
      )
    )
      return;

    if (supabaseClient && family) {
      try {
        await supabaseClient.from('family_state').delete().eq('family_id', family.id);
        if (profile?.id) {
          await supabaseClient.from('profiles').update({ family_id: null, person_id: null }).eq('id', profile.id);
        }
        await supabaseClient.from('families').delete().eq('id', family.id);
      } catch (e) {
        console.warn('Błąd podczas usuwania rodziny:', e);
      }
    }

    setFamily(null);
    setProfile(null);
    setData(null);
    setTab('today');
    showToast('Rodzina została usunięta.');
  };

  const currentPerson = data?.people?.find((p) => p.id === currentUserId);

  const PRIMARY_TABS = [
    { id: 'today', label: 'Dziś', icon: Clock },
    { id: 'calendar', label: 'Kalendarz', icon: Calendar },
    { id: 'tasks', label: 'Zadania', icon: CheckSquare },
    { id: 'notes', label: 'Notatki', icon: StickyNote },
  ];
  const isMoreActive = ['shopping', 'wall', 'budget', 'settings'].includes(tab);
  const pendingShoppingCount = (data?.shopping || []).filter((s) => !s.isCompleted).length;

  return (
    <div style={{ background: COLORS.bg, fontFamily: 'Inter, sans-serif' }} className="min-h-screen flex flex-col text-stone-100">
      <style>{FONT_IMPORT}</style>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-stone-100 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-stone-700 flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-amber-400" />
          {toast}
        </div>
      )}

      <header className="flex items-center justify-between px-4 sm:px-5 pt-6 pb-4 sticky top-0 z-30 bg-[#121214]/85 backdrop-blur-md border-b border-stone-800/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo className="w-8 h-8 rounded-xl shrink-0" iconSize={18} />
          <div className="flex items-center gap-2 min-w-0">
            <h1 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold truncate">
              {family.name}
            </h1>
            {currentPerson ? (
              <button
                type="button"
                onClick={() => setTab('settings')}
                title={`Zalogowano jako: ${currentPerson.name} (kliknij, aby przejść do ustawień profilu)`}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800/90 border border-stone-700/60 text-xs font-semibold text-stone-200 hover:border-amber-500/40 hover:bg-stone-800 transition shadow-xs cursor-pointer"
              >
                <Chip person={currentPerson} size="sm" />
                <span className="truncate max-w-[90px] text-[11px] font-medium text-stone-300">
                  {currentPerson.name}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTab('settings')}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
              >
                Wybierz profil
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setTab('settings')}
          className={`p-2 rounded-full transition border shadow-sm ${
            tab === 'settings'
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
              : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
          }`}
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-between overflow-y-auto px-4 pt-4 pb-28 max-w-2xl mx-auto w-full">
        <div className="flex-1 w-full">
          {tab === 'today' && (
            <TodayView
              data={data}
              currentPerson={currentPerson}
              onOpenEvent={openDetailEvent}
              onOpenTask={setDetailTask}
              onToggleTask={toggleTask}
              onGoToShopping={() => setTab('shopping')}
            />
          )}
          {tab === 'calendar' && (
            <CalendarView
              data={data}
              selectedDay={addEventDate}
              onSelectDay={setAddEventDate}
              onOpenEvent={openDetailEvent}
            />
          )}
          {tab === 'tasks' && (
            <TasksView
              data={data}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onOpenTask={setDetailTask}
            />
          )}
          {tab === 'notes' && (
            <NotesView
              notes={visibleNotes}
              enableWall={Boolean(data.settings?.enableWall)}
              onDelete={deleteNote}
              onConvert={openConvertNote}
              onEdit={openEditNote}
              onToggleItem={toggleNoteItem}
            />
          )}
          {tab === 'wall' && data.settings?.enableWall && (
            <WallView
              wall={data.wall}
              people={data.people}
              onDeleteWallMessage={deleteWallMessage}
              onTogglePinWallMessage={togglePinWallMessage}
            />
          )}
          {tab === 'shopping' && (
            <ShoppingView
              shopping={data.shopping || []}
              people={data.people || []}
              currentUserId={currentUserId}
              onUpdateShopping={updateShopping}
              showToast={showToast}
            />
          )}
          {tab === 'budget' && data.settings?.enableBudget !== false && (
            <BudgetView
              data={data}
              onUpdateData={persist}
              currentPersonId={currentUserId}
              monthKey={selectedBudgetMonth}
              onMonthChange={setSelectedBudgetMonth}
            />
          )}
          {tab === 'settings' && (
            <SettingsView
              family={family}
              profile={profile}
              settings={data.settings}
              onUpdateSettings={updateSettings}
              people={data.people}
              onAddPerson={() => setModal('person')}
              onEditPerson={openEditPerson}
              onDeletePerson={deletePerson}
              onSignOut={handleSignOut}
              supabase={supabaseClient}
              showToast={showToast}
              onLeaveFamily={leaveFamily}
              onDeleteFamily={deleteFamily}
              onDeleteUserAccount={deleteUserAccount}
            />
          )}
        </div>

        <PoweredByFooter className="mt-8 mb-4" />
      </main>

      {/* Pływający przycisk dodawania w prawym dolnym rogu (FAB) */}
      <FloatingActionButton
        currentTab={tab}
        settings={data.settings}
        onAddEvent={() => openAddEvent(tab === 'calendar' ? addEventDate : todayStr())}
        onAddTask={() => openAddTask(todayStr())}
        onAddShopping={() => setTab('shopping')}
        onAddNote={() => setModal('note')}
        onAddWall={() => setModal('wall')}
        onAddBudget={() => openAddBudget(selectedBudgetMonth)}
      />

      {/* Dolny pasek nawigacji 4+1 */}
      <nav
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
        className="border-t fixed bottom-0 left-0 right-0 z-40 shadow-xl pb-safe"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-2">
          {PRIMARY_TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 transition cursor-pointer"
              >
                <Icon size={20} color={active ? COLORS.accent : COLORS.inkSoft} strokeWidth={active ? 2.5 : 2} />
                <span
                  style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}
                  className="text-[10px] tracking-wide"
                >
                  {label}
                </span>
              </button>
            );
          })}

          {/* Przycisk 5: Więcej */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 transition cursor-pointer relative"
          >
            <div className="relative">
              <MoreHorizontal
                size={20}
                color={isMoreActive ? COLORS.accent : COLORS.inkSoft}
                strokeWidth={isMoreActive ? 2.5 : 2}
              />
              {pendingShoppingCount > 0 && !isMoreActive && (
                <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-stone-900 animate-pulse" />
              )}
            </div>
            <span
              style={{
                color: isMoreActive ? COLORS.accent : COLORS.inkSoft,
                fontWeight: isMoreActive ? 700 : 500,
              }}
              className="text-[10px] tracking-wide truncate max-w-[65px]"
            >
              {isMoreActive
                ? tab === 'shopping'
                  ? 'Zakupy'
                  : tab === 'wall'
                  ? 'Tablica'
                  : tab === 'budget'
                  ? 'Budżet'
                  : 'Ustawienia'
                : 'Więcej'}
            </span>
          </button>
        </div>
      </nav>

      {/* Wysuwany arkusz Więcej modułów */}
      <MoreMenuSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        currentTab={tab}
        onSelectTab={setTab}
        settings={data?.settings}
        pendingShoppingCount={pendingShoppingCount}
      />

      {modal === 'event' && (
        <AddEventModal
          people={data.people}
          currentUserId={currentUserId}
          initialDate={addEventDate}
          initial={modalPayload?.initial}
          editItem={modalPayload?.editItem}
          onClose={closeModal}
          onSave={upsertEvent}
        />
      )}
      {modal === 'task' && (
        <AddTaskModal
          people={data.people}
          currentUserId={currentUserId}
          initialDate={modalPayload?.initialDate}
          initial={modalPayload?.initial}
          editItem={modalPayload?.editItem}
          onClose={closeModal}
          onSave={upsertTask}
        />
      )}
      {modal === 'note' && (
        <NoteModal
          editItem={modalPayload?.editItem}
          currentUserId={currentUserId}
          onClose={closeModal}
          onSave={upsertNote}
        />
      )}
      {modal === 'wall' && (
        <AddWallMessageModal
          people={data.people}
          currentUserId={currentUserId}
          initial={modalPayload?.initial}
          onClose={closeModal}
          onSave={addWallMessage}
        />
      )}
      {modal === 'budget' && (
        <TransactionModal
          monthKey={selectedBudgetMonth}
          categories={
            data?.budget?.[selectedBudgetMonth]?.categories ||
            createDefaultMonthBudget().categories
          }
          goals={data?.budgetGoals || createDefaultBudgetGoals()}
          people={data.people}
          currentPersonId={currentUserId}
          onClose={closeModal}
          onSave={handleSaveBudgetTransaction}
        />
      )}
      {modal === 'person' && (
        <PersonModal
          editPerson={editingPerson}
          existingCount={data.people.length}
          isCurrentProfile={profile?.person_id === editingPerson?.id}
          onSelectAsMyProfile={editingPerson ? () => selectPerson(editingPerson.id) : null}
          onClose={closeModal}
          onSave={upsertPerson}
        />
      )}

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          people={data.people}
          onClose={() => setDetailEvent(null)}
          onEdit={openEditEvent}
          onDelete={deleteEvent}
          onExcludeDate={excludeEventDate}
          onToggleSubItem={toggleSubItem}
        />
      )}
      {detailTask && (
        <TaskDetailModal
          task={data.tasks.find((t) => t.id === detailTask.id) || detailTask}
          people={data.people}
          onClose={() => setDetailTask(null)}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onEdit={openEditTask}
          onToggleSubItem={toggleSubItem}
        />
      )}
    </div>
  );
}
