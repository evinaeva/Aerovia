// ===== 08-gameplay — pointer input, routing/picking, landing & takeoff, economy & scoring (event-driven) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: reset, spawnPlane, down/move/up, pickPlane/pickBay, land, touchdown, depart, computeStars, recordResult, dist/rectHit, updateForest, neededCrew, …
// Reads: 01 (cv, ctx); 04 (K, LV, LEVELS, levelEconomy, levelEvents, airPatience); 06 (planes, bays, runways, money, lives, served, save, field, combo…); 03 (t, fmtMoney); 07 (SND, HAP, Analytics); 12 (ACH); 08b (dirOut); 09b (boom, pulseFx, completeTutorial); 11 (saveGame, setPaused, showGoals).

  function reset(){
    econ = levelEconomy(LV); lvFx = econ.effects;   // оплата/касса и активные денежные эффекты — из уровня
    planes=[]; money=debug.richStart?BIG_MONEY:econ.startMoney; lives=K.START_LIVES; served=0; gameTime=0;
    // раунд начинается с пустого неба: первый борт прилетает через 1–3 секунды
    spawnTimer=1 + Math.random()*2; running=true; paused=false; inMenu=false;
    lossLog=[]; toast=null;
    document.getElementById('pauseScreen')!.classList.add('hidden');
    bays.forEach((b,bi)=>{ b.occupied=null;
      if(b.deice){ b.open=true; b.lvl=0; return; }   // де-айс — инфраструктура, всегда открыт
      // исходное «открыт» хранится на боксе (open0) при сборке (и layout, и sides ставят
      // его); старый sides-фолбэк остаётся лишь на случай боксов без open0
      const sc = LV.sides ? (LV.sides as Record<string, SideCfg>)[b.side] : undefined;
      b.open = (b.open0!=null) ? !!b.open0 : (sc ? b.slot < sc.open : false);
      // начальный уровень апгрейда: из HangarDef.lvl если задан, иначе 0
      const hg = (LV.layout && LV.layout.hangars) ? LV.layout.hangars[bi] : null;
      b.lvl = (hg && hg.lvl) ? Math.min(hg.lvl, bayMaxLvl(b)) : 0;
    });
    runways.forEach((r,k)=>{
      r.occupied=null; r.closed=false; r.hazard=null;
      // сбрасываем направленные флаги открытия из конфига уровня
      const rd = (LV.layout && LV.layout.runways) ? LV.layout.runways[k] : null;
      r.landingOpen = !rd || rd.landingOpen!==false;
      r.takeoffOpen = !rd || rd.takeoffOpen!==false;
    });
    effects=[]; floaters=[]; alarmAt=0; slowmo=0; nearMissPairs={}; selected=null; levelPassed=false; upgradesDone=0;
    statPeak=0; statSamples=[]; statStep=1.5; statNextAt=0; spawnedTotal=0;
    combo=0; runCrashes=0; runPenalties=0;
    rushUntil=0; windUntil=0; fogUntil=0;
    // атмосфера: «часы» суток идут всегда; погода — опциональный движок (флаг weather)
    dayPhase=0; nightAmount=0; weather='clear'; weatherUntil=0;
    nextWeather = LV.weather ? K.WEATHER_PERIOD : Infinity;
    hazards=[]; crews=[]; hazardSeq=0;
    const forest = LV.biome==='forest';
    if(LV.biome){
      // биом-карты (Survival) сохраняют динамику час-пика; у леса — свои помехи на
      // полосах вместо «ветра/тумана»
      nextRush = K.RUSH_PERIOD;
      nextWind = (forest||K.WEATHER_EVENTS_OFF)?Infinity:K.WIND_PERIOD;
      nextFog  = (forest||K.WEATHER_EVENTS_OFF)?Infinity:K.FOG_PERIOD;
      nextHazard = forest?FOR.SPAWN_FIRST:Infinity;
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
    showGoals(false);          // крупное окно постановки целей в начале раунда (заодно ставит на паузу)
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
        entering:false, path:[], moving:false, selected:false, target:null,
        landing:false, takeoff:false, exiting:false,
        runway:null, bay:null,
        airTime:Infinity, airMax:Infinity, waitMult:2,
        groundTime:groundMax, groundMax, serveTime:0, serveMax:0, landedAt:0,
        halfPay:false, dead:false,
        reward: econ.svcReward,
        baseType:'normal' as const, rewardMultiplier:1,
        vip:false, emergency:false, medical:false,
      });
      return;
    }
    // спец-борты как мини-события (раздел 3 копилки): частный джет (вип),
    // «топливо на нуле» (срочный + бонус), медицинский (приоритет — высадка пациента).
    const evs = levelEvents();                                           // какие спецборты разрешены уровнем
    const vip = evs.vip && Math.random() < K.VIP_CHANCE;                 // частный джет
    const emergency = evs.emergency && !vip && Math.random() < K.EMERGENCY_CHANCE;        // «топливо на нуле»
    const medical = evs.medical && !vip && !emergency && Math.random() < K.MEDICAL_CHANCE; // медицинский
    // КОНСТРУКТОР: борт запрашивает услуги ТОЛЬКО из набора уровня (services). Копируем
    // массив перед перемешиванием — levelServices() может вернуть сам конфиг (не мутируем).
    const svcPool = shuffle(levelServices().slice());
    // медицинский: высаживает пациента в пассажирском боксе, затем сразу вылет
    const nSvc = medical ? 1 : Math.min(svcPool.length, (Math.random() < K.TWO_SVC_CHANCE ? 2 : 1));
    const requests = medical ? ['board','depart'] : svcPool.slice(0, nSvc).concat(['depart']);
    // де-айсинг: в снегопад обычный борт обязан пройти антиобледенение перед вылетом
    // (медицинский — «вне очереди», пропускаем). Шаг ставится прямо перед 'depart'.
    if(LV.deice && weather==='snow' && !medical) requests.splice(requests.length-1, 0, 'deice');
    const waitMult = (vip||medical) ? 1 : 2;                             // НАЗЕМНОЕ терпение: джет и медицинский нетерпеливы
    // воздушное терпение: ФИКС. окно (K.AIR_BASE) — одинаковое на всех уровнях; pace не влияет.
    // спецборты урезают его множителем: vip вдвое нетерпеливее (FAQ), топливо-на-нуле —
    // садить срочно, медицинский — тоже спешит.
    // бонус-мир «спокойный»: гусеницы терпеливые (level.calm растягивает таймеры)
    const calmMult = LV.calm || 1;
    const airBase = airPatience({vip, emergency, medical}, calmMult);
    const baseType: 'normal'|'vip' = vip ? 'vip' : 'normal';
    const rewardMultiplier = (vip?2:1) * (emergency?K.EMERGENCY_BONUS:1) * (medical?K.MEDICAL_BONUS:1);
    const reward = Math.round(nSvc * econ.svcReward * rewardMultiplier);
    // вертикальная позиция зависания — у одной из полос/между ними
    const y = field.y0 + 30*ui + Math.random()*(field.y1 - field.y0 - 60*ui);
    spawnedTotal++;
    planes.push({
      id: ++planeSeq,
      x: W + 40*ui, y, ang: Math.PI, // влетает с правого края, нос влево
      vip, emergency, medical, requests, reqIndex:0,
      baseType, rewardMultiplier,
      zone:'air',            // air | runway | field | bay
      entering:true,         // глиссада с правого края до точки зависания
      path:[], moving:false, selected:false, target:null,
      landing:false, takeoff:false, exiting:false,
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
    // снежный занос — только в снегопад (зимний геймплей поверх лесных помех)
    const pool = weather==='snow' ? ['tree','deer','birds','snow'] : ['tree','deer','birds'];
    const kind = pool[Math.floor(Math.random()*pool.length)];
    const h: any = { id:++hazardSeq, kind, runway:r, t:0, dispatched:false, done:false };
    if(kind==='snow'){
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
    addFloat(home.x, home.y-14*ui, t('forest.crew.'+neededCrew(h)), COL.teal);
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
      money += FOR.REWARD;
      addFloat(h.x, h.y-18*ui, '+'+fmtMoney(FOR.REWARD), COL.coin);
      SND.served(); HAP.ok();
      toast = {text:t('forest.cleared'), t:0, good:true};
    }
  }
  function updateForest(dt: number){
    if(gameTime>=nextHazard){ spawnHazard(); nextHazard = gameTime + FOR.SPAWN_MIN + Math.random()*(FOR.SPAWN_MAX-FOR.SPAWN_MIN); }
    // помехи
    for(const h of hazards){
      if(h.done) continue;
      h.t += dt;
      if(h.kind==='tree'){
        if(!h.fallen && h.t>=h.fallTime){ h.fallen=true; h.runway.closed=true; } // легло поперёк полосы
      } else if(h.kind==='deer'){
        if(!h.dispatched && h.t>=FOR.DEER_LIFE) resolveHazard(h, false);          // олень сам ушёл
      } else if(h.kind==='birds'){
        if(!h.dispatched && h.t>=FOR.BIRD_LIFE) resolveHazard(h, false);          // птицы улетели
      }
      // снег (kind==='snow') сам не уходит — нужен плуг (создаёт «всегда есть дело»)
    }
    // спец-авто: едут к помехе → работают → возвращаются домой
    for(const c of crews){
      if(c.phase==='work'){
        c.workT -= dt;
        if(c.workT<=0){ resolveHazard(c.hazard, true); c.phase='home'; c.tx=c.hx; c.ty=c.hy; }
        continue;
      }
      const d = dist(c.x,c.y,c.tx,c.ty);
      if(d<=4){
        if(c.phase==='out'){ c.phase='work'; c.workT=FOR.WORK_TIME; }
        else c.done=true;
      } else {
        const step = Math.min(FOR.CREW_SPEED*dt, d);
        c.x += (c.tx-c.x)/d*step; c.y += (c.ty-c.y)/d*step;
      }
    }
    crews = crews.filter(c=>!c.done);
  }

  // ---- geometry ----
  const rectHit = (px: number,py: number,r: any) => px>r.x && px<r.x+r.w && py>r.y && py<r.y+r.h;
  const dist = (ax: number,ay: number,bx: number,by: number) => Math.hypot(ax-bx, ay-by);

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
    for(const b of bays) if(b.open && rectHit(p.x,p.y,b)) return b;
    return null;
  }
  // конец нарисованного маршрута попал в бокс → ведём борт ровно по оси ворот
  // (подход снаружи → центр), так что въезд получается строго по центру и носом вперёд
  function lockRouteToBay(pl: any, b: any){
    const sp = b.snapPoints && b.snapPoints[0];  // единственная gate-точка ангара
    const o=dirOut(b);
    const cx=b.x+b.w/2, cy=b.y+b.h/2;
    const vert=Math.abs(o.dy)>Math.abs(o.dx);
    const half=(vert?b.h:b.w)/2;
    const apx=cx+o.dx*(half+22*ui), apy=cy+o.dy*(half+22*ui);  // точка подхода на оси ворот, снаружи
    // срезаем хвост маршрута, попавший внутрь бокса, и достраиваем «подход → центр»
    while(pl.path.length && rectHit(pl.path[pl.path.length-1].x, pl.path[pl.path.length-1].y, b)) pl.path.pop();
    pl.path.push({x:apx,y:apy},{x:cx,y:cy});
    pl.moving=true;
    // сохраняем привязку к snap-точке (для редактора / FSM / дебага)
    pl.target = sp ? { snapPointId:sp.id, entityId:sp.ownerId } : null;
    // обратная связь игроку: маленькая вспышка + щелчок у ворот
    const snapX = sp ? sp.x : cx+o.dx*half;
    const snapY = sp ? sp.y : cy+o.dy*half;
    pulseFx(snapX, snapY, 'lock', 0.28);
    SND.lock(); HAP.tap();
  }
  // открытая ВПП под точкой (для фиксации конца маршрута при взлёте/посадке).
  // kind='land' проверяет r.landingOpen; kind='take' — r.takeoffOpen.
  function openRunwayAt(p: any, kind?: 'land'|'take'){
    for(const r of runways){
      if(r.closed) continue;
      if(kind==='land' && !r.landingOpen) continue;
      if(kind==='take' && !r.takeoffOpen) continue;
      if(rectHit(p.x,p.y,r)) return r;
    }
    return null;
  }
  // конец маршрута доведён на ВПП → притягиваем к оси полосы и фиксируем, как у бокса
  // (посадка — створ у небесного торца; взлёт — створ у полевого торца), вспышка + щелчок
  function lockRouteToRunway(pl: any, r: any){
    while(pl.path.length && rectHit(pl.path[pl.path.length-1].x, pl.path[pl.path.length-1].y, r)) pl.path.pop();
    const isLanding = pl.zone==='air';
    const tx = isLanding ? (r.x + r.w - PLANE_LEN()*0.5) : (r.stopX + 8*ui);
    const ty = r.cy;
    pl.path.push({x:tx, y:ty});
    pl.moving=true;
    // находим подходящую snap-точку (entry для посадки, holding для взлёта)
    const spRole = isLanding ? 'entry' : 'holding';
    const sp = r.snapPoints && r.snapPoints.find((s: SnapPoint)=>s.role===spRole);
    pl.target = sp ? { snapPointId:sp.id, entityId:sp.ownerId } : null;
    pulseFx(tx, ty, 'lock', 0.28);
    SND.lock(); HAP.tap();
  }
  // потолок прокачки конкретного ангара: 0, если апгрейд выключен (up:false) или это
  // деайс-инфраструктура; иначе минимум из глубины уровня (levelMaxUp) и per-bay maxLvl.
  function bayMaxLvl(b: any){
    if(b.deice || b.up===false) return 0;
    const global = levelMaxUp();
    const perBay = (b.maxLvl != null) ? Math.min(b.maxLvl, K.BAY_MAX_LVL) : K.BAY_MAX_LVL;
    return Math.min(global, perBay);
  }
  function bayUpCost(b: any){
    if(b.deice) return null;
    if(!b.open) return K.BAY_OPEN_COST;
    if(b.lvl >= bayMaxLvl(b)) return null;          // апгрейд выключен или достигнут потолок
    if(b.upgradeCost != null) return b.upgradeCost; // per-bay цена override
    return K.BAY_UP_COST[b.lvl] || null;
  }

  function down(e: any){
    if(!running) return;
    e.preventDefault();
    const p=pt(e);
    // pause button
    if(rectHit(p.x,p.y,pauseBtn)){ setPaused(!paused); return; }
    if(paused) return;

    // bay tap -> open / upgrade
    const b=pickBay(p);
    if(b){
      const cost=bayUpCost(b);
      if(cost!=null && money>=cost){
        money-=cost;
        if(!b.open){ b.open=true; ACH.onBayOpen(b); } else { b.lvl++; ACH.onBayUpgrade(b); }
        upgradesDone++;
        SND.build(); HAP.tap();
      }
      return;
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
      drag.plane.moving=true;        // борт трогается сразу, как пошла линия
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
          // …или на ВПП: посадка (борт в воздухе) / взлёт (на земле, нужда 'depart')
          const kind = pl.zone==='air' ? 'land' : 'take';
          if(pl.zone==='air' || curNeed(pl)==='depart'){
            const r = openRunwayAt(p, kind);
            if(r){ lockRouteToRunway(pl, r); drag.locked=true; }
          }
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
      if(rectHit(last.x, last.y, r)){ last.x = r.x + r.w - PLANE_LEN()*0.5; last.y = r.cy; break; }
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
  function logLoss(pl: any, reason: string, moneyPenalty?: boolean){
    if(pl.dead) return;
    pl.dead=true; boom(pl.x,pl.y); freeRes(pl);
    SND.crash(); HAP.crash();
    combo=0; runCrashes++;          // крушение сбрасывает серию и портит «чистоту»
    ACH.onCrash(pl, reason);
    if(!debug.infiniteLives) lives--;
    if(moneyPenalty){ money-=pl.reward; addFloat(pl.x, pl.y-24*ui, '−'+fmtMoney(pl.reward), COL.life); }
    lossLog.push({t:gameTime, reason});
    if(lossLog.length>12) lossLog.shift();
    toast={text:(debug.infiniteLives?'✈ ':'−1 ✈ ')+t(reason), t:0, good:false};
    console.log('[PlaneFlow] '+(debug.infiniteLives?'(∞) ':'-1 ✈ ')+t(reason)+' | t='+fmtTime(gameTime)+' | lives='+lives);
  }
  function killAir(pl: any){ logLoss(pl, 'loss.airTimeout', false); }
  function killCrash(pl: any, reason?: string){ logLoss(pl, reason||'loss.collision', true); }

  function curNeed(pl: any){ return pl.requests[pl.reqIndex]; }

  function land(pl: any, r: any){            // начать посадку на полосу r
    pl.zone='runway'; pl.runway=r; if(!r.occupied) r.occupied=pl;
    pl.landing=true; pl.moving=true; pl.path=[]; pl.touched=false;
  }
  // момент касания (за корпус до полевого торца): толчок + визг резины.
  // FX касания живут здесь, а не в startGround, — это и есть «приземление».
  function touchdown(pl: any){
    pl.touched=true; pl.y=pl.runway.cy; pl.bounceAt=nowT;
    SND.screech(); HAP.tap();                        // визг резины
  }
  function startGround(pl: any){
    pl.landing=false; pl.moving=false; pl.zone='runway'; // стоит на полосе, ждёт руления
    const rem = pl.nSvc; // число услуг (без вылета)
    pl.groundMax = (K.GROUND_BASE + rem*K.GROUND_STEP) * pl.waitMult * (LV.calm || 1);
    pl.groundTime = pl.groundMax;
    pl.landedAt = gameTime;          // для экспресс-бонуса
    if(!pl.touched) touchdown(pl);   // страховка, если докатился без отдельного касания
    ACH.onLand(pl);
  }
  // наземный таймаут: −50% оплаты (звук/вибро/всплывающий «−50%» — в одном месте)
  function groundPenalty(pl: any){
    pl.halfPay=true; runPenalties++; ACH.onGroundTimeout(pl);
    SND.penalty(); HAP.penalty();
    addFloat(pl.x, pl.y-20*ui, '−50%', COL.amber);
  }
  function serveTimeFor(b: any){ return K.SERVE_BASE / (1 + b.lvl*K.UP_SPEED); }
  function comboMult(){ return 1 + Math.min(combo, K.COMBO_MAX)*K.COMBO_STEP; }

  function depart(pl: any){             // успешный вылет
    served++;
    let pay = pl.reward, express=false;
    if(pl.halfPay){                // наземный штраф рвёт серию и режет оплату вдвое
      combo=0; pay = Math.round(pay*0.5);
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
  function metricValue(){ return LV.objective.metric==='upgrades' ? upgradesDone : served; }
  // звёзды-градация (как в референсе): пороги stars=[1★,2★,3★] по основной метрике.
  // upg (если задан) — доп. порог по апгрейдам для соответствующей звезды: чтобы
  // взять 2★/3★, нужно дотянуть И метрику, И апгрейды (✈+🔧 на L3).
  function computeStars(){
    const o = LV.objective, v = metricValue(), th = o.stars || [o.target ?? 0, o.target ?? 0, o.target ?? 0];
    let s = 0;
    for(let i=0; i<th.length; i++){
      if(v >= th[i] && (!o.upg || upgradesDone >= o.upg[i])) s = i+1; else break;
    }
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
