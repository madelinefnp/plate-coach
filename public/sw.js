// Service worker: makes the app installable and keeps the app shell available offline.
// It never caches API responses (personal data stays fresh and isn't stored by the worker).
const CACHE = 'bp-shell-v1';
const SHELL = ['/css/site.css', '/css/app.css', '/js/app.js', '/js/icons.js', '/js/consent.js', '/js/http.js', '/img/icon.svg', '/img/icon-192.png',
  '/fonts/anton-latin-400-normal.woff2', '/fonts/figtree-latin-500-normal.woff2', '/fonts/figtree-latin-700-normal.woff2', '/fonts/figtree-latin-800-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (SHELL.includes(url.pathname)) {
    // stale-while-revalidate for static files
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  } else if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:32px;background:#f7f3ee;color:#1c2240"><h1>You’re offline</h1><p>Better Plate needs a connection to load your data. Try again when you’re back online.</p></body>', { headers: { 'Content-Type': 'text/html' } })));
  }
});
