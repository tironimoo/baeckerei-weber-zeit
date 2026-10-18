// Speichert nur die App-Dateien, damit sie schnell startet. Daten kommen immer frisch vom Server
// (Stempelzeiten brauchen die Serverzeit), nichts Persönliches landet im Cache.
const CACHE = 'bwz-__BUILD__';
const SHELL = ['./', 'index.html', 'app.js?v=__BUILD__', 'app.css?v=__BUILD__', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'fonts/figtree-latin-400-normal.woff2', 'fonts/figtree-latin-600-normal.woff2', 'fonts/figtree-latin-700-normal.woff2', 'fonts/young-serif-latin-400-normal.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase und alles andere: direkt ins Netz
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then((hit) => hit || fetch(e.request).catch(() => caches.match('index.html'))));
});
