// Слои 1–2: рантайм-валидатор конфига + юнит-логика.
// Запуск: `npm test` (Node, без браузера — работает офлайн в этом окружении).
//
// Цель тестов — страховка под новые механики: при добавлении уровня / события /
// правила сразу падать, если сломано или конфликтует со старым поведением.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const SAVE_KEY = 'planeflow_save_v1';
const LEGACY_KEY = 'tower_save_v1';

// ---------- Слой 1: самопроверка конфига ----------

test('игра грузится и выставляет тест-API без ошибок в консоли', () => {
  const { game, consoleErrors } = boot();
  assert.ok(game, '__GAME должен быть выставлен при ?test=1');
  assert.deepEqual(consoleErrors, [], 'на старте не должно быть console.error (включая жалобы валидатора)');
});

test('validateGame() не находит проблем в текущем конфиге', () => {
  const { game } = boot();
  // массив приходит из vm-реалма (другой Array.prototype), поэтому проверяем
  // содержимое, а не deepStrictEqual против [] главного реалма
  const problems = [...game.validateGame()];
  assert.deepEqual(problems, [], 'конфиг уровней/i18n должен быть валиден');
});

test('validateLevels ловит поломку: L1 с событием — это ошибка', () => {
  const { game } = boot();
  game.LEVELS[0].events = { vip: true };          // имитируем «сломанную» правку
  const problems = game.validateLevels();
  assert.ok(problems.some(p => /L1.*без событий/.test(p)), 'L1 с событием должен отлавливаться');
});

test('validateLevels ловит поломку: событие, введённое не на границе 3 уровней', () => {
  const { game } = boot();
  game.LEVELS[1].events = { fog: true };           // L2 — не граница блока
  const problems = game.validateLevels();
  assert.ok(problems.some(p => /каждые 3 уровня/.test(p)), 'нарушение шага в 3 уровня должно отлавливаться');
});

test('validateLevels ловит битый конфиг уровня (нет objective / плохой бокс)', () => {
  const { game } = boot();
  game.LEVELS[1] = { sides: { top: { type: 'oops', slots: 0, open: 5 } }, runways: 0 };
  const problems = game.validateLevels();
  assert.ok(problems.length >= 4, 'битый уровень должен дать несколько проблем, получено: ' + problems.length);
});

test('validateI18n ловит ключ, забытый в одном из языков', () => {
  const { game } = boot();
  delete game.I18N.ru['level.t.5'];                // «забыли перевод»
  const problems = game.validateI18n();
  assert.ok(problems.some(p => /ru.*level\.t\.5/.test(p)), 'недостающий перевод должен отлавливаться');
});

// ---------- Атмосфера: «часы» суток + движок погоды (чистая логика) ----------

test('validateConfig() не находит проблем в текущих константах атмосферы', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateConfig()], []);
});

test('dayCycle: фаза в [0,1), «ночность» в [0,1], полдень=0 / полночь=1', () => {
  const { game } = boot();
  const P = game.K.DAYNIGHT_PERIOD;
  for (const time of [0, P * 0.13, P * 0.5, P * 0.87, P, P * 3.4, -P * 0.2]) {
    const { phase, night } = game.dayCycle(time);
    assert.ok(phase >= 0 && phase < 1, `phase вне [0,1) при t=${time}: ${phase}`);
    assert.ok(night >= 0 && night <= 1, `night вне [0,1] при t=${time}: ${night}`);
  }
  assert.ok(Math.abs(game.dayCycle(0).night - 0) < 1e-9, 'старт смены — день (night≈0)');
  assert.ok(Math.abs(game.dayCycle(P / 2).night - 1) < 1e-9, 'середина периода — ночь (night≈1)');
  assert.ok(Math.abs(game.dayCycle(P).phase - game.dayCycle(0).phase) < 1e-9, 'цикл замыкается');
});

test('weatherTaxiMult: ясно=1, снег мешает сильнее дождя, оба < ясной погоды', () => {
  const { game } = boot();
  const clear = game.weatherTaxiMult('clear');
  const rain = game.weatherTaxiMult('rain');
  const snow = game.weatherTaxiMult('snow');
  assert.equal(clear, 1);
  assert.ok(snow < rain && rain < clear, `ожидалось snow<rain<1, получено ${snow}<${rain}<${clear}`);
});

test('WEATHER_KINDS включает clear/rain/snow', () => {
  const { game } = boot();
  for (const k of ['clear', 'rain', 'snow']) assert.ok(game.WEATHER_KINDS.includes(k), `нет "${k}"`);
});

test('погода — opt-in: ни один уровень кампании не включает её по умолчанию', () => {
  const { game } = boot();
  for (let i = 0; i < game.LEVELS.length; i++) {
    assert.ok(!game.LEVELS[i].weather, `L${i + 1} не должен включать погоду в MVP-кампании`);
  }
});

test('validateLevels ловит битый флаг weather', () => {
  const { game } = boot();
  game.LEVELS[1].weather = 'snow';                 // должно быть true, а не строка
  assert.ok(game.validateLevels().some(p => /weather/.test(p)), 'битый флаг weather должен отлавливаться');
});

// ---------- MVP-аэропорт: лес + погода + зимний геймплей ----------

test('MVP-аэропорт (forest) объединяет лес и погоду', () => {
  const { game } = boot();
  const forest = game.BIOMES.find(b => b.id === 'forest');
  assert.ok(forest && forest.ready, 'лесной биом — готовый MVP-аэропорт');
  assert.equal(forest.level.biome, 'forest', 'лесные помехи (бобёр/дерево/олень/птицы)');
  assert.equal(forest.level.weather, true, 'на нём включён движок погоды (дождь/снег)');
});

test('снег чистит снегоуборщик (snow → plow)', () => {
  const { game } = boot();
  assert.equal(game.neededCrew({ kind: 'snow' }), 'plow');
  // лесные помехи не сломаны прежним маппингом
  assert.equal(game.neededCrew({ kind: 'tree', fallen: false }), 'chainsaw');
  assert.equal(game.neededCrew({ kind: 'tree', fallen: true }), 'truck');
  assert.equal(game.neededCrew({ kind: 'deer' }), 'truck');
  assert.equal(game.neededCrew({ kind: 'birds' }), 'eagle');
});

test('у снегоуборщика и снежной помехи есть строки на обоих языках', () => {
  const { game } = boot();
  for (const c of ['en', 'ru']) {
    assert.ok(game.I18N[c]['forest.snow'], `${c}: нет forest.snow`);
    assert.ok(game.I18N[c]['forest.crew.plow'], `${c}: нет forest.crew.plow`);
  }
});

// ---------- Де-айсинг: отдельный бокс на MVP-аэропорте ----------

test('MVP-аэропорт несёт отдельный бокс де-айсинга', () => {
  const { game } = boot();
  const forest = game.BIOMES.find(b => b.id === 'forest');
  assert.equal(forest.level.deice, true, 'на лесном аэропорте есть де-айс-бокс');
  assert.ok(game.SVC.deice, 'у де-айсинга есть сервисный тип (SVC.deice)');
});

test('де-айсинг — отдельная инфраструктура, не обычная сторона-бокс', () => {
  const { game } = boot();
  // deice НЕ среди покупаемых сторон (top/left/bottom) — это отдельный всегда-открытый бокс
  assert.ok(!game.SVC_TYPES.includes('deice'), 'deice не должен быть типом обычной стороны');
});

test('у де-айсинга есть строки на обоих языках', () => {
  const { game } = boot();
  for (const c of ['en', 'ru']) assert.ok(game.I18N[c]['svc.deice'], `${c}: нет svc.deice`);
});

test('validateLevels ловит битый флаг deice', () => {
  const { game } = boot();
  game.LEVELS[1].deice = 1;                         // должно быть true
  assert.ok(game.validateLevels().some(p => /deice/.test(p)), 'битый флаг deice должен отлавливаться');
});

// ---------- Уровни и прогрессия ----------

test('ровно 10 уровней', () => {
  const { game } = boot();
  assert.equal(game.LEVELS.length, 10);
});

test('L1 — обучающий: без единого события', () => {
  const { game } = boot();
  const ev = game.LEVELS[0].events || {};
  for (const k of game.EVENT_KEYS) assert.ok(!ev[k], `L1 не должен включать "${k}"`);
});

test('новое событие появляется только каждые 3 уровня (L4, L7, L10, …)', () => {
  const { game } = boot();
  const firstSeen = {};
  game.LEVELS.forEach((lv, i) => {
    const ev = lv.events || {};
    for (const k of game.EVENT_KEYS) if (ev[k] && firstSeen[k] == null) firstSeen[k] = i;
  });
  const intro = Object.values(firstSeen);
  assert.ok(intro.length >= 3, 'к L10 должно открыться минимум 3 события');
  for (const [k, i] of Object.entries(firstSeen)) {
    assert.equal(i % 3, 0, `событие "${k}" введено на L${i + 1} — не на границе блока`);
    assert.ok(i >= 3, `событие "${k}" не должно появляться раньше L4 (L1 — обучение)`);
  }
});

// ---------- Гейтинг событий (levelEvents) ----------

test('levelEvents отражает конфиг уровня (не в Zen)', () => {
  const { game } = boot();
  game.zen = false;
  game.LEVELS.forEach((lv, i) => {
    game.setLevel(i);
    const e = game.levelEvents(), cfg = lv.events || {};
    for (const k of game.EVENT_KEYS) assert.equal(!!e[k], !!cfg[k], `L${i + 1}: событие "${k}"`);
  });
});

test('Zen: все спецборты включены, динамических событий нет', () => {
  const { game } = boot();
  game.zen = true;
  const e = game.levelEvents();
  assert.deepEqual(
    { vip: e.vip, emergency: e.emergency, medical: e.medical, rush: e.rush, fog: e.fog, wind: e.wind },
    { vip: true, emergency: true, medical: true, rush: false, fog: false, wind: false },
  );
});

test('L4 открывает только VIP; L7 — час пик; L10 — медицинский (как задумано)', () => {
  const { game } = boot();
  game.zen = false;
  game.setLevel(3); assert.ok(game.levelEvents().vip && !game.levelEvents().rush, 'L4 = VIP');
  game.setLevel(6); assert.ok(game.levelEvents().rush, 'L7 = час пик');
  game.setLevel(9); assert.ok(game.levelEvents().medical, 'L10 = медицинский');
});

// ---------- i18n / описания целей ----------

test('у каждого уровня описание цели собирается без «дыр» {placeholder}', () => {
  const { game } = boot();
  for (let i = 0; i < game.LEVELS.length; i++) {
    game.setLevel(i);
    const d = game.objectiveDesc();
    assert.equal(typeof d, 'string');
    assert.ok(d.length > 0, `L${i + 1}: пустое описание цели`);
    assert.ok(!d.includes('{'), `L${i + 1}: незаполненный плейсхолдер в "${d}"`);
  }
});

test('имена уровней локализуются, для несуществующего — общий фолбэк', () => {
  const { game } = boot();
  assert.equal(game.levelName(0), 'Training');           // язык по умолчанию — en
  assert.match(game.levelName(999), /Level 1000/);       // фолбэк на «Level N»
});

// ---------- Звёзды / завершение уровня (реальный путь recordResult) ----------

test('звёзды: цель + чистое прохождение = 3★, открывается следующий уровень', () => {
  const { game, store } = boot();
  const r = game.simulateResult({ level: 0, served: 6 });   // L1 target = 6
  assert.equal(r.stars, 3);
  assert.equal(r.unlocked, 2, 'после ≥1★ открывается L2');
  const saved = JSON.parse(store.get(SAVE_KEY));
  assert.equal(saved.unlocked, 2, 'прогресс должен сохраниться в localStorage');
});

test('звёзды: цель не выполнена = 0★, следующий уровень не открывается', () => {
  const { game } = boot();
  const r = game.simulateResult({ level: 0, served: 5 });   // 5 < 6
  assert.equal(r.stars, 0);
  assert.equal(r.unlocked, 1);
});

test('звёзды снимаются за штрафы и краши', () => {
  const { game } = boot();
  assert.equal(game.simulateResult({ level: 0, served: 6, penalties: 1 }).stars, 2);
  assert.equal(boot().game.simulateResult({ level: 0, served: 6, crashes: 1 }).stars, 2);
  assert.equal(boot().game.simulateResult({ level: 0, served: 6, penalties: 1, crashes: 1 }).stars, 1);
});

test('цель-апгрейды считается по своей метрике', () => {
  const { game } = boot();
  // L3 (index 2) — метрика upgrades, target 4; «принятые» борта не должны засчитываться
  assert.equal(game.simulateResult({ level: 2, served: 99, upgrades: 0 }).stars, 0);
  assert.equal(boot().game.simulateResult({ level: 2, upgrades: 4 }).stars, 3);
});

test('открытие уровней не вылезает за пределы списка', () => {
  const { game } = boot();
  const r = game.simulateResult({ level: 9, served: 24 });  // последний уровень
  assert.equal(r.unlocked, 10, 'unlocked не должен превышать LEVELS.length');
});

// ---------- Сейв: загрузка и миграция ----------

test('загрузка существующего сейва (новый ключ)', () => {
  const { game } = boot({ [SAVE_KEY]: JSON.stringify({ unlocked: 4, stars: { 0: 2 } }) });
  assert.equal(game.save.unlocked, 4);
  assert.equal(game.save.stars[0], 2);
});

test('миграция со старого ключа tower_save_v1', () => {
  const { game } = boot({ [LEGACY_KEY]: JSON.stringify({ unlocked: 5, stars: { 1: 3 } }) });
  assert.equal(game.save.unlocked, 5, 'прогресс старого сейва не должен сгорать');
  assert.equal(game.save.stars[1], 3);
});

test('новый ключ имеет приоритет над старым', () => {
  const { game } = boot({
    [SAVE_KEY]: JSON.stringify({ unlocked: 7 }),
    [LEGACY_KEY]: JSON.stringify({ unlocked: 2 }),
  });
  assert.equal(game.save.unlocked, 7);
});
