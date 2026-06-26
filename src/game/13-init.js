// ===== 13-init — closes the game IIFE; boot, wiring & the ?test=1 API =====
// Closes the single game IIFE opened in 01 (shared script scope, not ES modules).
// Provides: — (wires the modules together; exposes window.__GAME under ?test=1).
// Reads: ~all modules — 11 (showStart/showLevels/loadGame/saveGame/applyMenuIcons), 10 (frame), 06 (save/resize/VERSION), 05 (validateGame), 03 (applyI18n/setLang/t), 07 (SND/HAP/Analytics/Leaderboard), 12 (ACH/openMedals), 08 (computeStars…), 04 (config + test-API exports).

  // Capgo OTA (нативная сборка): помечаем текущий веб-бандл рабочим. Без этого вызова
  // плагин через ~10с считает обновление сломанным и откатывается на прошлый бандл.
  { const cap=window.Capacitor;
    if(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.CapacitorUpdater){
      try{ cap.Plugins.CapacitorUpdater.notifyAppReady(); }catch(e){}
    }
  }

  document.getElementById('medalsBtn').onclick=()=>openMedals('start');
  { const b=document.getElementById('leaderboardBtn'); if(b) b.onclick=showLeaderboard; }
  // Play Games «G» — вход по жесту игрока (нативная сборка). На вебе кнопка скрыта.
  // Вход при старте мы намеренно не форсим: авто-вход глушит окно согласия Play Games.
  { const g=document.getElementById('playGamesBtn'); const cap=window.Capacitor;
    if(g && cap && cap.isNativePlatform && cap.isNativePlatform()){
      g.style.display='';                                   // показать только в нативной сборке
      g.onclick=()=>{ const pg=window.PFPlayGames;
        if(Account.signedIn() && pg){ pg.showAchievements(); return; }   // уже вошли → системные ачивки
        Promise.resolve(Account.signIn()).then(()=>{ if(window.PFPlayGames) window.PFPlayGames.showAchievements(); }).catch(()=>{});
      };
    }
  }
  { const b=document.getElementById('leaderboardBackBtn'); if(b) b.onclick=()=>{ showStart(); }; }
  document.getElementById('medalsBackBtn').onclick=()=>{
    if(medalFrom==='levels'){ hideAllScreens(); showLevels(); }
    else showStart();
  };

  loadGame();
  loadDebug();                        // восстановление отладочных читов (localStorage)
  saveGame();                         // миграция: сейв сразу переезжает под новый ключ
  // Runtime side of the Asset Metadata System. Safe default is procedural. Production
  // metadata lives in asset-metadata.json; the sample file is a documentation/dev fallback only.
  assetMetadataRegistry.loadFromUrl('assets/metadata/asset-metadata.json').then(warnings=>{
    if(warnings.length) console.warn('[PlaneFlow] asset metadata warnings', warnings);
    if(typeof location !== 'undefined' && /[?&]assetMetadataSample=1(?:&|$)/.test(location.search)){
      assetMetadataRegistry.loadFromUrl('assets/metadata/asset-metadata.sample.json').then(sampleWarnings=>{
        if(sampleWarnings.length) console.warn('[PlaneFlow] sample asset metadata warnings', sampleWarnings);
      });
    }
  });
  // WOW skin init removed — handoff PNG sprites (HANDOFF_IMG) are now the primary rendering.
  // Zone skins remain available via the tuning workbench (setZoneSkins still works there).
  // ── Handoff PNG sprites (assets/sprites/handoff/) ────────────────────────────
  // Loaded once at startup; render code falls back to procedural until ready.
  (function loadHandoffSprites(){
    if (typeof Image === 'undefined') return;   // Node.js test harness — пропускаем
    const BASE = 'assets/sprites/handoff/';
    const LIV_COLORS = [null, '#cc1122', '#c89800', '#1a9944'];
    function loadI(src){ const im = new Image(); im.src = src; return im; }
    HANDOFF_IMG.bg      = loadI(BASE + 'sprite_back_full.png');
    HANDOFF_IMG.apron   = loadI(BASE + 'sprite_apron.png');
    HANDOFF_IMG.vpp     = loadI(BASE + 'sprite_vpp.png');
    HANDOFF_IMG.vppConn = loadI(BASE + 'sprite_vpp_conn.png');
    HANDOFF_IMG.hangar  = loadI(BASE + 'sprite_hangar.png');
    HANDOFF_IMG.gate    = loadI(BASE + 'sprite_gate.png');
    HANDOFF_IMG.hud     = loadI(BASE + 'sprite_hud.png');
    const base = loadI(BASE + 'sprite_plane2.png');
    HANDOFF_IMG.plane = base;
    base.onload = function() {
      // Remove gray checker background (flood-fill from edges, as in reference.html)
      function bgRemove(img) {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
        try {
          var id = cx.getImageData(0, 0, c.width, c.height);
          var data = id.data, w = c.width, h = c.height;
          var seen = new Uint8Array(w * h);
          var stack = new Int32Array(w * h); var top = 0;
          function isBg(pi) {
            var r = data[pi], g = data[pi+1], b = data[pi+2];
            return (Math.max(r,g,b) - Math.min(r,g,b) < 30) && r > 172;
          }
          function seed(x, y) {
            if (x < 0 || x >= w || y < 0 || y >= h) return;
            var i = y * w + x; if (seen[i]) return;
            if (!isBg(i * 4)) return;
            seen[i] = 1; stack[top++] = i;
          }
          for (var x = 0; x < w; x++) { seed(x, 0); seed(x, h-1); }
          for (var y = 1; y < h-1; y++) { seed(0, y); seed(w-1, y); }
          while (top > 0) {
            var i = stack[--top]; data[i*4+3] = 0;
            var px = i % w, py = (i / w) | 0;
            seed(px+1, py); seed(px-1, py); seed(px, py+1); seed(px, py-1);
          }
          cx.putImageData(id, 0, 0);
        } catch(e) { console.warn('bgRemove:', e); }
        return c;
      }
      var clean = bgRemove(base);
      // Build 4 livery variants: base (index 0) + tinted tail (1-3)
      HANDOFF_IMG.planes = LIV_COLORS.map(function(col) {
        var c = document.createElement('canvas');
        c.width = clean.width; c.height = clean.height;
        var cx = c.getContext('2d');
        cx.drawImage(clean, 0, 0);
        if (col) {
          cx.globalCompositeOperation = 'source-atop';
          cx.fillStyle = col; cx.globalAlpha = 0.72;
          // tail = lower 44% of the sprite (nose points up)
          cx.fillRect(clean.width * 0.22, clean.height * 0.56,
                      clean.width * 0.56, clean.height * 0.44);
        }
        return c;
      });
      HANDOFF_IMG.ready = true;
    };
  })();

  ACH.init();
  lang = save.lang || DEFAULT_LANG;   // сохранённый выбор > английский по умолчанию
  applyI18n();
  applyMenuIcons();                   // заполнить статические иконки меню (data-mic)
  updateStartChips();                 // чип звёзд на главном экране
  // Кнопка «Свой уровень» на старте: видна только если конструктор положил уровень
  // в localStorage (обычный игрок её не видит). Клик — играем сохранённый уровень.
  function refreshCustomLevelBtn(){
    const btn=document.getElementById('customLevelBtn'); if(!btn) return;
    const lv=readStoredCustomLevel() || BUILTIN_CUSTOM_LEVEL;
    btn.classList.remove('hidden');
    btn.onclick=()=>startCustomLevel(lv);
  }
  refreshCustomLevelBtn();
  ConsentBanner.init();               // GDPR/ATT: применяем хранённое согласие или показываем баннер (первый запуск)
  Analytics.init();                   // шина метрик: userId/сессия/first_open + ловля крашей
  // мягкая самопроверка конфига при загрузке: в dev сразу видно в консоли, если
  // новая механика/уровень нарушили правила (жёстко это же проверяют тесты)
  try{ const _pr = validateGame(); if(_pr.length) console.error('[PlaneFlow] проблемы конфига:\n  '+_pr.join('\n  ')); }catch(e){ console.error(e); }
  SND.setEnabled(save.sound!==false); HAP.on = save.vibro!==false;
  syncSettingsUI();
  { const _v=document.getElementById('ver'); if(_v) _v.textContent=VERSION; }  // #ver убран из neon-бренда — guard
  { const _mt=document.getElementById('motionTuningBtn'); if(_mt) _mt.onclick=()=>mtOpenPanel(); }
  window.__MT = MT;   // доступен из родительского tuning.html (same-origin iframe)
  window.__ASSETS = {
    registry: assetMetadataRegistry,
    get rendererMode(){ return ASSET_RENDERER.mode; },
    set rendererMode(mode){ if(['procedural','png','hybrid'].includes(mode)) ASSET_RENDERER.mode = mode; },
    get debugOverlay(){ return ASSET_RENDERER.debugOverlay; },
    set debugOverlay(v){ ASSET_RENDERER.debugOverlay = !!v; },
    loadMetadata: (file) => assetMetadataRegistry.load(file),
    loadMetadataUrl: (url) => assetMetadataRegistry.loadFromUrl(url),
    warnings: () => assetMetadataRegistry.getValidationWarnings(),
  };
  window.__SPRITES = {
    setSkinOverrides: (skins) => SPRITES.setSkinOverrides && SPRITES.setSkinOverrides(skins),
    // Пер-зонные скины (assets/skins/…): воркбенч резолвит выбор в URL'ы и шлёт сюда.
    setZoneSkins: (map) => SPRITES.setZoneSkins && SPRITES.setZoneSkins(map),
    // read-back для проверки из tuning.html (preview_eval): карта + готовность по зонам
    zoneSkins: () => ({
      map: SPRITES.getZoneSkins ? SPRITES.getZoneSkins() : {},
      ready: {
        runway:     !!(SPRITES.hasZoneSkin && SPRITES.hasZoneSkin('runway')),
        arrival:    !!(SPRITES.hasZoneSkin && SPRITES.hasZoneSkin('arrival')),
        background: !!(SPRITES.hasZoneSkin && SPRITES.hasZoneSkin('background')),
        plane:      !!(SPRITES.hasZoneSkin && SPRITES.hasZoneSkin('plane')),
        hangar:     !!(SPRITES.hasZoneSkin && SPRITES.hasZoneSkin('hangar', 'fuel')),
      },
    }),
  };
  // Конструктор уровней (tuning.html): сыграть произвольный уровень сразу (custom),
  // либо положить его в localStorage, чтобы стартовый экран предложил «Свой уровень».
  window.__PLAY = {
    custom(obj){ try{ startCustomLevel(obj); return true; }catch(e){ return false; } },
    store(obj){ try{ localStorage.setItem('aerovia:customLevel', JSON.stringify(obj)); refreshCustomLevelBtn(); return true; }catch(e){ return false; } },
    clear(){ try{ localStorage.removeItem('aerovia:customLevel'); refreshCustomLevelBtn(); }catch(e){} },
  };
  // Живые данные поля — для оверлея в tuning.html (same-origin)
  window.__FIELD = {
    get planes()       { return planes;            },
    get runways()      { return runways;           },
    get bays()         { return bays;              },
    get W()            { return W;                 },
    get H()            { return H;                 },
    get ui()           { return ui;                },
    get planeLen()     { return PLANE_LEN();        },
    get safetyRects()  { return calcSafetyRects(); },
    get safe()         { return safe;              },
  };
  resize();
  rafId = requestAnimationFrame(frame);

  // ---- тест-API (только при ?test=1) ----
  // Даёт тестам дотянуться до чистой логики и до путей завершения уровня без
  // рефактора всей игры и без хрупкой имитации перетаскивания. В обычном запуске
  // (без ?test=1) ничего не выставляется — прод-поведение не меняется.
  if(typeof location!=='undefined' && /[?&]test=1(?:&|$)/.test(location.search)){
    window.__GAME = {
      VERSION, LEVELS, BIOMES, BONUS, K, MT, I18N, SVC, DEFAULT_LANG, EVENT_KEYS, SVC_TYPES, WEATHER_KINDS,
      t, levelEvents, levelName, objectiveDesc, computeStars, metricValue, recordResult, goalRowsHTML, bayUpCost, bayMaxLvl,
      levelEconomy, levelEffects, levelDifficulty, levelPace, paceInterval, paceCap, airPatience, levelServices, levelMaxUp, levelMinUp, sidesToLayout, levelToEditorObj,
      analyzeLevel, countOpenHangars, countTotalHangars, countOpenRunwayDirections, autoDifficulty, validatePassable, campaignTarget, archetypeForIndex,
      dayCycle, weatherTaxiMult, neededCrew, planePrimaryState, fmtNum, fmtMoney,
      bonusAfter, bonusUnlocked, bonusName,
      get nightAmount(){ return nightAmount; }, get weather(){ return weather; },
      validateGame, validateLevels, validateBonus, validateI18n, validateConfig, validateAch,
      saveGame, loadGame, setLang, detectLang, Analytics,
      get save(){ return save; },     set save(v){ save=v; },
      get lang(){ return lang; },
      get levelIdx(){ return levelIdx; },
      get levelKey(){ return levelKey; },
      get survival(){ return survival; }, set survival(v){ survival=v; },
      currentMode, periodBucket, Leaderboard, ACH, validateLeaderboard,
      get served(){ return served; }, set served(v){ served=v; },
      // выставить текущий уровень кампании (levelKey=индекс — как в buildLevel)
      setLevel(i){ levelIdx=i; levelKey=i; LV=LEVELS[i]; },
      // выставить бонус-уровень как текущий (без layout/DOM — для проверки окна целей)
      setBonus(b){ curBiome=null; curBonus=b; levelIdx=-1; levelKey='bonus_'+b.id; LV=b.level; },
      // выставить биом-карту (Survival) как текущую — для тестов levelEvents/Survival
      setBiome(b){ curBiome=b; curBonus=null; survival=true; levelIdx=-1; levelKey='b_'+b.id; LV=b.level; },
      // прогон РЕАЛЬНОГО пути завершения смены: выставляем результат и зовём те же
      // computeStars()/recordResult(), что и в игре — проверяем звёзды, открытие
      // следующего уровня и сохранение, не трогая отрисовку и ввод.
      simulateResult(opts){
        opts = opts || {};
        survival = false;
        levelIdx = opts.level||0; levelKey = levelIdx; LV = LEVELS[levelIdx];
        served = opts.served||0; upgradesDone = opts.upgrades||0;
        runPenalties = opts.penalties||0; runCrashes = opts.crashes||0;
        money = opts.money||0; lives = opts.lives!=null ? opts.lives : K.START_LIVES; gameTime = opts.time||0;
        const stars = computeStars(); recordResult();
        return { stars, unlocked: save.unlocked, best: save.best[levelKey], saved: save.stars[levelKey] };
      },
    };
  }
})();
