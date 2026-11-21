import { addLog } from './logger.js';
import { apiClient } from './api.js';

// Domyślny publiczny klucz VAPID (fallback jeśli serwer nie jest dostępny)
export const DEFAULT_VAPID_PUBLIC_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
  'BO8-dI3zfjiVL76KjpiwgQYNLvDKGqrPyrWUV4RotrVqMPZsHBaegbv-9vxlKHalZmPTYTl2yd17kxPJdauIjI8';

/**
 * Pobiera publiczny klucz VAPID z serwera cosmere (lub zwraca domyślny)
 */
export async function getVapidPublicKey() {
  try {
    const key = await apiClient.push.getVapidPublicKey();
    if (key) return key;
  } catch (err) {
    addLog('warn', `Nie udało się pobrać VAPID z API, użyto fallback: ${err.message}`);
  }
  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Konwertuje klucz publiczny base64url do Uint8Array dla PushManager.subscribe
 */
export function urlBase64ToUint8Array(base64String) {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    addLog('error', `Błąd parsowania klucza VAPID: ${e.message}`);
    return new Uint8Array(65);
  }
}

/**
 * Zwraca aktualny stan uprawnień do powiadomień w przeglądarce i systemie operacyjnym
 */
export async function getNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  if (typeof Notification !== 'undefined' && 'permission' in Notification) {
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'notifications' });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
      if (status.state === 'prompt') return 'default';
    } catch {}
  }

  if (typeof Notification !== 'undefined' && 'permission' in Notification) {
    return Notification.permission;
  }

  return 'unsupported';
}

/**
 * Bezpiecznie prosi o uprawnienia systemowe do powiadomień
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    addLog('info', 'Wywołanie systemowego okna zapytania o uprawnienia powiadomień...');

    let resolvedPerm = null;
    const requestPromise = Notification.requestPermission((callbackResult) => {
      resolvedPerm = callbackResult;
    });

    if (requestPromise && typeof requestPromise.then === 'function') {
      const awaited = await requestPromise;
      const finalPerm = awaited || resolvedPerm || Notification.permission;
      addLog('info', `Użytkownik odpowiedział na prośbę o powiadomienia: ${finalPerm}`);
      return finalPerm;
    }

    const fallbackPerm = resolvedPerm || Notification.permission;
    addLog('info', `Odpowiedź na zapytanie o powiadomienia (callback): ${fallbackPerm}`);
    return fallbackPerm;
  } catch (err) {
    addLog('warn', `Błąd Notification.requestPermission: ${err?.message || err}`);
    return Notification.permission || 'default';
  }
}

/**
 * Rejestruje lub zwraca aktywną rejestrację Service Workera
 */
export async function getOrRegisterServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Twoja przeglądarka nie obsługuje Service Workerów.');
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      addLog('info', 'Rejestrowanie Service Workera /sw.js...');
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      addLog('success', 'Service Worker zarejestrowany pomyślnie!', { scope: reg.scope });
    }

    if (navigator.serviceWorker.ready) {
      const readyReg = await navigator.serviceWorker.ready;
      return readyReg || reg;
    }
    return reg;
  } catch (err) {
    addLog('warn', `Błąd rejestracji Service Workera (/sw.js): ${err.message}`);
    throw err;
  }
}

/**
 * Sprawdza, czy to urządzenie ma już aktywną subskrypcję Push w przeglądarce
 */
export async function checkPushSubscription() {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return { supported: false, subscribed: false, subscription: null };
    }
    const reg = await getOrRegisterServiceWorker().catch(() => null);
    if (!reg || !reg.pushManager) {
      return { supported: false, subscribed: false, subscription: null };
    }

    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      subscribed: !!sub,
      subscription: sub,
    };
  } catch (e) {
    addLog('warn', `Błąd sprawdzania subskrypcji push: ${e.message}`);
    return { supported: false, subscribed: false, subscription: null };
  }
}

/**
 * Zapisuje subskrypcję w przeglądarce i wysyła token do backendu na cosmere
 */
export async function subscribeToPushNotifications(supabaseOrApi, user, familyId) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notification API nie jest dostępne w tej przeglądarce.');
  }

  addLog('info', 'Rozpoczęcie procedury włączania powiadomień Web Push w tle...');

  // 1. Uprawnienia systemowe
  let permission = await getNotificationPermission();
  if (permission !== 'granted') {
    permission = await requestNotificationPermission();
  }
  addLog('info', `Status uprawnień systemowych: ${permission}`);

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Zgoda na powiadomienia została zablokowana w systemie lub przeglądarce. Zezwól na powiadomienia w ustawieniach witryny.'
        : 'Wymagana jest akceptacja uprawnień do powiadomień w oknie dialogowym.'
    );
  }

  // 2. Uzyskanie aktywnego Service Workera
  const reg = await getOrRegisterServiceWorker();
  if (!reg.pushManager) {
    throw new Error('PushManager nie jest dostępny w Twojej przeglądarce.');
  }

  // 3. Pobranie klucza VAPID
  const vapidKeyStr = await getVapidPublicKey();

  // 4. Utworzenie subskrypcji w PushManager
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    addLog('info', 'Tworzenie nowej subskrypcji Web Push w PushManager...');
    try {
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyStr);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.length > 0 ? applicationServerKey : undefined,
      });
      addLog('success', 'Utworzono subskrypcję Web Push w przeglądarce!');
    } catch (subErr) {
      addLog('warn', `Próba subskrypcji z kluczem VAPID: ${subErr.message}. Próba alternatywna...`);
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
      } catch (fallbackErr) {
        addLog('error', `Błąd PushManager.subscribe: ${fallbackErr.message}`);
        throw new Error(`Nie udało się utworzyć subskrypcji Push w urządzeniu: ${fallbackErr.message}`);
      }
    }
  }

  // 5. Zapisanie tokenu subskrypcji w backendzie na serwerze cosmere
  try {
    const client = supabaseOrApi || apiClient;
    await client.push.subscribe(sub);
    addLog('success', 'Token Web Push pomyślnie zarejestrowany na serwerze cosmere!');
  } catch (err) {
    addLog('warn', `Błąd zapisu subskrypcji na serwerze: ${err.message}`);
  }

  // 6. Powiadomienie powitalne potwierdzające
  try {
    if (Notification.permission === 'granted' && reg.showNotification) {
      await reg.showNotification('Rodzinny Planer 🔔', {
        body: 'Powiadomienia w tle zostały pomyślnie aktywowane!',
        icon: '/favicon.svg',
        badge: '/badge-72.png',
        tag: 'rodzinny-planer-welcome',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: '/?tab=settings' },
      });
    }
  } catch (notifErr) {
    console.warn('Błąd powiadomienia powitalnego:', notifErr);
  }

  return sub;
}

/**
 * Odłącza subskrypcję Web Push z tego urządzenia
 */
export async function unsubscribeFromPushNotifications(supabaseOrApi) {
  try {
    const reg = await getOrRegisterServiceWorker().catch(() => null);
    if (reg && reg.pushManager) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        addLog('info', 'Subskrypcja została anulowana w przeglądarce.');

        const client = supabaseOrApi || apiClient;
        await client.push.unsubscribe(endpoint).catch(() => {});
        addLog('info', 'Subskrypcja usunięta z serwera cosmere.');
      }
    }
    return true;
  } catch (e) {
    addLog('error', `Błąd podczas anulowania subskrypcji: ${e.message}`);
    return false;
  }
}

/**
 * Wysyła powiadomienie Push do członków rodziny przez serwer cosmere
 */
export async function recordFamilyNotification(
  supabaseOrApi,
  { familyId, userId, targetPersonIds = null, title, body, type = 'info', url = '/', tag = null }
) {
  if (!familyId) return;

  try {
    const client = supabaseOrApi || apiClient;
    const targetUrl = url && url !== '/' ? url : `/?tab=${type === 'calendar' ? 'calendar' : type === 'tasks' ? 'tasks' : type === 'wall' ? 'wall' : type === 'shopping' ? 'shopping' : 'today'}`;

    await client.push.send({
      familyId,
      title,
      body: body || '',
      url: targetUrl,
    });
    addLog('info', `Wysłano Web Push przez serwer cosmere: "${title}"`);
  } catch (err) {
    addLog('warn', `Błąd wysyłania powiadomienia rodziny: ${err.message}`);
  }
}

/**
 * Bezpośrednie wyświetlenie lokalnego powiadomienia systemowego (działa offline!)
 * z obsługą przekierowania po kliknięciu
 */
export async function sendSystemNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const targetTab = options.tab || 'today';
  const targetUrl = options.url || `/?tab=${targetTab}`;

  try {
    const reg = await getOrRegisterServiceWorker().catch(() => null);
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body: options.body || '',
        icon: options.icon || '/favicon.svg',
        badge: options.badge || '/badge-72.png',
        tag: options.tag || `local_${Date.now()}`,
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          url: targetUrl,
          tab: targetTab,
          dateOfArrival: Date.now(),
        },
        actions: [
          { action: 'open', title: 'Otwórz' },
          { action: 'dismiss', title: 'Zamknij' },
        ],
      });
      return true;
    }
  } catch (err) {
    console.warn('Błąd wyświetlania lokalnego powiadomienia:', err);
  }
  return false;
}
