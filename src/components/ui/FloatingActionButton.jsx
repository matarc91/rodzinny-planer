import { useState } from 'react';
import { Plus, X, Calendar, CheckSquare, StickyNote, MessageSquare, PiggyBank } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function FloatingActionButton({
  currentTab,
  settings = {},
  onAddEvent,
  onAddTask,
  onAddNote,
  onAddWall,
  onAddBudget,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [prevTab, setPrevTab] = useState(currentTab);

  // Zresetuj stan otwarcia menu po zmianie zakładki bez wywoływania efektu w pętli
  if (prevTab !== currentTab) {
    setPrevTab(currentTab);
    setIsOpen(false);
  }

  // Ukryj przycisk w ustawieniach i posiłkach
  if (currentTab === 'settings' || currentTab === 'meals') {
    return null;
  }

  const isTodayTab = currentTab === 'today';

  const handleClick = () => {
    if (isTodayTab) {
      setIsOpen((prev) => !prev);
      return;
    }

    // Bezpośrednie akcje dla konkretnych modułów
    if (currentTab === 'calendar') {
      onAddEvent?.();
    } else if (currentTab === 'tasks') {
      onAddTask?.();
    } else if (currentTab === 'notes') {
      onAddNote?.();
    } else if (currentTab === 'wall') {
      onAddWall?.();
    } else if (currentTab === 'budget') {
      onAddBudget?.();
    }
  };

  const handleAction = (callback) => {
    setIsOpen(false);
    callback?.();
  };

  // Opcje dla szybkiego menu w widoku "Dziś"
  const quickActions = [
    {
      id: 'task',
      label: 'Zadanie',
      icon: CheckSquare,
      color: '#10B981',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      action: () => handleAction(onAddTask),
      show: true,
    },
    {
      id: 'event',
      label: 'Wydarzenie',
      icon: Calendar,
      color: '#38BDF8',
      bgColor: 'bg-sky-500/15',
      borderColor: 'border-sky-500/30',
      textColor: 'text-sky-400',
      action: () => handleAction(onAddEvent),
      show: true,
    },
    {
      id: 'note',
      label: 'Notatka',
      icon: StickyNote,
      color: '#F59E0B',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      action: () => handleAction(onAddNote),
      show: true,
    },
    {
      id: 'wall',
      label: 'Wiadomość na tablicy',
      icon: MessageSquare,
      color: '#A855F7',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
      action: () => handleAction(onAddWall),
      show: Boolean(settings?.enableWall),
    },
    {
      id: 'budget',
      label: 'Wpis do budżetu',
      icon: PiggyBank,
      color: '#34D399',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-300',
      action: () => handleAction(onAddBudget),
      show: settings?.enableBudget !== false,
    },
  ].filter((item) => item.show);

  return (
    <>
      {/* Tło przy otwartym menu w widoku "Dziś" */}
      {isTodayTab && isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
        />
      )}

      <div className="fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col items-end pointer-events-none">
        {/* Szybkie menu dodawania w "Dziś" */}
        {isTodayTab && isOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-3 pointer-events-auto animate-slideUp">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  style={{ background: COLORS.surface }}
                  className="flex items-center gap-3 pl-3.5 pr-2.5 py-2 rounded-2xl border border-stone-700/70 shadow-xl hover:scale-105 active:scale-95 transition-all group cursor-pointer"
                >
                  <span className="text-xs font-bold text-stone-200 group-hover:text-amber-300 transition whitespace-nowrap">
                    {item.label}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.bgColor} ${item.borderColor} ${item.textColor} shadow-xs`}
                  >
                    <Icon size={18} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Główny pływający przycisk FAB */}
        <button
          type="button"
          onClick={handleClick}
          aria-label="Dodaj"
          style={{
            background: isTodayTab && isOpen ? '#27272A' : COLORS.accent,
            color: isTodayTab && isOpen ? '#F4F4F5' : '#121214',
            borderColor: isTodayTab && isOpen ? '#3F3F46' : 'rgba(252, 211, 77, 0.4)',
          }}
          className={`w-14 h-14 rounded-full border-2 shadow-2xl flex items-center justify-center transition-all duration-200 pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 ${
            isTodayTab && isOpen ? 'shadow-black/50 rotate-90' : 'shadow-amber-500/20'
          }`}
        >
          {isTodayTab && isOpen ? (
            <X size={24} strokeWidth={2.5} />
          ) : (
            <Plus size={28} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </>
  );
}
