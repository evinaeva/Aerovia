// Слой 1-2: статический разбор сложности уровня (src/game/14-level-analysis.ts).
// Чистые функции над конфигом — питают tuning.html (редактор + live-анализ карт).
// До сих пор не были покрыты ни одним тестом; здесь — инварианты модели и счётчики.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// та же валидная layout-карта, что и в logic.test.mjs: 9 ангаров (3 на услугу),
// по одному открыт, 3 ВПП — эквивалент по экономике обычному уровню кампании.
function layoutLevel(extra = {}) {
  const hangars = [];
  for (const type of ['fuel', 'board', 'repair'])
    for (let i = 0; i < 3; i++) hangars.push({ type, x: 0.1 + i * 0.1, y: 0.2 + i * 0.3, open: i === 0 });
  return Object.assign({
    pace: 1.0,
    objective: { metric: 'served', stars: [22, 26, 30], target: 30 },
    layout: { hangars, runways: [{ y: 0.25 }, { y: 0.5 }, { y: 0.75 }] },
    events: {},
  }, extra);
}

// ---------- счётчики ангаров / направлений ВПП ----------

test('countTotalHangars/countOpenHangars: layout-карта считает по списку ангаров', () => {
  const { game } = boot();
  const lv = layoutLevel();           // 9 ангаров, открыт каждый третий (i===0) → 3 открытых
  assert.equal(game.countTotalHangars(lv), 9);
  assert.equal(game.countOpenHangars(lv), 3);
});

test('countTotalHangars/countOpenHangars: legacy sides считает по Σ slots / Σ open', () => {
  const { game } = boot();
  const L = game.LEVELS[9];           // L10: fuel/board/repair, slots 3 каждый
  const sum = (f) => ['top', 'left', 'bottom'].reduce((a, s) => a + (L.sides[s] ? f(L.sides[s]) : 0), 0);
  assert.equal(game.countTotalHangars(L), sum(c => c.slots), 'всего = сумма slots сторон');
  assert.equal(game.countOpenHangars(L), sum(c => c.open), 'открытых = сумма open сторон');
});

test('countOpenHangars: open !== false считается открытым (open по умолчанию)', () => {
  const { game } = boot();
  const lv = layoutLevel({ layout: {
    hangars: [{ type: 'fuel', x: 0.1, y: 0.2 }, { type: 'board', x: 0.2, y: 0.5, open: false }],
    runways: [{ y: 0.5 }],
  } });
  assert.equal(game.countTotalHangars(lv), 2);
  assert.equal(game.countOpenHangars(lv), 1, 'ангар без флага open считается открытым; open:false — закрыт');
});

test('countOpenRunwayDirections: layout — каждая ВПП даёт 2 конца (взлёт+посадка), флаги *Open урезают', () => {
  const { game } = boot();
  const open3 = layoutLevel();        // 3 ВПП, оба конца открыты → 6
  assert.equal(game.countOpenRunwayDirections(open3), 6);
  const half = layoutLevel({ layout: { hangars: layoutLevel().layout.hangars,
    runways: [{ y: 0.25, takeoffOpen: false }, { y: 0.75 }] } });   // 1+2 = 3
  assert.equal(game.countOpenRunwayDirections(half), 3);
});

test('countOpenRunwayDirections: legacy sides — все ВПП полностью открыты (runways×2)', () => {
  const { game } = boot();
  const L = game.LEVELS[9];           // 3 ВПП
  assert.equal(game.countOpenRunwayDirections(L), L.runways * 2);
});

// ---------- analyzeLevel: инварианты модели ----------

test('analyzeLevel: веса компонентов в сумме дают 1', () => {
  const { game } = boot();
  const r = game.analyzeLevel(game.LEVELS[0]);
  const wsum = r.components.reduce((a, c) => a + c.weight, 0);
  assert.ok(Math.abs(wsum - 1) < 1e-9, `сумма весов должна быть 1, получено ${wsum}`);
});

test('analyzeLevel: total ∈ [0,1] и равен Σ contrib (для каждого уровня кампании)', () => {
  const { game } = boot();
  game.LEVELS.forEach((lv, i) => {
    const r = game.analyzeLevel(lv);
    assert.ok(r.total >= 0 && r.total <= 1, `L${i + 1}: total вне [0,1]: ${r.total}`);
    const csum = Math.min(1, r.components.reduce((a, c) => a + c.contrib, 0));
    assert.ok(Math.abs(r.total - csum) < 1e-9, `L${i + 1}: total ≠ Σ contrib`);
    r.components.forEach(c => {
      assert.ok(c.score >= 0 && c.score <= 1, `L${i + 1}/${c.label}: score вне [0,1]`);
      assert.ok(Math.abs(c.contrib - c.weight * c.score) < 1e-9, `L${i + 1}/${c.label}: contrib ≠ weight×score`);
    });
  });
});

test('analyzeLevel: трафик (pace) — главная ось, отражает levelPace', () => {
  const { game } = boot();
  const r = game.analyzeLevel(game.LEVELS[0]);
  const traffic = r.components.find(c => c.label === 'traffic');
  assert.equal(traffic.weight, 0.30, 'трафик весит 30%');
  assert.equal(traffic.score, r.pace, 'score трафика = levelPace');
});

test('analyzeLevel: больше закрытых ангаров → выше capacity-сложность', () => {
  const { game } = boot();
  const allOpen = layoutLevel({ layout: {
    hangars: layoutLevel().layout.hangars.map(h => Object.assign({}, h, { open: true })),
    runways: [{ y: 0.5 }],
  } });
  const mostLocked = layoutLevel();   // открыт лишь каждый третий
  const cap = (lv) => game.analyzeLevel(lv).components.find(c => c.label === 'capacity').score;
  assert.ok(cap(mostLocked) > cap(allOpen), 'больше закрытых боксов → выше доля locked → сложнее');
  assert.equal(cap(allOpen), 0, 'полностью открытая раскладка — capacity-сложность 0');
});

test('analyzeLevel: race/timed-цель поднимает timePressure', () => {
  const { game } = boot();
  const timed = game.analyzeLevel(layoutLevel({ objective: { metric: 'served', stars: [1, 2, 3], target: 3, time: 300 } }));
  const race = game.analyzeLevel(layoutLevel({ objective: { metric: 'served', stars: [1, 2, 3], target: 3, time: 300, race: true } }));
  const noTime = game.analyzeLevel(layoutLevel());
  const tp = (r) => r.components.find(c => c.label === 'timePressure').score;
  assert.equal(tp(noTime), 0, 'без таймера давления времени нет');
  assert.equal(tp(timed), 0.5, 'таймер → среднее давление');
  assert.equal(tp(race), 1.0, 'гонка → максимум давления');
});

test('analyzeLevel: VIP-событие даёт ненулевой вклад events', () => {
  const { game } = boot();
  const plain = game.analyzeLevel(layoutLevel());
  const vip = game.analyzeLevel(layoutLevel({ events: { vip: true } }));
  const ev = (r) => r.components.find(c => c.label === 'events').score;
  assert.equal(ev(plain), 0);
  assert.ok(ev(vip) > 0, 'VIP должен поднимать компонент events');
});

// ---------- analyzeLevel: мягкие предупреждения (не блокеры) ----------

test('analyzeLevel.warnings: пусто на нормальной карте', () => {
  const { game } = boot();
  assert.deepEqual([...game.analyzeLevel(layoutLevel()).warnings], []);
});

test('analyzeLevel.warnings: ловит «нет открытых ангаров на старте»', () => {
  const { game } = boot();
  const lv = layoutLevel({ layout: {
    hangars: layoutLevel().layout.hangars.map(h => Object.assign({}, h, { open: false })),
    runways: [{ y: 0.5 }],
  } });
  assert.ok(game.analyzeLevel(lv).warnings.some(w => /no open hangars/.test(w)));
});

test('analyzeLevel.warnings: ловит «<2 открытых направлений ВПП»', () => {
  const { game } = boot();
  const lv = layoutLevel({ layout: { hangars: layoutLevel().layout.hangars,
    runways: [{ y: 0.5, takeoffOpen: false, landingOpen: true }] } });   // только 1 конец
  assert.ok(game.analyzeLevel(lv).warnings.some(w => /runway directions/.test(w)));
});

test('analyzeLevel.warnings: ловит отрицательные стартовые деньги', () => {
  const { game } = boot();
  assert.ok(game.analyzeLevel(layoutLevel({ startMoney: -5 })).warnings.some(w => /startMoney is negative/.test(w)));
});

test('analyzeLevel.warnings: высокий темп + почти всё закрыто → «может быть непроходим»', () => {
  const { game } = boot();
  const hangars = [];
  for (let i = 0; i < 10; i++) hangars.push({ type: 'fuel', x: 0.1 + i * 0.05, y: 0.2 + (i % 3) * 0.3, open: i === 0 });
  const lv = layoutLevel({ pace: 0.9, layout: { hangars, runways: [{ y: 0.5 }] } });
  assert.ok(game.analyzeLevel(lv).warnings.some(w => /unwinnable/.test(w)));
});
