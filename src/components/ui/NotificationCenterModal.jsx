import { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Calendar,
  CheckSquare,
  MessageSquare,
  ShoppingCart,
  Wallet,
  Clock,
  ExternalLink
} from 'lucide-react';
import {
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotificationHistory,
} from '../../utils/notificationHistory.js';

const TAB_CONFIG = {
  tasks: { label: 'Zadania', icon: CheckSquare, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  calendar: { label: 'Kalendarz', icon: Calendar, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  wall: { label: 'Lodówka', icon: MessageSquare, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  shopping: { label: 'Zakupy', icon: ShoppingCart, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  budget: { label: 'Budżet', icon: Wallet, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  today: { label: 'Dziś', icon: Clock, color: 'text-stone-300 bg-stone-500/10 border-stone-500/20' },
  settings: { label: 'Ustawienia', icon: Bell, color: 'text-stone-400 bg-stone-500/10 border-stone-500/20' },
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Przed chwilą';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz. temu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function NotificationCenterModal({ isOpen, onClose, onSelectTab }) {
  const [notifications, setNotifications] = useState(getNotificationHistory());

  useEffect(() => {
    if (!isOpen) return;

    setNotifications(getNotificationHistory());

    const handleUpdate = (e) => {
      setNotifications(e.detail || getNotificationHistory());
    };

    window.addEventListener('rp-notifications-updated', handleUpdate);
    return () => window.removeEventListener('rp-notifications-updated', handleUpdate);
  }, [isOpen]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = (item) => {
    markNotificationAsRead(item.id);
    if (item.tab && onSelectTab) {
      onSelectTab(item.tab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#18181b] border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Nagłówek modala */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-800 bg-stone-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-100 text-sm">Powiadomienia</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {unreadCount} nowe
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">Historia ostatnich zdarzeń i przypomnień</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                title="Oznacz wszystkie jako przeczytane"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
              >
                <CheckCheck size={16} />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotificationHistory}
                title="Wyczyść historię powiadomień"
                className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Lista powiadomień */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-800/60 p-2 sm:p-3 space-y-1">
          {notifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-800/80 text-stone-500 flex items-center justify-center mx-auto mb-3">
                <Bell size={24} />
              </div>
              <p className="text-sm font-medium text-stone-300">Brak powiadomień</p>
              <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                Powiadomienia od innych domowników oraz przypomnienia o zbliżających się zadaniach pojawią się tutaj.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const tabConf = TAB_CONFIG[item.tab] || TAB_CONFIG.today;
              const TabIcon = tabConf.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`group flex items-start gap-3 p-3 rounded-xl transition cursor-pointer border ${
                    item.read
                      ? 'bg-transparent border-transparent hover:bg-stone-800/40 text-stone-300'
                      : 'bg-stone-800/50 border-amber-500/20 hover:bg-stone-800/70 text-stone-100 shadow-xs'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 border ${tabConf.color}`}>
                    <TabIcon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-xs truncate group-hover:text-amber-400 transition">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-stone-500 shrink-0">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    {item.body && (
                      <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed mb-1.5">
                        {item.body}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${tabConf.color}`}>
                        {tabConf.label}
                      </span>
                      <span className="text-[10px] text-stone-500 group-hover:text-amber-400/80 inline-flex items-center gap-0.5 transition">
                        Przejdź <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>

                  {!item.read && (
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5 shadow-xs shadow-amber-400/50" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
