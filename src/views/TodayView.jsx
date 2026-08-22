import { Pin, AlertCircle, Utensils, Calendar, CheckSquare } from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { todayStr, occursOnDate, getMonday, weekdayIdx, isTaskDoneForPeriod } from '../utils/dateUtils.js';
import { Chip } from '../components/ui/Chip.jsx';
import { PersonRow } from '../components/ui/PersonRow.jsx';
import { Section } from '../components/ui/Section.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export function TodayView({ data, onOpenEvent, onOpenTask, onToggleTask }) {
  const today = todayStr();
  const events = data.events
    .filter((ev) => occursOnDate(ev, today))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const pendingTasks = data.tasks
    .filter((t) => {
      const f = t.recurrence?.freq || 'none';
      return f === 'none' ? t.dueDate === today : t.dueDate <= today || f !== 'none';
    })
    .filter((t) => !isTaskDoneForPeriod(t, today));
  const overdue = data.tasks.filter(
    (t) => (t.recurrence?.freq || 'none') === 'none' && t.dueDate < today && !isTaskDoneForPeriod(t, today)
  );
  const todayMeal = data.settings?.enableMeals
    ? data.meals?.[getMonday(today)]?.[weekdayIdx(today)] || null
    : null;
  const pinnedWall = data.settings?.enableWall ? (data.wall || []).filter((w) => w.isPinned) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <div className="text-xs uppercase tracking-wide text-stone-400 font-mono">
          {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold mt-0.5">
          Dziś w domu
        </h2>
      </div>

      {pinnedWall.length > 0 && (
        <div className="space-y-2">
          {pinnedWall.map((msg) => {
            const author = data.people.find((p) => p.id === msg.personId);
            return (
              <div
                key={msg.id}
                style={{ background: msg.color, borderColor: COLORS.accent }}
                className="border rounded-2xl p-3.5 shadow-md flex items-start gap-3"
              >
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
            {overdue.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenTask(t)}
                style={{ background: '#2C1B1B', borderColor: COLORS.warn }}
                className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs cursor-pointer"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(t);
                  }}
                  className="w-6 h-6 rounded-lg border-2 border-red-400/50 hover:border-success flex items-center justify-center shrink-0 mt-0.5 bg-red-950/20"
                />
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
          <div className="flex items-center gap-2 mb-2 font-bold text-sm text-amber-300">
            <Utensils size={16} /> Dzisiejsze menu
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {todayMeal.breakfast && (
              <div>
                <span className="font-semibold text-amber-400/80">Śniadanie:</span>{' '}
                <span className="text-stone-200">{todayMeal.breakfast}</span>
              </div>
            )}
            {todayMeal.lunch && (
              <div>
                <span className="font-semibold text-amber-400/80">Obiad:</span>{' '}
                <span className="text-amber-200 font-bold">{todayMeal.lunch}</span>
              </div>
            )}
            {todayMeal.dinner && (
              <div>
                <span className="font-semibold text-amber-400/80">Kolacja:</span>{' '}
                <span className="text-stone-200">{todayMeal.dinner}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Section title="Plan wydarzeń na dziś">
        {events.length === 0 ? (
          <EmptyState text="Brak wydarzeń na dziś" icon={Calendar} />
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const isMultiDay =
                (!ev.recurrence?.freq || ev.recurrence.freq === 'none') && ev.endDate && ev.endDate > ev.date;
              return (
                <div
                  key={ev.id}
                  onClick={() => onOpenEvent(ev, today)}
                  style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  className="w-full border rounded-2xl p-3.5 text-left shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {ev.time ? (
                      <span
                        style={{ fontFamily: 'IBM Plex Mono', color: COLORS.accent, background: '#2B261D' }}
                        className="text-xs px-2 py-0.5 rounded-md font-semibold shrink-0 font-mono"
                      >
                        {ev.time}
                      </span>
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
        {pendingTasks.length === 0 ? (
          <EmptyState text="Wszystkie dzisiejsze zadania ukończone! 🎉" icon={CheckSquare} />
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenTask(t)}
                style={{ background: COLORS.surface, borderColor: COLORS.border }}
                className="w-full border rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs cursor-pointer"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(t);
                  }}
                  className="w-6 h-6 rounded-lg border-2 border-stone-600 flex items-center justify-center shrink-0 mt-0.5 bg-stone-900/50"
                />
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
