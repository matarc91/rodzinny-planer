import { X } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function ModalShell({ title, onClose, headerAction, maxWidth = 'sm:max-w-md', children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.surface }}
        className={`w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-all border border-stone-800`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-5 border-b sticky top-0 bg-stone-900/90 backdrop-blur z-10"
          style={{ borderColor: COLORS.border }}
        >
          <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-xl font-bold">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-stone-800 transition text-stone-400"
              aria-label="Zamknij"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

