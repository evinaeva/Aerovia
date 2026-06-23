// ===== 08-gameplay — pointer input, routing/picking, landing & takeoff, economy & scoring (event-driven) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: reset, spawnPlane, down/move/up, pickPlane/pickBay, land, touchdown, depart, computeStars, recordResult, dist/rectHit, updateForest, neededCrew, …
// Reads: 01 (cv, ctx); 04 (K, LV, LEVELS, levelEconomy, levelEvents, airPatience); 06 (planes, bays, runways, money, lives, served, save, field, combo…); 03 (t, fmtMoney); 07 (SND, HAP, Analytics); 12 (ACH); 08b (dirOut); 09b (boom, pulseFx, completeTutorial); 11 (saveGame, setPaused, showGoals).

  function reset(){
    econ = levelEconomy(LV); lvFx = econ.effects;   // оплата/касса и активные денежные эффекты — из уровня
    planes=[]; depotPlane=null; money=debug.richStart?BIG_MONEY:econ.startMoney; lives=K.START_LIVES; served=0; gameTime=0;
    // раунд начинается с пустого неба: первый борт прилетает через 1–3 секунды
    spawnTimer=1 + Math.random()*2; running=true; paused=false; inMenu=false;
    lossLog=[]; toast=null;
    document.getElementById('pauseScreen')!.classList.add('hidden');
    bays.forEach(b=>{ b.occupied=null;
      if(b.deice){ b.open=true; b.lvl=0; return; }   // де-айс — инфраструктура, всегда открыт
      // исходное «открыт» хранится на боксе (open0) при сборке (и layout, и sides ставят
      // его); старый sides-фолбэк остаётся лишь на случай боксов без open0
      const sc = LV.sides ? (LV.sides as Record<string, SideCfg>)[b.side] : undefined;
      b.open = (b.open0!=null) ? !!b.open0 : (sc ? b.slot < sc.open : false);
      b.lvl=0; });
    runways.forEach(r=>{ r.occupied=null; r.closed=false; r.hazard=null; r.landingOpen=r.landingOpen0; r.takeoffOpen=r.takeoffOpen0; });
    effects=[]; floaters=[]; alarmAt=0; slowmo=0; nearMissPairs={}; selected=null; levelPassed=false; upgradesDone=0;
    statPeak=0; statSamples=[]; statStep=1.5; statNextAt=0; spawnedTotal=0;
    combo=0; runCrashes=0; runPenalties=0;
    rushUntil=0; windUntil=0; fogUntil=0;
    // атмосфера: «часы» суток идут всегда; погода — опциональный движок (флаг weather)
    dayPhase=0; nightAmount=0; weatherUntil=0;
    hazards=[]; crews=[]; hazardSeq=0;
    const forest   = LV.biome==='forest';
    const arctic   = LV.biome==='arctic';
    const tropical = LV.biome==='tropical';
    const desert   = LV.biome==='desert';
    const mountain = LV.biome==='mountain';
    const megacity = LV.biome==='megacity';
    const biomHazard = forest||arctic||tropical||desert||mountain||megacity;
    // Арктика всегда в снегу: постоянное обледенение, де-айсинг обязателен без перерывов
    if(arctic){ weather='snow'; weatherUntil=Infinity; nextWeather=Infinity; }
    else { weather='clear'; nextWeather = LV.weather ? K.WEATHER_PERIOD : Infinity; }
    if(LV.biome){
      // биом-карты (Survival) сохраняют динамику час-пика; помехи на полосах вместо ветра/тумана
      nextRush = K.RUSH_PERIOD;
      nextWind = (biomHazard||K.WEATHER_EVENTS_OFF)?Infinity:K.WIND_PERIOD;
      nextFog  = (biomHazard||K.WEATHER_EVENTS_OFF)?Infinity:K.FOG_PERIOD;
      nextHazard = forest ? FOR.SPAWN_FIRST : arctic   ? ARC.SPAWN_FIRST  :
                   tropical ? TROP.SPAWN_FIRST : desert ? DSRT.SPAWN_FIRST :
                   mountain ? MNTN.SPAWN_FIRST : megacity ? CITY.SPAWN_FIRST : Infinity;
    } else {
      // кампания: динамические события включаются только если разрешены уровнем
      const evs = levelEvents();
      nextRush = evs.rush ? K.RUSH_PERIOD : Infinity;
      nextWind = (evs.wind && !K.WEATHER_EVENTS_OFF) ? K.WIND_PERIOD : Infinity;
      nextFog  = (evs.fog  && !K.WEATHER_EVENTS_OFF) ? K.FOG_PERIOD  : Infinity;
      nextHazard = Infinity;
    }
    ACH.onLevelStart();
    // тихий туториал «покажи и дай сделать»: только в кампании при первом запуске —
    // первый борт ведём за руку (подсветка + подсказка), без стены текста
    tut = (!save.tutorialDone && !LV.biome && !LV.bonus) ? {step:'land', plane:null} : null;
    Analytics.track('level_start', {
      level: levelKey,
      mode: currentMode(),
      objective: LV.objective && LV.objective.metric,
      target: LV.objective && LV.objective.target,
      startMoney: money,
    });
    if(tut) Analytics.track('tutorial_start', {step: tut.step});
    // окно постановки целей в начале раунда (заодно ставит на паузу). В тестовом
    // превью конструктора (tuning.html) его глушим: иначе оно вылезает при каждом
    // переключении на «Тестовую игру».
    if(!(window as any).__SUPPRESS_GOALS) showGoals(false);
  }

  function shuffle(a: any[]){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

  function spawnPlane(){
    // бонус-мир «луг бабочек»: гусеница ВПОЛЗАЕТ справа по земле (не прилетает),
    // несёт одну услугу — цветок своего цвета (3 вида ↔ 3 цвета). Заползёт в свой
    // цветок → куколка → по таймеру → бабочка, упорхнёт к краю (см. update/depart).
    if(LV.bonus){
      const sp = Math.floor(Math.random()*BSP.length);          // вид (и цвет)
      const type = BTYPE[sp];                                    // совпадает с типом цветка-бокса
      const calmMult = LV.calm || 1;
      const groundMax = (K.GROUND_BASE + K.GROUND_STEP) * 2 * calmMult;  // терпеливые, спокойный мир
      const y = field.y0 + 30*ui + Math.random()*(field.y1 - field.y0 - 60*ui);
      spawnedTotal++;
      planes.push({
        id: ++planeSeq,
        x: W + 40*ui, y, ang: Math.PI,                            // вползает с правого края, головой влево
        species: sp, bug:'cat', bonusCrawl:true,                  // стадия гусеницы; авто-вползание до поля
        requests:[type,'depart'], reqIndex:0, nSvc:1,
        zone:'field',                                             // сразу на земле — без воздуха/ВПП
        entering:false, path:[], moving:false, selected:false,
        landing:false, takeoff:false, exiting:false,
        runway:null, bay:null,
        airTime:Infinity, airMax:Infinity, waitMult:2,
        groundTime:groundMax, groundMax, serveTime:0, serveMax:0, landedAt:0,
        halfPay:false, dead:false,
        reward: econ.svcReward,
        vip:false, emergency:false, medical:false,
      });
      return;
    }
    // спец-борты как мини-события (раздел 3 копилки): частный джет (вип),
    // «топливо на нуле» (срочный + бонус), медицинский (приоритет — высадка пациента).
    const evs = levelEvents();                                           // какие спецборты разрешены уровнем
    const vip = evs.vip && !K.DISABLE_VIP && Math.random() < K.VIP_CHANCE;
    const emergency = evs.emergency && !K.DISABLE_EMERGENCY && !vip && Math.random() < K.EMERGENCY_CHANCE;
    const medical = evs.medical && !K.DISABLE_MEDICAL && !vip && !emergency && Math.random() < K.MEDICAL_CHANCE;
    // КОНСТРУКТОР: борт запрашивает услуги ТОЛЬКО из набора уровня (services). Копируем
    // массив перед перемешиванием — levelServices() может вернуть сам конфиг (не мутируем).
    const svcPool = shuffle(levelServices().slice());
    // медицинский: высаживает пациента в пассажирском боксе, затем сразу вылет
    const nSvc = medical ? 1 : Math.min(svcPool.length, (Math.random() < K.TWO_SVC_CHANCE ? 2 : 1));
    const requests = medical ? ['board','depart'] : svcPool.slice(0, nSvc).concat(['depart']);
    // де-айсинг: в снегопад обычный борт обязан пройти антиобледенение перед вылетом
    // (медицинский — «вне очереди», пропускаем). Шаг ставится прямо перед 'depart'.
    if(LV.deice && weather==='snow' && !medical && !K.DISABLE_DEICE) requests.splice(requests.length-1, 0, 'deice');
    const waitMult = (vip||medical) ? 1 : 2;                             // НАЗЕМНОЕ терпение: джет и медицинский нетерпеливы
    // воздушное терпение: ФИКС. окно (K.AIR_BASE) — одинаковое на всех уровнях; pace не влияет.
    // спецборты урезают его множителем: vip вдвое нетерпеливее (FAQ), топливо-на-нуле —
    // садить срочно, медицинский — тоже спешит.
    // бонус-мир «спокойный»: гусеницы терпеливые (level.calm растягивает таймеры)
    const calmMult = LV.calm || 1;
    const airBase = airPatience({vip, emergency, medical}, calmMult);
    const bonus = (vip?2:1) * (emergency?K.EMERGENCY_BONUS:1) * (medical?K.MEDICAL_BONUS:1);
    const reward = Math.round(nSvc * econ.svcReward * bonus);
    // вертикальная позиция зависания — в зоне прилёта (из разметки) или по всему апрону
    const ay0 = field.arrivalY0 ?? field.y0, ay1 = field.arrivalY1 ?? field.y1;
    const y = ay0 + 30*ui + Math.random()*(ay1 - ay0 - 60*ui);
    spawnedTotal++;
    planes.push({
      id: ++planeSeq,
      x: W + 40*ui, y, ang: Math.PI, // влетает с правого края, нос влево
      vip, emergency, medical, requests, reqIndex:0,
      zone:'air',            // air | runway | field | bay
      entering:true,         // глиссада с правого края до точки зависания
      path:[], moving:false, selected:false,
      landing:false, takeoff:false, exiting:false, approachR:null,
      runway:null, bay:null,
      airTime: airBase, airMax: airBase,
      groundTime:0, groundMax:0, waitMult,
      serveTime:0, serveMax:0, landedAt:0,
      halfPay:false, dead:false,
      reward,
      nSvc,
    });
    // в туториале первый прилетевший борт становится «учебным» — его и ведём
    if(tut && !tut.plane) tut.plane = planes[planes.length-1];
    // анонс мини-события (срочные борта «ломают рутину»); не на старте/в туториале
    if(gameTime>0 && !tut){
      if(emergency) toast={text:t('toast.emergency'), t:0, good:false};
      else if(medical) toast={text:t('toast.medical'), t:0, good:false};
    }
  }

  // ---- демо: «депо» у левого края апрона (K.APRON_SPAWN) ----
  // Готовый к взлёту борт (без услуг, requests=['depart']) всегда стоит у левого края
  // апрона и ждёт, пока игрок не уведёт его маршрутом на ВПП. Как только борт «взят»
  // (повёл маршрутом) или разбит — на освободившейся точке спавнится новый.
  function spawnDepotPlane(x: number, y: number){
    spawnedTotal++;
    const pl: any = {
      id: ++planeSeq,
      x, y, ang: 0,                       // нос вправо — к ВПП
      requests:['depart'], reqIndex:0, nSvc:0,
      zone:'field', depot:true,
      entering:false, path:[], moving:false, selected:false, autoPath:false,
      landing:false, takeoff:false, exiting:false, approachR:null,
      runway:null, bay:null,
      airTime:Infinity, airMax:Infinity, waitMult:2,
      groundTime:Infinity, groundMax:Infinity, serveTime:0, serveMax:0, landedAt:0,
      halfPay:false, dead:false,
      reward: econ.svcReward,
      vip:false, emergency:false, medical:false,
    };
    planes.push(pl); depotPlane = pl;
    return pl;
  }
  function maintainDepot(){
    if(!K.APRON_SPAWN || LV.bonus) return;
    // борт «взят» (повёл маршрутом / съехал с точки) или разбит → отпускаем его
    if(depotPlane && (depotPlane.dead || depotPlane.moving || depotPlane.zone!=='field')){
      if(!depotPlane.dead) depotPlane.depot=false;   // станет обычным бортом под управлением игрока
      depotPlane=null;
    }
    // новый ставим только когда точка спавна свободна (иначе мгновенный краш с уходящим)
    if(!depotPlane){
      const sx = field.x0 + PLANE_LEN()*0.7, sy = (field.y0+field.y1)/2;
      const clear = !planes.some(p=>!p.dead && dist(p.x,p.y,sx,sy) < K.CRASH_DIST*1.6);
      if(clear) spawnDepotPlane(sx, sy);
    }
  }

  // ---- лесной биом: помехи на ВПП и спец-бригады ----
  // Точка выезда бригад — низ сервисного здания (рисуется сверху поля).
  function serviceHome(){
    const s=field.service;
    if(s) return {x:s.x+s.w/2, y:s.y+s.h};
    return {x:(field.x0+field.x1)/2, y:field.y0};
  }
  // какая бригада нужна на помеху: пила на падающее дерево (срубить, пока не легло),
  // техслужба на лежащее дерево/оленя, орёл — разогнать птиц.
  function neededCrew(h: any){
    if(h.kind==='tree') return h.fallen ? 'truck' : 'chainsaw';
    if(h.kind==='deer') return 'truck';
    if(h.kind==='snow') return 'plow';
    if(h.kind==='icing') return 'deice_truck';
    if(h.kind==='storm_wave') return 'pump';
    if(h.kind==='sandstorm') return 'sweeper';
    if(h.kind==='rockslide') return 'bulldozer';
    if(h.kind==='vip_motorcade') return 'police';
    return 'eagle';
  }
  // помеха под пальцем (для тапа): берём ближайшую ещё не обслуживаемую
  function hazardAt(p: any){
    let best=null, bd=46*ui;
    for(const h of hazards){ if(h.dispatched) continue; const d=dist(h.x,h.y,p.x,p.y); if(d<bd){bd=d;best=h;} }
    return best;
  }
  function spawnHazard(){
    // оставляем хотя бы одну полосу открытой; на полосу — не больше одной помехи
    if(hazards.length >= Math.max(1, runways.length-1)) return;
    const free = runways.filter(r=>!r.closed && r.hazard==null);
    if(!free.length) return;
    const r = free[Math.floor(Math.random()*free.length)];
    const biome = LV.biome;
    const pool = biome==='arctic'     ? ['icing'] :
                 biome==='tropical'   ? ['storm_wave'] :
                 biome==='desert'     ? ['sandstorm'] :
                 biome==='mountain'   ? ['rockslide'] :
                 biome==='megacity'   ? ['vip_motorcade'] :
                 (weather==='snow' ? ['tree','deer','birds','snow'] : ['tree','deer','birds']);
    const kind = pool[Math.floor(Math.random()*pool.length)];
    const h: any = { id:++hazardSeq, kind, runway:r, t:0, dispatched:false, done:false };
    if(kind==='icing'){
      h.x = r.x + r.w*0.5; h.y = r.cy;
      r.closed = true;
      toast = {text:t('arctic.ice'), t:0, good:false};
    } else if(kind==='storm_wave'){
      h.x = r.x + r.w*0.5; h.y = r.cy;
      r.closed = true;
      toast = {text:t('tropical.wave'), t:0, good:false};
    } else if(kind==='sandstorm'){
      h.x = r.x + r.w*0.5; h.y = r.cy;
      r.closed = true;
      toast = {text:t('desert.sand'), t:0, good:false};
    } else if(kind==='rockslide'){
      h.x = r.x + r.w*0.35; h.y = r.cy;
      r.closed = true;
      toast = {text:t('mountain.rocks'), t:0, good:false};
    } else if(kind==='vip_motorcade'){
      h.x = r.x + r.w*0.5; h.y = r.cy;
      r.closed = true;
      toast = {text:t('megacity.vip'), t:0, good:false};
    } else if(kind==='snow'){
      h.x = r.x + r.w*0.5; h.y = r.cy;
      r.closed = true;                                  // занос на полосе — закрыта, пока не расчистит плуг
      toast = {text:t('forest.snow'), t:0, good:false};
    } else if(kind==='tree'){
      h.beaver = Math.random() < FOR.BEAVER_CHANCE;     // бобёр грызёт — падает медленнее
      h.fallTime = h.beaver ? FOR.TREE_FALL_BEAVER : FOR.TREE_FALL;
      h.fallen = false;
      h.x = r.x + 12*ui; h.y = r.cy;                    // у полевого торца полосы
      toast = {text:t('forest.tree'), t:0, good:false};
    } else if(kind==='deer'){
      h.x = r.x + r.w*0.42; h.y = r.cy;
      r.closed = true;                                  // зверь на полосе — сразу закрыта
      toast = {text:t('forest.deer'), t:0, good:false};
    } else {
      h.x = r.x + r.w*0.5; h.y = r.y + 8*ui;
      r.closed = true;                                  // птицы над полосой — закрыта
      toast = {text:t('forest.birds'), t:0, good:false};
    }
    r.hazard = h.id;
    hazards.push(h);
    SND.penalty();
  }
  // выслать бригаду из сервисного здания к помехе (по тапу игрока)
  function dispatchCrew(h: any){
    if(h.dispatched || h.done) return;
    h.dispatched = true;
    const home = serviceHome();
    crews.push({ kind:neededCrew(h), hazard:h, phase:'out',
                 x:home.x, y:home.y, hx:home.x, hy:home.y,
                 tx:h.x, ty:h.y, workT:0, done:false });
    const biomePfx: Record<string,string> = {arctic:'arctic',tropical:'tropical',desert:'desert',mountain:'mountain',megacity:'megacity'};
    const crewNameKey = (biomePfx[LV.biome!] || 'forest') + '.crew.' + neededCrew(h);
    addFloat(home.x, home.y-14*ui, t(crewNameKey), COL.teal);
    SND.build(); HAP.tap();
  }
  // помеха устранена: открыть полосу, убрать помеху, премия (если убрала бригада)
  function resolveHazard(h: any, rewarded?: boolean){
    if(!h || h.done) return;
    h.done = true;
    if(h.runway.hazard===h.id) h.runway.hazard=null;
    h.runway.closed = false;
    hazards = hazards.filter(x=>x!==h);
    if(rewarded){
      const biomeRewards: Record<string,number> = {arctic:ARC.REWARD,tropical:TROP.REWARD,desert:DSRT.REWARD,mountain:MNTN.REWARD,megacity:CITY.REWARD};
      const reward = biomeRewards[LV.biome!] ?? FOR.REWARD;
      money += reward;
      addFloat(h.x, h.y-18*ui, '+'+fmtMoney(reward), COL.coin);
      SND.served(); HAP.ok();
      const clearedKey = LV.biome && LV.biome!=='forest' ? LV.biome+'.cleared' : 'forest.cleared';
      toast = {text:t(clearedKey), t:0, good:true};
    }
  }
  function biomeCfg(){ const b=LV.biome; return b==='arctic'?ARC:b==='tropical'?TROP:b==='desert'?DSRT:b==='mountain'?MNTN:b==='megacity'?CITY:FOR; }
  function updateForest(dt: number){
    if(K.DISABLE_FOREST){
      for(const h of [...hazards]) resolveHazard(h, false);
      hazards=[]; crews=[];
      return;
    }
    const cfg = biomeCfg();
    if(gameTime>=nextHazard){
      spawnHazard();
      nextHazard = gameTime + cfg.SPAWN_MIN + Math.random()*(cfg.SPAWN_MAX-cfg.SPAWN_MIN);
    }
    // помехи
    for(const h of hazards){
      if(h.done) continue;
      h.t += dt;
      if(h.kind==='tree'){
        if(!h.fallen && h.t>=h.fallTime){ h.fallen=true; h.runway.closed=true; }
      } else if(h.kind==='deer'){
        if(!h.dispatched && h.t>=FOR.DEER_LIFE) resolveHazard(h, false);
      } else if(h.kind==='birds'){
        if(!h.dispatched && h.t>=FOR.BIRD_LIFE) resolveHazard(h, false);
      } else if(h.kind==='storm_wave'){
        if(!h.dispatched && h.t>=TROP.WAVE_LIFE) resolveHazard(h, false);   // волна уходит сама
      } else if(h.kind==='vip_motorcade'){
        if(!h.dispatched && h.t>=CITY.MOTORCADE_LIFE) resolveHazard(h, false); // кортеж рассасывается
      }
      // icing / sandstorm / rockslide сами не уходят — только бригада
    }
    // спец-авто: едут к помехе → работают → возвращаются домой
    const workTime = cfg.WORK_TIME;
    const crewSpeed = cfg.CREW_SPEED;
    for(const c of crews){
      if(c.phase==='work'){
        c.workT -= dt;
        if(c.workT<=0){ resolveHazard(c.hazard, true); c.phase='home'; c.tx=c.hx; c.ty=c.hy; }
        continue;
      }
      const d = dist(c.x,c.y,c.tx,c.ty);
      if(d<=4){
        if(c.phase==='out'){ c.phase='work'; c.workT=workTime; }
        else c.done=true;
      } else {
        const step = Math.min(crewSpeed*dt, d);
        c.x += (c.tx-c.x)/d*step; c.y += (c.ty-c.y)/d*step;
      }
    }
    crews = crews.filter(c=>!c.done);
  }

  // ---- geometry ----
  const rectHit = (px: number,py: number,r: any) => px>r.x && px<r.x+r.w && py>r.y && py<r.y+r.h;
  const rectPad = (px: number,py: number,r: any,m: number) => px>r.x-m && px<r.x+r.w+m && py>r.y-m && py<r.y+r.h+m;  // rectHit с запасом под палец
  const dist = (ax: number,ay: number,bx: number,by: number) => Math.hypot(ax-bx, ay-by);

  // ---- полукруглые зоны захвата (одна форма на тип; геометрия настраивается в tuning.html) ----
  // Купол полукруга смотрит «наружу» (в сторону захода — туда, откуда борт подходит к воротам/
  // торцу), плоская грань проходит через центр. Возвращает {cx,cy,r,ux,uy} или null при r≤0.
  // ux/uy — единичный вектор наружу (по нему же масштабируется/двигается зона на превью).
  function bayGrabZone(b: any){
    const R=(MT_META_VALUES.BAY_GRAB_RADIUS as number)||0; if(R<=0) return null;
    const o=dirOut(b), off=(MT_META_VALUES.BAY_GRAB_OFFSET as number)||0;
    // центр ворот = середина полевой кромки бокса; центр зоны смещён наружу на off
    const half=(Math.abs(o.dy)>Math.abs(o.dx)?b.h:b.w)/2;
    const gx=b.x+b.w/2+o.dx*half, gy=b.y+b.h/2+o.dy*half;
    return { cx:gx+o.dx*off, cy:gy+o.dy*off, r:R, ux:o.dx, uy:o.dy, square:MT_META_VALUES.BAY_GRAB_SHAPE==='square' };
  }
  // Зона захвата ВПП. side='land' — посадочный (правый, со стороны неба) торец, купол
  // вправо; side='takeoff' — взлётный (левый, со стороны апрона) торец, купол влево.
  function runwayGrabZone(r: any, side: 'land'|'takeoff'){
    const land=side==='land';
    const R=(MT_META_VALUES[land?'RUNWAY_LAND_GRAB_RADIUS':'RUNWAY_TAKEOFF_GRAB_RADIUS'] as number)||0; if(R<=0) return null;
    const off=(MT_META_VALUES[land?'RUNWAY_LAND_GRAB_OFFSET':'RUNWAY_TAKEOFF_GRAB_OFFSET'] as number)||0;
    const ux=land?1:-1, edge=land?r.x+r.w:r.x;
    return { cx:edge+ux*off, cy:r.cy, r:R, ux, uy:0, square:MT_META_VALUES.RUNWAY_GRAB_SHAPE==='square' };
  }
  // точка в зоне захвата. z.square = квадрат со стороной 2r с центром в z; иначе
  // полукруг (в пределах радиуса И на стороне захода, купол по +u).
  function inGrabZone(px: number,py: number,z: any){
    if(!z) return false;
    const dx=px-z.cx, dy=py-z.cy;
    if(z.square) return Math.abs(dx)<=z.r && Math.abs(dy)<=z.r;
    if(dx*dx+dy*dy > z.r*z.r) return false;
    return (dx*z.ux+dy*z.uy) >= 0;
  }

  // ---- input ----
  let selected: any=null, drag: any=null;
  function pt(e: any){
    const r=cv.getBoundingClientRect();
    const s=e.touches?e.touches[0]:e;
    return {x:s.clientX-r.left, y:s.clientY-r.top};
  }
  function pickPlane(p: any){
    let best=null, bd=K.GRAB;
    for(const pl of planes){
      if(pl.zone==='bay') continue;
      const d=dist(pl.x,pl.y,p.x,p.y);
      if(d<bd){bd=d;best=pl;}
    }
    return best;
  }
  function pickBay(p: any){
    for(const b of bays) if(rectHit(p.x,p.y,b)) return b;
    return null;
  }
  // открытый бокс под точкой (для фиксации конца маршрута)
  function openBayAt(p: any){
    // конец маршрута «прилипает» к боксу не только внутри его прямоугольника, но и в
    // запасе MT.BAY_HIT_PADDING вокруг (настраивается в tuning.html, по умолчанию 0;
    // зону рисует слой MT.DEBUG_BAY_SNAP_ZONES — тоже только в Workbench)
    const pad=(MT_META_VALUES.BAY_HIT_PADDING as number)||0;
    for(const b of bays) if(b.open && (rectPad(p.x,p.y,b,pad) || inGrabZone(p.x,p.y,bayGrabZone(b)))) return b;
    return null;
  }
  // конец нарисованного маршрута попал в бокс → ведём борт ровно по оси ворот
  // (подход снаружи → центр), так что въезд получается строго по центру и носом вперёд
  function lockRouteToBay(pl: any, b: any){
    const o=dirOut(b);
    const cx=b.x+b.w/2, cy=b.y+b.h/2;
    const vert=Math.abs(o.dy)>Math.abs(o.dx);
    const half=(vert?b.h:b.w)/2;
    const apx=cx+o.dx*(half+22*ui), apy=cy+o.dy*(half+22*ui);  // точка подхода на оси ворот, снаружи
    // срезаем хвост маршрута, попавший внутрь бокса, и достраиваем «подход → центр»
    while(pl.path.length && rectHit(pl.path[pl.path.length-1].x, pl.path[pl.path.length-1].y, b)) pl.path.pop();
    pl.path.push({x:apx,y:apy},{x:cx,y:cy});
    pl.moving=true;
    // обратная связь игроку: маленькая вспышка + щелчок у ворот
    pulseFx(cx+o.dx*half, cy+o.dy*half, 'lock', 0.28);
    SND.lock(); HAP.tap();
  }
  // любая ВПП под точкой — для покупки направления (без фильтрации по open/closed)
  function runwayAt(p: any){ for(const r of runways) if(rectHit(p.x,p.y,r)) return r; return null; }
  // открытая ВПП под точкой с учётом направления (посадка / взлёт). Конец маршрута
  // «прилипает» к полосе в запасе MT.RUNWAY_HIT_PADDING вокруг неё (настройка в
  // tuning.html, по умолчанию 0; зону рисует слой MT.DEBUG_RUNWAY_SNAP_ZONES).
  function openRunwayAt(p: any, dir?: 'landing'|'takeoff'){
    const pad=(MT_META_VALUES.RUNWAY_HIT_PADDING as number)||0;
    for(const r of runways){
      if(r.closed) continue;
      if(dir==='landing' && !r.landingOpen) continue;
      if(dir==='takeoff' && !r.takeoffOpen) continue;
      if(rectPad(p.x,p.y,r,pad)) return r;
      // полукруг/квадрат у нужного торца: при заданном направлении — соответствующая
      // сторона, иначе проверяем обе (посадочную и взлётную)
      if(dir!=='takeoff' && inGrabZone(p.x,p.y,runwayGrabZone(r,'land')))   return r;
      if(dir!=='landing' && inGrabZone(p.x,p.y,runwayGrabZone(r,'takeoff'))) return r;
    }
    return null;
  }
  // стоимость ближайшей покупки закрытого направления ВПП по точке тапа
  // правая половина ВПП = посадочный торец (самолёты заходят справа)
  // левая половина = взлётный (разгон идёт влево→вправо, отрыв у правого края)
  function rwDirCost(r: any, p: any): {cost: number|null, dir: 'landing'|'takeoff'|null} {
    const mid = r.x + r.w * 0.5;
    if(p.x >= mid && !r.landingOpen) return {cost: r.landingCost, dir: 'landing'};
    if(p.x <  mid && !r.takeoffOpen) return {cost: r.takeoffCost, dir: 'takeoff'};
    // тап пришёл на «не ту» половину, но одно направление закрыто — предлагаем его
    if(!r.landingOpen) return {cost: r.landingCost, dir: 'landing'};
    if(!r.takeoffOpen) return {cost: r.takeoffCost, dir: 'takeoff'};
    return {cost: null, dir: null};   // оба направления открыты — тап не потребляем
  }
  // конец маршрута доведён на ВПП → притягиваем к оси полосы и фиксируем, как у бокса
  // (посадка — створ у небесного торца; взлёт — створ у полевого торца), вспышка + щелчок
  function lockRouteToRunway(pl: any, r: any){
    while(pl.path.length && rectHit(pl.path[pl.path.length-1].x, pl.path[pl.path.length-1].y, r)) pl.path.pop();
    const tx = (pl.zone==='air') ? (r.x + r.w - PLANE_LEN()*0.5) : (r.stopX + 8*ui);
    const ty = r.cy;
    pl.path.push({x:tx, y:ty});
    pl.moving=true;
    // воздушный заход: запоминаем целевую полосу, чтобы добрать борт до рубежа ВПП,
    // даже если большой «захват точки» съест последний waypoint раньше времени
    if(pl.zone==='air') pl.approachR = r;
    pulseFx(tx, ty, 'lock', 0.28);
    SND.lock(); HAP.tap();
  }
  // потолок прокачки конкретного ангара: 0, если апгрейд выключен (up:false) или это
  // деайс-инфраструктура; иначе глубина уровня (levelMaxUp — одна на всех ангаров карты).
  function bayMaxLvl(b: any){ if(b.deice || b.up===false) return 0; return levelMaxUp(); }
  function bayUpCost(b: any){
    if(b.deice) return null;
    if(!b.open) return b.openCost ?? K.BAY_OPEN_COST;
    if(b.lvl >= bayMaxLvl(b)) return null;          // апгрейд выключен или достигнут потолок уровня
    return b.upgCost ?? K.BAY_UP_COST[b.lvl] ?? null;
  }
  // Прямоугольник зелёного чипа «↑» открытого ангара — ровно то место, где его рисует
  // drawNeonBay. Апгрейд кликается ТОЛЬКО по этому чипу: тап по остальному телу бокса
  // больше не апгрейдит, чтобы не перехватывать захват борта, стоящего у ворот.
  function bayUpBtn(b: any){
    if(!b.open || b.deice || LV.bonus || bayUpCost(b)==null) return null;
    const pad=5*ui, top=(b.side!=='bottom');
    const bSize=Math.min(b.w*0.34, b.h*0.5, 40*ui);
    const cs=Math.min(bSize*0.72, 28*ui);
    return { x:b.x+b.w-pad-cs, y: top ? b.y+pad : b.y+b.h-pad-cs, w:cs, h:cs };
  }

  function down(e: any){
    if(!running) return;
    e.preventDefault();
    const p=pt(e);
    // pause button
    if(rectHit(p.x,p.y,pauseBtn)){ setPaused(!paused); return; }
    if(paused) return;

    // bay tap: закрытый бокс открываем тапом по нему; у открытого апгрейд кликается ТОЛЬКО
    // по зелёной стрелке ↑ — тап по остальному телу бокса не апгрейдит, а пропускается
    // дальше к захвату борта (иначе борт у ворот невозможно подцепить — тап уходил в апгрейд).
    const b=pickBay(p);
    if(b && !b.open){
      const cost=bayUpCost(b);
      if(cost!=null && money>=cost){
        money-=cost; b.open=true; ACH.onBayOpen(b);
        upgradesDone++; SND.build(); HAP.tap();
      }
      return;
    }
    if(b && b.open){
      const btn=bayUpBtn(b);
      if(btn && rectPad(p.x,p.y,btn,8*ui)){       // попал в стрелку (с запасом под палец)
        const cost=bayUpCost(b);
        if(cost!=null && money>=cost){
          money-=cost; b.lvl++; ACH.onBayUpgrade(b);
          upgradesDone++; SND.build(); HAP.tap();
        }
        return;                                   // тап по стрелке потреблён (даже если денег не хватило)
      }
      // мимо стрелки — НЕ апгрейдим; падаем дальше к захвату борта/прочему
    }
    // runway direction tap -> купить посадку или взлёт на ВПП
    if(!LV.bonus){
      const r=runwayAt(p);
      if(r){
        const res=rwDirCost(r, p);
        if(res.cost!=null){
          if(money>=res.cost){
            money-=res.cost;
            if(res.dir==='landing') r.landingOpen=true; else r.takeoffOpen=true;
            upgradesDone++;
            SND.build(); HAP.tap();
          }
          return;   // тап потреблён (есть что купить, даже если не хватает денег)
        }
      }
    }
    // лесной биом: тап по помехе высылает нужную спец-бригаду из сервисного здания
    if(LV.biome){
      const h=hazardAt(p);
      if(h){ dispatchCrew(h); return; }
    }
    // plane
    const pl=pickPlane(p);
    if(pl){
      selected=pl; ACH.onPlaneTouched(pl);
      SND.pick(); HAP.tap();
      planes.forEach(x=>x.selected=false); pl.selected=true;
      drag={plane:pl, start:p, last:p, drew:false};
    } else {
      selected=null; planes.forEach(x=>x.selected=false);
    }
  }
  function move(e: any){
    if(!drag||paused) return;
    e.preventDefault();
    if(drag.locked) return;          // маршрут уже зафиксирован на боксе — дальше не тянем
    const p=pt(e);
    if(!drag.drew && dist(p.x,p.y,drag.start.x,drag.start.y)>10){
      drag.drew=true;
      drag.plane.path=[];            // начинаем новый маршрут
      drag.plane.approachR=null;     // новый маршрут — старый воздушный заход сбрасываем
      drag.plane.moving=true;        // борт трогается сразу, как пошла линия
      drag.plane.autoPath=false;     // это нарисованный игроком маршрут — его показываем
    }
    if(drag.drew && dist(p.x,p.y,drag.last.x,drag.last.y)>12){
      drag.plane.path.push({x:p.x,y:p.y});
      drag.last=p;
      // конец траектории доведён в цель → фиксируем маршрут (вспышка + щелчок)
      if(!LV.bonus){
        const pl=drag.plane;
        const b = (pl.zone!=='air') ? openBayAt(p) : null;   // бокс — только с земли
        if(b){ lockRouteToBay(pl, b); drag.locked=true; }
        else {
          // ВПП: посадка (борт в воздухе) / взлёт (на земле, нужда 'depart')
          // openRunwayAt фильтрует по направлению — нельзя сесть на takeoff-only и наоборот
          const needDir = pl.zone==='air' ? 'landing' as const : 'takeoff' as const;
          const r = (pl.zone==='air' || curNeed(pl)==='depart') ? openRunwayAt(p, needDir) : null;
          if(r){ lockRouteToRunway(pl, r); drag.locked=true; }
        }
      }
    }
  }
  // конец воздушной траектории, заведённой на открытую ВПП, притягиваем в центр полосы
  // на полкорпуса от её правого (небесного) торца — посадка всегда по оси и в одну точку
  function snapAirPathToRunway(pl: any){
    if(pl.zone!=='air' || !pl.path.length) return;
    const last = pl.path[pl.path.length-1];
    for(const r of runways){
      if(r.closed || !r.landingOpen) continue;
      if(rectHit(last.x, last.y, r)){ last.x = r.x + r.w - PLANE_LEN()*0.5; last.y = r.cy; pl.approachR = r; break; }
    }
  }
  function up(){
    if(!drag) return;
    const pl=drag.plane;
    if(drag.drew){
      snapAirPathToRunway(pl);             // посадочный створ — в центр ВПП
      pl.moving = pl.path.length>0;        // поехали по маршруту
      pl.exiting=false;
    } else {
      // тап: если есть маршрут — переключаем стоп/движение
      if(pl.path.length) pl.moving = !pl.moving;
    }
    drag=null;
  }
  // На тач-устройствах один тап порождает И pointer-, И touch-событие. Если
  // слушать оба, down() срабатывает дважды на одно касание: для паузы (тоггл
  // setPaused(!paused)) это значит «вкл, тут же выкл» — кнопка как будто мёртвая.
  // Поэтому используем Pointer Events там, где они есть (везде в совр. браузерах),
  // и только при их отсутствии откатываемся на Touch Events.
  if(window.PointerEvent){
    cv.addEventListener('pointerdown',down);
    cv.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  } else {
    cv.addEventListener('touchstart',down,{passive:false});
    cv.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('touchend',up);
  }

  // ---- crashes ----
  function freeRes(pl: any){
    if(pl.runway){ if(pl.runway.occupied===pl) pl.runway.occupied=null; pl.runway=null; }
    if(pl.bay){ if(pl.bay.occupied===pl) pl.bay.occupied=null; pl.bay=null; }
  }
  // reason — ключ i18n (loss.*): в lossLog хранится ключ, перевод — при показе
  // penaltyFrac — доля reward, списываемая с кассы (0 = нет штрафа; 1 = полная стоимость борта)
  function logLoss(pl: any, reason: string, penaltyFrac = 0){
    if(pl.dead) return;
    pl.dead=true; boom(pl.x,pl.y); freeRes(pl);
    SND.crash(); HAP.crash();
    combo=0; runCrashes++;
    ACH.onCrash(pl, reason);
    if(!debug.infiniteLives) lives--;
    if(penaltyFrac > 0 && !debug.infiniteLives){
      const fine = Math.round(pl.reward * penaltyFrac);
      money -= fine;
      addFloat(pl.x, pl.y-24*ui, '−'+fmtMoney(fine), COL.life);
    }
    lossLog.push({t:gameTime, reason});
    if(lossLog.length>12) lossLog.shift();
    toast={text:(debug.infiniteLives?'✈ ':'−1 ✈ ')+t(reason), t:0, good:false};
    console.log('[PlaneFlow] '+(debug.infiniteLives?'(∞) ':'-1 ✈ ')+t(reason)+' | t='+fmtTime(gameTime)+' | lives='+lives);
  }
  function killAir(pl: any){ logLoss(pl, 'loss.airTimeout'); }
  function killCrash(pl: any, reason?: string){ logLoss(pl, reason||'loss.collision', LV.crashPenalty ?? 0); }

  function curNeed(pl: any){ return pl.requests[pl.reqIndex]; }

  function land(pl: any, r: any){            // начать посадку на полосу r
    pl.zone='runway'; pl.runway=r; if(!r.occupied) r.occupied=pl;
    pl.landing=true; pl.moving=true; pl.path=[]; pl.touched=false; pl.approachR=null;
    pl.rollSpeed = undefined;   // сбросить скорость пробега для нового захода
  }
  // момент касания (за корпус до полевого торца): толчок + визг резины.
  // FX касания живут здесь, а не в startGround, — это и есть «приземление».
  function touchdown(pl: any){
    pl.touched=true; pl.y=pl.runway.cy; pl.bounceAt=nowT;
    SND.screech(); HAP.tap();                        // визг резины
  }
  function startGround(pl: any){
    pl.landing=false; pl.zone='runway';
    const rem = pl.nSvc; // число услуг (без вылета)
    pl.groundMax = (K.GROUND_BASE + rem*K.GROUND_STEP) * pl.waitMult * (LV.calm || 1);
    pl.groundTime = pl.groundMax;
    pl.landedAt = gameTime;          // для экспресс-бонуса
    if(!pl.touched) touchdown(pl);   // страховка, если докатился без отдельного касания
    ACH.onLand(pl);
    // выкатывание с ВПП на апрон: борт не замирает на торце полосы (это некрасиво), а
    // докатывается вглубь апрона и встаёт перед входом. Авто-маршрут к точке остановки
    // на оси полосы; следящий код на ВПП доведёт его, освободит полосу и передаст в поле.
    const apronStopX = Math.max(field.x0 + 10, field.x1 - K.LAND_ROLLOUT*ui);
    // auto-маршрут (игрок его не рисовал) — не отрисовываем фосфорную линию (09b)
    pl.moving=true; pl.path=[{x:apronStopX, y:pl.runway.cy}]; pl.autoPath=true;
  }
  // наземный таймаут: борт улетает с частичной оплатой (LV.latePenalty, умолч. 50%)
  function groundPenalty(pl: any){
    pl.halfPay=true; runPenalties++; ACH.onGroundTimeout(pl);
    SND.penalty(); HAP.penalty();
    const pct = Math.round((LV.latePenalty ?? 0.5) * 100);
    addFloat(pl.x, pl.y-20*ui, '−'+pct+'%', COL.amber);
  }
  function serveTimeFor(b: any){ return K.SERVE_BASE / (1 + b.lvl*K.UP_SPEED); }
  function comboMult(){ return 1 + Math.min(combo, K.COMBO_MAX)*K.COMBO_STEP; }

  function depart(pl: any){             // успешный вылет
    served++;
    let pay = pl.reward, express=false;
    if(pl.halfPay){                // наземный штраф рвёт серию и режет оплату по latePenalty
      combo=0; pay = Math.round(pay * (1 - (LV.latePenalty ?? 0.5)));
    } else {
      combo++;                                       // серия растёт всегда (для достижений/HUD)
      // денежные эффекты применяются, только если ВКЛЮЧЕНЫ на этой карте (lvFx) —
      // так комбо/экспресс можно вводить постепенно; экономика учитывает это же
      express = lvFx.express && (gameTime - pl.landedAt) <= K.EXPRESS_TIME;
      const cm = lvFx.combo ? comboMult() : 1;
      pay = Math.round(pay * cm * (express?K.EXPRESS_BONUS:1));
      if(express) toast={text:t('toast.express', {money:fmtMoney(pay)}), t:0, good:true};
    }
    money += pay;
    SND.depart(express); HAP.ok();
    // якорь всплывашек — у вылетающего борта; награды стопкой ползут вверх над бортом
    const fx = pl.runway ? pl.runway.x+pl.runway.w-34*ui : Math.min(pl.x, W-40*ui);
    const fy = pl.runway ? pl.runway.cy : pl.y;
    addFloat(fx, fy, '+'+fmtMoney(pay), pl.halfPay?COL.muted:COL.coin);
    pulseFx(fx, fy+12*ui, 'takeoff', 0.6);   // отрыв: спид-лайны
    // мгновенный дофамин: «×N комбо» за серию и «вовремя!» за экспресс — над «+N ₿»
    let stack = 17*ui;
    if(lvFx.combo && combo>=2){ addFloat(fx, fy-stack, t('float.combo',{x:combo}), COL.gold); stack+=17*ui; }
    if(express){ addFloat(fx, fy-stack, t('float.express'), COL.teal); stack+=17*ui; }
    // бонус-мир: метаморфоза — гусеница вылетает бабочкой 🦋 + премия-нектар
    if(LV.bonus){
      const pollen = Math.max(2, Math.round(pl.reward * 0.5));
      money += pollen;
      addFloat(fx, fy-stack, '🦋 +'+fmtMoney(pollen), COL.rose);
      pulseFx(fx, fy, 'success', 0.6);
    }
    ACH.onDepart(pl, pay);
    if(tut && tut.plane===pl) completeTutorial();
    pl.dead=true; freeRes(pl);
  }
  function metricValue(){
    const m = LV.objective.metric;
    return m==='upgrades' ? upgradesDone : m==='survival' ? Math.floor(gameTime) : served;
  }
  // звёзды-градация (как в референсе): пороги stars=[1★,2★,3★] по основной метрике
  // (served · upgrades · survival=сек). Опц. доп-условия — пер-тир массивы (длиной 3):
  // upg ≥ апгрейдов, money ≥ касса, lives ≥ жизней, timeTier ≤ время закрытия (сек),
  // maxLate ≤ просрочек, maxCrash ≤ крушений. Тир берётся, если выполнены ВСЕ заданные
  // условия этого тира (AND). Разбор — docs/design/game-design/star-conditions.md.
  function tierMet(o: any, i: number, v: number){
    const th = o.stars || [o.target ?? 0, o.target ?? 0, o.target ?? 0];
    if(!(v >= (th[i] ?? 0))) return false;
    if(o.upg      && !(upgradesDone >= o.upg[i]))   return false;
    if(o.money    && !(money        >= o.money[i])) return false;
    if(o.lives    && !(lives        >= o.lives[i])) return false;
    if(o.timeTier && !(gameTime     <= o.timeTier[i])) return false;
    if(o.maxLate  && !(runPenalties <= o.maxLate[i]))  return false;
    if(o.maxCrash && !(runCrashes   <= o.maxCrash[i])) return false;
    return true;
  }
  function computeStars(){
    const o = LV.objective, v = metricValue();
    let s = 0;
    for(let i=0; i<3; i++){ if(tierMet(o, i, v)) s = i+1; else break; }
    return s;
  }
  function recordResult(){
    // Survival: только личный рекорд карты (обслуженные борта); звёзды/прогресс кампании не трогаем
    if(survival){
      if(save.best[levelKey]==null || served>save.best[levelKey]) save.best[levelKey]=served;
      saveGame(); return;
    }
    const stars=computeStars();
    if(save.best[levelKey]==null || served>save.best[levelKey]) save.best[levelKey]=served;
    if(save.stars[levelKey]==null || stars>save.stars[levelKey]) save.stars[levelKey]=stars;
    // прогресс кампании двигают только её уровни (числовой ключ); биом-карты — нет
    if(typeof levelKey==='number' && stars>=1 && save.unlocked < levelIdx+2) save.unlocked = Math.min(LEVELS.length, levelIdx+2);
    saveGame();
  }
