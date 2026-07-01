// Слой 3: устойчивость раскладки (06-state-layout.ts resize()/layout()) к смене
// пропорций окна — не только повороту экрана. Актуально для Google Play Featuring
// (docs/play-featuring-plan.md → «Аспект-рейшио / resize канваса на планшетах,
// foldables, split-screen»): Android может менять размер WebView на лету —
// сворачивание/разворачивание foldable, split-screen/multi-window — без полной
// перезагрузки страницы, просто событием `resize`.
//
// Запуск: `npm run test:e2e` (нужен Chromium — см. playwright.config.mjs).
import { test, expect } from '@playwright/test';

// SW фонового обновления (boot-sw.js) может дёрнуть location.reload() посреди теста
// (controllerchange) — тест длинный (много resize-шагов), ловить гонку с перезагрузкой
// незачем, она не имеет отношения к раскладке.
test.use({ serviceWorkers: 'block' });

// Набор размеров, которые реально возникают на Android без смены ориентации через
// системный поворот: узкий multi-window (Android допускает вплоть до ~320dp),
// короткий landscape-срез split-screen, планшет, и разворот/сворачивание foldable
// (Galaxy Fold-класс — почти квадратный экран в обеих ориентациях).
const SIZES = [
  { w: 390,  h: 844,  label: 'телефон portrait (база)' },
  { w: 320,  h: 680,  label: 'узкий multi-window slice' },
  { w: 640,  h: 320,  label: 'короткий landscape split-screen' },
  { w: 1280, h: 800,  label: 'планшет landscape' },
  { w: 2208, h: 1840, label: 'foldable развёрнут, landscape' },
  { w: 1840, h: 2208, label: 'foldable развёрнут, portrait' },
];

async function readField(page){
  return page.evaluate(() => {
    const F = window.__FIELD;
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    return {
      W: F.W, H: F.H,
      canvasW: r.width, canvasH: r.height,
      bays: F.bays.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
      runways: F.runways.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
      safety: F.safetyRects,
    };
  });
}

test('раскладка не ломается при resize без поворота (foldable/split-screen)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/index.html?test=1');
  await expect.poll(() => page.evaluate(() => !!window.__FIELD)).toBe(true);

  for (const { w, h, label } of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    // resize — синхронный обработчик + один кадр rAF на устаканивание оверлеев
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const info = await readField(page);

    expect(info.W, `${label}: W`).toBe(w);
    expect(info.H, `${label}: H`).toBe(h);
    // канвас покрывает весь вьюпорт без обрезки/растяжения
    expect(Math.round(info.canvasW), `${label}: canvas width`).toBe(w);
    expect(Math.round(info.canvasH), `${label}: canvas height`).toBe(h);

    // ангары/ВПП — конечные положительные размеры (не NaN, не схлопнулись)
    for (const b of info.bays) {
      expect(b.w, `${label}: bay w`).toBeGreaterThan(0);
      expect(b.h, `${label}: bay h`).toBeGreaterThan(0);
      expect(Number.isFinite(b.x) && Number.isFinite(b.y), `${label}: bay x/y finite`).toBe(true);
    }
    for (const r of info.runways) {
      expect(r.w, `${label}: runway w`).toBeGreaterThan(0);
      expect(r.h, `${label}: runway h`).toBeGreaterThan(0);
    }

    // интерактивные зоны (жест/каст/старт маршрута) не схлопываются и не уходят в минус —
    // иначе на узком/коротком экране становится физически некуда тапнуть/тащить маршрут
    const sr = info.safety;
    for (const key of ['interactiveSafeRect', 'routeStartAllowedRect', 'routeDrawAllowedRect', 'routeTargetAllowedRect', 'contentSafeRect']) {
      expect(sr[key].w, `${label}: ${key}.w`).toBeGreaterThan(0);
      expect(sr[key].h, `${label}: ${key}.h`).toBeGreaterThan(0);
    }

    // стартовое меню (fitOverlays) не должно вылезать за вьюпорт ни по одной оси —
    // это тот самый механизм автоподгона панелей, который должен спасать от обрезки
    // на непривычных пропорциях (узкий multi-window, «квадратный» foldable и т.п.)
    const panelBox = await page.evaluate(() => {
      const el = document.querySelector('#startScreen .panel, #startScreen .startpanel');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    });
    if (panelBox) {
      expect(panelBox.x, `${label}: панель стартового меню не обрезана слева`).toBeGreaterThanOrEqual(-1);
      expect(panelBox.y, `${label}: панель стартового меню не обрезана сверху`).toBeGreaterThanOrEqual(-1);
      expect(panelBox.right, `${label}: панель стартового меню не обрезана справа`).toBeLessThanOrEqual(w + 1);
      expect(panelBox.bottom, `${label}: панель стартового меню не обрезана снизу`).toBeLessThanOrEqual(h + 1);
    }
  }

  expect(errors, 'resize не должен кидать исключений в рантайме').toEqual([]);
});
