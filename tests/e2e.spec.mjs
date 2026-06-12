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

test('главное меню → выбор уровня: 10 карточек, открыт только первый', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.locator('#startBtn').click();             // «Играть»
  await expect(page.locator('#levelScreen')).toBeVisible();

  const cards = page.locator('#levelList .levelcard');
  await expect(cards).toHaveCount(10);
  await expect(cards.nth(0)).not.toHaveClass(/locked/); // L1 открыт
  await expect(cards.nth(1)).toHaveClass(/locked/);     // L2 под замком
});

test('старт уровня показывает окно целей с названием уровня', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.locator('#startBtn').click();
  await page.locator('#levelList .levelcard').nth(0).click();
  await expect(page.locator('#goalsScreen')).toBeVisible();
  await expect(page.locator('#goalsTitle')).toHaveText(/Training|Обучение/);
});

test('прохождение цели открывает следующий уровень и сохраняется', async ({ page }) => {
  await page.goto('/index.html?test=1');
  // гоняем реальный путь завершения смены через тест-хук (без хрупкого перетаскивания)
  const res = await page.evaluate(() => window.__GAME.simulateResult({ level: 0, served: 6 }));
  expect(res.stars).toBe(3);
  expect(res.unlocked).toBe(2);

  // прогресс должен лежать в localStorage и переживать перезагрузку
  await page.reload();
  const unlocked = await page.evaluate(() => window.__GAME.save.unlocked);
  expect(unlocked).toBe(2);
});
