import { Sparkles } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function EmptyState({ text, icon: Icon = Sparkles }) {
  return (
    <div
      style={{ color: COLORS.inkSoft, borderColor: COLORS.border }}
      className="text-sm border border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-stone-900/40"
    >
      <Icon size={24} className="opacity-40" />
      <span>{text}</span>
    </div>
  );
}
