// One-off: capture a REAL current gameplay frame to use as the locked-composition
// base for the re-skin brief (docs/design/skins/reskin-ref/). Unlocks all levels via
// the debug flag, opens a rich mid/late level (more bays + runways), dismisses the
// goals/tutorial overlays, lets a few planes arrive, then screenshots the canvas.
//
// Run with the static server already up on :8123 (npm run serve / preview), e.g.:
//   node scripts/capture-reskin-ref.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.URL || 'http://localhost:8123/index.html';
const OUT   = process.argv[2] || 'docs/design/skins/reskin-ref/field-cozy.png';
const LEVEL = Number(process.argv[3] || 12); // campaign level number to open (rich layout)

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

// set progress so the ACTIVE ("Play") node sits on a rich late level, and unlock all
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate((lvl) => {
  localStorage.setItem('pf_debug', JSON.stringify({ unlockAll: true }));
  localStorage.setItem('planeflow_save_v1', JSON.stringify({ unlocked: lvl, tutorialDone: true }));
}, LEVEL);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// play -> level map; renderLevels pages onto the active node — just click it
await page.locator('#startBtn').click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('#levelList .lvlnode.active').first().click().catch(() => {});
await page.waitForTimeout(500);

// dismiss goals modal (any visible button in the goals overlay)
try { await page.locator('#goalsScreen button:visible').last().click({ timeout: 1200 }); } catch {}
await page.waitForTimeout(400);
const box = await page.locator('#c').boundingBox();
if (box) await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);

// let a handful of planes spawn so they are visible on the field
await page.waitForTimeout(14000);

await page.screenshot({ path: OUT });
console.log('saved', OUT, '| errors:', errs.length ? errs.slice(0, 4) : 'none');
await browser.close();
