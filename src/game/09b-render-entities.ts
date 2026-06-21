// ===== 09b-render-entities — draw bays, planes, the HUD, transient FX and the tutorial overlay =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: drawBay, drawBaySnapZones, drawRunwaySnapZones, drawNeonBay, drawPlane, drawPlaneCard, drawHUD, drawToast, drawEffects, drawFloaters, drawTutorial, boom, nearMiss, pulseFx, fmtTime, completeTutorial, updateTutorial.
// Reads: 01 (ctx); 09 (rr, hexa, heart, drawPlaneBodyAt, drawIcon, planeScale, bSpec, BSP); 02 (COL, SPRITES, SVC); 06 (bays, runways, money, lives, served, combo, save, toast, ui…); 04 (K, LV, lvFx); 04b (MT_META_VALUES); 03 (t, fmtNum, fmtMoney); 08 (bayUpCost, comboMult, curNeed, selected, touchdown, up); 08b (dirOut); 07 (Analytics).

  // контур трёх стен бокса: сторона к полю (out) — открытые ворота, борт внутри виден
  function bayWalls(b: any,out: any,r: number){
    const x0=b.x, y0=b.y, x1=b.x+b.w, y1=b.y+b.h;
    ctx.beginPath();
    if(out.dy===1){ ctx.moveTo(x0,y1); ctx.arcTo(x0,y0,x1,y0,r); ctx.arcTo(x1,y0,x1,y1,r); ctx.lineTo(x1,y1); }
    else if(out.dy===-1){ ctx.moveTo(x0,y0); ctx.arcTo(x0,y1,x1,y1,r); ctx.arcTo(x1,y1,x1,y0,r); ctx.lineTo(x1,y0); }
    else if(out.dx===-1){ ctx.moveTo(x0,y0); ctx.arcTo(x1,y0,x1,y1,r); ctx.arcTo(x1,y1,x0,y1,r); ctx.lineTo(x0,y1); } // ворота слева
    else { ctx.moveTo(x1,y0); ctx.arcTo(x0,y0,x0,y1,r); ctx.arcTo(x0,y1,x1,y1,r); ctx.lineTo(x1,y1); }
  }

  // НЕОН-БОКС (handoff): глянцевое сквозное стойло. Непрозрачный бейдж услуги в углу
  // задней стены, точки апгрейда (зелёная=куплено / полая=доступно) в плашке по центру
  // стены, чип ↑ в противоположном углу (исчезает при макс-прокачке), замок+цена на
  // непрозрачной подложке у закрытого. Стойла встык → читаются как сплошная ангара.
  function drawNeonBay(b: any){
    const TONE={fuel:'teal',repair:'amber',board:'rose',deice:'ice'};
    const tone=(TONE as Record<string, string>)[b.type]||'phosphor', col=COL[tone];
    const x=b.x, y=b.y, w=b.w, h=b.h, top=(b.side!=='bottom');
    const wt=Math.max(8*ui, Math.min(h*0.22, 18*ui)), r=0, busy=!!b.occupied, pad=5*ui;  // r=0 → стойла встык = сплошная ангара
    ctx.save();
    if(!b.open){
      const afford=money>=K.BAY_OPEN_COST, oc=afford?COL.green:COL.muted;
      rr(x,y,w,h,r); const bg=ctx.createLinearGradient(0,y,0,y+h); bg.addColorStop(0,'#101a36'); bg.addColorStop(1,'#070e22'); ctx.fillStyle=bg; ctx.fill();
      ctx.save(); if(afford){ctx.shadowColor=hexa(COL.green,.5); ctx.shadowBlur=14;} ctx.lineWidth=2; ctx.strokeStyle=hexa(oc,afford?.9:.4); ctx.setLineDash(afford?[7*ui,5*ui]:[]); rr(x,y,w,h,r); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      const pw=Math.min(w-12*ui,96*ui), ph=Math.min(h-12*ui,38*ui), px=x+w/2-pw/2, py=y+h/2-ph/2;
      rr(px,py,pw,ph,9*ui); ctx.fillStyle='#0a1326'; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle=hexa(oc,.55); rr(px,py,pw,ph,9*ui); ctx.stroke();
      const ls=ph*0.30, lx=px+ph*0.55, ly=py+ph/2;
      ctx.fillStyle=oc; ctx.strokeStyle=oc; ctx.lineWidth=Math.max(1.6,ls*0.34);
      rr(lx-ls*0.6,ly-ls*0.2,ls*1.2,ls*0.95,ls*0.22); ctx.fill();
      ctx.beginPath(); ctx.arc(lx,ly-ls*0.2,ls*0.45,Math.PI,0); ctx.stroke();
      ctx.fillStyle=afford?COL.coin:COL.muted; ctx.font=`700 ${Math.round(ph*0.42)}px ${NUM}`; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(fmtMoney(K.BAY_OPEN_COST), px+ph*1.05, py+ph/2);
      ctx.restore(); return;
    }
    // ПОЛ = нейтрально-тёмное стекло для ВСЕХ услуг: тёплый подкрас на синем тармаке
    // «фонит», поэтому убран — идентичность услуги несут крыша-пила/кант/бейдж, не пол.
    const floor=ctx.createRadialGradient(x+w/2,y+h*0.42,0,x+w/2,y+h*0.42,w*0.55);
    floor.addColorStop(0,'#101d3e'); floor.addColorStop(.65,COL.tarmac); floor.addColorStop(1,'#0a1228');
    rr(x,y,w,h,r); ctx.fillStyle=floor; ctx.fill();
    ctx.fillStyle=hexa(col,.14); ctx.fillRect(x+w*0.5-12*ui, top?y+h*0.62:y+h*0.36-2*ui, 24*ui, 2*ui);   // стоп-бар (тонкий цветной)
    const wallG=(yy: number,hh: number)=>{const g=ctx.createLinearGradient(0,yy,0,yy+hh); g.addColorStop(0,'#22355f'); g.addColorStop(.55,'#16254c'); g.addColorStop(1,'#0d1b3c'); return g;};   // стена темнее (как LongHangar) — цвет живёт в канте/блике, не в заливке
    const backY=top?y:y+h-wt;
    ctx.fillStyle=wallG(backY,wt); ctx.fillRect(x,backY,w,wt);
    // пилообразная крыша «цеха» (штрих 135°, HSTYLE.1 Sawtooth) поверх задней стены —
    // единый корпус ангары без PNG. Фаза привязана к кромке апрона (field.x0), чтобы
    // штрих шёл непрерывно сквозь встык-стойла (r=0), а не рвался на каждом боксе.
    ctx.save();
    ctx.beginPath(); ctx.rect(x,backY,w,wt); ctx.clip();
    ctx.strokeStyle=hexa(col,.5); ctx.lineWidth=2*ui;
    const stp=13*ui, phx=(((x-field.x0)%stp)+stp)%stp;
    for(let sx=x-phx-wt; sx<x+w; sx+=stp){ ctx.beginPath(); ctx.moveTo(sx,backY+wt); ctx.lineTo(sx+wt,backY); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle=wallG(y,h); ctx.fillRect(x,y,wt,h); ctx.fillRect(x+w-wt,y,wt,h);
    ctx.save(); ctx.shadowColor=hexa(col,busy?.7:.45); ctx.shadowBlur=busy?12:7; ctx.fillStyle=hexa(col,busy?.95:.6); ctx.fillRect(x, top?y:y+h-2*ui, w, 2*ui); ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.3)'; ctx.fillRect(x, backY, w, 1.4*ui);   // верхний глянцевый блик стекла
    { const dir=top?1:-1, oy=top?y+h-3*ui:y+3*ui, sp=5*ui;
      ctx.save(); ctx.strokeStyle=hexa(col,.6); ctx.lineWidth=2.2*ui; ctx.lineCap='round'; ctx.lineJoin='round';
      for(let i=0;i<2;i++){ const yy=oy+dir*i*5*ui; ctx.beginPath(); ctx.moveTo(x+w/2-sp,yy-dir*sp*0.7); ctx.lineTo(x+w/2,yy); ctx.lineTo(x+w/2+sp,yy-dir*sp*0.7); ctx.stroke(); } ctx.restore(); }
    const bSize=Math.min(w*0.34,h*0.5,40*ui), bx=x+pad, by=top?y+pad:y+h-pad-bSize;
    rr(bx,by,bSize,bSize,bSize*0.28); ctx.fillStyle='#0c1736'; ctx.fill();
    ctx.save(); ctx.shadowColor=hexa(col,.55); ctx.shadowBlur=10; ctx.lineWidth=2; ctx.strokeStyle=col; rr(bx,by,bSize,bSize,bSize*0.28); ctx.stroke(); ctx.restore();
    drawIcon(b.type, bx+bSize/2, by+bSize/2, bSize*0.30, col, '#0c1736');
    const up=bayUpCost(b);
    if(up!=null){ const afford=money>=up, cs=Math.min(bSize*0.72,28*ui), cx2=x+w-pad-cs, cy2=top?y+pad:y+h-pad-cs;
      rr(cx2,cy2,cs,cs,cs*0.3); ctx.fillStyle=afford?hexa(COL.green,.18):'#0c1736'; ctx.fill();
      ctx.save(); if(afford){ctx.shadowColor=hexa(COL.green,.5); ctx.shadowBlur=10;} ctx.lineWidth=1.5; ctx.strokeStyle=afford?COL.green:hexa(COL.muted,.6); rr(cx2,cy2,cs,cs,cs*0.3); ctx.stroke(); ctx.restore();
      ctx.strokeStyle=afford?COL.green:COL.muted; ctx.lineWidth=2.4*ui; ctx.lineCap='round'; ctx.lineJoin='round';
      const ax=cx2+cs/2, ay=cy2+cs/2, ar=cs*0.26; ctx.beginPath(); ctx.moveTo(ax,ay+ar); ctx.lineTo(ax,ay-ar); ctx.moveTo(ax-ar*0.7,ay-ar*0.3); ctx.lineTo(ax,ay-ar); ctx.lineTo(ax+ar*0.7,ay-ar*0.3); ctx.stroke(); }
    const totalDots=Math.min(4, bayMaxLvl(b)), dotR=3.2*ui, dgap=4*ui;   // 0 → ангар неулучшаем: без плашки
    if(totalDots>0){
      const plW=totalDots*(dotR*2+dgap)+dgap, plH=dotR*2+6*ui, plX=x+w/2-plW/2, plY=top?y+pad:y+h-pad-plH;
      rr(plX,plY,plW,plH,plH/2); ctx.fillStyle='rgba(8,14,30,.72)'; ctx.fill(); ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.phosphor,.18); rr(plX,plY,plW,plH,plH/2); ctx.stroke();
      for(let i=0;i<totalDots;i++){ const dx=plX+dgap+i*(dotR*2+dgap)+dotR, dy=plY+plH/2, on=i<b.lvl;
        ctx.beginPath(); ctx.arc(dx,dy,dotR,0,7);
        if(on){ ctx.save(); ctx.shadowColor=hexa(COL.green,.7); ctx.shadowBlur=6; ctx.fillStyle=COL.green; ctx.fill(); ctx.restore(); ctx.lineWidth=1.4; ctx.strokeStyle=COL.green; ctx.stroke(); }
        else { ctx.fillStyle='rgba(7,12,28,.6)'; ctx.fill(); ctx.lineWidth=1.4; ctx.strokeStyle=hexa(COL.muted,.7); ctx.stroke(); } }
    }
    if(busy && b.occupied.serveMax){ const frac=1-Math.max(0,b.occupied.serveTime)/b.occupied.serveMax, ccx=bx+bSize+8*ui, ccy=by+bSize/2;
      ctx.beginPath(); ctx.arc(ccx,ccy,6*ui,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); ctx.lineWidth=2.4*ui; ctx.lineCap='round'; ctx.strokeStyle=col; ctx.stroke(); }
    ctx.restore();
  }

  // Отладочный слой «Зоны захвата боксов» (MT.DEBUG_BAY_SNAP_ZONES) — настройка геометрии
  // в tuning.html. Когда слой включён, у каждого открытого бокса рисуется прямоугольник
  // зоны «прилипания» конца маршрута (тело бокса + MT.BAY_HIT_PADDING). Без пульсации и
  // подсветки — ровная пунктирная рамка. По умолчанию слой выключен → в игре ничего не видно.
  // Зона захвата: z.square — квадрат со стороной 2r (центр в z); иначе полукруг
  // (дуга купола по +u + плоская хорда через центр).
  function strokeGrabZone(z: any){
    if(!z) return;
    if(z.square){ ctx.strokeRect(z.cx-z.r, z.cy-z.r, z.r*2, z.r*2); return; }
    const a=Math.atan2(z.uy, z.ux);
    ctx.beginPath(); ctx.arc(z.cx, z.cy, z.r, a-Math.PI/2, a+Math.PI/2); ctx.closePath(); ctx.stroke();
  }
  function drawBaySnapZones(){
    if(MT_META_VALUES.DEBUG_BAY_SNAP_ZONES!==true || LV.bonus) return;
    const g=(MT_META_VALUES.BAY_HIT_PADDING as number)||0, rad=Math.min(8*ui, 6*ui+g*0.2);
    ctx.save();
    ctx.lineWidth=1.5*ui; ctx.strokeStyle=hexa(COL.phosphor,.6); ctx.setLineDash([6*ui,4*ui]);
    for(const b of bays){
      if(!b.open) continue;
      if(g>0){ rr(b.x-g, b.y-g, b.w+2*g, b.h+2*g, rad); ctx.stroke(); }
      strokeGrabZone(bayGrabZone(b));
    }
    ctx.restore();
  }

  // Отладочный слой «Зоны захвата ВПП» (MT.DEBUG_RUNWAY_SNAP_ZONES) — аналог боксового,
  // настройка геометрии в tuning.html. Когда слой включён, у каждой открытой полосы
  // рисуется прямоугольник зоны «прилипания» конца маршрута (полотно ВПП +
  // MT.RUNWAY_HIT_PADDING). Ровная пунктирная рамка, по умолчанию слой выключен.
  function drawRunwaySnapZones(){
    if(MT_META_VALUES.DEBUG_RUNWAY_SNAP_ZONES!==true || LV.bonus) return;
    const g=(MT_META_VALUES.RUNWAY_HIT_PADDING as number)||0, rad=Math.min(8*ui, 6*ui+g*0.2);
    ctx.save();
    ctx.lineWidth=1.5*ui; ctx.strokeStyle=hexa(COL.gold,.6); ctx.setLineDash([6*ui,4*ui]);
    for(const r of runways){
      if(r.closed) continue;
      if(g>0){ rr(r.x-g, r.y-g, r.w+2*g, r.h+2*g, rad); ctx.stroke(); }
      strokeGrabZone(runwayGrabZone(r,'land'));
      strokeGrabZone(runwayGrabZone(r,'takeoff'));
    }
    ctx.restore();
  }

  function drawBay(b: any){
    if(!b.deice && !LV.bonus){ drawNeonBay(b); return; }
    const col=LV.bonus ? BSP[bSpec(b.type)].petal : (SVC as Record<string, {color: string}>)[b.type].color;   // бонус: цвет цветка по виду
    const busy=!!b.occupied;
    ctx.save();
    // нарисованная цельная панель бокса (пер-скиновый арт, напр. neon): bay-<type>
    // для открытого, bay-locked для закрытого — заменяет процедурную «стойло»-форму.
    // По контракту спрайт НЕ запекает иконку/ценник/прогресс — движок рисует их поверх.
    const panelDrawn = ATLAS && SPRITES.blitC(b.open ? ('bay-'+b.type) : 'bay-locked', b.x+b.w/2, b.y+b.h/2, b.w, b.h);
    if(!b.open){
      const enough = money>=K.BAY_OPEN_COST;
      if(!panelDrawn){
        rr(b.x,b.y,b.w,b.h,9*ui); ctx.fillStyle='#0a1230'; ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.muted,.25); rr(b.x,b.y,b.w,b.h,9*ui); ctx.stroke();
        // приглушённая иконка типа + замок
        ctx.globalAlpha=.35;
        if(!(ATLAS && SPRITES.blitC('svc-'+b.type, b.x+b.w/2, b.y+b.h*0.28, 33*ui, 33*ui)))
          drawIcon(b.type, b.x+b.w/2, b.y+b.h*0.28, 12*ui, COL.muted, '#1f1b2c');
        ctx.globalAlpha=1;
        const lx=b.x+b.w/2, ly=b.y+b.h*0.52;
        ctx.fillStyle=hexa(COL.muted,.8); rr(lx-7*ui,ly-4*ui,14*ui,11*ui,2.5*ui); ctx.fill();
        ctx.beginPath(); ctx.arc(lx,ly-4*ui,5*ui,Math.PI,0);
        ctx.lineWidth=2*ui; ctx.strokeStyle=hexa(COL.muted,.8); ctx.stroke();
      }
      // ценник-чип
      const chW=Math.min(b.w-10*ui,56*ui);
      rr(b.x+b.w/2-chW/2, b.y+b.h-19*ui, chW, 14*ui, 7*ui);
      ctx.fillStyle=hexa(COL.gold, enough?.16:.07); ctx.fill();
      ctx.fillStyle=enough?COL.coin:COL.muted; ctx.font=`${9*ui}px ${NUM}`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(fmtMoney(K.BAY_OPEN_COST), b.x+b.w/2, b.y+b.h-12*ui);
      ctx.restore(); return;
    }

    // открытый бокс-«стойло»: пол + стены с трёх сторон, ворота в сторону поля,
    // рамка цвета услуги (ярче и со свечением, когда занят) — борт внутри виден
    const out=dirOut(b);
    if(!panelDrawn){
      rr(b.x,b.y,b.w,b.h,9*ui); ctx.fillStyle=LV.bonus?'#2e3a26':'#0b1336'; ctx.fill();   // бонус: грядка
      ctx.lineWidth=2;
      if(busy){ ctx.shadowColor=hexa(col,.6); ctx.shadowBlur=12; }
      else { ctx.shadowColor=hexa(col,.5); ctx.shadowBlur=8; }
      ctx.strokeStyle=hexa(col, busy?0.9:0.75); bayWalls(b,out,9*ui); ctx.stroke(); ctx.shadowBlur=0;
      // проём ворот: пунктирный порог + габаритные огни по углам
      let gx0,gy0,gx1,gy1;
      if(out.dy===1){ gx0=b.x; gy0=b.y+b.h; gx1=b.x+b.w; gy1=gy0; }
      else if(out.dy===-1){ gx0=b.x; gy0=b.y; gx1=b.x+b.w; gy1=gy0; }
      else if(out.dx===-1){ gx0=b.x; gy0=b.y; gx1=gx0; gy1=b.y+b.h; }
      else { gx0=b.x+b.w; gy0=b.y; gx1=gx0; gy1=b.y+b.h; }
      ctx.setLineDash([4*ui,5*ui]); ctx.lineWidth=1.5; ctx.strokeStyle=hexa(col,.22);
      ctx.beginPath(); ctx.moveTo(gx0,gy0); ctx.lineTo(gx1,gy1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=hexa(col,.8);
      [[gx0,gy0],[gx1,gy1]].forEach(p=>{ ctx.beginPath(); ctx.arc(p[0],p[1],2*ui,0,7); ctx.fill(); });
    }
    if(LV.bonus){
      // бонус-мир: бокс — это цветок своего цвета, виден всегда (куколка садится в серединку поверх)
      drawFlower(b.x+b.w/2, b.y+b.h*0.40, 18*ui, col);
    } else if(busy){
      // центр отдан припаркованному борту (рисуется поверх) —
      // тип услуги мелкой пиктограммой у дальней от ворот стены
      const iy = out.dy===-1 ? b.y+b.h-13*ui : b.y+13*ui;
      if(!(ATLAS && SPRITES.blitC('svc-'+b.type, b.x+13*ui, iy, 24*ui, 24*ui)))
        drawIcon(b.type, b.x+13*ui, iy, 9*ui, col, '#2a2440');
      // живая анимация обслуживания над бортом (искры/капли/посадка людей)
      if(ATLAS){
        const fxid=({repair:'fx-weld',fuel:'fx-fuel',board:'fx-boarding',deice:'fx-droplet'} as Record<string, string>)[b.type];
        const pp=0.62+0.38*Math.abs(Math.sin(nowT*0.006));
        ctx.save(); ctx.globalAlpha=pp;
        if(fxid) SPRITES.blitC(fxid, b.x+b.w/2, b.y+b.h*0.34, 26*ui*pp, 26*ui*pp);
        ctx.restore();
      }
    } else {
      if(!(ATLAS && SPRITES.blitC('svc-'+b.type, b.x+b.w/2, b.y+b.h*0.40, 45*ui, 45*ui)))
        drawIcon(b.type, b.x+b.w/2, b.y+b.h*0.36, 18*ui, col, '#2a2440');
      // подпись услуги
      ctx.fillStyle=hexa(col,.85); ctx.font=`${8*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t('svc.'+b.type).toUpperCase(), b.x+b.w/2, b.y+b.h-18*ui);
    }
    // пипсы уровня (число = потолок прокачки этого ангара; 0 → без пипсов)
    const total=bayMaxLvl(b), pip=5.2*ui, gap=4.5*ui;
    const startX=b.x+b.w/2-(total*(pip+gap)-gap)/2;
    for(let i=0;i<total;i++){
      ctx.fillStyle = i<b.lvl ? col : hexa(COL.muted,.18);
      ctx.beginPath(); ctx.arc(startX+i*(pip+gap)+pip/2, b.y+b.h-8*ui, pip/2, 0,7); ctx.fill();
    }
    // прогресс обслуживания — кружок в правом верхнем углу
    if(busy){
      const p=b.occupied, frac=1-Math.max(0,p.serveTime)/p.serveMax;
      const ccx=b.x+b.w-12*ui, ccy=b.y+12*ui;
      ctx.beginPath(); ctx.arc(ccx,ccy,7*ui,0,7); ctx.lineWidth=2.5*ui; ctx.strokeStyle=hexa(COL.ink,.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(ccx,ccy,7*ui,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
      ctx.lineWidth=2.5*ui; ctx.lineCap='round'; ctx.strokeStyle=col; ctx.stroke();
    }
    // подсказка цены апгрейда (жёлтым, если хватает)
    const up=bayUpCost(b);
    if(up!=null){
      const enough = money>=up;
      ctx.fillStyle = enough?COL.coin:COL.muted; ctx.font=`${9*ui}px ${NUM}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText('↑ '+fmtMoney(up), b.x+b.w/2, b.y+b.h+4*ui);
    }
    ctx.restore();
  }

  function drawPlane(pl: any){
    const need=curNeed(pl);
    const ncol=(SVC as Record<string, {color: string}>)[need].color;
    const vs=planeScale(pl);   // визуальная «перспектива»: кольца/пузырёк тянутся за бортом

    // маршрут — фосфорная линия со свечением: сплошная тонкая линия.
    // autoPath — системный маршрут (выкат на апрон, разгон на взлёте): игрок его не
    // рисовал, поэтому линию не показываем (иначе она мелькает на секунду перед бортом).
    if((pl.zone==='air'||pl.zone==='field'||pl.zone==='runway') && pl.path.length && pl.moving && !pl.autoPath){
      const _rc = COL.phosphor;
      ctx.save();
      ctx.strokeStyle=hexa(_rc, pl.selected?0.95:0.6);
      ctx.lineWidth=2.4; ctx.lineCap='round'; ctx.lineJoin='round'; // сплошная линия
      ctx.shadowColor=_rc; ctx.shadowBlur=pl.selected?12:7;
      ctx.beginPath(); ctx.moveTo(pl.x,pl.y);
      for(const w of pl.path) ctx.lineTo(w.x,w.y);
      ctx.stroke(); ctx.shadowBlur=0;
      // наконечник-стрелка по направлению последнего сегмента
      {
        const tp=pl.path[pl.path.length-1];
        const pp=pl.path.length>1?pl.path[pl.path.length-2]:{x:pl.x,y:pl.y};
        const aAng=Math.atan2(tp.y-pp.y, tp.x-pp.x);
        ctx.setLineDash([]);
        if(!(ATLAS && SPRITES.blitC('route-arrow', tp.x, tp.y, 15*ui, 15*ui, aAng, _rc))){
          ctx.save(); ctx.translate(tp.x,tp.y); ctx.rotate(aAng);
          ctx.fillStyle=hexa(_rc, pl.selected?0.9:0.55);
          ctx.beginPath(); ctx.moveTo(7*ui,0); ctx.lineTo(-4*ui,-5*ui); ctx.lineTo(-4*ui,5*ui); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // статичная точка-цель у выбранного борта (без мерцания)
        if(pl.selected){
          ctx.beginPath(); ctx.arc(tp.x,tp.y,5*ui,0,7);
          ctx.lineWidth=1.5; ctx.strokeStyle=hexa(_rc,.6); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // кольцо терпения — ТОЛЬКО в воздухе: игрок без тапа видит, сколько борт ещё
    // потерпит до посадки. На земле (поле/ВПП) и в боксе кольца нет — поле чище.
    // у улетающей бабочки кольца нет — она уже «обслужена»
    let frac=null;
    if(LV.bonus && pl.bug==='fly') frac=null;
    else if(pl.zone==='air') frac=Math.max(0,pl.airTime)/pl.airMax;
    if(frac!=null){
      const rcol = pl.emergency ? COL.life : (frac>0.5 ? COL.teal : frac>0.25 ? COL.amber : COL.life);
      ctx.save(); ctx.translate(pl.x,pl.y);
      ctx.beginPath(); ctx.arc(0,0,16*ui*vs,0,7); ctx.lineWidth=3; ctx.strokeStyle=hexa(COL.ink,.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,16*ui*vs,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
      ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle=rcol;
      ctx.shadowColor=rcol; ctx.shadowBlur=9; ctx.stroke();
      ctx.restore();
    }
    // пульсирующее кольцо срочного борта в воздухе (аварийный — красный, медицинский — розовый)
    if((pl.emergency||pl.medical) && pl.zone==='air'){
      const p=0.5+0.5*Math.sin(nowT*0.006), pc=pl.emergency?COL.life:COL.rose;
      ctx.beginPath(); ctx.arc(pl.x,pl.y,(20*ui+p*3*ui)*vs,0,7);
      ctx.lineWidth=2; ctx.strokeStyle=hexa(pc,.4+.4*p); ctx.stroke();
    }
    // выделение — кольцо-спрайт с фолбэком на пунктир (масштаб ⟂ SZ())
    if(pl.selected && !(ATLAS && SPRITES.blitC('ring-selected', pl.x, pl.y, K.GRAB*SZ(), K.GRAB*SZ()))){
      ctx.save(); ctx.beginPath(); ctx.arc(pl.x,pl.y,K.GRAB*0.5*SZ(),0,7);
      ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.phosphor,.6); ctx.setLineDash([4,5]); ctx.stroke(); ctx.restore();
    }

    // короткий «толчок» при касании: корпус отскакивает вверх и оседает (затухающая дуга)
    let by = pl.y;
    if(pl.bounceAt){
      const p=(nowT - pl.bounceAt)/K.LAND_BUMP_MS;
      if(p>=0 && p<1) by -= Math.sin(Math.PI*p)*(1-p)*K.LAND_BUMP_AMP*ui;
      else pl.bounceAt=0;
    }
    if(LV.bonus && !inMenu) drawBug(pl);              // гусеница / куколка / бабочка по стадии
    else drawPlaneBodyAt(pl.x, by, pl.ang, ui*0.5*SZ()*vs, pl.vip, pl.emergency, pl.medical);

    // пузырёк нужды над бортом
    if(LV.bonus){
      // бонус: над гусеницей — цветок нужного цвета (её цель). Куколка/бабочка — без пузырька.
      if(pl.zone!=='bay' && pl.bug==='cat') drawFlower(pl.x, pl.y-28*ui*vs, 9*ui, BSP[pl.species||0].petal);
    } else if(pl.zone==='field'){
      // иконка нужды появляется только когда борт уже на апроне (сел и выкатился с ВПП).
      // В воздухе (зона ожидания) и на ВПП её нет — нужду в небе игрок узнаёт тапом по
      // борту (карточка слева сверху, см. drawPlaneCard).
      const _ny = pl.y-28*ui*vs;
      if(!(ATLAS && SPRITES.blitC('svc-'+need, pl.x, _ny, 33*ui, 33*ui)))
        drawIcon(need, pl.x, _ny, 12.7*ui, ncol, COL.ink);   // чип svc-* (фолбэк: процедурная иконка)
    }
  }

  // Карточка выбранного борта в левом верхнем углу: очередь его потребностей
  // (цепочка услуг) + оставшееся время терпения числом. Появляется только когда
  // борт выбран — иначе угол остаётся пустым. Общая для всех скинов.
  function drawPlaneCard(){
    if(!(selected && !selected.dead)) return;
    const hud=HUD_H();
    const chain=selected.requests, n=chain.length;
    const bw2=30*ui, gap2=16*ui, x0=14*ui, y0=hud+8*ui;   // в зарезервированной cardLane (выше апрона), не на верхней ангаре
    const pw=n*bw2+(n-1)*gap2+16*ui;
    rr(x0,y0,pw,44*ui,9*ui); ctx.fillStyle='rgba(33,29,51,.72)'; ctx.fill();
    ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.phosphor,.12); rr(x0,y0,pw,44*ui,9*ui); ctx.stroke();
    const tag = selected.vip ? (t('hud.plane')+' · '+t('hud.vip'))
              : selected.emergency ? (t('hud.plane')+' '+t('hud.sos'))
              : selected.medical ? (t('hud.plane')+' · '+t('hud.med'))
              : t('hud.plane');
    ctx.fillStyle = selected.emergency?COL.life : selected.medical?COL.rose : hexa(COL.muted,.8);
    ctx.font=`${7.5*ui}px ${MONO}`; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(tag, x0+8*ui, y0+8*ui);
    // ── оставшееся терпение борта: число, цвет — по запасу (бирюза→янтарь→красный) ──
    let prem=null, pmax=null;
    if(selected.zone==='air'){ prem=selected.airTime; pmax=selected.airMax; }
    else if(selected.zone!=='bay'){ prem=selected.groundTime; pmax=selected.groundMax; }
    else if(selected.serveMax){ prem=selected.serveTime; pmax=selected.serveMax; }
    if(prem!=null && isFinite(prem) && isFinite(pmax) && pmax>0){
      const pf=Math.max(0,Math.min(1,prem/pmax));
      const pcol = selected.emergency ? COL.life : (pf>0.5?COL.teal:pf>0.25?COL.amber:COL.life);
      ctx.textAlign='right'; ctx.fillStyle=pcol; ctx.font=`700 ${10*ui}px ${NUM}`;
      ctx.fillText(fmtTime(Math.max(0,prem)), x0+pw-8*ui, y0+8*ui);
    }
    for(let i=0;i<n;i++){
      const ty=chain[i];
      // бонус: цвет/иконки шага — по виду гусеницы (цветок → бабочка), а не услуга
      const c = (LV.bonus && ty!=='depart') ? BSP[selected.species||0].petal
              : (LV.bonus && ty==='depart') ? BSP[selected.species||0].wing
              : (SVC as Record<string, {color: string}>)[ty].color;
      const bx=x0+8*ui+i*(bw2+gap2), bcy=y0+26*ui;
      if(i>0){
        ctx.strokeStyle=hexa(COL.muted,.4); ctx.lineWidth=2; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.moveTo(bx-gap2+3*ui,bcy); ctx.lineTo(bx-3*ui,bcy); ctx.stroke(); ctx.setLineDash([]);
      }
      const active = i===selected.reqIndex;
      ctx.globalAlpha = i<selected.reqIndex ? 0.3 : 1;
      rr(bx,y0+15*ui,bw2,22*ui,6*ui);
      ctx.fillStyle=active?hexa(c,.16):'rgba(127,155,176,.05)'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(c,active?.9:.4);
      rr(bx,y0+15*ui,bw2,22*ui,6*ui); ctx.stroke();
      if(LV.bonus){
        const sp=selected.species||0;
        if(ty==='depart') drawButterfly(bx+bw2/2, bcy, 0, ui*0.42, sp);   // финал — бабочка
        else drawFlower(bx+bw2/2, bcy, 9*ui, c);                          // шаг — цветок своего цвета
      } else if(!(ATLAS && SPRITES.blitC('svc-'+ty, bx+bw2/2, bcy, 28*ui, 28*ui)))
        drawIcon(ty, bx+bw2/2, bcy, 12*ui, c, '#211d33');
      ctx.globalAlpha=1;
    }
  }

  function drawHUD(){
    const hud=HUD_H();
    // плавающая панель
    rr(10*ui,6*ui,W-20*ui,hud-12*ui,9*ui);
    ctx.fillStyle='rgba(7,13,30,.82)'; ctx.fill();
    ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.phosphor,.3); rr(10*ui,6*ui,W-20*ui,hud-12*ui,9*ui); ctx.stroke();
    const cy=hud/2;
    ctx.textBaseline='middle';
    // тонкий вертикальный разделитель (VSep из макета TopHUD)
    const vsep=(vx: number)=>{ ctx.fillStyle=hexa(COL.phosphor,.16); ctx.fillRect(vx, cy-13*ui, 1, 26*ui); };
    // ── левый кластер: жизни · | · деньги · | · цель (мокап TopHUD) ──
    for(let i=0;i<K.START_LIVES;i++) heart(26*ui+i*19*ui, cy, 6.3*ui, i<lives?COL.life:null);
    let lx = 26*ui + K.START_LIVES*19*ui + 12*ui;
    vsep(lx); lx += 13*ui;
    // деньги (золото)
    if(ATLAS) SPRITES.blitC('coin', lx+7*ui, cy, 16*ui, 16*ui);
    else { ctx.textAlign='left'; ctx.fillStyle=COL.coin; ctx.font=`${13*ui}px ${NUM}`; ctx.fillText('$', lx, cy); }
    ctx.textAlign='left'; ctx.font=`700 ${17*ui}px ${NUM}`;
    ctx.fillStyle = money<0?COL.life:COL.coin;
    ctx.shadowColor=hexa(COL.gold,.4); ctx.shadowBlur=9*ui;
    ctx.fillText(fmtMoney(money), lx+18*ui, cy); ctx.shadowBlur=0;
    lx += 18*ui + ctx.measureText(fmtMoney(money)).width + 16*ui;
    // ── цель уровня (сирень): мишень + «N / M». В бесконечном — налёт «✈ N» (фосфор) ──
    vsep(lx); lx += 16*ui;
    const mv = LV.objective.metric==='upgrades'?upgradesDone:served;
    const endless = survival || LV.objective.race;   // race (L5): «без лимита»
    const goalTone = endless ? COL.phosphor : COL.purple;
    iconTarget(lx+9*ui, cy, 9*ui, goalTone);
    ctx.textAlign='left'; ctx.font=`700 ${17*ui}px ${NUM}`; ctx.fillStyle=goalTone;
    ctx.shadowColor=hexa(goalTone,.4); ctx.shadowBlur=9*ui;
    const goalTxt = endless ? ('✈ '+fmtNum(served)) : (fmtNum(mv)+' / '+fmtNum(LV.objective.target ?? 0));
    ctx.fillText(goalTxt, lx+23*ui, cy); ctx.shadowBlur=0;
    // ── правый: таймер перед кнопкой паузы (число, как в макете) ──
    const tShown = LV.objective.time ? Math.max(0, LV.objective.time-gameTime) : gameTime;
    const urgent = LV.objective.time && tShown<=10;
    ctx.textAlign='right'; ctx.fillStyle=urgent?COL.life:COL.paper; ctx.font=`700 ${18*ui}px ${NUM}`;
    ctx.shadowColor=hexa(urgent?COL.life:COL.phosphor,.4); ctx.shadowBlur=9*ui;
    ctx.fillText(fmtTime(tShown), pauseBtn.x-14*ui, cy); ctx.shadowBlur=0;

    // кнопка паузы — спрайт-чип (на паузе поверх рисуем «play»)
    const pcx=pauseBtn.x+pauseBtn.w/2, pcy=pauseBtn.y+pauseBtn.h/2;
    const pauseSprite = ATLAS && !paused &&
      SPRITES.blitC('pause-btn', pcx, pcy, Math.max(pauseBtn.w,pauseBtn.h), Math.max(pauseBtn.w,pauseBtn.h));
    if(!pauseSprite){
      rr(pauseBtn.x,pauseBtn.y,pauseBtn.w,pauseBtn.h,8*ui);
      ctx.fillStyle='rgba(154,111,212,.10)'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.phosphor,.4);
      rr(pauseBtn.x,pauseBtn.y,pauseBtn.w,pauseBtn.h,8*ui); ctx.stroke();
      ctx.fillStyle=COL.paper;
      if(!paused){
        ctx.fillRect(pcx-6*ui,pcy-6*ui,4*ui,12*ui);
        ctx.fillRect(pcx+2*ui,pcy-6*ui,4*ui,12*ui);
      } else {
        ctx.beginPath(); ctx.moveTo(pcx-5*ui,pcy-6*ui); ctx.lineTo(pcx+7*ui,pcy); ctx.lineTo(pcx-5*ui,pcy+6*ui); ctx.closePath(); ctx.fill();
      }
    }

    // очередь потребностей выбранного борта + его терпение — карточка слева сверху
    drawPlaneCard();
  }

  function fmtTime(s: number){ const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(Math.floor(s%60)).padStart(2,'0'); return m+':'+ss; }
  function drawToast(){
    const a = toast.t<2.0 ? 1 : (2.4-toast.t)/0.4;
    const col = toast.good?COL.coin:COL.life;
    ctx.save(); ctx.globalAlpha=Math.max(0,a);
    ctx.font=`${12*ui}px ${MONO}`;
    const w=ctx.measureText(toast.text).width+44*ui, h=24*ui;
    const x=W/2-w/2, y=HUD_H()+12*ui;
    rr(x,y,w,h,12*ui); ctx.fillStyle='rgba(26,22,40,.92)'; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle=hexa(col,.7);
    ctx.shadowColor=hexa(col,.5); ctx.shadowBlur=10; rr(x,y,w,h,12*ui); ctx.stroke(); ctx.shadowBlur=0;
    if(!(ATLAS && SPRITES.blitC(toast.good?'check':'heart-crack', x+14*ui, y+h/2, 15*ui, 15*ui))){
      ctx.beginPath(); ctx.arc(x+13*ui,y+h/2,3.5*ui,0,7); ctx.fillStyle=col; ctx.fill();
    }
    ctx.fillStyle=COL.paper; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(toast.text, x+26*ui, y+h/2);
    ctx.restore();
  }
  function boom(x: number,y: number){ effects.push({x,y,t:0,life:0.55,kind:'crash'}); }
  function nearMiss(x: number,y: number){ effects.push({x,y,t:0,life:0.5,kind:'near'}); }
  function pulseFx(x: number,y: number,kind: string,life?: number){ effects.push({x,y,t:0,life:life||0.55,kind}); }
  // kind → спрайт и цвет процедурного фолбэка
  const FX_SPRITE={near:'fx-ripple',crash:'fx-crash',touchdown:'fx-touchdown',takeoff:'fx-takeoff',success:'fx-success',error:'fx-error'};
  function drawEffects(dt: number){
    for(let i=effects.length-1;i>=0;i--){
      const e=effects[i]; e.t+=dt;
      const k=e.t/e.life;
      if(k>=1){ effects.splice(i,1); continue; }
      const a=1-k;
      ctx.save(); ctx.translate(e.x,e.y);
      if(e.kind==='lock'){
        // фиксация маршрута на боксе: короткая яркая белая вспышка (без спрайта)
        ctx.beginPath(); ctx.arc(0,0,(9+k*15)*ui,0,7);
        ctx.lineWidth=2.5*a+0.5; ctx.strokeStyle=hexa('#ffffff',.9*a); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,5*(1-k)*ui+1,0,7); ctx.fillStyle=hexa('#ffffff',.85*a); ctx.fill();
        ctx.restore(); continue;
      }
      if(ATLAS){
        const sz=(e.kind==='crash'?(44+k*64):(20+k*56))*ui;
        ctx.globalAlpha=a;
        if(SPRITES.blitC((FX_SPRITE as Record<string, string>)[e.kind]||'fx-ripple',0,0,sz,sz)){ ctx.globalAlpha=1; ctx.restore(); continue; }
        ctx.globalAlpha=1;
      }
      if(e.kind==='near'){
        // near-miss «уфф»: мягкая двойная волна без искр и жести
        ctx.beginPath(); ctx.arc(0,0,(8+k*30)*ui,0,7);
        ctx.lineWidth=2.5*a+0.5; ctx.strokeStyle=hexa(COL.phosphor,.7*a); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,(4+k*18)*ui,0,7);
        ctx.lineWidth=2*a+0.5; ctx.strokeStyle=hexa(COL.amber,.55*a); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,7*(1-k)*ui,0,7); ctx.fillStyle=hexa('#ffffff',.5*a); ctx.fill();
        ctx.restore(); continue;
      }
      if(e.kind!=='crash'){
        // мягкое одиночное кольцо (фолбэк для touchdown/takeoff/success/error)
        const fc=({touchdown:COL.muted,takeoff:COL.paper,success:'#5dca7a',error:COL.life} as Record<string, string>)[e.kind]||COL.paper;
        ctx.beginPath(); ctx.arc(0,0,(8+k*26)*ui,0,7);
        ctx.lineWidth=2*a+0.5; ctx.strokeStyle=hexa(fc,.6*a); ctx.stroke();
        ctx.restore(); continue;
      }
      // ударная волна
      ctx.beginPath(); ctx.arc(0,0,(6+k*44)*ui,0,7);
      ctx.lineWidth=3*a+0.5; ctx.strokeStyle=hexa(COL.life,.6*a); ctx.stroke();
      // разлетающиеся искры
      for(let s2=0;s2<8;s2++){
        const ang=s2/8*Math.PI*2, d=(10+k*40)*ui;
        ctx.fillStyle=hexa(s2%2?COL.amber:COL.gold, a);
        ctx.beginPath(); ctx.arc(Math.cos(ang)*d,Math.sin(ang)*d,(2.5*a+1)*ui,0,7); ctx.fill();
      }
      // вспышка в центре
      ctx.beginPath(); ctx.arc(0,0,8*(1-k)*ui,0,7); ctx.fillStyle=hexa('#ffffff',.7*a); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  // плавающие награды: «+N ₿» при вылете, «−50%» при штрафе, «−N ₿» при краше
  function drawFloaters(dt: number){
    for(let i=floaters.length-1;i>=0;i--){
      const f=floaters[i]; f.t+=dt;
      const k=f.t/f.life;
      if(k>=1){ floaters.splice(i,1); continue; }
      ctx.globalAlpha=1-k*k;
      ctx.font=`600 ${13*ui}px ${NUM}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=f.col; ctx.shadowColor=f.col; ctx.shadowBlur=8;
      ctx.fillText(f.text, f.x, f.y - k*26*ui);
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  // ---- тихий туториал «покажи и дай сделать» ----
  // Ведём первый борт за руку: подсветка цели + подсказка одной строкой. Шаги
  // переключаются по факту действий игрока (сел → обслужил → на взлёт), без
  // модалок и стены текста. Прошёл один полный цикл — туториал больше не всплывает.
  function completeTutorial(){
    if(!tut) return;
    tut=null; save.tutorialDone=true; saveGame();
    Analytics.track('tutorial_complete', {});
    toast={text:t('tut.done'), t:0, good:true};
  }
  function updateTutorial(){
    if(!tut || !tut.plane) return;
    const p=tut.plane;
    if(p.dead){ tut.plane=null; tut.step='land'; return; }   // разбился — учим на следующем
    const prev=tut.step;
    if(tut.step==='land' && p.zone!=='air') tut.step='service';
    if(tut.step==='service' && curNeed(p)==='depart') tut.step='takeoff';
    if(tut.step!==prev) Analytics.track('tutorial_step', {step: tut.step});
    // завершение — в depart(): полный цикл от посадки до вылета пройден
  }
  function tutTarget(){
    const p=tut.plane; if(!p) return null;
    if(tut.step==='service'){
      const need=curNeed(p);
      const bay=bays.find(b=>b.open && b.type===need);
      return bay ? {x:bay.x+bay.w/2, y:bay.y+bay.h/2} : null;
    }
    // land / takeoff — ближайшая открытая полоса
    let best=null, bd=1e9;
    for(const r of runways){ if(r.closed) continue; const d=Math.abs(p.y-r.cy); if(d<bd){bd=d;best=r;} }
    return best ? {x:best.x+best.w*0.5, y:best.cy} : null;
  }
  function drawTutorial(){
    if(!tut || !tut.plane || tut.plane.dead || paused) return;
    const p=tut.plane;
    if(p.zone==='bay') return;                 // обслуживается в боксе — просто ждём, без подсказок
    const target=tutTarget(); if(!target) return;
    const col=COL.phosphor;
    ctx.save();
    // путеводная пунктирная линия борт → цель
    ctx.setLineDash([8,9]); ctx.lineDashOffset=-nowT*0.04;
    ctx.lineWidth=2.5; ctx.strokeStyle=hexa(col,.5);
    ctx.shadowColor=hexa(col,.5); ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(target.x,target.y); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0;
    // пульсирующее кольцо у цели
    const pr=0.5+0.5*Math.sin(nowT*0.005);
    ctx.beginPath(); ctx.arc(target.x,target.y,(14+pr*7)*ui,0,7);
    ctx.lineWidth=2.5; ctx.strokeStyle=hexa(col,.35+.45*pr); ctx.stroke();
    // «палец»: точка-касание едет от борта к цели по кругу — показывает жест
    const ph=(nowT*0.0006)%1, fx=p.x+(target.x-p.x)*ph, fy=p.y+(target.y-p.y)*ph;
    ctx.beginPath(); ctx.arc(fx,fy,7*ui,0,7); ctx.fillStyle=hexa(col,.85); ctx.fill();
    ctx.beginPath(); ctx.arc(fx,fy,11*ui,0,7); ctx.lineWidth=2; ctx.strokeStyle=hexa(col,.5); ctx.stroke();
    ctx.restore();
    // подсказка одной строкой — мягкая плашка внизу по центру
    let txt;
    if(tut.step==='service') txt=t('tut.service',{svc:t('svc.'+curNeed(p))});
    else if(tut.step==='takeoff') txt=t('tut.takeoff');
    else txt=t('tut.land');
    ctx.save();
    ctx.font=`${12.5*ui}px ${MONO}`;
    const w=ctx.measureText(txt).width+48*ui, h=30*ui;
    const x=W/2-w/2, y=H-h-(14*ui+safe.b);
    rr(x,y,w,h,12*ui); ctx.fillStyle='rgba(26,22,40,.92)'; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle=hexa(col,.6);
    ctx.shadowColor=hexa(col,.4); ctx.shadowBlur=10; rr(x,y,w,h,12*ui); ctx.stroke(); ctx.shadowBlur=0;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=col; ctx.fillText('☞', x+14*ui, y+h/2);
    ctx.fillStyle=COL.paper; ctx.fillText(txt, x+36*ui, y+h/2);
    ctx.restore();
  }
