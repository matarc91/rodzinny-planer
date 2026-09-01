import {
  ShoppingCart,
  MessageSquare,
  PiggyBank,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function MoreMenuSheet({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  settings = {},
  pendingShoppingCount = 0,
}) {
  if (!isOpen) return null;

  const modules = [
    {
      id: 'shopping',
      label: 'Lista Zakupów',
      desc: pendingShoppingCount > 0 ? `${pendingShoppingCount} do kupienia` : 'Wspólne zakupy w sklepie',
      icon: ShoppingCart,
      color: '#10B981',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      badge: pendingShoppingCount > 0 ? `${pendingShoppingCount}` : null,
      show: true,
    },
    {
      id: 'wall',
      label: 'Tablica (Lodówka)',
      desc: 'Wiadomości i notatki dla rodziny',
      icon: MessageSquare,
      color: '#A855F7',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
      show: Boolean(settings?.enableWall),
    },
    {
      id: 'budget',
      label: 'Budżet Domowy',
      desc: 'Koszty stałe, limity i oszczędności',
      icon: PiggyBank,
      color: '#F59E0B',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      show: settings?.enableBudget !== false,
    },
    {
      id: 'settings',
      label: 'Ustawienia i Profile',
      desc: 'Zarządzanie domownikami i powiadomieniami',
      icon: Settings,
      color: '#38BDF8',
      bgColor: 'bg-sky-500/15',
      borderColor: 'border-sky-500/30',
      textColor: 'text-sky-400',
      show: true,
    },
  ].filter((m) => m.show);

  const handleSelect = (tabId) => {
    onSelectTab(tabId);
    onClose();
  };

  return (
    <>
      {/* Tło przyciemniające */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs transition-opacity animate-fadeIn"
      />

      {/* Wysuwany arkusz (Bottom Sheet) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-[#1A1A1E] border-t border-stone-800 rounded-t-3xl shadow-2xl p-5 pb-8 animate-slideUp">
        {/* Uchwyt zamykania */}
        <div className="w-12 h-1.5 bg-stone-700/70 rounded-full mx-auto mb-4 cursor-pointer" onClick={onClose} />

        <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-lg font-bold">
              Więcej modułów
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {modules.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                style={{
                  background: isActive ? '#26262B' : '#141417',
                  borderColor: isActive ? COLORS.accent : '#2C2C34',
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3.5 transition group cursor-pointer ${
                  isActive ? 'ring-2 ring-amber-500/20 shadow-md' : 'hover:border-stone-600'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.bgColor} ${item.borderColor} ${item.textColor}`}
                >
                  <Icon size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-sm font-bold truncate ${
                        isActive ? 'text-amber-300' : 'text-stone-200 group-hover:text-stone-100'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 truncate mt-0.5">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default MoreMenuSheet;
