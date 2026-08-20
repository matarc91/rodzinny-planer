import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS, WEEKDAYS } from '../utils/constants.js';
import { todayStr, getMonday, addDaysStr, parseDate } from '../utils/dateUtils.js';

export function MealsView({ meals, onUpdateMeal }) {
  const [mondayAnchor, setMondayAnchor] = useState(getMonday(todayStr()));
  const days = Array(7)
    .fill(0)
    .map((_, i) => addDaysStr(mondayAnchor, i));
  const weekMeals = meals?.[mondayAnchor] || {};

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">
            Posiłki
          </h2>
          <p className="text-xs text-stone-400">Jadłospis</p>
        </div>
        <div className="flex items-center gap-2 border rounded-xl p-1 bg-[#1E1E22] border-[#33333C]">
          <button
            onClick={() => setMondayAnchor(addDaysStr(mondayAnchor, -7))}
            className="p-1 rounded-lg hover:bg-stone-800"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-mono font-semibold">
            {parseDate(mondayAnchor).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
          </span>
          <button
            onClick={() => setMondayAnchor(addDaysStr(mondayAnchor, 7))}
            className="p-1 rounded-lg hover:bg-stone-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {days.map((dateStr, idx) => {
          const isToday = dateStr === todayStr();
          const dm = weekMeals[idx] || {};
          return (
            <div
              key={dateStr}
              style={{
                background: isToday ? COLORS.accentSoft : COLORS.surface,
                borderColor: isToday ? COLORS.accent : COLORS.border,
              }}
              className="border rounded-2xl p-4 shadow-2xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase font-mono px-2 py-0.5 rounded ${
                      isToday ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {WEEKDAYS[idx]}
                  </span>
                  <span className="text-xs font-semibold text-stone-400">
                    {parseDate(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['breakfast', 'lunch', 'dinner'].map((type, i) => (
                  <div key={type}>
                    <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">
                      {['Śniadanie', 'Obiad', 'Kolacja'][i]}
                    </label>
                    <input
                      type="text"
                      value={dm[type] || ''}
                      onChange={(e) =>
                        onUpdateMeal(mondayAnchor, { ...weekMeals, [idx]: { ...dm, [type]: e.target.value } })
                      }
                      placeholder="np. Naleśniki"
                      className="w-full border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none bg-stone-900 text-stone-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
