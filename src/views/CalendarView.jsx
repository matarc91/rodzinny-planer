import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react';
import { COLORS, MONTHS, WEEKDAYS } from '../utils/constants.js';
import {
  todayStr,
  parseDate,
  addMonthsStr,
  weekdayIdx,
  dayOfMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  occursOnDate,
  getEventBadgeBackground,
} from '../utils/dateUtils.js';
import { Chip } from '../components/ui/Chip.jsx';
import { PersonRow } from '../components/ui/PersonRow.jsx';
import { Section } from '../components/ui/Section.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export function CalendarView({ data, onOpenAdd, onOpenEvent }) {
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

    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((d) => format(d, 'yyyy-MM-dd'));
    const cellList = Array(startOffset).fill(null).concat(monthDays);

    return { year: yr, month: mth, cells: cellList };
  }, [monthAnchor]);

  const eventsByDate = useMemo(() => {
    const map = {};
    const visibleDates = cells.filter(Boolean);
    if (visibleDates.length === 0) return map;

    const filteredEvents = (data.events || []).filter(
      (ev) => personFilter === 'all' || ev.personIds?.includes(personFilter)
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
        <button onClick={() => setMonthAnchor(addMonthsStr(monthAnchor, -1))} className="p-2 rounded-xl hover:bg-stone-800">
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-xl font-bold capitalize text-stone-100">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={() => setMonthAnchor(addMonthsStr(monthAnchor, 1))} className="p-2 rounded-xl hover:bg-stone-800">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar">
        <button
          onClick={() => setPersonFilter('all')}
          style={{
            background: personFilter === 'all' ? COLORS.accent : COLORS.surface,
            color: personFilter === 'all' ? '#121214' : COLORS.ink,
            borderColor: COLORS.border,
          }}
          className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0"
        >
          Wszyscy
        </button>
        {data.people.map((p) => (
          <button
            key={p.id}
            onClick={() => setPersonFilter(p.id)}
            style={{
              background: personFilter === p.id ? p.color : COLORS.surface,
              color: personFilter === p.id ? '#fff' : p.color,
              borderColor: p.color,
            }}
            className="px-3 py-1 rounded-full border text-xs font-semibold shrink-0 flex items-center gap-1"
          >
            <Chip person={p} size="sm" /> {p.name}
          </button>
        ))}
      </div>

      <div className="border rounded-2xl p-3 shadow-xs bg-[#1E1E22] border-[#33333C]">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[10px] uppercase font-bold tracking-wider text-stone-500">
              {w}
            </div>
          ))}
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
                  borderColor: isToday && !isSelected ? COLORS.accent : 'transparent',
                }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-between p-1 relative text-xs border overflow-hidden ${
                  isSelected ? 'shadow-md font-bold' : ''
                }`}
              >
                <span className={`font-semibold z-10 ${isToday ? 'underline font-bold' : ''}`}>
                  {dayOfMonth(dateStr)}
                </span>

                {evs.length > 0 && (
                  <div className="w-full flex flex-col gap-0.5 mt-auto pt-0.5 z-0">
                    {evs.slice(0, 3).map((ev) => {
                      const isMultiDay =
                        (!ev.recurrence?.freq || ev.recurrence.freq === 'none') &&
                        Boolean(ev.endDate) &&
                        ev.endDate > ev.date;
                      const bg = getEventBadgeBackground(ev, data.people, isSelected);

                      if (!isMultiDay) {
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

      <Section
        title={parseDate(selectedDay).toLocaleDateString('pl-PL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        action={
          <button
            onClick={() => onOpenAdd(selectedDay)}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} /> Dodaj
          </button>
        }
      >
        {dayEvents.length === 0 ? (
          <EmptyState text="Brak wydarzeń w tym dniu" />
        ) : (
          <div className="space-y-2">
            {dayEvents
              .slice()
              .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
              .map((ev) => {
                const isMultiDay =
                  (!ev.recurrence?.freq || ev.recurrence.freq === 'none') && ev.endDate && ev.endDate > ev.date;
                return (
                  <div
                    key={ev.id}
                    onClick={() => onOpenEvent(ev, selectedDay)}
                    className="w-full border rounded-2xl p-3.5 text-left bg-[#1E1E22] border-[#33333C] cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {ev.time ? (
                        <span
                          style={{ color: COLORS.accent, background: '#2B261D' }}
                          className="text-xs px-2 py-0.5 rounded-md font-semibold font-mono"
                        >
                          {ev.time}
                        </span>
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
