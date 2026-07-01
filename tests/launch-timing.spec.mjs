// Слой 3: время загрузки до интерактивности (docs/play-featuring-plan.md →
// «Время старта (launch-to-interactive)»). Раньше `<link rel=stylesheet>` на Google
// Fonts стоял ДО игрового `<script>` и блокировал его выполнение, пока шрифт не
// загрузится (или не отвалится по таймауту) — на медленной/недоступной сети до
// игры физически нельзя было дотронуться (замерено ~13с зависания в песочнице с
// заблокированным исходящим трафиком на fonts.googleapis.com). Шрифт переведён на
// неблокирующую загрузку (preload+swap, см. index.template.html); этот тест
// специально держит fonts.googleapis.com недоступным и проверяет, что игра всё
// равно становится интерактивной быстро.
//
// Запуск: `npm run test:e2e` (нужен Chromium — см. playwright.config.mjs).
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// щедрый бюджет — сама игра готова за <300мс даже без сети; 2с — порог из плана
const INTERACTIVE_BUDGET_MS = 2000;

test('игра интерактивна быстро, даже если Google Fonts недоступен', async ({ page }) => {
  // симулируем «сеть режет доступ к fonts.googleapis.com» — до фикса это вешало
  // выполнение игрового скрипта на весь таймаут соединения
  await page.route('**://fonts.googleapis.com/**', route => route.abort('connectionfailed'));
  await page.route('**://fonts.gstatic.com/**', route => route.abort('connectionfailed'));

  await page.goto('/index.html?test=1');
  await expect.poll(() => page.evaluate(() => !!window.__FIELD)).toBe(true);

  const interactiveAt = await page.evaluate(() => performance.now());
  expect(interactiveAt, 'boot-to-interactive должен укладываться в бюджет плана Featuring')
    .toBeLessThan(INTERACTIVE_BUDGET_MS);
});
