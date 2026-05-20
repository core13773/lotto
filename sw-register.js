if ('serviceWorker' in navigator) {
    var FORCE_RELOAD = !sessionStorage.getItem('sw-cleared');
    caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
        return navigator.serviceWorker.getRegistrations();
    }).then(function(regs) {
        return Promise.all(regs.map(function(r) { return r.unregister(); }));
    }).then(function() {
        if (FORCE_RELOAD) {
            sessionStorage.setItem('sw-cleared', '1');
            window.location.reload();
        } else {
            sessionStorage.removeItem('sw-cleared');
            navigator.serviceWorker.register('sw.js');
        }
    });
}
