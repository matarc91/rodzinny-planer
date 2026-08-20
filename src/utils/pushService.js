import {
  DEFAULT_VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
  getOrRegisterServiceWorker,
  checkPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  recordFamilyNotification,
} from '../pushManager.js';
import { addLog } from './logger.js';

export function getInitialSentReminders() {
  try {
    const raw = localStorage.getItem('rp_sent_reminders');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export async function sendSystemNotification(title, options = {}) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      const reg = await getOrRegisterServiceWorker().catch(() => null);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          ...options,
        });
      } else {
        new Notification(title, options);
      }
      return true;
    }
  } catch (err) {
    addLog('warn', `Błąd wyświetlania powiadomienia systemowego: ${err.message}`);
  }
  return false;
}

export {
  DEFAULT_VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
  getOrRegisterServiceWorker,
  checkPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  recordFamilyNotification,
};
