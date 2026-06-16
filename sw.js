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
const VERSION = 'v11';
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
  // neon art shell: per-look sprite sheets + the PNG manifest, so the neon art
  // engages instantly and offline. The baked PNGs themselves are NOT precached
  // (they'd add ~1.3MB to every install) — they load on demand and cache via
  // stale-while-revalidate the first time they render online.
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
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) { self.skipWaiting(); return; }

  // Принудительное обновление по запросу («Проверить обновления» в настройках):
  // перекачиваем из сети все уже закэшированные same-origin ресурсы — спрайты,
  // иконки и PNG скинов (которые иначе живут по stale-while-revalidate и
  // обновляются лишь при следующей загрузке) — и кладём свежие копии. Затем
  // отвечаем клиенту, сколько штук обновили, чтобы он перезагрузился с новым
  // артом. Новые, ещё ни разу не запрошенные PNG в кэше отсутствуют — они и так
  // придут свежими при первом рендере скина после перезагрузки.
  if (d && d.type === 'REFRESH_ASSETS') {
    const reply = (msg) => { if (e.source) e.source.postMessage(msg); };
    e.waitUntil((async () => {
      let updated = 0;
      try {
        const c = await caches.open(CACHE);
        const reqs = await c.keys();
        await Promise.all(reqs.map(async (req) => {
          try {
            const res = await fetch(req, { cache: 'reload' });
            if (res && res.status === 200 && res.type === 'basic') {
              await c.put(req, res.clone());
              updated++;
            }
          } catch { /* офлайн/одиночный 404 не должен валить остальное */ }
        }));
      } catch { /* нет доступа к кэшу — просто отвечаем */ }
      reply({ type: 'ASSETS_REFRESHED', updated });
    })());
  }
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
