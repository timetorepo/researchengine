// Research Engine service worker — app-shell cache for offline reads.
// Privacy note: this caches ONLY same-origin static assets. API calls are never
// cached, so provider traffic always goes direct and nothing sensitive is stored.
const CACHE = 'research-engine-shell-v1'
const SHELL = ['.', 'index.html', 'manifest.webmanifest', 'icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never cache API or provider traffic
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__vite')) return

  // SPA navigation → network-first with shell fallback (offline reads)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('index.html', copy))
          return res
        })
        .catch(() => caches.match('index.html')),
    )
    return
  }

  // Hashed/static assets → cache-first, then network (and store)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
