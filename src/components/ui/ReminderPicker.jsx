import { COLORS, REMINDER_OPTIONS } from '../../utils/constants.js';

export function ReminderPicker({ value, onChange }) {
  return (
    <select
      value={value === null ? 'null' : value}
      onChange={(e) => {
        const val = e.target.value === 'null' ? null : Number(e.target.value);
        onChange(val);
      }}
      style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }}
      className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none cursor-pointer"
    >
      {REMINDER_OPTIONS.map((opt) => (
        <option key={String(opt.hours)} value={opt.hours === null ? 'null' : opt.hours} className="bg-stone-900 text-stone-100">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
