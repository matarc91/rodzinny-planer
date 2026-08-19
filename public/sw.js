// Service Worker dla powiadomień Push i PWA w Rodzinnym Planerze

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Obsługa przychodzących powiadomień Web Push z serwera / chmury
self.addEventListener('push', (event) => {
  let data = {
    title: 'Rodzinny Planer 🔔',
    body: 'Masz nowe powiadomienie od rodziny!',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    url: '/',
    tag: 'family_notification_' + Date.now(),
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

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'rodzinny-planer-notif',
    renotify: false, // Aktualizuje istniejące powiadomienie o tym samym tagu bez ponownego uciążliwego spamu
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

  event.waitUntil(
    self.registration.showNotification(data.title, options)
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
