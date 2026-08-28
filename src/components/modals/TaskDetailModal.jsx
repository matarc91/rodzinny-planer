import { Check, Pencil, Trash2, Repeat } from 'lucide-react';
import { COLORS, RECURRENCE_LABELS } from '../../utils/constants.js';
import { todayStr, isTaskDoneForPeriod } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { PersonRow } from '../ui/PersonRow.jsx';
import { ChecklistContainer } from '../ui/ChecklistContainer.jsx';
import { RichContentView } from '../ui/RichContentView.jsx';

export function TaskDetailModal({ task, people, onClose, onToggle, onDelete, onEdit, onToggleSubItem }) {
  const isDone = isTaskDoneForPeriod(task, todayStr());
  return (
    <ModalShell title="Szczegóły zadania" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">
            {task.title}
          </h4>
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1 font-mono text-stone-400">
            <span>
              Termin: {task.dueDate} {task.time ? `· ⏰ ${task.time}` : ''}
            </span>
            {task.recurrence?.freq !== 'none' && (
              <span className="flex items-center gap-1 bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                <Repeat size={12} /> {RECURRENCE_LABELS[task.recurrence.freq]}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1 text-stone-400">Wykonawcy:</div>
          <PersonRow people={people} personIds={task.personIds} />
        </div>
        {task.note && (
          <div
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="border rounded-xl p-3 text-sm text-stone-300"
          >
            <RichContentView content={task.note} />
          </div>
        )}
        {task.items?.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1 text-stone-400">Checklista:</div>
            <ChecklistContainer items={task.items} onToggleItem={(itemId) => onToggleSubItem(task.id, itemId, 'task')} />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              onToggle(task);
              onClose();
            }}
            style={{
              background: isDone ? COLORS.surfaceHighlight : COLORS.success,
              color: '#fff',
              borderColor: COLORS.border,
            }}
            className="flex-1 border rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 shadow"
          >
            <Check size={16} /> {isDone ? 'Cofnij wykonanie' : 'Zrobione'}
          </button>
          <button
            onClick={() => onEdit(task)}
            style={{ borderColor: COLORS.border, color: COLORS.ink }}
            className="border rounded-xl px-3 hover:bg-stone-800"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
            style={{ borderColor: COLORS.border, color: COLORS.warn }}
            className="border rounded-xl px-3 hover:bg-red-950/40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
