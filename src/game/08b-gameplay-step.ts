// ===== 08b-gameplay-step — per-frame simulation — steering, path-following and the main update(dt) tick =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: update, steer, turnTo, followPath, dirOut, clampX, clampY.
// Reads: 08 (land, touchdown, depart, killAir/killCrash, spawnPlane, dist, selected…); 04 (K, LV, pace*, dayCycle, weatherTaxiMult); 06 (planes, runways, bays, field, gameTime, lives…); 07 (SND, HAP); 09b (nearMiss, pulseFx, updateTutorial); 12 (ACH); 10 (endLevel).

  // ---- update ----
  function steer(pl: any, tx: number, ty: number, spd: number, dt: number){
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
  function turnTo(pl: any, target: number, dt: number){
    let d=target-pl.ang; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    const m=K.TURN*dt; pl.ang += Math.max(-m, Math.min(m, d));
  }
  function followPath(pl: any, spd: number, dt: number){
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

  function update(dt: number){
    // динамические события (на чистых картах отключены: next* = Infinity)
    if(!K.DISABLE_RUSH && gameTime>=nextRush){ rushUntil=gameTime+K.RUSH_DUR; nextRush=gameTime+K.RUSH_PERIOD; toast={text:t('toast.rush'), t:0, good:false}; }
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
    if(!K.DISABLE_WEATHER && gameTime>=nextWeather){
      weather = Math.random()<K.WEATHER_SNOW_CHANCE ? 'snow' : 'rain';
      weatherUntil = gameTime+K.WEATHER_DUR; nextWeather = gameTime+K.WEATHER_PERIOD;
      toast = {text:t('toast.weather.'+weather), t:0, good:false};
    }
    if(weather!=='clear' && (gameTime>=weatherUntil || K.DISABLE_WEATHER)) weather='clear';
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
    const spawnCap = (!survival && LV.objective.metric==='served' && !LV.objective.race) ? (LV.objective.target ?? Infinity) : Infinity;
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
            steer(pl, field.hoverX!, pl.y, K.SPEED_AIR, dt);
            if(pl.x<=field.hoverX!){ pl.x=field.hoverX!; pl.ang=Math.PI; pl.entering=false; }
            else continue;
          }
        }
        pl.airTime-=dt; if(pl.airTime<=0){ killAir(pl); continue; }
        if(pl.moving && pl.path.length){
          followPath(pl, K.SPEED_AIR, dt);
        } else if(pl.approachR && pl.x > field.rwR!){
          // маршрут заведён на ВПП, но «захват точки» съел последний waypoint раньше,
          // чем борт дошёл до рубежа полосы — доводим его к створу, чтобы он сел,
          // а не завис перед полосой (иначе при большом ARRIVE посадка невозможна)
          steer(pl, field.rwR! - 1, pl.approachR.cy, K.SPEED_AIR, dt);
        }
        // заход на посадку: с неба на поле — ТОЛЬКО через ВПП. Сесть можно, лишь когда
        // борт идёт по оси открытой полосы (в пределах её полотна по вертикали). Если
        // маршрут ведёт мимо полос — рубеж ВПП работает как стена: дальше борт не
        // пускаем, он скользит вдоль неё, пока не выйдет на створ свободной полосы.
        // (садимся даже на занятую полосу — крушение только при физическом контакте)
        if(pl.x <= field.rwR!){
          let best=null;
          for(const r of runways){ if(r.closed || !r.landingOpen) continue; if(pl.y>=r.y && pl.y<=r.y+r.h){ best=r; break; } }
          if(best) land(pl, best);
          else pl.x = field.rwR!;   // мимо полосы — упёрся в рубеж ВПП
        }
        continue;
      }

      // ---- RUNWAY ----
      if(pl.zone==='runway'){
        if(pl.landing){
          // идём по оси полосы к полевому торцу; за корпус до него — касание (толчок +
          // визг), дальше докатываемся уже на земле, не меняя размер
          const r=pl.runway;
          steer(pl, r.stopX, r.cy, K.SPEED_AIR * K.APPROACH_SPEED_MULT, dt);
          if(!pl.touched && pl.x <= r.stopX + PLANE_LEN()) touchdown(pl);
          if(pl.touched) pl.y += (r.cy - pl.y) * Math.min(1, dt * K.LAND_ALIGN_SPEED);
          if(pl.x <= r.stopX+2){ pl.x=r.stopX; pl.y=r.cy; startGround(pl); }
          continue;
        }
        if(pl.takeoff){
          pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl);
          // без остановки на старте: борт ПОДРУЛИВАЕТ к точке старта уже по оси полосы
          // (центруясь на ходу), затем НЕПРЕРЫВНО переходит в разгон — никакой паузы и
          // доворота на месте у самой ВПП.
          if(pl.path.length){
            followPath(pl, taxiSpeed, dt);
            pl.y += (pl.runway.cy - pl.y) * Math.min(1, dt * K.LAND_ALIGN_SPEED);
            continue;
          }
          steer(pl, pl.runway.exitX + K.TAKEOFF_OVERSHOOT, pl.runway.cy, K.SPEED_TAKEOFF, dt);
          if(pl.x > W+30){ depart(pl); }
          continue;
        }
        // стоит на полосе, ждёт руления к боксу
        pl.groundTime-=dt; if(pl.groundTime<=0 && !pl.halfPay) groundPenalty(pl);
        if(pl.moving && pl.path.length){
          followPath(pl, taxiSpeed, dt);
          if(!rectHit(pl.x,pl.y,pl.runway)){          // съехал с полосы на апрон
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
        if(K.DISABLE_BAY){ const di=pl.requests.indexOf('depart'); if(di>=0 && di>pl.reqIndex) pl.reqIndex=di; }
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
            if(!r.closed && r.takeoffOpen && rectHit(pl.x,pl.y,r)){
              // выезд на полосу под взлёт (takeoffOpen=true; крушение — только при контакте на ВПП)
              pl.zone='runway'; pl.runway=r; if(!r.occupied) r.occupied=pl;
              // подруливаем к точке старта по оси полосы (у полевого торца) и тут же
              // разгоняемся — борт выходит на ВПП уже центрированным, без паузы
              pl.takeoff=true; pl.moving=true; pl.path=[{x:r.stopX + 8*ui, y:r.cy}];
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
        if(vert) pl.x += (cx-pl.x)*Math.min(1, dt*K.BAY_ALIGN_SPEED);
        else     pl.y += (cy-pl.y)*Math.min(1, dt*K.BAY_ALIGN_SPEED);
        const along = vert ? (pl.y-cy)*o.dy : (pl.x-cx)*o.dx;  // вдоль оси, наружу +
        const step = taxiSpeed * dt * K.BAY_DOCK_SPEED;
        const setAlong = (a: number) => { if(vert) pl.y=cy+a*o.dy; else pl.x=cx+a*o.dx; };
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
            turnTo(pl, angOut, dt*K.BAY_HEAD_SPEED*0.8);        // от дальней стены к центру, попутно доворачивая
            setAlong(along + Math.min(step, 0-along));
          } else if(Math.abs(d)>0.12){
            turnTo(pl, angOut, dt*K.BAY_HEAD_SPEED);             // на центре — разворот носом наружу
          } else {
            turnTo(pl, angOut, dt*K.BAY_HEAD_SPEED);
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
          turnTo(pl, angIn, dt*K.BAY_HEAD_SPEED);
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
      const next: Record<string, any>={};
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
            if(!K.DISABLE_SLOWMO) slowmo = Math.max(slowmo, K.SLOWMO_DUR);
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
    if(!survival && !LV.objective.race && metricValue() >= (LV.objective.target ?? Infinity)){ endLevel('end.goal'); return; }
    // все борты прилетели и поле пусто, а цель не набрана — смена окончена (без софтлока)
    if(!survival && LV.objective.metric==='served' && !LV.objective.race && spawnedTotal>=(LV.objective.target ?? Infinity) && planes.length===0 && served<(LV.objective.target ?? Infinity)){ endLevel('end.done'); return; }
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
  function dirOut(b: any){ // направление "наружу из бокса" в поле
    // КОНСТРУКТОР: ворота заданы явно (или авто-выведены при раскладке) — читаем их.
    if(b.gate==='up') return {dx:0,dy:-1};
    if(b.gate==='down') return {dx:0,dy:1};
    if(b.gate==='left') return {dx:-1,dy:0};
    if(b.gate==='right') return {dx:1,dy:0};
    // СТАРАЯ РАСКЛАДКА: по стороне ангара.
    if(b.side==='top') return {dx:0,dy:1};
    if(b.side==='bottom') return {dx:0,dy:-1};
    if(b.side==='deice') return {dx:-1,dy:0}; // у правого края поля, ворота влево
    return {dx:1,dy:0}; // left
  }
  const clampX = (x: number) => Math.max(field.x0+10, Math.min(field.x1-10, x));
  const clampY = (y: number) => Math.max(field.y0+10, Math.min(field.y1-10, y));
