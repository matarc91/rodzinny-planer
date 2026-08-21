// Service Worker dla powiadomień Push i PWA w Rodzinnym Planerze

const NOTIF_CACHE_NAME = 'rp-shown-notifs-v1';
const STATIC_CACHE_NAME = 'rp-static-v1';

// Funkcja sprawdzająca czy dane powiadomienie było już wyświetlone (zapobiega powtórzeniom co 1 min)
async function isDuplicateNotification(tag) {
  if (!tag) return false;
  try {
    const cache = await caches.open(NOTIF_CACHE_NAME);
    const cachedResponse = await cache.match(`/notif-tag/${encodeURIComponent(tag)}`);
    if (cachedResponse) {
      const info = await cachedResponse.json();
      if (Date.now() - (info.timestamp || 0) < 12 * 60 * 60 * 1000) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[SW] Błąd sprawdzania cache powiadomień:', e);
  }
  return false;
}

// Funkcja zapisująca tag wyświetlonego powiadomienia w cache
async function recordShownNotification(tag) {
  if (!tag) return;
  try {
    const cache = await caches.open(NOTIF_CACHE_NAME);
    await cache.put(
      `/notif-tag/${encodeURIComponent(tag)}`,
      new Response(JSON.stringify({ timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (e) {
    console.warn('[SW] Błąd zapisu do cache powiadomień:', e);
  }
}

// Pliki podstawowe do pamięci podręcznej offline
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Błąd precache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== NOTIF_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia Network-First dla żądań HTTP (zgodność z PWABuilder)
self.addEventListener('fetch', (event) => {
  // Ignoruj żądania inne niż GET oraz zapytania do zewnętrznych API (np. Supabase)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback dla nawigacji
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Brak połączenia z siecią.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

// Obsługa przychodzących powiadomień Web Push z serwera / chmury
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Sprawdzamy czy którekolwiek okno aplikacji jest aktualnie otwarte i na pierwszym planie (focused)
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isAppFocused = windowClients.some((client) => client.focused);

      // Jeśli aplikacja jest otwarta na ekranie, interfejs wyświetla Toast
      if (isAppFocused) {
        return;
      }

      let data = {
        title: 'Rodzinny Planer 🔔',
        body: 'Masz nowe powiadomienie od rodziny!',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        url: '/',
        tag: 'rodzinny-planer-notif',
      };

      if (event.data) {
        try {
          const parsed = event.data.json();
          if (parsed) {
            data = { ...data, ...parsed };
          }
        } catch {
          const text = event.data.text();
          if (text) {
            data.body = text;
          }
        }
      }

      const notificationTag = data.tag || 'rodzinny-planer-notif';

      // 2. SPRAWDZENIE BLOKADY 1: Czy powiadomienie o tym tagu nadal wisi nieodczytane na pasku powiadomień?
      if (notificationTag && notificationTag !== 'rodzinny-planer-notif') {
        const activeList = await self.registration.getNotifications({ tag: notificationTag });
        if (activeList && activeList.length > 0) {
          // Powiadomienie jest już widoczne na ekranie użytkownika - nie wybudzamy urządzenia ponownie!
          return;
        }

        // 3. SPRAWDZENIE BLOKADY 2: Czy to powiadomienie było już wyświetlone w ciągu ostatnich 12 godzin?
        const isDuplicate = await isDuplicateNotification(notificationTag);
        if (isDuplicate) {
          // Powiadomienie zostało już wcześniej wyemitowane - nie powtarzamy!
          return;
        }
      }

      // 4. Zapisujemy w pamięci podręcznej Service Workera jako wyświetlone
      if (notificationTag && notificationTag !== 'rodzinny-planer-notif') {
        await recordShownNotification(notificationTag);
      }

      const options = {
        body: data.body,
        icon: data.icon || '/favicon.svg',
        badge: data.badge || '/favicon.svg',
        tag: notificationTag,
        renotify: false, // Blokuje ponowne dzwonienie/wibracje dla tego samego zdarzenia
        requireInteraction: false,
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/',
          dateOfArrival: Date.now(),
        },
        actions: [
          { action: 'open', title: 'Otwórz planer' },
          { action: 'dismiss', title: 'Zamknij' }
        ]
      };

      await self.registration.showNotification(data.title, options);
    })()
  );
});

// Obsługa kliknięcia w powiadomienie
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jeśli aplikacja jest już otwarta w którejś karcie/oknie, skupiamy się na niej
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // W przeciwnym razie otwieramy nowe okno aplikacji
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
