import { COLORS, RECURRENCE_LABELS } from '../../utils/constants.js';

export function RecurrencePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(RECURRENCE_LABELS).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          style={{
            background: value === k ? COLORS.accent : COLORS.surfaceHighlight,
            borderColor: value === k ? COLORS.accent : COLORS.border,
            color: value === k ? '#121214' : COLORS.ink,
          }}
          className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
