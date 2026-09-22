const CACHE_NAME = 'neak-zong-v3.0.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Do NOT cache API requests, video uploads or exports
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/exports/')) {
    return;
  }

  // Network-First: Always fetch fresh assets from server so code updates apply immediately!
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('/')))
  );
});
