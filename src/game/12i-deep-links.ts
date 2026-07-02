// ===== 12i-deep-links — App Links / deep links (шеринг результата → обратно в игру) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: DeepLink — { url(params) стройка ссылки для шеринга, handle(href) роутинг по ссылке }.
// Reads: 11 (showLeaderboard, showBiomes, showStart — переиспользуем существующую навигацию).
//
// Зачем: docs/play-featuring-plan.md → «App Links / deep links». Карточка-шеринг (10-scene-loop)
// добавляет к картинке ссылку https://<host>/?screen=… — открытая на устройстве, она (через App
// Links intent-filter из setup-android.mjs) запускает приложение и роутит на нужный экран; в
// браузере/PWA та же ссылка просто грузит сайт с тем же query и роутится здесь на загрузке.

  const DeepLink = (() => {
    const ORIGIN = 'https://planeflow.jevgenia.com';   // домен сайта (CNAME) — совпадает с App Links host

    // Собрать ссылку для шеринга: ORIGIN + query (?screen=survival и т.п.).
    function url(params?: Record<string, string | number>): string {
      const qs = params ? Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&') : '';
      return ORIGIN + '/' + (qs ? '?' + qs : '');
    }

    // Разобрать входящую ссылку и увести на нужный экран. Безопасно: неизвестные/пустые
    // параметры → ничего не делаем (остаёмся где были). Роутим только по уже существующим
    // экранам меню, поэтому вызов легитимен лишь ПОСЛЕ загрузки (loadGame/ACH.init в 13-init).
    function handle(href?: string): boolean {
      let q = '';
      try { q = new URL(href || '', ORIGIN).search; } catch (e) { return false; }
      const p = new URLSearchParams(q);
      const screen = (p.get('screen') || p.get('mode') || '').toLowerCase();
      if (screen === 'leaderboard') { try { showLeaderboard(); return true; } catch (e) {} }
      else if (screen === 'survival' || screen === 'biomes') { try { showBiomes(); return true; } catch (e) {} }
      return false;
    }

    // Нативный Android: ссылка приходит событием appUrlOpen (@capacitor/app). Регистрируем сразу —
    // само событие прилетает уже после инициализации приложения.
    { const cap: any = (window as any).Capacitor;
      if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.addListener === 'function')
        cap.Plugins.App.addListener('appUrlOpen', (ev: any) => { if (ev && ev.url) handle(ev.url); }); }

    return { url, handle, ORIGIN };
  })();
