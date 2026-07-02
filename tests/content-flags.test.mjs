// Тесты логики поэтапного релиза контента (Content / Remote Config, src/game/12h-remote-config.ts).
// Слой 1-2 (чистая рантайм-логика без браузера) — как logic/leaderboard, через тот же harness.
// Покрываем: приоритет разрешения (enabled > unlock_at > закрыто), все 4 комбинации
// enabled × дата (наступила/нет), офлайн-fallback (дефолты, пока не пришёл удалённый конфиг),
// применение/парсинг удалённого JSON `content_flags` (частичный мерж, force-enable, сдвиг даты),
// терпимость к мусору и неизвестным ключам.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

// фиксированные моменты времени (UTC). Дефолты закрыты (все unlock_at:null) → весь staged-контент
// «coming soon», пока владелец не откроет из консоли Remote Config; время само по себе ничего не открывает.
const BEFORE_ALL   = Date.UTC(2026, 6, 1);    // 1 июля
const AFTER_BONUS  = Date.UTC(2026, 7, 20);   // 20 авг
const AFTER_ALL    = Date.UTC(2026, 9, 1);    // 1 окт
const rc = obj => ({ content_flags: JSON.stringify(obj) });

// --- дефолты = всё закрыто (безопасный офлайн-fallback: не «всё открыто вслепую») ---
test('дефолты: весь staged-контент закрыт в любой момент (нет дат) — открывает только консоль', () => {
  const { game } = boot();
  const C = game.Content;
  for (const k of ['bonus_levels','survival_mode','biomes_pack_2','season_league']) {
    assert.equal(C.isOpen(k, BEFORE_ALL), false, k+' закрыт до открытия');
    assert.equal(C.isOpen(k, AFTER_ALL),  false, k+' без даты не открывается сам по времени');
  }
});

test('офлайн-fallback: до удалённого конфига сидим на дефолтах (usingDefaults)', () => {
  const { game } = boot();
  assert.equal(game.Content.usingDefaults, true);
});

test('неизвестный ключ → закрыт (безопасно)', () => {
  const { game } = boot();
  assert.equal(game.Content.isOpen('does_not_exist', AFTER_ALL), false);
});

// --- 4 комбинации enabled × unlock_at (наступил/не наступил) ---
test('комбинация 1: enabled:true, без даты → открыт всегда', () => {
  const { game } = boot();
  game.Content.applyRemote(rc({ season_league: { enabled: true, unlock_at: null } }));
  assert.equal(game.Content.isOpen('season_league', BEFORE_ALL), true);
});

test('комбинация 2: enabled:true перекрывает будущую дату → открыт (ручной оверрайд)', () => {
  const { game } = boot();
  game.Content.applyRemote(rc({ season_league: { enabled: true, unlock_at: '2099-01-01T00:00:00Z' } }));
  assert.equal(game.Content.isOpen('season_league', BEFORE_ALL), true);
});

test('комбинация 3: enabled:false, дата НАСТУПИЛА → открыт по расписанию', () => {
  const { game } = boot();
  game.Content.applyRemote(rc({ season_league: { enabled: false, unlock_at: '2026-06-01T00:00:00Z' } }));
  assert.equal(game.Content.isOpen('season_league', BEFORE_ALL), true);
});

test('комбинация 4: enabled:false, дата НЕ наступила → закрыт', () => {
  const { game } = boot();
  game.Content.applyRemote(rc({ season_league: { enabled: false, unlock_at: '2099-01-01T00:00:00Z' } }));
  assert.equal(game.Content.isOpen('season_league', BEFORE_ALL), false);
});

test('enabled:false, unlock_at:null → закрыт (экстренное «выключить»)', () => {
  const { game } = boot();
  // сначала открываем датой, затем гасим: enabled:false + unlock_at:null снова закрывает.
  game.Content.applyRemote(rc({ bonus_levels: { enabled: false, unlock_at: '2026-06-01T00:00:00Z' } }));
  assert.equal(game.Content.isOpen('bonus_levels', AFTER_ALL), true);
  game.Content.applyRemote(rc({ bonus_levels: { enabled: false, unlock_at: null } }));
  assert.equal(game.Content.isOpen('bonus_levels', AFTER_ALL), false);
});

// --- применение удалённого конфига ---
test('applyRemote: частичный конфиг мержится поверх дефолтов, остальные ключи не тронуты', () => {
  const { game } = boot();
  const C = game.Content;
  const changed = C.applyRemote(rc({ season_league: { enabled: true, unlock_at: null } }));
  assert.equal(changed, true);
  assert.equal(C.usingDefaults, false, 'после удалённого конфига больше не на дефолтах');
  assert.equal(C.isOpen('season_league', BEFORE_ALL), true, 'season_league открыт из RC');
  // bonus_levels в конфиг не входил → сохраняет дефолт (закрыт)
  assert.equal(C.isOpen('bonus_levels', BEFORE_ALL), false);
  assert.equal(C.isOpen('bonus_levels', AFTER_ALL), false);
});

test('applyRemote: дата открытия из RC — до неё закрыто, после — открыто', () => {
  const { game } = boot();
  const C = game.Content;
  C.applyRemote(rc({ bonus_levels: { enabled: false, unlock_at: '2027-01-01T00:00:00Z' } }));
  assert.equal(C.isOpen('bonus_levels', AFTER_ALL), false, 'до даты — закрыт');
  assert.equal(C.isOpen('bonus_levels', Date.UTC(2027, 0, 2)), true, 'после даты — открыт');
});

test('applyRemote: строки "true"/дата принимаются (RC отдаёт строками)', () => {
  const { game } = boot();
  game.Content.applyRemote(rc({ survival_mode: { enabled: 'true', unlock_at: null } }));
  assert.equal(game.Content.isOpen('survival_mode', BEFORE_ALL), true);
});

test('state(): отдаёт open + enabled + unlockAt для плашки «скоро»', () => {
  const { game } = boot();
  const C = game.Content;
  // дефолт: закрыт, без даты → плашка «Coming soon» без даты
  let st = C.state('bonus_levels', BEFORE_ALL);
  assert.equal(st.open, false); assert.equal(st.enabled, false); assert.equal(st.unlockAt, null);
  // после RC с датой → state отдаёт дату для подписи «Открытие {дата}»
  C.applyRemote(rc({ bonus_levels: { enabled: false, unlock_at: '2026-08-15T00:00:00Z' } }));
  st = C.state('bonus_levels', BEFORE_ALL);
  assert.equal(st.open, false); assert.equal(st.unlockAt, '2026-08-15T00:00:00Z');
});

// --- терпимость к мусору: не ломаем гейты, остаёмся на кэше/дефолтах ---
test('applyRemote: битый JSON → игнор, остаёмся на дефолтах', () => {
  const { game } = boot();
  const C = game.Content;
  const changed = C.applyRemote({ content_flags: '{not json' });
  assert.equal(changed, false);
  assert.equal(C.usingDefaults, true, 'мусор не считается удалённым конфигом');
  assert.equal(C.isOpen('bonus_levels', AFTER_ALL), false, 'дефолт (закрыт) не тронут');
});

test('applyRemote: нет ключа content_flags → no-op', () => {
  const { game } = boot();
  assert.equal(game.Content.applyRemote({ survival_leaderboard: 'false' }), false);
  assert.equal(game.Content.usingDefaults, true);
});

test('applyRemote: битая дата в unlock_at → трактуется как «нет даты» (закрыто без enabled)', () => {
  const { game } = boot();
  const C = game.Content;
  C.applyRemote(rc({ season_league: { enabled: false, unlock_at: 'notadate' } }));
  assert.equal(C.isOpen('season_league', AFTER_ALL), false);
});

// --- дев-оверрайд: галочка «открыть все coming soon» (debug.unlockContent) ---
test('debug.unlockContent открывает весь запертый контент разом (дев-превью)', () => {
  const { game } = boot();
  const C = game.Content;
  assert.equal(C.isOpen('survival_mode', BEFORE_ALL), false, 'по умолчанию закрыт');
  game.debug.unlockContent = true;
  for (const k of ['bonus_levels','survival_mode','biomes_pack_2','season_league'])
    assert.equal(C.isOpen(k, BEFORE_ALL), true, k+' открыт дев-оверрайдом');
  game.debug.unlockContent = false;
  assert.equal(C.isOpen('survival_mode', BEFORE_ALL), false, 'снятие галочки возвращает «скоро»');
});
