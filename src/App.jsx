import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, CheckSquare, StickyNote, Users, Plus, X, Check, 
  ChevronLeft, ChevronRight, Repeat, Clock, Trash2, AlertCircle, 
  Pencil, Bell, BellOff, ListChecks, Type as TypeIcon, Utensils,
  Download, Upload, Search, Tag, Sparkles, Filter, Smile, Settings, ToggleLeft, ToggleRight,
  Pin, MessageSquare, LayoutGrid, Info, Wifi, WifiOff
} from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

// Wersja aplikacji
const APP_VERSION = '1.1.2';

// Dynamic Dark Theme Colors
const COLORS = {
  bg: '#121214',         // Main dark background
  surface: '#1E1E22',    // Card / Surface background
  surfaceHighlight: '#2A2A30', // Hover/Active states
  ink: '#F3F3F5',        // Primary text
  inkSoft: '#A0A0AB',    // Secondary text
  border: '#33333C',     // Subtle borders
  success: '#4E9A58',    // Green check
  warn: '#E57373',       // Alert red/orange
  accent: '#E2B053',     // Warm accent gold
  accentSoft: '#2C271D', // Highlighted card bg
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
  { hours: 3, label: '3 godz. przed' },
  { hours: 6, label: '6 godz. przed' },
  { hours: 12, label: '12 godz. przed' },
  { hours: 24, label: '1 dzień przed' },
];

const RECURRENCE_LABELS = { none: 'Jednorazowo', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };

// Bezpieczne wczytywanie środowiska (podgląd webowy vs lokalny Vite)
function getEnv(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      return import.meta.env[key] || '';
    }
  } catch (e) {
    // Ignoruj, gdy import.meta nie jest dostępne
  }
  return '';
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Helpers
function reminderLabel(hours) {
  const opt = REMINDER_OPTIONS.find(o => o.hours === hours);
  return opt ? opt.label : 'Brak';
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toDateStr(new Date()); }
function parseDate(s) { 
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number); 
  return new Date(y, m - 1, d); 
}
function weekdayIdx(dateStr) { const d = parseDate(dateStr); return (d.getDay() + 6) % 7; }
function dayOfMonth(dateStr) { return parseDate(dateStr).getDate(); }
function getMonday(dateStr) {
  const d = parseDate(dateStr);
  const idx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - idx);
  return toDateStr(d);
}
function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
function addMonths(dateStr, n) {
  const d = parseDate(dateStr);
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}
function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function occursOnDate(event, dateStr) {
  if (dateStr < event.date) return false;
  const freq = event.recurrence?.freq || 'none';
  if (freq === 'none') return dateStr === event.date;
  if (freq === 'daily') return true;
  if (freq === 'weekly') return weekdayIdx(dateStr) === weekdayIdx(event.date);
  if (freq === 'monthly') return dayOfMonth(dateStr) === dayOfMonth(event.date);
  return false;
}

function getPeriodKey(freq, dateStr) {
  if (freq === 'daily') return dateStr;
  if (freq === 'weekly') return getMonday(dateStr);
  if (freq === 'monthly') return dateStr.slice(0, 7);
  return 'once';
}

function isTaskDoneForPeriod(task, dateStr) {
  const freq = task.recurrence?.freq || 'none';
  const key = getPeriodKey(freq, dateStr);
  return !!(task.completions && task.completions[key]);
}

function emptyData() {
  return { 
    people: [
      { id: 'p_1', name: 'Mama', color: '#F65D79', emoji: '👩' },
      { id: 'p_2', name: 'Tata', color: '#5B8FF9', emoji: '👨' }
    ], 
    events: [
      { id: 'ev_1', title: 'Wizyta u dentysty', date: todayStr(), time: '16:00', personIds: ['p_1'], recurrence: { freq: 'none' }, note: 'Gabinet nr 4', items: [], reminder: { hours: 2 } }
    ], 
    tasks: [
      { id: 't_1', title: 'Kupić produkty na obiad', dueDate: todayStr(), time: '', personIds: ['p_2'], recurrence: { freq: 'none' }, note: 'Sprawdź czy wszystko w lodówce', items: [{ id: 'i1', text: 'Ser żółty', done: false }, { id: 'i2', text: 'Owoce', done: true }], completions: {}, createdAt: todayStr() }
    ], 
    notes: [
      { id: 'n_1', text: 'Plan na weekendowe zakupy:', items: [{ id: 'i1', text: 'Chleb razowy', done: false }, { id: 'i2', text: 'Kawa ziarnista', done: true }], createdAt: new Date().toISOString(), personId: 'p_1' }
    ],
    wall: [
      { id: 'w_1', text: 'Obiad w lodówce na 2. półce, podgrzejcie w mikrofalówce! 🍲', personId: 'p_1', isPinned: true, color: '#2C271D', createdAt: new Date().toISOString() }
    ],
    meals: {
      [getMonday(todayStr())]: {
        '0': { breakfast: 'Owsianka z malinami', lunch: 'Zupa pomidorowa', dinner: 'Sałatka' },
        '1': { breakfast: 'Naleśniki', lunch: 'Spaghetti Bolognese', dinner: 'Kanapki' }
      }
    },
    settings: {
      enableMeals: true,
      enableWall: true,
      familyName: 'Nasza Rodzina',
      currentUserId: null
    }
  };
}

// Local Storage Manager
const STORAGE_KEY = 'rodzinny_planer_data_v4';
const storage = {
  get: () => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.warn("Storage read error", e);
      return null;
    }
  },
  set: (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("Storage write error", e);
      return false;
    }
  }
};

// UI Reusable Components
function Chip({ person, size = 'sm' }) {
  if (!person) return null;
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-sm';
  return (
    <span
      title={person.name}
      style={{ background: person.color || COLORS.accent, color: '#fff' }}
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 shadow-sm ${s}`}
    >
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
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold flex items-center gap-2">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text, icon: Icon = Sparkles }) {
  return (
    <div style={{ color: COLORS.inkSoft, borderColor: COLORS.border }} className="text-sm border border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-stone-900/40">
      <Icon size={24} className="opacity-40" />
      <span>{text}</span>
    </div>
  );
}

// Sub-items List Renderer
function ChecklistContainer({ items = [], onToggleItem, onAddItem, onRemoveItem }) {
  const [newText, setNewText] = useState('');

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAddItem(newText.trim());
    setNewText('');
  };

  return (
    <div className="space-y-2 mt-2">
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 bg-stone-800/60 p-2 rounded-xl border border-stone-800">
              <button 
                type="button" 
                onClick={() => onToggleItem(item.id)}
                style={{ borderColor: item.done ? COLORS.success : COLORS.border, background: item.done ? COLORS.success : 'transparent' }} 
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
              >
                {item.done && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? 'line-through text-stone-500' : 'text-stone-200'}`}>
                {item.text}
              </span>
              {onRemoveItem && (
                <button type="button" onClick={() => onRemoveItem(item.id)} className="text-stone-500 hover:text-red-400 p-1">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onAddItem && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="Dodaj pozycję do listy..."
            style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }}
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none"
          />
          <button type="button" onClick={handleAdd} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl w-9 h-9 flex items-center justify-center font-bold shrink-0 hover:opacity-90">
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Modals ----------

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        style={{ background: COLORS.surface }}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-all border border-stone-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-stone-900/90 backdrop-blur z-10" style={{ borderColor: COLORS.border }}>
          <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-800 transition" style={{ color: COLORS.inkSoft }}><X size={22} /></button>
        </div>
        <div className="p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">{children}</div>
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
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            style={{
              background: isOn ? p.color : COLORS.surfaceHighlight,
              borderColor: p.color,
              color: isOn ? '#fff' : p.color,
            }}
            className="px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Chip person={p} size="sm" />
            <span>{p.name}</span>
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
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          style={{
            background: value === k ? COLORS.accent : COLORS.surfaceHighlight,
            borderColor: value === k ? COLORS.accent : COLORS.border,
            color: value === k ? '#121214' : COLORS.ink,
          }}
          className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReminderPicker({ value, onChange }) {
  return (
    <select
      value={value === null ? 'null' : value}
      onChange={e => {
        const val = e.target.value === 'null' ? null : Number(e.target.value);
        onChange(val);
      }}
      style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }}
      className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition cursor-pointer"
    >
      {REMINDER_OPTIONS.map(opt => (
        <option key={String(opt.hours)} value={opt.hours === null ? 'null' : opt.hours} className="bg-stone-900 text-stone-100">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const inputStyle = "w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100";

function AddEventModal({ people, currentUserId, initialDate, initial, editItem, onClose, onSave }) {
  const isEdit = !!editItem;
  const [title, setTitle] = useState(editItem?.title || '');
  const [date, setDate] = useState(editItem?.date || initialDate);
  const [time, setTime] = useState(editItem?.time || '');
  const [personIds, setPersonIds] = useState(editItem?.personIds || (currentUserId ? [currentUserId] : []));
  const [freq, setFreq] = useState(editItem?.recurrence?.freq || 'none');
  const [note, setNote] = useState(editItem?.note ?? initial?.note ?? '');
  const [items, setItems] = useState(editItem?.items || initial?.items || []);
  const [reminderHours, setReminderHours] = useState(editItem ? (editItem.reminder?.hours ?? null) : 0);

  const togglePerson = id => setPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAddItem = text => setItems(prev => [...prev, { id: uid('it'), text, done: false }]);
  const handleToggleItem = id => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const handleRemoveItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: editItem?.id || uid('ev'),
      title: title.trim(),
      date, time, personIds,
      recurrence: { freq },
      note: note.trim(),
      items,
      reminder: reminderHours === null ? null : { hours: reminderHours },
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Tytuł wydarzenia</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Dentysta, Trening, Wycieczka"
            style={{ borderColor: COLORS.border }} className={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Godzina (opcjonalnie)</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Przypisane osoby</label>
          <PersonPicker people={people} selected={personIds} onToggle={togglePerson} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Powtarzanie</label>
          <RecurrencePicker value={freq} onChange={setFreq} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Przypomnienie</label>
          <ReminderPicker value={reminderHours} onChange={setReminderHours} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Opis / Notatka</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Dodatkowe informacje..."
            style={{ borderColor: COLORS.border }} className={`${inputStyle} h-20 resize-none`} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Checklista w wydarzeniu</label>
          <ChecklistContainer items={items} onToggleItem={handleToggleItem} onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} />
        </div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">
          {isEdit ? 'Zapisz zmiany' : 'Dodaj wydarzenie'}
        </button>
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

  const togglePerson = id => setPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAddItem = text => setItems(prev => [...prev, { id: uid('it'), text, done: false }]);
  const handleToggleItem = id => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const handleRemoveItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: editItem?.id || uid('task'),
      title: title.trim(),
      dueDate, time, personIds,
      recurrence: { freq },
      note: note.trim(),
      items,
      reminder: reminderHours === null ? null : { hours: reminderHours },
      completions: editItem?.completions || {},
      createdAt: editItem?.createdAt || todayStr(),
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj zadanie' : 'Nowe zadanie'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Co trzeba zrobić?</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Zrobić opłaty, Wynieść śmieci"
            style={{ borderColor: COLORS.border }} className={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Termin</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Godzina (opcjonalnie)</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ borderColor: COLORS.border }} className={inputStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Kto odpowiada?</label>
          <PersonPicker people={people} selected={personIds} onToggle={togglePerson} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Powtarzanie</label>
          <RecurrencePicker value={freq} onChange={setFreq} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Przypomnienie</label>
          <ReminderPicker value={reminderHours} onChange={setReminderHours} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Notatka</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Opcjonalny opis..."
            style={{ borderColor: COLORS.border }} className={`${inputStyle} h-20 resize-none`} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Pod-zadania / Checklista</label>
          <ChecklistContainer items={items} onToggleItem={handleToggleItem} onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} />
        </div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">
          {isEdit ? 'Zapisz zmiany' : 'Dodaj zadanie'}
        </button>
      </div>
    </ModalShell>
  );
}

function AddWallMessageModal({ people, currentUserId, onClose, onSave }) {
  const [text, setText] = useState('');
  const [personId, setPersonId] = useState(currentUserId || people[0]?.id || '');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [isPinned, setIsPinned] = useState(false);

  const save = () => {
    if (!text.trim()) return;
    onSave({
      id: uid('w'),
      text: text.trim(),
      personId,
      color,
      isPinned,
      createdAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <ModalShell title="Zostaw wiadomość na tablicy" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Wiadomość / Informacja</label>
          <textarea 
            autoFocus 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="np. Obiad w lodówce, Klucze są u sąsiada..."
            style={{ borderColor: COLORS.border }} 
            className={`${inputStyle} h-28 resize-none`} 
          />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Podpisane przez</label>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonId(p.id)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition ${personId === p.id ? 'bg-amber-400 text-stone-950 font-bold border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`}
              >
                <Chip person={p} size="sm" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Styl karteczki</label>
          <div className="flex gap-2">
            {CARD_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-8 h-8 rounded-xl border transition ${color === c ? 'border-amber-400 scale-110 ring-2 ring-amber-400/40' : 'border-stone-700'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input 
            type="checkbox" 
            id="pinMsg" 
            checked={isPinned} 
            onChange={e => setIsPinned(e.target.checked)} 
            className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700 focus:ring-0"
          />
          <label htmlFor="pinMsg" className="text-xs font-medium text-stone-300 flex items-center gap-1 cursor-pointer">
            <Pin size={14} className="text-amber-400" /> Przypnij na samej górze
          </label>
        </div>

        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">
          Przypnij wiadomość
        </button>
      </div>
    </ModalShell>
  );
}

function EventDetailModal({ event, people, onClose, onEdit, onDelete, onToggleSubItem }) {
  return (
    <ModalShell title="Szczegóły wydarzenia" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{event.title}</h4>
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono" style={{ color: COLORS.inkSoft }}>
            <span>📅 {event.date} {event.time ? `· ⏰ ${event.time}` : ''}</span>
            {event.recurrence?.freq !== 'none' && <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded"><Repeat size={12} /> {RECURRENCE_LABELS[event.recurrence.freq]}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.inkSoft }}>
          {event.reminder ? <Bell size={14} className="text-amber-400" /> : <BellOff size={14} />}
          <span>{event.reminder ? `Przypomnienie: ${reminderLabel(event.reminder.hours)}` : 'Brak przypomnienia'}</span>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>Biorą udział:</div>
          <PersonRow people={people} personIds={event.personIds} />
        </div>

        {event.note && (
          <div style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }} className="border rounded-xl p-3 text-sm whitespace-pre-wrap text-stone-300">
            {event.note}
          </div>
        )}

        {event.items && event.items.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>Lista kroków / zakupów:</div>
            <ChecklistContainer items={event.items} onToggleItem={(itemId) => onToggleSubItem(event.id, itemId, 'event')} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={() => onEdit(event)} style={{ borderColor: COLORS.border, color: COLORS.ink }} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800">
            <Pencil size={15} /> Edytuj
          </button>
          <button onClick={() => { onDelete(event.id); onClose(); }} style={{ borderColor: COLORS.border, color: COLORS.warn }} className="border rounded-xl px-4 flex items-center justify-center hover:bg-red-950/40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function TaskDetailModal({ task, people, onClose, onToggle, onDelete, onEdit, onToggleSubItem }) {
  const today = todayStr();
  const isDone = isTaskDoneForPeriod(task, today);

  return (
    <ModalShell title="Szczegóły zadania" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{task.title}</h4>
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono" style={{ color: COLORS.inkSoft }}>
            <span>Termin: {task.dueDate} {task.time ? `· ⏰ ${task.time}` : ''}</span>
            {task.recurrence?.freq !== 'none' && <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded"><Repeat size={12} /> {RECURRENCE_LABELS[task.recurrence.freq]}</span>}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>Przypisani wykonawcy:</div>
          <PersonRow people={people} personIds={task.personIds} />
        </div>

        {task.note && (
          <div style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }} className="border rounded-xl p-3 text-sm whitespace-pre-wrap text-stone-300">
            {task.note}
          </div>
        )}

        {task.items && task.items.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>Checklista zadania:</div>
            <ChecklistContainer items={task.items} onToggleItem={(itemId) => onToggleSubItem(task.id, itemId, 'task')} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={() => { onToggle(task); onClose(); }} style={{ background: isDone ? COLORS.surfaceHighlight : COLORS.success, color: '#fff', borderColor: COLORS.border }} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 shadow">
            <Check size={16} /> {isDone ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
          </button>
          <button onClick={() => onEdit(task)} style={{ borderColor: COLORS.border, color: COLORS.ink }} className="border rounded-xl px-3 hover:bg-stone-800">
            <Pencil size={16} />
          </button>
          <button onClick={() => { onDelete(task.id); onClose(); }} style={{ borderColor: COLORS.border, color: COLORS.warn }} className="border rounded-xl px-3 hover:bg-red-950/40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function NoteModal({ editItem, currentUserId, onClose, onSave }) {
  const isEdit = !!editItem;
  const [text, setText] = useState(editItem?.text || '');
  const [items, setItems] = useState(editItem?.items || []);

  const handleAddItem = textVal => setItems(prev => [...prev, { id: uid('it'), text: textVal, done: false }]);
  const handleToggleItem = id => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const handleRemoveItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const save = () => {
    const cleanText = text.trim();
    if (!cleanText && items.length === 0) return;

    onSave({ 
      id: editItem?.id || uid('note'), 
      text: cleanText, 
      items, 
      createdAt: editItem?.createdAt || new Date().toISOString(),
      personId: editItem?.personId || currentUserId
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj notatkę' : 'Nowa notatka'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Treść / Opis</label>
          <textarea 
            autoFocus 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="Wpisz treść notatki lub nagłówek..."
            style={{ borderColor: COLORS.border }} 
            className={`${inputStyle} h-24 resize-none`} 
          />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Lista pozycji / Zakupów</label>
          <ChecklistContainer items={items} onToggleItem={handleToggleItem} onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} />
        </div>

        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">
          {isEdit ? 'Zapisz zmiany' : 'Zapisz notatkę'}
        </button>
      </div>
    </ModalShell>
  );
}

function PersonModal({ editPerson, existingCount, onClose, onSave }) {
  const [name, setName] = useState(editPerson?.name || '');
  const [color, setColor] = useState(editPerson?.color || PERSON_PALETTE[existingCount % PERSON_PALETTE.length]);
  const [emoji, setEmoji] = useState(editPerson?.emoji || '👨');

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: editPerson?.id || uid('p'),
      name: name.trim(),
      color,
      emoji
    });
    onClose();
  };

  return (
    <ModalShell title={editPerson ? "Edytuj członka rodziny" : "Dodaj osobę"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Imię / Rola</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="np. Mama, Janek"
            style={{ borderColor: COLORS.border }} className={inputStyle} />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Ikona / Awatar</label>
          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-stone-900 border border-stone-800">
            {AVATAR_EMOJIS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${emoji === em ? 'bg-stone-800 shadow-md scale-110' : 'hover:bg-stone-800/50'}`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: COLORS.inkSoft }}>Kolor rozpoznawczy</label>
          <div className="flex flex-wrap gap-2">
            {PERSON_PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} style={{ background: c }}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'opacity-80 hover:opacity-100'}`} />
            ))}
          </div>
        </div>

        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">
          {editPerson ? 'Zapisz zmiany' : 'Dodaj osobę'}
        </button>
      </div>
    </ModalShell>
  );
}

// ---------- Views ----------

function TodayView({ data, onOpenEvent, onOpenTask, onOpenAddEvent, onOpenAddTask, onToggleTask }) {
  const today = todayStr();
  const events = data.events.filter(ev => occursOnDate(ev, today)).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const tasksToday = data.tasks.filter(t => {
    const freq = t.recurrence?.freq || 'none';
    if (freq === 'none') return t.dueDate === today;
    return t.dueDate <= today || freq !== 'none';
  });
  const pendingTasks = tasksToday.filter(t => !isTaskDoneForPeriod(t, today));
  const overdue = data.tasks.filter(t => (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isTaskDoneForPeriod(t, today));

  const monday = getMonday(today);
  const dayIdx = weekdayIdx(today);
  const enableMeals = data.settings?.enableMeals ?? true;
  const enableWall = data.settings?.enableWall ?? true;
  const todayMeal = enableMeals ? (data.meals?.[monday]?.[dayIdx] || null) : null;

  const pinnedWallMessages = enableWall ? (data.wall || []).filter(w => w.isPinned) : [];

  return (
    <div className="space-y-6">
      <div className="px-1 flex items-center justify-between">
        <div>
          <div style={{ color: COLORS.inkSoft, fontFamily: 'IBM Plex Mono' }} className="text-xs uppercase tracking-wide">
            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold mt-0.5">Dziś w domu</h2>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onOpenAddEvent(today)} style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ink }} className="px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-stone-800">
            <Plus size={14} /> Wydarzenie
          </button>
          <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:opacity-90">
            <Plus size={14} /> Zadanie
          </button>
        </div>
      </div>

      {pinnedWallMessages.length > 0 && (
        <div className="space-y-2">
          {pinnedWallMessages.map(msg => {
            const author = data.people.find(p => p.id === msg.personId);
            return (
              <div key={msg.id} style={{ background: msg.color || COLORS.surfaceHighlight, borderColor: COLORS.accent }} className="border rounded-2xl p-3.5 shadow-md flex items-start gap-3">
                <Pin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-amber-300/80 font-bold mb-0.5 flex items-center gap-1">
                    <span>{author?.name || 'Domownik'}</span>
                  </div>
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
              <div key={t.id} onClick={() => onOpenTask(t)} style={{ background: '#2C1B1B', borderColor: COLORS.warn }} className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleTask(t); }} 
                  className="w-6 h-6 rounded-lg border-2 border-red-400/50 hover:border-success flex items-center justify-center shrink-0 transition-colors mt-0.5 bg-red-950/20"
                ></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{t.title}</div>
                  <div className="text-xs font-mono" style={{ color: COLORS.warn }}>Termin był: {t.dueDate}</div>
                  <PersonRow people={data.people} personIds={t.personIds} />
                </div>
                <AlertCircle size={18} style={{ color: COLORS.warn }} className="shrink-0 opacity-50" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {enableMeals && todayMeal && (todayMeal.lunch || todayMeal.dinner || todayMeal.breakfast) && (
        <div style={{ background: COLORS.accentSoft, borderColor: '#5C4A28' }} className="border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-sm text-amber-300">
            <Utensils size={16} /> Dzisiejsze menu
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {todayMeal.breakfast && <div><span className="font-semibold text-amber-400/80">Śniadanie:</span> <span className="text-stone-200">{todayMeal.breakfast}</span></div>}
            {todayMeal.lunch && <div><span className="font-semibold text-amber-400/80">Obiad:</span> <span className="text-amber-200 font-bold">{todayMeal.lunch}</span></div>}
            {todayMeal.dinner && <div><span className="font-semibold text-amber-400/80">Kolacja:</span> <span className="text-stone-200">{todayMeal.dinner}</span></div>}
          </div>
        </div>
      )}

      <Section title="Plan wydarzeń na dziś">
        {events.length === 0 ? (
          <EmptyState text="Brak zaplanowanych wydarzeń na dziś" icon={Calendar} />
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} onClick={() => onOpenEvent(ev)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 text-left shadow-2xs hover:shadow-xs transition cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {ev.time ? (
                    <span style={{ fontFamily: 'IBM Plex Mono', color: COLORS.accent, background: '#2B261D' }} className="text-xs px-2 py-0.5 rounded-md font-semibold shrink-0">{ev.time}</span>
                  ) : (
                    <span className="text-xs text-stone-500 font-mono shrink-0">Cały dzień</span>
                  )}
                  <span className="text-sm font-semibold flex-1 truncate" style={{ color: COLORS.ink }}>{ev.title}</span>
                </div>
                {ev.note && <div className="text-xs mt-1.5 line-clamp-1" style={{ color: COLORS.inkSoft }}>{ev.note}</div>}
                <PersonRow people={data.people} personIds={ev.personIds} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Do zrobienia dzisiaj">
        {pendingTasks.length === 0 ? (
          <EmptyState text="Wszystkie dzisiejsze zadania ukończone! 🎉" icon={CheckSquare} />
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(t => (
              <div key={t.id} onClick={() => onOpenTask(t)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleTask(t); }} 
                  className="w-6 h-6 rounded-lg border-2 border-stone-600 hover:border-success flex items-center justify-center shrink-0 transition-colors mt-0.5 bg-stone-900/50"
                ></button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block" style={{ color: COLORS.ink }}>{t.title}</span>
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

  const d = parseDate(monthAnchor);
  const year = d.getFullYear(), month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toDateStr(new Date(year, month, day)));

  const eventsForDay = dateStr => data.events.filter(ev => {
    const matchesDay = occursOnDate(ev, dateStr);
    const matchesPerson = personFilter === 'all' || ev.personIds?.includes(personFilter);
    return matchesDay && matchesPerson;
  });

  const dayEvents = eventsForDay(selectedDay);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))} className="p-2 rounded-xl hover:bg-stone-800"><ChevronLeft size={20} /></button>
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold capitalize">{MONTHS[month]} {year}</h2>
        <button onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))} className="p-2 rounded-xl hover:bg-stone-800"><ChevronRight size={20} /></button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar">
        <button onClick={() => setPersonFilter('all')} style={{ background: personFilter === 'all' ? COLORS.accent : COLORS.surface, color: personFilter === 'all' ? '#121214' : COLORS.ink, borderColor: COLORS.border }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0">Wszyscy</button>
        {data.people.map(p => (
          <button key={p.id} onClick={() => setPersonFilter(p.id)} style={{ background: personFilter === p.id ? p.color : COLORS.surface, color: personFilter === p.id ? '#fff' : p.color, borderColor: p.color }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1">
            <Chip person={p} size="sm" /> {p.name}
          </button>
        ))}
      </div>

      <div className="border rounded-2xl p-3 shadow-xs" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(w => <div key={w} style={{ color: COLORS.inkSoft }} className="text-center text-[10px] uppercase font-bold tracking-wider">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} className="aspect-square" />;
            const evs = eventsForDay(dateStr);
            const isToday = dateStr === todayStr();
            const isSelected = dateStr === selectedDay;
            return (
              <button key={dateStr} onClick={() => setSelectedDay(dateStr)}
                style={{
                  background: isSelected ? COLORS.accent : isToday ? COLORS.accentSoft : 'transparent',
                  color: isSelected ? '#121214' : COLORS.ink,
                  borderColor: isToday && !isSelected ? COLORS.accent : 'transparent'
                }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-between p-1 relative text-xs border transition ${isSelected ? 'shadow-md font-bold' : 'hover:bg-stone-800'}`}>
                <span className={`font-semibold ${isToday ? 'underline font-bold' : ''}`}>{dayOfMonth(dateStr)}</span>
                {evs.length > 0 && (
                  <div className="flex gap-0.5 justify-center flex-wrap max-w-full">
                    {evs.slice(0, 3).map((ev, idx) => {
                      const p = data.people.find(pp => ev.personIds?.[0] === pp.id);
                      return <span key={idx} style={{ background: isSelected ? '#121214' : (p ? p.color : COLORS.inkSoft) }} className="w-1.5 h-1.5 rounded-full" />;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Section
        title={parseDate(selectedDay).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        action={
          <button onClick={() => onOpenAdd(selectedDay)} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-xs">
            <Plus size={14} /> Dodaj wydarzenie
          </button>
        }
      >
        {dayEvents.length === 0 ? <EmptyState text="Brak zaplanowanych wydarzeń w tym dniu" /> : (
          <div className="space-y-2">
            {dayEvents.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')).map(ev => (
              <div key={ev.id} onClick={() => onOpenEvent(ev)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 text-left shadow-2xs hover:shadow-xs transition cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {ev.time ? (
                    <span style={{ fontFamily: 'IBM Plex Mono', color: COLORS.accent, background: '#2B261D' }} className="text-xs px-2 py-0.5 rounded-md font-semibold">{ev.time}</span>
                  ) : (
                    <span className="text-xs text-stone-500 font-mono">Cały dzień</span>
                  )}
                  <span className="text-sm font-semibold flex-1 truncate" style={{ color: COLORS.ink }}>{ev.title}</span>
                  {ev.recurrence?.freq !== 'none' && <Repeat size={14} style={{ color: COLORS.inkSoft }} />}
                </div>
                {ev.note && <div className="text-xs mt-1.5 line-clamp-1" style={{ color: COLORS.inkSoft }}>{ev.note}</div>}
                <PersonRow people={data.people} personIds={ev.personIds} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function TasksView({ data, onToggleTask, onDeleteTask, onOpenTask, onOpenAddTask }) {
  const today = todayStr();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const visible = data.tasks.filter(t => {
    const matchesPerson = filter === 'all' || t.personIds?.includes(filter);
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchesPerson && matchesSearch;
  });

  const pending = visible.filter(t => !isTaskDoneForPeriod(t, today));
  const done = visible.filter(t => isTaskDoneForPeriod(t, today));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Zadania i domowe obowiązki</h2>
        <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 ml-2">
          <Plus size={14} /> Nowe zadanie
        </button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-stone-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj w zadaniach..."
            className="w-full border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none bg-stone-900 text-stone-100"
            style={{ borderColor: COLORS.border }}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? COLORS.accent : COLORS.surface, color: filter === 'all' ? '#121214' : COLORS.ink, borderColor: COLORS.border }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0">Wszyscy</button>
          {data.people.map(p => (
            <button key={p.id} onClick={() => setFilter(p.id)} style={{ background: filter === p.id ? p.color : COLORS.surface, color: filter === p.id ? '#fff' : p.color, borderColor: p.color }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1">
              <Chip person={p} size="sm" /> {p.name}
            </button>
          ))}
        </div>
      </div>

      <Section title={`Do zrobienia (${pending.length})`}>
        {pending.length === 0 ? <EmptyState text="Wszystko zrobione! Czas na odpoczynek 🎉" icon={CheckSquare} /> : (
          <div className="space-y-2">
            {pending.map(t => (
              <TaskRow key={t.id} t={t} people={data.people} today={today} onToggle={onToggleTask} onDelete={onDeleteTask} onOpen={onOpenTask} />
            ))}
          </div>
        )}
      </Section>

      {done.length > 0 && (
        <Section title={`Wykonane (${done.length})`}>
          <div className="space-y-2 opacity-60">
            {done.map(t => (
              <TaskRow key={t.id} t={t} people={data.people} today={today} onToggle={onToggleTask} onDelete={onDeleteTask} onOpen={onOpenTask} />
            ))}
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
    <div onClick={() => onOpen(t)} style={{ background: COLORS.surface, borderColor: isOverdue ? COLORS.warn : COLORS.border }} className="border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer">
      <button 
        onClick={(e) => { e.stopPropagation(); onToggle(t); }} 
        style={{ borderColor: isDone ? COLORS.success : COLORS.inkSoft, background: isDone ? COLORS.success : 'transparent' }} 
        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5 bg-stone-900/50"
      >
        {isDone && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div style={{ color: COLORS.ink, textDecoration: isDone ? 'line-through' : 'none' }} className={`text-sm font-semibold truncate block ${isDone ? 'opacity-50' : ''}`}>{t.title}</div>
        <div className="flex items-center gap-2 mt-0.5 mb-1">
          <span className="text-[11px] font-mono text-stone-500">Termin: {t.dueDate}</span>
          {t.recurrence?.freq !== 'none' && (
            <span style={{ color: COLORS.inkSoft }} className="text-[10px] bg-stone-800 px-1.5 py-0.2 rounded flex items-center gap-0.5"><Repeat size={10} /> {RECURRENCE_LABELS[t.recurrence.freq]}</span>
          )}
          {isOverdue && <span style={{ color: COLORS.warn }} className="text-[11px] font-bold">Zaległe!</span>}
        </div>
        <PersonRow people={people} personIds={t.personIds} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} className="p-1 hover:text-red-400 text-stone-500 mt-1"><Trash2 size={16} /></button>
    </div>
  );
}

function NotesView({ notes, onDelete, onConvert, onEdit, onToggleItem, onOpenAddNote }) {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Notatki</h2>
        <button onClick={onOpenAddNote} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs">
          <Plus size={14} /> Dodaj notatkę
        </button>
      </div>

      {sorted.length === 0 ? <EmptyState text="Brak zapisanych notatek lub list zakupów" icon={StickyNote} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(n => (
            <div key={n.id} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-400 font-semibold">
                    Notatka
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(n)} className="p-1 text-stone-500 hover:text-stone-200"><Pencil size={15} /></button>
                    <button onClick={() => onDelete(n.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                </div>

                {n.text && (
                  <p className="text-sm whitespace-pre-wrap my-1 font-normal text-stone-200">{n.text}</p>
                )}

                {n.items && n.items.length > 0 && (
                  <div className="space-y-1.5 my-2">
                    {n.items.map(item => (
                      <button key={item.id} onClick={() => onToggleItem(n.id, item.id)} className="flex items-center gap-2.5 w-full text-left group">
                        <span style={{ borderColor: item.done ? COLORS.success : COLORS.border, background: item.done ? COLORS.success : 'transparent' }} className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors">
                          {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                        </span>
                        <span style={{ color: item.done ? COLORS.inkSoft : COLORS.ink, textDecoration: item.done ? 'line-through' : 'none' }} className="text-sm font-medium flex-1">
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t mt-2 flex items-center justify-between" style={{ borderColor: COLORS.border }}>
                <span className="text-[10px] font-mono text-stone-500">
                  {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => onConvert(n, 'task')} title="Zamień na zadanie" className="border px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
                    <CheckSquare size={12} /> Zadanie
                  </button>
                  <button onClick={() => onConvert(n, 'event')} title="Zamień na wydarzenie" className="border px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-stone-800" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
                    <Calendar size={12} /> Wydarzenie
                  </button>
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
  const sorted = [...wall].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Tablica Wiadomości</h2>
          <p className="text-xs text-stone-400">Wirtualna korkówka lodówki</p>
        </div>
        <button onClick={onOpenAddWall} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs">
          <Plus size={14} /> Wiadomość
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState text="Brak wiadomości na tablicy" icon={MessageSquare} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(msg => {
            const author = people.find(p => p.id === msg.personId);
            return (
              <div 
                key={msg.id} 
                style={{ background: msg.color || COLORS.surface, borderColor: msg.isPinned ? COLORS.accent : COLORS.border }} 
                className="border rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 bg-black/20 pr-2.5 rounded-full">
                      <Chip person={author} size="sm" />
                      <span className="text-xs font-bold text-stone-200">{author?.name || 'Domownik'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => onTogglePinWallMessage(msg.id)} 
                        className={`p-1 rounded transition ${msg.isPinned ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
                      >
                        <Pin size={15} />
                      </button>
                      <button onClick={() => onDeleteWallMessage(msg.id)} className="p-1 text-stone-500 hover:text-red-400">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm whitespace-pre-wrap my-2 text-stone-100 font-medium">{msg.text}</p>
                </div>

                <div className="pt-2 border-t mt-2 flex items-center justify-between border-stone-800/80">
                  <span className="text-[10px] font-mono text-stone-500">
                    {new Date(msg.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.isPinned && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                      <Pin size={10} /> Przypięte
                    </span>
                  )}
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

  const days = [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(mondayAnchor, offset));
  const weekMeals = meals?.[mondayAnchor] || {};

  const handleMealChange = (dayIdx, mealType, value) => {
    const updatedWeek = {
      ...weekMeals,
      [dayIdx]: {
        ...(weekMeals[dayIdx] || {}),
        [mealType]: value
      }
    };
    onUpdateMeal(mondayAnchor, updatedWeek);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Planer Posiłków</h2>
          <p className="text-xs text-stone-400">Jadłospis na cały tydzień</p>
        </div>
        <div className="flex items-center gap-2 border rounded-xl p-1" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
          <button onClick={() => setMondayAnchor(addDays(mondayAnchor, -7))} className="p-1 rounded-lg hover:bg-stone-800"><ChevronLeft size={18} /></button>
          <span className="text-xs font-mono font-semibold">{parseDate(mondayAnchor).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
          <button onClick={() => setMondayAnchor(addDays(mondayAnchor, 7))} className="p-1 rounded-lg hover:bg-stone-800"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="space-y-3">
        {days.map((dateStr, idx) => {
          const isToday = dateStr === todayStr();
          const dayMeal = weekMeals[idx] || {};

          return (
            <div key={dateStr} style={{ background: isToday ? COLORS.accentSoft : COLORS.surface, borderColor: isToday ? COLORS.accent : COLORS.border }} className="border rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase font-mono px-2 py-0.5 rounded ${isToday ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'}`}>
                    {WEEKDAYS[idx]}
                  </span>
                  <span className="text-xs font-semibold text-stone-400">
                    {parseDate(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
                {isToday && <span className="text-[10px] font-bold text-amber-400">DZIŚ</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Śniadanie</label>
                  <input
                    type="text"
                    value={dayMeal.breakfast || ''}
                    onChange={e => handleMealChange(idx, 'breakfast', e.target.value)}
                    placeholder="np. Naleśniki"
                    className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200"
                    style={{ borderColor: COLORS.border }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Obiad</label>
                  <input
                    type="text"
                    value={dayMeal.lunch || ''}
                    onChange={e => handleMealChange(idx, 'lunch', e.target.value)}
                    placeholder="np. Rosół i kotlety"
                    className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-semibold bg-stone-900 text-amber-300"
                    style={{ borderColor: COLORS.border }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Kolacja</label>
                  <input
                    type="text"
                    value={dayMeal.dinner || ''}
                    onChange={e => handleMealChange(idx, 'dinner', e.target.value)}
                    placeholder="np. Kanapki"
                    className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200"
                    style={{ borderColor: COLORS.border }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({ settings, onUpdateSettings, people, onAddPerson, onEditPerson, onDeletePerson, onExport, onImport, cloudStatus }) {
  const enableMeals = settings?.enableMeals ?? true;
  const enableWall = settings?.enableWall ?? true;

  const handleFamilyNameChange = (e) => {
    onUpdateSettings({ ...settings, familyName: e.target.value });
  };

  const handleCurrentUserChange = (e) => {
    const val = e.target.value;
    onUpdateSettings({ ...settings, currentUserId: val === 'null' ? null : val });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Opcje i Ustawienia</h2>
          <p className="text-xs text-stone-400">Zarządzaj swoją rodziną i aplikacją</p>
        </div>
      </div>

      {/* Stan połączenia z chmurą */}
      <div style={{ background: COLORS.surface, borderColor: cloudStatus === 'active' ? COLORS.success : COLORS.warn }} className="border rounded-2xl p-4 flex items-center gap-3">
        {cloudStatus === 'active' ? <Wifi size={20} className="text-emerald-400" /> : <WifiOff size={20} className="text-red-400" />}
        <div>
          <div className="text-sm font-bold">
            {cloudStatus === 'active' ? 'Synchronizacja w chmurze (Supabase)' : cloudStatus === 'error' ? 'Błąd synchronizacji' : 'Tryb Lokalny (Lokalny Storage)'}
          </div>
          <div className="text-xs text-stone-400">
            {cloudStatus === 'active' 
              ? 'Wszystkie zmiany są natychmiastowo synchronizowane między telefonami.' 
              : 'Skonfiguruj połączenie z Supabase (VITE_SUPABASE_URL i KEY), by włączyć live sync.'}
          </div>
        </div>
      </div>

      {/* Sekcja: Personalizacja */}
      <div style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4 space-y-4 shadow-2xs">
        <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
          <Smile size={16} className="text-amber-400" /> Konto i Personalizacja
        </h3>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>Nazwa Twojej Rodziny</label>
          <input
            type="text"
            value={settings?.familyName || ''}
            onChange={handleFamilyNameChange}
            placeholder="np. Rodzina Kowalskich"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none bg-stone-900 text-stone-100"
            style={{ borderColor: COLORS.border }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: COLORS.inkSoft }}>
            Kim jesteś? (Personalizacja notatek i domyślne przypisywanie)
          </label>
          <select
            value={settings?.currentUserId || 'null'}
            onChange={handleCurrentUserChange}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none bg-stone-900 text-stone-100 cursor-pointer"
            style={{ borderColor: COLORS.border }}
          >
            <option value="null">-- Wybierz swój profil --</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-stone-500 mt-1">Wybranie profilu filtruje prywatne notatki i automatycznie przypisuje Cię przy dodawaniu nowych elementów.</p>
        </div>
      </div>

      {/* Sekcja: Rodzina */}
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: COLORS.ink }}>
            <Users size={16} className="text-amber-400" /> Członkowie Rodziny
          </h3>
          <button onClick={onAddPerson} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:opacity-90">
            <Plus size={14} /> Dodaj osobę
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {people.map(p => (
            <div key={p.id} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <Chip person={p} size="lg" />
                <div>
                  <div className="text-sm font-bold flex items-center gap-1" style={{ color: COLORS.ink }}>
                    {p.name} {settings?.currentUserId === p.id && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded">To Ty</span>}
                  </div>
                  <div className="text-[10px] font-mono text-stone-500">ID: {p.id}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEditPerson(p)} className="p-2 text-stone-500 hover:text-stone-200 bg-stone-800 rounded-lg"><Pencil size={15} /></button>
                <button onClick={() => onDeletePerson(p.id)} className="p-2 text-stone-500 hover:text-red-400 bg-stone-800 rounded-lg"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sekcja: Moduły */}
      <div style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4 space-y-4 shadow-2xs">
        <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
          <LayoutGrid size={16} className="text-amber-400" /> Moduły i funkcje
        </h3>

        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Tablica Wiadomości</div>
            <div className="text-xs text-stone-400">Dedykowana sekcja na wiadomości domowników.</div>
          </div>
          <button onClick={() => onUpdateSettings({ ...settings, enableWall: !enableWall })} className="p-1 transition">
            {enableWall ? (
              <ToggleRight size={32} className="text-amber-400" />
            ) : (
              <ToggleLeft size={32} className="text-stone-600" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Planer Posiłków</div>
            <div className="text-xs text-stone-400">Włącz lub wyłącz zakładkę planowania posiłków.</div>
          </div>
          <button onClick={() => onUpdateSettings({ ...settings, enableMeals: !enableMeals })} className="p-1 transition">
            {enableMeals ? (
              <ToggleRight size={32} className="text-amber-400" />
            ) : (
              <ToggleLeft size={32} className="text-stone-600" />
            )}
          </button>
        </div>
      </div>

      {/* Sekcja: Kopia Zapasowa */}
      <div style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4">
        <h3 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: COLORS.ink }}>
          <Download size={16} className="text-amber-400" /> Kopia zapasowa danych
        </h3>
        <p className="text-xs text-stone-400 mb-3">Pobierz plik ze wszystkimi wydarzeniami i zadaniami lub wczytaj go na innym urządzeniu.</p>
        <div className="flex gap-2">
          <button onClick={onExport} style={{ borderColor: COLORS.border, color: COLORS.ink }} className="flex-1 border rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800">
            <Download size={14} /> Pobierz (JSON)
          </button>
          <label style={{ borderColor: COLORS.border, color: COLORS.ink }} className="flex-1 border rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800 cursor-pointer">
            <Upload size={14} /> Wczytaj
            <input type="file" accept=".json" onChange={onImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="mt-8 mb-4 text-center text-stone-600 text-[10px] font-mono flex items-center justify-center gap-1">
        <Info size={12} /> Rodzinny Planer - Wersja {APP_VERSION}
      </div>
    </div>
  );
}

// ---------- Main App Root ----------

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [modal, setModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);
  const [addEventDate, setAddEventDate] = useState(todayStr());
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Status: 'local', 'error', 'active'
  const [cloudStatus, setCloudStatus] = useState('local');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Ładowanie skryptu Supabase dla środowiska bez bundlera i inicjalizacja
  useEffect(() => {
    let client = null;
    let channel = null;

    const initSupabaseAndData = async (supabaseObj) => {
      if (!supabaseObj) {
         setCloudStatus('local');
         setData(storage.get() || emptyData());
         setLoading(false);
         return;
      }

      console.log("Łączenie z Supabase...");
      window.supabaseClient = supabaseObj; // Global ref do zapisu
      
      try {
        const { data: rows, error } = await supabaseObj
          .from('family_data')
          .select('data')
          .eq('id', 'main_family')
          .single();

        let currentData;

        if (error) {
           console.warn("Błąd odczytu bazy:", error.message);
           // Brak wpisu -> ratujemy lokalnymi
           if (error.code === 'PGRST116' || error.message.includes('find no rows')) {
               currentData = storage.get() || emptyData();
               console.log("Tworzę nowy wpis w bazie z lokalnych danych...");
               const { error: insertErr } = await supabaseObj.from('family_data').upsert({ id: 'main_family', data: currentData });
               if(insertErr) {
                 console.error("Nie udało się utworzyć wpisu:", insertErr);
                 setCloudStatus('error');
               } else {
                 setCloudStatus('active');
               }
           } else {
               setCloudStatus('error');
               currentData = storage.get() || emptyData();
           }
        } else if (rows && rows.data) {
           console.log("Dane pobrane poprawnie z chmury!");
           currentData = rows.data;
           storage.set(currentData); // nadpisujemy lokalnie
           setCloudStatus('active');
        }

        setData(currentData);

        // Subskrypcja nasłuchująca w czasie rzeczywistym
        if (cloudStatus !== 'error') {
            channel = supabaseObj
              .channel('public:family_data')
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'family_data', filter: 'id=eq.main_family' }, (payload) => {
                console.log("Aktualizacja z chmury dotarła!");
                if (payload.new && payload.new.data) {
                  setData(prev => {
                    const localUserId = prev?.settings?.currentUserId;
                    const newData = payload.new.data;
                    if (localUserId && newData.settings) {
                      newData.settings.currentUserId = localUserId; // Zachowaj profil zalogowanej osoby
                    }
                    storage.set(newData);
                    return newData;
                  });
                  showToast("Zaktualizowano dane od domownika! 🔄");
                }
              })
              .subscribe();
        }

      } catch (err) {
        console.error("Krytyczny błąd połączenia:", err);
        setCloudStatus('error');
        setData(storage.get() || emptyData());
      }
      
      setLoading(false);
    };

    if (supabaseUrl && supabaseAnonKey) {
      // Spróbuj użyć zainstalowanego modułu (Vite)
      if (window.supabase && typeof window.supabase.createClient === 'function') {
         client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
         initSupabaseAndData(client);
      } else {
         // Dynamically load via CDN for sandboxes
         const script = document.createElement('script');
         script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
         script.async = true;
         script.onload = () => {
           if (window.supabase) {
             client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
             initSupabaseAndData(client);
           }
         };
         script.onerror = () => initSupabaseAndData(null);
         document.body.appendChild(script);
      }
    } else {
      initSupabaseAndData(null);
    }

    return () => {
      if (channel && client) client.removeChannel(channel);
    };
  }, []);

  // Persist funkcja zapisująca jednocześnie lokalnie i w Supabase
  const persist = useCallback(async (next) => {
    setData(next);
    storage.set(next);

    if (window.supabaseClient && cloudStatus !== 'local') {
      try {
        console.log("Wysyłam dane do Supabase...");
        const { error } = await window.supabaseClient
          .from('family_data')
          .upsert({ id: 'main_family', data: next, updated_at: new Date().toISOString() });
          
        if (error) {
            console.error("Błąd podczas zapisu w chmurze:", error);
            setCloudStatus('error');
        } else {
            console.log("Zapis w chmurze udany.");
            setCloudStatus('active');
        }
      } catch (e) {
        console.warn("Chmura niedostępna - zapisano lokalnie", e);
        setCloudStatus('error');
      }
    }
  }, [cloudStatus]);

  if (loading || !data) {
    return <div style={{ background: COLORS.bg, color: COLORS.ink }} className="min-h-screen flex items-center justify-center text-sm font-medium animate-pulse">Łączenie z domową bazą danych…</div>;
  }

  // Current User Configuration
  const currentUserId = data.settings?.currentUserId || null;

  // Filtrowanie notatek tylko dla zalogowanego użytkownika (lub dla wszystkich, jeśli notatka nie ma autora)
  const visibleNotes = currentUserId 
    ? data.notes.filter(n => !n.personId || n.personId === currentUserId)
    : data.notes;

  // Action handlers
  const upsertEvent = ev => {
    const noteId = modalPayload?.noteId;
    const nextNotes = noteId ? data.notes.filter(n => n.id !== noteId) : data.notes;
    const exists = data.events.some(e => e.id === ev.id);
    const nextEvents = exists ? data.events.map(e => e.id === ev.id ? ev : e) : [...data.events, ev];
    persist({ ...data, events: nextEvents, notes: nextNotes });
    showToast(exists ? "Zaktualizowano wydarzenie" : "Dodano wydarzenie");
  };

  const upsertTask = t => {
    const noteId = modalPayload?.noteId;
    const nextNotes = noteId ? data.notes.filter(n => n.id !== noteId) : data.notes;
    const exists = data.tasks.some(x => x.id === t.id);
    const nextTasks = exists ? data.tasks.map(x => x.id === t.id ? t : x) : [...data.tasks, t];
    persist({ ...data, tasks: nextTasks, notes: nextNotes });
    showToast(exists ? "Zaktualizowano zadanie" : "Dodano zadanie");
  };

  const upsertNote = n => {
    const exists = data.notes.some(x => x.id === n.id);
    const nextNotes = exists ? data.notes.map(x => x.id === n.id ? n : x) : [...data.notes, n];
    persist({ ...data, notes: nextNotes });
    showToast("Zapisano notatkę");
  };

  const addWallMessage = msg => {
    const nextWall = [msg, ...(data.wall || [])];
    persist({ ...data, wall: nextWall });
    showToast("Dodano wiadomość na tablicy");
  };

  const deleteWallMessage = id => {
    const nextWall = (data.wall || []).filter(w => w.id !== id);
    persist({ ...data, wall: nextWall });
    showToast("Usunięto wiadomość");
  };

  const togglePinWallMessage = id => {
    const nextWall = (data.wall || []).map(w => w.id === id ? { ...w, isPinned: !w.isPinned } : w);
    persist({ ...data, wall: nextWall });
  };

  const upsertPerson = p => {
    const exists = data.people.some(x => x.id === p.id);
    const nextPeople = exists ? data.people.map(x => x.id === p.id ? p : x) : [...data.people, p];
    persist({ ...data, people: nextPeople });
    showToast("Zapisano profil");
  };

  const updateMeal = (mondayKey, weekMeals) => {
    const nextMeals = {
      ...(data.meals || {}),
      [mondayKey]: weekMeals
    };
    persist({ ...data, meals: nextMeals });
  };

  const updateSettings = newSettings => {
    persist({ ...data, settings: newSettings });
    showToast("Zapisano ustawienia");
  };

  const deletePerson = id => {
    if (confirm("Czy na pewno usunąć tę osobę? Wydarzenia i zadania z nią powiązane mogą zostać usierocone.")) {
      // Przy usuwaniu profilu wyczyszczamy powiązanie dla obecnego użytkownika, jeśli to on
      const nextSettings = data.settings.currentUserId === id ? { ...data.settings, currentUserId: null } : data.settings;
      persist({ ...data, people: data.people.filter(p => p.id !== id), settings: nextSettings });
      showToast("Usunięto profil");
    }
  };

  const deleteEvent = id => {
    persist({ ...data, events: data.events.filter(e => e.id !== id) });
    showToast("Usunięto wydarzenie");
  };

  const deleteTask = id => {
    persist({ ...data, tasks: data.tasks.filter(t => t.id !== id) });
    showToast("Usunięto zadanie");
  };

  const deleteNote = id => {
    persist({ ...data, notes: data.notes.filter(n => n.id !== id) });
    showToast("Usunięto notatkę");
  };

  const toggleTask = (task) => {
    const freq = task.recurrence?.freq || 'none';
    const key = getPeriodKey(freq, todayStr());
    const isDone = !!(task.completions && task.completions[key]);
    const nextCompletions = { ...(task.completions || {}) };
    if (isDone) delete nextCompletions[key]; else nextCompletions[key] = true;
    const nextTasks = data.tasks.map(t => t.id === task.id ? { ...t, completions: nextCompletions } : t);
    persist({ ...data, tasks: nextTasks });
  };

  const toggleNoteItem = (noteId, itemId) => {
    const nextNotes = data.notes.map(n => {
      if (n.id !== noteId) return n;
      return { ...n, items: (n.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) };
    });
    persist({ ...data, notes: nextNotes });
  };

  const toggleSubItem = (parentId, itemId, type) => {
    if (type === 'task') {
      const nextTasks = data.tasks.map(t => {
        if (t.id !== parentId) return t;
        return { ...t, items: (t.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) };
      });
      persist({ ...data, tasks: nextTasks });
      if (detailTask && detailTask.id === parentId) {
        setDetailTask(prev => ({
          ...prev,
          items: (prev.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i)
        }));
      }
    } else if (type === 'event') {
      const nextEvents = data.events.map(e => {
        if (e.id !== parentId) return e;
        return { ...e, items: (e.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) };
      });
      persist({ ...data, events: nextEvents });
      if (detailEvent && detailEvent.id === parentId) {
        setDetailEvent(prev => ({
          ...prev,
          items: (prev.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i)
        }));
      }
    }
  };

  const openAddEvent = (dateStr) => { setAddEventDate(dateStr || todayStr()); setModalPayload(null); setModal('event'); };
  const openAddTask = (dateStr) => { setModalPayload(null); setModal('task'); };

  const openConvertNote = (note, type) => {
    setModalPayload({ initial: { note: note.text || '', items: note.items || [] }, noteId: note.id });
    if (type === 'event') setAddEventDate(todayStr());
    setModal(type);
  };

  const openEditEvent = (ev) => { setDetailEvent(null); setModalPayload({ editItem: ev }); setAddEventDate(ev.date); setModal('event'); };
  const openEditTask = (t) => { setDetailTask(null); setModalPayload({ editItem: t }); setModal('task'); };
  const openEditNote = (n) => { setModalPayload({ editItem: n }); setModal('note'); };
  const openEditPerson = (p) => { setEditingPerson(p); setModal('person'); };

  const closeModal = () => { setModal(null); setModalPayload(null); setEditingPerson(null); };

  const exportBackup = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `rodzinny_planer_kopia_${todayStr()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importBackup = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.people && parsed.events) {
            persist(parsed);
            showToast("Pomyślnie wczytano kopię zapasową!");
          } else {
            alert("Nieprawidłowy plik kopii zapasowej.");
          }
        } catch (err) {
          alert("Błąd odczytu pliku.");
        }
      };
    }
  };

  const enableMeals = data.settings?.enableMeals ?? true;
  const enableWall = data.settings?.enableWall ?? true;

  const TABS = [
    { id: 'today', label: 'Dziś', icon: Clock },
    { id: 'calendar', label: 'Kalendarz', icon: Calendar },
    { id: 'tasks', label: 'Zadania', icon: CheckSquare },
    { id: 'notes', label: 'Notatki', icon: StickyNote },
    ...(enableWall ? [{ id: 'wall', label: 'Tablica', icon: MessageSquare }] : []),
    ...(enableMeals ? [{ id: 'meals', label: 'Posiłki', icon: Utensils }] : []),
  ];

  return (
    <div style={{ background: COLORS.bg, fontFamily: 'Inter, sans-serif' }} className="min-h-screen flex flex-col text-stone-100">
      <style>{FONT_IMPORT}</style>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-stone-100 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-stone-700 flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-amber-400" />
          {toast}
        </div>
      )}

      {/* Globalny Header */}
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-4 sticky top-0 z-30 bg-[#121214]/85 backdrop-blur-md border-b border-stone-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <h1 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold truncate">
            {data.settings?.familyName || 'Rodzinny Planer'}
          </h1>
        </div>
        <button 
          onClick={() => setTab('settings')} 
          className={`p-2 rounded-full transition border shadow-sm ${tab === 'settings' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'}`}
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom,6rem),6rem)] max-w-2xl mx-auto w-full">
        {tab === 'today' && (
          <TodayView 
            data={data} 
            onOpenEvent={setDetailEvent} 
            onOpenTask={setDetailTask} 
            onOpenAddEvent={openAddEvent}
            onOpenAddTask={openAddTask}
            onToggleTask={toggleTask}
          />
        )}
        {tab === 'calendar' && <CalendarView data={data} onOpenAdd={openAddEvent} onOpenEvent={setDetailEvent} />}
        {tab === 'tasks' && (
          <TasksView 
            data={data} 
            onToggleTask={toggleTask} 
            onDeleteTask={deleteTask} 
            onOpenTask={setDetailTask} 
            onOpenAddTask={openAddTask}
          />
        )}
        {tab === 'notes' && (
          <NotesView 
            notes={visibleNotes} 
            onDelete={deleteNote} 
            onConvert={openConvertNote} 
            onEdit={openEditNote} 
            onToggleItem={toggleNoteItem} 
            onOpenAddNote={() => setModal('note')}
          />
        )}
        {tab === 'wall' && enableWall && (
          <WallView 
            wall={data.wall} 
            people={data.people} 
            onDeleteWallMessage={deleteWallMessage} 
            onTogglePinWallMessage={togglePinWallMessage}
            onOpenAddWall={() => setModal('wall')}
          />
        )}
        {tab === 'meals' && enableMeals && <MealsView meals={data.meals} onUpdateMeal={updateMeal} />}
        
        {tab === 'settings' && (
          <SettingsView 
            settings={data.settings} 
            onUpdateSettings={updateSettings}
            people={data.people}
            onAddPerson={() => setModal('person')}
            onEditPerson={openEditPerson}
            onDeletePerson={deletePerson}
            onExport={exportBackup}
            onImport={importBackup}
            cloudStatus={cloudStatus}
          />
        )}
      </main>

      {/* Navigation Bar */}
      <nav style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border-t fixed bottom-0 left-0 right-0 z-40 shadow-xl pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="max-w-md mx-auto flex items-center justify-around overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} className="flex-1 min-w-[60px] flex flex-col items-center gap-1.5 pt-3 pb-1 transition">
                <Icon size={20} color={active ? COLORS.accent : COLORS.inkSoft} strokeWidth={active ? 2.5 : 2} />
                <span style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }} className="text-[10px] tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {modal === 'event' && <AddEventModal people={data.people} currentUserId={currentUserId} initialDate={addEventDate} initial={modalPayload?.initial} editItem={modalPayload?.editItem} onClose={closeModal} onSave={upsertEvent} />}
      {modal === 'task' && <AddTaskModal people={data.people} currentUserId={currentUserId} initial={modalPayload?.initial} editItem={modalPayload?.editItem} onClose={closeModal} onSave={upsertTask} />}
      {modal === 'note' && <NoteModal editItem={modalPayload?.editItem} currentUserId={currentUserId} onClose={closeModal} onSave={upsertNote} />}
      {modal === 'wall' && <AddWallMessageModal people={data.people} currentUserId={currentUserId} onClose={closeModal} onSave={addWallMessage} />}
      {modal === 'person' && <PersonModal editPerson={editingPerson} existingCount={data.people.length} onClose={closeModal} onSave={upsertPerson} />}

      {detailEvent && (
        <EventDetailModal 
          event={detailEvent} 
          people={data.people} 
          onClose={() => setDetailEvent(null)} 
          onEdit={openEditEvent} 
          onDelete={deleteEvent} 
          onToggleSubItem={toggleSubItem}
        />
      )}
      {detailTask && (
        <TaskDetailModal
          task={data.tasks.find(t => t.id === detailTask.id) || detailTask}
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