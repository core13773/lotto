const CACHE = 'lotto645-v11';
const FILES = [
    './', './index.html', './privacy.html', './robots.txt', './sitemap.xml',
    './style.css', './analysis.js', './stats.js', './simulation.js', './ui.js',
    './features.js', './fun.js', './fun2.js', './fun3.js', './games.js',
    './script.js', './worker.js', './sw-register.js',
    './manifest.json', './icon-192.png', './icon-512.png', './latest.json', './latest-brief.json'
];

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
    const url = new URL(e.request.url);
    // 쿼리스트링을 제외한 캐시 키 사용 (버전 파라미터 무시)
    const cacheKey = url.origin + url.pathname;

    // latest.json, latest-brief.json은 항상 네트워크 우선 (실시간 데이터)
    if (url.pathname.endsWith('/latest.json') || url.pathname.endsWith('/latest-brief.json')) {
        e.respondWith(
            fetch(e.request)
                .then(resp => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE).then(c => c.put(cacheKey, clone));
                    }
                    return resp;
                })
                .catch(() => caches.match(cacheKey))
        );
        return;
    }

    // 정적 자산: 캐시 우선, 캐시 미스 시 네트워크
    e.respondWith(
        caches.match(cacheKey).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(resp => {
                if (resp.ok && resp.type === 'basic') {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(cacheKey, clone));
                }
                return resp;
            });
        })
    );
});
