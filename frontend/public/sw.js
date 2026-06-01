self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'Nouveau message', {
            body: data.body || '',
            icon: '/logo.png',
            badge: '/badge.png',
            data: { url: data.url },
        })
    );
});

/* global clients */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
