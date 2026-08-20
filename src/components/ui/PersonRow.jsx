import { Chip } from './Chip.jsx';

export function PersonRow({ people, personIds }) {
  const selected = (people || []).filter((p) => personIds?.includes(p.id));
  if (selected.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {selected.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1.5 bg-stone-800/80 rounded-full pr-2.5 pb-0.5 pt-0.5 pl-0.5 border border-stone-700/50"
        >
          <Chip person={p} size="sm" />
          <span className="text-[10px] font-semibold text-stone-300 leading-none">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
