// Слой 2: движок достижений (src/game/12-achievements-medals.ts).
// Покрываем то, что не трогает leaderboard.test.mjs (там — только onRank):
// восстановление из сейва, выдачу одноразовых медалей, прогресс накопительных,
// антишумовой лимит RUN_CAP и сборку «Легенды» (checkLegend).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// все «обязательные» для Легенды медали: всё, кроме самой legend, pending и comp
function legendNeeded(game) {
  return game.ACH.defs.filter(d => d.id !== 'legend' && !d.pending && !d.comp).map(d => d.id);
}

test('ACH.init восстанавливает разблокированные медали и статистику из сейва', () => {
  const { game } = boot();
  game.save.ach = ['land1', 'svc1'];
  game.save.stats = { landed: 42 };
  game.ACH.init();
  const list = game.ACH.list();
  assert.ok(list.find(m => m.id === 'land1').got, 'land1 восстановлена');
  assert.ok(list.find(m => m.id === 'svc1').got, 'svc1 восстановлена');
  assert.deepEqual([...list.find(m => m.id === 'land10').prog], [42, 10], 'прогресс виден из статистики');
});

test('ACH.onLand выдаёт land1 за первую посадку и растит статистику', () => {
  const { game } = boot();
  game.ACH.onLevelStart();
  game.ACH.onLand();
  assert.ok(game.save.ach.includes('land1'), 'первая посадка → land1');
  assert.ok(game.save.stats.landed >= 1, 'статистика посадок выросла');
});

test('ACH.list: прогресс накопительных медалей считается из статистики', () => {
  const { game } = boot();
  game.save.stats = { landed: 50, services: 100, earned: 500, vip: 3 };
  game.ACH.init();
  const by = id => game.ACH.list().find(m => m.id === id);
  assert.deepEqual([...by('land10').prog], [50, 10]);
  assert.deepEqual([...by('land100').prog], [50, 100]);
  assert.deepEqual([...by('svc100').prog], [100, 100]);
  assert.deepEqual([...by('earn1000').prog], [500, 1000]);
});

test('ACH.list: прогресс «Легенды» — доля собранных обязательных медалей', () => {
  const { game } = boot();
  const legend = game.ACH.list().find(m => m.id === 'legend');
  assert.equal(legend.prog[1], legendNeeded(game).length, 'знаменатель = число обязательных медалей');
  assert.equal(legend.prog[0], 0, 'на старте ничего не собрано');
});

test('ACH.onLevelEnd: прохождение выдаёт level1; провал — нет', () => {
  const { game } = boot();
  game.ACH.onLevelStart();
  game.ACH.onLevelEnd(false, 0, false);
  assert.ok(!game.save.ach.includes('level1'), 'провал уровня не даёт level1');
  game.ACH.onLevelStart();
  game.ACH.onLevelEnd(true, 1, false);
  assert.ok(game.save.ach.includes('level1'), 'прохождение даёт level1');
});

test('ACH: лимит RUN_CAP=2 медали за раунд; onLevelStart сбрасывает счётчик', () => {
  const { game } = boot();
  game.ACH.onLevelStart();
  game.ACH.onService();   // svc1     (1-я)
  game.ACH.onBayOpen();   // bayopen1 (2-я)
  game.ACH.onLand();      // land1    — третья за раунд, сгорает
  assert.equal(game.save.ach.length, 2, 'за раунд не больше двух медалей');
  assert.ok(!game.save.ach.includes('land1'), 'третья медаль за раунд не выдаётся');
  game.ACH.onLevelStart();
  game.ACH.onLand();      // новый раунд — land1 снова доступна
  assert.ok(game.save.ach.includes('land1'), 'после сброса лимита медали снова идут');
});

test('checkLegend: сбор всех обязательных медалей выдаёт «Легенду»', () => {
  const { game } = boot();
  // всё, кроме land1, уже собрано
  game.save.ach = legendNeeded(game).filter(id => id !== 'land1');
  game.ACH.init();
  game.ACH.onLevelStart();
  assert.ok(!game.save.ach.includes('legend'), 'пока land1 не взят — «Легенды» нет');
  game.ACH.onLand();      // выдаёт land1 → набор полон → checkLegend → legend
  assert.ok(game.save.ach.includes('land1'));
  assert.ok(game.save.ach.includes('legend'), 'полный набор обязательных медалей выдаёт «Легенду»');
});

test('checkLegend: при недостающей медали «Легенда» не выдаётся', () => {
  const { game } = boot();
  // не хватает двух (land1 и svc1); onLand закроет только land1
  game.save.ach = legendNeeded(game).filter(id => id !== 'land1' && id !== 'svc1');
  game.ACH.init();
  game.ACH.onLevelStart();
  game.ACH.onLand();
  assert.ok(game.save.ach.includes('land1'));
  assert.ok(!game.save.ach.includes('legend'), 'svc1 не собран → «Легенды» нет');
});
