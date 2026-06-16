// Генератор плейсхолдер-иконок для Play Games Services (ачивки + лидерборд).
// Рендерит 512×512 PNG: неон-диск в стиле игры + эмодзи медали. Chromium умеет
// цветные эмодзи (Segoe UI Emoji), поэтому рисуем через Playwright — он уже в проекте.
//
// Запуск:  node play-games-import/build-icons.mjs
// Нужен Chromium:  npx playwright install chromium
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = join(HERE, 'files');

// 5 ачивок (в ZIP) + лидерборд (грузится вручную, отдельным файлом).
const ICONS = [
  { file: 'files/ach-land1.png',     emoji: '🛬', accent: '#36e0d0' }, // First Contact
  { file: 'files/ach-svc1.png',      emoji: '🧰', accent: '#ffb454' }, // Hands On
  { file: 'files/ach-takeoff1.png',  emoji: '🛫', accent: '#5ad07a' }, // Bon Voyage
  { file: 'files/ach-level1.png',    emoji: '✅', accent: '#b98cff' }, // Shift Done
  { file: 'files/ach-land10.png',    emoji: '🎓', accent: '#ffd24a' }, // Tower Trainee
  { file: 'leaderboard-survival.png',emoji: '🏆', accent: '#4aa3ff' }, // Survival — Forest
];

function html(emoji, accent) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .icon{width:512px;height:512px;position:relative;overflow:hidden;
      background:radial-gradient(circle at 50% 42%, #1b2335 0%, #0d121f 60%, #080b13 100%);
      font-family:"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif;}
    .glow{position:absolute;inset:0;
      background:radial-gradient(circle at 50% 50%, ${accent}33 0%, transparent 62%);}
    .disc{position:absolute;inset:84px;border-radius:50%;
      background:radial-gradient(circle at 50% 45%, #28324c 0%, #141b2b 72%);}
    .ring{position:absolute;inset:74px;border-radius:50%;border:10px solid ${accent};
      box-shadow:0 0 48px ${accent}, inset 0 0 40px ${accent}55;}
    .emoji{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      font-size:230px;line-height:1;filter:drop-shadow(0 0 16px ${accent}aa);}
  </style></head><body>
    <div class="icon"><div class="glow"></div><div class="disc"></div><div class="ring"></div>
      <div class="emoji">${emoji}</div></div>
  </body></html>`;
}

const browser = await chromium.launch();
try {
  await mkdir(FILES, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const ic of ICONS) {
    await page.setContent(html(ic.emoji, ic.accent), { waitUntil: 'load' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(HERE, ic.file), clip: { x: 0, y: 0, width: 512, height: 512 } });
    console.log('✓', ic.file);
  }
} finally {
  await browser.close();
}
console.log('Готово.');
