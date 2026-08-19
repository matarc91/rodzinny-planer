// Service Worker dla powiadomień Push i PWA w Rodzinnym Planerze

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Obsługa przychodzących powiadomień Web Push z serwera / chmury
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // 1. BLOKOWANIE DUBLI: Sprawdzenie, czy aplikacja jest aktualnie aktywna na pierwszym planie
      // Jeśli użytkownik ma otwartą aplikację, frontend przez WebSocket/stan już wyświetlił powiadomienie
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isAppInForeground = clientList.some(client => client.visibilityState === 'visible');

      if (isAppInForeground) {
        // Aplikacja jest na pierwszym planie - wyciszamy powiadomienie Push, aby uniknąć duplikatu
        return;
      }

      // 2. Parsowanie właściwego payloadu z Edge Function
      let data = {
        title: 'Rodzinny Planer 🔔',
        body: 'Masz nowe powiadomienie od rodziny!',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        url: '/',
        tag: 'family_notification'
      };

      if (event.data) {
        try {
          const parsed = event.data.json();
          data = { ...data, ...parsed };
        } catch {
          const text = event.data.text();
          if (text) {
            data.body = text;
          }
        }
      }

      const options = {
        body: data.body,
        icon: data.icon || '/favicon.svg',
        badge: data.badge || '/favicon.svg',
        tag: data.tag || `notif_${Date.now()}`,
        renotify: false,
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

      return self.registration.showNotification(data.title, options);
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
