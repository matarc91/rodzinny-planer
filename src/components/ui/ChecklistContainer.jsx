import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function ChecklistContainer({ items = [], onToggleItem, onAddItem, onRemoveItem }) {
  const [newText, setNewText] = useState('');
  const handleAdd = () => {
    if (!newText.trim()) return;
    onAddItem(newText.trim());
    setNewText('');
  };

  return (
    <div className="space-y-2 mt-2">
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 bg-stone-800/60 p-2 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => onToggleItem(item.id)}
                style={{
                  borderColor: item.done ? COLORS.success : COLORS.border,
                  background: item.done ? COLORS.success : 'transparent',
                }}
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
              >
                {item.done && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? 'line-through text-stone-500' : 'text-stone-200'}`}>
                {item.text}
              </span>
              {onRemoveItem && (
                <button type="button" onClick={() => onRemoveItem(item.id)} className="text-stone-500 hover:text-red-400 p-1">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {onAddItem && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Dodaj pozycję..."
            style={{ borderColor: COLORS.border, background: COLORS.surfaceHighlight, color: COLORS.ink }}
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="rounded-xl w-9 h-9 flex items-center justify-center font-bold shrink-0 hover:opacity-90"
          >
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
