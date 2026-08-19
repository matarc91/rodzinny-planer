import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  format, parseISO, addDays, startOfWeek, addMonths, 
  getDay, getDate, startOfMonth, endOfMonth, eachDayOfInterval 
} from 'date-fns';
import { getSupabaseClient } from './supabase.js';
import { addLog, getLogs, clearLogs, subscribeLogs } from './logger.js';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  checkPushSubscription, 
  recordFamilyNotification 
} from './pushManager.js';
import { 
  Calendar, CheckSquare, StickyNote, Users, Plus, X, Check, 
  ChevronLeft, ChevronRight, ChevronDown, Repeat, Clock, Trash2, AlertCircle, 
  Pencil, Bell, BellOff, Utensils, Sparkles, Settings, ToggleLeft, ToggleRight,
  Pin, MessageSquare, Info, RefreshCw, Wifi, LogOut, ArrowRight, Key, Mail,
  Terminal, Copy, UserX, UserCheck, Smartphone, CheckCircle, HelpCircle, Code
} from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

// Wersja aplikacji z pełnym systemem Auth i Prywatnymi Notatkami
const COLORS = {
  bg: '#121214', surface: '#1E1E22', surfaceHighlight: '#2A2A30', 
  ink: '#F3F3F5', inkSoft: '#A0A0AB', border: '#33333C', 
  success: '#4E9A58', warn: '#E57373', accent: '#E2B053', accentSoft: '#2C271D',
};

const PERSON_PALETTE = ['#5B8FF9', '#F65D79', '#5AD8A6', '#A770EF', '#F6BD16', '#6DC8EC', '#FF9D4D', '#36B37E'];
const AVATAR_EMOJIS = ['👨', '👩', '👧', '👦', '👶', '👵', '👴', '🐕', '🐈', '⭐'];
const CARD_COLORS = ['#2C271D', '#1F2A38', '#2C1F2B', '#1D2C24', '#2E221E'];
const WEEKDAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const MONTHS = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];

const REMINDER_OPTIONS = [
  { hours: null, label: 'Brak przypomnienia' },
  { hours: 0, label: 'O czasie wydarzenia' },
  { hours: 1, label: '1 godz. przed' },
  { hours: 2, label: '2 godz. przed' },
  { hours: 24, label: '1 dzień przed' },
];
const RECURRENCE_LABELS = { none: 'Jednorazowo', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };

const toDateStr = (d) => (d ? format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM-dd') : '');
const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const parseDate = (s) => (s ? (typeof s === 'string' ? parseISO(s) : s) : new Date());
const weekdayIdx = (dateStr) => (getDay(parseDate(dateStr)) + 6) % 7;
const dayOfMonth = (dateStr) => getDate(parseDate(dateStr));
const getMonday = (dateStr) => format(startOfWeek(parseDate(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const addDaysStr = (dateStr, n) => format(addDays(parseDate(dateStr), n), 'yyyy-MM-dd');
const addMonthsStr = (dateStr, n) => format(addMonths(parseDate(dateStr), n), 'yyyy-MM-dd');
function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function reminderLabel(hours) { const opt = REMINDER_OPTIONS.find(o => o.hours === hours); return opt ? opt.label : 'Brak'; }

async function sendSystemNotification(title, body, extraOptions = {}) {
  try {
    addLog('info', `Próba wysłania powiadomienia systemowego: "${title}" - "${body}"`);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      addLog('warn', 'Notification API jest niedostępne.');
      return false;
    }
    if (Notification.permission !== 'granted') {
      addLog('warn', `Brak uprawnień do powiadomień systemowych. Status: ${Notification.permission}`);
      return false;
    }

    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      tag: 'rodzinny-planer-' + Date.now(),
      ...extraOptions
    };

    if ('serviceWorker' in navigator) {
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg && navigator.serviceWorker.ready) {
          reg = await navigator.serviceWorker.ready;
        }
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          addLog('success', `Wysłano powiadomienie przez Service Worker: "${title}"`);
          return true;
        }
      } catch (swErr) {
        addLog('warn', `Błąd wywołania Service Worker showNotification: ${swErr.message}`);
      }
    }

    new Notification(title, options);
    addLog('success', `Wysłano powiadomienie przez Notification API: "${title}"`);
    return true;
  } catch (e) {
    addLog('error', `Nie udało się wysłać powiadomienia: ${e.message}`);
    return false;
  }
}

function occursOnDate(event, dateStr) {
  if (dateStr < event.date) return false;
  const freq = event.recurrence?.freq || 'none';
  if (freq === 'none') {
    if (event.endDate && event.endDate >= event.date) {
      return dateStr >= event.date && dateStr <= event.endDate;
    }
    return dateStr === event.date;
  }
  if (freq === 'daily') return true;
  if (freq === 'weekly') return weekdayIdx(dateStr) === weekdayIdx(event.date);
  if (freq === 'monthly') return dayOfMonth(dateStr) === dayOfMonth(event.date);
  return false;
}

function getEventBadgeBackground(ev, people, isSelected = false) {
  const pIds = ev.personIds || [];
  const assigned = pIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  
  if (assigned.length === 0) {
    return isSelected ? '#121214' : COLORS.inkSoft;
  }
  
  if (assigned.length === 1) {
    return assigned[0].color || COLORS.accent;
  }

  // Wieloosobowy event - płynny gradient z kolorów wszystkich przypisanych osób
  const colors = assigned.map(p => p.color || COLORS.accent);
  if (colors.length === 2) {
    return `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  }
  
  const step = 100 / (colors.length - 1);
  const colorStops = colors.map((c, idx) => `${c} ${Math.round(idx * step)}%`).join(', ');
  return `linear-gradient(90deg, ${colorStops})`;
}

function getPeriodKey(freq, dateStr) {
  if (freq === 'daily') return dateStr;
  if (freq === 'weekly') return getMonday(dateStr);
  if (freq === 'monthly') return dateStr.slice(0, 7);
  return 'once';
}

function isTaskDoneForPeriod(task, dateStr) {
  const freq = task.recurrence?.freq || 'none';
  return !!(task.completions && task.completions[getPeriodKey(freq, dateStr)]);
}

function emptyData() {
  return { 
    lastUpdatedAt: Date.now(),
    people: [
      { id: 'p_1', name: 'Mama', color: '#F65D79', emoji: '👩' },
      { id: 'p_2', name: 'Tata', color: '#5B8FF9', emoji: '👨' }
    ], 
    events: [], tasks: [], notes: [], wall: [], meals: {},
    settings: { enableMeals: true, enableWall: true }
  };
}

/* --- COMPONENTS --- */

function Chip({ person, size = 'sm' }) {
  if (!person) return null;
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-sm';
  return (
    <span title={person.name} style={{ background: person.color || COLORS.accent, color: '#fff' }} className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 shadow-sm ${s}`}>
      {person.emoji || person.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PersonRow({ people, personIds }) {
  const selected = (people || []).filter(p => personIds?.includes(p.id));
  if (selected.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {selected.map(p => (
        <div key={p.id} className="flex items-center gap-1.5 bg-stone-800/80 rounded-full pr-2.5 pb-0.5 pt-0.5 pl-0.5 border border-stone-700/50">
          <Chip person={p} size="sm" />
          <span className="text-[10px] font-semibold text-stone-300 leading-none">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold flex items-center gap-2">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text, icon: Icon = Sparkles }) {
  return (
    <div style={{ color: COLORS.inkSoft, borderColor: COLORS.border }} className="text-sm border border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-stone-900/40">
      <Icon size={24} className="opacity-40" /><span>{text}</span>
    </div>
  );
}

function ChecklistContainer({ items = [], onToggleItem, onAddItem, onRemoveItem }) {
  const [newText, setNewText] = useState('');
  const handleAdd = () => { if (!newText.trim()) return; onAddItem(newText.trim()); setNewText(''); };
  return (
    <div className="space-y-2 mt-2">
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 bg-stone-800/60 p-2 rounded-xl border border-stone-800">
              <button type="button" onClick={() => onToggleItem(item.id)} style={{ borderColor: item.done ? COLORS.success : COLORS.border, background: item.done ? COLORS.success : 'transparent' }} className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors">
                {item.done && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? 'line-through text-stone-500' : 'text-stone-200'}`}>{item.text}</span>
              {onRemoveItem && <button type="button" onClick={() => onRemoveItem(item.id)} className="text-stone-500 hover:text-red-400 p-1"><X size={15} /></button>}
            </div>
          ))}
        </div>
      )}
      {onAddItem && (
        <div className="flex items-center gap-2 pt-1">
          <input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder="Dodaj pozycję..." style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }} className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <button type="button" onClick={handleAdd} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl w-9 h-9 flex items-center justify-center font-bold shrink-0 hover:opacity-90"><Plus size={18} /></button>
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div style={{ background: COLORS.surface }} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-all border border-stone-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-stone-900/90 backdrop-blur z-10" style={{ borderColor: COLORS.border }}>
          <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-800 transition text-stone-400"><X size={22} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function PersonPicker({ people, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map(p => {
        const isOn = selected.includes(p.id);
        return (
          <button key={p.id} type="button" onClick={() => onToggle(p.id)} style={{ background: isOn ? p.color : COLORS.surfaceHighlight, borderColor: p.color, color: isOn ? '#fff' : p.color }} className="px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm">
            <Chip person={p} size="sm" /><span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function RecurrencePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(RECURRENCE_LABELS).map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} style={{ background: value === k ? COLORS.accent : COLORS.surfaceHighlight, borderColor: value === k ? COLORS.accent : COLORS.border, color: value === k ? '#121214' : COLORS.ink }} className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition">{label}</button>
      ))}
    </div>
  );
}

function ReminderPicker({ value, onChange }) {
  return (
    <select value={value === null ? 'null' : value} onChange={e => { const val = e.target.value === 'null' ? null : Number(e.target.value); onChange(val); }} style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }} className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none cursor-pointer">
      {REMINDER_OPTIONS.map(opt => <option key={String(opt.hours)} value={opt.hours === null ? 'null' : opt.hours} className="bg-stone-900 text-stone-100">{opt.label}</option>)}
    </select>
  );
}

const inputStyle = "w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100";

/* --- MODALS --- */

function AddEventModal({ people, currentUserId, initialDate, initial, editItem, onClose, onSave }) {
  const isEdit = !!editItem;
  const [title, setTitle] = useState(editItem?.title || '');
  const [date, setDate] = useState(editItem?.date || initialDate);
  const [endDate, setEndDate] = useState(editItem?.endDate || '');
  const [time, setTime] = useState(editItem?.time || '');
  const [personIds, setPersonIds] = useState(editItem?.personIds || (currentUserId ? [currentUserId] : []));
  const [freq, setFreq] = useState(editItem?.recurrence?.freq || 'none');
  const [note, setNote] = useState(editItem?.note ?? initial?.note ?? '');
  const [items, setItems] = useState(editItem?.items || initial?.items || []);
  const [reminderHours, setReminderHours] = useState(editItem ? (editItem.reminder?.hours ?? null) : 0);

  const save = () => {
    if (!title.trim()) return;
    const finalEndDate = (endDate && endDate >= date) ? endDate : null;
    onSave({ 
      id: editItem?.id || uid('ev'), 
      title: title.trim(), 
      date, 
      endDate: finalEndDate,
      time, 
      personIds, 
      recurrence: { freq }, 
      note: note.trim(), 
      items, 
      reminder: reminderHours === null ? null : { hours: reminderHours } 
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Tytuł wydarzenia</label><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Wyjazd w góry, Dentysta" style={{ borderColor: COLORS.border }} className={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Data rozpoczęcia</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => {
                const newDate = e.target.value;
                setDate(newDate);
                if (endDate && newDate > endDate) setEndDate('');
              }} 
              style={{ borderColor: COLORS.border }} 
              className={inputStyle} 
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">
              Data zakończenia <span className="text-[10px] text-stone-500 font-normal">(wyjazd)</span>
            </label>
            <input 
              type="date" 
              value={endDate} 
              min={date} 
              onChange={e => setEndDate(e.target.value)} 
              style={{ borderColor: COLORS.border }} 
              className={inputStyle} 
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Godzina (opcjonalnie)</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} />
        </div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Przypisane osoby</label><PersonPicker people={people} selected={personIds} onToggle={id => setPersonIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Powtarzanie</label><RecurrencePicker value={freq} onChange={setFreq} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Przypomnienie</label><ReminderPicker value={reminderHours} onChange={setReminderHours} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Notatka</label><textarea value={note} onChange={e => setNote(e.target.value)} style={{ borderColor: COLORS.border }} className={`${inputStyle} h-20 resize-none`} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Checklista</label><ChecklistContainer items={items} onToggleItem={id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i))} onAddItem={text => setItems(p => [...p, { id: uid('it'), text, done: false }])} onRemoveItem={id => setItems(p => p.filter(i => i.id !== id))} /></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz' : 'Dodaj wydarzenie'}</button>
      </div>
    </ModalShell>
  );
}

function AddTaskModal({ people, currentUserId, initial, editItem, onClose, onSave }) {
  const isEdit = !!editItem;
  const [title, setTitle] = useState(editItem?.title || '');
  const [dueDate, setDueDate] = useState(editItem?.dueDate || todayStr());
  const [time, setTime] = useState(editItem?.time || '');
  const [personIds, setPersonIds] = useState(editItem?.personIds || (currentUserId ? [currentUserId] : []));
  const [freq, setFreq] = useState(editItem?.recurrence?.freq || 'none');
  const [note, setNote] = useState(editItem?.note ?? initial?.note ?? '');
  const [items, setItems] = useState(editItem?.items || initial?.items || []);
  const [reminderHours, setReminderHours] = useState(editItem ? (editItem.reminder?.hours ?? null) : 0);

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: editItem?.id || uid('task'), title: title.trim(), dueDate, time, personIds, recurrence: { freq }, note: note.trim(), items, reminder: reminderHours === null ? null : { hours: reminderHours }, completions: editItem?.completions || {}, createdAt: editItem?.createdAt || todayStr() });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj zadanie' : 'Nowe zadanie'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Zadanie</label><input autoFocus value={title} onChange={e => setTitle(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Termin</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} /></div>
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Godzina</label><input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} /></div>
        </div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Wykonawca</label><PersonPicker people={people} selected={personIds} onToggle={id => setPersonIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Powtarzanie</label><RecurrencePicker value={freq} onChange={setFreq} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Przypomnienie</label><ReminderPicker value={reminderHours} onChange={setReminderHours} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Notatka</label><textarea value={note} onChange={e => setNote(e.target.value)} style={{ borderColor: COLORS.border }} className={`${inputStyle} h-20 resize-none`} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Checklista</label><ChecklistContainer items={items} onToggleItem={id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i))} onAddItem={text => setItems(p => [...p, { id: uid('it'), text, done: false }])} onRemoveItem={id => setItems(p => p.filter(i => i.id !== id))} /></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz' : 'Dodaj zadanie'}</button>
      </div>
    </ModalShell>
  );
}

function NoteModal({ editItem, currentUserId, onClose, onSave }) {
  const isEdit = !!editItem;
  const [text, setText] = useState(editItem?.text || '');
  const [items, setItems] = useState(editItem?.items || []);

  const save = () => {
    if (!text.trim() && items.length === 0) return;
    onSave({ id: editItem?.id || uid('note'), text: text.trim(), items, createdAt: editItem?.createdAt || new Date().toISOString(), personId: editItem?.personId || currentUserId });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj notatkę' : 'Nowa notatka'} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-3 flex items-start gap-2 text-amber-200/80 text-xs">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>Notatki są <b>prywatne</b> i widoczne tylko dla Ciebie. Inni domownicy zobaczą je dopiero, gdy zamienisz je w Zadanie lub Wydarzenie.</p>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Treść</label>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} style={{ borderColor: COLORS.border }} className={`${inputStyle} h-24 resize-none`} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Lista pozycji</label>
          <ChecklistContainer items={items} onToggleItem={id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i))} onAddItem={text => setItems(p => [...p, { id: uid('it'), text, done: false }])} onRemoveItem={id => setItems(p => p.filter(i => i.id !== id))} />
        </div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz' : 'Zapisz notatkę'}</button>
      </div>
    </ModalShell>
  );
}

function PersonModal({ editPerson, existingCount, isCurrentProfile, onSelectAsMyProfile, onClose, onSave }) {
  const [name, setName] = useState(editPerson?.name || '');
  const [color, setColor] = useState(editPerson?.color || PERSON_PALETTE[existingCount % PERSON_PALETTE.length]);
  const [emoji, setEmoji] = useState(editPerson?.emoji || '👨');
  const save = () => { if (name.trim()) { onSave({ id: editPerson?.id || uid('p'), name: name.trim(), color, emoji }); onClose(); } };
  return (
    <ModalShell title={editPerson ? "Edytuj członka rodziny" : "Dodaj osobę"} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Imię / Rola</label><input autoFocus value={name} onChange={e => setName(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Ikona</label><div className="flex flex-wrap gap-2 p-2 rounded-xl bg-stone-900 border border-stone-800">{AVATAR_EMOJIS.map(em => <button key={em} type="button" onClick={() => setEmoji(em)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${emoji === em ? 'bg-stone-800 shadow-md scale-110' : 'hover:bg-stone-800/50'}`}>{em}</button>)}</div></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Kolor</label><div className="flex flex-wrap gap-2">{PERSON_PALETTE.map(c => <button key={c} type="button" onClick={() => setColor(c)} style={{ background: c }} className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'opacity-80'}`} />)}</div></div>
        
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

        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{editPerson ? 'Zapisz' : 'Dodaj osobę'}</button>
      </div>
    </ModalShell>
  );
}

function AddWallMessageModal({ people, currentUserId, onClose, onSave }) {
  const [text, setText] = useState('');
  const [personId, setPersonId] = useState(currentUserId || people[0]?.id || '');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [isPinned, setIsPinned] = useState(false);
  const save = () => { if (text.trim()) { onSave({ id: uid('w'), text: text.trim(), personId, color, isPinned, createdAt: new Date().toISOString() }); onClose(); } };
  return (
    <ModalShell title="Wiadomość na tablicy" onClose={onClose}>
      <div className="space-y-4">
        <div><textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Wiadomość..." style={{ borderColor: COLORS.border }} className={`${inputStyle} h-28 resize-none`} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Podpisane przez</label><div className="flex flex-wrap gap-2">{people.map(p => <button key={p.id} type="button" onClick={() => setPersonId(p.id)} className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition ${personId === p.id ? 'bg-amber-400 text-stone-950 font-bold border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`}><Chip person={p} size="sm" /><span>{p.name}</span></button>)}</div></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Styl</label><div className="flex gap-2">{CARD_COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} style={{ background: c }} className={`w-8 h-8 rounded-xl border transition ${color === c ? 'border-amber-400 scale-110 ring-2' : 'border-stone-700'}`} />)}</div></div>
        <div className="flex items-center gap-2 pt-1"><input type="checkbox" id="pinMsg" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700" /><label htmlFor="pinMsg" className="text-xs font-medium text-stone-300 flex items-center gap-1 cursor-pointer"><Pin size={14} className="text-amber-400" /> Przypnij na górze</label></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">Przypnij</button>
      </div>
    </ModalShell>
  );
}

function EventDetailModal({ event, people, onClose, onEdit, onDelete, onToggleSubItem }) {
  const isMultiDay = (!event.recurrence?.freq || event.recurrence.freq === 'none') && event.endDate && event.endDate > event.date;
  return (
    <ModalShell title="Szczegóły wydarzenia" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{event.title}</h4>
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono text-stone-400">
            {isMultiDay ? (
              <span className="text-amber-300 font-semibold bg-amber-900/30 px-2 py-0.5 rounded border border-amber-900/50">
                📅 {event.date} – {event.endDate} {event.time ? `· ⏰ ${event.time}` : ''}
              </span>
            ) : (
              <span>📅 {event.date} {event.time ? `· ⏰ ${event.time}` : ''}</span>
            )}
            {event.recurrence?.freq && event.recurrence.freq !== 'none' && (
              <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                <Repeat size={12} /> {RECURRENCE_LABELS[event.recurrence.freq]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          {event.reminder ? <Bell size={14} className="text-amber-400" /> : <BellOff size={14} />} <span>{event.reminder ? `Przypomnienie: ${reminderLabel(event.reminder.hours)}` : 'Brak przypomnienia'}</span>
        </div>
        <div><div className="text-xs font-semibold mb-1 text-stone-400">Biorą udział:</div><PersonRow people={people} personIds={event.personIds} /></div>
        {event.note && <div style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }} className="border rounded-xl p-3 text-sm whitespace-pre-wrap text-stone-300">{event.note}</div>}
        {event.items?.length > 0 && <div><div className="text-xs font-semibold mb-1 text-stone-400">Kroki:</div><ChecklistContainer items={event.items} onToggleItem={(itemId) => onToggleSubItem(event.id, itemId, 'event')} /></div>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => onEdit(event)} style={{ borderColor: COLORS.border, color: COLORS.ink }} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800"><Pencil size={15} /> Edytuj</button>
          <button onClick={() => { onDelete(event.id); onClose(); }} style={{ borderColor: COLORS.border, color: COLORS.warn }} className="border rounded-xl px-4 flex items-center justify-center hover:bg-red-950/40"><Trash2 size={16} /></button>
        </div>
      </div>
    </ModalShell>
  );
}

function TaskDetailModal({ task, people, onClose, onToggle, onDelete, onEdit, onToggleSubItem }) {
  const isDone = isTaskDoneForPeriod(task, todayStr());
  return (
    <ModalShell title="Szczegóły zadania" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{task.title}</h4>
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono text-stone-400">
            <span>Termin: {task.dueDate} {task.time ? `· ⏰ ${task.time}` : ''}</span>
            {task.recurrence?.freq !== 'none' && <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded"><Repeat size={12} /> {RECURRENCE_LABELS[task.recurrence.freq]}</span>}
          </div>
        </div>
        <div><div className="text-xs font-semibold mb-1 text-stone-400">Wykonawcy:</div><PersonRow people={people} personIds={task.personIds} /></div>
        {task.note && <div style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }} className="border rounded-xl p-3 text-sm whitespace-pre-wrap text-stone-300">{task.note}</div>}
        {task.items?.length > 0 && <div><div className="text-xs font-semibold mb-1 text-stone-400">Checklista:</div><ChecklistContainer items={task.items} onToggleItem={(itemId) => onToggleSubItem(task.id, itemId, 'task')} /></div>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => { onToggle(task); onClose(); }} style={{ background: isDone ? COLORS.surfaceHighlight : COLORS.success, color: '#fff', borderColor: COLORS.border }} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 shadow"><Check size={16} /> {isDone ? 'Cofnij wykonanie' : 'Zrobione'}</button>
          <button onClick={() => onEdit(task)} style={{ borderColor: COLORS.border, color: COLORS.ink }} className="border rounded-xl px-3 hover:bg-stone-800"><Pencil size={16} /></button>
          <button onClick={() => { onDelete(task.id); onClose(); }} style={{ borderColor: COLORS.border, color: COLORS.warn }} className="border rounded-xl px-3 hover:bg-red-950/40"><Trash2 size={16} /></button>
        </div>
      </div>
    </ModalShell>
  );
}

/* --- VIEWS --- */

function TodayView({ data, onOpenEvent, onOpenTask, onOpenAddEvent, onOpenAddTask, onToggleTask }) {
  const today = todayStr();
  const events = data.events.filter(ev => occursOnDate(ev, today)).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const pendingTasks = data.tasks.filter(t => { const f = t.recurrence?.freq || 'none'; return (f === 'none' ? t.dueDate === today : t.dueDate <= today || f !== 'none'); }).filter(t => !isTaskDoneForPeriod(t, today));
  const overdue = data.tasks.filter(t => (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isTaskDoneForPeriod(t, today));
  const todayMeal = data.settings?.enableMeals ? (data.meals?.[getMonday(today)]?.[weekdayIdx(today)] || null) : null;
  const pinnedWall = data.settings?.enableWall ? (data.wall || []).filter(w => w.isPinned) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-400 font-mono">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold mt-0.5">Dziś w domu</h2>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onOpenAddEvent(today)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-stone-800"><Plus size={14} /> Wydarzenie</button>
          <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:opacity-90"><Plus size={14} /> Zadanie</button>
        </div>
      </div>

      {pinnedWall.length > 0 && (
        <div className="space-y-2">
          {pinnedWall.map(msg => {
            const author = data.people.find(p => p.id === msg.personId);
            return (
              <div key={msg.id} style={{ background: msg.color, borderColor: COLORS.accent }} className="border rounded-2xl p-3.5 shadow-md flex items-start gap-3">
                <Pin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-amber-300/80 font-bold mb-0.5">{author?.name || 'Domownik'}</div>
                  <p className="text-sm font-medium text-stone-100 whitespace-pre-wrap">{msg.text}</p>
                </div>
                <Chip person={author} />
              </div>
            );
          })}
        </div>
      )}

      {overdue.length > 0 && (
        <Section title="Zaległe zadania">
          <div className="space-y-2">
            {overdue.map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)} style={{ background: '#2C1B1B', borderColor: COLORS.warn }} className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs cursor-pointer">
                <button onClick={(e) => { e.stopPropagation(); onToggleTask(t); }} className="w-6 h-6 rounded-lg border-2 border-red-400/50 hover:border-success flex items-center justify-center shrink-0 mt-0.5 bg-red-950/20"></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="text-xs font-mono text-red-400">Termin był: {t.dueDate}</div>
                  <PersonRow people={data.people} personIds={t.personIds} />
                </div>
                <AlertCircle size={18} className="text-red-400 shrink-0 opacity-50" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {todayMeal && (todayMeal.lunch || todayMeal.dinner || todayMeal.breakfast) && (
        <div style={{ background: COLORS.accentSoft, borderColor: '#5C4A28' }} className="border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-sm text-amber-300"><Utensils size={16} /> Dzisiejsze menu</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {todayMeal.breakfast && <div><span className="font-semibold text-amber-400/80">Śniadanie:</span> <span className="text-stone-200">{todayMeal.breakfast}</span></div>}
            {todayMeal.lunch && <div><span className="font-semibold text-amber-400/80">Obiad:</span> <span className="text-amber-200 font-bold">{todayMeal.lunch}</span></div>}
            {todayMeal.dinner && <div><span className="font-semibold text-amber-400/80">Kolacja:</span> <span className="text-stone-200">{todayMeal.dinner}</span></div>}
          </div>
        </div>
      )}

      <Section title="Plan wydarzeń na dziś">
        {events.length === 0 ? <EmptyState text="Brak wydarzeń na dziś" icon={Calendar} /> : (
          <div className="space-y-2">
            {events.map(ev => {
              const isMultiDay = (!ev.recurrence?.freq || ev.recurrence.freq === 'none') && ev.endDate && ev.endDate > ev.date;
              return (
                <div key={ev.id} onClick={() => onOpenEvent(ev)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 text-left shadow-2xs cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    {ev.time ? (
                      <span style={{ fontFamily: 'IBM Plex Mono', color: COLORS.accent, background: '#2B261D' }} className="text-xs px-2 py-0.5 rounded-md font-semibold shrink-0 font-mono">{ev.time}</span>
                    ) : (
                      <span className="text-xs text-stone-500 font-mono shrink-0">Cały dzień</span>
                    )}
                    <span className="text-sm font-semibold flex-1 truncate">{ev.title}</span>
                    {isMultiDay && (
                      <span className="text-[10px] bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded font-mono font-medium border border-amber-900/40">
                        {ev.date} – {ev.endDate}
                      </span>
                    )}
                  </div>
                  {ev.note && <div className="text-xs mt-1.5 line-clamp-1 text-stone-400">{ev.note}</div>}
                  <PersonRow people={data.people} personIds={ev.personIds} />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Do zrobienia dzisiaj">
        {pendingTasks.length === 0 ? <EmptyState text="Wszystkie dzisiejsze zadania ukończone! 🎉" icon={CheckSquare} /> : (
          <div className="space-y-2">
            {pendingTasks.map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs cursor-pointer">
                <button onClick={(e) => { e.stopPropagation(); onToggleTask(t); }} className="w-6 h-6 rounded-lg border-2 border-stone-600 flex items-center justify-center shrink-0 mt-0.5 bg-stone-900/50"></button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">{t.title}</span>
                  <PersonRow people={data.people} personIds={t.personIds} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function CalendarView({ data, onOpenAdd, onOpenEvent }) {
  const [monthAnchor, setMonthAnchor] = useState(todayStr());
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [personFilter, setPersonFilter] = useState('all');

  const { year, month, cells } = useMemo(() => {
    const anchorDate = parseDate(monthAnchor);
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const yr = anchorDate.getFullYear();
    const mth = anchorDate.getMonth();
    
    // ISO offset (Poniedziałek = 0, ..., Niedziela = 6)
    const startOffset = (getDay(monthStart) + 6) % 7;
    
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).map(d => format(d, 'yyyy-MM-dd'));
    const cellList = Array(startOffset).fill(null).concat(monthDays);
    
    return { year: yr, month: mth, cells: cellList };
  }, [monthAnchor]);

  // Słownik (Record<string, Event[]>), gdzie kluczem jest data YYYY-MM-DD,
  // a wartością tablica pasujących wydarzeń (w tym wielodniowych i cyklicznych)
  const eventsByDate = useMemo(() => {
    const map = {};
    const visibleDates = cells.filter(Boolean);
    if (visibleDates.length === 0) return map;

    const filteredEvents = (data.events || []).filter(ev => 
      personFilter === 'all' || ev.personIds?.includes(personFilter)
    );

    for (const dateStr of visibleDates) {
      map[dateStr] = [];
    }

    for (const ev of filteredEvents) {
      for (const dateStr of visibleDates) {
        if (occursOnDate(ev, dateStr)) {
          map[dateStr].push(ev);
        }
      }
    }

    return map;
  }, [cells, data.events, personFilter]);

  const dayEvents = useMemo(() => {
    return eventsByDate[selectedDay] || [];
  }, [eventsByDate, selectedDay]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setMonthAnchor(addMonthsStr(monthAnchor, -1))} className="p-2 rounded-xl hover:bg-stone-800"><ChevronLeft size={20} /></button>
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-xl font-bold capitalize text-stone-100">{MONTHS[month]} {year}</h2>
        <button onClick={() => setMonthAnchor(addMonthsStr(monthAnchor, 1))} className="p-2 rounded-xl hover:bg-stone-800"><ChevronRight size={20} /></button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar">
        <button onClick={() => setPersonFilter('all')} style={{ background: personFilter === 'all' ? COLORS.accent : COLORS.surface, color: personFilter === 'all' ? '#121214' : COLORS.ink, borderColor: COLORS.border }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0">Wszyscy</button>
        {data.people.map(p => <button key={p.id} onClick={() => setPersonFilter(p.id)} style={{ background: personFilter === p.id ? p.color : COLORS.surface, color: personFilter === p.id ? '#fff' : p.color, borderColor: p.color }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1"><Chip person={p} size="sm" /> {p.name}</button>)}
      </div>

      <div className="border rounded-2xl p-3 shadow-xs bg-[#1E1E22] border-[#33333C]">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] uppercase font-bold tracking-wider text-stone-500">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} className="aspect-square" />;
            const isToday = dateStr === todayStr();
            const isSelected = dateStr === selectedDay;
            const evs = eventsByDate[dateStr] || [];
            const cellWeekday = weekdayIdx(dateStr);

            return (
              <button 
                key={dateStr} 
                onClick={() => setSelectedDay(dateStr)} 
                style={{ 
                  background: isSelected ? COLORS.accent : isToday ? COLORS.accentSoft : 'transparent', 
                  color: isSelected ? '#121214' : COLORS.ink, 
                  borderColor: isToday && !isSelected ? COLORS.accent : 'transparent' 
                }} 
                className={`aspect-square rounded-xl flex flex-col items-center justify-between p-1 relative text-xs border overflow-hidden ${isSelected ? 'shadow-md font-bold' : ''}`}
              >
                <span className={`font-semibold z-10 ${isToday ? 'underline font-bold' : ''}`}>{dayOfMonth(dateStr)}</span>
                
                {evs.length > 0 && (
                  <div className="w-full flex flex-col gap-0.5 mt-auto pt-0.5 z-0">
                    {evs.slice(0, 3).map((ev) => {
                      const isMultiDay = (!ev.recurrence?.freq || ev.recurrence.freq === 'none') && Boolean(ev.endDate) && ev.endDate > ev.date;
                      const bg = getEventBadgeBackground(ev, data.people, isSelected);

                      if (!isMultiDay) {
                        // Pojedyncze wydarzenie: zaokrąglona pigułka (jednokolorowa lub z dynamicznym gradientem)
                        return (
                          <div key={ev.id} className="w-full flex justify-center items-center">
                            <span 
                              style={{ background: bg }} 
                              className="h-1.5 w-3.5 rounded-full shadow-2xs block" 
                              title={ev.title}
                            />
                          </div>
                        );
                      }

                      // Wydarzenie wielodniowe: pasek przechodzący poziomo przez dni
                      const isFirstDay = dateStr === ev.date || cellWeekday === 0;
                      const isLastDay = dateStr === ev.endDate || cellWeekday === 6;

                      let roundingClass = 'rounded-none';
                      let marginClass = '-mx-1 w-[calc(100%+8px)]';

                      if (isFirstDay && isLastDay) {
                        roundingClass = 'rounded-full';
                        marginClass = 'mx-0.5 w-[calc(100%-4px)]';
                      } else if (isFirstDay) {
                        roundingClass = 'rounded-l-full rounded-r-none';
                        marginClass = 'ml-0.5 -mr-1 w-[calc(100%+2px)]';
                      } else if (isLastDay) {
                        roundingClass = 'rounded-r-full rounded-l-none';
                        marginClass = '-ml-1 mr-0.5 w-[calc(100%+2px)]';
                      }

                      return (
                        <div key={ev.id} className="w-full overflow-visible flex items-center justify-center">
                          <span 
                            style={{ background: bg }} 
                            className={`h-1.5 block shadow-2xs ${roundingClass} ${marginClass}`}
                            title={`${ev.title} (${ev.date} – ${ev.endDate})`}
                          />
                        </div>
                      );
                    })}
                    {evs.length > 3 && (
                      <span className="text-[8px] font-mono leading-none text-stone-400 self-center">
                        +{evs.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Section title={parseDate(selectedDay).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })} action={<button onClick={() => onOpenAdd(selectedDay)} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1"><Plus size={14} /> Dodaj</button>}>
        {dayEvents.length === 0 ? <EmptyState text="Brak wydarzeń w tym dniu" /> : (
          <div className="space-y-2">
            {dayEvents.slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')).map(ev => {
              const isMultiDay = (!ev.recurrence?.freq || ev.recurrence.freq === 'none') && ev.endDate && ev.endDate > ev.date;
              return (
                <div key={ev.id} onClick={() => onOpenEvent(ev)} className="w-full border rounded-2xl p-3.5 text-left bg-[#1E1E22] border-[#33333C] cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    {ev.time ? (
                      <span style={{ color: COLORS.accent, background: '#2B261D' }} className="text-xs px-2 py-0.5 rounded-md font-semibold font-mono">{ev.time}</span>
                    ) : (
                      <span className="text-xs text-stone-500 font-mono">Cały dzień</span>
                    )}
                    <span className="text-sm font-semibold flex-1 truncate">{ev.title}</span>
                    {isMultiDay && (
                      <span className="text-[10px] bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded font-mono font-medium border border-amber-900/40">
                        {ev.date} – {ev.endDate}
                      </span>
                    )}
                    {ev.recurrence?.freq && ev.recurrence.freq !== 'none' && (
                      <Repeat size={14} className="text-stone-500" />
                    )}
                  </div>
                  <PersonRow people={data.people} personIds={ev.personIds} />
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function TasksView({ data, onToggleTask, onDeleteTask, onOpenTask, onOpenAddTask }) {
  const today = todayStr();
  const [filter, setFilter] = useState('all');
  const visible = data.tasks.filter(t => filter === 'all' || t.personIds?.includes(filter));
  const pending = visible.filter(t => !isTaskDoneForPeriod(t, today));
  const done = visible.filter(t => isTaskDoneForPeriod(t, today));

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">Zadania</h2>
        <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> Zadanie</button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? COLORS.accent : COLORS.surface, color: filter === 'all' ? '#121214' : COLORS.ink, borderColor: COLORS.border }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0">Wszyscy</button>
        {data.people.map(p => <button key={p.id} onClick={() => setFilter(p.id)} style={{ background: filter === p.id ? p.color : COLORS.surface, color: filter === p.id ? '#fff' : p.color, borderColor: p.color }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1"><Chip person={p} size="sm" /> {p.name}</button>)}
      </div>

      <Section title={`Do zrobienia (${pending.length})`}>
        {pending.length === 0 ? <EmptyState text="Wszystko zrobione!" icon={CheckSquare} /> : (
          <div className="space-y-2">
            {pending.map(t => <TaskRow key={t.id} t={t} people={data.people} today={today} onToggle={onToggleTask} onDelete={onDeleteTask} onOpen={onOpenTask} />)}
          </div>
        )}
      </Section>

      {done.length > 0 && (
        <Section title={`Wykonane (${done.length})`}>
          <div className="space-y-2 opacity-60">
            {done.map(t => <TaskRow key={t.id} t={t} people={data.people} today={today} onToggle={onToggleTask} onDelete={onDeleteTask} onOpen={onOpenTask} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

function TaskRow({ t, people, today, onToggle, onDelete, onOpen }) {
  const isDone = isTaskDoneForPeriod(t, today);
  const isOverdue = (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isDone;
  return (
    <div onClick={() => onOpen(t)} style={{ background: COLORS.surface, borderColor: isOverdue ? COLORS.warn : COLORS.border }} className="border rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer">
      <button onClick={(e) => { e.stopPropagation(); onToggle(t); }} style={{ borderColor: isDone ? COLORS.success : COLORS.inkSoft, background: isDone ? COLORS.success : 'transparent' }} className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 bg-stone-900/50">
        {isDone && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div style={{ textDecoration: isDone ? 'line-through' : 'none' }} className={`text-sm font-semibold truncate ${isDone ? 'opacity-50' : ''}`}>{t.title}</div>
        <div className="flex items-center gap-2 mt-0.5 mb-1">
          <span className="text-[11px] font-mono text-stone-500">Termin: {t.dueDate}</span>
          {t.recurrence?.freq !== 'none' && <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Repeat size={10} /> {RECURRENCE_LABELS[t.recurrence.freq]}</span>}
          {isOverdue && <span className="text-[11px] font-bold text-red-400">Zaległe!</span>}
        </div>
        <PersonRow people={people} personIds={t.personIds} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={16} /></button>
    </div>
  );
}

function NotesView({ notes, onDelete, onConvert, onEdit, onToggleItem, onOpenAddNote }) {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">Notatki</h2>
          <p className="text-xs text-stone-400">Prywatne notatki i listy</p>
        </div>
        <button onClick={onOpenAddNote} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> Notatka</button>
      </div>

      {sorted.length === 0 ? <EmptyState text="Brak zapisanych notatek" icon={StickyNote} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(n => (
            <div key={n.id} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/30 text-amber-500 border border-amber-900/50 font-semibold flex items-center gap-1">
                    Prywatne
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(n)} className="p-1 text-stone-500"><Pencil size={15} /></button>
                    <button onClick={() => onDelete(n.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                </div>
                {n.text && <p className="text-sm whitespace-pre-wrap my-1 text-stone-200">{n.text}</p>}
                {n.items?.length > 0 && (
                  <div className="space-y-1.5 my-2">
                    {n.items.map(item => (
                      <button key={item.id} onClick={() => onToggleItem(n.id, item.id)} className="flex items-center gap-2.5 w-full text-left">
                        <span style={{ borderColor: item.done ? COLORS.success : COLORS.border, background: item.done ? COLORS.success : 'transparent' }} className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0">
                          {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                        </span>
                        <span style={{ textDecoration: item.done ? 'line-through' : 'none' }} className={`text-sm font-medium flex-1 ${item.done ? 'text-stone-500' : 'text-stone-100'}`}>{item.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-stone-800 mt-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-stone-500">{new Date(n.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
                <div className="flex gap-1">
                  <button onClick={() => onConvert(n, 'task')} className="border border-stone-700 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800"><CheckSquare size={12} /> Zadanie</button>
                  <button onClick={() => onConvert(n, 'event')} className="border border-stone-700 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800"><Calendar size={12} /> Wydarz.</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WallView({ wall = [], people, onDeleteWallMessage, onTogglePinWallMessage, onOpenAddWall }) {
  const sorted = [...wall].sort((a, b) => (a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)));
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <div><h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">Tablica</h2><p className="text-xs text-stone-400">Wirtualna korkówka</p></div>
        <button onClick={onOpenAddWall} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> Wiadomość</button>
      </div>
      {sorted.length === 0 ? <EmptyState text="Brak wiadomości" icon={MessageSquare} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(msg => {
            const author = people.find(p => p.id === msg.personId);
            return (
              <div key={msg.id} style={{ background: msg.color || COLORS.surface, borderColor: msg.isPinned ? COLORS.accent : COLORS.border }} className="border rounded-2xl p-4 flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 bg-black/20 pr-2.5 rounded-full"><Chip person={author} size="sm" /><span className="text-xs font-bold text-stone-200">{author?.name || 'Domownik'}</span></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onTogglePinWallMessage(msg.id)} className={`p-1 rounded ${msg.isPinned ? 'text-amber-400' : 'text-stone-500'}`}><Pin size={15} /></button>
                      <button onClick={() => onDeleteWallMessage(msg.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap my-2 text-stone-100 font-medium">{msg.text}</p>
                </div>
                <div className="pt-2 border-t mt-2 flex items-center justify-between border-stone-800/80">
                  <span className="text-[10px] font-mono text-stone-500">{new Date(msg.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.isPinned && <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5"><Pin size={10} /> Przypięte</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MealsView({ meals, onUpdateMeal }) {
  const [mondayAnchor, setMondayAnchor] = useState(getMonday(todayStr()));
  const days = Array(7).fill(0).map((_, i) => addDaysStr(mondayAnchor, i));
  const weekMeals = meals?.[mondayAnchor] || {};

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <div><h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">Posiłki</h2><p className="text-xs text-stone-400">Jadłospis</p></div>
        <div className="flex items-center gap-2 border rounded-xl p-1 bg-[#1E1E22] border-[#33333C]">
          <button onClick={() => setMondayAnchor(addDaysStr(mondayAnchor, -7))} className="p-1 rounded-lg hover:bg-stone-800"><ChevronLeft size={18} /></button>
          <span className="text-xs font-mono font-semibold">{parseDate(mondayAnchor).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
          <button onClick={() => setMondayAnchor(addDaysStr(mondayAnchor, 7))} className="p-1 rounded-lg hover:bg-stone-800"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="space-y-3">
        {days.map((dateStr, idx) => {
          const isToday = dateStr === todayStr();
          const dm = weekMeals[idx] || {};
          return (
            <div key={dateStr} style={{ background: isToday ? COLORS.accentSoft : COLORS.surface, borderColor: isToday ? COLORS.accent : COLORS.border }} className="border rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase font-mono px-2 py-0.5 rounded ${isToday ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'}`}>{WEEKDAYS[idx]}</span>
                  <span className="text-xs font-semibold text-stone-400">{parseDate(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['breakfast', 'lunch', 'dinner'].map((type, i) => (
                  <div key={type}>
                    <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">{['Śniadanie', 'Obiad', 'Kolacja'][i]}</label>
                    <input type="text" value={dm[type] || ''} onChange={e => onUpdateMeal(mondayAnchor, { ...weekMeals, [idx]: { ...dm, [type]: e.target.value } })} placeholder="np. Naleśniki" className="w-full border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppLogsSection() {
  const [logs, setLogs] = useState(getLogs());
  const [filter, setFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeLogs((newLogs) => setLogs(newLogs));
  }, []);

  const filteredLogs = logs.filter(l => filter === 'all' || l.type === filter);

  const handleCopyLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-[#33333C] pb-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-stone-100">
          <Terminal size={16} className="text-amber-400" /> Logi Aplikacji i Diagnostyka ({logs.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-lg transition flex items-center gap-1"
          >
            <Copy size={12} /> {copied ? 'Skopiowano!' : 'Kopiuj logi'}
          </button>
          <button
            type="button"
            onClick={() => clearLogs()}
            className="px-2.5 py-1 bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-300 text-xs font-semibold rounded-lg transition"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${filter === 'all' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-stone-900 text-stone-400 hover:text-stone-200'}`}
        >
          Wszystkie ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('error')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${filter === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-stone-900 text-stone-400 hover:text-stone-200'}`}
        >
          Błędy ({logs.filter(l => l.type === 'error').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('warn')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${filter === 'warn' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-stone-900 text-stone-400 hover:text-stone-200'}`}
        >
          Ostrzeżenia ({logs.filter(l => l.type === 'warn').length})
        </button>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-xs text-stone-500 py-3 text-center italic">Brak zarejestrowanych zdarzeń w tej sesji.</div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono">
          {filteredLogs.map(log => (
            <div key={log.id} className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/80 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-stone-500 font-sans">{log.timestamp}</span>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold font-sans ${
                    log.type === 'error' ? 'bg-red-950 text-red-400 border border-red-900' :
                    log.type === 'warn' ? 'bg-amber-950 text-amber-300 border border-amber-900' :
                    log.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-900' :
                    'bg-stone-800 text-stone-300'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-stone-200 break-all font-sans text-xs">{log.message}</span>
                </div>
                {log.details && (
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    className="text-[10px] text-amber-400 hover:underline shrink-0 font-sans"
                  >
                    {expandedLogId === log.id ? 'Ukryj' : 'Szczegóły'}
                  </button>
                )}
              </div>
              {expandedLogId === log.id && log.details && (
                <pre className="text-[10px] text-stone-400 bg-black/40 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap border border-stone-800 mt-1">
                  {log.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ family, profile, settings, onUpdateSettings, people, onAddPerson, onEditPerson, onDeletePerson, onSignOut, supabase, showToast, onDeleteFamily, onDeleteUserAccount }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState(null);
  const [notifErrorDetails, setNotifErrorDetails] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ));

  const toggleSection = (sectionId) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  // Sprawdzanie statusu subskrypcji Web Push przy wejściu do Ustawień
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
    addLog('info', 'Uruchomiono konfigurację powiadomień Web Push...');

    try {
      // 1. Zarejestruj subskrypcję i wyślij token do Supabase
      const sub = await subscribeToPushNotifications(supabase, profile, family?.id);
      
      setNotifPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted');
      setPushSubscribed(!!sub);
      
      showToast('Powiadomienia Web Push w tle zostały aktywowane! 🔔');
      addLog('success', 'Pomyślnie włączono i zsynchronizowano Web Push.');
    } catch (e) {
      const errFormatted = `${e.name || 'Błąd'}: ${e.message || e}`;
      addLog('error', `Błąd podczas włączania Web Push: ${errFormatted}`);
      setNotifErrorDetails(e.message || 'Wystąpił problem z rejestracją powiadomień.');
      showToast('Nie udało się włączyć powiadomień.');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      addLog('info', 'Wysyłanie testowego powiadomienia przez chmurę...');
      showToast('Wysyłanie powiadomienia testowego... 🔔');

      // 1. Lokalne powiadomienie
      await sendSystemNotification('Rodzinny Planer 🔔', 'Test powiadomień systemowych!');

      // 2. Wysłanie powiadomienia przez funkcję chmurową Edge Function send-push
      if (supabase && family?.id) {
        const { data, error } = await supabase.functions.invoke('send-push', {
          body: {
            family_id: family.id,
            title: 'Test z Chmury (Web Push) 🔔',
            body: 'Powiadomienia w tle z Supabase działają prawidłowo!',
          },
        });
        if (error) {
          addLog('warn', `Edge function zwróciła: ${error.message}`);
        } else {
          addLog('success', 'Wysłano żądanie Push do chmury Supabase!', data);
          showToast('Wysłano sygnał Push przez chmurę! 🔔');
        }
      }
    } catch (e) {
      addLog('error', `Błąd testu powiadomień: ${e.message}`);
      setNotifErrorDetails(e.message);
    }
  };

  const handleDisableNotifications = async () => {
    if (!confirm('Czy na pewno chcesz wyłączyć powiadomienia Push na tym urządzeniu?')) return;
    setNotifLoading(true);
    try {
      await unsubscribeFromPushNotifications(supabase, profile);
      setPushSubscribed(false);
      showToast('Wyłączono powiadomienia Push na tym urządzeniu.');
    } catch (e) {
      showToast('Błąd wyłączania powiadomień: ' + e.message);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPwdMessage({ type: 'error', text: 'Hasło musi mieć co najmniej 6 znaków.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'Hasła nie są identyczne.' });
      return;
    }

    setPwdLoading(true);
    setPwdMessage(null);

    try {
      const { error } = await supabase?.auth?.updateUser({ password: newPassword }) || {};
      if (error) {
        setPwdMessage({ type: 'error', text: error.message || 'Nie udało się zmienić hasła.' });
      } else {
        setPwdMessage({ type: 'success', text: 'Hasło zostało pomyślnie zmienione!' });
        setNewPassword('');
        setConfirmPassword('');
        if (showToast) showToast('Hasło zmienione pomyślnie!');
      }
    } catch {
      setPwdMessage({ type: 'error', text: 'Wystąpił błąd podczas zmiany hasła.' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Nagłówek widoku */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">Ustawienia</h2>
          <p className="text-xs text-stone-400 mt-0.5">Zarządzaj profilem, rodziną i powiadomieniami</p>
        </div>
        <button 
          onClick={onSignOut} 
          className="px-3.5 py-2 bg-stone-800 rounded-xl border border-stone-700 text-xs font-bold flex items-center gap-2 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/50 transition active:scale-95"
        >
          <LogOut size={14} /> Wyloguj
        </button>
      </div>

      {/* Pasek informacyjny: Połączono z chmurą (zawsze widoczny) */}
      <div className="bg-[#1E1E22] border border-emerald-900/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center shrink-0">
            <Wifi size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              Połączono z chmurą
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xs text-stone-400">Synchronizacja danych w czasie rzeczywistym jest aktywna.</div>
          </div>
        </div>
      </div>

      {/* SEKCJA 1: Twoja Rodzina (Rozwijana) */}
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
              <label className="text-xs font-semibold mb-1.5 block text-stone-400">Kod dołączenia dla innych</label>
              <div className="text-lg font-mono font-bold tracking-widest text-amber-400 bg-amber-900/20 px-4 py-2.5 rounded-xl inline-block border border-amber-900/50">
                {family?.join_code}
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                Podaj ten kod innym domownikom, by dołączyli do tej rodziny na swoich telefonach.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA 2: Członkowie Rodziny (Rozwijana) */}
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
              <div className="text-sm font-bold text-stone-100">Członkowie rodziny</div>
              <div className="text-xs text-stone-400">{people.length} {people.length === 1 ? 'osoba' : (people.length < 5 ? 'osoby' : 'osób')} w grupie</div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'members' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'members' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-3 bg-stone-900/40">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-stone-400 font-medium">Lista domowników</span>
              <button 
                onClick={onAddPerson} 
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
              >
                <Plus size={14} /> Dodaj osobę
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {people.map(p => {
                const isCurrent = profile?.person_id === p.id;
                return (
                  <div key={p.id} className={`bg-stone-900 border ${isCurrent ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#33333C]'} rounded-xl p-3 flex items-center justify-between`}>
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
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            ID: {p.id}
                          </div>
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
                        title="Usuń profil"
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

      {/* SEKCJA: Moduły (Zostaje WIDOCZNA ZAWSZE, bez rozwijania) */}
      <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl p-4 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold border-b border-[#33333C] pb-2 text-stone-100 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" /> Moduły aplikacji
        </h3>
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-stone-200">Tablica (Lodówka)</div>
            <div className="text-xs text-stone-400">Wspólna przestrzeń na wiadomości i notatki domowników.</div>
          </div>
          <button 
            type="button"
            onClick={() => onUpdateSettings({ ...settings, enableWall: !settings.enableWall })}
            className="p-1 transition active:scale-90"
          >
            {settings.enableWall ? <ToggleRight size={32} className="text-amber-400" /> : <ToggleLeft size={32} className="text-stone-600" />}
          </button>
        </div>
        <div className="flex items-center justify-between py-1 pt-2 border-t border-stone-800">
          <div>
            <div className="text-sm font-semibold text-stone-200">Posiłki (Jadłospis)</div>
            <div className="text-xs text-stone-400">Tygodniowy planer obiadów i posiłków.</div>
          </div>
          <button 
            type="button"
            onClick={() => onUpdateSettings({ ...settings, enableMeals: !settings.enableMeals })}
            className="p-1 transition active:scale-90"
          >
            {settings.enableMeals ? <ToggleRight size={32} className="text-amber-400" /> : <ToggleLeft size={32} className="text-stone-600" />}
          </button>
        </div>
      </div>

      {/* SEKCJA 3: Ustawienia konta (Rozwijana) */}
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
              <div className="text-xs text-stone-400">Zmiana hasła i dane logowania</div>
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
                <label className="text-xs font-semibold mb-1.5 block text-stone-400">Nowe hasło</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Minimum 6 znaków"
                  className="w-full border border-[#33333C] rounded-xl px-3.5 py-2 text-sm bg-stone-900 text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block text-stone-400">Powtórz nowe hasło</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Wpisz ponownie nowe hasło"
                  className="w-full border border-[#33333C] rounded-xl px-3.5 py-2 text-sm bg-stone-900 text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              {pwdMessage && (
                <div className={`text-xs p-3 rounded-xl flex items-center gap-2 ${pwdMessage.type === 'error' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50'}`}>
                  <AlertCircle size={15} className="shrink-0" /> {pwdMessage.text}
                </div>
              )}
              <button 
                type="submit" 
                disabled={pwdLoading} 
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {pwdLoading ? 'Zapisywanie...' : 'Zmień hasło'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* SEKCJA 4: Powiadomienia w tle (Web Push) (Rozwijana) */}
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
                {pushSubscribed ? 'Aktywne w chmurze 🔔' : 'Konfiguracja alertów na telefon'}
              </div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'notifications' ? <ChevronDown size={18} className="text-amber-400" /> : <ChevronRight size={18} />}
          </div>
        </button>

        {expandedSection === 'notifications' && (
          <div className="p-4 pt-3 border-t border-[#33333C] space-y-4 bg-stone-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400 font-medium">Status urządzenia</span>
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
                  {notifPermission === 'granted' && <><CheckCircle size={14} className="text-emerald-400" /> <span className="text-emerald-400">Zezwolono</span></>}
                  {notifPermission === 'denied' && <><X size={14} className="text-red-400" /> <span className="text-red-400">Zablokowane</span></>}
                  {notifPermission === 'default' && <><AlertCircle size={14} className="text-amber-400" /> <span className="text-amber-400">Wymaga zgody</span></>}
                  {notifPermission === 'unsupported' && <span className="text-stone-500">Brak wsparcia</span>}
                </div>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800 space-y-1">
                <div className="text-stone-400 font-medium">Subskrypcja Push (w tle)</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {pushSubscribed ? (
                    <><CheckCircle size={14} className="text-emerald-400" /> <span className="text-emerald-400">Aktywna w chmurze</span></>
                  ) : (
                    <><AlertCircle size={14} className="text-amber-400" /> <span className="text-amber-400">Niepołączona</span></>
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
                <Smartphone size={14} /> {notifLoading ? 'Aktywowanie...' : pushSubscribed ? 'Odśwież Web Push' : 'Włącz Web Push w tle'}
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
                  title="Wyłącz na tym telefonie"
                >
                  Wyłącz
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
                  <Code size={15} /> Jak działa Web Push przy zamkniętej aplikacji?
                </div>
                <p className="text-stone-300 leading-relaxed text-[11px]">
                  Gdy zamykasz aplikację, Twój telefon rejestruje token subskrypcji w tabeli <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">push_subscriptions</code> w Supabase. Aby serwer Supabase sam wysyłał powiadomienia o terminach i wydarzeniach, uruchom plik <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">supabase_notifications_setup.sql</code> w SQL Editorze w Supabase.
                </p>
              </div>
            )}

            <p className="text-[11px] text-stone-400 leading-relaxed bg-stone-900/70 p-3 rounded-xl border border-stone-800">
              <strong>Wskazówka (Działanie jak aplikacja ze sklepu):</strong> Na telefonie (Android / iPhone) w menu przeglądarki wybierz <span className="text-amber-400 font-medium">"Dodaj do ekranu głównego"</span> / <span className="text-amber-400 font-medium">"Zainstaluj aplikację"</span>. Dzięki temu system operacyjny traktuje aplikację jako PWA i nie ubija powiadomień w tle.
            </p>
          </div>
        )}
      </div>

      {/* SEKCJA 5: Logi Aplikacji i Diagnostyka (Rozwijana) */}
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
              <div className="text-xs text-stone-400">Podgląd zdarzeń systemowych, błędów i synchronizacji</div>
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

      {/* SEKCJA 6: Strefa niebezpieczna (Rozwijana, czerwone akcenty) */}
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
              <div className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                Strefa niebezpieczna
              </div>
              <div className="text-xs text-stone-400">Usuwanie konta użytkownika lub całej rodziny</div>
            </div>
          </div>
          <div className="text-stone-400 p-1">
            {expandedSection === 'danger' ? <ChevronDown size={18} className="text-red-400" /> : <ChevronRight size={18} className="text-red-400/70" />}
          </div>
        </button>

        {expandedSection === 'danger' && (
          <div className="p-4 pt-3 border-t border-red-900/40 space-y-4 bg-red-950/10">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <UserX size={14} className="text-red-400" /> Usuwanie konta użytkownika
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Spowoduje wyczyszczenie Twoich prywatnych notatek, odpięcie profilu od członka rodziny oraz wylogowanie z aplikacji.
              </p>
              <button 
                type="button"
                onClick={onDeleteUserAccount} 
                className="w-full py-2.5 bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <UserX size={15} /> Usuń moje konto i odepnij od rodziny
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-red-900/30">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <Trash2 size={14} className="text-red-400" /> Usuwanie całej rodziny
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Usunięcie rodziny spowoduje skasowanie całego wspólnego kalendarza, zadań, notatek i całej listy domowników z bazy.
              </p>
              <button 
                type="button"
                onClick={onDeleteFamily} 
                className="w-full py-2.5 bg-red-950/90 border border-red-800/90 text-red-400 hover:bg-red-900 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <Trash2 size={15} /> Usuń całą rodzinę i zresetuj dane
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- AUTH & ONBOARDING VIEWS --- */

function AppLogo({ className = "w-8 h-8 rounded-xl", iconSize = 18 }) {
  const [logoSrc, setLogoSrc] = useState('/logo.png');
  const [imgError, setImgError] = useState(false);

  const handleError = () => {
    if (logoSrc === '/logo.png') {
      setLogoSrc('/logo.svg');
    } else {
      setImgError(true);
    }
  };

  if (!imgError) {
    return (
      <img 
        src={logoSrc} 
        alt="Logo" 
        onError={handleError}
        className={`${className} object-cover shrink-0 overflow-hidden`}
      />
    );
  }

  return (
    <div className={`${className} bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0`}>
      <Sparkles size={iconSize} />
    </div>
  );
}

function PoweredByFooter({ className = "" }) {
  return (
    <footer className={`mt-8 text-center text-xs text-stone-500 flex items-center justify-center gap-1.5 ${className}`}>
      <span>Powered by</span>
      <a 
        href="https://syncup.pl" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-stone-400 hover:text-amber-400 transition font-medium underline decoration-stone-700 underline-offset-2"
      >
        syncup.pl
      </a>
    </footer>
  );
}

function ResetPasswordScreen({ supabase, onComplete }) {
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
      <h1 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-2">Ustaw nowe hasło</h1>
      <p className="text-sm text-stone-400 mb-8 text-center max-w-xs">Wprowadź i powtórz swoje nowe hasło dostępowe.</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl space-y-4">
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
                onChange={e => setNewPassword(e.target.value)} 
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
                onChange={e => setConfirmPassword(e.target.value)} 
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

function AuthScreen({ supabase }) {
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMessage('Konto zostało utworzone! Jeśli w połączonym projekcie Supabase włączono weryfikację e-mail, wysłano wiadomość z potwierdzeniem na Twój adres e-mail (sprawdź też folder SPAM).');
      } else if (authMode === 'forgot') {
        if (!email.trim()) {
          throw new Error('Podaj swój adres e-mail.');
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMessage('Wysłano wiadomość z linkiem do resetowania hasła! Sprawdź swoją skrzynkę odbiorczą oraz folder SPAM.');
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
      <h1 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-2">Rodzinny Planer</h1>
      <p className="text-sm text-stone-400 mb-8 text-center max-w-xs">Współdziel kalendarz i obowiązki z całą rodziną w jednym miejscu.</p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl">
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
            onChange={e => setEmail(e.target.value)} 
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
              onChange={e => setPassword(e.target.value)} 
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
          {loading ? 'Ładowanie...' : (
            authMode === 'login' ? 'Zaloguj' : (authMode === 'register' ? 'Zarejestruj się' : 'Wyślij link do resetu')
          )}
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

function FamilyOnboarding({ supabase, session, onFamilyJoined }) {
  const [mode, setMode] = useState('choose'); // choose, create, join
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null);
    const joinCode = genCode();
    try {
      // 1. Create family
      const { data: fam, error: err1 } = await supabase.from('families').insert({ name: name.trim(), join_code: joinCode }).select().single();
      if (err1) throw err1;
      
      // 2. Initialize empty family_state
      const { error: err2 } = await supabase.from('family_state').insert({ family_id: fam.id, data: emptyData() });
      if (err2) throw err2;

      // 3. Link profile
      const { error: err3 } = await supabase.from('profiles').upsert({ id: session.user.id, family_id: fam.id, person_id: null });
      if (err3) throw err3;

      onFamilyJoined(fam, { id: session.user.id, family_id: fam.id, person_id: null });
    } catch(err) { setError(err.message); setLoading(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null);
    try {
      const { data: fam, error: err1 } = await supabase.from('families').select('*').eq('join_code', code.trim().toUpperCase()).single();
      if (err1 || !fam) throw new Error('Nie znaleziono rodziny z takim kodem.');

      const { error: err2 } = await supabase.from('profiles').upsert({ id: session.user.id, family_id: fam.id, person_id: null });
      if (err2) throw err2;

      onFamilyJoined(fam, { id: session.user.id, family_id: fam.id, person_id: null });
    } catch(err) { setError(err.message); setLoading(false); }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121214] text-stone-100 animate-fadeIn">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-3xl font-bold mb-8 text-center">Dołącz do Rodziny</h2>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setMode('join')} className="w-full bg-[#1E1E22] border border-[#33333C] p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-amber-500/50 transition">
            <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-amber-400"><Users size={24} /></div>
            <span className="font-bold text-lg">Mam kod od domownika</span>
            <span className="text-xs text-stone-400 text-center">Ktoś z Twojej rodziny założył już kalendarz i udostępnił Ci 6-znakowy kod.</span>
          </button>
          <button onClick={() => setMode('create')} className="w-full bg-[#1E1E22] border border-[#33333C] p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-amber-500/50 transition">
            <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-amber-400"><Plus size={24} /></div>
            <span className="font-bold text-lg">Załóż nową rodzinę</span>
            <span className="text-xs text-stone-400 text-center">Jesteś tu pierwszy? Załóż wirtualny dom i wygeneruj kod dla pozostałych.</span>
          </button>
          <button onClick={async () => await supabase.auth.signOut()} className="w-full py-4 text-xs font-semibold text-stone-500">Wyloguj mnie</button>
        </div>
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <button onClick={() => setMode('choose')} className="mb-6 p-2 rounded-full bg-stone-900 text-stone-400 self-start"><ChevronLeft size={24} /></button>
      <form onSubmit={e => { e.preventDefault(); mode === 'create' ? handleCreate() : handleJoin(); }} className="w-full max-w-sm space-y-4 bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl">
        <h2 className="text-xl font-bold mb-4">{mode === 'create' ? 'Nazwij swoją rodzinę' : 'Podaj kod dostępu'}</h2>
        {error && <div className="bg-red-950/50 border border-red-900 text-red-300 text-xs p-3 rounded-xl">{error}</div>}
        
        {mode === 'create' ? (
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Nazwa wyświetlana</label><input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="np. Rodzina Kowalskich" className={inputStyle} /></div>
        ) : (
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Kod 6-znakowy</label><input autoFocus required value={code} onChange={e=>setCode(e.target.value)} placeholder="np. A8F9K2" className={`${inputStyle} uppercase font-mono text-center tracking-widest text-lg`} maxLength={6} /></div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition mt-4 disabled:opacity-50">
          {loading ? 'Ładowanie...' : 'Dalej'}
        </button>
      </form>
      <PoweredByFooter />
    </div>
  );
}

function ProfileSelection({ supabase, profile, data, onProfileSelected }) {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({ person_id: selectedId }).eq('id', profile.id);
      onProfileSelected(selectedId);
    } catch(err) { console.error(err); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121214] text-stone-100 animate-fadeIn">
      <div className="w-full max-w-sm bg-[#1E1E22] p-6 rounded-3xl border border-[#33333C] shadow-2xl">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold mb-2">Kim jesteś?</h2>
        <p className="text-xs text-stone-400 mb-6">Wybierz swój profil z poniższej listy, aby aplikacja mogła Cię rozpoznawać.</p>
        
        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto pr-2">
          {data?.people?.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition border ${selectedId === p.id ? 'bg-amber-500/10 border-amber-500' : 'bg-stone-900 border-stone-800 hover:bg-stone-800'}`}>
              <Chip person={p} size="lg" />
              <span className="font-bold text-sm">{p.name}</span>
              {selectedId === p.id && <Check size={20} className="ml-auto text-amber-500" />}
            </button>
          ))}
        </div>
        
        <button onClick={handleSelect} disabled={!selectedId || loading} className="w-full bg-amber-500 text-stone-950 font-bold py-3.5 rounded-xl hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2">
          Wejdź do aplikacji <ArrowRight size={18} />
        </button>
      </div>
      <PoweredByFooter />
    </div>
  );
}


/* --- MAIN APP --- */

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
  const [tab, setTab] = useState('today');
  const [modal, setModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);
  const [addEventDate, setAddEventDate] = useState(todayStr());
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [toast, setToast] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(() => (
    typeof window !== 'undefined' && window.location && (
      window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')
    )
  ));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Auth Listener
  useEffect(() => {
    if (!supabaseClient) return;

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
      if (!session) { setFamily(null); setProfile(null); setData(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  // Load Profile & Family
  useEffect(() => {
    if (!supabaseClient || !session) return;
    
    async function loadUserMeta() {
      try {
        const { data: prof } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
        if (prof) {
          setProfile(prof);
          if (prof.family_id) {
            const { data: fam } = await supabaseClient.from('families').select('*').eq('id', prof.family_id).single();
            setFamily(fam);
          }
        }
      } catch(e) { console.warn(e); }
    }
    loadUserMeta();
  }, [supabaseClient, session]);

  const dataRef = useRef(null);
  const profileRef = useRef(profile);
  const sentRemindersRef = useRef(new Set());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Pomocnicza funkcja inteligentnego dostarczania powiadomień:
  // - Jeśli aplikacja jest na 1. planie (!document.hidden): TYLKO wewnątrz-aplikacyjny Toast
  // - Jeśli karta/aplikacja jest w tle (document.hidden): Powiadomienie systemowe (sendSystemNotification)
  const deliverNotification = useCallback((title, body, toastMsg) => {
    const isBackground = typeof document !== 'undefined' && document.hidden;
    if (isBackground) {
      sendSystemNotification(title, body);
    } else {
      showToast(toastMsg || (body ? `${title}: ${body}` : title));
    }
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
          data.events.forEach(ev => {
            if (!ev.personIds?.includes(currentPersonId)) return;

            const reminderHours = ev.reminder?.hours ?? ev.reminderHours;
            if (reminderHours === null || reminderHours === undefined) return;

            [today, tomorrow].forEach(dateStr => {
              if (occursOnDate(ev, dateStr)) {
                const timeStr = ev.time || '09:00';
                const [yh, mh, dh] = dateStr.split('-').map(Number);
                const [hh, mm] = timeStr.split(':').map(Number);
                const eventDate = new Date(yh, mh - 1, dh, hh, mm, 0);

                const reminderDate = new Date(eventDate.getTime() - (Number(reminderHours) * 60 * 60 * 1000));
                const diffMs = now.getTime() - reminderDate.getTime();
                const key = `event_${ev.id}_${dateStr}_${reminderHours}_${timeStr}`;

                if (diffMs >= 0 && diffMs < 15 * 60 * 1000 && !sentRemindersRef.current.has(key)) {
                  sentRemindersRef.current.add(key);

                  let labelText = 'O czasie wydarzenia';
                  if (reminderHours === 1) labelText = 'Za 1 godz.';
                  else if (reminderHours === 2) labelText = 'Za 2 godz.';
                  else if (reminderHours === 24) labelText = 'Jutro';

                  const body = reminderHours === 0
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
          data.tasks.forEach(t => {
            if (!t.personIds?.includes(currentPersonId)) return;
            if (isTaskDoneForPeriod(t, today)) return;

            const reminderHours = t.reminder?.hours ?? t.reminderHours;
            if (reminderHours === null || reminderHours === undefined) return;

            const targetDateStr = t.dueDate || today;
            [targetDateStr].forEach(dateStr => {
              const timeStr = t.time || '09:00';
              const [yh, mh, dh] = dateStr.split('-').map(Number);
              const [hh, mm] = timeStr.split(':').map(Number);
              const taskDate = new Date(yh, mh - 1, dh, hh, mm, 0);

              const reminderDate = new Date(taskDate.getTime() - (Number(reminderHours) * 60 * 60 * 1000));
              const diffMs = now.getTime() - reminderDate.getTime();
              const key = `task_${t.id}_${dateStr}_${reminderHours}_${timeStr}`;

              if (diffMs >= 0 && diffMs < 15 * 60 * 1000 && !sentRemindersRef.current.has(key)) {
                sentRemindersRef.current.add(key);

                let labelText = 'Termin zadania';
                if (reminderHours === 1) labelText = 'Za 1 godz.';
                else if (reminderHours === 2) labelText = 'Za 2 godz.';
                else if (reminderHours === 24) labelText = 'Jutro';

                const body = reminderHours === 0
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
  }, [data, deliverNotification]);

  // Zaawansowana detekcja zmian (DODANE, ZMODYFIKOWANE, USUNIĘTE)
  // z precyzyjnym podziałem na odbiorców (Tablica = cała rodzina, Zadania/Wydarzenia = przypisani domownicy)
  const handleRemoteDataUpdate = useCallback((newData) => {
    if (!newData) return;
    const oldData = dataRef.current;

    if (!oldData) {
      setData(newData);
      dataRef.current = newData;
      return;
    }

    // Szybkie sprawdzenie znacznika czasu synchronizacji (zastępuje kosztowne JSON.stringify całego stanu)
    if (oldData.lastUpdatedAt && newData.lastUpdatedAt) {
      if (oldData.lastUpdatedAt === newData.lastUpdatedAt) return;
    } else {
      // Bezpieczny fallback dla istniejących stanów rodziny w Supabase (przed dodaniem pola lastUpdatedAt)
      if (JSON.stringify(oldData) === JSON.stringify(newData)) return;
    }

    const currentPersonId = profileRef.current?.person_id;

    // Słowniki starych i nowych elementów
    const oldEventsMap = new Map((oldData.events || []).map(e => [e.id, e]));
    const newEventsMap = new Map((newData.events || []).map(e => [e.id, e]));

    const oldTasksMap = new Map((oldData.tasks || []).map(t => [t.id, t]));
    const newTasksMap = new Map((newData.tasks || []).map(t => [t.id, t]));

    const oldWallMap = new Map((oldData.wall || []).map(w => [w.id, w]));
    const newWallMap = new Map((newData.wall || []).map(w => [w.id, w]));

    setData(newData);
    dataRef.current = newData;

    let hasNotified = false;

    // -------------------------------------------------------------------------
    // 1. TABLICA (WALL) - Wirtualna lodówka dla CAŁEJ rodziny
    // -------------------------------------------------------------------------
    // A. Nowe wiadomości na lodówce
    (newData.wall || []).forEach(newMsg => {
      if (!oldWallMap.has(newMsg.id)) {
        deliverNotification(
          'Wiadomość na lodówce 💬',
          newMsg.text,
          `Nowa wiadomość na lodówce: "${newMsg.text}" 💬`
        );
        hasNotified = true;
      }
    });

    // B. Zmodyfikowane wpisy na lodówce (np. edycja lub przypięcie/odpięcie)
    (newData.wall || []).forEach(newMsg => {
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

    // C. Usunięte wpisy z lodówki
    (oldData.wall || []).forEach(oldMsg => {
      if (!newWallMap.has(oldMsg.id)) {
        deliverNotification(
          'Tablica rodzinna 🗑️',
          'Usunięto wiadomość z lodówki',
          'Usunięto wpis z lodówki 🗑️'
        );
        hasNotified = true;
      }
    });

    // -------------------------------------------------------------------------
    // 2. WYDARZENIA & ZADANIA - TYLKO gdy currentUserId znajduje się w personIds
    // -------------------------------------------------------------------------
    if (currentPersonId) {
      // --- WYDARZENIA (EVENTS) ---
      // A. Nowo dodane wydarzenia
      (newData.events || []).forEach(newEv => {
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

      // B. Zmodyfikowane wydarzenia
      (newData.events || []).forEach(newEv => {
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

      // C. Usunięte / Anulowane wydarzenia
      (oldData.events || []).forEach(oldEv => {
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

      // --- ZADANIA (TASKS) ---
      // A. Nowo dodane zadania
      (newData.tasks || []).forEach(newTask => {
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

      // B. Zmodyfikowane zadania (edycja lub zmiana statusu wykonania)
      (newData.tasks || []).forEach(newTask => {
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

      // C. Usunięte / Anulowane zadania
      (oldData.tasks || []).forEach(oldTask => {
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
      // Jeśli zmiana dotyczyła posiłków lub elementów nieprzypisanych do nas, delikatna informacja
      showToast('Zsynchronizowano zmiany od domownika 🔄');
    }
  }, [deliverNotification]);

  // Load Data, Realtime Sync & Polling Fallback
  useEffect(() => {
    let isMounted = true;
    let channel = null;
    let pollInterval = null;

    async function fetchAndSync() {
      if (!supabaseClient || !family || !profile) return;
      
      try {
        const { data: stateRow, error } = await supabaseClient.from('family_state').select('data').eq('family_id', family.id).single();
        
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
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'family_state', 
            filter: `family_id=eq.${family.id}` 
          }, (payload) => {
            if (isMounted && payload.new && payload.new.data) {
              handleRemoteDataUpdate(payload.new.data);
            }
          })
          .subscribe();

        // 2. Backup Polling (co 6 sekund) dla 100% niezawodności w czasie rzeczywistym
        pollInterval = setInterval(async () => {
          if (!isMounted) return;
          try {
            const { data: row } = await supabaseClient.from('family_state').select('data').eq('family_id', family.id).single();
            if (isMounted && row && row.data) {
              handleRemoteDataUpdate(row.data);
            }
          } catch {
            // Bezgłośny błąd sieci
          }
        }, 6000);

      } catch(err) {
        console.warn("Błąd ładowania danych:", err);
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

  const persist = useCallback(async (next) => {
    const updated = { ...next, lastUpdatedAt: Date.now() };
    setData(updated);
    dataRef.current = updated; // Kluczowe: zapobiega powtórnemu powiadomieniu u autora zmiany
    if (supabaseClient && family) {
      try {
        await supabaseClient.from('family_state').upsert({
          family_id: family.id,
          data: updated,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn(e);
      }
    }
  }, [supabaseClient, family]);


  // Routing / Render State
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#121214] text-stone-100 font-mono text-sm">Ładowanie...</div>;
  if (!supabaseClient) return <div className="min-h-screen flex items-center justify-center bg-[#121214] text-red-400 p-6 text-center">Brak połączenia z bazą (Brak kluczy .env).</div>;
  
  if (isResettingPassword) {
    return (
      <ResetPasswordScreen 
        supabase={supabaseClient} 
        onComplete={() => {
          setIsResettingPassword(false);
          showToast("Nowe hasło zostało zapisane!");
        }} 
      />
    );
  }

  if (!session) return <AuthScreen supabase={supabaseClient} />;
  if (!family) return <FamilyOnboarding supabase={supabaseClient} session={session} onFamilyJoined={(fam, prof) => { setFamily(fam); setProfile(prof); }} />;
  if (!data) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#121214] text-stone-100 font-mono text-sm gap-4">Pobieranie danych rodziny... <RefreshCw size={20} className="animate-spin text-amber-500" /></div>;
  if (!profile?.person_id) return <ProfileSelection supabase={supabaseClient} profile={profile} data={data} onProfileSelected={pid => setProfile({...profile, person_id: pid})} />;

  // User is fully authenticated, in a family, and picked an avatar.
  const currentUserId = profile.person_id;

  // PRYWATNE NOTATKI - Filtruje tylko te przypisane do currentUserId
  const visibleNotes = data.notes.filter(n => n.personId === currentUserId);

  // Handlers
  const upsertEvent = ev => { 
    const noteId = modalPayload?.noteId; 
    const nextNotes = noteId ? data.notes.filter(n => n.id !== noteId) : data.notes; 
    const exists = data.events.some(e => e.id === ev.id); 
    persist({ ...data, events: exists ? data.events.map(e => e.id === ev.id ? ev : e) : [...data.events, ev], notes: nextNotes }); 
    if (!exists) {
      showToast("Dodano wydarzenie! 📅");
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          targetPersonIds: ev.personIds && ev.personIds.length > 0 ? ev.personIds : null,
          title: 'Nowe wydarzenie w kalendarzu 📅',
          body: `${ev.title}${ev.time ? ` (${ev.time})` : ''}`,
          type: 'event',
          tag: `event_new_${ev.id}`
        });
      }
    } else {
      showToast("Zaktualizowano wydarzenie 📅");
    }
  };

  const upsertTask = t => { 
    const noteId = modalPayload?.noteId; 
    const nextNotes = noteId ? data.notes.filter(n => n.id !== noteId) : data.notes; 
    const exists = data.tasks.some(x => x.id === t.id); 
    persist({ ...data, tasks: exists ? data.tasks.map(x => x.id === t.id ? t : x) : [...data.tasks, t], notes: nextNotes }); 
    if (!exists) {
      showToast("Dodano zadanie! 📝");
      if (family?.id && supabaseClient) {
        recordFamilyNotification(supabaseClient, {
          familyId: family.id,
          targetPersonIds: t.personIds && t.personIds.length > 0 ? t.personIds : null,
          title: 'Nowe zadanie dla rodziny 📝',
          body: `${t.title}`,
          type: 'task',
          tag: `task_new_${t.id}`
        });
      }
    } else {
      showToast("Zaktualizowano zadanie 📝");
    }
  };

  const upsertNote = n => { 
    const exists = data.notes.some(x => x.id === n.id); 
    persist({ ...data, notes: exists ? data.notes.map(x => x.id === n.id ? n : x) : [...data.notes, n] }); 
    if (!exists) {
      showToast("Dodano notatkę! 📌");
    } else {
      showToast("Zapisano notatkę 📌");
    }
  };

  const addWallMessage = msg => { 
    persist({ ...data, wall: [msg, ...(data.wall || [])] }); 
    showToast("Wysłano na tablicę 💬"); 
    if (family?.id && supabaseClient) {
      const author = data?.people?.find(p => p.id === msg.authorId)?.name || 'Ktoś';
      const targetPersonIds = (data?.people || []).filter(p => p.id !== msg.authorId).map(p => p.id);
      recordFamilyNotification(supabaseClient, {
        familyId: family.id,
        targetPersonIds: targetPersonIds.length > 0 ? targetPersonIds : null,
        title: `${author} napisał(a) na Tablicy 💬`,
        body: msg.text,
        type: 'wall_message',
        tag: `wall_msg_${msg.id}`
      });
    }
  };
  const deleteWallMessage = id => { persist({ ...data, wall: (data.wall || []).filter(w => w.id !== id) }); };
  const togglePinWallMessage = id => { persist({ ...data, wall: (data.wall || []).map(w => w.id === id ? { ...w, isPinned: !w.isPinned } : w) }); };
  const upsertPerson = p => { const exists = data.people.some(x => x.id === p.id); persist({ ...data, people: exists ? data.people.map(x => x.id === p.id ? p : x) : [...data.people, p] }); showToast("Zapisano osobę"); };
  const selectPerson = async (id) => {
    if (!supabaseClient || !profile?.id) return;
    try {
      const { error } = await supabaseClient.from('profiles').update({ person_id: id }).eq('id', profile.id);
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, person_id: id } : { id: session.user.id, family_id: family?.id, person_id: id });
      const pName = data?.people?.find(p => p.id === id)?.name || 'nową osobę';
      showToast(`Połączono Twoje konto z: ${pName} 👤`);
    } catch (e) {
      console.error(e);
      showToast("Błąd łączenia profilu");
    }
  };
  const updateMeal = (mondayKey, weekMeals) => persist({ ...data, meals: { ...(data.meals || {}), [mondayKey]: weekMeals } });
  const updateSettings = newSettings => persist({ ...data, settings: newSettings });
  const deletePerson = async (id) => {
    const person = data.people.find(p => p.id === id);
    const personName = person ? person.name : "tę osobę";
    if (!confirm(`Czy na pewno chcesz usunąć członka rodziny "${personName}"?\n\nOsoba zostanie usunięta z listy domowników, jej prywatne notatki wyczyszczone, a połączone konto odpięte.`)) return;

    const nextPeople = data.people.filter(p => p.id !== id);
    const nextNotes = (data.notes || []).filter(n => n.personId !== id);
    persist({ ...data, people: nextPeople, notes: nextNotes });

    if (supabaseClient) {
      try {
        await supabaseClient.from('profiles').update({ person_id: null }).eq('person_id', id);
      } catch (e) {
        console.warn('Błąd odpinania profilu w Supabase:', e);
      }
    }

    if (id === currentUserId) {
      setProfile(prev => prev ? { ...prev, person_id: null } : null);
      showToast(`Odpięto i usunięto profil ${personName}. Wybierz nowy profil.`);
    } else {
      showToast(`Usunięto członka rodziny: ${personName}`);
    }
  };

  const deleteUserAccount = async () => {
    if (!confirm("CZY NA PEWNO CHCESZ USUNĄĆ SWOJE KONTO UŻYTKOWNIKA?\n\n- Twoje prywatne notatki zostaną wyczyszczone z bazy danych.\n- Twój profil zostanie odpięty od członka rodziny.\n- Nastąpi wylogowanie z aplikacji.")) return;

    try {
      // 1. Wyczyszczenie prywatnych notatek użytkownika z bazy danych rodziny
      if (data) {
        const nextNotes = (data.notes || []).filter(n => n.personId !== currentUserId);
        await persist({ ...data, notes: nextNotes });
      }

      // 2. Czyszczenie wpisu w tabeli profiles w Supabase
      if (supabaseClient && profile?.id) {
        await supabaseClient.from('profiles').update({
          family_id: null,
          person_id: null
        }).eq('id', profile.id);
      }

      // 3. Wylogowanie użytkownika z Supabase Auth
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

      // 4. Resetowanie stanu lokalnego
      setFamily(null);
      setProfile(null);
      setData(null);
      setSession(null);
      setTab('today');
      showToast("Konto użytkownika zostało usunięte i odpięte od rodziny.");
    } catch (err) {
      console.error("Błąd podczas usuwania konta użytkownika:", err);
      showToast("Wystąpił błąd podczas usuwania konta.");
    }
  };

  const deleteEvent = id => persist({ ...data, events: data.events.filter(e => e.id !== id) });
  const deleteTask = id => persist({ ...data, tasks: data.tasks.filter(t => t.id !== id) });
  const deleteNote = id => persist({ ...data, notes: data.notes.filter(n => n.id !== id) });
  
  const toggleTask = (task) => {
    const freq = task.recurrence?.freq || 'none'; const key = getPeriodKey(freq, todayStr()); const isDone = !!(task.completions && task.completions[key]);
    const nextCompletions = { ...(task.completions || {}) }; if (isDone) delete nextCompletions[key]; else nextCompletions[key] = true;
    persist({ ...data, tasks: data.tasks.map(t => t.id === task.id ? { ...t, completions: nextCompletions } : t) });
  };
  const toggleNoteItem = (noteId, itemId) => persist({ ...data, notes: data.notes.map(n => n.id === noteId ? { ...n, items: (n.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : n) });
  const toggleSubItem = (parentId, itemId, type) => {
    if (type === 'task') { persist({ ...data, tasks: data.tasks.map(t => t.id === parentId ? { ...t, items: (t.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : t) }); if (detailTask?.id === parentId) setDetailTask(p => ({ ...p, items: p.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) })); } 
    else if (type === 'event') { persist({ ...data, events: data.events.map(e => e.id === parentId ? { ...e, items: (e.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : e) }); if (detailEvent?.id === parentId) setDetailEvent(p => ({ ...p, items: p.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) })); }
  };

  const openAddEvent = (dateStr) => { setAddEventDate(dateStr || todayStr()); setModalPayload(null); setModal('event'); };
  const openAddTask = () => { setModalPayload(null); setModal('task'); };
  const openConvertNote = (note, type) => { setModalPayload({ initial: { note: note.text || '', items: note.items || [] }, noteId: note.id }); if (type === 'event') setAddEventDate(todayStr()); setModal(type); };
  const openEditEvent = ev => { setDetailEvent(null); setModalPayload({ editItem: ev }); setAddEventDate(ev.date); setModal('event'); };
  const openEditTask = t => { setDetailTask(null); setModalPayload({ editItem: t }); setModal('task'); };
  const openEditNote = n => { setModalPayload({ editItem: n }); setModal('note'); };
  const openEditPerson = p => { setEditingPerson(p); setModal('person'); };
  const closeModal = () => { setModal(null); setModalPayload(null); setEditingPerson(null); };

  const handleSignOut = async () => { if(confirm('Czy na pewno chcesz się wylogować?')) await supabaseClient.auth.signOut(); };

  const deleteFamily = async () => {
    if (!confirm("CZY NA PEWNO CHCESZ USUNĄĆ TĘ RODZINĘ?\n\nWszystkie wydarzenia, zadania, notatki, posiłki oraz osoby zostaną trwale usunięte z bazy danych. Nastąpi przekierowanie do ekranu startowego.")) return;

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
    showToast("Rodzina została usunięta.");
  };

  const TABS = [
    { id: 'today', label: 'Dziś', icon: Clock },
    { id: 'calendar', label: 'Kalendarz', icon: Calendar },
    { id: 'tasks', label: 'Zadania', icon: CheckSquare },
    { id: 'notes', label: 'Notatki', icon: StickyNote },
    ...(data.settings?.enableWall ? [{ id: 'wall', label: 'Tablica', icon: MessageSquare }] : []),
    ...(data.settings?.enableMeals ? [{ id: 'meals', label: 'Posiłki', icon: Utensils }] : []),
  ];

  return (
    <div style={{ background: COLORS.bg, fontFamily: 'Inter, sans-serif' }} className="min-h-screen flex flex-col text-stone-100">
      <style>{FONT_IMPORT}</style>

      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-stone-100 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-stone-700 flex items-center gap-2 animate-bounce"><Sparkles size={14} className="text-amber-400" />{toast}</div>}

      <header className="flex items-center justify-between px-5 pt-6 pb-4 sticky top-0 z-30 bg-[#121214]/85 backdrop-blur-md border-b border-stone-800/50">
        <div className="flex items-center gap-2.5">
          <AppLogo className="w-8 h-8 rounded-xl" iconSize={18} />
          <h1 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold truncate">{family.name}</h1>
        </div>
        <button onClick={() => setTab('settings')} className={`p-2 rounded-full transition border shadow-sm ${tab === 'settings' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'}`}><Settings size={20} /></button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24 max-w-2xl mx-auto w-full">
        {tab === 'today' && <TodayView data={data} onOpenEvent={setDetailEvent} onOpenTask={setDetailTask} onOpenAddEvent={openAddEvent} onOpenAddTask={openAddTask} onToggleTask={toggleTask} />}
        {tab === 'calendar' && <CalendarView data={data} onOpenAdd={openAddEvent} onOpenEvent={setDetailEvent} />}
        {tab === 'tasks' && <TasksView data={data} onToggleTask={toggleTask} onDeleteTask={deleteTask} onOpenTask={setDetailTask} onOpenAddTask={openAddTask} />}
        {tab === 'notes' && <NotesView notes={visibleNotes} onDelete={deleteNote} onConvert={openConvertNote} onEdit={openEditNote} onToggleItem={toggleNoteItem} onOpenAddNote={() => setModal('note')} />}
        {tab === 'wall' && data.settings?.enableWall && <WallView wall={data.wall} people={data.people} onDeleteWallMessage={deleteWallMessage} onTogglePinWallMessage={togglePinWallMessage} onOpenAddWall={() => setModal('wall')} />}
        {tab === 'meals' && data.settings?.enableMeals && <MealsView meals={data.meals} onUpdateMeal={updateMeal} />}
        {tab === 'settings' && <SettingsView family={family} profile={profile} settings={data.settings} onUpdateSettings={updateSettings} people={data.people} onAddPerson={() => setModal('person')} onEditPerson={openEditPerson} onDeletePerson={deletePerson} onSignOut={handleSignOut} supabase={supabaseClient} showToast={showToast} onDeleteFamily={deleteFamily} onDeleteUserAccount={deleteUserAccount} />}
        
        <PoweredByFooter className="mt-12 mb-4" />
      </main>

      <nav style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border-t fixed bottom-0 left-0 right-0 z-40 shadow-xl pb-safe">
        <div className="max-w-md mx-auto flex items-center justify-around overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} className="flex-1 min-w-[60px] flex flex-col items-center gap-1.5 py-3 transition">
                <Icon size={20} color={active ? COLORS.accent : COLORS.inkSoft} strokeWidth={active ? 2.5 : 2} />
                <span style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }} className="text-[10px] tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {modal === 'event' && <AddEventModal people={data.people} currentUserId={currentUserId} initialDate={addEventDate} initial={modalPayload?.initial} editItem={modalPayload?.editItem} onClose={closeModal} onSave={upsertEvent} />}
      {modal === 'task' && <AddTaskModal people={data.people} currentUserId={currentUserId} initial={modalPayload?.initial} editItem={modalPayload?.editItem} onClose={closeModal} onSave={upsertTask} />}
      {modal === 'note' && <NoteModal editItem={modalPayload?.editItem} currentUserId={currentUserId} onClose={closeModal} onSave={upsertNote} />}
      {modal === 'wall' && <AddWallMessageModal people={data.people} currentUserId={currentUserId} onClose={closeModal} onSave={addWallMessage} />}
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

      {detailEvent && <EventDetailModal event={detailEvent} people={data.people} onClose={() => setDetailEvent(null)} onEdit={openEditEvent} onDelete={deleteEvent} onToggleSubItem={toggleSubItem} />}
      {detailTask && <TaskDetailModal task={data.tasks.find(t => t.id === detailTask.id) || detailTask} people={data.people} onClose={() => setDetailTask(null)} onToggle={toggleTask} onDelete={deleteTask} onEdit={openEditTask} onToggleSubItem={toggleSubItem} />}
    </div>
  );
}