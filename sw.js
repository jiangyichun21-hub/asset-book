const VERSION = 'assetbook-202608172005';
const ASSETS = ['./', './index.html', './styles.css', './core.js', './gist.js', './ui.js', './trades.js',
                './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
                './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const fresh = fetch(e.request).then(res => {
      if (res.ok) { const clone = res.clone(); caches.open(VERSION).then(c => c.put(e.request, clone)); }
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
