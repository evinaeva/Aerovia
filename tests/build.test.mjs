// Слой 0: целостность модульной сборки.
// Игра — один IIFE, распиленный на src/game/01..13 (+ под-модули 08b/09b). Сборка
// склеивает их по ЯВНОМУ списку GAME_ORDER, а не по содержимому папки — поэтому файл,
// добавленный/переименованный мимо GAME_ORDER, молча выпадет из бандла. Этот тест ловит
// расхождение (и проверяет границы IIFE: 01 открывает, 13 закрывает).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GAME_ORDER } from '../scripts/build.mjs';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game');

test('каждый файл src/game подключён в GAME_ORDER сборки (и наоборот)', () => {
  const onDisk = readdirSync(GAME_DIR)
    .filter(f => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'))   // .d.ts — только типы, в бандл не идёт
    .map(f => f.replace(/\.(ts|js)$/, ''))
    .sort();
  const inBuild = [...GAME_ORDER].sort();
  assert.deepEqual(inBuild, onDisk,
    'GAME_ORDER и файлы src/game разошлись — новый/переименованный модуль не подключён в scripts/build.mjs');
});

test('GAME_ORDER открывается модулем 01 и закрывается 13 (границы IIFE)', () => {
  assert.equal(GAME_ORDER[0], '01-bootstrap-theme', '01 должен открывать IIFE');
  assert.equal(GAME_ORDER[GAME_ORDER.length - 1], '13-init', '13 должен закрывать IIFE');
});
