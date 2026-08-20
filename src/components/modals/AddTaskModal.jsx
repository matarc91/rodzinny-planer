import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { todayStr } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { PersonPicker } from '../ui/PersonPicker.jsx';
import { RecurrencePicker } from '../ui/RecurrencePicker.jsx';
import { ReminderPicker } from '../ui/ReminderPicker.jsx';
import { ChecklistContainer } from '../ui/ChecklistContainer.jsx';

const inputStyle =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100';

export function AddTaskModal({ people, currentUserId, initial, editItem, onClose, onSave }) {
  const isEdit = !editItem;
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
    onSave({
      id: editItem?.id || uid('task'),
      title: title.trim(),
      dueDate,
      time,
      personIds,
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
          <label className="text-xs font-semibold mb-1 block text-stone-400">Zadanie</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ borderColor: COLORS.border }}
            className={inputStyle}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Termin</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ borderColor: COLORS.border }}
              className={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Godzina</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ borderColor: COLORS.border }}
              className={inputStyle}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-stone-400">Wykonawca</label>
          <PersonPicker
            people={people}
            selected={personIds}
            onToggle={(id) => setPersonIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-stone-400">Powtarzanie</label>
          <RecurrencePicker value={freq} onChange={setFreq} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Przypomnienie</label>
          <ReminderPicker value={reminderHours} onChange={setReminderHours} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Notatka</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ borderColor: COLORS.border }}
            className={`${inputStyle} h-20 resize-none`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Checklista</label>
          <ChecklistContainer
            items={items}
            onToggleItem={(id) => setItems((p) => p.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))}
            onAddItem={(text) => setItems((p) => [...p, { id: uid('it'), text, done: false }])}
            onRemoveItem={(id) => setItems((p) => p.filter((i) => i.id !== id))}
          />
        </div>
        <button
          onClick={save}
          style={{ background: COLORS.accent, color: '#121214' }}
          className="w-full rounded-xl py-3 text-sm font-bold shadow hover:opacity-90 transition mt-2"
        >
          {isEdit ? 'Zapisz' : 'Dodaj zadanie'}
        </button>
      </div>
    </ModalShell>
  );
}
