const CACHE_NAME = 'uniagenda-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/site.webmanifest',
  '/maskable_icon_x48.png',
  '/maskable_icon_x72.png',
  '/maskable_icon_x96.png',
  '/maskable_icon_x128.png',
  '/maskable_icon_x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon.ico',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://em-content.zobj.net/source/animated-noto-color-emoji/427/graduation-cap_1f393.gif'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Ativação
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => 
      cached || fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      })
    )
  );
});

// =============================================
// NOTIFICAÇÕES
// =============================================

// Receber push notification do servidor
self.addEventListener('push', event => {
  console.log('Push recebido:', event);
  
  let data = {
    title: 'UniAgenda',
    body: 'Você tem um lembrete!',
    icon: '/maskable_icon_x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, data)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Verificar se já existe uma janela aberta
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Se não existir, abrir nova
        return clients.openWindow(urlToOpen);
      })
  );
});

// Notificação fechada sem clique
self.addEventListener('notificationclose', event => {
  console.log('Notificação fechada:', event.notification);
});