import { addLog } from './logger.js';

// Domyślny publiczny klucz VAPID (używany do autoryzacji subskrypcji Web Push w przeglądarce)
// P-256 (NIST prime256v1) format uncompressed EC point
export const DEFAULT_VAPID_PUBLIC_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
  'BO8-dI3zfjiVL76KjpiwgQYNLvDKGqrPyrWUV4RotrVqMPZsHBaegbv-9vxlKHalZmPTYTl2yd17kxPJdauIjI8';

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

  // 1. Sprawdzenie Notification.permission (standard Web API)
  if (typeof Notification !== 'undefined' && 'permission' in Notification) {
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
  }

  // 2. Sprawdzenie Permissions API (nowoczesne przeglądarki i Android Chrome/WebView)
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'notifications' });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
      if (status.state === 'prompt') return 'default';
    } catch {
      // Ignorujemy błędy query w niektórych wersjach przeglądarek
    }
  }

  if (typeof Notification !== 'undefined' && 'permission' in Notification) {
    return Notification.permission;
  }

  return 'unsupported';
}

/**
 * Bezpiecznie prosi o uprawnienia systemowe (kompatybilne z Androidem, WebView, PWA i starszymi przeglądarkami)
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    // Jeśli już mamy zgodę, zwróć natychmiast
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    addLog('info', 'Wywołanie systemowego okna zapytania o uprawnienia powiadomień...');

    // Obsługa zarówno Promise jak i Callback w różnych wersjach silnika Chromium/Android
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
 * Zapisuje subskrypcję w przeglądarce i wysyła token do bazy Supabase
 */
export async function subscribeToPushNotifications(supabase, user, familyId) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notification API nie jest dostępne w tej przeglądarce.');
  }

  addLog('info', 'Rozpoczęcie procedury włączania powiadomień Web Push w tle...');

  // 1. Prośba o uprawnienia systemowe (musi być na samym początku w odpowiedzi na gest użytkownika)
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

  // 3. Sprawdzenie istniejącej subskrypcji lub utworzenie nowej
  let sub = await reg.pushManager.getSubscription();
  
  if (!sub) {
    addLog('info', 'Tworzenie nowej subskrypcji Web Push w PushManager...');
    try {
      const applicationServerKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.length > 0 ? applicationServerKey : undefined,
      });
      addLog('success', 'Utworzono subskrypcję Web Push w przeglądarce!');
    } catch (subErr) {
      addLog('warn', `Próba subskrypcji z kluczem VAPID zwróciła błąd: ${subErr.message}. Próba alternatywna...`);
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
        });
      } catch (fallbackErr) {
        addLog('error', `Błąd PushManager.subscribe: ${fallbackErr.message}`);
        throw new Error(`Nie udało się utworzyć subskrypcji Push w urządzeniu: ${fallbackErr.message}`, { cause: fallbackErr });
      }
    }
  }

  const subJson = sub.toJSON ? sub.toJSON() : {};
  const endpoint = sub.endpoint || subJson.endpoint;
  const p256dh = subJson.keys?.p256dh || '';
  const auth = subJson.keys?.auth || '';

  addLog('info', 'Zapisywanie tokenu subskrypcji Push w bazie Supabase...');

  // 4. Zapisanie danych w tabeli push_subscriptions w Supabase
  if (supabase && user?.id) {
    try {
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          family_id: familyId || null,
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        addLog('warn', `Baza Supabase zwróciła błąd przy zapisie push_subscriptions: ${error.message}`);
      } else {
        addLog('success', 'Token Web Push pomyślnie zapisany w bazie Supabase!');
      }
    } catch (dbErr) {
      addLog('warn', `Wyjątek podczas zapisu do bazy: ${dbErr.message}`);
    }
  }

  // 5. Bezpieczne wyświetlenie powiadomienia potwierdzającego
  try {
    if (Notification.permission === 'granted' && reg.showNotification) {
      await reg.showNotification('Rodzinny Planer 🔔', {
        body: 'Powiadomienia w tle zostały pomyślnie aktywowane na tym urządzeniu!',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'rodzinny-planer-welcome',
        renotify: true,
        vibrate: [200, 100, 200],
      });
    }
  } catch (notifErr) {
    addLog('warn', `Nie udało się wyświetlić powiadomienia powitalnego: ${notifErr.message}`);
  }

  return sub;
}

/**
 * Odłącza subskrypcję Web Push z tego urządzenia
 */
export async function unsubscribeFromPushNotifications(supabase) {
  try {
    const reg = await getOrRegisterServiceWorker().catch(() => null);
    if (reg && reg.pushManager) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        addLog('info', 'Subskrypcja została anulowana lokalnie w przeglądarce.');

        if (supabase && endpoint) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
          addLog('info', 'Subskrypcja usunięta z bazy danych Supabase.');
        }
      }
    }
    return true;
  } catch (e) {
    addLog('error', `Błąd podczas anulowania subskrypcji: ${e.message}`);
    return false;
  }
}

/**
 * Bezpośrednio wywołuje Edge Function 'send-push' w chmurze Supabase
 * bez pośredniego zapisu do tabeli notifications (zapobiega dublowaniu przez Webhooki i gubieniu targetPersonIds)
 */
export async function recordFamilyNotification(supabase, { familyId, userId, targetPersonIds = null, title, body, type = 'info', url = '/', tag = null }) {
  if (!supabase || !familyId) return;

  try {
    const notificationTag = tag || `${type}_${Date.now()}`;

    // Jeśli skonfigurowana jest Edge Function 'send-push', wywołujemy ją bezpośrednio
    if (typeof supabase.functions?.invoke === 'function') {
      try {
        const { data, error } = await supabase.functions.invoke('send-push', {
          body: {
            family_id: familyId,
            user_id: userId || null, // ID autora akcji (wykluczany z powiadomień)
            target_person_ids: targetPersonIds,
            title,
            body,
            type,
            tag: notificationTag,
            url,
          },
        });

        if (error) {
          addLog('warn', `Edge Function send-push zwróciła błąd: ${error.message}`);
        } else {
          addLog('info', `Wysłano Web Push przez Edge Function: "${title}"`, data);
        }
      } catch (fnErr) {
        addLog('warn', `Błąd wywołania send-push: ${fnErr.message}`);
      }
    }
  } catch (err) {
    addLog('warn', `Błąd wysyłania powiadomienia rodziny: ${err.message}`);
  }
}
