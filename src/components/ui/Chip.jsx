import { COLORS } from '../../utils/constants.js';

export function Chip({ person, size = 'sm' }) {
  if (!person) return null;
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-sm';
  return (
    <span
      title={person.name}
      style={{ background: person.color || COLORS.accent, color: '#fff' }}
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 shadow-sm ${s}`}
    >
      {person.emoji || person.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
