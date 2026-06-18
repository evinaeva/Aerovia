// ===== 12c-cloud-saves — облачные сейвы (Google Play Saved Games / Snapshots) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: window.PFCloud { onLocalSave, flush } — зеркалит прогресс в облако. На вебе/PWA — no-op.
// Reads: 06 (save, SAVE_KEY); 07 (Account); 11 (loadGame, renderLevels, updateStartChips).
// Нативный плагин: window.Capacitor.Plugins.Snapshots (см. scripts/setup-android.mjs → SnapshotsPlugin.java).
//
// Модель: offline-first. localStorage остаётся единственным источником правды для геймплея
// (saveGame/loadGame НЕ меняются), а облако — зеркало. Разрешение конфликтов — last-writer-wins
// по настенному времени savedAt: при входе в Play Games тянем облако и берём более свежую версию.
// Нативный open() дополнительно резолвит серверный конфликт политикой "most recently modified".

  (() => {
    const cap: any = (window as any).Capacitor;
    const isNative = () => { try { return !!(cap && cap.isNativePlatform && cap.isNativePlatform()); } catch (e) { return false; } };
    if (!isNative()) return;                            // веб/PWA — облака нет, остаётся mock-сейв в localStorage
    const SNAP: any = cap.Plugins && cap.Plugins.Snapshots;
    if (!SNAP) return;                                  // плагин не собран в этой сборке — тихо выходим

    const META_KEY = 'planeflow_cloud_meta_v1';         // {savedAt} последней синхронизации — база сравнения LWW
    const readAt = (): number => { try { const m = JSON.parse(localStorage.getItem(META_KEY) || 'null'); return (m && typeof m.savedAt === 'number') ? m.savedAt : 0; } catch (e) { return 0; } };
    const writeAt = (savedAt: number) => { try { localStorage.setItem(META_KEY, JSON.stringify({ savedAt })); } catch (e) {} };

    let pushTimer: any = null;
    let syncing = false;

    // Залить текущий локальный прогресс в облако. savedAt — настенное время записи (ключ LWW).
    function pushNow(): Promise<void> {
      const savedAt = Date.now();
      const payload = JSON.stringify({ v: 1, savedAt, save });
      return Promise.resolve(SNAP.save({ data: payload }))
        .then(() => { writeAt(savedAt); })
        .catch(() => {});                                // офлайн/ошибка — прогресс уже в localStorage, повторим позже
    }

    // Подтянуть облако и помирить с локальным (last-writer-wins по savedAt).
    function reconcile(): Promise<void> {
      if (syncing) return Promise.resolve();
      syncing = true;
      return Promise.resolve(SNAP.load())
        .then((res: any) => {
          let cloud: any = null;
          try { cloud = (res && res.data) ? JSON.parse(res.data) : null; } catch (e) { cloud = null; }
          const cloudAt = (cloud && typeof cloud.savedAt === 'number') ? cloud.savedAt : -1;
          if (cloud && cloud.save && cloudAt > readAt()) {
            // облако новее → принимаем как локальный сейв и перечитываем состояние из localStorage
            try { localStorage.setItem(SAVE_KEY, JSON.stringify(cloud.save)); } catch (e) {}
            writeAt(cloudAt);
            try { loadGame(); } catch (e) {}             // обновить in-memory save
            try { updateStartChips(); } catch (e) {}     // освежить видимый прогресс (чип звёзд на старте)
            try { renderLevels(); } catch (e) {}         // …и карту уровней, если экран уже построен
          } else {
            return pushNow();                            // локальное новее/равно или облако пустое → заливаем вверх
          }
        })
        .catch(() => {})
        .then(() => { syncing = false; });
    }

    // debounce: частые saveGame() (звук/вибро/конец уровня) не должны молотить сеть
    function schedulePush() {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { pushTimer = null; pushNow(); }, 2500);
    }

    (window as any).PFCloud = {
      onLocalSave() { schedulePush(); },                 // дёргается из 11-menu-ui.saveGame()
      flush() { if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; } return pushNow(); },
    };

    // Первичная сверка — после входа в Play Games. Оборачиваем Account.signIn ОДИН раз,
    // чтобы поймать все точки входа (кнопка «G», экран рейтинга), а не дублировать вызов.
    if (Account && typeof (Account as any).signIn === 'function') {
      const origSignIn = (Account as any).signIn.bind(Account);
      (Account as any).signIn = function () {
        return Promise.resolve(origSignIn()).then((acct: any) => { reconcile(); return acct; });
      };
    }

    // Уход в фон → дослать отложенный пуш (не терять последний прогресс при сворачивании).
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && pushTimer) (window as any).PFCloud.flush();
      });
    } catch (e) {}
  })();
