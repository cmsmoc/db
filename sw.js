/* ══════════════════════════════════════════════
   SE·CMS — Service Worker (Offline-First) v2
   Conselho Municipal de Saúde — Montes Claros
   
   CORREÇÕES v2:
   - Cache versionado: bump CACHE_VERSION para forçar update
   - localhost permitido para dev sem HTTPS
   - Estratégia de fetch mais robusta
══════════════════════════════════════════════ */

const CACHE_VERSION  = 'v2';
const STATIC_CACHE   = 'cms-static-'  + CACHE_VERSION;
const DYNAMIC_CACHE  = 'cms-dynamic-' + CACHE_VERSION;

/* Recursos estáticos para cache imediato */
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;900&family=Open+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Alguns assets falharam no cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpa caches antigos ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating v2...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  // Ignora requisições não-GET e chrome-extension
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);

  /* 1. GAS API — network only, sem cache */
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'Sem conexão. Dados locais em uso.' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  /* 2. Google Fonts e CDN — cache first */
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  /* 3. Favicons da biblioteca (Google S2) — network with cache fallback */
  if (url.hostname === 'www.google.com' && url.pathname.includes('favicons')) {
    event.respondWith(networkWithCacheFallback(event.request, DYNAMIC_CACHE));
    return;
  }

  /* 4. App shell local — cache first, atualizando em background */
  if (url.hostname === self.location.hostname || url.hostname === 'localhost') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  /* 5. Default — network with cache fallback */
  event.respondWith(networkWithCacheFallback(event.request, DYNAMIC_CACHE));
});

/* ══════════════════════════════════════════════
   ESTRATÉGIAS DE CACHE
══════════════════════════════════════════════ */

/** Cache first: serve do cache, busca na rede se não houver */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso indisponível offline.', { status: 503 });
  }
}

/** Stale-while-revalidate: serve do cache imediatamente e atualiza em background */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached); // se falhar, mantém o cached

  return cached || fetchPromise;
}

/** Network first com fallback para cache */
async function networkWithCacheFallback(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

/* ── BACKGROUND SYNC ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cms-data') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_REQUEST' }));
}

/* ── MESSAGES ── */
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});
