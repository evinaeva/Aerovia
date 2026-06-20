// Слой 2: чистый вывод именованного FSM-состояния борта из его флагов
// (src/game/08c-fsm.ts). Функция ничего не читает из состояния игры и не мутирует
// борт — идеальный кандидат на таблицу «флаги → состояние».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

test('planePrimaryState: воздух — ARRIVING на глиссаде, AIRBORNE в ожидании', () => {
  const { game } = boot();
  assert.equal(game.planePrimaryState({ zone: 'air', entering: true }), 'ARRIVING');
  assert.equal(game.planePrimaryState({ zone: 'air', entering: false }), 'AIRBORNE');
});

test('planePrimaryState: ВПП — LANDING / TAKEOFF / ON_RUNWAY по флагам', () => {
  const { game } = boot();
  assert.equal(game.planePrimaryState({ zone: 'runway', landing: true }), 'LANDING');
  assert.equal(game.planePrimaryState({ zone: 'runway', takeoff: true }), 'TAKEOFF');
  assert.equal(game.planePrimaryState({ zone: 'runway' }), 'ON_RUNWAY');
  assert.equal(game.planePrimaryState({ zone: 'runway', landing: true, takeoff: true }), 'LANDING',
    'landing приоритетнее takeoff');
});

test('planePrimaryState: бокс — EXITING_BAY / IN_SERVICE / ENTERING_BAY', () => {
  const { game } = boot();
  assert.equal(game.planePrimaryState({ zone: 'bay', bayPhase: 'out' }), 'EXITING_BAY');
  assert.equal(game.planePrimaryState({ zone: 'bay', bayPhase: 'in', serveMax: 5 }), 'IN_SERVICE');
  assert.equal(game.planePrimaryState({ zone: 'bay', bayPhase: 'in', serveMax: 0 }), 'ENTERING_BAY');
});

test('planePrimaryState: поле — TAXIING с маршрутом, IDLE_FIELD без', () => {
  const { game } = boot();
  assert.equal(game.planePrimaryState({ zone: 'field', path: [{ x: 1, y: 1 }] }), 'TAXIING');
  assert.equal(game.planePrimaryState({ zone: 'field', path: [] }), 'IDLE_FIELD');
  assert.equal(game.planePrimaryState({ zone: 'field' }), 'IDLE_FIELD', 'нет path → IDLE_FIELD');
});

test('planePrimaryState: dead → DEPARTED, перебивает любую зону', () => {
  const { game } = boot();
  assert.equal(game.planePrimaryState({ dead: true, zone: 'bay', bayPhase: 'out' }), 'DEPARTED');
  assert.equal(game.planePrimaryState({ dead: true, zone: 'air', entering: true }), 'DEPARTED');
});

test('planePrimaryState: только читает — объект борта не мутируется', () => {
  const { game } = boot();
  const pl = { zone: 'air', entering: true };
  const before = JSON.stringify(pl);
  game.planePrimaryState(pl);
  assert.equal(JSON.stringify(pl), before, 'функция не должна менять борт');
});
