// Тест-харнесс: грузит игру (index.html) в Node без браузера.
//
// Зачем так: вся игра — один IIFE внутри <script>, который на старте трогает
// canvas, DOM, requestAnimationFrame и т.п. Полноценный прогон в браузере
// (Playwright) в этом окружении недоступен — CDN браузера заблокирован сетевой
// политикой. Поэтому здесь поднимается лёгкая заглушка окружения: ровно столько,
// чтобы IIFE доехал до конца и выставил window.__GAME (см. ?test=1 в index.html).
// Отрисовка не запускается: requestAnimationFrame — no-op, цикл frame() не зовётся.
//
// Это покрывает слои 1–2 (рантайм-валидатор конфига + юнит-логика). Слой 3
// (реальный браузер) живёт в tests/e2e.spec.mjs и запускается там, где доступен
// Chromium (CI / хост с разрешённым egress).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = join(HERE, '..', 'index.html');

function extractScript(html) {
  const m = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!m.length) throw new Error('в index.html не найден <script>');
  return m.map(x => x[1]).join('\n;\n');
}

// минимальная заглушка DOM-элемента: хранит присвоенные свойства, методы — no-op
function makeEl() {
  const el = {
    style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    textContent: '', innerHTML: '', value: '', checked: false, width: 1100, height: 620,
    appendChild(c){ return c; }, removeChild(){}, remove(){},
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){}, focus(){}, blur(){},
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    getContext(){ return ctx2d; },
    getBoundingClientRect(){ return { width: 1100, height: 620, top: 0, left: 0, right: 1100, bottom: 620 }; },
    requestFullscreen(){ return Promise.resolve(); },
  };
  return el;
}

// canvas 2D: любой метод — no-op, нужные геттеры возвращают разумную заглушку
const ctx2d = new Proxy({}, {
  get(_t, k) {
    if (k === 'measureText') return () => ({ width: 8 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (k === 'getImageData') return () => ({ data: [] });
    if (k === 'canvas') return makeEl();
    return () => {};        // setTransform, fillRect, save, restore, ... — no-op
  },
  set() { return true; },   // ctx.fillStyle = ..., ctx.font = ...
});

const computedStyle = {
  getPropertyValue() { return ''; },
  paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
};

// Загрузить свежий экземпляр игры со своим localStorage. Возвращает window.__GAME.
// initialStorage — начальное содержимое localStorage (для тестов сейва/миграции).
export function boot(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
  };
  const elById = new Map();
  const document = {
    title: '', documentElement: makeEl(), body: makeEl(),
    getElementById(id) { if (!elById.has(id)) elById.set(id, makeEl()); return elById.get(id); },
    createElement() { return makeEl(); },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
  };

  const consoleErrors = [];
  const sandbox = {
    console: {
      log() {}, info() {}, warn() {},
      error(...a) { consoleErrors.push(a.map(String).join(' ')); },
    },
    document,
    location: { search: '?test=1', href: 'http://localhost/index.html?test=1' },
    navigator: { language: 'en-US', languages: ['en-US'], userAgent: 'node-test' },
    screen: {},
    localStorage,
    getComputedStyle: () => computedStyle,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    devicePixelRatio: 2, innerWidth: 1100, innerHeight: 620,
    performance: { now: () => 0 },          // нужен пути выдачи медали (toastAch→pump)
    Date, Math, JSON, Promise,              // явные интринсики (на случай строгого контекста)
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  sandbox.window = sandbox;        // window === глобальный объект
  sandbox.globalThis = sandbox;

  const code = extractScript(readFileSync(INDEX, 'utf8'));
  vm.runInNewContext(code, sandbox, { filename: 'index.html#script' });

  if (!sandbox.__GAME) throw new Error('window.__GAME не выставлен — проверь ?test=1 / загрузку');
  return { game: sandbox.__GAME, consoleErrors, localStorage, store };
}
