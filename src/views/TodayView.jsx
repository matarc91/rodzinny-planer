import { Pin, AlertCircle, ShoppingCart, Calendar, CheckSquare } from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { todayStr, occursOnDate, isTaskDoneForPeriod } from '../utils/dateUtils.js';
import { Chip } from '../components/ui/Chip.jsx';
import { PersonRow } from '../components/ui/PersonRow.jsx';
import { Section } from '../components/ui/Section.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { extractTextSummaryFromDoc } from '../utils/noteMigration.js';

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
  const pendingShopping = (data.shopping || []).filter((s) => !s.isCompleted);
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
                  <p className="text-sm font-medium text-stone-100 whitespace-pre-wrap">
                    {extractTextSummaryFromDoc(msg.text || msg.content)}
                  </p>
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

      {pendingShopping.length > 0 && (
        <div
          style={{ background: '#192820', borderColor: '#2E563E' }}
          className="border rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShoppingCart size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300">Lista zakupów</div>
              <div className="text-xs text-stone-300">
                {pendingShopping.length === 1
                  ? '1 rzecz do kupienia'
                  : `${pendingShopping.length} pozycji do kupienia`}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            {pendingShopping.slice(0, 2).map((s) => s.text).join(', ')}
            {pendingShopping.length > 2 && '...'}
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
                  {extractTextSummaryFromDoc(ev.note) ? (
                    <div className="text-xs mt-1.5 line-clamp-1 text-stone-400">
                      {extractTextSummaryFromDoc(ev.note)}
                    </div>
                  ) : null}
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
