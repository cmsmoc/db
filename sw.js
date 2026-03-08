/* ══════════════════════════════════════════════
   SE·CMS — Service Worker (Offline-First)
   Conselho Municipal de Saúde — Montes Claros
══════════════════════════════════════════════ */

const CACHE_NAME    = 'cms-dashboard-v1';
const STATIC_CACHE  = 'cms-static-v1';
const DYNAMIC_CACHE = 'cms-dynamic-v1';

/* Recursos estáticos para cache imediato */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;900&family=Open+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH (offline-first strategy) ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* GAS API calls — network only, no cache */
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão. Dados locais em uso.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  /* Google Fonts & CDN — cache first */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  /* Favicons externos (biblioteca thumbnails) — network with cache fallback */
  if (url.hostname.includes('google.com') && url.pathname.includes('favicons')) {
    event.respondWith(networkWithCacheFallback(event.request));
    return;
  }

  /* App shell e recursos locais — cache first */
  if (url.hostname === self.location.hostname || url.protocol === 'chrome-extension:') {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  /* Default: network first */
  event.respondWith(networkWithCacheFallback(event.request));
});

/* ── STRATEGIES ── */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName || DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Recurso indisponível offline.', { status: 503 });
  }
}

async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

/* ── BACKGROUND SYNC (para push de dados ao GAS quando voltar online) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cms-data') {
    event.waitUntil(syncCMSData());
  }
});

async function syncCMSData() {
  console.log('[SW] Background sync triggered');
  // A lógica de sync é tratada pelo cliente (index.html) via pushToGAS()
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_REQUEST' }));
}

/* ── MESSAGES ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
  }
});
