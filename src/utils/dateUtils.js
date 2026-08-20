import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  addMonths,
  getDay,
  getDate,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import { COLORS } from './constants.js';

export {
  format,
  parseISO,
  addDays,
  startOfWeek,
  addMonths,
  getDay,
  getDate,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
};

export const toDateStr = (d) => (d ? format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM-dd') : '');
export const todayStr = () => format(new Date(), 'yyyy-MM-dd');
export const parseDate = (s) => (s ? (typeof s === 'string' ? parseISO(s) : s) : new Date());
export const weekdayIdx = (dateStr) => (getDay(parseDate(dateStr)) + 6) % 7;
export const dayOfMonth = (dateStr) => getDate(parseDate(dateStr));
export const getMonday = (dateStr) =>
  format(startOfWeek(parseDate(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
export const addDaysStr = (dateStr, n) => format(addDays(parseDate(dateStr), n), 'yyyy-MM-dd');
export const addMonthsStr = (dateStr, n) => format(addMonths(parseDate(dateStr), n), 'yyyy-MM-dd');

export function occursOnDate(event, dateStr) {
  if (dateStr < event.date) return false;
  // Sprawdzenie czy pojedyncze wystąpienie nie zostało wykluczone z cyklu
  if (Array.isArray(event.excludedDates) && event.excludedDates.includes(dateStr)) {
    return false;
  }

  const freq = event.recurrence?.freq || 'none';
  if (freq === 'none') {
    if (event.endDate && event.endDate >= event.date) {
      return dateStr >= event.date && dateStr <= event.endDate;
    }
    return dateStr === event.date;
  }
  if (freq === 'daily') return true;
  if (freq === 'weekly') return weekdayIdx(dateStr) === weekdayIdx(event.date);
  if (freq === 'biweekly') {
    const d1 = parseDate(event.date);
    const d2 = parseDate(dateStr);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }
  if (freq === 'quadweekly') {
    const d1 = parseDate(event.date);
    const d2 = parseDate(dateStr);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 28 === 0;
  }
  // Wsteczna kompatybilność jeśli jakieś wcześniejsze zdarzenie miało monthly
  if (freq === 'monthly') return dayOfMonth(dateStr) === dayOfMonth(event.date);
  return false;
}

export function getEventBadgeBackground(ev, people, isSelected = false) {
  const pIds = ev.personIds || [];
  const assigned = pIds.map((id) => (people || []).find((p) => p.id === id)).filter(Boolean);

  if (assigned.length === 0) {
    return isSelected ? '#121214' : COLORS.inkSoft;
  }

  if (assigned.length === 1) {
    return assigned[0].color || COLORS.accent;
  }

  // Wieloosobowy event - płynny gradient z kolorów wszystkich przypisanych osób
  const colors = assigned.map((p) => p.color || COLORS.accent);
  if (colors.length === 2) {
    return `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  }

  const step = 100 / (colors.length - 1);
  const colorStops = colors.map((c, idx) => `${c} ${Math.round(idx * step)}%`).join(', ');
  return `linear-gradient(90deg, ${colorStops})`;
}

export function getPeriodKey(freq, dateStr) {
  if (freq === 'daily') return dateStr;
  if (freq === 'weekly') return getMonday(dateStr);
  if (freq === 'biweekly') {
    const monday = parseDate(getMonday(dateStr));
    const biweekIdx = Math.floor(monday.getTime() / (1000 * 60 * 60 * 24 * 14));
    return `biweek_${biweekIdx}`;
  }
  if (freq === 'quadweekly') {
    const monday = parseDate(getMonday(dateStr));
    const quadweekIdx = Math.floor(monday.getTime() / (1000 * 60 * 60 * 24 * 28));
    return `quadweek_${quadweekIdx}`;
  }
  if (freq === 'monthly') return dateStr.slice(0, 7);
  return 'once';
}

export function isTaskDoneForPeriod(task, dateStr) {
  const freq = task.recurrence?.freq || 'none';
  return !!(task.completions && task.completions[getPeriodKey(freq, dateStr)]);
}
