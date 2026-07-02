// ===== 12h-remote-config — Firebase Remote Config: feature killswitch (Flags) + staged content rollout (Content) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides:
//   • Flags   — синхронный killswitch фиче-флагов (Flags.enabled(key)); дефолты = всё ВКЛючено,
//               удалённый оверрайд гасит рискованную фичу без релиза.
//   • Content — поэтапное ОТКРЫТИЕ уже готового контента (уровни/бонусы/survival/биомы/лига)
//               по расписанию или ручному оверрайду (Content.isOpen(key) / Content.state(key)).
// Reads: Analytics (07, опц.) — лог применённого конфига. После удалённого обновления шлём DOM-событие
//   'pf:flags', чтобы UI перечитал и killswitch, и контент-гейты (см. applyFeatureFlags в 11).
//
// Один нативный fetch (RemoteConfigPlugin, docs/setup-android.mjs) тянет ОБА набора: плоские
// булевы killswitch-ключи + один JSON-параметр `content_flags`. На вебе/PWA плагина нет → остаёмся
// на дефолтах. Дефолты здесь — единственный источник истины; плагин их регистрирует и присылает
// активные значения обратно (Firebase SDK кэширует последний удачный конфиг между запусками).
//
// Зачем Content: тот же механизм, что killswitch («healthy releases»), расширен с «выключить в
// экстренном случае» до «включить по плану». Контент уже реализован — управляем только видимостью,
// без пересборки APK: дату/ручной оверрайд правим в консоли Remote Config (docs/remote-config.md).

  // Контент-флаг: {enabled?, unlock_at?}. Порядок разрешения (см. resolveContent / docs/remote-config.md):
  //   1) enabled===true            → открыт СРАЗУ (ручной оверрайд, дату игнорируем);
  //   2) unlock_at задан и наступил → открыт по расписанию (даже если enabled=false в старом конфиге);
  //   3) иначе                      → закрыт (плашка «скоро»).
  type ContentFlag = { enabled?: boolean; unlock_at?: string | null };

  const Flags = (() => {
    // Дефолты: все фичи ВКЛЮЧЕНЫ. Ключи заводятся в Firebase Remote Config для удалённого выключения.
    const DEFAULTS: Record<string, boolean> = {
      survival_leaderboard: true,   // глобальный Survival-рейтинг: экран + отправка счёта + ранг-виджет
      new_achievements:     true,   // недавно добавленные (рисковые) медали — гейт по Def.flag в ACH
    };
    const cache: Record<string, boolean> = { ...DEFAULTS };

    // Remote Config отдаёт значения строками ('true'/'false'/…) — приводим к boolean терпимо.
    function coerce(v: unknown): boolean {
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toLowerCase();
      return !(s === '' || s === 'false' || s === '0' || s === 'off' || s === 'no');
    }

    // Синхронное чтение (безопасно с первого кадра): до прихода удалённого конфига — дефолт.
    function enabled(key: string): boolean {
      return key in cache ? cache[key] : (key in DEFAULTS ? DEFAULTS[key] : true);
    }

    // Строковые дефолты для нативного плагина.
    function nativeDefaults(): Record<string, string> {
      const d: Record<string, string> = {};
      for (const k in DEFAULTS) d[k] = DEFAULTS[k] ? 'true' : 'false';
      return d;
    }

    // Применить активные значения из плагина. Возвращает true, если что-то поменялось.
    function applyRemote(vals: Record<string, unknown>): boolean {
      let changed = false;
      for (const k in DEFAULTS) {
        if (k in vals) { const nv = coerce(vals[k]); if (nv !== cache[k]) { cache[k] = nv; changed = true; } }
      }
      return changed;
    }

    return { enabled, DEFAULTS, nativeDefaults, applyRemote, refresh: () => initRemoteConfig() };
  })();

  const Content = (() => {
    // Дефолт весь контент (кроме обычных уровней кампании) закрыт → плашка «скоро». Это безопасный
    // офлайн-fallback: НЕ «всё открыто вслепую», а «ничего не открыто, пока владелец не откроет».
    // Открытие делаем БЕЗ пересборки — в консоли Remote Config (JSON-параметр `content_flags`):
    // либо ручным оверрайдом enabled:true (сразу), либо датой unlock_at (по расписанию, UTC).
    // Firebase SDK кэширует последний удачный удалённый конфиг — он приоритетнее этих дефолтов.
    // (Дев-превью всего запертого контента разом — галочка «открыть все coming soon» в дебаг-меню.)
    const DEFAULTS: Record<string, ContentFlag> = {
      bonus_levels:  { enabled: false, unlock_at: null }, // бонус-уровни (после 5/10)
      survival_mode: { enabled: false, unlock_at: null }, // режим Survival + базовые биомы
      biomes_pack_2: { enabled: false, unlock_at: null }, // второй набор биом-карт
      season_league: { enabled: false, unlock_at: null }, // лига сезона (дивизионы/чип/вкладка)
    };
    const cache: Record<string, ContentFlag> = clone(DEFAULTS);
    let fromRemote = false;   // получали ли мы удалённый content_flags (иначе — на дефолтах)

    function clone(o: Record<string, ContentFlag>): Record<string, ContentFlag> {
      const out: Record<string, ContentFlag> = {};
      for (const k in o) out[k] = { enabled: o[k].enabled, unlock_at: o[k].unlock_at ?? null };
      return out;
    }

    // Чистая, детерминированная логика разрешения (nowMs инъектируется в тестах).
    function resolve(flag: ContentFlag | undefined, nowMs: number): boolean {
      if (!flag || typeof flag !== 'object') return false;
      if (flag.enabled === true) return true;                 // ручной оверрайд — открыт сразу
      const ua = flag.unlock_at;
      if (ua) { const t = Date.parse(ua); if (!Number.isNaN(t) && nowMs >= t) return true; }  // расписание
      return false;
    }

    // Синхронно: открыт ли контент прямо сейчас. Неизвестный ключ → закрыт (безопасно).
    // Дев-оверрайд: галочка «открыть все coming soon» в дебаг-меню (debug.unlockContent) —
    // локальное превью всего запертого контента, не трогает удалённый конфиг.
    function isOpen(key: string, nowMs?: number): boolean {
      if (typeof debug !== 'undefined' && debug && debug.unlockContent) return true;
      return resolve(cache[key], nowMs == null ? Date.now() : nowMs);
    }

    // Для UI: полное состояние гейта (плашка «скоро» + опц. дата открытия).
    function state(key: string, nowMs?: number): { open: boolean; enabled: boolean; unlockAt: string | null } {
      const f = cache[key];
      return { open: isOpen(key, nowMs), enabled: !!(f && f.enabled === true), unlockAt: (f && f.unlock_at) || null };
    }

    // Применить удалённый JSON `content_flags`. Терпимо к мусору: неверный JSON/тип → игнор (остаёмся
    // на текущем кэше). Возвращает true, если что-то поменялось.
    function applyRemote(vals: Record<string, unknown>): boolean {
      if (!('content_flags' in vals)) return false;
      let obj: any = vals.content_flags;
      if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch (e) { return false; } }
      if (!obj || typeof obj !== 'object') return false;
      let changed = false;
      for (const k in DEFAULTS) {
        const rv = obj[k];
        if (!rv || typeof rv !== 'object') continue;
        const next: ContentFlag = {
          enabled:   rv.enabled === true || rv.enabled === 'true',
          unlock_at: (typeof rv.unlock_at === 'string' && rv.unlock_at) ? rv.unlock_at : null,
        };
        const cur = cache[k];
        if (!cur || cur.enabled !== next.enabled || (cur.unlock_at ?? null) !== next.unlock_at) {
          cache[k] = next; changed = true;
        }
      }
      fromRemote = true;
      return changed;
    }

    return {
      isOpen, state, DEFAULTS, applyRemote,
      // JSON-строка дефолтов для нативного плагина (один параметр content_flags).
      nativeDefault: () => JSON.stringify(DEFAULTS),
      get usingDefaults() { return !fromRemote; },   // read-back: сидим ли на офлайн-fallback
      refresh: () => initRemoteConfig(),
    };
  })();

  // Единый нативный фетч: тянет killswitch-флаги И content_flags за один round-trip. Любой исход
  // (офлайн/ошибка) безопасен: остаёмся на текущем кэше (Firebase SDK отдаёт последний удачный конфиг,
  // иначе — наши дефолты). Веб: плагина нет → no-op, живём на дефолтах.
  function initRemoteConfig(): void {
    const RC: any = (window as any).Capacitor?.Plugins?.RemoteConfig;
    if (!RC || typeof RC.fetchAndActivate !== 'function') return;
    const defaults: Record<string, string> = Flags.nativeDefaults();
    defaults.content_flags = Content.nativeDefault();
    RC.fetchAndActivate({ defaults }).then((res: any) => {
      const vals = res && res.values;
      if (!vals || typeof vals !== 'object') return;
      let changed = Flags.applyRemote(vals);
      changed = Content.applyRemote(vals) || changed;
      if (!changed) return;
      try {
        const params: Record<string, number> = {};
        for (const k in Flags.DEFAULTS) params[k] = Flags.enabled(k) ? 1 : 0;
        for (const k in Content.DEFAULTS) params['c_' + k] = Content.isOpen(k) ? 1 : 0;
        Analytics.track('remote_config', params);
      } catch (e) { /* аналитика необязательна */ }
      try { window.dispatchEvent(new CustomEvent('pf:flags')); } catch (e) { /* нет CustomEvent — не критично */ }
    }).catch(() => { /* офлайн/ошибка — остаёмся на кэше/дефолтах */ });
  }

  initRemoteConfig();
  try { (window as any).PFFlags = Flags; (window as any).PFContent = Content; } catch (e) { /* read-back для e2e/отладки */ }
