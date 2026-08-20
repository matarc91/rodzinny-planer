import { Chip } from './Chip.jsx';
import { COLORS } from '../../utils/constants.js';

export function PersonPicker({ people, selected = [], onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const isOn = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            style={{
              background: isOn ? p.color : COLORS.surfaceHighlight,
              borderColor: p.color,
              color: isOn ? '#fff' : p.color,
            }}
            className="px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Chip person={p} size="sm" />
            <span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
