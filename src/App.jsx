import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, CheckSquare, StickyNote, Users, Plus, X, Check, 
  ChevronLeft, ChevronRight, Repeat, Clock, Trash2, AlertCircle, 
  Pencil, Bell, BellOff, ListChecks, Type as TypeIcon, Utensils,
  Download, Upload, Search, Tag, Sparkles, Filter, Smile, Settings, ToggleLeft, ToggleRight,
  Pin, MessageSquare, LayoutGrid, Info, RefreshCw, Wifi, WifiOff, LogOut, Key, Copy
} from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

const APP_VERSION = '2.0.0 (Zabezpieczona chmura)';

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
const RECURRENCE_LABELS = { none: 'Jednorazowo', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };
const REMINDER_OPTIONS = [{ hours: null, label: 'Brak przypomnienia' }, { hours: 0, label: 'O czasie wydarzenia' }, { hours: 1, label: '1 godz. przed' }, { hours: 2, label: '2 godz. przed' }, { hours: 24, label: '1 dzień przed' }];

function getEnv(key) {
  try { if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key] || ''; } catch (e) { /* ignore */ }
  return '';
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

function reminderLabel(hours) { return REMINDER_OPTIONS.find(o => o.hours === hours)?.label || 'Brak'; }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toDateStr(new Date()); }
function parseDate(s) { if (!s) return new Date(); const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function weekdayIdx(dateStr) { return (parseDate(dateStr).getDay() + 6) % 7; }
function dayOfMonth(dateStr) { return parseDate(dateStr).getDate(); }
function getMonday(dateStr) { const d = parseDate(dateStr); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toDateStr(d); }
function addDays(dateStr, n) { const d = parseDate(dateStr); d.setDate(d.getDate() + n); return toDateStr(d); }
function addMonths(dateStr, n) { const d = parseDate(dateStr); d.setMonth(d.getMonth() + n); return toDateStr(d); }
function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

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
  return !!(task.completions && task.completions[getPeriodKey(task.recurrence?.freq || 'none', dateStr)]);
}

function emptyData() {
  return { 
    people: [], 
    events: [], tasks: [], notes: [], wall: [], meals: {},
    settings: { enableMeals: true, enableWall: true }
  };
}

const inputStyle = "w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 border-stone-700";

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
          <input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder="Dodaj pozycję do listy..." className={inputStyle} />
          <button type="button" onClick={handleAdd} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl w-10 h-10 flex items-center justify-center font-bold shrink-0 hover:opacity-90"><Plus size={18} /></button>
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div style={{ background: COLORS.surface }} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-all border border-stone-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-stone-900/90 backdrop-blur z-10 border-stone-800">
          <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-800 transition text-stone-400"><X size={22} /></button>
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
          <button key={p.id} type="button" onClick={() => onToggle(p.id)} style={{ background: isOn ? p.color : COLORS.surfaceHighlight, borderColor: p.color, color: isOn ? '#fff' : p.color }} className="px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm">
            <Chip person={p} size="sm" /><span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

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

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: editItem?.id || uid('ev'), title: title.trim(), date, time, personIds, recurrence: { freq }, note: note.trim(), items, reminder: reminderHours === null ? null : { hours: reminderHours } });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Tytuł wydarzenia</label><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Dentysta" className={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyle} /></div>
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Godzina</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputStyle} /></div>
        </div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Przypisane osoby</label><PersonPicker people={people} selected={personIds} onToggle={id => setPersonIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Powtarzanie</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(RECURRENCE_LABELS).map(([k, label]) => (
              <button key={k} onClick={() => setFreq(k)} className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${freq === k ? 'bg-amber-400 text-stone-900 border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Opis / Notatka</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Dodatkowe informacje..." className={`${inputStyle} h-20 resize-none`} /></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz zmiany' : 'Dodaj wydarzenie'}</button>
      </div>
    </ModalShell>
  );
}

function AddTaskModal({ people, currentUserId, initial, editItem, onClose, onSave }) {
  const isEdit = !!editItem;
  const [title, setTitle] = useState(editItem?.title || '');
  const [dueDate, setDueDate] = useState(editItem?.dueDate || todayStr());
  const [personIds, setPersonIds] = useState(editItem?.personIds || (currentUserId ? [currentUserId] : []));
  const [freq, setFreq] = useState(editItem?.recurrence?.freq || 'none');
  const [items, setItems] = useState(editItem?.items || initial?.items || []);

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: editItem?.id || uid('task'), title: title.trim(), dueDate, personIds, recurrence: { freq }, items, completions: editItem?.completions || {}, createdAt: editItem?.createdAt || todayStr() });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj zadanie' : 'Nowe zadanie'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Co trzeba zrobić?</label><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Zrobić opłaty" className={inputStyle} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Termin</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputStyle} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Kto odpowiada?</label><PersonPicker people={people} selected={personIds} onToggle={id => setPersonIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Pod-zadania / Checklista</label><ChecklistContainer items={items} onToggleItem={id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i))} onAddItem={text => setItems(p => [...p, { id: uid('it'), text, done: false }])} onRemoveItem={id => setItems(p => p.filter(i => i.id !== id))} /></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz zmiany' : 'Dodaj zadanie'}</button>
      </div>
    </ModalShell>
  );
}

function NoteModal({ editItem, currentUserId, onClose, onSave }) {
  const isEdit = !!editItem;
  const [text, setText] = useState(editItem?.text || '');
  const [items, setItems] = useState(editItem?.items || []);

  const save = () => {
    const cleanText = text.trim();
    if (!cleanText && items.length === 0) return;
    onSave({ id: editItem?.id || uid('note'), text: cleanText, items, createdAt: editItem?.createdAt || new Date().toISOString(), personId: editItem?.personId || currentUserId });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edytuj notatkę' : 'Nowa notatka'} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Treść / Opis</label><textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Wpisz treść notatki..." className={`${inputStyle} h-24 resize-none`} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Lista pozycji</label><ChecklistContainer items={items} onToggleItem={id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i))} onAddItem={textVal => setItems(p => [...p, { id: uid('it'), text: textVal, done: false }])} onRemoveItem={id => setItems(p => p.filter(i => i.id !== id))} /></div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2">{isEdit ? 'Zapisz zmiany' : 'Zapisz notatkę'}</button>
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
    onSave({ id: uid('w'), text: text.trim(), personId, color, isPinned, createdAt: new Date().toISOString() });
    onClose();
  };

  return (
    <ModalShell title="Zostaw wiadomość na tablicy" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Wiadomość / Informacja</label><textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="np. Obiad w lodówce..." className={`${inputStyle} h-28 resize-none`} /></div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Podpisane przez</label>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <button key={p.id} type="button" onClick={() => setPersonId(p.id)} className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition ${personId === p.id ? 'bg-amber-400 text-stone-950 font-bold border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`}>
                <Chip person={p} size="sm" /><span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Styl karteczki</label>
          <div className="flex gap-2">
            {CARD_COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} style={{ background: c }} className={`w-8 h-8 rounded-xl border transition ${color === c ? 'border-amber-400 scale-110 ring-2 ring-amber-400/40' : 'border-stone-700'}`} />)}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="pinMsg" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700 focus:ring-0" />
          <label htmlFor="pinMsg" className="text-xs font-medium text-stone-300 cursor-pointer flex items-center gap-1"><Pin size={14} className="text-amber-400" /> Przypnij na samej górze</label>
        </div>
        <button onClick={save} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow transition mt-2">Przypnij wiadomość</button>
      </div>
    </ModalShell>
  );
}

function PersonModal({ editPerson, existingCount, onClose, onSave }) {
  const [name, setName] = useState(editPerson?.name || '');
  const [color, setColor] = useState(editPerson?.color || PERSON_PALETTE[existingCount % PERSON_PALETTE.length]);
  const [emoji, setEmoji] = useState(editPerson?.emoji || '👨');

  return (
    <ModalShell title={editPerson ? "Edytuj profil" : "Dodaj osobę"} onClose={onClose}>
      <div className="space-y-4">
        <div><label className="text-xs font-semibold mb-1 block text-stone-400">Imię / Rola</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="np. Mama" className={inputStyle} /></div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Ikona / Awatar</label>
          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-stone-900 border border-stone-800">
            {AVATAR_EMOJIS.map(em => <button key={em} onClick={() => setEmoji(em)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${emoji === em ? 'bg-stone-800 shadow-md scale-110' : 'hover:bg-stone-800/50'}`}>{em}</button>)}
          </div>
        </div>
        <div><label className="text-xs font-semibold mb-1.5 block text-stone-400">Kolor</label>
          <div className="flex flex-wrap gap-2">
            {PERSON_PALETTE.map(c => <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'opacity-80'}`} />)}
          </div>
        </div>
        <button onClick={() => { if(name.trim()) { onSave({ id: editPerson?.id || uid('p'), name: name.trim(), color, emoji }); onClose(); } }} style={{ background: COLORS.accent, color: '#121214' }} className="w-full rounded-xl py-3 text-sm font-bold shadow mt-2">{editPerson ? 'Zapisz zmiany' : 'Dodaj osobę'}</button>
      </div>
    </ModalShell>
  );
}

function TodayView({ data, currentUserId, onOpenEvent, onOpenAddEvent, onOpenAddTask, onToggleTask }) {
  const today = todayStr();
  const events = data.events.filter(ev => occursOnDate(ev, today)).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const tasksToday = data.tasks.filter(t => (t.recurrence?.freq || 'none') === 'none' ? t.dueDate === today : true);
  const pendingTasks = tasksToday.filter(t => !isTaskDoneForPeriod(t, today));
  const overdue = data.tasks.filter(t => (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isTaskDoneForPeriod(t, today));
  const pinnedWall = (data.wall || []).filter(w => w.isPinned);

  const monday = getMonday(today);
  const dayIdx = weekdayIdx(today);
  const enableMeals = data.settings?.enableMeals ?? true;
  const todayMeal = enableMeals ? (data.meals?.[monday]?.[dayIdx] || null) : null;

  return (
    <div className="space-y-6">
      <div className="px-1 flex items-center justify-between">
        <div>
          <div style={{ color: COLORS.inkSoft, fontFamily: 'IBM Plex Mono' }} className="text-xs uppercase tracking-wide">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold mt-0.5">Dziś w domu</h2>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onOpenAddEvent(today)} className="px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-stone-800 border-stone-700 bg-stone-900 text-stone-200"><Plus size={14} /> Wydarzenie</button>
          <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"><Plus size={14} /> Zadanie</button>
        </div>
      </div>

      {pinnedWall.length > 0 && (
        <div className="space-y-2">
          {pinnedWall.map(msg => (
            <div key={msg.id} style={{ background: msg.color || COLORS.surfaceHighlight, borderColor: COLORS.accent }} className="border rounded-2xl p-3.5 shadow-md flex items-start gap-3">
              <Pin size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-300/80 font-bold mb-0.5">{data.people.find(p => p.id === msg.personId)?.name || 'Domownik'}</div>
                <p className="text-sm font-medium text-stone-100 whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {overdue.length > 0 && (
        <Section title="Zaległe zadania">
          <div className="space-y-2">
            {overdue.map(t => (
              <div key={t.id} style={{ background: '#2C1B1B', borderColor: COLORS.warn }} className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                <button onClick={() => onToggleTask(t)} className="w-6 h-6 rounded-lg border-2 border-red-400/50 hover:border-success flex items-center justify-center shrink-0 mt-0.5 bg-red-950/20"></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-200">{t.title}</div>
                  <div className="text-xs font-mono text-red-400">Termin był: {t.dueDate}</div>
                  <PersonRow people={data.people} personIds={t.personIds} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {enableMeals && todayMeal && (todayMeal.lunch || todayMeal.dinner || todayMeal.breakfast) && (
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
        {events.length === 0 ? <EmptyState text="Brak zaplanowanych wydarzeń" icon={Calendar} /> : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} onClick={() => onOpenEvent(ev)} className="w-full border border-stone-800 bg-stone-900/50 rounded-2xl p-3.5 shadow-2xs cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {ev.time ? <span className="text-xs px-2 py-0.5 rounded-md font-semibold text-amber-400 bg-amber-500/10 font-mono">{ev.time}</span> : <span className="text-xs text-stone-500 font-mono">Cały dzień</span>}
                  <span className="text-sm font-semibold flex-1 text-stone-200 truncate">{ev.title}</span>
                </div>
                <PersonRow people={data.people} personIds={ev.personIds} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Do zrobienia dzisiaj">
        {pendingTasks.length === 0 ? <EmptyState text="Wszystkie dzisiejsze zadania ukończone! 🎉" icon={CheckSquare} /> : (
          <div className="space-y-2">
            {pendingTasks.map(t => (
              <div key={t.id} className="w-full border border-stone-800 bg-stone-900/50 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                <button onClick={() => onToggleTask(t)} className="w-6 h-6 rounded-lg border-2 border-stone-600 hover:border-success shrink-0 mt-0.5"></button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-stone-200 block">{t.title}</span>
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
                style={{ background: isSelected ? COLORS.accent : isToday ? COLORS.accentSoft : 'transparent', color: isSelected ? '#121214' : COLORS.ink, borderColor: isToday && !isSelected ? COLORS.accent : 'transparent' }}
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

      <Section title={parseDate(selectedDay).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })} action={<button onClick={() => onOpenAdd(selectedDay)} style={{ background: COLORS.accent, color: '#121214' }} className="rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-xs"><Plus size={14} /> Wydarzenie</button>}>
        {dayEvents.length === 0 ? <EmptyState text="Brak wydarzeń w tym dniu" /> : (
          <div className="space-y-2">
            {dayEvents.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')).map(ev => (
              <div key={ev.id} onClick={() => onOpenEvent(ev)} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="w-full border rounded-2xl p-3.5 text-left shadow-2xs cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {ev.time ? <span style={{ fontFamily: 'IBM Plex Mono', color: COLORS.accent, background: '#2B261D' }} className="text-xs px-2 py-0.5 rounded-md font-semibold shrink-0">{ev.time}</span> : <span className="text-xs text-stone-500 font-mono shrink-0">Cały dzień</span>}
                  <span className="text-sm font-semibold flex-1 truncate" style={{ color: COLORS.ink }}>{ev.title}</span>
                </div>
                <PersonRow people={data.people} personIds={ev.personIds} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function TasksView({ data, onToggleTask, onDeleteTask, onOpenAddTask }) {
  const today = todayStr();
  const [filter, setFilter] = useState('all');
  
  const visible = data.tasks.filter(t => filter === 'all' || t.personIds?.includes(filter));
  const pending = visible.filter(t => !isTaskDoneForPeriod(t, today));
  const done = visible.filter(t => isTaskDoneForPeriod(t, today));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Zadania</h2>
        <button onClick={() => onOpenAddTask(today)} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> Nowe</button>
      </div>
      
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? COLORS.accent : COLORS.surface, color: filter === 'all' ? '#121214' : COLORS.ink, borderColor: COLORS.border }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0">Wszystkie</button>
        {data.people.map(p => (
          <button key={p.id} onClick={() => setFilter(p.id)} style={{ background: filter === p.id ? p.color : COLORS.surface, color: filter === p.id ? '#fff' : p.color, borderColor: p.color }} className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1"><Chip person={p} size="sm" /> {p.name}</button>
        ))}
      </div>

      <Section title={`Do zrobienia (${pending.length})`}>
        {pending.length === 0 ? <EmptyState text="Wszystko zrobione! 🎉" icon={CheckSquare} /> : (
          <div className="space-y-2">
            {pending.map(t => (
              <div key={t.id} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                <button onClick={() => onToggleTask(t)} className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 border-stone-600 bg-stone-900/50 hover:border-success"></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-stone-200">{t.title}</div>
                  <div className="text-[11px] font-mono text-stone-500 mb-1">Termin: {t.dueDate} {t.recurrence?.freq !== 'none' && `(Powtarzalne)`}</div>
                  <PersonRow people={data.people} personIds={t.personIds} />
                </div>
                <button onClick={() => onDeleteTask(t.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function NotesView({ notes, onDelete, onEdit, onToggleItem, onOpenAddNote }) {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Notatki & Listy</h2>
        <button onClick={onOpenAddNote} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><Plus size={14} /> Dodaj</button>
      </div>

      {sorted.length === 0 ? <EmptyState text="Brak notatek" icon={StickyNote} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(n => (
            <div key={n.id} style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase bg-stone-800 text-stone-400 px-2 py-0.5 rounded font-semibold">Notatka</span>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(n)} className="p-1 text-stone-500 hover:text-stone-200"><Pencil size={15} /></button>
                  <button onClick={() => onDelete(n.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
              {n.text && <p className="text-sm whitespace-pre-wrap my-1 font-normal text-stone-200">{n.text}</p>}
              {n.items && n.items.length > 0 && (
                <div className="space-y-1.5 my-2">
                  {n.items.map(item => (
                    <button key={item.id} onClick={() => onToggleItem(n.id, item.id)} className="flex items-center gap-2.5 w-full text-left">
                      <span style={{ borderColor: item.done ? COLORS.success : COLORS.border, background: item.done ? COLORS.success : 'transparent' }} className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0">{item.done && <Check size={10} color="#fff" strokeWidth={3} />}</span>
                      <span className={`text-sm ${item.done ? 'text-stone-500 line-through' : 'text-stone-200'}`}>{item.text}</span>
                    </button>
                  ))}
                </div>
              )}
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
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Tablica</h2>
          <p className="text-xs text-stone-400">Zostaw wiadomość na lodówce</p>
        </div>
        <button onClick={onOpenAddWall} style={{ background: COLORS.accent, color: '#121214' }} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"><Plus size={14} /> Dodaj</button>
      </div>

      {sorted.length === 0 ? <EmptyState text="Brak wiadomości" icon={MessageSquare} /> : (
        <div className="grid grid-cols-1 gap-3">
          {sorted.map(msg => {
            const author = people.find(p => p.id === msg.personId);
            return (
              <div key={msg.id} style={{ background: msg.color || COLORS.surface, borderColor: msg.isPinned ? COLORS.accent : COLORS.border }} className="border rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 bg-black/20 pr-2.5 rounded-full"><Chip person={author} size="sm" /><span className="text-xs font-bold text-stone-200">{author?.name || 'Domownik'}</span></div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onTogglePinWallMessage(msg.id)} className={`p-1 rounded transition ${msg.isPinned ? 'text-amber-400' : 'text-stone-500'}`}><Pin size={15} /></button>
                    <button onClick={() => onDeleteWallMessage(msg.id)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap my-2 text-stone-100 font-medium">{msg.text}</p>
                <div className="pt-2 border-t mt-2 flex items-center justify-between border-stone-800/80">
                  <span className="text-[10px] font-mono text-stone-500">{new Date(msg.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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
    onUpdateMeal(mondayAnchor, { ...weekMeals, [dayIdx]: { ...(weekMeals[dayIdx] || {}), [mealType]: value } });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Jadłospis</h2>
          <p className="text-xs text-stone-400">Plan na cały tydzień</p>
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
                  <span className={`text-xs font-bold uppercase font-mono px-2 py-0.5 rounded ${isToday ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'}`}>{WEEKDAYS[idx]}</span>
                  <span className="text-xs font-semibold text-stone-400">{parseDate(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Śniadanie</label><input type="text" value={dayMeal.breakfast || ''} onChange={e => handleMealChange(idx, 'breakfast', e.target.value)} placeholder="np. Naleśniki" className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200 border-stone-700" /></div>
                <div><label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Obiad</label><input type="text" value={dayMeal.lunch || ''} onChange={e => handleMealChange(idx, 'lunch', e.target.value)} placeholder="np. Rosół" className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-semibold bg-stone-900 text-amber-300 border-stone-700" /></div>
                <div><label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Kolacja</label><input type="text" value={dayMeal.dinner || ''} onChange={e => handleMealChange(idx, 'dinner', e.target.value)} placeholder="np. Kanapki" className="w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200 border-stone-700" /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({ familyInfo, profile, data, onAddPerson, onEditPerson, onDeletePerson, onSignOut }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold">Opcje Rodziny</h2>
          <p className="text-xs text-stone-400">Zarządzaj domownikami i kontem</p>
        </div>
      </div>

      <div className="border border-stone-800 bg-stone-900/50 rounded-2xl p-4 shadow-2xs">
        <h3 className="text-sm font-bold border-b border-stone-800 pb-2 mb-3 flex items-center gap-2 text-stone-200">
          <Key size={16} className="text-amber-400" /> Kod dołączenia do rodziny
        </h3>
        <p className="text-xs text-stone-400 mb-3">Zaproś domowników. Niech wpiszą ten kod po zalogowaniu na swoim telefonie:</p>
        <div className="flex items-center justify-between bg-black/40 px-4 py-3 rounded-xl border border-stone-800">
          <span className="font-mono text-2xl tracking-widest font-bold text-amber-400">{familyInfo?.join_code}</span>
          <button onClick={() => navigator.clipboard.writeText(familyInfo?.join_code)} className="p-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-stone-300"><Copy size={18} /></button>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold flex items-center gap-2 text-stone-200"><Users size={16} className="text-amber-400" /> Twój Dom</h3>
          <button onClick={onAddPerson} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-amber-400 text-stone-900"><Plus size={14} /> Dodaj awatar</button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {data.people.map(p => (
            <div key={p.id} className="border border-stone-800 bg-stone-900/50 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Chip person={p} size="lg" />
                <div>
                  <div className="text-sm font-bold text-stone-200 flex items-center gap-1">
                    {p.name} {profile?.person_id === p.id && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">To Ty</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEditPerson(p)} className="p-2 text-stone-400 hover:text-stone-200 bg-stone-800 rounded-lg"><Pencil size={15} /></button>
                <button onClick={() => onDeletePerson(p.id)} className="p-2 text-stone-400 hover:text-red-400 bg-stone-800 rounded-lg"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-800 text-red-400 hover:bg-red-950/20 text-sm font-semibold transition mt-8">
        <LogOut size={16} /> Wyloguj się
      </button>
      
      <div className="text-center text-[10px] text-stone-600 font-mono flex flex-col items-center gap-1 mt-4">
         <span>Wersja: {APP_VERSION}</span>
      </div>
    </div>
  );
}

function AuthScreen({ onAuth, supabaseClient }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (isLogin) {
        const { data, error: err } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.session) onAuth(data.session);
      } else {
        const { data, error: err } = await supabaseClient.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) onAuth(data.session);
        else {
           // Fallback sign in if email confirmation is disabled but it didn't auto-login
           const { data: loginData } = await supabaseClient.auth.signInWithPassword({ email, password });
           if (loginData?.session) onAuth(loginData.session);
           else setError("Konto utworzone. Spróbuj się zalogować.");
        }
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Nieprawidłowy email lub hasło.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#121214] text-stone-200">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4"><Sparkles size={24} /></div>
          <h1 className="text-2xl font-bold font-serif text-stone-100">Rodzinny Planer</h1>
          <p className="text-sm text-stone-400 mt-1">Uporządkuj życie swojego domu</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 bg-stone-900/50 p-6 rounded-2xl border border-stone-800 shadow-xl">
          {error && <div className="p-3 bg-red-950/50 border border-red-900 text-red-300 text-xs rounded-xl">{error}</div>}
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Adres E-mail</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} /></div>
          <div><label className="text-xs font-semibold mb-1 block text-stone-400">Hasło</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputStyle} minLength={6} /></div>
          <button type="submit" disabled={loading} className="w-full bg-amber-400 text-stone-950 font-bold py-2.5 rounded-xl shadow-md hover:bg-amber-300 transition">
            {loading ? 'Ładowanie...' : (isLogin ? 'Zaloguj się' : 'Utwórz konto')}
          </button>
        </form>
        <div className="text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-sm text-stone-400 hover:text-amber-400 transition">
            {isLogin ? 'Nie masz konta? Utwórz je tutaj.' : 'Masz już konto? Zaloguj się.'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({ session, supabaseClient, onFamilySet }) {
  const [tab, setTab] = useState('join');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      const joinCode = generateCode();
      const { data: family, error: famErr } = await supabaseClient.from('families').insert({ name: name.trim(), join_code: joinCode }).select().single();
      if (famErr) throw famErr;

      const { error: stateErr } = await supabaseClient.from('family_state').insert({ family_id: family.id, data: emptyData() });
      if (stateErr) throw stateErr;

      const { error: profErr } = await supabaseClient.from('profiles').upsert({ id: session.user.id, family_id: family.id });
      if (profErr) throw profErr;

      onFamilySet(family.id);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null);
    try {
      const { data: family, error: famErr } = await supabaseClient.from('families').select('*').eq('join_code', code.trim().toUpperCase()).single();
      if (famErr || !family) throw new Error("Nie znaleziono rodziny o tym kodzie.");

      const { error: profErr } = await supabaseClient.from('profiles').upsert({ id: session.user.id, family_id: family.id });
      if (profErr) throw profErr;

      onFamilySet(family.id);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#121214] text-stone-200">
      <div className="w-full max-w-sm space-y-6 bg-stone-900/50 p-6 rounded-3xl border border-stone-800 shadow-xl">
        <h2 className="text-xl font-bold font-serif text-center">Witaj w Planerze!</h2>
        <div className="flex p-1 bg-stone-950 rounded-xl border border-stone-800">
          <button onClick={() => setTab('join')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'join' ? 'bg-stone-800 text-stone-100' : 'text-stone-500'}`}>Dołącz</button>
          <button onClick={() => setTab('create')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'create' ? 'bg-stone-800 text-stone-100' : 'text-stone-500'}`}>Utwórz nową rodzinę</button>
        </div>
        
        {error && <div className="p-3 bg-red-950/50 border border-red-900 text-red-300 text-xs rounded-xl">{error}</div>}

        {tab === 'join' ? (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold mb-1 block text-stone-400">Kod dostępu od domownika</label><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="np. A8F9K2" className={`${inputStyle} uppercase font-mono tracking-widest text-center text-xl`} maxLength={6} /></div>
            <button onClick={handleJoin} disabled={loading || code.length < 5} className="w-full bg-amber-400 text-stone-950 font-bold py-3 rounded-xl disabled:opacity-50">Dołącz do rodziny</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold mb-1 block text-stone-400">Nazwa Twojej Rodziny</label><input value={name} onChange={e => setName(e.target.value)} placeholder="np. Rodzina Kowalskich" className={inputStyle} /></div>
            <button onClick={handleCreate} disabled={loading || name.length < 2} className="w-full bg-amber-400 text-stone-950 font-bold py-3 rounded-xl disabled:opacity-50">Utwórz rodzinę</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSelectionScreen({ session, profile, familyData, supabaseClient, onProfileSelected }) {
  const [loading, setLoading] = useState(false);

  const selectPerson = async (personId) => {
    setLoading(true);
    await supabaseClient.from('profiles').update({ person_id: personId }).eq('id', session.user.id);
    onProfileSelected(personId);
    setLoading(false);
  };

  const handleAddNewDummy = async () => {
      // Allow them to add a dummy person directly if none exists yet
      alert("Poproś założyciela rodziny o dodanie Twojego profilu w zakładce Opcje, a następnie wróć tutaj.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#121214] text-stone-200">
      <div className="w-full max-w-sm space-y-6 bg-stone-900/50 p-6 rounded-3xl border border-stone-800 shadow-xl text-center">
        <h2 className="text-xl font-bold font-serif">Kim jesteś?</h2>
        <p className="text-xs text-stone-400">Wybierz swój profil z listy w tej rodzinie.</p>
        <div className="space-y-2 mt-4">
          {familyData?.people?.length > 0 ? (
            familyData.people.map(p => (
              <button key={p.id} onClick={() => selectPerson(p.id)} disabled={loading} className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 transition">
                <div className="flex items-center gap-3"><Chip person={p} size="lg" /><span className="font-semibold text-stone-100">{p.name}</span></div>
                <ChevronRight size={18} className="text-stone-500" />
              </button>
            ))
          ) : (
            <div className="text-sm text-amber-400 p-4 border border-amber-900 bg-amber-950/20 rounded-xl">W tej rodzinie nie ma jeszcze żadnych awatarów. Stwórz go z poziomu Opcji (jeśli masz dostęp) lub poproś kogoś.</div>
          )}
        </div>
        <p className="text-[10px] text-stone-500 pt-4 cursor-pointer" onClick={handleAddNewDummy}>Brak Twojego profilu? Kliknij tutaj.</p>
      </div>
    </div>
  );
}


export default function App() {
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [modal, setModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);
  const [addEventDate, setAddEventDate] = useState(todayStr());

  // Zabezpieczony import klienta Supabase
  useEffect(() => {
    let mounted = true;
    const initSupabase = async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        if (mounted) setLoading(false);
        return;
      }
      let client = null;
      try {
        const { createClient } = await import(/* @vite-ignore */ '@supabase/supabase-js');
        client = createClient(supabaseUrl, supabaseAnonKey);
      } catch (e) {
        // Fallback dla środowisk podglądu (np. Code Sandbox), jeśli import rzuca błąd
        await new Promise((resolve, reject) => {
          if (window.supabase) resolve();
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      }

      if (mounted && client) {
        setSupabaseClient(client);
        
        // Inicjalizacja sesji
        client.auth.getSession().then(({ data: { session } }) => {
          if (mounted) {
            setSession(session);
            if (!session) setLoading(false);
          }
        });

        client.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setSession(session);
            if (!session) { setProfile(null); setFamilyInfo(null); setData(null); setLoading(false); }
          }
        });
      }
    };
    initSupabase();
    return () => { mounted = false; };
  }, []);

  // Fetching Data Logic
  useEffect(() => {
    if (!session || !supabaseClient) return;
    
    let channel = null;
    let isMounted = true;

    const loadCoreData = async () => {
      try {
        let { data: prof } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
        if (!prof) {
          const { data: newProf } = await supabaseClient.from('profiles').insert({ id: session.user.id }).select().single();
          prof = newProf;
        }
        if (!isMounted) return;
        setProfile(prof);

        if (prof?.family_id) {
          const { data: fam } = await supabaseClient.from('families').select('*').eq('id', prof.family_id).single();
          if (isMounted) setFamilyInfo(fam);

          const { data: stateData } = await supabaseClient.from('family_state').select('data').eq('family_id', prof.family_id).single();
          if (isMounted) setData(stateData?.data || emptyData());

          channel = supabaseClient.channel(`family_${prof.family_id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'family_state', filter: `family_id=eq.${prof.family_id}` }, 
              (payload) => { if (isMounted) setData(payload.new.data); }
            ).subscribe();
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoreData();
    return () => { isMounted = false; if (channel && supabaseClient) supabaseClient.removeChannel(channel); };
  }, [session, supabaseClient]);

  const persistData = async (nextData) => {
    setData(nextData); // Optymistyczny update UI
    if (profile?.family_id && supabaseClient) {
      await supabaseClient.from('family_state').update({ data: nextData, updated_at: new Date().toISOString() }).eq('family_id', profile.family_id);
    }
  };

  const handleSignOut = async () => { if (supabaseClient) await supabaseClient.auth.signOut(); };

  if (!supabaseUrl || !supabaseAnonKey) return <div className="p-10 text-stone-200 bg-[#121214] min-h-screen text-sm text-center pt-20">Skonfiguruj połączenie z Supabase (VITE_SUPABASE_URL i KEY), by włączyć live sync.</div>;
  if (loading || !supabaseClient) return <div className="min-h-screen flex items-center justify-center bg-[#121214] text-stone-400 font-mono text-xs">Uruchamianie środowiska...</div>;
  
  if (!session) return <AuthScreen onAuth={setSession} supabaseClient={supabaseClient} />;
  if (!profile?.family_id) return <OnboardingScreen session={session} supabaseClient={supabaseClient} onFamilySet={(fid) => setProfile({ ...profile, family_id: fid })} />;
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-[#121214] text-stone-400 font-mono text-xs">Pobieranie danych rodziny...</div>;
  
  // Jeśli użytkownik jest w rodzinie, ale nie wybrał awatara, chyba że w rodzinie nie ma w ogóle ludzi (wtedy wymuszamy pokazanie UI, żeby mógł kogoś dodać)
  if (!profile?.person_id && data.people?.length > 0) return <ProfileSelectionScreen session={session} profile={profile} familyData={data} supabaseClient={supabaseClient} onProfileSelected={(pid) => setProfile({ ...profile, person_id: pid })} />;

  // --- Main App Actions ---
  const currentUserId = profile?.person_id;
  const currentPerson = (data.people || []).find(p => p.id === currentUserId);
  
  const upsertEvent = ev => { const exists = data.events.some(e => e.id === ev.id); persistData({ ...data, events: exists ? data.events.map(e => e.id === ev.id ? ev : e) : [...data.events, ev] }); };
  const upsertTask = t => { const exists = data.tasks.some(x => x.id === t.id); persistData({ ...data, tasks: exists ? data.tasks.map(x => x.id === t.id ? t : x) : [...data.tasks, t] }); };
  const upsertNote = n => { const exists = data.notes.some(x => x.id === n.id); persistData({ ...data, notes: exists ? data.notes.map(x => x.id === n.id ? n : x) : [...data.notes, n] }); };
  
  const toggleTask = (task) => {
    const key = getPeriodKey(task.recurrence?.freq || 'none', todayStr());
    const isDone = !!(task.completions && task.completions[key]);
    const nextCompletions = { ...(task.completions || {}) };
    if (isDone) delete nextCompletions[key]; else nextCompletions[key] = true;
    persistData({ ...data, tasks: data.tasks.map(t => t.id === task.id ? { ...t, completions: nextCompletions } : t) });
  };
  const deleteTask = id => persistData({ ...data, tasks: data.tasks.filter(t => t.id !== id) });
  const deleteNote = id => persistData({ ...data, notes: data.notes.filter(n => n.id !== id) });
  const toggleNoteItem = (noteId, itemId) => persistData({ ...data, notes: data.notes.map(n => n.id === noteId ? { ...n, items: (n.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : n) });
  
  const addWallMessage = msg => persistData({ ...data, wall: [msg, ...(data.wall || [])] });
  const deleteWallMessage = id => persistData({ ...data, wall: (data.wall || []).filter(w => w.id !== id) });
  const togglePinWallMessage = id => persistData({ ...data, wall: (data.wall || []).map(w => w.id === id ? { ...w, isPinned: !w.isPinned } : w) });
  
  const updateMeal = (mondayKey, weekMeals) => persistData({ ...data, meals: { ...(data.meals || {}), [mondayKey]: weekMeals } });

  const upsertPerson = async p => {
    const exists = (data.people || []).some(x => x.id === p.id);
    const nextPeople = exists ? data.people.map(x => x.id === p.id ? p : x) : [...(data.people || []), p];
    await persistData({ ...data, people: nextPeople });
    
    // Auto-assign if this is the first person and I have no person_id
    if (!exists && !currentUserId && nextPeople.length === 1) {
       await supabaseClient.from('profiles').update({ person_id: p.id }).eq('id', session.user.id);
       setProfile({ ...profile, person_id: p.id });
    }
  };
  const deletePerson = id => {
    if(confirm("Usunąć awatar?")) persistData({ ...data, people: data.people.filter(p => p.id !== id) });
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
    { id: 'settings', label: 'Opcje', icon: Settings },
  ];

  return (
    <div style={{ background: COLORS.bg, fontFamily: 'Inter, sans-serif' }} className="min-h-screen flex flex-col text-stone-100">
      <style>{FONT_IMPORT}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-4 sticky top-0 z-30 bg-[#121214]/85 backdrop-blur-md border-b border-stone-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0"><Sparkles size={18} /></div>
          <h1 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold truncate">{familyInfo?.name || 'Planer'}</h1>
        </div>
        {currentPerson && (
          <div className="flex items-center gap-2 bg-stone-900 rounded-full pl-2 pr-1 py-1 border border-stone-800 shadow-sm">
            <span className="text-xs font-semibold text-stone-300 px-1">{currentPerson?.name}</span>
            <Chip person={currentPerson} size="sm" />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom,6rem),6rem)] max-w-2xl mx-auto w-full">
        {tab === 'today' && <TodayView data={data} currentUserId={currentUserId} onOpenEvent={(e)=>{}} onOpenAddEvent={(d) => { setAddEventDate(d); setModal('event'); }} onOpenAddTask={() => setModal('task')} onToggleTask={toggleTask} />}
        {tab === 'calendar' && <CalendarView data={data} onOpenAdd={(d) => { setAddEventDate(d); setModal('event'); }} onOpenEvent={(e)=>{}} />}
        {tab === 'tasks' && <TasksView data={data} onToggleTask={toggleTask} onDeleteTask={deleteTask} onOpenAddTask={() => setModal('task')} />}
        {tab === 'notes' && <NotesView notes={data.notes} onDelete={deleteNote} onEdit={(n) => { setModalPayload({editItem: n}); setModal('note'); }} onToggleItem={toggleNoteItem} onOpenAddNote={() => setModal('note')} />}
        {tab === 'wall' && enableWall && <WallView wall={data.wall} people={data.people} onDeleteWallMessage={deleteWallMessage} onTogglePinWallMessage={togglePinWallMessage} onOpenAddWall={() => setModal('wall')} />}
        {tab === 'meals' && enableMeals && <MealsView meals={data.meals} onUpdateMeal={updateMeal} />}
        {tab === 'settings' && <SettingsView familyInfo={familyInfo} profile={profile} data={data} onAddPerson={() => setModal('person')} onEditPerson={(p) => { setModalPayload({editItem: p}); setModal('person'); }} onDeletePerson={deletePerson} onSignOut={handleSignOut} />}
      </main>

      {/* Bottom Nav */}
      <nav style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border-t fixed bottom-0 left-0 right-0 z-40 shadow-xl pb-[env(safe-area-inset-bottom)]">
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

      {/* Modals */}
      {modal === 'event' && <AddEventModal people={data.people} currentUserId={currentUserId} initialDate={addEventDate} onClose={() => setModal(null)} onSave={upsertEvent} />}
      {modal === 'task' && <AddTaskModal people={data.people} currentUserId={currentUserId} onClose={() => setModal(null)} onSave={upsertTask} />}
      {modal === 'note' && <NoteModal editItem={modalPayload?.editItem} currentUserId={currentUserId} onClose={() => {setModal(null); setModalPayload(null);}} onSave={upsertNote} />}
      {modal === 'wall' && <AddWallMessageModal people={data.people} currentUserId={currentUserId} onClose={() => setModal(null)} onSave={addWallMessage} />}
      {modal === 'person' && <PersonModal editPerson={modalPayload?.editItem} existingCount={data.people.length} onClose={() => {setModal(null); setModalPayload(null);}} onSave={upsertPerson} />}
    </div>
  );
}