if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
        return Promise.all(regs.map(function(r) { return r.unregister(); }));
    }).then(function() {
        navigator.serviceWorker.register('sw.js');
    });
}
