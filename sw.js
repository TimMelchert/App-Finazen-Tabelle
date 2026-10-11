// Finanz-Manager Service Worker
// Bei jeder größeren Änderung an den Dateien die Zahl in CACHE_NAME erhöhen.
const CACHE_NAME = 'finanz-v3';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json', './icon.png'];

self.addEventListener('install', (e) => {
  // Jede Datei einzeln ablegen: fehlt eine (z. B. das Icon), bricht nicht alles ab
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((a) => cache.add(a).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Netz zuerst, Cache nur wenn offline.
// Anfragen an das Google-Script (POST) laufen nie über den Cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
