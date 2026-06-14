// Concept renderer for PlaneFlow menu redesigns.
//
// Builds standalone mockups of the key menus (Start / Pause / End-of-shift) on
// top of the REAL game CSS (`_base.css.html`, extracted from index.html), then
// layers a per-concept override theme and screenshots each screen with the
// bundled Chromium. Finally stitches one comparison sheet per concept.
//
//   node docs/design/concepts/render.mjs
//
// Output: docs/design/concepts/out/<concept>-<screen>.png  (individual)
//         docs/design/concepts/<concept>.png               (comparison sheet)

import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'out');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VW = 960, VH = 540, SCALE = 2;

const BASE_CSS = await readFile(join(DIR, '_base.css.html'), 'utf8');

// ---- faux night-field background (stands in for the canvas radar scene) ----
const FIELD = `
<div class="field">
  <div class="runway"></div>
  <div class="star s1"></div><div class="star s2"></div><div class="star s3"></div>
  <div class="plane pa">✈</div><div class="plane pb">✈</div>
</div>
<style>
  .field{position:absolute;inset:0;overflow:hidden;
    background:radial-gradient(130% 100% at 50% 18%, #241d33, #15111d 60%, #0e0b16);}
  .field .runway{position:absolute;left:50%;bottom:-30%;width:46%;height:150%;transform:translateX(-50%);
    background:linear-gradient(#2c3150,#242842);opacity:.5;border-radius:40% 40% 0 0/8% 8% 0 0;
    box-shadow:inset 0 0 0 2px rgba(154,111,212,.10);}
  .field .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#cdb0f7;opacity:.5;
    box-shadow:0 0 6px #cdb0f7;}
  .field .s1{top:14%;left:22%}.field .s2{top:24%;left:74%}.field .s3{top:10%;left:55%}
  .field .plane{position:absolute;color:#f4eede;opacity:.55;font-size:26px;
    text-shadow:0 0 12px rgba(205,176,247,.5);}
  .field .pa{top:34%;left:30%;transform:rotate(28deg)}
  .field .pb{top:62%;left:64%;transform:rotate(-18deg)}
</style>`;

// ---- screen markup (realistic placeholder content; i18n is inlined) --------
const SCREENS = {
  start: `
  <div class="overlay" id="startScreen">
    <div class="panel startpanel">
      <div class="start-brand">
        <div class="kicker">Night controller · Airfield</div>
        <h1 class="wm">PlaneFlow</h1>
        <p>Guide the planes with your finger. Calm night flow.</p>
        <div class="vno">ver. 0.21.0</div>
      </div>
      <div class="start-rail">
        <button class="btn btn-primary" id="startBtn"><span class="bglyph">▶</span><span>Play</span></button>
        <button class="btn btn-teal"><span class="bglyph">☾</span><span>Zen mode</span></button>
        <button class="btn"><span class="bglyph">🌲</span><span>Biomes</span></button>
        <button class="btn btn-quiet"><span class="bglyph">🏅</span><span>Medals</span></button>
        <div class="start-rail-row">
          <button class="btn btn-quiet"><span class="bglyph">⚙</span><span>Settings</span></button>
          <button class="btn btn-quiet" id="fsBtn"><span class="bglyph">⛶</span></button>
        </div>
      </div>
    </div>
  </div>`,

  pause: `
  <div class="overlay">
    <div class="panel card">
      <div class="kicker">‖&nbsp;&nbsp;Paused</div>
      <h1>Shift 3 · Harbour</h1>
      <div class="statstrip">
        <div class="stat"><span class="si">⏱</span> 2:14</div>
        <div class="stat"><span class="si">🪙</span> 1 240</div>
        <div class="stat"><span class="si">🎯</span> 12 / 20</div>
      </div>
      <div class="objlabel">Objective</div>
      <div class="goalrows">
        <div class="goalrow"><span class="gs">★</span><span class="gt">Land &amp; depart 20 planes</span></div>
        <div class="goalrow"><span class="gs">★★</span><span class="gt">No plane overdue</span></div>
        <div class="goalrow"><span class="gs">★★★</span><span class="gt">No crashes</span></div>
      </div>
      <div class="pausegrid pausegrid-3">
        <button class="btn btn-primary"><span class="bglyph">▶</span><span>Resume</span></button>
        <button class="btn btn-teal"><span class="bglyph">↻</span><span>Restart</span></button>
        <button class="btn btn-rose"><span class="bglyph">⌂</span><span>Main menu</span></button>
      </div>
    </div>
  </div>`,

  over: `
  <div class="overlay">
    <div class="panel card">
      <div class="kicker">Level complete</div>
      <div class="big" id="finalStars">★★☆</div>
      <p>Smooth shift. Result: 20 planes, bank 1 240.</p>
      <div class="stats">
        <div class="stat"><div class="label">Planes</div><div class="val v-phos">20</div></div>
        <div class="stat"><div class="label">Money</div><div class="val v-gold">1 240</div></div>
        <div class="stat"><div class="label">Best combo</div><div class="val v-teal">×6</div></div>
        <div class="stat"><div class="label">Overdue</div><div class="val v-life">1</div></div>
      </div>
      <div class="ctarow">
        <button class="btn btn-quiet"><span class="bglyph">⇪</span><span>Share image</span></button>
      </div>
      <div class="ctarow">
        <button class="btn btn-teal"><span class="bglyph">≡</span><span>Level select</span></button>
        <button class="btn btn-primary"><span class="bglyph">↻</span><span>Play again</span></button>
        <button class="btn btn-primary"><span class="bglyph">⏭</span><span>Next level</span></button>
      </div>
    </div>
  </div>`,
};

// ---- concept override themes ----------------------------------------------
const CONCEPTS = {
  current: { label: 'A · Current (cozy flat)', css: `` },

  pass: {
    label: 'B · Boarding pass',
    css: `
    /* cream ticket paper, dark ink, dashed perforation + barcode footer */
    .panel.card, .start-rail{
      background:#f4eede !important;border:0 !important;color:#241a2e !important;
      border-radius:14px !important;position:relative;overflow:hidden;
      box-shadow:0 22px 50px rgba(8,6,16,.55) !important;
      background-image:linear-gradient(#f4eede,#f4eede) !important;}
    .panel.card::before, .start-rail::before{content:"";position:absolute;left:0;right:0;top:64%;
      border-top:2px dashed #c9bfa3;}
    /* punch-holes on the perforation */
    .panel.card::after, .start-rail::after{content:"";position:absolute;left:-9px;top:64%;
      width:18px;height:18px;border-radius:50%;background:#15111d;transform:translateY(-9px);
      box-shadow:calc(100% + 9px) 0 0 #15111d;}
    .panel .kicker, .start-brand .kicker{color:#9a6f4a !important;font-family:ui-monospace,"Courier New",monospace !important;
      letter-spacing:.22em !important;}
    .panel h1, .start-brand h1.wm{color:#241a2e !important;text-shadow:none !important;}
    .panel p, .vno, .objlabel, .stat .label{color:#7a6a52 !important;}
    .statstrip, .goalrow, .stats{background:rgba(36,26,46,.05) !important;border-color:#d8cdb0 !important;}
    .goalrow .gt, .stat .val, .statstrip .stat{color:#241a2e !important;}
    .goalrow .gs, .stat .val.v-gold{color:#c08a2e !important;text-shadow:none !important;}
    #finalStars{color:#c08a2e !important;text-shadow:none !important;}
    .btn{background:#fff !important;border:1.5px solid #cdbf9e !important;color:#5a4a36 !important;
      border-radius:9px !important;font-family:ui-monospace,"Courier New",monospace !important;
      letter-spacing:.06em;text-transform:uppercase;font-size:12px !important;}
    .btn-primary{background:#5dca7a !important;border-color:#3fa85f !important;color:#0f2a18 !important;
      box-shadow:0 5px 0 #3fa85f !important;}    /* tear-off stub feel */
    .btn-teal{color:#1f8f86 !important;border-color:#7fcfc8 !important;background:#eef9f8 !important;}
    .btn-rose{color:#c2566a !important;border-color:#e7a9b3 !important;background:#fdeef0 !important;}
    /* barcode footer strip */
    .panel.card{padding-bottom:34px !important;}
    .panel.card .barcode{position:absolute;left:24px;right:24px;bottom:11px;height:16px;
      background:repeating-linear-gradient(90deg,#241a2e 0 2px,transparent 2px 4px,#241a2e 4px 5px,transparent 5px 9px);
      opacity:.75;}
    .start-rail{padding-bottom:14px !important;}
    .start-rail::before,.start-rail::after{display:none}
    `,
    inject: (screen, html) =>
      screen === 'over' || screen === 'pause'
        ? html.replace('</div>\n    </div>\n  </div>', '</div>\n      <div class="barcode"></div>\n    </div>\n  </div>')
        : html,
  },

  glass: {
    label: 'C · Night glass console',
    css: `
    body{color:#dbe7ff !important;}
    .panel.card, .start-rail{
      background:rgba(20,17,32,.62) !important;border:1px solid rgba(127,212,255,.35) !important;
      border-radius:18px !important;position:relative;backdrop-filter:blur(9px) saturate(120%);
      box-shadow:0 0 0 1px rgba(127,212,255,.06),0 24px 60px rgba(4,8,20,.6),
                 inset 0 1px 0 rgba(180,220,255,.10) !important;}
    /* HUD corner brackets */
    .panel.card::before, .panel.card::after, .start-rail::before, .start-rail::after{
      content:"";position:absolute;width:16px;height:16px;border:2px solid rgba(127,212,255,.7);}
    .panel.card::before, .start-rail::before{left:9px;top:9px;border-right:0;border-bottom:0;}
    .panel.card::after, .start-rail::after{right:9px;bottom:9px;border-left:0;border-top:0;}
    .panel .kicker, .start-brand .kicker{color:#7fd6ff !important;letter-spacing:.34em !important;
      font-family:ui-monospace,monospace !important;}
    .panel h1, .start-brand h1.wm{color:#eaf4ff !important;letter-spacing:.06em !important;font-weight:700 !important;
      text-shadow:0 0 22px rgba(127,212,255,.5) !important;}
    .panel p, .vno{color:#8fa6c8 !important;}
    .statstrip, .goalrow, .stats{background:rgba(127,212,255,.05) !important;
      border-color:rgba(127,212,255,.22) !important;}
    .statstrip .stat, .goalrow .gt, .stat .val{color:#dbe7ff !important;font-family:ui-monospace,monospace;}
    .goalrow .gs, #finalStars, .stat .val.v-gold{color:#9fe6ff !important;
      text-shadow:0 0 14px rgba(127,212,255,.6) !important;}
    .btn{background:rgba(127,212,255,.06) !important;border:1px solid rgba(127,212,255,.4) !important;
      color:#cfe6ff !important;border-radius:11px !important;letter-spacing:.04em;}
    .btn-primary{background:rgba(93,202,122,.16) !important;border-color:#5dca7a !important;color:#d6ffe2 !important;
      box-shadow:0 0 18px rgba(93,202,122,.35),inset 0 0 12px rgba(93,202,122,.12) !important;}
    .btn-teal{color:#7fe8e0 !important;border-color:rgba(78,205,196,.6) !important;}
    .btn-rose{color:#ff9fae !important;border-color:rgba(239,121,138,.6) !important;}
    `,
    inject: (s, h) => h,
  },

  board: {
    label: 'D · Departures board',
    css: `
    body{color:#ffd24a !important;}
    .panel.card, .start-rail{
      background:#0c0d12 !important;border:1px solid #2a2c38 !important;border-radius:10px !important;
      box-shadow:0 24px 60px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,210,74,.04) !important;
      position:relative;overflow:hidden;}
    .panel .kicker, .start-brand .kicker{color:#ffd24a !important;letter-spacing:.36em !important;
      font-family:ui-monospace,"Courier New",monospace !important;font-weight:700;}
    .panel h1, .start-brand h1.wm{color:#ffe7a3 !important;letter-spacing:.10em !important;
      font-family:ui-monospace,"Courier New",monospace !important;font-weight:800 !important;text-shadow:none !important;}
    .panel p, .vno{color:#b9a04f !important;font-family:ui-monospace,monospace;}
    /* split-flap slats: every row/button is a dark slat with a centre seam */
    .statstrip, .goalrow, .stats{background:#15161d !important;border:1px solid #2a2c38 !important;}
    .goalrow{position:relative;}
    .goalrow::after, .btn::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;
      background:rgba(0,0,0,.6);box-shadow:0 1px 0 rgba(255,255,255,.04);}
    .statstrip .stat, .goalrow .gt, .stat .val{color:#ffd24a !important;
      font-family:ui-monospace,"Courier New",monospace !important;}
    .goalrow .gs, #finalStars, .stat .val.v-gold{color:#ffe7a3 !important;text-shadow:none !important;}
    .stat .label{color:#8a7a3c !important;}
    .btn{position:relative;overflow:hidden;background:#15161d !important;border:1px solid #2a2c38 !important;
      color:#ffd24a !important;border-radius:6px !important;text-transform:uppercase;letter-spacing:.10em;
      font-family:ui-monospace,"Courier New",monospace !important;font-weight:700;font-size:12px !important;}
    .btn-primary{background:#1c2a1c !important;border-color:#3fa85f !important;color:#9af0b0 !important;}
    .btn-teal{color:#6fe8e0 !important;}.btn-rose{color:#ff9fae !important;}
    .start-brand .kicker::before, .panel .kicker::before{content:"⬛ ";opacity:.5;}
    `,
    inject: (s, h) => h,
  },
};

function page(conceptKey, screenKey) {
  const c = CONCEPTS[conceptKey];
  let body = SCREENS[screenKey];
  if (c.inject) body = c.inject(screenKey, body);
  return `<!doctype html><html lang="en"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${BASE_CSS}
  <style>${c.css}
    html,body{width:${VW}px;height:${VH}px;}
    /* the start screen lets the field show through; cards sit on a dim scrim */
    #startScreen{background:none;backdrop-filter:none;}
    /* wordmark here is a text stand-in for the real SVG lockup — keep it on one line */
    .startpanel{max-width:760px;}
    .start-brand .kicker{white-space:nowrap;}
    .start-brand h1.wm{font-size:32px;white-space:nowrap;letter-spacing:.01em;margin:8px 0 6px;}
  </style>
  <div id="stage">${FIELD}${body}</div>`;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE });
const pg = await ctx.newPage();

const screens = ['start', 'pause', 'over'];
const shots = {}; // concept -> screen -> dataURI

for (const ck of Object.keys(CONCEPTS)) {
  shots[ck] = {};
  for (const sk of screens) {
    await pg.setContent(page(ck, sk), { waitUntil: 'networkidle' });
    const buf = await pg.screenshot();
    await writeFile(join(OUT, `${ck}-${sk}.png`), buf);
    shots[ck][sk] = 'data:image/png;base64,' + buf.toString('base64');
  }
  console.log('rendered', ck);
}

// ---- comparison sheet per concept (3 screens in a row, labelled) ----------
const sheetPg = await ctx.newPage();
for (const ck of Object.keys(CONCEPTS)) {
  const cols = screens.map((sk, i) => `
    <figure><img src="${shots[ck][sk]}"><figcaption>${['Start','Pause','End of shift'][i]}</figcaption></figure>`).join('');
  const sheet = `<!doctype html><meta charset="utf-8">
  <style>
    body{margin:0;background:#0b0910;color:#f4eede;font:600 22px "Segoe UI",system-ui,sans-serif;}
    h2{margin:0;padding:26px 34px 6px;font-size:30px;letter-spacing:.01em;}
    .row{display:flex;gap:22px;padding:14px 34px 34px;}
    figure{margin:0;flex:1;}
    img{width:100%;display:block;border-radius:12px;border:1px solid #2a2540;box-shadow:0 14px 40px rgba(0,0,0,.5);}
    figcaption{margin-top:10px;font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#9a93b5;text-align:center;}
  </style>
  <h2>${CONCEPTS[ck].label}</h2><div class="row">${cols}</div>`;
  await sheetPg.setViewportSize({ width: 1500, height: 560 });
  await sheetPg.setContent(sheet, { waitUntil: 'networkidle' });
  const h = await sheetPg.evaluate(() => document.body.scrollHeight);
  await sheetPg.setViewportSize({ width: 1500, height: h });
  await sheetPg.setContent(sheet, { waitUntil: 'networkidle' });
  await sheetPg.screenshot({ path: join(DIR, `${ck}.png`) });
  console.log('sheet', ck);
}

await browser.close();
console.log('done');
