// Геометрия зон захвата ВПП (src/game/08-gameplay.ts → runwayGrabZone/inGrabZone).
// Регресс: раньше зона была полукругом радиуса ~24px у СЕРЕДИНЫ торца, поэтому конец
// маршрута, доведённый к ВЕРХНЕМУ/НИЖНЕМУ краю торца, не подхватывался. Теперь зона —
// полоса во ВЕСЬ торец полосы (по высоте = r.h), а радиус задаёт лишь вылет наружу.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// представительная ВПП: высокая полоса (торец много выше старого радиуса захвата)
const RW = { x: 100, y: 40, w: 300, h: 160, get cy(){ return this.y + this.h/2; } };

test('зона захвата ВПП ловит конец маршрута у любого края торца (во весь торец)', () => {
  const { game } = boot();
  const { runwayGrabZone, inGrabZone } = game;
  game.MT.apply({ 'MT.RUNWAY_GRAB_SHAPE': 'semicircle',
                  'MT.RUNWAY_LAND_GRAB_RADIUS': 24, 'MT.RUNWAY_LAND_GRAB_OFFSET': -13 });

  const z = runwayGrabZone(RW, 'land');
  const edge = RW.x + RW.w;            // посадочный (правый) торец
  // у самого верха и низа торца, у кромки — теперь подхватывается
  assert.ok(inGrabZone(edge, RW.y + 4,        z), 'верх торца захватывается');
  assert.ok(inGrabZone(edge, RW.y + RW.h - 4, z), 'низ торца захватывается');
  assert.ok(inGrabZone(edge, RW.cy,           z), 'центр торца захватывается');
  // выше/ниже самой полосы — уже не зона
  assert.ok(!inGrabZone(edge, RW.y - 10,      z), 'выше торца — мимо');
  assert.ok(!inGrabZone(edge, RW.y + RW.h+10, z), 'ниже торца — мимо');
});

test('радиус ВПП ограничивает только вылет вдоль оси захода (наружу)', () => {
  const { game } = boot();
  const { runwayGrabZone, inGrabZone } = game;
  game.MT.apply({ 'MT.RUNWAY_GRAB_SHAPE': 'semicircle',
                  'MT.RUNWAY_LAND_GRAB_RADIUS': 24, 'MT.RUNWAY_LAND_GRAB_OFFSET': -13 });
  const z = runwayGrabZone(RW, 'land');      // cx = edge-13, наружу (+x) на 24
  const edge = RW.x + RW.w;
  assert.ok( inGrabZone(z.cx + 1,  RW.cy, z), 'чуть наружу от центра полосы — в зоне');
  assert.ok( inGrabZone(z.cx + 24, RW.cy, z), 'на всю длину вылета — ещё в зоне');
  assert.ok(!inGrabZone(z.cx + 30, RW.cy, z), 'дальше вылета — вне зоны');
  assert.ok(!inGrabZone(z.cx - 5,  RW.cy, z), 'с внутренней стороны от центра — вне (полукруг наружу)');
  assert.ok(edge > z.cx, 'центр полосы сдвинут внутрь от торца отрицательным offset');
});

test('квадратная форма ВПП ловит симметрично ±радиус, но тоже во весь торец', () => {
  const { game } = boot();
  const { runwayGrabZone, inGrabZone } = game;
  game.MT.apply({ 'MT.RUNWAY_GRAB_SHAPE': 'square',
                  'MT.RUNWAY_TAKEOFF_GRAB_RADIUS': 30, 'MT.RUNWAY_TAKEOFF_GRAB_OFFSET': 0 });
  const z = runwayGrabZone(RW, 'takeoff');   // левый торец, cx = RW.x
  assert.ok( inGrabZone(z.cx - 28, RW.y + 4,        z), 'внутрь на ±радиус, у верха торца');
  assert.ok( inGrabZone(z.cx + 28, RW.y + RW.h - 4, z), 'наружу на ±радиус, у низа торца');
  assert.ok(!inGrabZone(z.cx + 40, RW.cy,           z), 'дальше радиуса — вне зоны');
});
