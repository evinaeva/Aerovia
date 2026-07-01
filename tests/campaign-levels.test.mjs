// Генерируемая кампания L12–L50 (скелеты CAMPAIGN_PLAN в 04-config-levels.ts, сборщик в
// 14-level-analysis.ts): вместо бывших клонов L2 — настоящие уровни из кривой
// campaignTarget + ротации акцентов archetypeForIndex + autoDifficulty.
// Здесь — инварианты собранной кампании; сами инструменты покрыты star-conditions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const HANDMADE = 11;   // L1–L11 рукописные; дальше — сборка из скелетов

test('кампания собрана: ровно 50 уровней, клонов-заглушек больше нет', () => {
  const { game } = boot();
  assert.equal(game.LEVELS.length, 50, 'кампания из 50 уровней (11 рукописных + 39 собранных)');
  const gen = game.LEVELS.slice(HANDMADE);
  // бывшие клоны были sides-уровнями с одинаковыми stars [8,10,12] — собранные уровни
  // все на явном layout и с разными порогами
  gen.forEach((lv, i) => {
    assert.ok(lv.layout && Array.isArray(lv.layout.hangars), `L${HANDMADE + i + 1}: собранный уровень должен иметь явный layout`);
    assert.ok(!lv.sides, `L${HANDMADE + i + 1}: собранный уровень не использует legacy sides`);
  });
  const starSets = new Set(gen.map(lv => JSON.stringify(lv.objective.stars)));
  assert.ok(starSets.size >= 20, `пороги звёзд различаются между уровнями (уникальных наборов: ${starSets.size})`);
  const laySets = new Set(gen.map(lv => lv.layout.hangars.length + ':' + lv.layout.runways.length));
  assert.ok(laySets.size >= 4, `раскладки разнообразны (уникальных форм: ${laySets.size})`);
});

test('каждый собранный уровень проходим по validatePassable (все три тира)', () => {
  const { game } = boot();
  game.LEVELS.slice(HANDMADE).forEach((lv, i) => {
    const rep = game.validatePassable(lv);
    assert.equal(rep.ok, true, `L${HANDMADE + i + 1} непроходим: ${JSON.stringify(rep)}`);
  });
});

test('события: на каждом собранном уровне есть спецборты; medical всегда при услуге board', () => {
  const { game } = boot();
  game.LEVELS.slice(HANDMADE).forEach((lv, i) => {
    const n = HANDMADE + i + 1;
    const active = game.EVENT_KEYS.filter(k => (lv.events || {})[k]);
    assert.ok(active.length >= 1, `L${n}: после туториала уровень без единого события — пустовато`);
    assert.ok(!lv.events.fog && !lv.events.wind, `L${n}: туман/ветер глобально выключены (WEATHER_EVENTS_OFF)`);
    if (lv.events.medical)
      assert.ok(lv.layout.hangars.some(h => h.type === 'board'), `L${n}: medical требует ангар board`);
  });
});

test('капстоуны L20/30/40/50: акцент flawless, все четыре спецборта, target у максимума', () => {
  const { game } = boot();
  for (const n of [20, 30, 40, 50]) {
    const lv = game.LEVELS[n - 1];
    assert.equal(lv.archetype, 'flawless', `L${n}: капстоун должен идти с акцентом flawless`);
    for (const k of ['vip', 'emergency', 'rush', 'medical'])
      assert.ok(lv.events[k], `L${n}: капстоун включает "${k}"`);
    assert.ok(lv.target >= game.K.CURVE.plateauHeight, `L${n}: капстоун выше плато (${lv.target})`);
  }
});

test('кривая: target собранных уровней следует campaignTarget, pace = target', () => {
  const { game } = boot();
  game.LEVELS.slice(HANDMADE).forEach((lv, i) => {
    const n = HANDMADE + i + 1;
    // скелет может точечно переопределить target (сейчас — только финальный L50 на 1.0),
    // но не ниже кривой; остальные берут campaignTarget(n) как есть
    if (lv.target !== game.campaignTarget(n))
      assert.ok(lv.target > game.campaignTarget(n), `L${n}: override target только вверх от кривой`);
    assert.ok(Math.abs(lv.pace - +lv.target.toFixed(2)) < 1e-9, `L${n}: pace (${lv.pace}) = target (${lv.target})`);
    assert.equal(lv.archetype, game.archetypeForIndex(n), `L${n}: акцент из ротации`);
  });
});

test('пол фрустрации: 1★ ни на одном уровне не требует нулевой чистоты', () => {
  const { game } = boot();
  game.LEVELS.forEach((lv, i) => {
    const o = lv.objective;
    if (o.maxLate) assert.ok(o.maxLate[0] >= 1, `L${i + 1}: maxLate 1★ должен допускать хотя бы одну просрочку`);
    if (o.maxCrash) assert.ok(o.maxCrash[0] >= 1, `L${i + 1}: maxCrash 1★ должен допускать хотя бы одно крушение`);
  });
  // и напрямую у генератора на максимальной строгости (капстоун + flawless)
  const k = game.autoDifficulty(1.0, undefined, { archetype: 'flawless' });
  assert.ok(k.objective.maxLate[0] >= 1, 'autoDifficulty(1.0, flawless): maxLate 1★ ≥ 1');
  assert.ok(k.objective.maxCrash[0] >= 1, 'autoDifficulty(1.0, flawless): maxCrash 1★ ≥ 1');
});

test('цены заштампованы на раскладку: закрытые ангары/направления имеют цену покупки', () => {
  const { game } = boot();
  game.LEVELS.slice(HANDMADE).forEach((lv, i) => {
    const n = HANDMADE + i + 1;
    lv.layout.hangars.forEach(h => {
      if (h.open === false) assert.ok(h.openCost > 0, `L${n}: закрытый ангар без openCost`);
    });
    lv.layout.runways.forEach(rw => {
      if (rw.landingOpen === false) assert.ok(rw.landingCost > 0, `L${n}: закрытая посадка без landingCost`);
      if (rw.takeoffOpen === false) assert.ok(rw.takeoffCost > 0, `L${n}: закрытый взлёт без takeoffCost`);
    });
  });
});
