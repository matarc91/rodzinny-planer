// Service Worker dla powiadomień Push i PWA w Rodzinnym Planerze

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Obsługa przychodzących powiadomień Push
self.addEventListener('push', (event) => {
  let data = { title: 'Rodzinny Planer', body: 'Masz nowe powiadomienie!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Nowe wydarzenie lub zadanie w planerze.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Otwórz planer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Rodzinny Planer', options)
  );
});

// Obsługa kliknięcia w powiadomienie
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
