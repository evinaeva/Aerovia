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
  assert.equal(st.promoted, false, 'первый сезон игрока — не промо/релегейт, свежее назначение');
});

// --- promotion/relegation между сезонами (план: «Дивизионы») ---
test('seasonPromote: топ ~20% дивизиона повышается, низ ~20% понижается, середина стоит', () => {
  const { game } = boot();
  assert.equal(game.seasonPromote(2, 0.1), 3, 'топ-20% → +1 дивизион');
  assert.equal(game.seasonPromote(4, 0.1), 4, 'из Diamond выше не повышают — потолок');
  assert.equal(game.seasonPromote(2, 0.9), 1, 'низ-20% → -1 дивизион');
  assert.equal(game.seasonPromote(0, 0.9), 0, 'из Bronze ниже не понижают — пол');
  assert.equal(game.seasonPromote(2, 0.5), 2, 'середина — без изменений');
});

test('resolveSeasonDivision: за этот же сезон — не пересчитывать; за прошлый — промо/релегейт; иначе — свежее назначение', () => {
  const { game } = boot();
  const r = game.resolveSeasonDivision;
  assert.equal(r({ seasonKey:'S5', divisionIdx:2 }, 5, 50, 100), 2, 'рекорд ЭТОГО сезона — дивизион зафиксирован, ранг не пересчитывает');
  assert.equal(r({ seasonKey:'S5', divisionIdx:2 }, 6, 1, 100), 3, 'рекорд ПРОШЛОГО сезона + топ — промо');
  assert.equal(r({ seasonKey:'S5', divisionIdx:2 }, 6, 100, 100), 1, 'рекорд ПРОШЛОГО сезона + низ — релегейт');
  assert.equal(r({ seasonKey:'S3', divisionIdx:4 }, 6, null, 10), game.seasonDivisionIndex(null, 10), 'пропущенные сезоны — свежее назначение по перцентилю, не промо/релегейт');
  assert.equal(r(null, 6, 1, 10), game.seasonDivisionIndex(1, 10), 'первый сезон игрока (нет рекорда) — свежее назначение');
});

test('Leaderboard.season.standing: дивизион фиксирован на весь сезон (повторный вызов не переигрывает)', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 1000 });   // топ сезона → Diamond
  const st1 = await game.Leaderboard.season.standing('survival');
  assert.equal(st1.divisionIdx, 4);
  // «просадка» в топе (гипотетически) не должна снижать уже зафиксированный дивизион в ЭТОМ сезоне
  game.Leaderboard.provider = { submit(){ return Promise.resolve(true); }, top(){ return Promise.resolve([]); } };
  const st2 = await game.Leaderboard.season.standing('survival');
  assert.equal(st2.divisionIdx, 4, 'дивизион взят из pf_season_division_v1, не пересчитан по пустому топу');
  assert.equal(st2.promoted, false); assert.equal(st2.relegated, false);
});

test('Leaderboard.season.standing: переход в следующий сезон — промо от дивизиона прошлого сезона', async () => {
  const { game, store } = boot();
  const curKey = game.seasonKey(Date.now()), curIdx = game.seasonIdxOf(curKey);
  // симулируем «в прошлом сезоне игрок закончил в Gold (idx 2)» — без манипуляции Date.now()
  store.set('pf_season_division_v1', JSON.stringify({ seasonKey: 'S' + (curIdx - 1), divisionIdx: 2, rank: 1, total: 10 }));
  await game.Leaderboard.submitRun({ mode: 'survival', score: 1000 });   // топ ЭТОГО сезона → промо
  const st = await game.Leaderboard.season.standing('survival');
  assert.equal(st.divisionIdx, 3, 'прошлый сезон Gold(2) + топ этого сезона (перцентиль <0.2) → промо в Platinum(3)');
  assert.equal(st.promoted, true);
  assert.equal(st.relegated, false);
});

test('Leaderboard.season.standing: релегейт от прошлого сезона при низком месте в этом', async () => {
  const { game, store } = boot();
  const curKey = game.seasonKey(Date.now()), curIdx = game.seasonIdxOf(curKey);
  store.set('pf_season_division_v1', JSON.stringify({ seasonKey: 'S' + (curIdx - 1), divisionIdx: 2, rank: 1, total: 10 }));
  await game.Leaderboard.submitRun({ mode: 'survival', score: 1 });   // ниже всех ботов → низ топа этого сезона
  const st = await game.Leaderboard.season.standing('survival');
  assert.equal(st.divisionIdx, 1, 'прошлый сезон Gold(2) + низ топа этого сезона (перцентиль ≥0.8) → релегейт в Silver(1)');
  assert.equal(st.relegated, true);
  assert.equal(st.promoted, false);
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

// --- приглашение в лигу: таргетинг по bestScore, тост раз за сезон ---
test('season.invite: неактивный игрок (нет рекорда) не приглашается', () => {
  const { game } = boot();
  const inv = game.Leaderboard.season.invite();
  assert.equal(inv.active, false, 'без личного рекорда — не активен');
  assert.equal(inv.show, false, 'неактивному тост не показываем');
  assert.equal(inv.number, game.seasonNumber(Date.now()));
});

test('season.invite: активному игроку show=true, ackInvite гасит до конца сезона', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 7 });   // стал активным (есть рекорд)
  const inv1 = game.Leaderboard.season.invite();
  assert.equal(inv1.active, true);
  assert.equal(inv1.show, true, 'активному в новом сезоне показываем тост');
  game.Leaderboard.season.ackInvite();
  assert.equal(game.Leaderboard.season.invite().show, false, 'после ackInvite тот же сезон больше не приглашает');
});

test('season.invite: показ сбрасывается на новом сезоне (ack от прошлого сезона не гасит текущий)', async () => {
  const { game, store } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 7 });
  const curIdx = game.seasonIdxOf(game.seasonKey(Date.now()));
  store.set('pf_season_invite_v1', 'S' + (curIdx - 1));   // приветствие было в ПРОШЛОМ сезоне
  assert.equal(game.Leaderboard.season.invite().show, true, 'новый сезон → приглашаем снова');
});

test('season.invite: порог minBest настраивается', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 3 });
  assert.equal(game.Leaderboard.season.invite({ minBest: 10 }).show, false, 'рекорд ниже порога — не приглашаем');
  assert.equal(game.Leaderboard.season.invite({ minBest: 3 }).show, true, 'рекорд достигает порога — приглашаем');
});

// --- подбор ботов под уровень игрока (season-leagues.md) ---
test('seedBots: текущий сезон НЕ масштабирует ботов (иначе гнались бы за рекордом)', async () => {
  const { game } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 5 });   // заход ТЕКУЩЕГО сезона
  const bots = (await game.Leaderboard.top('alltime', 'survival')).filter(r => r.seed);
  assert.equal(bots.length, 8, 'восемь ботов подсеяно');
  assert.equal(Math.max(...bots.map(b => b.score)), 38, 'без прошлых сезонов — референсная раскладка (топ-бот 38)');
});

test('seedBots: рекорд ПРОШЛОГО сезона масштабирует ботов под уровень игрока', async () => {
  const { game, store } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 5 });   // создаём аккаунт
  const id = game.Leaderboard.account.current().id;
  const rows = JSON.parse(store.get('pf_lb_v1'));
  // рекорд заведомо ПРОШЛОГО сезона (якорь SEASON_EPOCH — январь 2026, «сейчас» позже)
  rows.push({ accountId: id, name: 'me', mode: 'survival', score: 240, ts: Date.UTC(2026, 0, 6) });
  store.set('pf_lb_v1', JSON.stringify(rows));
  const bots = (await game.Leaderboard.top('alltime', 'survival')).filter(r => r.seed);
  assert.equal(Math.max(...bots.map(b => b.score)), Math.round(38 * 240 / 24), 'топ-бот масштабирован под уровень 240');
  assert.ok(Math.min(...bots.map(b => b.score)) >= 1, 'скоры ботов не проседают ниже 1');
});

test('seedBots: боты не персистятся (submit их не сохраняет в журнал)', async () => {
  const { game, store } = boot();
  await game.Leaderboard.submitRun({ mode: 'survival', score: 5 });
  const rows = JSON.parse(store.get('pf_lb_v1'));
  assert.ok(!rows.some(r => r && r._seed), 'в журнале нет ботов — они вычисляются на чтении');
});

// --- конфиг-чек ---
test('validateLeaderboard() не находит проблем; включён в validateGame()', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateLeaderboard()], []);
  assert.deepEqual([...game.validateGame()], [], 'общий валидатор тоже чист');
});
