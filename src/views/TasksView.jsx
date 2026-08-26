import { useState } from 'react';
import { CheckSquare, Check, Trash2, Repeat } from 'lucide-react';
import { COLORS, RECURRENCE_LABELS } from '../utils/constants.js';
import { todayStr, isTaskDoneForPeriod } from '../utils/dateUtils.js';
import { Chip } from '../components/ui/Chip.jsx';
import { PersonRow } from '../components/ui/PersonRow.jsx';
import { Section } from '../components/ui/Section.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

function TaskRow({ t, people, today, onToggle, onDelete, onOpen }) {
  const isDone = isTaskDoneForPeriod(t, today);
  const isOverdue = (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isDone;
  return (
    <div
      onClick={() => onOpen(t)}
      style={{ background: COLORS.surface, borderColor: isOverdue ? COLORS.warn : COLORS.border }}
      className="border rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(t);
        }}
        style={{
          borderColor: isDone ? COLORS.success : COLORS.inkSoft,
          background: isDone ? COLORS.success : 'transparent',
        }}
        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 bg-stone-900/50"
      >
        {isDone && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          style={{ textDecoration: isDone ? 'line-through' : 'none' }}
          className={`text-sm font-semibold truncate ${isDone ? 'opacity-50' : ''}`}
        >
          {t.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 mb-1">
          <span className="text-[11px] font-mono text-stone-500">Termin: {t.dueDate}</span>
          {t.recurrence?.freq !== 'none' && (
            <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Repeat size={10} /> {RECURRENCE_LABELS[t.recurrence.freq]}
            </span>
          )}
          {isOverdue && <span className="text-[11px] font-bold text-red-400">Zaległe!</span>}
        </div>
        <PersonRow people={people} personIds={t.personIds} />
        {t.note && <div className="text-xs text-stone-400 mt-1.5 line-clamp-1 truncate">{t.note}</div>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(t.id);
        }}
        className="p-1 text-stone-500 hover:text-red-400"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function TasksView({ data, onToggleTask, onDeleteTask, onOpenTask }) {
  const today = todayStr();
  const [filter, setFilter] = useState('all');
  const visible = data.tasks.filter((t) => filter === 'all' || t.personIds?.includes(filter));
  const pending = visible.filter((t) => !isTaskDoneForPeriod(t, today));
  const done = visible.filter((t) => isTaskDoneForPeriod(t, today));

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="px-1">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">
          Zadania
        </h2>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          style={{
            background: filter === 'all' ? COLORS.accent : COLORS.surface,
            color: filter === 'all' ? '#121214' : COLORS.ink,
            borderColor: COLORS.border,
          }}
          className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0"
        >
          Wszyscy
        </button>
        {data.people.map((p) => (
          <button
            key={p.id}
            onClick={() => setFilter(p.id)}
            style={{
              background: filter === p.id ? p.color : COLORS.surface,
              color: filter === p.id ? '#fff' : p.color,
              borderColor: p.color,
            }}
            className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1"
          >
            <Chip person={p} size="sm" /> {p.name}
          </button>
        ))}
      </div>

      <Section title={`Do zrobienia (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState text="Wszystko zrobione!" icon={CheckSquare} />
        ) : (
          <div className="space-y-2">
            {pending.map((t) => (
              <TaskRow
                key={t.id}
                t={t}
                people={data.people}
                today={today}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
                onOpen={onOpenTask}
              />
            ))}
          </div>
        )}
      </Section>

      {done.length > 0 && (
        <Section title={`Wykonane (${done.length})`}>
          <div className="space-y-2 opacity-60">
            {done.map((t) => (
              <TaskRow
                key={t.id}
                t={t}
                people={data.people}
                today={today}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
                onOpen={onOpenTask}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
