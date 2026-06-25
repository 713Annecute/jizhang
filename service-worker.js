const CACHE_NAME = 'expense-tracker-pwa-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const OPTIONAL_CACHE = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => Promise.allSettled(OPTIONAL_CACHE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.method === 'GET') {
          return new Response(JSON.stringify({
            success: false,
            message: '当前处于离线状态，数据接口暂不可用'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        }
        return new Response(JSON.stringify({
          success: false,
          message: '当前处于离线状态，请联网后再操作'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then(response => response || caches.match('/offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/offline.html'));
    })
  );
});
