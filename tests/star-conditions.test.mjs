// Расширенная модель условий на звёзды (referenced: docs/design/game-design/star-conditions.md):
// доп-условия тиров (money/lives/timeTier/maxLate/maxCrash), метрика survival, экон-ручка
// minUp, авто-сложность и валидатор проходимости. Чистая логика над конфигом + computeStars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// валидный layout-уровень (9 ангаров, 3 ВПП) — годится для validateLevels/economy
function layoutLevel(extra = {}) {
  const hangars = [];
  for (const type of ['fuel', 'board', 'repair'])
    for (let i = 0; i < 3; i++) hangars.push({ type, x: 0.1 + i * 0.1, y: 0.2 + i * 0.3, open: i === 0 });
  return Object.assign({
    pace: 0.5,
    objective: { metric: 'served', stars: [10, 20, 30], target: 30 },
    layout: { hangars, runways: [{ y: 0.25 }, { y: 0.5 }, { y: 0.75 }] },
    events: {},
  }, extra);
}
// синтетический sides-уровень (как в logic.test.mjs) — для computeStars через simulateResult
function objLevel(objective) {
  return { pace: 0.5, objective,
    sides: { top: { type: 'fuel', slots: 3, open: 1 }, left: { type: 'board', slots: 3, open: 1 }, bottom: { type: 'repair', slots: 3, open: 1 } },
    runways: 3, events: {} };
}

// ---------- computeStars: доп-условия тиров (AND) ----------

test('computeStars: порог денег гейтит звезду (борта набраны, денег нет)', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'served', stars: [10, 10, 10], target: 10, money: [0, 100, 200] });
  // борта на 10 (хватает на все три по числу), денег 150 → 2★ (≥100), но не 3★ (<200)
  assert.equal(game.simulateResult({ level: 8, served: 10, money: 150 }).stars, 2);
  assert.equal(game.simulateResult({ level: 8, served: 10, money: 250 }).stars, 3);
  assert.equal(game.simulateResult({ level: 8, served: 10, money: 0 }).stars, 1);
});

test('computeStars: порог оставшихся жизней гейтит звезду', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'served', stars: [10, 10, 10], target: 10, lives: [1, 2, 3] });
  assert.equal(game.simulateResult({ level: 8, served: 10, lives: 3 }).stars, 3);
  assert.equal(game.simulateResult({ level: 8, served: 10, lives: 2 }).stars, 2);
  assert.equal(game.simulateResult({ level: 8, served: 10, lives: 0 }).stars, 0, 'жизней меньше порога 1★ → 0★');
});

test('computeStars: timeTier — быстрее закрыл, выше звезда (≤ время)', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'served', stars: [10, 10, 10], target: 10, timeTier: [300, 200, 100] });
  assert.equal(game.simulateResult({ level: 8, served: 10, time: 90 }).stars, 3, 'за 90с ≤ все пороги → 3★');
  assert.equal(game.simulateResult({ level: 8, served: 10, time: 150 }).stars, 2, '150с ≤200 но >100 → 2★');
  assert.equal(game.simulateResult({ level: 8, served: 10, time: 250 }).stars, 1);
});

test('computeStars: maxLate / maxCrash — порог «чистоты» (≤ просрочек/крушений)', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'served', stars: [10, 10, 10], target: 10, maxLate: [9, 3, 0], maxCrash: [9, 9, 0] });
  assert.equal(game.simulateResult({ level: 8, served: 10, penalties: 0, crashes: 0 }).stars, 3, 'чисто → 3★');
  assert.equal(game.simulateResult({ level: 8, served: 10, penalties: 2, crashes: 0 }).stars, 2, '2 просрочки → не 3★');
  assert.equal(game.simulateResult({ level: 8, served: 10, penalties: 0, crashes: 1 }).stars, 2, '1 крушение → не 3★');
});

test('computeStars: без доп-условий поведение прежнее (только по числу)', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'served', stars: [5, 7, 9], target: 9 });
  assert.equal(game.simulateResult({ level: 8, served: 8, money: 0, lives: 0, penalties: 5, crashes: 5 }).stars, 2,
    'деньги/жизни/штрафы не влияют, пока соответствующие пороги не заданы');
});

// ---------- метрика survival ----------

test('metricValue/computeStars: survival меряет секунды (floor gameTime)', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'survival', stars: [60, 120, 180], target: 180 });
  assert.equal(game.simulateResult({ level: 8, time: 130 }).stars, 2, 'дожил до 130с → 2★ (≥120, <180)');
  assert.equal(game.simulateResult({ level: 8, time: 200 }).stars, 3);
  assert.equal(game.simulateResult({ level: 8, time: 30 }).stars, 0);
});

// ---------- экон-ручка minUp ----------

test('levelMinUp: зажат в [0, maxUp]; экономика учитывает вилку апгрейда', () => {
  const { game } = boot();
  assert.equal(game.levelMinUp({ minUp: 9, maxUp: 3 }), 3, 'minUp не больше maxUp');
  assert.equal(game.levelMinUp({ maxUp: 3 }), 0, 'умолчание 0');
  const base = game.levelEconomy(layoutLevel());                      // minUp не задан = 0
  const explicit0 = game.levelEconomy(layoutLevel({ minUp: 0 }));
  assert.equal(Math.round(base.kitCost), Math.round(explicit0.kitCost), 'minUp:0 не меняет числа');
  const maxed = game.levelEconomy(layoutLevel({ minUp: 5, maxUp: 5 }));
  assert.ok(maxed.kitCost < base.kitCost, 'minUp=maxUp убирает апгрейд-часть набора → дешевле');
});

// ---------- валидатор проходимости ----------

test('validatePassable: непосильная по потоку цель за таймер помечается красным', () => {
  const { game } = boot();
  const lv = layoutLevel({ pace: 1.0, objective: { metric: 'served', stars: [10, 20, 300], target: 300, time: 60 } });
  const rep = game.validatePassable(lv);
  assert.equal(rep.tiers[2].ok, false, '300 бортов за 60с недостижимо');
  assert.equal(rep.tiers[0].ok, true, '10 бортов — посильно');
  assert.equal(rep.ok, false);
});

test('validatePassable: вменяемый бессрочный уровень проходим на все тиры', () => {
  const { game } = boot();
  const rep = game.validatePassable(layoutLevel());                    // [10,20,30], без таймера
  assert.equal(rep.ok, true, JSON.stringify(rep));
});

test('validatePassable: немонотонные пороги и непосильные деньги ловятся', () => {
  const { game } = boot();
  const mono = game.validatePassable(layoutLevel({ objective: { metric: 'served', stars: [10, 5, 30], target: 30 } }));
  assert.equal(mono.tiers[1].ok, false, 'порог 2★ ниже 1★ → красный');
  const rich = game.validatePassable(layoutLevel({ objective: { metric: 'served', stars: [10, 20, 30], target: 30, money: [9e9, 9e9, 9e9] } }));
  assert.ok(rich.tiers.some(tr => !tr.ok), 'нереальный порог денег ловится');
});

// ---------- авто-сложность ----------

test('autoDifficulty: монотонно растёт по target и всегда проходима', () => {
  const { game } = boot();
  const d = x => game.levelDifficulty(game.autoDifficulty(x));
  const d2 = d(0.2), d5 = d(0.5), d9 = d(0.9);
  assert.ok(d2 <= d5 && d5 <= d9, `levelDifficulty монотонна: ${d2} ≤ ${d5} ≤ ${d9}`);
  for (const x of [0, 0.25, 0.5, 0.75, 1]) {
    const lv = Object.assign(layoutLevel(), game.autoDifficulty(x));
    assert.equal(game.validatePassable(lv).ok, true, `auto(${x}) должен быть проходим: ${JSON.stringify(game.validatePassable(lv))}`);
  }
});

test('autoDifficulty: события вводятся ступенчато (низкий — без, высокий — несколько)', () => {
  const { game } = boot();
  const low = game.autoDifficulty(0.1).events || {};
  assert.equal(Object.keys(low).filter(k => low[k]).length, 0, 'на 0.1 спецбортов нет');
  const high = game.autoDifficulty(0.95).events || {};
  ['vip', 'emergency', 'rush', 'medical'].forEach(k => assert.ok(high[k], 'на 0.95 включён ' + k));
  // pace растёт с target
  assert.ok(game.autoDifficulty(0.8).pace >= game.autoDifficulty(0.2).pace);
});

// ---------- валидатор конфига (validateLevels) на новые поля ----------

test('validateLevels: ловит немонотонные доп-массивы и кривой minUp', () => {
  const { game } = boot();
  game.LEVELS[8] = layoutLevel({ objective: { metric: 'served', stars: [10, 20, 30], target: 30, money: [30, 10, 5] } });
  assert.ok(game.validateLevels().some(s => s.includes('money') && s.includes('возрастанию')), 'money по возрастанию');
  game.LEVELS[8] = layoutLevel({ objective: { metric: 'served', stars: [10, 20, 30], target: 30, timeTier: [100, 200, 300] } });
  assert.ok(game.validateLevels().some(s => s.includes('timeTier') && s.includes('убыванию')), 'timeTier по убыванию');
  game.LEVELS[8] = layoutLevel({ maxUp: 2, minUp: 5 });
  assert.ok(game.validateLevels().some(s => s.includes('minUp')), 'minUp в [0, maxUp]');
});

test('validateLevels: метрика survival допустима', () => {
  const { game } = boot();
  game.LEVELS[8] = layoutLevel({ objective: { metric: 'survival', stars: [60, 120, 180], target: 180, time: 180 } });
  assert.ok(!game.validateLevels().some(s => s.includes('L9') && s.includes('метрика')), 'survival — валидная метрика');
});
