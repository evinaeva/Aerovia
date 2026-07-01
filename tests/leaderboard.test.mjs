// Тесты каркаса глобальных рейтингов + survival-шва + ранг-медалей.
// Слой 1-2 (рантайм-логика без браузера) — как logic.test.mjs, через тот же harness.
// Проверяем: периодизацию (all-time/month/week), приём/ранжирование счёта, лучший-на-аккаунт,
// своп провайдера, пороговые ранг-медали (навсегда, comp → вне «Легенды»), конфиг-чек.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// --- периодизация: чистая, детерминированная, UTC ---
test('periodBucket: alltime=all, месяц YYYY-MM, неделя ISO YYYY-Www', () => {
  const { game } = boot();
  const pb = game.periodBucket;
  const a = pb(Date.UTC(2026, 5, 14, 12, 0, 0));    // 14 июня 2026
  assert.equal(a.alltime, 'all');
  assert.equal(a.month, '2026-06');
  assert.match(a.week, /^\d{4}-W\d{2}$/);
});

test('periodBucket: один день в разное время → тот же бакет; +7 дней → другая неделя; смена месяца', () => {
  const { game } = boot();
  const pb = game.periodBucket;
  const a  = pb(Date.UTC(2026, 5, 14, 1, 0, 0));
  const a2 = pb(Date.UTC(2026, 5, 14, 23, 0, 0));
  assert.equal(a2.week, a.week);
  assert.equal(a2.month, a.month);
  assert.notEqual(pb(Date.UTC(2026, 5, 21, 12, 0, 0)).week, a.week);   // +7 дней
  assert.equal(pb(Date.UTC(2026, 6, 1, 0, 0, 0)).month, '2026-07');     // следующий месяц
});

// --- приём счёта и ранжирование ---
test('submitRun: высокий счёт встаёт на 1-е место во всех срезах', async () => {
  const { game } = boot();
  const res = await game.Leaderboard.submitRun({ mode: 'survival', score: 100 });
  assert.equal(res.score, 100);
  assert.equal(res.ranks.alltime, 1);
  assert.equal(res.ranks.month, 1);
  assert.equal(res.ranks.week, 1);
});

test('лучший-на-аккаунт: метрика = борта за ЛУЧШИЙ заход; повтор хуже не портит рекорд', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 50 });
  await game.Leaderboard.submitRun({ mode: 'survival', score: 20 });   // хуже — не должен вытеснить
  assert.equal(game.Leaderboard.bestScore('survival'), 50);
  const top = await game.Leaderboard.top('alltime', 'survival');
  const mine = top.filter(r => !r.seed);                                // не-боты = наш аккаунт
  assert.equal(mine.length, 1, 'аккаунт в таблице одной строкой');
  assert.equal(mine[0].score, 50);
});

test('provider свопается: submit/top идут через кастомный провайдер (как Analytics.sink)', async () => {
  const { game } = boot();
  const calls = [];
  game.Leaderboard.provider = {
    submit(e) { calls.push(['submit', e.score]); return Promise.resolve(true); },
    top(p)    { calls.push(['top', p]);          return Promise.resolve([]); },
  };
  const res = await game.Leaderboard.submitRun({ mode: 'survival', score: 7 });
  assert.ok(calls.some(c => c[0] === 'submit' && c[1] === 7), 'submit ушёл в кастомный провайдер');
  assert.ok(calls.some(c => c[0] === 'top'), 'top спросили у кастомного провайдера');
  assert.equal(res.ranks.alltime, null, 'пустая таблица провайдера → мы вне рейтинга');
});

// --- ранг-медали: пороговые НАВСЕГДА, comp → вне «Легенды» ---
test('onRank: ранг 1 открывает все три пороговые медали', () => {
  const { game } = boot();
  game.ACH.onRank({ alltime: 1, month: 5, week: 50 });
  assert.ok(game.save.ach.includes('rank_1'));
  assert.ok(game.save.ach.includes('rank_top10'));
  assert.ok(game.save.ach.includes('rank_top100'));
});

test('onRank: топ-100 без топ-10 → только rank_top100', () => {
  const { game } = boot();
  game.ACH.onRank({ alltime: 80 });
  assert.ok(game.save.ach.includes('rank_top100'));
  assert.ok(!game.save.ach.includes('rank_top10'));
  assert.ok(!game.save.ach.includes('rank_1'));
});

test('onRank без места (все null) ничего не выдаёт', () => {
  const { game } = boot();
  game.ACH.onRank({ alltime: null, month: null, week: null });
  assert.ok(!game.save.ach.some(id => id.startsWith('rank_')));
});

test('ранг-медали помечены comp:true и НЕ входят в требование «Легенды»', () => {
  const { game } = boot();
  const ids = ['rank_top100', 'rank_top10', 'rank_1'];
  const ranks = game.ACH.defs.filter(d => ids.includes(d.id));
  assert.equal(ranks.length, 3, 'все три ранг-медали в реестре');
  assert.ok(ranks.every(d => d.comp === true), 'все помечены comp');
});

// --- режим ---
test('currentMode отражает survival-флаг (логика над скинами)', () => {
  const { game } = boot();
  assert.equal(game.currentMode(), 'campaign');
  game.survival = true;
  assert.equal(game.currentMode(), 'survival');
  game.survival = false;
  assert.equal(game.currentMode(), 'campaign');
});

// --- анти-чит (клиентский, первый слой): debug-читы не попадают в рейтинг ---
test('isCleanRun: infiniteLives/richStart во время захода помечают его нечистым', () => {
  const { game } = boot();
  game.ACH.onLevelStart();
  assert.equal(game.ACH.isCleanRun(), true, 'свежий заход без читов — чист');
  game.debug.infiniteLives = true;
  game.ACH.onTick(0);
  assert.equal(game.ACH.isCleanRun(), false, 'infiniteLives во время захода помечает его нечистым');
  game.debug.infiniteLives = false;
  assert.equal(game.ACH.isCleanRun(), false, 'метка держится до конца захода даже после выключения чита');
  game.ACH.onLevelStart();   // новый заход сбрасывает метку
  assert.equal(game.ACH.isCleanRun(), true);
});

test('isCleanRun: richStart тоже помечает заход нечистым', () => {
  const { game } = boot();
  game.ACH.onLevelStart();
  game.debug.richStart = true;
  game.ACH.onTick(0);
  assert.equal(game.ACH.isCleanRun(), false);
});

// --- Лига сезона (MVP Фаза 1, план: docs/design/game-design/season-leagues.md) ---
test('seasonKey/seasonNumber: детерминированное 2-недельное окно UTC от якоря', () => {
  const { game } = boot();
  const epoch = Date.UTC(2026, 0, 5);          // якорь SEASON_EPOCH (понедельник)
  assert.equal(game.seasonKey(epoch), 'S0');
  assert.equal(game.seasonNumber(epoch), 1);
  assert.equal(game.seasonKey(epoch + 13*86400000), 'S0', 'весь сезон — один бакет');
  assert.equal(game.seasonKey(epoch + 14*86400000), 'S1', 'ровно через 14 дней — следующий сезон');
  assert.equal(game.periodBucket(epoch).season, 'S0', 'periodBucket() отдаёт тот же бакет');
});

test('seasonDaysLeft: полный отсчёт в начале сезона, 0 после его конца', () => {
  const { game } = boot();
  const epoch = Date.UTC(2026, 0, 5);
  assert.equal(game.seasonDaysLeft(epoch), 14);
  assert.equal(game.seasonDaysLeft(epoch + 14*86400000 - 1), 1, 'последняя миллисекунда — округляем вверх до 1 дня');
});

test('seasonDivisionIndex: перцентиль в сезонном топе → 5 дивизионов Bronze(0)…Diamond(4)', () => {
  const { game } = boot();
  const idx = game.seasonDivisionIndex;
  assert.equal(idx(1, 10), 4, '1-е место из 10 — Diamond');
  assert.equal(idx(10, 10), 0, 'последнее место — Bronze');
  assert.equal(idx(null, 10), 0, 'без ранга (вне топа) — Bronze, база');
  assert.equal(idx(1, 1), 0, 'единственный участник — вырожденный случай, Bronze');
});

test('Leaderboard.season.standing: высокий счёт в сезоне даёт топ-дивизион (Diamond)', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 1000 });
  const st = await game.Leaderboard.season.standing('survival');
  assert.equal(st.rank, 1);
  assert.equal(st.divisionIdx, 4);
  assert.equal(st.division, 'diamond');
  assert.equal(st.number, game.seasonNumber(Date.now()));
});

test('ACH.onSeasonDivision: бейджи дивизиона кумулятивны, comp:true, вне «Легенды»', () => {
  const { game } = boot();
  game.ACH.onSeasonDivision(2);   // Gold (idx 2) → Bronze+Silver+Gold, НЕ Platinum/Diamond
  assert.ok(game.save.ach.includes('season_bronze'));
  assert.ok(game.save.ach.includes('season_silver'));
  assert.ok(game.save.ach.includes('season_gold'));
  assert.ok(!game.save.ach.includes('season_platinum'));
  assert.ok(!game.save.ach.includes('season_diamond'));
  const ids = ['season_bronze','season_silver','season_gold','season_platinum','season_diamond'];
  const defs = game.ACH.defs.filter(d => ids.includes(d.id));
  assert.equal(defs.length, 5, 'все пять бейджей дивизиона в реестре');
  assert.ok(defs.every(d => d.comp === true), 'помечены comp — не входят в требование «Легенды»');
});

test('Лига сезона: косметика ротирует в СВОЁМ сторе — не трогает ACH.unlocked/Легенду', () => {
  const { game } = boot();
  const before = game.save.ach.slice();
  const r1 = game.Leaderboard.season.claimReward(4);   // Diamond-приз этого сезона
  assert.ok(r1 && r1.accent, 'приз выдан с акцентным цветом');
  const r2 = game.Leaderboard.season.claimReward(0);   // повторный вызов в том же сезоне — идемпотентно
  // сравниваем поля, не объекты целиком: r2 идёт через JSON.parse (перечитан из стора),
  // r1 — свежий литерал; в тест-харнессе (vm) это разные реализации Object, deepEqual
  // на них падает по прототипу, а не по значению — сравниваем то, что реально важно.
  assert.equal(r2.divisionIdx, r1.divisionIdx, 'один приз на сезон, дивизион второго вызова не переигрывает первый');
  assert.equal(r2.accent, r1.accent);
  assert.equal(r2.ts, r1.ts);
  assert.deepEqual(game.save.ach, before, 'косметика не пишется в ACH.unlocked (нет привязки к сезону = навсегда)');
  const r3 = game.Leaderboard.season.reward();
  assert.equal(r3.divisionIdx, r1.divisionIdx); assert.equal(r3.accent, r1.accent);
});

// --- конфиг-чек ---
test('validateLeaderboard() не находит проблем; включён в validateGame()', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateLeaderboard()], []);
  assert.deepEqual([...game.validateGame()], [], 'общий валидатор тоже чист');
});
