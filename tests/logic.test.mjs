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
  assert.ok(problems.some(p => /L1.*без спецсобытий/.test(p)), 'L1 с событием должен отлавливаться');
});

test('validateLevels ловит поломку: спецсобытие в спокойном блоке (L1–4)', () => {
  const { game } = boot();
  game.LEVELS[1].events = { fog: true };           // L2 — спокойный блок, событий быть не должно
  const problems = game.validateLevels();
  assert.ok(problems.some(p => /спокойный блок/.test(p)), 'событие в спокойном блоке должно отлавливаться');
});

test('validateLevels ловит битый конфиг уровня (нет objective / плохой бокс)', () => {
  const { game } = boot();
  game.LEVELS[1] = { sides: { top: { type: 'oops', slots: 0, open: 5 } }, runways: 0 };
  const problems = game.validateLevels();
  assert.ok(problems.length >= 4, 'битый уровень должен дать несколько проблем, получено: ' + problems.length);
});

test('validateAch ловит битую медаль (дубль id, битый тир, пустая иконка, нет текста)', () => {
  const { game } = boot();
  game.ACH.defs.push({ id: 'land1', tier: 9, ic: '' });          // дубль id + тир вне [1,5] + пустая иконка
  game.ACH.defs.push({ id: 'zzz_no_text', tier: 1, ic: '🎈' });  // валиден по форме, но без i18n-текста
  const problems = game.validateAch();
  assert.ok(problems.some(p => /дублирующийся id/.test(p)), 'дубль id должен отлавливаться');
  assert.ok(problems.some(p => /tier/.test(p)), 'тир вне [1,5] должен отлавливаться');
  assert.ok(problems.some(p => /иконка/.test(p)), 'пустая иконка должна отлавливаться');
  assert.ok(problems.some(p => /zzz_no_text/.test(p) && /i18n/.test(p)), 'медаль без i18n-текста должна отлавливаться');
});

test('validateAch: чистый реестр без проблем; ловит не-boolean флаг, prog-не-функцию и отсутствие legend', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateAch()], [], 'текущий реестр медалей должен быть валиден');

  game.ACH.defs.push({ id: 'zzz_flags', tier: 2, ic: '🚩', pending: 'yes', prog: 42 });  // флаг-строка, prog-число
  const p = game.validateAch();
  assert.ok(p.some(x => /pending/.test(x)), 'не-boolean флаг должен отлавливаться');
  assert.ok(p.some(x => /prog/.test(x)), 'prog не-функция должна отлавливаться');

  const i = game.ACH.defs.findIndex(d => d.id === 'legend');
  game.ACH.defs.splice(i, 1);                                   // убрать особую медаль legend
  assert.ok(game.validateAch().some(x => /legend/.test(x)), 'отсутствие legend (завязан checkLegend) должно отлавливаться');
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

test('не менее TUTORIAL_COUNT уровней', () => {
  const { game } = boot();
  assert.ok(game.LEVELS.length >= game.K.TUTORIAL_COUNT, `кампания: ожидается ≥${game.K.TUTORIAL_COUNT} уровней, сейчас ${game.LEVELS.length}`);
});

test('L1 — обучающий: без единого события', () => {
  const { game } = boot();
  const ev = game.LEVELS[0].events || {};
  for (const k of game.EVENT_KEYS) assert.ok(!ev[k], `L1 не должен включать "${k}"`);
});

test('L1–4 — спокойный блок без спецсобытий; события вводятся только с L5', () => {
  const { game } = boot();
  const CALM = 4;
  const firstSeen = {};
  game.LEVELS.forEach((lv, i) => {
    const ev = lv.events || {};
    for (const k of game.EVENT_KEYS) if (ev[k] && firstSeen[k] == null) firstSeen[k] = i;
  });
  const intro = Object.values(firstSeen);
  assert.ok(intro.length >= 3, 'к L10 должно открыться минимум 3 события');
  for (const [k, i] of Object.entries(firstSeen)) {
    assert.ok(i >= CALM, `событие "${k}" введено на L${i + 1} — раньше L${CALM + 1} (L1–${CALM} — спокойный блок)`);
  }
  // в самом спокойном блоке (первые CALM уровней) спецсобытий быть не должно
  for (let i = 0; i < CALM; i++) {
    const ev = game.LEVELS[i].events || {};
    for (const k of game.EVENT_KEYS) assert.ok(!ev[k], `L${i + 1} (спокойный блок) не должен включать "${k}"`);
  }
});

test('pace задан на каждом уровне, в [0,1] и НЕ убывает в туториальном блоке', () => {
  const { game } = boot();
  let prev = -1;
  // Монотонность pace гарантируется только в туториальном блоке (L1–TUTORIAL_COUNT).
  // Сгенерированные уровни начинают свою собственную кривую сложности.
  game.LEVELS.slice(0, game.K.TUTORIAL_COUNT).forEach((lv, i) => {
    assert.ok(typeof lv.pace === 'number' && lv.pace >= 0 && lv.pace <= 1,
      `L${i + 1}: pace должен быть числом в [0,1], получено ${lv.pace}`);
    assert.ok(lv.pace >= prev, `L${i + 1}: pace (${lv.pace}) убыл относительно предыдущего (${prev})`);
    prev = lv.pace;
  });
});

// ---------- Гейтинг событий (levelEvents) ----------

test('levelEvents отражает конфиг уровня кампании', () => {
  const { game } = boot();
  game.LEVELS.forEach((lv, i) => {
    game.setLevel(i);
    const e = game.levelEvents(), cfg = lv.events || {};
    for (const k of game.EVENT_KEYS) assert.equal(!!e[k], !!cfg[k], `L${i + 1}: событие "${k}"`);
  });
});

test('Survival (биом): все спецборты включены, динамических событий нет', () => {
  const { game } = boot();
  game.setBiome(game.BIOMES.find(b => b.id === 'forest'));
  const e = game.levelEvents();
  assert.deepEqual(
    { vip: e.vip, emergency: e.emergency, medical: e.medical, rush: e.rush, fog: e.fog, wind: e.wind },
    { vip: true, emergency: true, medical: true, rush: false, fog: false, wind: false },
  );
});

test('L7 дебютирует VIP; L8 — час пик; L10 — медицинский (как задумано)', () => {
  const { game } = boot();
  game.setLevel(6); assert.ok(game.levelEvents().vip && !game.levelEvents().rush, 'L7 = дебют VIP');
  game.setLevel(7); assert.ok(game.levelEvents().rush, 'L8 = дебют часа пик');
  game.setLevel(9); assert.ok(game.levelEvents().medical, 'L10 = дебют медицинского');
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

test('окно целей рендерится иконками для каждого уровня (вызов + звёзды-градация)', () => {
  const { game } = boot();
  for (let i = 0; i < game.LEVELS.length; i++) {
    game.setLevel(i);
    const html = game.goalRowsHTML();
    assert.ok(!html.includes('{'), `L${i + 1}: незаполненный плейсхолдер в окне целей`);
    assert.ok(/class="thresholds"/.test(html), `L${i + 1}: нет таблицы порогов целей`);
    assert.ok(/class="m-subtitle goal-hint"/.test(html), `L${i + 1}: нет строки-подсказки (вызова)`);
    assert.ok(/class="gicon"/.test(html), `L${i + 1}: цели/звёзды должны быть иконками`);
    // ровно три ступени звёзд (строки таблицы порогов)
    assert.equal((html.match(/class="row"/g) || []).length, 3, `L${i + 1}: должно быть 3 ступени звёзд`);
  }
});

test('L3 показывает доп. порог по апгрейдам (🔧) в лестнице звёзд', () => {
  const { game } = boot();
  game.setLevel(2);
  const html = game.goalRowsHTML();
  assert.ok(/req-upg/.test(html), 'на L3 у звёзд должен быть значок апгрейда');
});

test('race-уровень показывает «без лимита» по бортам (∞ в потолке метрики)', () => {
  const { game } = boot();
  // race-метрика поддерживается движком, но в текущей кампании не используется —
  // проверяем на синтетическом уровне: потолок ПО БОРТАМ показывается как ∞
  game.LEVELS[4] = { pace: 0.5, objective: { metric: 'served', stars: [16, 18, 20], target: 20, time: 300, race: true },
    sides: { top: { type: 'fuel', slots: 3, open: 1 }, left: { type: 'board', slots: 3, open: 1 }, bottom: { type: 'repair', slots: 3, open: 1 } },
    runways: 3, events: {} };
  game.setLevel(4);
  const html = game.goalRowsHTML();
  // на race-уровне есть и таймер (⏱ 5:00, не ∞), и потолок бортов = ∞
  assert.ok(html.includes('5:00'), 'на race-уровне показывается таймер');
  assert.ok((html.match(/∞/g) || []).length >= 1, 'потолок бортов на race-уровне — ∞');
});

test('бонус-мир «луг бабочек» рисует цель гусеницей, а не самолётом', () => {
  const { game } = boot();
  const b = game.BONUS.find(x => x.level && x.level.bonus === 'butterfly');
  assert.ok(b, 'должен быть бонус-уровень с темой butterfly');
  game.setBonus(b);
  const html = game.goalRowsHTML();
  assert.ok(/caterpillar/.test(html), 'на лугу бабочек основная иконка — гусеница');
  assert.ok(!/M21 16v-1\.9/.test(html), 'самолётной иконки на лугу быть не должно');
});

test('имена уровней локализуются, для несуществующего — общий фолбэк', () => {
  const { game } = boot();
  assert.equal(game.levelName(0), 'Airport Control');    // язык по умолчанию — en
  assert.match(game.levelName(999), /Level 1000/);       // фолбэк на «Level N»
});

// ---------- Звёзды / завершение уровня (реальный путь recordResult) ----------

test('звёзды-градация: 3★ на потолке открывает следующий уровень', () => {
  const { game, store } = boot();
  const r = game.simulateResult({ level: 0, served: 8 });   // L1 stars [6,7,8] → 8 = 3★
  assert.equal(r.stars, 3);
  assert.equal(r.unlocked, 2, 'после ≥1★ открывается L2');
  const saved = JSON.parse(store.get(SAVE_KEY));
  assert.equal(saved.unlocked, 2, 'прогресс должен сохраниться в localStorage');
});

test('звёзды-градация: пороги L1 [6,7,8] дают 1★/2★/3★', () => {
  const { game } = boot();
  assert.equal(game.simulateResult({ level: 0, served: 6 }).stars, 1);
  assert.equal(boot().game.simulateResult({ level: 0, served: 7 }).stars, 2);
  assert.equal(boot().game.simulateResult({ level: 0, served: 8 }).stars, 3);
  assert.equal(boot().game.simulateResult({ level: 0, served: 9 }).stars, 3, 'выше потолка — всё равно 3★');
});

test('звёзды: ниже порога 1★ = 0★, следующий уровень не открывается', () => {
  const { game } = boot();
  const r = game.simulateResult({ level: 0, served: 5 });   // 5 < 6
  assert.equal(r.stars, 0);
  assert.equal(r.unlocked, 1);
});

test('L3: для 2★/3★ нужны и борты, и апгрейды (доп. порог upg)', () => {
  const { game } = boot();
  // L3 (index 2): stars [10,12,14], upg [0,2,4]
  assert.equal(game.simulateResult({ level: 2, served: 14, upgrades: 0 }).stars, 1, 'без апгрейдов — только 1★');
  assert.equal(boot().game.simulateResult({ level: 2, served: 14, upgrades: 2 }).stars, 2, 'хватает на 2★, но не на 3★');
  assert.equal(boot().game.simulateResult({ level: 2, served: 14, upgrades: 4 }).stars, 3);
  assert.equal(boot().game.simulateResult({ level: 2, served: 9, upgrades: 4 }).stars, 0, 'мало бортов — 0★');
});

test('цель-апгрейды считается по своей метрике upgrades (не по принятым бортам)', () => {
  const { game } = boot();
  // метрика upgrades поддерживается движком, но в текущей кампании не используется —
  // проверяем на синтетическом уровне, что засчитываются апгрейды, а не принятые борты
  const up = { pace: 0.5, objective: { metric: 'upgrades', stars: [5, 6, 7], target: 7 },
    sides: { top: { type: 'fuel', slots: 3, open: 1 }, left: { type: 'board', slots: 3, open: 1 }, bottom: { type: 'repair', slots: 3, open: 1 } },
    runways: 3, events: {} };
  game.LEVELS[8] = up;
  assert.equal(game.simulateResult({ level: 8, served: 99, upgrades: 0 }).stars, 0, 'борты не засчитываются для upgrades-цели');
  assert.equal(game.simulateResult({ level: 8, upgrades: 7 }).stars, 3, '7 апгрейдов — 3★');
});

test('открытие уровней не вылезает за пределы списка', () => {
  const { game } = boot();
  const last = game.LEVELS.length - 1;                       // завершаем ПОСЛЕДНИЙ уровень
  const r = game.simulateResult({ level: last, served: 999 });
  assert.equal(r.unlocked, game.LEVELS.length, 'unlocked не должен превышать LEVELS.length');
});

// ---------- Бонус-уровни (шуточный «другой мир» каждые 5 уровней) ----------

test('validateBonus() не находит проблем в текущем конфиге бонусов', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateBonus()], [], 'конфиг бонус-уровней должен быть валиден');
});

test('бонус заведён после каждого 5-го уровня (5, 10, …) и кратен 5', () => {
  const { game } = boot();
  assert.ok(game.bonusAfter(5), 'должен быть бонус после L5');
  assert.equal(game.bonusAfter(4), null, 'после не-кратного 5 уровня бонуса нет');
  game.BONUS.forEach(b => assert.equal(b.after % 5, 0, 'after должен быть кратен 5'));
});

test('бонус открывается прохождением своего 5-го уровня (≥1★), не двигая кампанию', () => {
  const { game } = boot();
  const b = game.bonusAfter(5);
  assert.equal(game.bonusUnlocked(b), false, 'закрыт, пока L5 не пройден');
  const unlockedBefore = game.save.unlocked;
  game.save.stars[4] = 1;                       // L5 (индекс 4) пройден на 1★
  assert.equal(game.bonusUnlocked(b), true, 'открыт после прохождения L5');
  assert.equal(game.save.unlocked, unlockedBefore, 'статус бонуса не двигает прогресс кампании');
});

test('бонус-уровни вынесены из кампании (LEVELS) — не ломают её длину/прогрессию', () => {
  const { game } = boot();
  assert.ok(game.LEVELS.length >= game.K.TUTORIAL_COUNT, `кампания: ожидается ≥${game.K.TUTORIAL_COUNT} уровней, сейчас ${game.LEVELS.length}`);
  game.LEVELS.forEach(lv => assert.ok(!lv.bonus, 'у уровней кампании нет флага bonus'));
});

test('имя бонуса берётся из темы (bonus.t.<id>) с фолбэком на bonus.name', () => {
  const { game } = boot();
  const b = game.bonusAfter(5);
  assert.equal(game.bonusName(b), game.t('bonus.t.' + b.id), 'тематическое имя из словаря');
});

test('validateBonus ловит поломку: after не кратен 5', () => {
  const { game } = boot();
  game.BONUS[0].after = 4;                       // имитируем «сломанную» правку
  const problems = game.validateBonus();
  assert.ok(problems.some(p => /кратен 5/.test(p)), 'нарушение шага в 5 уровней должно отлавливаться');
});

// ---------- Экономика уровня (levelEconomy) ----------

test('экономика: оплата за услугу в границах [SVC_MIN, SVC_MAX] на всех уровнях', () => {
  const { game } = boot();
  const K = game.K;
  game.LEVELS.forEach((lv, i) => {
    const e = game.levelEconomy(lv);
    assert.ok(e.svcReward >= K.SVC_MIN && e.svcReward <= K.SVC_MAX,
      `L${i + 1}: svcReward ${e.svcReward} вне [${K.SVC_MIN}, ${K.SVC_MAX}]`);
  });
});

test('экономика: смена окупает хотя бы один новый бокс на голой оплате (без комбо)', () => {
  const { game } = boot();
  const K = game.K;
  const avg = 1 + K.TWO_SVC_CHANCE;
  game.LEVELS.forEach((lv, i) => {
    const e = game.levelEconomy(lv);
    const baseEarn = e.svcReward * avg * e.flow;
    assert.ok(baseEarn >= K.BAY_OPEN_COST,
      `L${i + 1}: базового дохода ${Math.round(baseEarn)} не хватит на бокс (${K.BAY_OPEN_COST})`);
  });
});

test('экономика: больше бортов в смене → дешевле оплата за борт (поток гасит цену)', () => {
  const { game } = boot();
  // изолируем ПОТОК: тот же апрон/темп/события, разный target. Больше поток → ниже svc.
  const base = game.LEVELS[3];
  const lo = Object.assign({}, base, { objective: Object.assign({}, base.objective, { stars: [10, 12, 14], target: 14 }) });
  const hi = Object.assign({}, base, { objective: Object.assign({}, base.objective, { stars: [24, 27, 30], target: 30 }) });
  const eLo = game.levelEconomy(lo);
  const eHi = game.levelEconomy(hi);
  assert.ok(eHi.flow > eLo.flow, 'hi принимает больше бортов, чем lo');
  assert.ok(eHi.svcReward <= eLo.svcReward, 'при большем потоке оплата за борт не растёт');
});

test('экономика: голая оплата НЕ покрывает весь набор, но с эффектами — набор достижим', () => {
  const { game } = boot();
  const K = game.K;
  const avg = 1 + K.TWO_SVC_CHANCE;
  // на «среднем» по апрону уровне (L4) голой оплаты не хватает на весь набор, но
  // реальный доход (с комбо/экспрессом) — покрывает: «непросто, но честно»
  const e = game.levelEconomy(game.LEVELS[3]);
  const baseTotal = e.startMoney + e.svcReward * avg * e.flow;
  const realized = e.startMoney + e.svcReward * avg * e.flow * e.skillMult;
  assert.ok(e.skillMult > 1, 'на L4 комбо/экспресс включены → скилл-добор > 1');
  assert.ok(baseTotal < e.kitCost, 'голой оплаты не должно хватать на весь набор');
  assert.ok(realized >= e.kitCost * K.ECON_KIT_FLOOR, 'с эффектами набор должен быть достижим (≥ floor)');
});

test('экономика: с эффектами набор достижим на КАЖДОМ уровне (деньги не блокируют 3★)', () => {
  const { game } = boot();
  const K = game.K;
  const avg = 1 + K.TWO_SVC_CHANCE;
  game.LEVELS.forEach((lv, i) => {
    const e = game.levelEconomy(lv);
    const realized = e.startMoney + e.svcReward * avg * e.flow * e.skillMult;
    assert.ok(realized >= e.kitCost * K.ECON_KIT_FLOOR,
      `L${i + 1}: набор недостижим даже с эффектами (${Math.round(realized)} < ${Math.round(e.kitCost * K.ECON_KIT_FLOOR)})`);
  });
});

test('экономика: сложность растёт со спецсобытиями, таймером и потоком', () => {
  const { game } = boot();
  // спокойный обучающий L1 заметно легче событийного капстоуна L10
  const d1 = game.levelDifficulty(game.LEVELS[0]);
  const d10 = game.levelDifficulty(game.LEVELS[9]);
  assert.ok(d1 < d10, `L1 (${d1.toFixed(2)}) должен быть легче L10 (${d10.toFixed(2)})`);
  // добавление спецсобытия повышает сложность того же уровня
  const base = game.levelDifficulty(game.LEVELS[0]);
  const withEvent = game.levelDifficulty(Object.assign({}, game.LEVELS[0], { events: { medical: true } }));
  assert.ok(withEvent > base, 'спецсобытие должно повышать сложность');
  // сложнее карта → щедрее деньги (компенсация хаоса)
  assert.ok(game.levelEconomy(game.LEVELS[9]).generosity > game.levelEconomy(game.LEVELS[0]).generosity,
    'на сложной карте щедрость должна быть выше');
});

test('сложность растёт с темпом (pace) — он главная ось', () => {
  const { game } = boot();
  const base = game.LEVELS[0];                       // pace 0, без событий
  const faster = Object.assign({}, base, { pace: 0.8 });
  assert.ok(game.levelDifficulty(faster) > game.levelDifficulty(base),
    'выше pace → выше сложность при прочих равных');
});

// ---------- Темп (pace) и воздушное терпение ----------

test('paceInterval: pace 0 → медленно, pace 1 → быстро, монотонно убывает', () => {
  const { game } = boot();
  const K = game.K;
  assert.equal(game.paceInterval(0, 0, false), K.PACE_IVL_SLOW, 'pace 0 → SLOW');
  assert.equal(game.paceInterval(1, 0, false), K.PACE_IVL_FAST, 'pace 1 → FAST');
  assert.ok(game.paceInterval(1, 0, false) < game.paceInterval(0, 0, false), 'выше темп → короче интервал');
  assert.ok(game.paceInterval(0, 10, false) < game.paceInterval(0, 0, false), 'по ходу смены интервал укорачивается');
  assert.ok(game.paceInterval(1, 9999, false) >= K.SPAWN_MIN, 'интервал не падает ниже пола SPAWN_MIN');
  assert.ok(game.paceInterval(0.5, 0, true) < game.paceInterval(0.5, 0, false), 'час пик укорачивает интервал');
});

test('paceCap: pace 0 → CAP_LOW, pace 1 → CAP_HIGH, растёт с темпом', () => {
  const { game } = boot();
  const K = game.K;
  assert.equal(game.paceCap(0), K.PACE_CAP_LOW, 'pace 0 → CAP_LOW');
  assert.equal(game.paceCap(1), K.PACE_CAP_HIGH, 'pace 1 → CAP_HIGH');
  assert.ok(game.paceCap(1) > game.paceCap(0), 'выше темп → больше бортов разом');
});

test('темп кампании: L1 спокойнее L10 и по частоте, и по одновременности', () => {
  const { game } = boot();
  const L = game.LEVELS;
  assert.ok(game.paceInterval(L[0].pace, 0, false) > game.paceInterval(L[9].pace, 0, false), 'на L1 борты прилетают реже, чем на L10');
  assert.ok(game.paceCap(L[0].pace) < game.paceCap(L[9].pace), 'на L1 меньше бортов в небе разом, чем на L10');
});

test('воздушное терпение ФИКСИРОВАНО (30с) и не зависит от уровня/темпа', () => {
  const { game } = boot();
  const K = game.K;
  assert.equal(K.AIR_BASE, 30, 'базовое воздушное окно — 30 секунд');
  assert.equal(game.airPatience({}, 1), K.AIR_BASE, 'обычный борт — ровно AIR_BASE');
  // спецборты урезают окно ФИКСИРОВАННЫМ множителем (одинаково на любом уровне)
  assert.equal(game.airPatience({ vip: true }, 1), K.AIR_BASE * 0.5, 'vip — половина окна');
  assert.equal(game.airPatience({ emergency: true }, 1), K.AIR_BASE * 0.4, 'топливо на нуле — самое короткое окно');
  assert.equal(game.airPatience({ medical: true }, 1), K.AIR_BASE * K.MEDICAL_AIR, 'медицинский — по MEDICAL_AIR');
  // приоритет флагов: emergency важнее vip
  assert.equal(game.airPatience({ vip: true, emergency: true }, 1), K.AIR_BASE * 0.4, 'emergency приоритетнее vip');
  // calm-мир (бонус) растягивает окно; функция вообще не принимает уровень/темп
  assert.ok(game.airPatience({}, 2) > game.airPatience({}, 1), 'calm растягивает терпение');
});

test('экономика: отключение комбо/экспресса поднимает базовую оплату (гибкость под ramp-in)', () => {
  const { game } = boot();
  const L = game.LEVELS[3];   // L4
  const on = game.levelEconomy(L);
  const off = game.levelEconomy(Object.assign({}, L, { combo: false, express: false }));
  assert.equal(on.effects.combo, true);
  assert.equal(off.effects.combo, false);
  assert.equal(off.skillMult, 1, 'без эффектов скилл-добора нет (skillMult = 1)');
  assert.ok(off.svcReward > on.svcReward, 'без комбо/экспресса базовая оплата должна вырасти (компенсация)');
});

test('эффекты: levelEffects по умолчанию включены, отключаются флагами combo/express', () => {
  const { game } = boot();
  // (объекты приходят из vm-реалма — сверяем поля, не deepStrictEqual против main-реалма)
  const def = game.levelEffects({});
  assert.ok(def.combo === true && def.express === true, 'по умолчанию оба включены');
  const noCombo = game.levelEffects({ combo: false });
  assert.ok(noCombo.combo === false && noCombo.express === true);
  const noExpress = game.levelEffects({ express: false });
  assert.ok(noExpress.combo === true && noExpress.express === false);
  // все уровни кампании пока с эффектами (план — убрать с первых позже)
  game.LEVELS.forEach((lv, i) => {
    const fx = game.levelEffects(lv);
    assert.ok(fx.combo && fx.express, `L${i + 1}: эффекты пока включены`);
  });
});

test('экономика: validateLevels ловит сломанную ручку (нереальная оплата → бокс не накопить)', () => {
  const { game } = boot();
  game.K.SVC_MIN = game.K.SVC_MAX = 1;   // ломаем модель: оплата зажата почти в ноль
  const problems = game.validateLevels();
  assert.ok(problems.some(p => /экономика|бокс/.test(p)), 'недостижимая экономика должна отлавливаться');
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

// ---------- Конструктор уровня: layout / services / maxUp ----------

// валидная карта-конструктор, эквивалентная по экономике обычному уровню кампании:
// 9 ангаров (3 на услугу), по одному открыто — те же агрегаты open0/openable, что у
// sides L10. Кладём её последним уровнем (pace 1.0 не ломает монотонность темпа).
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

test('конструктор: валидная layout-карта проходит validateLevels без проблем', () => {
  const { game } = boot();
  game.LEVELS[9] = layoutLevel();
  assert.deepEqual([...game.validateLevels()], []);
});

test('конструктор: апгрейд — 5 уровней (80/160/320/640/1280), глобальный потолок 5', () => {
  const { game } = boot();
  assert.equal(game.K.BAY_MAX_LVL, 5);
  assert.deepEqual([...game.K.BAY_UP_COST], [80, 160, 320, 640, 1280]);
});

test('levelServices: умолчание — все три услуги; явный набор отдаётся как есть', () => {
  const { game } = boot();
  assert.deepEqual([...game.levelServices({})], [...game.SVC_TYPES]);
  assert.deepEqual([...game.levelServices({ services: ['fuel', 'board'] })], ['fuel', 'board']);
});

test('levelMaxUp: умолчание — потолок BAY_MAX_LVL; зажимается в [0, потолок]', () => {
  const { game } = boot();
  assert.equal(game.levelMaxUp({}), game.K.BAY_MAX_LVL);
  assert.equal(game.levelMaxUp({ maxUp: 2 }), 2);
  assert.equal(game.levelMaxUp({ maxUp: 9 }), game.K.BAY_MAX_LVL);  // выше потолка — зажат
  assert.equal(game.levelMaxUp({ maxUp: 0 }), 0);                   // 0 — без апгрейдов
});

test('bayUpCost: открытие, тарифы апгрейда, гашение на потолке и при up:false', () => {
  const { game } = boot();   // LV = L1, maxUp по умолчанию = 5
  const K = game.K;
  assert.equal(game.bayUpCost({ open: false }), K.BAY_OPEN_COST, 'закрытый → цена открытия');
  assert.equal(game.bayUpCost({ open: true, lvl: 0 }), 80, 'ур.1 = 80');
  assert.equal(game.bayUpCost({ open: true, lvl: 3 }), 640, 'ур.4 = 640');
  assert.equal(game.bayUpCost({ open: true, lvl: 5 }), null, 'на потолке апгрейда нет');
  assert.equal(game.bayUpCost({ open: true, up: false, lvl: 0 }), null, 'up:false → апгрейд недоступен');
  assert.equal(game.bayMaxLvl({ open: true }), 5);
  assert.equal(game.bayMaxLvl({ open: true, up: false }), 0);
});

test('конструктор: per-level maxUp срезает потолок апгрейда у всех ангаров', () => {
  const { game } = boot();
  game.LEVELS[9] = layoutLevel({ maxUp: 2 });
  game.setLevel(9);
  assert.equal(game.bayMaxLvl({ open: true }), 2, 'потолок уровня = 2');
  assert.equal(game.bayUpCost({ open: true, lvl: 1 }), 160, 'до ур.2 можно');
  assert.equal(game.bayUpCost({ open: true, lvl: 2 }), null, 'на ур.2 апгрейд исчерпан');
});

test('конструктор: урезанный набор услуг не понижает оплату за услугу', () => {
  const { game } = boot();
  const full = game.levelEconomy(layoutLevel());
  const one = game.levelEconomy(layoutLevel({ services: ['fuel'] }));
  assert.ok(full.svcReward >= game.K.SVC_MIN && full.svcReward <= game.K.SVC_MAX, 'полный набор: оплата в границах');
  assert.ok(one.svcReward >= full.svcReward, 'меньше типов услуг → оплата за услугу не ниже');
});

test('конструктор: validateLevels ловит битый тип ангара', () => {
  const { game } = boot();
  game.LEVELS[9] = layoutLevel({ layout: { hangars: [{ type: 'oops', x: 0.1, y: 0.1 }], runways: [{ y: 0.5 }] } });
  assert.ok(game.validateLevels().some(p => /неизвестный тип ангара/.test(p)));
});

test('конструктор: validateLevels ловит координаты ангара вне [0,1]', () => {
  const { game } = boot();
  const hangars = [{ type: 'fuel', x: 1.5, y: 0.1 }, { type: 'board', x: 0.2, y: 0.2 }, { type: 'repair', x: 0.3, y: 0.3 }];
  game.LEVELS[9] = layoutLevel({ layout: { hangars, runways: [{ y: 0.5 }] } });
  assert.ok(game.validateLevels().some(p => /\[0,1\]/.test(p)));
});

test('конструктор: validateLevels требует хотя бы одну ВПП', () => {
  const { game } = boot();
  game.LEVELS[9] = layoutLevel({ layout: { hangars: layoutLevel().layout.hangars, runways: [] } });
  assert.ok(game.validateLevels().some(p => /хотя бы одну ВПП/.test(p)));
});

test('конструктор: validateLevels требует ангар под каждую заявленную услугу', () => {
  const { game } = boot();
  // только топливные ангары, но в services заявлен и ремонт → ремонт некому обслужить
  const hangars = [{ type: 'fuel', x: 0.1, y: 0.2, open: true }, { type: 'fuel', x: 0.1, y: 0.6 }];
  game.LEVELS[9] = layoutLevel({ services: ['fuel', 'repair'], layout: { hangars, runways: [{ y: 0.5 }] } });
  assert.ok(game.validateLevels().some(p => /нет ни одного ангара этого типа/.test(p)));
});

test('конструктор: validateLevels ловит maxUp вне диапазона', () => {
  const { game } = boot();
  game.LEVELS[9] = layoutLevel({ maxUp: 9 });
  assert.ok(game.validateLevels().some(p => /maxUp/.test(p)));
});

test('конструктор: медицинский борт требует услугу board в наборе', () => {
  const { game } = boot();
  const hangars = [{ type: 'fuel', x: 0.1, y: 0.2, open: true }];
  game.LEVELS[9] = layoutLevel({ services: ['fuel'], events: { medical: true }, layout: { hangars, runways: [{ y: 0.5 }] } });
  assert.ok(game.validateLevels().some(p => /medical.*board/.test(p)));
});

// ---------- sidesToLayout: открыть существующий уровень в конструкторе ----------

test('sidesToLayout: sides → layout (ангары = Σ slots, открытые = Σ open, ВПП = runways, координаты в [0,1])', () => {
  const { game } = boot();
  const L = game.LEVELS[9];   // L10: fuel/board/repair, slots 3 каждый
  const o = game.sidesToLayout(L);
  const sum = (f) => ['top', 'left', 'bottom'].reduce((a, s) => a + (L.sides[s] ? f(L.sides[s]) : 0), 0);
  assert.equal(o.layout.hangars.length, sum(c => c.slots), 'ангаров = сумма slots сторон');
  assert.equal(o.layout.hangars.filter(h => h.open).length, sum(c => c.open), 'открытых ангаров = сумма open сторон');
  assert.equal(o.layout.runways.length, L.runways, 'ВПП = lv.runways');
  const types = new Set(o.layout.hangars.map(h => h.type));
  for (const s of ['top', 'left', 'bottom']) if (L.sides[s]) assert.ok(types.has(L.sides[s].type), 'тип стороны ' + s + ' представлен');
  assert.ok(o.layout.hangars.every(h => h.x >= 0 && h.x <= 1 && h.y >= 0 && h.y <= 1), 'координаты ангаров в [0,1]');
  assert.ok(o.layout.runways.every(r => r.y >= 0 && r.y <= 1), 'y ВПП в [0,1]');
});

test('sidesToLayout: сконвертированный уровень проходит validateLevels (экономика/раскладка валидны)', () => {
  const { game } = boot();
  const o = game.sidesToLayout(game.LEVELS[9]);
  game.LEVELS[9] = Object.assign({ pace: 1.0, objective: { metric: 'served', stars: [22, 26, 30], target: 30 }, events: {} }, o);
  assert.deepEqual([...game.validateLevels()], []);
});

test('levelToEditorObj: уровень с явным layout отдаётся без конвертации', () => {
  const { game } = boot();
  const lay = { hangars: [{ type: 'fuel', x: 0.1, y: 0.1, open: true, up: true }], runways: [{ y: 0.5 }] };
  const o = game.levelToEditorObj({ layout: lay, services: ['fuel'], maxUp: 2 });
  assert.equal(o.layout.hangars.length, 1, 'layout как есть');
  assert.deepEqual([...o.services], ['fuel']);
  assert.equal(o.maxUp, 2);
});

// ---------- Метрика цели (metricValue) и фолбэк порогов звёзд ----------

// синтетический уровень с заданной целью (метрика upgrades в кампании не используется)
function objLevel(objective) {
  return { pace: 0.5, objective,
    sides: { top: { type: 'fuel', slots: 3, open: 1 }, left: { type: 'board', slots: 3, open: 1 }, bottom: { type: 'repair', slots: 3, open: 1 } },
    runways: 3, events: {} };
}

test('metricValue: метрика served возвращает число принятых бортов', () => {
  const { game } = boot();
  game.simulateResult({ level: 0, served: 7 });   // L1 — метрика served
  assert.equal(game.metricValue(), 7);
});

test('metricValue: на upgrades-уровне считаются апгрейды, а не борты', () => {
  const { game } = boot();
  game.LEVELS[8] = objLevel({ metric: 'upgrades', stars: [5, 6, 7], target: 7 });
  game.simulateResult({ level: 8, served: 99, upgrades: 4 });
  assert.equal(game.metricValue(), 4, 'возвращает апгрейды, игнорируя принятые борты');
});

test('звёзды: без массива stars порог берётся из target для всех трёх ступеней', () => {
  const mk = () => {
    const { game } = boot();
    game.LEVELS[8] = objLevel({ metric: 'served', target: 10 });   // нет поля stars
    return game;
  };
  assert.equal(mk().simulateResult({ level: 8, served: 9 }).stars, 0, 'ниже target — 0★');
  assert.equal(mk().simulateResult({ level: 8, served: 10 }).stars, 3, 'на target сразу 3★ (все пороги = target)');
  assert.equal(mk().simulateResult({ level: 8, served: 20 }).stars, 3, 'выше target — всё равно 3★');
});

// ---------- Survival: рекорд карты через реальный recordResult ----------

test('survival: recordResult пишет личный рекорд карты и не двигает кампанию', () => {
  const { game, store } = boot();
  const forest = game.BIOMES.find(b => b.id === 'forest');
  game.setBiome(forest);                  // survival=true, levelKey='b_forest'
  const key = game.levelKey;
  const unlockedBefore = game.save.unlocked;
  game.served = 12; game.recordResult();
  assert.equal(game.save.best[key], 12, 'рекорд карты записан');
  game.served = 5; game.recordResult();
  assert.equal(game.save.best[key], 12, 'худший заход не портит рекорд');
  game.served = 20; game.recordResult();
  assert.equal(game.save.best[key], 20, 'лучший заход обновляет рекорд');
  assert.equal(game.save.unlocked, unlockedBefore, 'survival не двигает прогресс кампании');
  assert.equal(game.save.stars[key], undefined, 'survival не выставляет звёзды кампании');
  // рекорд переживает сохранение в localStorage
  const saved = JSON.parse(store.get(SAVE_KEY));
  assert.equal(saved.best[key], 20);
});

// ---------- следование борта по нарисованному маршруту ----------
// Регрессия: борт должен ехать СТРОГО по полилинии, которую провёл игрок, проходя через
// каждый узел и не срезая углы (тактика игрока завязана на точной траектории). Раньше
// борт «рулил» к точке с ограничением поворота + срезал узлы захватом — на прямоугольном
// маршруте вдоль стен апрона он заметно срезал углы и сходил с линии.

// мин. расстояние от точки до отрезка [a,b]
function distToSeg(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * vx, cy = a.y + t * vy;
  return Math.hypot(p.x - cx, p.y - cy);
}
// мин. расстояние от точки до всей полилинии
function distToPolyline(p, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSeg(p, pts[i], pts[i + 1]));
  return m;
}

// По линии едет НОС борта (pl.noseX/noseY), а pl.x,pl.y — центр корпуса на полкорпуса
// позади (по нему считаются и отрисовка, и столкновения — визуал и физика совпадают).
const nose = pl => ({ x: pl.noseX, y: pl.noseY });

test('followPath: НОС борта идёт строго по нарисованной полилинии, не срезая прямые углы', () => {
  const { game } = boot();
  assert.equal(typeof game.followPath, 'function', 'followPath должен быть выставлен в тест-API');

  // прямоугольный маршрут «вдоль стен апрона»: вниз → вправо → вверх → влево.
  const route = [
    { x: 100, y: 100 }, { x: 100, y: 300 },
    { x: 300, y: 300 }, { x: 300, y: 100 }, { x: 100, y: 100 },
  ];
  const pl = { x: route[0].x, y: route[0].y, ang: Math.PI / 2, autoPath: false, path: route.slice(1) };

  const spd = 60, dt = 1 / 60;
  let maxDev = 0;
  for (let i = 0; i < 5000 && pl.path.length; i++) {
    game.followPath(pl, spd, dt);
    maxDev = Math.max(maxDev, distToPolyline(nose(pl), route));
  }

  // нос ни на одном кадре не отходит от линии больше чем на ~1px — углы не срезаются,
  // борт не сходит с траектории.
  assert.ok(maxDev <= 1.0, `нос сошёл с линии на ${maxDev.toFixed(2)}px (ожидали ≤1px — без среза углов)`);
  assert.equal(pl.path.length, 0, 'маршрут должен быть пройден целиком');
});

test('followPath: НОС проходит точно через каждый нарисованный узел', () => {
  const { game } = boot();
  const route = [
    { x: 0, y: 0 }, { x: 0, y: 50 }, { x: 80, y: 50 }, { x: 80, y: 0 },
  ];
  const pl = { x: route[0].x, y: route[0].y, ang: Math.PI / 2, autoPath: false, path: route.slice(1) };

  const spd = 40, dt = 1 / 60;
  const closest = route.slice(1).map(() => Infinity);
  for (let i = 0; i < 5000 && pl.path.length; i++) {
    game.followPath(pl, spd, dt);
    const n = nose(pl);
    for (let k = 1; k < route.length; k++) {
      closest[k - 1] = Math.min(closest[k - 1], Math.hypot(n.x - route[k].x, n.y - route[k].y));
    }
  }
  for (let k = 0; k < closest.length; k++) {
    assert.ok(closest[k] <= 1.0, `узел #${k + 1} пройден мимо на ${closest[k].toFixed(2)}px`);
  }
});

test('followPath: центр корпуса (он же точка столкновений/отрисовки) держится на полкорпуса позади носа', () => {
  const { game } = boot();
  const route = [{ x: 50, y: 50 }, { x: 50, y: 250 }, { x: 250, y: 250 }];
  const pl = { x: route[0].x, y: route[0].y, ang: Math.PI / 2, autoPath: false, path: route.slice(1) };
  const spd = 60, dt = 1 / 60;
  let halfLen = null;
  for (let i = 0; i < 5000 && pl.path.length; i++) {
    game.followPath(pl, spd, dt);
    // центр строго позади носа вдоль курса: nose = center + off*(cos,sin)
    const dx = pl.noseX - pl.x, dy = pl.noseY - pl.y;
    const along = dx * Math.cos(pl.ang) + dy * Math.sin(pl.ang);   // проекция на курс
    const perp = -dx * Math.sin(pl.ang) + dy * Math.cos(pl.ang);   // боковое смещение
    assert.ok(Math.abs(perp) < 1e-6, `нос сбоку от оси корпуса на ${perp.toFixed(3)} (должен быть строго впереди)`);
    assert.ok(along > 0, 'нос должен быть ВПЕРЕДИ центра по курсу');
    if (halfLen == null) halfLen = along;
    else assert.ok(Math.abs(along - halfLen) < 1e-6, 'смещение нос↔центр должно быть постоянным (полкорпуса)');
  }
  assert.ok(halfLen > 0, 'полкорпуса > 0');
});

test('followPath: авто-маршрут (autoPath) по-прежнему рулит к точке (без точного следования)', () => {
  const { game } = boot();
  // короткий служебный отрезок: борт смотрит вправо, точка строго сверху — при ограничении
  // поворота он НЕ телепортируется на линию, а заворачивает дугой (положение != отрезку).
  const pl = { x: 0, y: 0, ang: 0, autoPath: true, path: [{ x: 0, y: 200 }] };
  const spd = 60, dt = 1 / 60;
  game.followPath(pl, spd, dt);
  // за один кадр борт сместился вперёд по своему курсу (вправо), а не прыгнул вверх к точке
  assert.ok(pl.x > 0, 'autoPath: борт едет по курсу с доворотом, а не кладётся на линию');
});

test('followPath: курс держится по стержню нос→хвост (опора у шасси) — корпус не мотает за нос на изломе', () => {
  const { game } = boot();
  assert.ok(game.K.STEER_TRAIL > 0, 'тест проверяет включённую модель волочения (STEER_TRAIL>0)');
  // Сырой (НЕ сглаженный) маршрут с резким углом 90°: на самом изломе мгновенная
  // касательная у носа прыгает на ~π/2 за один кадр. Если бы курс шёл по ней, корпус
  // «крутили бы за нос». При модели волочения курс доворачивает крошечными шагами.
  const route = [{ x: 50, y: 50 }, { x: 50, y: 250 }, { x: 250, y: 250 }, { x: 250, y: 50 }];
  const p2 = { x: route[0].x, y: route[0].y, ang: Math.PI / 2, autoPath: false, path: route.slice(1) };
  let maxStep = 0, maxLag = 0, prev = null;
  for (let i = 0; i < 5000 && p2.path.length; i++) {
    game.followPath(p2, 60, 1 / 60);
    if (prev != null) {
      let d = p2.ang - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      maxStep = Math.max(maxStep, Math.abs(d));                  // доворот курса за кадр
    }
    prev = p2.ang;
    if (p2.path.length) {                                        // мгновенная касательная у носа
      const n = p2.path[0];
      let lag = p2.ang - Math.atan2(n.y - p2.noseY, n.x - p2.noseX);
      while (lag > Math.PI) lag -= 2 * Math.PI; while (lag < -Math.PI) lag += 2 * Math.PI;
      maxLag = Math.max(maxLag, Math.abs(lag));
    }
  }
  // курс НЕ прыгает: за кадр доворачивает плавно, а не на ~π/2 как сырая касательная
  assert.ok(maxStep < 0.3, `курс прыгнул на ${maxStep.toFixed(2)} рад за кадр (ожидали плавный доворот <0.3)`);
  // на изломе корпус заметно отстаёт от мгновенной касательной у носа (волочение хвоста)
  assert.ok(maxLag > 0.3, `корпус не отстаёт от излома (lag=${maxLag.toFixed(2)}) — модель волочения не работает`);
});

test('followPath: на прямом участке курс сходится к направлению линии (волочение не оставляет перекоса)', () => {
  const { game } = boot();
  // длинная прямая по диагонали: в установившемся режиме хвост встаёт точно за носом,
  // курс совпадает с направлением отрезка — никакого постоянного отставания.
  const route = [{ x: 0, y: 0 }, { x: 600, y: 600 }];
  const pl = { x: 0, y: 0, ang: 0, autoPath: false, path: route.slice(1) };
  const want = Math.atan2(1, 1);
  for (let i = 0; i < 2000 && pl.path.length; i++) game.followPath(pl, 60, 1 / 60);
  // прогоняем ещё немного по той же прямой, добавив дальнюю точку, чтобы дойти до steady state
  pl.path.push({ x: 1200, y: 1200 });
  let ang = pl.ang;
  for (let i = 0; i < 2000 && pl.path.length; i++) { game.followPath(pl, 60, 1 / 60); ang = pl.ang; }
  let d = ang - want; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  assert.ok(Math.abs(d) < 1e-3, `на прямой курс не сошёлся к линии: расхождение ${d.toFixed(4)} рад`);
});

// ---------- сглаживание маршрута (smoothRoute) ----------
test('smoothRoute: проходит через КАЖДЫЙ нарисованный узел (траекторию не меняет)', () => {
  const { game } = boot();
  assert.equal(typeof game.smoothRoute, 'function', 'smoothRoute должен быть выставлен в тест-API');
  const raw = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 0 }];
  const pl = { path: raw.map(p => ({ ...p })) };
  game.smoothRoute(pl);
  // каждый исходный узел присутствует в сглаженном пути точь-в-точь
  for (const o of raw) {
    const hit = pl.path.some(q => Math.hypot(q.x - o.x, q.y - o.y) < 1e-9);
    assert.ok(hit, `узел (${o.x},${o.y}) пропал после сглаживания`);
  }
});

test('smoothRoute: добавляет промежуточные точки и смягчает углы (без выброса за линию)', () => {
  const { game } = boot();
  const raw = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 0 }];
  const pl = { path: raw.map(p => ({ ...p })) };
  game.smoothRoute(pl);
  assert.ok(pl.path.length > raw.length * 2, `ожидали гуще точек, стало ${pl.path.length}`);

  // углы между соседними сегментами стали маленькими (раньше на изломе было 90°)
  let maxTurn = 0;
  for (let i = 1; i < pl.path.length - 1; i++) {
    const a = pl.path[i - 1], b = pl.path[i], c = pl.path[i + 1];
    const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    maxTurn = Math.max(maxTurn, Math.abs(d));
  }
  assert.ok(maxTurn < Math.PI / 3, `излом всё ещё резкий: ${(maxTurn * 180 / Math.PI).toFixed(0)}° (ждали <60°)`);

  // центростремительный сплайн не выскакивает наружу: каждая точка близко к исходной линии
  let maxDev = 0;
  for (const q of pl.path) maxDev = Math.max(maxDev, distToPolyline(q, raw));
  assert.ok(maxDev <= 12, `сглаженная линия отошла от нарисованной на ${maxDev.toFixed(1)}px (ждали ≤12)`);
});
