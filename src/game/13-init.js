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
  // WOW skin — design-reference assets baked into build; loaded once at startup.
  // setZoneSkins() pre-warms image decode; render gates fall back to procedural until ready.
  if(SPRITES.setZoneSkins){
    SPRITES.setZoneSkins({
      background: 'assets/skins/background/wow/default.png',
      runway:     'assets/skins/runway/wow/default.png',
      arrival:    'assets/skins/arrival/wow/arrival.png',
      plane:      'assets/skins/plane/wow/default.png',
      hangar: {
        fuel:   'assets/skins/hangar/wow/fuel.png',
        board:  'assets/skins/hangar/wow/board.png',
        repair: 'assets/skins/hangar/wow/repair.png',
        deice:  'assets/skins/hangar/wow/deice.png',
        locked: 'assets/skins/hangar/wow/locked.png',
      },
    });
  }
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
