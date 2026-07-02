// Слой 3: e2e-смоук в реальном браузере (Playwright + Chromium).
// Ловит «катастрофы», которые юниты не видят: белый экран, исключение на старте,
// сломанную проводку меню/выбора уровня, рассинхрон UI и логики прогрессии.
//
// Запуск: `npm run test:e2e` (нужен Chromium — см. playwright.config.mjs).
import { test, expect } from '@playwright/test';

test('игра грузится без ошибок в консоли и проходит самопроверку конфига', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/index.html?test=1');
  await expect.poll(() => page.evaluate(() => !!window.__GAME)).toBe(true);

  const problems = await page.evaluate(() => window.__GAME.validateGame());
  expect(problems, 'validateGame() должен быть пуст').toEqual([]);
  expect(errors, 'на старте не должно быть ошибок в консоли').toEqual([]);
});

test('главное меню → выбор уровня: сетка всех уровней, открыт только первый', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.locator('#startBtn').click();             // «Играть»
  await expect(page.locator('#levelScreen')).toBeVisible();

  // 6-колоночная сетка показывает все уровни кампании; L1 открыт (active), L2 под замком
  const total = await page.evaluate(() => window.__GAME.LEVELS.length);
  const nodes = page.locator('#levelList .lvlcard:not(.lvlcard--bonus)');
  await expect(nodes).toHaveCount(total);
  await expect(nodes.nth(0)).not.toHaveClass(/lvlcard--lk\b/); // L1 открыт (active)
  await expect(nodes.nth(1)).toHaveClass(/lvlcard--lk\b/);     // L2 под замком
});

test('старт уровня показывает окно целей с названием уровня', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.locator('#startBtn').click();
  await page.locator('#levelList .lvlcard:not(.lvlcard--bonus)').nth(0).click();
  await expect(page.locator('#goalsScreen')).toBeVisible();
  await expect(page.locator('#goalsTitle')).toHaveText(/Training|Обучение/);
});

test('прохождение цели открывает следующий уровень и сохраняется', async ({ page }) => {
  await page.goto('/index.html?test=1');
  // гоняем реальный путь завершения смены через тест-хук (без хрупкого перетаскивания)
  const res = await page.evaluate(() => window.__GAME.simulateResult({ level: 0, served: 8 }));
  expect(res.stars).toBe(3);  // L1 пороги [6,7,8] — 8 принятых = 3★
  expect(res.unlocked).toBe(2);

  // прогресс должен лежать в localStorage и переживать перезагрузку
  await page.reload();
  const unlocked = await page.evaluate(() => window.__GAME.save.unlocked);
  expect(unlocked).toBe(2);
});

test('MVP-аэропорт (forest, Survival): запуск, снег провоцирует де-айс перед вылетом борта', async ({ page }) => {
  await page.goto('/index.html?test=1');
  // детерминируем погоду: снег с первого тика погодного окна
  await page.evaluate(() => {
    window.__GAME.K.WEATHER_PERIOD = 0;
    window.__GAME.K.WEATHER_SNOW_CHANCE = 1;
    // Survival — staged-контент, по умолчанию «coming soon». Открываем его дев-оверрайдом
    // (галочка «открыть все coming soon»), как это делает тестировщик перед превью.
    window.__GAME.debug.unlockContent = true;
    window.dispatchEvent(new CustomEvent('pf:flags'));
  });
  await page.locator('#survivalBtn').click();
  await expect(page.locator('#biomeScreen')).toBeVisible();
  await page.locator('#biomeList .biome').first().click();   // forest — первая карта биомов
  await expect(page.locator('#goalsScreen')).toBeVisible();
  await page.locator('#goalsOk').click();                    // закрыть окно целей, начать смену

  // погода должна перейти в snow (детерминировано K.WEATHER_SNOW_CHANCE=1 выше)
  await expect.poll(() => page.evaluate(() => window.__GAME.weather)).toBe('snow');

  // хотя бы один борт должен получить шаг 'deice' в маршруте обслуживания
  await expect.poll(() => page.evaluate(() =>
    window.__GAME.planes.some(p => Array.isArray(p.requests) && p.requests.includes('deice'))
  ), { timeout: 15000 }).toBe(true);

  // де-айс-бокс должен присутствовать и быть открытым (всегда-открытая инфраструктура)
  const hasDeiceBay = await page.evaluate(() => window.__GAME.bays.some(b => b.deice && b.open));
  expect(hasDeiceBay).toBe(true);
});

// --- Лига сезона (MVP Фаза 1): вкладка «Сезон» и шеринг-карточка (задел __GAME) ---
test('экран рейтинга: вкладка «Сезон» показывает дивизион, отсчёт и не роняет консоль', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/index.html?test=1');
  // Лига сезона — staged-контент («coming soon» по умолчанию). Открываем дев-оверрайдом.
  await page.evaluate(() => { window.__GAME.debug.unlockContent = true; });
  // отправляем survival-заход, чтобы в сезонном топе было место игрока
  await page.evaluate(() => window.__GAME.Leaderboard.submitRun({ mode: 'survival', score: 12 }));
  await page.evaluate(() => window.__GAME.showLeaderboard());
  await expect(page.locator('#leaderboardScreen')).toBeVisible();

  // «Сезон» — последняя вкладка в #lbTabs; жмём и ждём заполнения блока #lbSeason
  await page.locator('#lbTabs button').last().click();
  const box = page.locator('#lbSeason');
  await expect(box).toBeVisible();
  await expect(box).toContainText(/Season|Сезон/);       // заголовок с номером сезона
  await expect(box).toContainText(/left|Осталось/);      // строка отсчёта до конца сезона
  expect(errors, 'вкладка «Сезон» не должна ронять консоль').toEqual([]);
});

test('шеринг-карточка рисуется с сезонными данными без исключений', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/index.html?test=1');
  const ok = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 1080;
    window.__GAME.drawShareCard(c, {
      passed: true, stars: 0, surv: true, metric: 'served', v: 23,
      money: 120, peak: 7, time: 180, levelName: 'Forest', samples: [],
      season: { number: 13, division: 'silver', divisionIdx: 1, daysLeft: 5 },
    });
    return true;
  });
  expect(ok).toBe(true);
  expect(errors, 'отрисовка карточки с дивизионом не должна ронять консоль').toEqual([]);
});
