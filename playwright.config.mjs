// Конфиг e2e-смоука (слой 3). Запуск: `npm run test:e2e`.
// ВНИМАНИЕ: нужен установленный браузер Chromium (`npx playwright install chromium`).
// В песочнице Claude Code на вебе загрузка браузера заблокирована сетевой политикой,
// поэтому e2e здесь не идёт — гоняй его на хосте/CI с разрешённым egress.
// Юнит-логика (слои 1–2) от браузера не зависит: `npm test`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',          // node-юниты (*.test.mjs) Playwright не трогает
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:8123', headless: true },
  webServer: {
    command: 'python3 -m http.server 8123',
    port: 8123,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
