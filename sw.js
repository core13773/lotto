const CACHE = 'lotto645-v5';
const FILES = ['./', './index.html', './style.css?v=2', './analysis.js?v=3', './stats.js?v=3', './simulation.js?v=3', './ui.js?v=3', './features.js?v=3', './fun.js?v=1', './fun2.js?v=1', './script.js?v=3', './worker.js', './manifest.json', './icon-192.png', './icon-512.png', './latest.json'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {})
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // 네트워크 우선, 실패 시 캐시 폴백
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                if (resp.ok && resp.type === 'basic') {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
