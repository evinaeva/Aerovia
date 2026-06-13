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

test('validateLevels ловит поломку: спецсобытие в обучающем блоке (L1–6)', () => {
  const { game } = boot();
  game.LEVELS[1].events = { fog: true };           // L2 — обучающий блок, событий быть не должно
  const problems = game.validateLevels();
  assert.ok(problems.some(p => /обучающий блок/.test(p)), 'событие в обучающем блоке должно отлавливаться');
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

test('L1–6 — обучающий блок без спецсобытий; события вводятся только с L7', () => {
  const { game } = boot();
  const firstSeen = {};
  game.LEVELS.forEach((lv, i) => {
    const ev = lv.events || {};
    for (const k of game.EVENT_KEYS) if (ev[k] && firstSeen[k] == null) firstSeen[k] = i;
  });
  const intro = Object.values(firstSeen);
  assert.ok(intro.length >= 3, 'к L10 должно открыться минимум 3 события');
  for (const [k, i] of Object.entries(firstSeen)) {
    assert.ok(i >= 6, `событие "${k}" введено на L${i + 1} — раньше L7 (L1–6 — обучающий блок)`);
  }
  // в самом обучающем блоке (первые 6 уровней) событий быть не должно
  for (let i = 0; i < 6; i++) {
    const ev = game.LEVELS[i].events || {};
    for (const k of game.EVENT_KEYS) assert.ok(!ev[k], `L${i + 1} (обучение) не должен включать "${k}"`);
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

test('L7 дебютирует VIP; L8 — час пик; L10 — медицинский (как задумано)', () => {
  const { game } = boot();
  game.zen = false;
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
    assert.ok(/class="goalsboard"/.test(html), `L${i + 1}: нет блока целей`);
    assert.ok(/class="goal-challenge"/.test(html), `L${i + 1}: нет строки-вызова`);
    assert.ok(/class="gicon"/.test(html), `L${i + 1}: цели/звёзды должны быть иконками`);
    // ровно три ступени звёзд
    assert.equal((html.match(/class="gstar-row"/g) || []).length, 3, `L${i + 1}: должно быть 3 ступени звёзд`);
  }
});

test('L3 показывает доп. порог по апгрейдам (🔧) в лестнице звёзд', () => {
  const { game } = boot();
  game.setLevel(2);
  const html = game.goalRowsHTML();
  assert.ok(/gstar-val upg/.test(html), 'на L3 у звёзд должен быть значок апгрейда');
});

test('race-уровень (L5) показывает «без лимита» по бортам', () => {
  const { game } = boot();
  game.setLevel(4);
  const html = game.goalRowsHTML();
  assert.ok(html.includes('∞'), 'на race-уровне потолок бортов — ∞ (без лимита)');
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
  // L3 (index 2): stars [12,14,16], upg [0,2,4]
  assert.equal(game.simulateResult({ level: 2, served: 16, upgrades: 0 }).stars, 1, 'без апгрейдов — только 1★');
  assert.equal(boot().game.simulateResult({ level: 2, served: 16, upgrades: 2 }).stars, 2, 'хватает на 2★, но не на 3★');
  assert.equal(boot().game.simulateResult({ level: 2, served: 16, upgrades: 4 }).stars, 3);
  assert.equal(boot().game.simulateResult({ level: 2, served: 11, upgrades: 4 }).stars, 0, 'мало бортов — 0★');
});

test('цель-апгрейды (L9) считается по своей метрике upgrades', () => {
  const { game } = boot();
  // L9 (index 8) — метрика upgrades, stars [5,6,7]; «принятые» борта не засчитываются
  assert.equal(game.simulateResult({ level: 8, served: 99, upgrades: 0 }).stars, 0);
  assert.equal(boot().game.simulateResult({ level: 8, upgrades: 7 }).stars, 3);
});

test('открытие уровней не вылезает за пределы списка', () => {
  const { game } = boot();
  const r = game.simulateResult({ level: 9, served: 32 });  // последний уровень (stars [24,28,32])
  assert.equal(r.unlocked, 10, 'unlocked не должен превышать LEVELS.length');
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
  assert.equal(game.LEVELS.length, 10, 'кампания остаётся из 10 уровней');
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
  // L4 (target 20) и L6 (target 28) — одинаковый апрон, разный поток: больше поток → ниже svc
  const e4 = game.levelEconomy(game.LEVELS[3]);
  const e6 = game.levelEconomy(game.LEVELS[5]);
  assert.ok(e6.flow > e4.flow, 'L6 принимает больше бортов, чем L4');
  assert.ok(e6.svcReward <= e4.svcReward, 'при большем потоке оплата за борт не растёт');
});

test('экономика: голая оплата НЕ покрывает весь набор — добор идёт мастерством', () => {
  const { game } = boot();
  const K = game.K;
  const avg = 1 + K.TWO_SVC_CHANCE;
  // на «средних» по апрону уровнях (L4) базовый доход < полного набора, но комбо×2/экспресс×1.5
  // дают запас сверх него — «непросто, но выполнимо»
  const e = game.levelEconomy(game.LEVELS[3]);
  const baseTotal = e.startMoney + e.svcReward * avg * e.flow;
  assert.ok(baseTotal < e.kitCost, 'голой оплаты с запасом не должно хватать на весь набор');
  assert.ok(baseTotal >= e.kitCost * 0.8, 'но впритык — не меньше 80% набора (иначе недостижимо)');
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
