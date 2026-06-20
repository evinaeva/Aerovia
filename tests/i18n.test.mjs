// Слой 2: локале-зависимое форматирование чисел/денег и переключение языка
// (src/game/03-i18n.ts). harness даёт navigator.language='en-US' → язык по умолчанию en.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const SAVE_KEY = 'planeflow_save_v1';

test('язык по умолчанию — en (из navigator), detectLang это подтверждает', () => {
  const { game } = boot();
  assert.equal(game.lang, 'en');
  assert.equal(game.detectLang(), 'en');
});

test('fmtNum: en-US группирует тысячи запятой', () => {
  const { game } = boot();
  assert.equal(game.fmtNum(1000), '1,000');
  assert.equal(game.fmtNum(1234567), '1,234,567');
});

test('fmtNum: параметр frac задаёт число знаков после запятой', () => {
  const { game } = boot();
  assert.equal(game.fmtNum(3.5, 2), '3.50');
  assert.equal(game.fmtNum(2, 0), '2');
});

test('fmtMoney: число форматируется и получает валютный суффикс ₿', () => {
  const { game } = boot();
  assert.equal(game.fmtMoney(1000), '1,000 ₿');
  assert.ok(game.fmtMoney(42).endsWith('₿'), 'деньги всегда со знаком валюты');
  assert.ok(game.fmtMoney(1234567).includes(game.fmtNum(1234567)), 'деньги используют fmtNum');
});

test('setLang: меняет текущий язык, переводит строки и переключает локаль чисел', () => {
  const { game, store } = boot();
  const enMoney = game.fmtMoney(1000);
  game.setLang('ru');
  assert.equal(game.lang, 'ru');
  // строки переключились на русские
  assert.equal(game.t('app.title'), game.I18N.ru['app.title']);
  // локаль чисел сменилась → группировка тысяч уже не как в en-US
  assert.notEqual(game.fmtNum(1000), '1,000');
  // суффикс валюты сохраняется на обоих языках
  assert.ok(game.fmtMoney(1000).endsWith('₿') && enMoney.endsWith('₿'));
  // язык сохранён в localStorage
  const saved = JSON.parse(store.get(SAVE_KEY));
  assert.equal(saved.lang, 'ru');
});

test('setLang игнорирует неизвестный код — язык не меняется', () => {
  const { game } = boot();
  game.setLang('zz');
  assert.equal(game.lang, 'en', 'несуществующий язык должен игнорироваться');
});
