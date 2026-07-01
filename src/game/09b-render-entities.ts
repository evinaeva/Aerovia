// ===== 09b-render-entities — draw bays, planes, the HUD, transient FX and the tutorial overlay =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: drawBay, drawBayUpgradePanel, drawBayGate, drawBaySnapZones, drawRunwaySnapZones, drawMotionPoints, drawNeonBay, drawPlaneRoute, drawPlane, drawPlaneCard, drawHUD, drawToast, drawEffects, drawFloaters, drawTutorial, boom, nearMiss, pulseFx, fmtTime, completeTutorial, updateTutorial.
// Reads: 01 (ctx); 09 (rr, hexa, heart, drawPlaneBodyAt, drawPlaneShadow, drawIcon, planeScale, bSpec, BSP); 02 (COL, SPRITES, SVC); 06 (bays, runways, money, lives, served, combo, save, toast, ui…); 04 (K, LV, lvFx); 04b (MT_META_VALUES); 03 (t, fmtNum, fmtMoney); 08 (bayUpCost, comboMult, curNeed, selected, touchdown, up); 08b (dirOut); 07 (Analytics).

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
    // апгрейд-индикаторы (зелёная стрелка) рисует drawBayUpgradePanel, а шеврон/прогресс
    // обслуживания на входе — drawBayGate; оба отдельными проходами поверх любого арта бокса.
    ctx.restore();
  }

  // Отладочный слой «Зоны захвата боксов» (MT.DEBUG_BAY_SNAP_ZONES) — настройка геометрии
  // в tuning.html. Рисует прямоугольник тела бокса и зону захвата у ворот. Без пульсации и
  // подсветки — ровная пунктирная рамка. По умолчанию слой выключен → в игре ничего не видно.
  // Зона захвата: z.square — квадрат со стороной 2r (центр в z); иначе полукруг
  // (дуга купола по +u + плоская хорда через центр).
  function strokeGrabZone(z: any){
    if(!z) return;
    if(z.band){                                            // ВПП: полоса во весь торец полосы
      const x0 = z.square ? z.cx-z.r : z.cx;
      const x1 = z.square ? z.cx+z.r : z.cx + z.ux*z.r;
      ctx.strokeRect(Math.min(x0,x1), z.cy-z.halfH, Math.abs(x1-x0), z.halfH*2);
      return;
    }
    if(z.square){ ctx.strokeRect(z.cx-z.r, z.cy-z.r, z.r*2, z.r*2); return; }
    const a=Math.atan2(z.uy, z.ux);
    ctx.beginPath(); ctx.arc(z.cx, z.cy, z.r, a-Math.PI/2, a+Math.PI/2); ctx.closePath(); ctx.stroke();
  }
  function drawBaySnapZones(){
    if(MT_META_VALUES.DEBUG_BAY_SNAP_ZONES!==true || LV.bonus) return;
    ctx.save();
    ctx.lineWidth=1.5*ui; ctx.strokeStyle=hexa(COL.phosphor,.6); ctx.setLineDash([6*ui,4*ui]);
    for(const b of bays){
      if(!b.open) continue;
      strokeGrabZone(bayGrabZone(b));
    }
    ctx.restore();
  }

  // Отладочный слой «Зоны захвата ВПП» (MT.DEBUG_RUNWAY_SNAP_ZONES) — настройка геометрии
  // в tuning.html. Когда слой включён, у каждой открытой полосы рисуются зоны захвата
  // у торцов (полукруги/квадраты посадочного и взлётного торцов).
  function drawRunwaySnapZones(){
    if(MT_META_VALUES.DEBUG_RUNWAY_SNAP_ZONES!==true || LV.bonus) return;
    ctx.save();
    ctx.lineWidth=1.5*ui; ctx.strokeStyle=hexa(COL.gold,.6); ctx.setLineDash([6*ui,4*ui]);
    for(const r of runways){
      if(r.closed) continue;
      strokeGrabZone(runwayGrabZone(r,'land'));
      strokeGrabZone(runwayGrabZone(r,'takeoff'));
    }
    ctx.restore();
  }

  function drawMotionPoints(){
    if(MT_META_VALUES.DEBUG_MOTION_POINTS!==true || LV.bonus) return;
    ctx.save();
    ctx.font=(9*ui)+'px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
    ctx.textBaseline='top';
    for(const r of runways){
      if(r.closed) continue;
      const pts:[number,string,string][]=[
        [r.stopX+PLANE_LEN()+K.RW_TOUCHDOWN_OFF*ui, '#f5c842', 'касание' ],
        [r.exitX+K.RW_LIFTOFF_OFF*ui,               '#60d060', 'отрыв'   ],
        [(r.x+r.w)+K.RW_ALIGN_OFF*ui,               '#3ad2ff', 'выравн.' ],
        [r.x-K.TAKEOFF_ALIGN_OFF*ui,                '#f08060', 'выравн.↑'],
      ];
      for(const [x,col,lbl] of pts){
        ctx.strokeStyle=col; ctx.lineWidth=1.5*ui; ctx.setLineDash([3*ui,3*ui]);
        ctx.beginPath(); ctx.moveTo(x,r.y); ctx.lineTo(x,r.y+r.h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=hexa(col,.9);
        ctx.beginPath(); ctx.arc(x,r.cy,4*ui,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=col; ctx.fillText(lbl,x+3*ui,r.y+r.h+2*ui);
      }
    }
    for(const b of bays){
      if(!b.open || !b.gate) continue;
      const o=dirOut(b);
      const half=(Math.abs(o.dy)>Math.abs(o.dx)?b.h:b.w)/2;
      const gx=b.x+b.w/2+o.dx*half, gy=b.y+b.h/2+o.dy*half;
      const d=K.BAY_APPROACH_DIST*ui;
      if(d<=0) continue;
      const apx=gx+o.dx*d, apy=gy+o.dy*d;
      const col='#b060f0';
      ctx.strokeStyle=col; ctx.lineWidth=1.5*ui; ctx.setLineDash([3*ui,3*ui]);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(apx,apy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=hexa(col,.9);
      ctx.beginPath(); ctx.arc(apx,apy,4*ui,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=col; ctx.fillText('подъезд',apx+3*ui,apy+2*ui);
    }
    ctx.restore();
  }

  // Иконка услуги на PNG-ангаре: один файл на услугу (fuel/repair/board), общий для
  // всех сторон бокса (до 2026-07-02 было по 3 предрисованных обрезка top/bot/side —
  // консолидированы, см. memory-android17.md). Она должна визуально сидеть у задней
  // стены бокса (как раньше — за счёт разных обрезков), но сама читаться прямо, не
  // поворачиваясь вместе с ангаром — см. drawBay. Первая прикидка размера/отступа,
  // рассчитана на глаз по пропорциям исходных svc_*.png — тронуть эти два числа,
  // если по месту (после ресайза) захочется иконку крупнее/мельче или ближе/дальше
  // от стены.
  const SVC_ICON_SCALE = 0.46;   // диаметр иконки / сторона бокса
  const SVC_ICON_INSET = 6;      // отступ иконки от задней стены, ui-единиц

  function drawBay(b: any){
    // Без активного скин-оверрайда обычные боксы рисует drawNeonBay (полная neon-отрисовка).
    // При активном скине — пробуем спрайт; спрайт не загружен ещё → neon-fallback.
    const mode = ASSET_RENDERER.mode;
    const metaId = b.assetId || (b.open ? ('hangar_' + b.type + '_wow_v1') : 'hangar_locked_wow_v1');
    const meta = assetMetadataRegistry.getAssetMetadata(metaId);
    if(meta && mode !== 'procedural'){
      const cx=b.x+b.w/2, cy=b.y+b.h/2;
      const pngScale = Math.min(b.w/meta.logicalSize.w, b.h/meta.logicalSize.h);
      const pngDrawRect = assetMetadataRegistry.drawRectFor(meta, cx, cy, pngScale);
      const pngDrawn = assetMetadataRegistry.drawPng(meta, cx, cy, pngScale, 0);
      if(pngDrawn){
        assetMetadataRegistry.drawDebugOverlay(meta, pngDrawRect, b.id || b.type, 0);
        if(mode === 'png') return;
      } else if(mode === 'png') {
        assetMetadataRegistry.drawDebugOverlay(meta, pngDrawRect, b.id || b.type, 0);
      }
    }
    // Handoff PNG: базовый ангар (sprite_hangar_base.png) + иконка услуги.
    // Иконка нарисована входом ВНИЗ (нижний край = ворота). Структурную рамку
    // ПОВОРАЧИВАЕМ так, чтобы вход смотрел к апрону (по dirOut): верх=0°, низ=180°,
    // левый бокс (ворота вправо)=−90°, правый (ворота влево)=+90°. Пиктограмму услуги
    // НЕ поворачиваем — она должна читаться вертикально, поэтому берём пред-нарисованный
    // вариант под сторону (svc_*_top/_bot/_side). Game-state оверлеи (шеврон/прогресс на
    // входе) рисует drawBayGate отдельным проходом.
    const hiBase = HANDOFF_IMG.hangarBase;
    if(!b.deice && !LV.bonus && _hiOk(hiBase)){
      ctx.save();
      const o0=dirOut(b);
      const ang = o0.dy===1 ? 0 : o0.dy===-1 ? Math.PI : o0.dx===1 ? -Math.PI/2 : Math.PI/2;
      ctx.save();
      ctx.translate(b.x + b.w/2, b.y + b.h/2);
      ctx.rotate(ang);
      const baseC = scaledSprite(hiBase, b.w, b.h);
      ctx.drawImage((baseC || hiBase) as CanvasImageSource, -b.w/2, -b.h/2, b.w, b.h);
      ctx.restore();
      if(b.open){
        const svcDraw = (b.type==='fuel' ? HANDOFF_IMG.svcFuel : b.type==='repair' ? HANDOFF_IMG.svcRepair : b.type==='board' ? HANDOFF_IMG.svcBoard : null) as HTMLImageElement | null;
        if(svcDraw && _hiOk(svcDraw)){
          // Якорь иконки сдвигаем к задней стене В ЛОКАЛЬНОЙ (повёрнутой под сторону
          // бокса) системе — тем же `ang`, что и hiBase выше, — а затем поворот
          // отменяем, чтобы сама иконка отрисовалась прямо, не боком/вверх ногами.
          const iconSize = b.w * SVC_ICON_SCALE;
          const anchorY = -(b.h/2 - SVC_ICON_INSET*ui - iconSize/2);
          const svcC = scaledSprite(svcDraw, iconSize, iconSize);
          ctx.save();
          ctx.translate(b.x + b.w/2, b.y + b.h/2);
          ctx.rotate(ang);
          ctx.translate(0, anchorY);
          ctx.rotate(-ang);
          ctx.drawImage((svcC || svcDraw) as CanvasImageSource, -iconSize/2, -iconSize/2, iconSize, iconSize);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }
    if(!SPRITES.hasOverrides?.() && !SPRITES.hasZoneSkin?.('hangar', b.open?b.type:'locked') && !b.deice && !LV.bonus){ drawNeonBay(b); return; }
    const col=LV.bonus ? BSP[bSpec(b.type)].petal : (SVC as Record<string, {color: string}>)[b.type].color;   // бонус: цвет цветка по виду
    const busy=!!b.occupied;
    ctx.save();
    // пер-скиновый арт: bay-<type> / bay-locked; иконка/прогресс рисуются поверх.
    // Зон-скин ангара (assets/skins) приоритетнее спрайт-оверрайда — рисуется ВМЕСТО панели,
    // а игровые оверлеи (иконка/ценник/пипсы/прогресс) ложатся сверху тем же кодом.
    const zSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('hangar', b.open ? b.type : 'locked');
    let panelDrawn: boolean;
    if(zSkin){ ctx.drawImage(zSkin, b.x, b.y, b.w, b.h); panelDrawn = true; }
    else { panelDrawn = !!(ATLAS && SPRITES.blitC(b.open ? ('bay-'+b.type) : 'bay-locked', b.x+b.w/2, b.y+b.h/2, b.w, b.h)); }
    // Спрайт ещё не загружен → откат на процедурный neon для обычных боксов
    if(!panelDrawn && !b.deice && !LV.bonus){ ctx.restore(); drawNeonBay(b); return; }
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
    // апгрейд-индикаторы (плашка «открыто/возможно» + зелёная стрелка) рисует
    // drawBayUpgradePanel отдельным проходом поверх любого арта бокса.
    // прогресс обслуживания теперь рисует drawBayGate на входе (шеврон↔прогресс)
    ctx.restore();
  }

  // Зелёная стрелка доступности апгрейда. Рисуется ПОВЕРХ любого арта бокса (PNG-ангар,
  // neon-fallback, скин) отдельным проходом из scene-loop, поэтому не зависит от того,
  // какой путь отрисовки сработал. Стрелка «хватает денег» — в углу со стороны входа-апрона:
  // верх-лево у верхних боксов, низ-лево у нижних и левых. Геометрия берётся из bayUpBtn(b) —
  // единый источник для отрисовки и зоны тапа. (Плашка «открыто/возможно» убрана по запросу.)
  function drawBayUpgradePanel(b: any){
    if(!b.open || b.deice || LV.bonus) return;
    if(bayMaxLvl(b)<=0) return;                             // неулучшаемый ангар — без индикатора
    ctx.save();
    // ── зелёная стрелка «можно прокачать» в углу со стороны входа ──
    const btn=bayUpBtn(b), up=bayUpCost(b);
    if(btn && up!=null && money>=up){
      const pulse=0.6+0.4*Math.sin(nowT*0.004);
      const cx2=btn.x, cy2=btn.y, cs=btn.w;
      rr(cx2,cy2,cs,cs,cs*0.3); ctx.fillStyle=hexa(COL.green,0.12+0.10*pulse); ctx.fill();
      ctx.save(); ctx.shadowColor=hexa(COL.green,0.4+0.3*pulse); ctx.shadowBlur=7+8*pulse; ctx.lineWidth=1.5; ctx.strokeStyle=COL.green; rr(cx2,cy2,cs,cs,cs*0.3); ctx.stroke(); ctx.restore();
      ctx.strokeStyle=COL.green; ctx.lineWidth=2.4*ui; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.globalAlpha=0.7+0.3*pulse;
      const ax=cx2+cs/2, ay=cy2+cs/2, ar=cs*0.26;
      ctx.beginPath(); ctx.moveTo(ax,ay+ar); ctx.lineTo(ax,ay-ar); ctx.moveTo(ax-ar*0.7,ay-ar*0.3); ctx.lineTo(ax,ay-ar); ctx.lineTo(ax+ar*0.7,ay-ar*0.3); ctx.stroke();
    }
    ctx.restore();
  }

  // Индикатор на ВХОДЕ бокса: шеврон (стрелка «заезжай») ↔ прогресс-бар обслуживания.
  // Рисуется в слое боксов ДО бортов, поэтому корпус борта, проходя над воротами,
  // прячет момент подмены. Подмена — чистая функция позиции (без хранимого состояния):
  // прогресс показываем, когда борт зашёл за линию ворот (d<0 вдоль dirOut), иначе шеврон.
  // При d≈0 борт стоит ровно на воротах и перекрывает индикатор → смена незаметна (на
  // заезде шеврон→прогресс, на выезде прогресс→шеврон, оба «под крыльями»).
  function drawBayGate(b: any){
    if(!b.open || b.deice || LV.bonus) return;
    const o=dirOut(b);
    const E=bayEntrancePoint(b);                            // центр линии ворот
    const vert=Math.abs(o.dy)>Math.abs(o.dx);
    const gateW=(vert? b.w : b.h);                          // ширина ворот поперёк направления
    const TONE:Record<string,string>={fuel:'teal',repair:'amber',board:'rose',deice:'ice'};
    const col=COL[TONE[b.type]||'phosphor'];
    const px=-o.dy, py=o.dx;                                // единичный вектор вдоль линии ворот
    const inset=7*ui, gx=E.x-o.dx*inset, gy=E.y-o.dy*inset; // чуть внутрь от кромки ворот
    let progress=false, frac=0;
    if(b.occupied && b.occupied.serveMax){
      const pl=b.occupied, d=(pl.x-E.x)*o.dx+(pl.y-E.y)*o.dy;   // d>0 снаружи (к апрону), d<0 внутри
      if(d<0){ progress=true; frac=1-Math.max(0,pl.serveTime)/pl.serveMax; }
    }
    ctx.save();
    if(progress){
      // ── прогресс-бар поперёк ворот ──
      const half=gateW*0.34;
      const ax=gx-px*half, ay=gy-py*half, ex=gx+px*half, ey=gy+py*half;
      ctx.lineCap='round';
      ctx.lineWidth=4*ui; ctx.strokeStyle=hexa(COL.ink,.55);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.lineWidth=4*ui; ctx.strokeStyle=col; ctx.shadowColor=hexa(col,.6); ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+(ex-ax)*frac, ay+(ey-ay)*frac); ctx.stroke();
    } else {
      // ── шеврон-вход: накладываем готовый PNG-оверлей (sprite_hangar_arrow.png) ──
      // Он размером с весь ангар и выровнен «вход вниз», поэтому поворачиваем его тем же
      // углом, что и базу (по dirOut), чтобы стрелка смотрела к апрону для любой стороны.
      const arrow=HANDOFF_IMG.hangarArrow;
      if(_hiOk(arrow)){
        const ang = o.dy===1 ? 0 : o.dy===-1 ? Math.PI : o.dx===1 ? -Math.PI/2 : Math.PI/2;
        ctx.translate(b.x+b.w/2, b.y+b.h/2);
        ctx.rotate(ang);
        const arrowC = scaledSprite(arrow, b.w, b.h);
        ctx.drawImage((arrowC || arrow) as CanvasImageSource, -b.w/2, -b.h/2, b.w, b.h);
      }
    }
    ctx.restore();
  }

  // маршрут — фосфорная линия со свечением: сплошная тонкая линия.
  // Рисуется ОТДЕЛЬНЫМ проходом ДО всех бортов (см. scene-loop), чтобы траектория
  // лежала на апроне ПОД самолётами — иначе линия борта, нарисованного позже,
  // перекрывала бы корпус борта, нарисованного раньше.
  // autoPath — системный маршрут (выкат на апрон, разгон на взлёте): игрок его не
  // рисовал, поэтому линию не показываем (иначе она мелькает на секунду перед бортом).
  function drawPlaneRoute(pl: any){
    if(!((pl.zone==='air'||pl.zone==='field'||pl.zone==='runway') && pl.path.length && pl.moving && !pl.autoPath)) return;
    const _rc = COL.phosphor;
    ctx.save();
    ctx.strokeStyle=hexa(_rc, pl.selected?Math.min(1,K.ROUTE_ALPHA+0.35):K.ROUTE_ALPHA);
    ctx.lineWidth=Math.max(K.ROUTE_WIDTH*0.4, K.ROUTE_WIDTH*ui); ctx.lineCap='round'; ctx.lineJoin='round'; // толщина/яркость — Motion Tuning (K.ROUTE_WIDTH/ROUTE_ALPHA); пол 0.4× держит линию различимой на телефоне (ui≈0.7)
    // Выбранный борт — полный glow; остальные — минимальный (горячий путь на мобилах).
    ctx.shadowColor=_rc; ctx.shadowBlur=pl.selected?8:3;
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

  function drawPlane(pl: any){
    const need=curNeed(pl);
    const ncol=(SVC as Record<string, {color: string}>)[need].color;
    const vs=planeScale(pl);   // визуальная «перспектива»: кольца/пузырёк тянутся за бортом

    // короткий «толчок» при касании: корпус отскакивает вверх и оседает (затухающая дуга)
    let by = pl.y;
    if(pl.bounceAt){
      const p=(nowT - pl.bounceAt)/K.LAND_BUMP_MS;
      if(p>=0 && p<1) by -= Math.sin(Math.PI*p)*(1-p)*K.LAND_BUMP_AMP*ui;
      else pl.bounceAt=0;
    }
    // тень борта (под корпусом) — рисуем ПЕРВОЙ, до колец терпения/срочности/выделения,
    // чтобы кольца оставались поверх тени, а не перекрывались ею; едет за бортом и съезжается на посадке
    if(!LV.bonus && !inMenu) drawPlaneShadow(pl, pl.x, by, pl.ang, vs);
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
      ctx.shadowColor=rcol; ctx.shadowBlur=4; ctx.stroke();
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

    if(LV.bonus && !inMenu) drawBug(pl);              // гусеница / куколка / бабочка по стадии
    else {
      // Plane PNGs are authored nose-right by contract; per-asset rotationOffset handles exceptions.
      const planeMeta = assetMetadataRegistry.getAssetMetadata(pl.assetId || 'plane_wow_v1');
      const planeScalePx = ui*0.5*SZ()*vs;
      const pngScale = planeMeta ? (62 * planeScalePx / planeMeta.logicalSize.w) : 1;
      const usePng = planeMeta && ASSET_RENDERER.mode !== 'procedural' && assetMetadataRegistry.drawPng(planeMeta, pl.x, by, pngScale, pl.ang * 180 / Math.PI);
      if(planeMeta && usePng){
        const dr = assetMetadataRegistry.drawRectFor(planeMeta, pl.x, by, pngScale);
        assetMetadataRegistry.drawDebugOverlay(planeMeta, dr, pl.id, pl.ang * 180 / Math.PI, false);   // точки-маркеры на борте скрыты: дёргаются при движении
      }
      if(!usePng && ASSET_RENDERER.mode !== 'png') drawPlaneBodyAt(pl.x, by, pl.ang, planeScalePx, pl.vip, pl.emergency, pl.medical);
    }

    // пузырёк нужды над бортом: воздух (ожидание) + апрон; на ВПП и в ангаре — скрыт
    if(LV.bonus){
      // бонус: над гусеницей — цветок нужного цвета (её цель). Куколка/бабочка — без пузырька.
      if(pl.zone!=='bay' && pl.bug==='cat') drawFlower(pl.x, pl.y-28*ui*vs, 9*ui, BSP[pl.species||0].petal);
    } else if(pl.zone==='field' || pl.zone==='air'){
      const _ny = pl.y-28*ui*vs;
      const _svcNeed = (need==='fuel' ? HANDOFF_IMG.svcFuel : need==='repair' ? HANDOFF_IMG.svcRepair : need==='board' ? HANDOFF_IMG.svcBoard : null) as HTMLImageElement | null;
      const _sz = 33*ui;
      if(_svcNeed && _hiOk(_svcNeed)){
        const _svcNeedC = scaledSprite(_svcNeed, _sz, _sz);
        ctx.drawImage((_svcNeedC || _svcNeed) as CanvasImageSource, pl.x-_sz/2, _ny-_sz/2, _sz, _sz);
      }
      else if(!(ATLAS && SPRITES.blitC('svc-'+need, pl.x, _ny, _sz, _sz)))
        drawIcon(need, pl.x, _ny, 12.7*ui, ncol, COL.ink);
    }
  }

  // Карточка выбранного борта в левом верхнем углу: очередь его потребностей
  // (цепочка услуг) + оставшееся время терпения числом. Появляется только когда
  // борт выбран — иначе угол остаётся пустым. Общая для всех скинов.
  function drawPlaneCard(){
    if(!(selected && !selected.dead)) return;
    const chain=selected.requests, n=chain.length;
    const bw2=30*ui, gap2=16*ui, x0=14*ui, y0=safe.t;   // прижато к верхней границе экрана (учитываем только safe-area сверху)
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
      } else {
        // те же новые PNG-иконки услуг, что в ангаре и на пузырьке борта; PNG→атлас→процедура
        const _svcImg = (ty==='fuel' ? HANDOFF_IMG.svcFuel : ty==='repair' ? HANDOFF_IMG.svcRepair : ty==='board' ? HANDOFF_IMG.svcBoard : null) as HTMLImageElement | null;
        const _sz = 28*ui;
        if(_svcImg && _hiOk(_svcImg)){
          const _svcImgC = scaledSprite(_svcImg, _sz, _sz);
          ctx.drawImage((_svcImgC || _svcImg) as CanvasImageSource, bx+bw2/2-_sz/2, bcy-_sz/2, _sz, _sz);
        }
        else if(!(ATLAS && SPRITES.blitC('svc-'+ty, bx+bw2/2, bcy, _sz, _sz)))
          drawIcon(ty, bx+bw2/2, bcy, 12*ui, c, '#211d33');
      }
      ctx.globalAlpha=1;
    }
  }

  // Шрифт для HUD-цифр.
  const HUD_F = "'Orbitron','Fredoka',sans-serif";
  // PNG 640×67 рисуется центрированным шириной W/2.
  // Перевод доли x в PNG (0..1) → x на канвасе: W/4 + frac * W/2
  // Якоря из hud_example.png: ❤ 45/640, $ 225/640, ⏱ 407/640, pause 605/640
  const hudPx = (frac: number) => W * (0.25 + frac * 0.5);

  function drawHUD(){
    const hud=HUD_H();
    const barH=hud+safe.t;
    const cy=safe.t+hud/2;
    const NEON='#27E6FF';
    const fs=Math.round(hud*0.42);

    // ── PNG по центру, 50% ширины, пропорции 640:67 сохранены ──
    // Тёмного фона нет — HUD плавает поверх фона поля.
    const hudImg=HANDOFF_IMG.hud;
    const hudPngW=Math.round(W*0.5);
    const hudPngX=Math.round((W-hudPngW)/2);
    if(hudImg && _hiOk(hudImg)) ctx.drawImage(hudImg, hudPngX, safe.t, hudPngW, hud);

    ctx.textBaseline='middle';

    // ── Сердца (left-anchor в PNG x=45) ──
    const hSp=Math.round(hud*0.50);
    const hR=Math.round(hud*0.20);
    const hx0=hudPx(45/640);
    for(let i=0;i<K.START_LIVES;i++)
      heart(hx0+i*hSp, cy, hR, i<lives?COL.life:null);

    // ── Деньги (left-anchor в PNG x=225): $ + число ──
    const mnAnchor=hudPx(225/640);
    const moneyStr=fmtMoney(money);
    const dolFs=Math.round(fs*0.75);
    const dolW=Math.round(dolFs*0.65);
    ctx.save();
    ctx.shadowColor=NEON; ctx.shadowBlur=6;
    ctx.textAlign='left';
    ctx.fillStyle=hexa(NEON,.70); ctx.font=`700 ${dolFs}px ${HUD_F}`;
    ctx.fillText('$', mnAnchor, cy);
    ctx.font=`700 ${fs}px ${HUD_F}`;
    ctx.fillStyle=money<0?COL.life:NEON;
    ctx.fillText(moneyStr, mnAnchor+dolW+4*ui, cy);
    ctx.restore();

    // ── Таймер (left-anchor в PNG x=407): иконка часов + строка ──
    const tmAnchor=hudPx(407/640);
    const tShown=LV.objective.time?Math.max(0,LV.objective.time-gameTime):gameTime;
    const urgent=!!(LV.objective.time&&tShown<=10);
    const timerStr=fmtTime(tShown);
    const clkR=Math.round(hud*0.18);
    const clkCX=tmAnchor+clkR;
    const clkCol=urgent?COL.life:NEON;
    ctx.save();
    ctx.shadowColor=clkCol; ctx.shadowBlur=5;
    ctx.strokeStyle=clkCol; ctx.lineWidth=Math.max(1.5,clkR*0.17); ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(clkCX,cy,clkR,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clkCX,cy); ctx.lineTo(clkCX,cy-clkR*0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clkCX,cy); ctx.lineTo(clkCX+clkR*0.42,cy); ctx.stroke();
    ctx.fillStyle=clkCol;
    ctx.font=`700 ${fs}px ${HUD_F}`;
    ctx.textAlign='left'; ctx.fillText(timerStr, clkCX+clkR+5*ui, cy);
    ctx.restore();

    // ── Пауза (cx в PNG x=605): || в PNG; при паузе рисуем ► поверх ──
    const pzcx=hudPx(605/640);
    pauseBtn.x=Math.round(pzcx-pauseBtn.w/2);
    pauseBtn.y=Math.round(cy-pauseBtn.h/2);
    if(paused){
      const ps=Math.round(hud*0.28);
      ctx.save();
      ctx.shadowColor=NEON; ctx.shadowBlur=6;
      ctx.fillStyle=NEON;
      ctx.beginPath();
      ctx.moveTo(pzcx-ps, cy-ps*1.1);
      ctx.lineTo(pzcx+ps*1.2, cy);
      ctx.lineTo(pzcx-ps, cy+ps*1.1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    drawPlaneCard();
  }

  // Отдельная кнопка паузы для noHud-композиций (кастом-уровень): HUD не рисуется,
  // поэтому показываем самостоятельную круглую кнопку прямо в её хит-зоне (pauseBtn,
  // которую layout() ставит в не-интерактивный верх-левый угол). Тап по ней →
  // setPaused (см. down() в 08): пауза + меню паузы.
  function drawCustomPauseBtn(){
    const NEON='#27E6FF';
    const cx=pauseBtn.x+pauseBtn.w/2, cy=pauseBtn.y+pauseBtn.h/2;
    const r=Math.min(pauseBtn.w,pauseBtn.h)/2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle='rgba(10,16,28,.70)'; ctx.fill();
    ctx.lineWidth=Math.max(1.5,r*0.10); ctx.strokeStyle=hexa(NEON,.85);
    ctx.shadowColor=NEON; ctx.shadowBlur=8; ctx.stroke();
    ctx.shadowBlur=6; ctx.fillStyle=NEON;
    if(paused){
      const ps=r*0.45;
      ctx.beginPath(); ctx.moveTo(cx-ps*0.8,cy-ps); ctx.lineTo(cx+ps,cy); ctx.lineTo(cx-ps*0.8,cy+ps); ctx.closePath(); ctx.fill();
    } else {
      const bw=r*0.26, bh=r*0.92, gap=r*0.24;
      rr(cx-gap-bw, cy-bh/2, bw, bh, bw*0.4); ctx.fill();
      rr(cx+gap,    cy-bh/2, bw, bh, bw*0.4); ctx.fill();
    }
    ctx.restore();
  }

  function fmtTime(s: number){ const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(Math.floor(s%60)).padStart(2,'0'); return m+':'+ss; }
  function drawToast(){
    const a = toast.t<2.0 ? 1 : (2.4-toast.t)/0.4;
    const col = toast.good?COL.coin:COL.life;
    ctx.save(); ctx.globalAlpha=Math.max(0,a);
    ctx.font=`${12*ui}px ${MONO}`;
    const w=ctx.measureText(toast.text).width+44*ui, h=24*ui;
    const x=W/2-w/2, y=HUD_H()+safe.t+12*ui;
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
