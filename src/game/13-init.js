// ===== 13-init — closes the game IIFE; boot, wiring & the ?test=1 API =====
// Closes the single game IIFE opened in 01 (shared script scope, not ES modules).
// Provides: — (wires the modules together; exposes window.__GAME under ?test=1).
// Reads: ~all modules — 11 (showStart/showLevels/loadGame/saveGame/applyMenuIcons), 10 (frame), 06 (save/resize/VERSION), 05 (validateGame), 03 (applyI18n/setLang/t), 07 (SND/HAP/Analytics/Leaderboard), 12 (ACH/openMedals), 08 (computeStars…), 04 (config + test-API exports).

  document.getElementById('medalsBtn').onclick=()=>openMedals('start');
  { const b=document.getElementById('leaderboardBtn'); if(b) b.onclick=showLeaderboard; }
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
  Analytics.init();                   // шина метрик: userId/сессия/first_open + ловля крашей
  // мягкая самопроверка конфига при загрузке: в dev сразу видно в консоли, если
  // новая механика/уровень нарушили правила (жёстко это же проверяют тесты)
  try{ const _pr = validateGame(); if(_pr.length) console.error('[PlaneFlow] проблемы конфига:\n  '+_pr.join('\n  ')); }catch(e){ console.error(e); }
  SND.setEnabled(save.sound!==false); HAP.on = save.vibro!==false;
  syncSettingsUI();
  { const _v=document.getElementById('ver'); if(_v) _v.textContent=VERSION; }  // #ver убран из neon-бренда — guard
  resize();
  requestAnimationFrame(frame);

  // ---- тест-API (только при ?test=1) ----
  // Даёт тестам дотянуться до чистой логики и до путей завершения уровня без
  // рефактора всей игры и без хрупкой имитации перетаскивания. В обычном запуске
  // (без ?test=1) ничего не выставляется — прод-поведение не меняется.
  if(typeof location!=='undefined' && /[?&]test=1(?:&|$)/.test(location.search)){
    window.__GAME = {
      VERSION, LEVELS, BIOMES, BONUS, K, I18N, SVC, DEFAULT_LANG, EVENT_KEYS, SVC_TYPES, WEATHER_KINDS,
      t, levelEvents, levelName, objectiveDesc, computeStars, metricValue, goalRowsHTML, bayUpCost, bayMaxLvl,
      levelEconomy, levelEffects, levelDifficulty, levelPace, paceInterval, paceCap, airPatience, levelServices, levelMaxUp,
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
