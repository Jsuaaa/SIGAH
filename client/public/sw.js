/* SIGAH Service Worker (escrito a mano, sin build step).
   - App shell (navegaciones): NetworkFirst con fallback a index.html cacheado → permite abrir la app sin conexión.
   - Assets estáticos (/assets, íconos): StaleWhileRevalidate.
   - API GET (/api/v1): NetworkFirst con fallback a la última respuesta cacheada.
   - Mutaciones (POST/PUT/DELETE): nunca se cachean; la cola Dexie del cliente las maneja offline.
*/
const VERSION = 'sigah-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const API_CACHE = `${VERSION}-api`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.add('/index.html').catch(() => undefined)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

function networkFirst(request, cacheName, fallbackUrl) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone()
        caches.open(cacheName).then((c) => c.put(request, copy))
      }
      return res
    })
    .catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      if (fallbackUrl) {
        const shell = await caches.match(fallbackUrl)
        if (shell) return shell
      }
      return new Response('', { status: 503, statusText: 'Offline' })
    })
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(async (cache) => {
    const cached = await cache.match(request)
    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone())
        return res
      })
      .catch(() => cached)
    return cached || network
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // mutaciones: las gestiona la cola offline

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  // Navegaciones SPA → app shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'))
    return
  }
  // API GET (mismo origen, /api/v1) — excluye auth/sync (sensibles a sesión).
  if (sameOrigin && url.pathname.startsWith('/api/v1') && !url.pathname.startsWith('/api/v1/auth') && !url.pathname.startsWith('/api/v1/sync')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }
  // Assets estáticos del build.
  if (sameOrigin && (url.pathname.startsWith('/assets/') || /\.(?:js|css|svg|png|woff2?)$/.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
    return
  }
})
