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
  ACH.init();
  lang = save.lang || DEFAULT_LANG;   // сохранённый выбор > английский по умолчанию
  applyI18n();
  applyMenuIcons();                   // заполнить статические иконки меню (data-mic)
  updateStartChips();                 // чип звёзд на главном экране
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
  // Живые данные поля — для оверлея в tuning.html (same-origin)
  window.__FIELD = {
    get planes()       { return planes;            },
    get runways()      { return runways;           },
    get bays()         { return bays;              },
    get W()            { return W;                 },
    get H()            { return H;                 },
    get safetyRects()  { return calcSafetyRects(); },
    get safe()         { return safe;              },
  };
  resize();
  requestAnimationFrame(frame);

  // ---- тест-API (только при ?test=1) ----
  // Даёт тестам дотянуться до чистой логики и до путей завершения уровня без
  // рефактора всей игры и без хрупкой имитации перетаскивания. В обычном запуске
  // (без ?test=1) ничего не выставляется — прод-поведение не меняется.
  if(typeof location!=='undefined' && /[?&]test=1(?:&|$)/.test(location.search)){
    window.__GAME = {
      VERSION, LEVELS, BIOMES, BONUS, K, MT, I18N, SVC, DEFAULT_LANG, EVENT_KEYS, SVC_TYPES, WEATHER_KINDS,
      t, levelEvents, levelName, objectiveDesc, computeStars, metricValue, goalRowsHTML, bayUpCost, bayMaxLvl,
      levelEconomy, levelEffects, levelDifficulty, levelPace, paceInterval, paceCap, airPatience, levelServices, levelMaxUp, sidesToLayout, levelToEditorObj,
      dayCycle, weatherTaxiMult, neededCrew,
      bonusAfter, bonusUnlocked, bonusName,
      get nightAmount(){ return nightAmount; }, get weather(){ return weather; },
      validateGame, validateLevels, validateBonus, validateI18n, validateConfig, validateAch,
      saveGame, loadGame, setLang, detectLang, Analytics,
      get save(){ return save; },     set save(v){ save=v; },
      get lang(){ return lang; },
      get levelIdx(){ return levelIdx; },
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
        const stars = computeStars(); recordResult();
        return { stars, unlocked: save.unlocked, best: save.best[levelKey], saved: save.stars[levelKey] };
      },
    };
  }
})();
