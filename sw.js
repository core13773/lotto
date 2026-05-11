const CACHE = 'lotto645-v2';
const FILES = ['./', './index.html', './style.css', './script.js', './worker.js', './manifest.json', './latest.json'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
    e.waitUntil(Promise.all([
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
        self.clients.claim()
    ]));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
            if (resp.ok) {
                const clone = resp.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return resp;
        }))
    );
});
