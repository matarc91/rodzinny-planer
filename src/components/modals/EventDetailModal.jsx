import { useState } from 'react';
import { Trash2, Calendar, Repeat, Bell, BellOff, Pencil } from 'lucide-react';
import { COLORS, RECURRENCE_LABELS, reminderLabel } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { PersonRow } from '../ui/PersonRow.jsx';
import { ChecklistContainer } from '../ui/ChecklistContainer.jsx';

export function EventDetailModal({
  event,
  people,
  onClose,
  onEdit,
  onDelete,
  onExcludeDate,
  onToggleSubItem,
}) {
  const [deleteConfirmMode, setDeleteConfirmMode] = useState(false);
  const isMultiDay =
    (!event.recurrence?.freq || event.recurrence.freq === 'none') && event.endDate && event.endDate > event.date;
  const isRecurring = Boolean(event.recurrence?.freq && event.recurrence.freq !== 'none');
  const targetDate = event.occurrenceDate || event.date;

  return (
    <ModalShell title={deleteConfirmMode ? 'Usuwanie wydarzenia' : 'Szczegóły wydarzenia'} onClose={onClose}>
      {deleteConfirmMode ? (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-red-950/40 border border-red-900/60 p-4 rounded-2xl space-y-2">
            <h4 className="text-sm font-bold text-red-300 flex items-center gap-2">
              <Trash2 size={16} /> To wydarzenie powtarza się w cyklu
            </h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Wybierz, czy chcesz usunąć tylko to jedno konkretne wystąpienie z dnia{' '}
              <b className="text-amber-300 font-mono">{targetDate}</b>, czy cały cykl wydarzeń z kalendarza.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onExcludeDate) {
                  onExcludeDate(event.id, targetDate);
                }
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-500/50 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-between transition shadow-sm"
            >
              <div className="text-left">
                <div className="font-bold text-stone-100 flex items-center gap-1.5">
                  <span>Usuń tylko to wystąpienie</span>
                  <span className="text-[10px] font-mono bg-stone-800 px-1.5 py-0.5 rounded text-amber-300">
                    {targetDate}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 font-normal mt-0.5">
                  Pozostałe powtórzenia w kalendarzu pozostaną bez zmian
                </div>
              </div>
              <Calendar size={16} className="text-amber-400 shrink-0 ml-2" />
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-red-950/60 border border-red-800/80 hover:bg-red-900/80 text-red-200 text-xs font-semibold flex items-center justify-between transition shadow-sm"
            >
              <div className="text-left">
                <div className="font-bold text-red-100">Usuń cały cykl (wszystkie powtórzenia)</div>
                <div className="text-[11px] text-red-300/80 font-normal mt-0.5">
                  Wydarzenie zostanie całkowicie usunięte z kalendarza
                </div>
              </div>
              <Trash2 size={16} className="text-red-400 shrink-0 ml-2" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDeleteConfirmMode(false)}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-stone-400 hover:text-stone-200 text-xs font-medium transition"
          >
            Anuluj
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono text-stone-400">
              {isMultiDay ? (
                <span className="text-amber-300 font-semibold bg-amber-900/30 px-2 py-0.5 rounded border border-amber-900/50">
                  📅 {event.date} – {event.endDate} {event.time ? `· ⏰ ${event.time}` : ''}
                </span>
              ) : (
                <span>
                  📅 {targetDate} {event.time ? `· ⏰ ${event.time}` : ''}
                </span>
              )}
              {isRecurring && (
                <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                  <Repeat size={12} /> {RECURRENCE_LABELS[event.recurrence.freq] || 'Cykliczne'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            {event.reminder ? <Bell size={14} className="text-amber-400" /> : <BellOff size={14} />}{' '}
            <span>{event.reminder ? `Przypomnienie: ${reminderLabel(event.reminder.hours)}` : 'Brak przypomnienia'}</span>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1 text-stone-400">Biorą udział:</div>
            <PersonRow people={people} personIds={event.personIds} />
          </div>
          {event.note && (
            <div
              style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
              className="border rounded-xl p-3 text-sm whitespace-pre-wrap text-stone-300"
            >
              {event.note}
            </div>
          )}
          {event.items?.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1 text-stone-400">Kroki:</div>
              <ChecklistContainer
                items={event.items}
                onToggleItem={(itemId) => onToggleSubItem(event.id, itemId, 'event')}
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onEdit(event)}
              style={{ borderColor: COLORS.border, color: COLORS.ink }}
              className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800"
            >
              <Pencil size={15} /> Edytuj
            </button>
            <button
              onClick={() => {
                if (isRecurring) {
                  setDeleteConfirmMode(true);
                } else {
                  onDelete(event.id);
                  onClose();
                }
              }}
              style={{ borderColor: COLORS.border, color: COLORS.warn }}
              className="border rounded-xl px-4 flex items-center justify-center hover:bg-red-950/40"
              title="Usuń wydarzenie"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
