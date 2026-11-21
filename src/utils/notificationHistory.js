// Zarządzanie lokalną historią powiadomień (Centrum Powiadomień)
// Działa w 100% offline w oparciu o localStorage

const STORAGE_KEY = 'rp_notifications_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Pobiera listę powiadomień z localStorage
 * @returns {Array<{id: string, title: string, body: string, tab: string, timestamp: number, read: boolean}>}
 */
export function getNotificationHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Błąd odczytu historii powiadomień:', err);
    return [];
  }
}

/**
 * Dodaje powiadomienie do historii
 */
export function addNotificationHistoryItem({ title, body, tab = 'today' }) {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotificationHistory();
    const newItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      body: body || '',
      tab: tab || 'today',
      timestamp: Date.now(),
      read: false,
    };

    const updated = [newItem, ...current].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Rozgłoszenie zdarzenia dla reaktywnych komponentów UI
    window.dispatchEvent(new CustomEvent('rp-notifications-updated', { detail: updated }));
    return newItem;
  } catch (err) {
    console.warn('Błąd zapisu powiadomienia w historii:', err);
  }
}

/**
 * Oznacza konkretne powiadomienie jako przeczytane
 */
export function markNotificationAsRead(id) {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotificationHistory();
    const updated = current.map((item) => (item.id === id ? { ...item, read: true } : item));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('rp-notifications-updated', { detail: updated }));
  } catch (err) {
    console.warn('Błąd oznaczania powiadomienia:', err);
  }
}

/**
 * Oznacza wszystkie powiadomienia jako przeczytane
 */
export function markAllNotificationsAsRead() {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotificationHistory();
    const updated = current.map((item) => ({ ...item, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('rp-notifications-updated', { detail: updated }));
  } catch (err) {
    console.warn('Błąd oznaczania wszystkich powiadomień:', err);
  }
}

/**
 * Usuwa całą historię powiadomień
 */
export function clearNotificationHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('rp-notifications-updated', { detail: [] }));
  } catch (err) {
    console.warn('Błąd czyszczenia historii powiadomień:', err);
  }
}

/**
 * Zwraca liczbę nieprzeczytanych powiadomień
 */
export function getUnreadCount() {
  const list = getNotificationHistory();
  return list.filter((item) => !item.read).length;
}
