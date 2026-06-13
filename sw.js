/* PlaneFlow service worker — offline shell + controlled updates.
 *
 * Strategy:
 *   • navigation (the page itself) → network-first, fall back to the cached
 *     index.html when offline. Keeps the "push the repo → instant update" flow:
 *     a fresh index.html is fetched on every online launch.
 *   • static assets (sprites/icons/manifest) → stale-while-revalidate: serve
 *     from cache instantly, refresh in the background for next time.
 *
 * Updates: auto-applied. When sw.js changes (bump VERSION), the new worker
 * skipWaiting()s on install and clients.claim()s on activate, so it takes over
 * immediately; the page hears `controllerchange` and reloads once into the new
 * version. No manual confirmation needed — this is what prevents clients from
 * getting stuck on a stale cached shell. The page still shows the "update
 * available" toast as a heads-up, but the reload no longer depends on it.
 * Trade-off: an active session may reload once when a new version ships.
 *
 * After changing precached assets or wanting to force a refresh, bump VERSION.
 */
const VERSION = 'v6';
const CACHE = 'planeflow-' + VERSION;

// App shell — everything needed to boot offline. Paths are relative so the SW
// works whether the game is served from a domain root or a GitHub Pages subpath.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon/icon-192.png',
  './assets/icon/icon-180.png',
  './assets/icon/icon-512.png',
  './assets/icon/icon-maskable-192.png',
  './assets/icon/icon-maskable-512.png',
  './assets/icon/icon-adaptive-bg.png',
  './assets/icon/icon-adaptive-fg.png',
  './assets/sprites/planeflow-aircraft.svg',
  './assets/sprites/planeflow-field.svg',
  './assets/sprites/planeflow-hud.svg',
  './assets/sprites/planeflow-effects.svg',
  './assets/sprites/planeflow-brand.svg',
  // neon skin shell (opt-in via ?skin=neon): per-skin sprite sheets + the PNG
  // manifest, so the neon art engages instantly and offline. The 43 baked PNGs
  // themselves are NOT precached (they'd add ~1.3MB to every install while cozy
  // is the default) — they load on demand and cache via stale-while-revalidate
  // the first time the neon skin renders online.
  './assets/sprites/neon/planeflow-aircraft.svg',
  './assets/sprites/neon/planeflow-field.svg',
  './assets/sprites/neon/manifest.json',
];

self.addEventListener('install', (e) => {
  // Precache the shell. Tolerate individual misses so one 404 can't block install.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})))
    )
  );
  // Take over as soon as installed so a single reload adopts the new version —
  // no waiting on a user toast (prevents clients sticking on a stale shell).
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('planeflow-') && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // leave cross-origin to the network

  // Navigations: network-first, cached shell as offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Everything else (same-origin GET): stale-while-revalidate.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
