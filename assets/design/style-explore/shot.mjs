import { chromium } from '@playwright/test';

const URL = process.argv[2] || 'http://localhost:8123/index.html';
const OUT = process.argv[3] || '/tmp/shot.png';

// PW_CHROME lets you point at an already-installed Chromium (e.g. in a sandbox where
// `npx playwright install` is blocked); otherwise Playwright resolves its own.
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Zen mode drops straight into gameplay (no level-select).
await page.locator('#zenBtn').click();
await page.waitForTimeout(900);

// dismiss the "Shift goals / Got it" modal (DOM button)
try { await page.getByRole('button', { name: /got it/i }).click({ timeout: 1500 }); } catch {}
await page.waitForTimeout(600);

// dismiss any tutorial overlay with a tap on empty field, then let planes arrive
const box = await page.locator('#c').boundingBox();
await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.55);
await page.waitForTimeout(4000);

await page.screenshot({ path: OUT });
console.log('saved', OUT, 'errors:', errs.length ? errs.slice(0, 6) : 'none');
await browser.close();
