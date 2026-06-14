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

// --- конфиг-чек ---
test('validateLeaderboard() не находит проблем; включён в validateGame()', () => {
  const { game } = boot();
  assert.deepEqual([...game.validateLeaderboard()], []);
  assert.deepEqual([...game.validateGame()], [], 'общий валидатор тоже чист');
});
