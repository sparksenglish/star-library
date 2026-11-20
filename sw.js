// STAR Library service worker. Scope: the folder it is served from (/star-library/ or /star-library/staging/).
// The app files are kept for offline start; the Apps Script API (another site) is never cached here.
const CACHE = 'starlib-production-dae6e4e';
const SHELL = ['./', 'index.html', 'config.js', 'css/app.css', 'css/viewer.css', 'js/api.js', 'js/app.js', 'js/viewer.js', 'js/more.js',
  'manifest.webmanifest', 'img/icon-192.png', 'img/favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('starlib-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Same-site files: try the network first (so updates show at once), fall back to the saved copy offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
