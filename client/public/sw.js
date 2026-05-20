// ── Cache version — bump this on every deploy to force SW refresh ────────────
const CACHE_VERSION = 'testprep-v4';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

self.addEventListener('install', e => {
  // Skip waiting immediately — don't hold back behind old SW
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete ALL old caches on activate
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // ── 1. API calls → always network, never cache ───────────────────────────
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ── 2. HTML / navigation → network-first (always get fresh index.html) ───
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          // Cache the fresh response for offline fallback
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('/')))
    );
    return;
  }

  // ── 3. Versioned JS/CSS assets → cache-first (Vite hashes guarantee freshness) ──
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // ── 4. Everything else → network with cache fallback ─────────────────────
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && req.method === 'GET') {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
