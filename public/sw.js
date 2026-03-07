const CACHE_NAME = 'fahm-v1';

// À l'installation : on ne met en cache que la page offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add('/offline.html'))
  );
  self.skipWaiting();
});

// À l'activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : network-first, fallback offline.html pour les navigations
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les appels API/Supabase/Stripe
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('stripe.com')
  ) {
    return; // pas de cache pour les données financières
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache les assets statiques Next.js (_next/static)
        if (url.pathname.startsWith('/_next/static/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback : page offline pour les navigations, sinon erreur réseau
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('Network error', { status: 408 });
      })
  );
});
