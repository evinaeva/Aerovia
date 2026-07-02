// ===== 12h-remote-config — Firebase Remote Config feature flags («healthy releases» killswitch) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: Flags — синхронное чтение фиче-флагов (Flags.enabled(key)); удалённые оверрайды
//   тянутся асинхронно на нативном Android через RemoteConfigPlugin (docs/setup-android.mjs).
//   На вебе/PWA плагина нет → остаёмся на дефолтах (все фичи включены).
// Reads: Analytics (07, опционально — лог применённого конфига). После удалённого обновления
//   шлёт DOM-событие 'pf:flags', чтобы UI мог перечитать флаги (см. applyFeatureFlags в 11).
//
// Зачем: Google «healthy releases» (docs/play-featuring-plan.md, Technical Quality) — рискованную
// фичу (Survival-лидерборд, свежие ачивки) можно выключить БЕЗ публикации новой сборки, просто
// сменив значение в Firebase Remote Config консоли. Дефолты здесь — единственный источник истины;
// нативный плагин их только регистрирует и присылает активные значения обратно.

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

    // Нативный фетч. Дефолты шлём в плагин (строками), назад — активные значения. Любой исход
    // (офлайн/ошибка) безопасен: остаёмся на текущем кэше, килсвитч не падает. Веб: плагина нет → no-op.
    function init(): void {
      const RC: any = (window as any).Capacitor?.Plugins?.RemoteConfig;
      if (!RC || typeof RC.fetchAndActivate !== 'function') return;
      const defaults: Record<string, string> = {};
      for (const k in DEFAULTS) defaults[k] = DEFAULTS[k] ? 'true' : 'false';
      RC.fetchAndActivate({ defaults }).then((res: any) => {
        const vals = res && res.values;
        if (!vals || typeof vals !== 'object') return;
        let changed = false;
        for (const k in DEFAULTS) {
          if (k in vals) { const nv = coerce(vals[k]); if (nv !== cache[k]) { cache[k] = nv; changed = true; } }
        }
        if (!changed) return;
        try {
          const params: Record<string, number> = {};
          for (const k in DEFAULTS) params[k] = cache[k] ? 1 : 0;
          Analytics.track('remote_config', params);
        } catch (e) { /* аналитика необязательна */ }
        try { window.dispatchEvent(new CustomEvent('pf:flags')); } catch (e) { /* нет CustomEvent — не критично */ }
      }).catch(() => { /* офлайн/ошибка — остаёмся на дефолтах */ });
    }

    init();
    return { enabled, DEFAULTS, refresh: init };
  })();
  try { (window as any).PFFlags = Flags; } catch (e) { /* read-back для e2e/отладки */ }
