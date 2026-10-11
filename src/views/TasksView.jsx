import { useState, useMemo } from 'react';
import {
  CheckSquare,
  Check,
  Trash2,
  Repeat,
  Archive,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  Layers,
} from 'lucide-react';
import { COLORS, RECURRENCE_LABELS, MONTHS } from '../utils/constants.js';
import {
  todayStr,
  isTaskDoneForPeriod,
  addMonthsStr,
  occursOnDate,
} from '../utils/dateUtils.js';
import { Chip } from '../components/ui/Chip.jsx';
import { PersonRow } from '../components/ui/PersonRow.jsx';
import { Section } from '../components/ui/Section.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { extractTextSummaryFromDoc } from '../utils/noteMigration.js';

function formatMonthYear(monthKey) {
  if (!monthKey) return '';
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const name = MONTHS[monthIdx] || '';
  const capName = name ? name.charAt(0).toUpperCase() + name.slice(1) : monthStr;
  return `${capName} ${yearStr}`;
}

function getTaskCompletionDate(task) {
  if (typeof task.completions?.once === 'string' && /^\d{4}-\d{2}-\d{2}/.test(task.completions.once)) {
    return task.completions.once.slice(0, 10);
  }
  if (task.completedAt) {
    return task.completedAt.slice(0, 10);
  }
  return task.dueDate || todayStr();
}

function isTaskCompleted(task, targetDate = todayStr()) {
  const freq = task.recurrence?.freq || 'none';
  if (freq === 'none') {
    return Boolean(task.completions?.once);
  }
  return isTaskDoneForPeriod(task, targetDate);
}

function TaskRow({ t, people, today, onToggle, onDelete, onOpen, isArchived = false, completionDate }) {
  const isDone = isArchived || isTaskCompleted(t, today);
  const isOverdue = !isDone && (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today;

  return (
    <div
      onClick={() => onOpen(t)}
      style={{
        background: COLORS.surface,
        borderColor: isOverdue ? COLORS.warn : COLORS.border,
      }}
      className={`border rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer transition hover:border-stone-600 ${
        isDone ? 'opacity-75 bg-stone-900/50' : ''
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(t);
        }}
        title={isDone ? 'Kliknij, aby cofnąć wykonanie (przywrócić zadanie)' : 'Oznacz jako zrobione'}
        style={{
          borderColor: isDone ? COLORS.success : COLORS.inkSoft,
          background: isDone ? COLORS.success : 'transparent',
        }}
        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 bg-stone-900/50 hover:scale-105 transition"
      >
        {isDone && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          style={{ textDecoration: isDone ? 'line-through' : 'none' }}
          className={`text-sm font-semibold truncate ${isDone ? 'text-stone-400' : 'text-stone-100'}`}
        >
          {t.title}
        </div>

        <div className="flex items-center gap-2 mt-0.5 mb-1 flex-wrap">
          {isDone ? (
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <span>✓ Ukończono:</span>
              <span className="font-semibold">{completionDate || t.dueDate}</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono text-stone-500">
              Termin: {t.dueDate}
            </span>
          )}

          {t.recurrence?.freq && t.recurrence.freq !== 'none' && (
            <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Repeat size={10} /> {RECURRENCE_LABELS[t.recurrence.freq]}
            </span>
          )}

          {isOverdue && (
            <span className="text-[10px] font-bold text-red-300 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/40">
              Zaległe!
            </span>
          )}
        </div>

        <PersonRow people={people} personIds={t.personIds} />

        {extractTextSummaryFromDoc(t.note) ? (
          <div className="text-xs text-stone-400 mt-1.5 line-clamp-1 truncate">
            {extractTextSummaryFromDoc(t.note)}
          </div>
        ) : null}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(t.id);
        }}
        className="p-1 text-stone-500 hover:text-red-400 transition"
        title="Usuń zadanie"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function TasksView({ data, onToggleTask, onDeleteTask, onOpenTask }) {
  const today = todayStr();
  const currentMonthKey = today.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [filter, setFilter] = useState('all');
  const [showArchive, setShowArchive] = useState(false);
  const [archiveMonthFilter, setArchiveMonthFilter] = useState('all');

  const isCurrentMonth = selectedMonth === currentMonthKey;

  const visibleTasks = useMemo(() => {
    return (data.tasks || []).filter((t) => filter === 'all' || t.personIds?.includes(filter));
  }, [data.tasks, filter]);

  // Tasks for today (when viewing current month)
  const todayTasks = useMemo(() => {
    if (!isCurrentMonth) return [];
    return visibleTasks
      .filter((t) => {
        const freq = t.recurrence?.freq || 'none';
        if (freq === 'none') {
          return !isTaskCompleted(t) && t.dueDate <= today;
        }
        return !isTaskDoneForPeriod(t, today) && (freq === 'daily' || occursOnDate(t, today) || t.dueDate <= today);
      })
      .sort((a, b) => {
        const aOverdue = (a.recurrence?.freq || 'none') === 'none' && a.dueDate < today;
        const bOverdue = (b.recurrence?.freq || 'none') === 'none' && b.dueDate < today;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return (a.dueDate || '').localeCompare(b.dueDate || '') || (a.time || '99:99').localeCompare(b.time || '99:99');
      });
  }, [visibleTasks, isCurrentMonth, today]);

  // Tasks for the rest of current month (due after today)
  const laterInMonthTasks = useMemo(() => {
    if (!isCurrentMonth) return [];
    return visibleTasks
      .filter((t) => {
        const freq = t.recurrence?.freq || 'none';
        if (freq === 'none') {
          return !isTaskCompleted(t) && t.dueDate > today && t.dueDate.slice(0, 7) === selectedMonth;
        }
        return t.dueDate > today && t.dueDate.slice(0, 7) === selectedMonth;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [visibleTasks, isCurrentMonth, selectedMonth, today]);

  // Tasks when viewing another month (non-current)
  const monthPendingTasks = useMemo(() => {
    if (isCurrentMonth) return [];
    return visibleTasks
      .filter((t) => {
        const freq = t.recurrence?.freq || 'none';
        if (freq === 'none') {
          return !isTaskCompleted(t) && (t.dueDate || '').slice(0, 7) === selectedMonth;
        }
        return (t.dueDate || '').slice(0, 7) === selectedMonth;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [visibleTasks, isCurrentMonth, selectedMonth]);

  // Tasks completed in the selected month
  const monthDoneTasks = useMemo(() => {
    return visibleTasks
      .filter((t) => {
        const freq = t.recurrence?.freq || 'none';
        if (freq === 'none') {
          return isTaskCompleted(t) && getTaskCompletionDate(t).slice(0, 7) === selectedMonth;
        }
        return isCurrentMonth && isTaskDoneForPeriod(t, today);
      })
      .sort((a, b) => getTaskCompletionDate(b).localeCompare(getTaskCompletionDate(a)));
  }, [visibleTasks, selectedMonth, isCurrentMonth, today]);

  // All completed tasks across all time
  const allCompletedTasks = useMemo(() => {
    return visibleTasks.filter((t) => isTaskCompleted(t));
  }, [visibleTasks]);

  // Count of completed tasks from past months (strictly before current month)
  const pastArchivedCount = useMemo(() => {
    return visibleTasks.filter((t) => isTaskCompleted(t) && getTaskCompletionDate(t).slice(0, 7) < currentMonthKey).length;
  }, [visibleTasks, currentMonthKey]);

  // Archive groups sorted descending by month
  const archiveGroups = useMemo(() => {
    const groups = {};
    allCompletedTasks.forEach((t) => {
      const m = getTaskCompletionDate(t).slice(0, 7);
      if (!groups[m]) groups[m] = [];
      groups[m].push(t);
    });
    Object.keys(groups).forEach((m) => {
      groups[m].sort((a, b) => getTaskCompletionDate(b).localeCompare(getTaskCompletionDate(a)));
    });
    const sortedKeys = Object.keys(groups).sort().reverse();
    return { groups, sortedKeys };
  }, [allCompletedTasks]);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => addMonthsStr(`${prev}-01`, -1).slice(0, 7));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonthsStr(`${prev}-01`, 1).slice(0, 7));
  };

  const selectedMonthLabel = formatMonthYear(selectedMonth);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            {showArchive ? (
              <>
                <Archive size={24} className="text-amber-400" />
                <span>Archiwum zadań</span>
              </>
            ) : (
              <span>Zadania</span>
            )}
          </h2>
          {showArchive && (
            <p className="text-xs text-stone-400 mt-0.5">
              Zrealizowane zadania z poprzednich miesięcy
            </p>
          )}
        </div>

        {showArchive ? (
          <button
            onClick={() => setShowArchive(false)}
            className="px-3 py-1.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <ChevronLeft size={14} /> Wróć do zadań
          </button>
        ) : (
          <button
            onClick={() => setShowArchive(true)}
            className="px-3 py-1.5 rounded-xl border border-stone-700 bg-stone-800/90 hover:bg-stone-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Przejdź do archiwum zrealizowanych zadań"
          >
            <Archive size={14} />
            <span>Archiwum</span>
            {pastArchivedCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {pastArchivedCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Family member filter */}
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

      {/* Main active tasks view vs Archive view */}
      {!showArchive ? (
        <>
          {/* Month Navigation Bar (bez kalendarza) */}
          <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800 rounded-2xl p-2 sm:px-3 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 sm:px-2.5 rounded-xl hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition flex items-center gap-1 text-xs font-semibold"
              title="Poprzedni miesiąc"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Poprzedni</span>
            </button>

            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'Fraunces' }} className="text-base sm:text-lg font-bold text-stone-100">
                {selectedMonthLabel}
              </span>
              {!isCurrentMonth && (
                <button
                  onClick={() => setSelectedMonth(currentMonthKey)}
                  className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold hover:bg-amber-500/30 transition flex items-center gap-1"
                  title="Wróć do bieżącego miesiąca"
                >
                  <RotateCcw size={10} /> Bieżący
                </button>
              )}
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 sm:px-2.5 rounded-xl hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition flex items-center gap-1 text-xs font-semibold"
              title="Następny miesiąc"
            >
              <span className="hidden sm:inline">Następny</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Sekcja 1: Do zrobienia dzisiaj (w dany dzień) */}
          {isCurrentMonth ? (
            <Section title={`Do zrobienia dzisiaj (${todayTasks.length})`}>
              {todayTasks.length === 0 ? (
                <div className="p-4 border border-stone-800/60 rounded-2xl bg-stone-900/30 flex items-center justify-center gap-2 text-stone-400 text-xs">
                  <CheckSquare size={16} className="text-emerald-400" />
                  <span>Wszystko na dzisiaj zrobione! 🎉</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((t) => (
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
          ) : null}

          {/* Sekcja 2: Do zrobienia jeszcze w tym miesiącu (lub w wybranym miesiącu) */}
          {isCurrentMonth ? (
            <Section title={`Do zrobienia jeszcze w tym miesiącu (${laterInMonthTasks.length})`}>
              {laterInMonthTasks.length === 0 ? (
                <div className="text-xs text-stone-500 italic p-3 text-center border border-stone-800/60 rounded-xl bg-stone-900/20">
                  Brak kolejnych zaplanowanych zadań w tym miesiącu.
                </div>
              ) : (
                <div className="space-y-2">
                  {laterInMonthTasks.map((t) => (
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
          ) : (
            <Section title={`Do zrobienia w tym miesiącu (${monthPendingTasks.length})`}>
              {monthPendingTasks.length === 0 ? (
                <EmptyState text={`Brak zaplanowanych zadań w: ${selectedMonthLabel}`} icon={CheckSquare} />
              ) : (
                <div className="space-y-2">
                  {monthPendingTasks.map((t) => (
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
          )}

          {/* Sekcja 3: Zrobione w tym miesiącu */}
          <Section title={`Zrobione w tym miesiącu (${monthDoneTasks.length})`}>
            {monthDoneTasks.length === 0 ? (
              <div className="text-xs text-stone-500 italic p-3 text-center border border-stone-800/60 rounded-xl bg-stone-900/20">
                Brak wykonanych zadań w {isCurrentMonth ? 'tym miesiącu' : selectedMonthLabel}.
              </div>
            ) : (
              <div className="space-y-2">
                {monthDoneTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    t={t}
                    people={data.people}
                    today={today}
                    onToggle={onToggleTask}
                    onDelete={onDeleteTask}
                    onOpen={onOpenTask}
                    completionDate={getTaskCompletionDate(t)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Sekcja 4: Archiwum zadań */}
          <Section title="Archiwum zadań">
            <div
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
              className="border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm hover:border-stone-600 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Archive size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-200">Archiwum zrealizowanych zadań</div>
                  <div className="text-xs text-stone-400">
                    {pastArchivedCount > 0
                      ? `${pastArchivedCount} ${
                          pastArchivedCount === 1 ? 'zadanie' : pastArchivedCount < 5 ? 'zadania' : 'zadań'
                        } z poprzednich miesięcy`
                      : 'Wszystkie ukończone zadania z historii'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowArchive(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shrink-0 transition flex items-center gap-1 shadow"
              >
                Otwórz →
              </button>
            </div>
          </Section>
        </>
      ) : (
        /* WIDOK ARCHIWUM */
        <div className="space-y-4">
          {/* Opcjonalny filtr miesięcy w archiwum */}
          {archiveGroups.sortedKeys.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setArchiveMonthFilter('all')}
                style={{
                  background: archiveMonthFilter === 'all' ? COLORS.surfaceHighlight : COLORS.surface,
                  borderColor: archiveMonthFilter === 'all' ? COLORS.accent : COLORS.border,
                  color: archiveMonthFilter === 'all' ? COLORS.accent : COLORS.inkSoft,
                }}
                className="px-3 py-1 rounded-full border font-medium shrink-0 transition"
              >
                Wszystkie miesiące ({allCompletedTasks.length})
              </button>
              {archiveGroups.sortedKeys.map((mKey) => (
                <button
                  key={mKey}
                  onClick={() => setArchiveMonthFilter(mKey)}
                  style={{
                    background: archiveMonthFilter === mKey ? COLORS.surfaceHighlight : COLORS.surface,
                    borderColor: archiveMonthFilter === mKey ? COLORS.accent : COLORS.border,
                    color: archiveMonthFilter === mKey ? COLORS.accent : COLORS.inkSoft,
                  }}
                  className="px-3 py-1 rounded-full border font-medium shrink-0 transition"
                >
                  {formatMonthYear(mKey)} ({archiveGroups.groups[mKey]?.length || 0})
                </button>
              ))}
            </div>
          )}

          {allCompletedTasks.length === 0 ? (
            <EmptyState text="Brak zrealizowanych zadań w archiwum" icon={Archive} />
          ) : (
            <div className="space-y-6">
              {archiveGroups.sortedKeys
                .filter((mKey) => archiveMonthFilter === 'all' || archiveMonthFilter === mKey)
                .map((mKey) => {
                  const tasksInGroup = archiveGroups.groups[mKey] || [];
                  if (tasksInGroup.length === 0) return null;

                  return (
                    <div key={mKey} className="space-y-2">
                      <div className="flex items-center justify-between px-1 pt-1 border-b border-stone-800 pb-1.5">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-amber-400" />
                          <h3 style={{ fontFamily: 'Fraunces' }} className="text-sm font-bold text-stone-200">
                            {formatMonthYear(mKey)}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono text-stone-400 bg-stone-800/80 px-2 py-0.5 rounded-full border border-stone-700/50">
                          {tasksInGroup.length}{' '}
                          {tasksInGroup.length === 1 ? 'zadanie' : tasksInGroup.length < 5 ? 'zadania' : 'zadań'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {tasksInGroup.map((t) => (
                          <TaskRow
                            key={t.id}
                            t={t}
                            people={data.people}
                            today={today}
                            onToggle={onToggleTask}
                            onDelete={onDeleteTask}
                            onOpen={onOpenTask}
                            isArchived
                            completionDate={getTaskCompletionDate(t)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
