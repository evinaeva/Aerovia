// Слой 2: реестр Motion Tuning (src/game/04b-motion-tuning.ts).
// Проверяем экспорт/импорт JSON настроек — особенно «геометрических» MT-параметров
// (зоны захвата боксов и ВПП), чтобы экспортированный из tuning.html JSON гарантированно
// принимался игрой при обратном импорте (значения долетают до MT_META_VALUES, которые
// читают openBayAt/openRunwayAt и слои отрисовки).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const GEO_KEYS = [
  'MT.BAY_GRAB_SHAPE', 'MT.BAY_GRAB_RADIUS', 'MT.BAY_GRAB_OFFSET',
  'MT.RUNWAY_GRAB_SHAPE',
  'MT.RUNWAY_LAND_GRAB_RADIUS', 'MT.RUNWAY_LAND_GRAB_OFFSET',
  'MT.RUNWAY_TAKEOFF_GRAB_RADIUS', 'MT.RUNWAY_TAKEOFF_GRAB_OFFSET',
  'MT.DEBUG_BAY_SNAP_ZONES', 'MT.DEBUG_RUNWAY_SNAP_ZONES',
];

test('MT.export включает геометрические зоны захвата', () => {
  const { game } = boot();
  const dump = JSON.parse(game.MT.export());
  assert.equal(dump.schemaVersion, 2, 'экспорт несёт schemaVersion=2');
  for (const k of GEO_KEYS) {
    assert.ok(k in dump.values, `экспорт содержит ${k}`);
  }
});

test('round-trip export→reset→import восстанавливает значения зон захвата', () => {
  const { game } = boot();
  // выставляем нестандартные значения (числа + булевы тумблеры слоёв)
  game.MT.apply({
    'MT.BAY_GRAB_SHAPE': 'square',
    'MT.BAY_GRAB_RADIUS': 70,
    'MT.BAY_GRAB_OFFSET': -20,
    'MT.RUNWAY_GRAB_SHAPE': 'square',
    'MT.RUNWAY_LAND_GRAB_RADIUS': 55,
    'MT.RUNWAY_LAND_GRAB_OFFSET': 18,
    'MT.RUNWAY_TAKEOFF_GRAB_RADIUS': 40,
    'MT.RUNWAY_TAKEOFF_GRAB_OFFSET': -12,
    'MT.DEBUG_BAY_SNAP_ZONES': true,
    'MT.DEBUG_RUNWAY_SNAP_ZONES': true,
  });
  const json = game.MT.export();

  game.MT.reset();                                   // сбрасываем к дефолтам
  let snap = game.MT.snapshot();
  assert.equal(snap['MT.BAY_GRAB_RADIUS'], 24, 'после reset радиус зоны = дефолт 24 (тач: ловит конец маршрута и въезд у ворот)');
  assert.equal(snap['MT.BAY_GRAB_SHAPE'], 'semicircle', 'после reset форма = дефолт semicircle');
  assert.equal(snap['MT.DEBUG_BAY_SNAP_ZONES'], false, 'после reset слой выключен');

  game.MT.importText(json);                          // импортируем ранее экспортированный JSON
  snap = game.MT.snapshot();
  assert.equal(snap['MT.BAY_GRAB_SHAPE'], 'square', 'форма зоны бокса восстановлена');
  assert.equal(snap['MT.BAY_GRAB_RADIUS'], 70, 'радиус зоны бокса восстановлен');
  assert.equal(snap['MT.BAY_GRAB_OFFSET'], -20, 'смещение зоны бокса восстановлено (отрицательное)');
  assert.equal(snap['MT.RUNWAY_GRAB_SHAPE'], 'square', 'форма зоны ВПП восстановлена');
  assert.equal(snap['MT.RUNWAY_LAND_GRAB_RADIUS'], 55, 'радиус посадочной зоны ВПП восстановлен');
  assert.equal(snap['MT.RUNWAY_LAND_GRAB_OFFSET'], 18, 'смещение посадочной зоны ВПП восстановлено');
  assert.equal(snap['MT.RUNWAY_TAKEOFF_GRAB_RADIUS'], 40, 'радиус взлётной зоны ВПП восстановлен');
  assert.equal(snap['MT.RUNWAY_TAKEOFF_GRAB_OFFSET'], -12, 'смещение взлётной зоны ВПП восстановлено');
  assert.equal(snap['MT.DEBUG_BAY_SNAP_ZONES'], true, 'слой боксов восстановлен');
  assert.equal(snap['MT.DEBUG_RUNWAY_SNAP_ZONES'], true, 'слой ВПП восстановлен');
});

test('импорт числового параметра клампится в [min,max]', () => {
  const { game } = boot();
  game.MT.importText(JSON.stringify({ values: { 'MT.BAY_GRAB_RADIUS': 9999 } }));
  assert.equal(game.MT.snapshot()['MT.BAY_GRAB_RADIUS'], 200, 'выше max → max=200');
  game.MT.importText(JSON.stringify({ values: { 'MT.BAY_GRAB_RADIUS': -5 } }));
  assert.equal(game.MT.snapshot()['MT.BAY_GRAB_RADIUS'], 0, 'ниже min → min=0');
});

test('импорт принимает и «голый» объект значений (без обёртки values)', () => {
  const { game } = boot();
  game.MT.importText(JSON.stringify({ 'MT.BAY_GRAB_RADIUS': 25 }));
  assert.equal(game.MT.snapshot()['MT.BAY_GRAB_RADIUS'], 25, 'значение применено из голого объекта');
});

// Геймплейные точки ВПП/ангара — настраиваются глобально через K.* и должны
// долетать до игры (target:'K'), экспортироваться и восстанавливаться при импорте.
const RW_BAY_POINT_KEYS = ['K.RW_TOUCHDOWN_OFF', 'K.RW_LIFTOFF_OFF', 'K.RW_ALIGN_OFF', 'K.TAKEOFF_ALIGN_OFF', 'K.BAY_APPROACH_DIST'];

test('точки ВПП/ангара: дефолты совпадают с K и пишутся прямо в K (live-геймплей)', () => {
  const { game } = boot();
  const snap = game.MT.snapshot();
  assert.equal(snap['K.RW_TOUCHDOWN_OFF'],  50,  'K.RW_TOUCHDOWN_OFF дефолт 50');
  assert.equal(snap['K.RW_LIFTOFF_OFF'],   -83,  'K.RW_LIFTOFF_OFF дефолт -83');
  assert.equal(snap['K.RW_ALIGN_OFF'],        24, 'K.RW_ALIGN_OFF дефолт 24');
  assert.equal(snap['K.TAKEOFF_ALIGN_OFF'],   30, 'K.TAKEOFF_ALIGN_OFF дефолт 30');
  assert.equal(snap['K.BAY_APPROACH_DIST'],    0, 'K.BAY_APPROACH_DIST дефолт 0');
  game.MT.apply({ 'K.RW_TOUCHDOWN_OFF': 40, 'K.BAY_APPROACH_DIST': 24 });
  assert.equal(game.K.RW_TOUCHDOWN_OFF, 40, 'значение долетело до K (читается симуляцией)');
  assert.equal(game.K.BAY_APPROACH_DIST, 24, 'дистанция подъезда долетела до K');
});

test('точки ВПП/ангара: экспорт→reset→импорт восстанавливает значения', () => {
  const { game } = boot();
  game.MT.apply({ 'K.RW_TOUCHDOWN_OFF': 40, 'K.RW_LIFTOFF_OFF': -30, 'K.RW_ALIGN_OFF': 60, 'K.BAY_APPROACH_DIST': 24,
                  'MT.DEBUG_MOTION_POINTS': true });
  const json = game.MT.export();
  const dump = JSON.parse(json);
  for (const k of RW_BAY_POINT_KEYS) assert.ok(k in dump.values, `экспорт содержит ${k}`);
  assert.ok('MT.DEBUG_MOTION_POINTS' in dump.values, 'экспорт содержит слой точек');

  game.MT.reset();
  assert.equal(game.MT.snapshot()['K.RW_ALIGN_OFF'], 24, 'после reset точка выравнивания = дефолт 24');

  game.MT.importText(json);
  const snap = game.MT.snapshot();
  assert.equal(snap['K.RW_TOUCHDOWN_OFF'], 40, 'точка касания восстановлена');
  assert.equal(snap['K.RW_LIFTOFF_OFF'], -30, 'точка отрыва восстановлена (отрицательная)');
  assert.equal(snap['K.RW_ALIGN_OFF'], 60, 'точка выравнивания восстановлена');
  assert.equal(snap['K.BAY_APPROACH_DIST'], 24, 'дистанция подъезда восстановлена');
  assert.equal(snap['MT.DEBUG_MOTION_POINTS'], true, 'слой точек восстановлен');
});
