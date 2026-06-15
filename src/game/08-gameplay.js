  function reset(){
    econ = levelEconomy(LV); lvFx = econ.effects;   // оплата/касса и активные денежные эффекты — из уровня
    planes=[]; money=debug.richStart?BIG_MONEY:econ.startMoney; lives=K.START_LIVES; served=0; gameTime=0;
    // раунд начинается с пустого неба: первый борт прилетает через 1–3 секунды
    spawnTimer=1 + Math.random()*2; running=true; paused=false; inMenu=false;
    lossLog=[]; toast=null;
    document.getElementById('pauseScreen').classList.add('hidden');
    bays.forEach(b=>{ b.occupied=null;
      if(b.deice){ b.open=true; b.lvl=0; return; }   // де-айс — инфраструктура, всегда открыт
      // НЕОН-КОМПОЗИЦИЯ: исходное «открыт» хранится на боксе (open0) при сборке —
      // side-агностично (стороны теперь только top/bottom, см. layout)
      b.open = (b.open0!=null) ? !!b.open0 : (LV.sides[b.side] ? b.slot < LV.sides[b.side].open : false); b.lvl=0; });
    runways.forEach(r=>{ r.occupied=null; r.closed=false; r.hazard=null; });
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

  function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

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
    const vip = evs.vip && Math.random() < K.VIP_CHANCE;                 // частный джет
    const emergency = evs.emergency && !vip && Math.random() < K.EMERGENCY_CHANCE;        // «топливо на нуле»
    const medical = evs.medical && !vip && !emergency && Math.random() < K.MEDICAL_CHANCE; // медицинский
    const pool = shuffle(['repair','fuel','board']);
    // медицинский: высаживает пациента в пассажирском боксе, затем сразу вылет
    const nSvc = medical ? 1 : (Math.random() < K.TWO_SVC_CHANCE ? 2 : 1);
    const requests = medical ? ['board','depart'] : pool.slice(0, nSvc).concat(['depart']);
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
    const bonus = (vip?2:1) * (emergency?K.EMERGENCY_BONUS:1) * (medical?K.MEDICAL_BONUS:1);
    const reward = Math.round(nSvc * econ.svcReward * bonus);
    // вертикальная позиция зависания — у одной из полос/между ними
    const y = field.y0 + 30*ui + Math.random()*(field.y1 - field.y0 - 60*ui);
    spawnedTotal++;
    planes.push({
      id: ++planeSeq,
      x: W + 40*ui, y, ang: Math.PI, // влетает с правого края, нос влево
      vip, emergency, medical, requests, reqIndex:0,
      zone:'air',            // air | runway | field | bay
      entering:true,         // глиссада с правого края до точки зависания
      path:[], moving:false, selected:false,
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
  function neededCrew(h){
    if(h.kind==='tree') return h.fallen ? 'truck' : 'chainsaw';
    if(h.kind==='deer') return 'truck';
    if(h.kind==='snow') return 'plow';
    return 'eagle';
  }
  // помеха под пальцем (для тапа): берём ближайшую ещё не обслуживаемую
  function hazardAt(p){
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
    const h = { id:++hazardSeq, kind, runway:r, t:0, dispatched:false, done:false };
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
  function dispatchCrew(h){
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
  function resolveHazard(h, rewarded){
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
  function updateForest(dt){
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
  const rectHit = (px,py,r) => px>r.x && px<r.x+r.w && py>r.y && py<r.y+r.h;
  const dist = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);

  // ---- input ----
  let selected=null, drag=null;
  function pt(e){
    const r=cv.getBoundingClientRect();
    const s=e.touches?e.touches[0]:e;
    return {x:s.clientX-r.left, y:s.clientY-r.top};
  }
  function pickPlane(p){
    let best=null, bd=K.GRAB;
    for(const pl of planes){
      if(pl.zone==='bay') continue;
      const d=dist(pl.x,pl.y,p.x,p.y);
      if(d<bd){bd=d;best=pl;}
    }
    return best;
  }
  function pickBay(p){
    for(const b of bays) if(rectHit(p.x,p.y,b)) return b;
    return null;
  }
  // открытый бокс под точкой (для фиксации конца маршрута)
  function openBayAt(p){
    for(const b of bays) if(b.open && rectHit(p.x,p.y,b)) return b;
    return null;
  }
  // конец нарисованного маршрута попал в бокс → ведём борт ровно по оси ворот
  // (подход снаружи → центр), так что въезд получается строго по центру и носом вперёд
  function lockRouteToBay(pl, b){
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
  // открытая ВПП под точкой (для фиксации конца маршрута при взлёте/посадке)
  function openRunwayAt(p){
    for(const r of runways){ if(!r.closed && rectHit(p.x,p.y,r)) return r; }
    return null;
  }
  // конец маршрута доведён на ВПП → притягиваем к оси полосы и фиксируем, как у бокса
  // (посадка — створ у небесного торца; взлёт — створ у полевого торца), вспышка + щелчок
  function lockRouteToRunway(pl, r){
    while(pl.path.length && rectHit(pl.path[pl.path.length-1].x, pl.path[pl.path.length-1].y, r)) pl.path.pop();
    const tx = (pl.zone==='air') ? (r.x + r.w - PLANE_LEN()*0.5) : (r.stopX + 8*ui);
    const ty = r.cy;
    pl.path.push({x:tx, y:ty});
    pl.moving=true;
    pulseFx(tx, ty, 'lock', 0.28);
    SND.lock(); HAP.tap();
  }
  function bayUpCost(b){ if(b.deice) return null; return b.open ? (K.BAY_UP_COST[b.lvl]||null) : K.BAY_OPEN_COST; }

  function down(e){
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
  function move(e){
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
          const r = openRunwayAt(p);
          if(r && (pl.zone==='air' || curNeed(pl)==='depart')){ lockRouteToRunway(pl, r); drag.locked=true; }
        }
      }
    }
  }
  // конец воздушной траектории, заведённой на открытую ВПП, притягиваем в центр полосы
  // на полкорпуса от её правого (небесного) торца — посадка всегда по оси и в одну точку
  function snapAirPathToRunway(pl){
    if(pl.zone!=='air' || !pl.path.length) return;
    const last = pl.path[pl.path.length-1];
    for(const r of runways){
      if(r.closed) continue;
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
  function freeRes(pl){
    if(pl.runway){ if(pl.runway.occupied===pl) pl.runway.occupied=null; pl.runway=null; }
    if(pl.bay){ if(pl.bay.occupied===pl) pl.bay.occupied=null; pl.bay=null; }
  }
  // reason — ключ i18n (loss.*): в lossLog хранится ключ, перевод — при показе
  function logLoss(pl, reason, moneyPenalty){
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
  function killAir(pl){ logLoss(pl, 'loss.airTimeout', false); }
  function killCrash(pl, reason){ logLoss(pl, reason||'loss.collision', true); }

  function curNeed(pl){ return pl.requests[pl.reqIndex]; }

  function land(pl, r){            // начать посадку на полосу r
    pl.zone='runway'; pl.runway=r; if(!r.occupied) r.occupied=pl;
    pl.landing=true; pl.moving=true; pl.path=[]; pl.touched=false;
  }
  // момент касания (за корпус до полевого торца): толчок + визг резины.
  // FX касания живут здесь, а не в startGround, — это и есть «приземление».
  function touchdown(pl){
    pl.touched=true; pl.y=pl.runway.cy; pl.bounceAt=nowT;
    SND.screech(); HAP.tap();                        // визг резины
  }
  function startGround(pl){
    pl.landing=false; pl.moving=false; pl.zone='runway'; // стоит на полосе, ждёт руления
    const rem = pl.nSvc; // число услуг (без вылета)
    pl.groundMax = (K.GROUND_BASE + rem*K.GROUND_STEP) * pl.waitMult * (LV.calm || 1);
    pl.groundTime = pl.groundMax;
    pl.landedAt = gameTime;          // для экспресс-бонуса
    if(!pl.touched) touchdown(pl);   // страховка, если докатился без отдельного касания
    ACH.onLand(pl);
  }
  // наземный таймаут: −50% оплаты (звук/вибро/всплывающий «−50%» — в одном месте)
  function groundPenalty(pl){
    pl.halfPay=true; runPenalties++; ACH.onGroundTimeout(pl);
    SND.penalty(); HAP.penalty();
    addFloat(pl.x, pl.y-20*ui, '−50%', COL.amber);
  }
  function serveTimeFor(b){ return K.SERVE_BASE / (1 + b.lvl*K.UP_SPEED); }
  function comboMult(){ return 1 + Math.min(combo, K.COMBO_MAX)*K.COMBO_STEP; }

  function depart(pl){             // успешный вылет
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
    const o = LV.objective, v = metricValue(), th = o.stars || [o.target, o.target, o.target];
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

  // ---- update ----
  function steer(pl, tx, ty, spd, dt){
    const desired=Math.atan2(ty-pl.y, tx-pl.x);
    let diff=desired-pl.ang;
    while(diff>Math.PI)diff-=2*Math.PI;
    while(diff<-Math.PI)diff+=2*Math.PI;
    const max=K.TURN*dt;
    pl.ang += Math.max(-max,Math.min(max,diff));
    pl.x += Math.cos(pl.ang)*spd*dt;
    pl.y += Math.sin(pl.ang)*spd*dt;
  }
  // плавный доворот курса к target (без смещения) — для парковки в боксе
  function turnTo(pl, target, dt){
    let d=target-pl.ang; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    const m=K.TURN*dt; pl.ang += Math.max(-m, Math.min(m, d));
  }
  function followPath(pl, spd, dt){
    if(!pl.path.length){ return false; }
    const wp=pl.path[0];
    steer(pl, wp.x, wp.y, spd, dt);
    const turnR = spd/K.TURN;                       // радиус разворота
    const capture = Math.max(K.ARRIVE, turnR*0.6);  // порог «доехал»
    const d = dist(pl.x,pl.y,wp.x,wp.y);
    // точка «позади по курсу» (за носом борта)
    const toX=wp.x-pl.x, toY=wp.y-pl.y;
    const behind = (toX*Math.cos(pl.ang) + toY*Math.sin(pl.ang)) < 0;
    // Выкидываем точку только если ДОЕХАЛИ (близко) или орбитим её рядом
    // (близкая точка позади = проскочили мимо). ДАЛЁКУЮ точку позади НЕ трогаем —
    // к ней борт разворачивается, а не считает уже пройденной. Иначе борт,
    // которому нужно развернуться (типично — готовый к вылету борт у бокса, а
    // ВПП сзади), выкидывал весь нарисованный маршрут и «буксовал» на месте.
    if(d < capture || (behind && d < turnR*1.5)) pl.path.shift();
    return true;
  }

  function update(dt){
    // динамические события (на чистых картах отключены: next* = Infinity)
    if(gameTime>=nextRush){ rushUntil=gameTime+K.RUSH_DUR; nextRush=gameTime+K.RUSH_PERIOD; toast={text:t('toast.rush'), t:0, good:false}; }
    if(gameTime>=nextWind){
      const open=runways.filter(r=>!r.closed);
      if(open.length>1){ open[Math.floor(Math.random()*open.length)].closed=true; windUntil=gameTime+K.WIND_DUR; toast={text:t('toast.wind'), t:0, good:false}; }
      nextWind=gameTime+K.WIND_PERIOD;
    }
    if(windUntil>0 && gameTime>=windUntil){ runways.forEach(r=>r.closed=false); windUntil=0; }
    if(gameTime>=nextFog){ fogUntil=gameTime+K.FOG_DUR; nextFog=gameTime+K.FOG_PERIOD; toast={text:t('toast.fog'), t:0, good:false}; }
    // «часы» суток (логика; визуал берёт nightAmount). Не влияют на сложность.
    { const dc = dayCycle(gameTime); dayPhase = dc.phase; nightAmount = dc.night; }
    // погода: окна rain/snow по таймеру (движок выключен, если nextWeather=Infinity)
    if(gameTime>=nextWeather){
      weather = Math.random()<K.WEATHER_SNOW_CHANCE ? 'snow' : 'rain';
      weatherUntil = gameTime+K.WEATHER_DUR; nextWeather = gameTime+K.WEATHER_PERIOD;
      toast = {text:t('toast.weather.'+weather), t:0, good:false};
    }
    if(weather!=='clear' && gameTime>=weatherUntil) weather='clear';
    const rush = gameTime<rushUntil;
    const fog = gameTime<fogUntil;
    // руление замедляют и туман, и непогода — берём наименьший (самый «вязкий») множитель
    const taxiSpeed = K.SPEED_TAXI * Math.min(fog?K.FOG_TAXI:1, weatherTaxiMult(weather));
    // spawn — ТЕМП уровня (pace) задаёт и частоту прилёта, и лимит одновременных бортов:
    // чем выше pace, тем короче интервал и больше бортов в небе разом → меньше «простоя».
    spawnTimer-=dt;
    const campaign = !LV.biome && !LV.bonus;
    // survival: темп (и потолок неба) растёт со временем; кампания — фикс. pace уровня; бонус — спокойный фон
    const pace = campaign ? levelPace(LV) : (survival ? survivalPace() : K.PACE_DEFAULT);
    const interval = paceInterval(pace, served, rush);
    // в туториале держим в небе только один борт — спокойно ведём его за руку
    const cap = tut ? 1 : ((campaign || survival) ? paceCap(pace) : K.MAX_PLANES);
    // кампания «посадить N»: всего прилетает ровно N бортов. Survival/race — поток бесконечный.
    const spawnCap = (!survival && LV.objective.metric==='served' && !LV.objective.race) ? LV.objective.target : Infinity;
    if(spawnTimer<=0 && planes.length<cap && spawnedTotal<spawnCap){ spawnPlane(); spawnTimer=interval; }

    updateTutorial();
    ACH.onTick(dt);
    if(LV.biome==='forest') updateForest(dt);

    for(const pl of planes){
      if(pl.dead) continue;

      // ---- AIR ----
      if(pl.zone==='air'){
        // влёт с правого края до точки зависания; игрок может перехватить маршрутом
        if(pl.entering){
          if(pl.moving && pl.path.length){ pl.entering=false; }
          else {
            steer(pl, field.hoverX, pl.y, K.SPEED_AIR, dt);
            if(pl.x<=field.hoverX){ pl.x=field.hoverX; pl.ang=Math.PI; pl.entering=false; }
            else continue;
          }
        }
        pl.airTime-=dt; if(pl.airTime<=0){ killAir(pl); continue; }
        if(pl.moving && pl.path.length){
          followPath(pl, K.SPEED_AIR, dt);
        }
        // заход на посадку: с неба на поле — ТОЛЬКО через ВПП. Сесть можно, лишь когда
        // борт идёт по оси открытой полосы (в пределах её полотна по вертикали). Если
        // маршрут ведёт мимо полос — рубеж ВПП работает как стена: дальше борт не
        // пускаем, он скользит вдоль неё, пока не выйдет на створ свободной полосы.
        // (садимся даже на занятую полосу — крушение только при физическом контакте)
        if(pl.x <= field.rwR){
          let best=null;
          for(const r of runways){ if(r.closed) continue; if(pl.y>=r.y && pl.y<=r.y+r.h){ best=r; break; } }
          if(best) land(pl, best);
          else pl.x = field.rwR;   // мимо полосы — упёрся в рубеж ВПП
        }
        continue;
      }

      // ---- RUNWAY ----
      if(pl.zone==='runway'){
        if(pl.landing){
          // идём по оси полосы к полевому торцу; за корпус до него — касание (толчок +
          // визг), дальше докатываемся уже на земле, не меняя размер
          const r=pl.runway;
          steer(pl, r.stopX, r.cy, K.SPEED_AIR*0.8, dt);
          if(!pl.touched && pl.x <= r.stopX + PLANE_LEN()) touchdown(pl);
          if(pl.touched) pl.y += (r.cy - pl.y) * Math.min(1, dt*8);   // держим по оси
          if(pl.x <= r.stopX+2){ pl.x=r.stopX; pl.y=r.cy; startGround(pl); }
          continue;
        }
        if(pl.takeoff){
          pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl);
          // крошечная остановка на старте: выравниваемся по оси и замираем, как настоящие
          // борта перед разгоном — затем плавно ускоряемся к небу, увеличиваясь
          if(pl.holdT>0){
            pl.holdT-=dt; turnTo(pl, 0, dt);
            pl.y += (pl.runway.cy - pl.y) * Math.min(1, dt*8);
            continue;
          }
          steer(pl, pl.runway.exitX+200, pl.runway.cy, K.SPEED_TAKEOFF, dt);
          if(pl.x > W+30){ depart(pl); }
          continue;
        }
        // стоит на полосе, ждёт руления к боксу
        pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl);
        if(pl.moving && pl.path.length){
          followPath(pl, taxiSpeed, dt);
          if(!rectHit(pl.x,pl.y,pl.runway)){          // съехал с полосы на поле
            if(pl.runway.occupied===pl) pl.runway.occupied=null;
            pl.runway=null; pl.zone='field';
          }
        }
        continue;
      }

      // ---- FIELD (руление) ----
      if(pl.zone==='field'){
        // бонус-мир: терпение гусеницы тикает, но улетающую бабочку не штрафуем
        if(!(LV.bonus && pl.bug==='fly')){ pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl); }
        const need=curNeed(pl);
        // бонус-мир: бабочка упорхивает к правому краю (без ВПП) и «вылетает»
        if(LV.bonus && pl.bug==='fly'){
          pl.moving=true;
          steer(pl, W+90*ui, pl.y-30*ui, K.SPEED_TAKEOFF*0.7, dt);   // вверх-вправо за край
          if(pl.x > W+30){ depart(pl); }
          continue;
        }
        if(pl.moving && pl.path.length){
          followPath(pl, taxiSpeed, dt);
          if(LV.bonus) pl.bonusCrawl=false;                          // игрок повёл сам — авто-вползание отменяем
        } else if(LV.bonus && pl.bonusCrawl){
          // авто-вползание с правого края до кромки поля, дальше ждём игрока
          // (игрок может перехватить раньше — потянул маршрут → bonusCrawl снимается выше)
          const ex = field.x1 - 24*ui;
          steer(pl, ex, pl.y, taxiSpeed, dt);
          if(pl.x <= ex){ pl.x=ex; pl.bonusCrawl=false; pl.moving=false; }
        } else if(pl.exiting){
          pl.exiting=false; pl.moving=false;
        }
        // вылет: все услуги сделаны -> заезд на полосу
        if(need==='depart'){
          for(const r of runways){
            if(!r.closed && rectHit(pl.x,pl.y,r)){
              // выезд на ОТКРЫТУЮ полосу под взлёт (крушение — только при контакте на ВПП)
              pl.zone='runway'; pl.runway=r; if(!r.occupied) r.occupied=pl;
              pl.takeoff=true; pl.moving=true; pl.path=[]; pl.holdT=K.TAKEOFF_HOLD;
              break;
            }
          }
        } else {
          // заезд в бокс
          for(const b of bays){
            if(!b.open) continue;
            if(rectHit(pl.x,pl.y,b)){
              if(b.type!==need){ /* не тот бокс — простаиваем рядом */ break; }
              if(b.occupied && b.occupied!==pl){ if(!LV.bonus){ killCrash(pl,'loss.collisionBay'); killCrash(b.occupied,'loss.collisionBay'); } }
              else {
                pl.zone='bay'; pl.bay=b; b.occupied=pl;
                pl.moving=false; pl.path=[];
                pl.serveMax=serveTimeFor(b); pl.serveTime=pl.serveMax;
                if(LV.bonus){ pl.bug='cocoon'; pl.landedAt=gameTime; }   // бонус: окуклилась; «вовремя» — от входа в цветок
                else { pl.bayPhase='in'; }                              // кампания: плавный заезд носом к стене
                SND.dock();
              }
              break;
            }
          }
        }
        continue;
      }

      // ---- BAY (обслуживание): плавный заезд по центру носом к стене → стоянка →
      //      по завершении услуги: к центру, разворот носом наружу, плавный выезд и остановка ----
      if(pl.zone==='bay'){
        const b=pl.bay, o=dirOut(b);
        // бонус-мир: гусеница окуклилась — куколка спокойно сидит в серединке цветка,
        // без маневра; по истечении времени метаморфозы превращается в бабочку
        if(LV.bonus){
          pl.serveTime-=dt;
          const fcx=b.x+b.w/2, fcy=b.y+b.h*0.40;        // центр цветка (где он нарисован)
          pl.x += (fcx-pl.x)*Math.min(1, dt*6); pl.y += (fcy-pl.y)*Math.min(1, dt*6);
          if(pl.serveTime<=0){
            b.occupied=null; pl.bay=null;
            pl.reqIndex++; ACH.onService(pl); SND.served();
            pulseFx(fcx,fcy,'success',0.6);
            pl.bug='fly'; pl.ang=0;                       // вылупилась бабочка — курс к краю
            pl.zone='field'; pl.x=fcx; pl.y=fcy; pl.moving=true; pl.path=[];
          }
          continue;
        }
        pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl);
        const cx=b.x+b.w/2, cy=b.y+b.h/2;
        const vert=Math.abs(o.dy)>Math.abs(o.dx);
        const half=(vert? b.h : b.w)/2;
        const L=13*ui, gap=4*ui;                   // полудлина борта + зазор до стены
        const parkA = -(half - L - gap);           // центр борта у дальней стены (целиком внутри)
        const exitA =  (half + L + gap);           // центр борта снаружи у ворот — точка остановки после выезда
        // держим борт ровно на оси ворот → нет касания боковых стен
        if(vert) pl.x += (cx-pl.x)*Math.min(1, dt*6);
        else     pl.y += (cy-pl.y)*Math.min(1, dt*6);
        const along = vert ? (pl.y-cy)*o.dy : (pl.x-cx)*o.dx;  // вдоль оси, наружу +
        const step = taxiSpeed*dt*0.85;
        const setAlong = a => { if(vert) pl.y=cy+a*o.dy; else pl.x=cx+a*o.dx; };
        const angIn=Math.atan2(-o.dy,-o.dx), angOut=Math.atan2(o.dy,o.dx);
        // обслуживание идёт, пока борт заезжает и стоит носом к стене (не во время выезда)
        if(pl.bayPhase!=='out'){
          pl.serveTime-=dt;
          if(pl.serveTime<=0){
            // услуга выполнена → награда игроку и переход к плавному выезду
            pl.bayPhase='out';
            pl.reqIndex++; ACH.onService(pl); SND.served();
            pulseFx(cx,cy,'success',0.5);
          }
        }
        if(pl.bayPhase==='out'){
          // ВЫЕЗД: подать к центру (клиренс для разворота) → довернуть носом наружу →
          // плавно выехать к точке остановки и встать (без рывка/телепорта)
          let d=angOut-pl.ang; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
          if(along < -0.5){
            turnTo(pl, angOut, dt*1.6);                          // от дальней стены к центру, попутно доворачивая
            setAlong(along + Math.min(step, 0-along));
          } else if(Math.abs(d)>0.12){
            turnTo(pl, angOut, dt*2);                            // на центре — разворот носом наружу
          } else {
            turnTo(pl, angOut, dt*2);
            setAlong(along + Math.min(step, exitA-along));       // плавный выезд к точке остановки
            if(along>=exitA-0.5){
              // выехал целиком — освобождаем бокс, встаём в поле и стоим
              b.occupied=null; pl.bay=null; pl.bayPhase=null;
              pl.zone='field'; setAlong(exitA); pl.x=clampX(pl.x); pl.y=clampY(pl.y);
              pl.moving=false; pl.path=[]; pl.exiting=false;
            }
          }
        } else {
          // ЗАЕЗД/СТОЯНКА: нос к стене, доезжаем к дальней стене и ждём обслуживания
          turnTo(pl, angIn, dt*2);
          setAlong(along + Math.sign(parkA-along)*Math.min(step, Math.abs(parkA-along)));
        }
        continue;
      }
    }

    // столкновения (в спокойном бонус-мире отключены — поток без проигрыша)
    // Физический контакт любых двух наземных бортов — на поле И на полосе, в т.ч.
    // межзонно: садящийся/взлетающий борт, въезжающий в стоящего на торце ВПП, —
    // это крушение, а не «уфф» (борта в воздухе «сверху», в краш не входят).
    if(!LV.bonus){
      const phys = planes.filter(p=>!p.dead && (p.zone==='field' || p.zone==='runway'));
      for(let i=0;i<phys.length;i++)
        for(let j=i+1;j<phys.length;j++){
          const a=phys[i], b=phys[j];
          if(dist(a.x,a.y,b.x,b.y)<K.CRASH_DIST){
            const reason = (a.zone==='runway' && b.zone==='runway') ? 'loss.collisionRunway' : 'loss.collisionField';
            killCrash(a,reason); killCrash(b,reason);
          }
        }
    }

    // near-miss «уфф»: два борта едва разошлись (ближе NEAR_DIST, но не краш) и
    // именно СБЛИЖАЛИСЬ в этот миг — вспышка + лёгкое замедление + «уфф». Это
    // украшение, без штрафа. Антидребезг — по паре бортов (NEAR_COOL),
    // карта пар пересобирается каждый кадр (сама чистит ушедшие/севшие борта).
    if(!LV.bonus){           // спокойный луг — гусеницы/бабочки не пугают друг друга
      const air = planes.filter(p=>!p.dead && p.zone!=='bay' && !p.entering);
      const next={};
      for(let i=0;i<air.length;i++)
        for(let j=i+1;j<air.length;j++){
          const a=air[i], b=air[j], d=dist(a.x,a.y,b.x,b.y);
          if(d >= K.NEAR_DIST*1.5) continue;                 // далеко — не отслеживаем
          // «уфф» — только на поле: в воздухе борта расходятся по высоте, а на ВПП
          // манёвра нет (сближение там — это уже краш, а не near-miss)
          if(a.zone!=='field' || b.zone!=='field') continue;
          const key = a.id<b.id ? a.id+'-'+b.id : b.id+'-'+a.id;
          const prev = nearMissPairs[key];
          let cool = prev ? prev.cool : 0;
          // нужен предыдущий кадр и реальное сближение — иначе спавн рядом или
          // два зависших борта дали бы ложное «уфф»
          const closing = prev && d < prev.last - 0.01;
          if(d>=K.CRASH_DIST && d<K.NEAR_DIST && closing && gameTime>=cool){
            nearMiss((a.x+b.x)/2, (a.y+b.y)/2);
            addFloat((a.x+b.x)/2, (a.y+b.y)/2 - 18*ui, t('float.nearMiss'), COL.phosphor);
            SND.nearmiss(); HAP.near();
            slowmo = Math.max(slowmo, K.SLOWMO_DUR);
            cool = gameTime + K.NEAR_COOL;
          }
          next[key] = {cool, last:d};
        }
      nearMissPairs = next;
    }

    // уборка
    for(let i=planes.length-1;i>=0;i--) if(planes[i].dead){ if(selected===planes[i]) selected=null; planes.splice(i,1); }

    // тревожный бип: у кого-то терпение на исходе (дублирует красное кольцо звуком;
    // чем меньше осталось — тем чаще бип)
    if(gameTime>=alarmAt){
      let mf=1;
      for(const pl of planes){
        if(pl.dead) continue;
        let fr=null;
        if(pl.zone==='air') fr=Math.max(0,pl.airTime)/pl.airMax;
        else if(pl.zone!=='bay') fr=Math.max(0,pl.groundTime)/Math.max(1,pl.groundMax);
        if(fr!=null && fr<mf) mf=fr;
      }
      if(mf<0.25){ SND.alarm(); alarmAt=gameTime+0.45+mf*2.4; }
    }

    if(lives<=0){ endLevel('end.lives'); return; }
    // survival/race — без потолка по принятым: survival кончается по жизням, race по времени
    if(!survival && !LV.objective.race && metricValue() >= LV.objective.target){ endLevel('end.goal'); return; }
    // все борты прилетели и поле пусто, а цель не набрана — смена окончена (без софтлока)
    if(!survival && LV.objective.metric==='served' && !LV.objective.race && spawnedTotal>=LV.objective.target && planes.length===0 && served<LV.objective.target){ endLevel('end.done'); return; }
    // статистика смены: пик одновременной нагрузки + редкие отсчёты для графика
    if(planes.length>statPeak) statPeak=planes.length;
    if(gameTime>=statNextAt){
      statSamples.push({t:gameTime, load:planes.length, served});
      statNextAt = gameTime + statStep;
      // в survival ряд может расти бесконечно — прорежаем и удваиваем шаг
      if(statSamples.length>180){ statSamples = statSamples.filter((_,i)=>i%2===0); statStep*=2; }
    }
    gameTime+=dt;
    if(!survival && LV.objective.time && gameTime>=LV.objective.time){ endLevel('end.time'); return; }
  }
  function dirOut(b){ // направление "наружу из бокса" в поле
    if(b.side==='top') return {dx:0,dy:1};
    if(b.side==='bottom') return {dx:0,dy:-1};
    if(b.side==='deice') return {dx:-1,dy:0}; // у правого края поля, ворота влево
    return {dx:1,dy:0}; // left
  }
  const clampX = x => Math.max(field.x0+10, Math.min(field.x1-10, x));
  const clampY = y => Math.max(field.y0+10, Math.min(field.y1-10, y));

  // ---- render ----
