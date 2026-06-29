// ===== 09-render — draw primitives, the neon field/runways and biome decor (forest/arctic/tropical/desert/mountain/megacity/butterfly/bonus) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: rr, hexa, heart, drawIcon, iconTarget, NUM, planeShape, planeScale, drawPlaneShadow, drawPlaneBodyAt, drawNeonField, drawField, drawRunways, emoji, drawForest, drawArctic, drawTropical, drawDesert, drawMountain, drawCity, drawBonusDecor, BSP/BTYPE/bSpec.
// Reads: 01 (ctx); 02 (COL, SPRITES); 06 (field, runways, hazards, crews, W/H, ui, save); 04 (K, LV); 03 (t); 08 (neededCrew).

  function rr(x: number,y: number,w: number,h: number,r: number){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  // ---- облик «ночной радар»: помощники ----
  const MONO='ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  const NUM="'Fredoka','Nunito',sans-serif";   // игровые ЧИСЛА — крупный игровой шрифт (макет TopHUD)
  function hexa(c: string,a: number){ if(!c || c[0]!=='#') return c;
    const n=parseInt(c.slice(1),16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

  function starfield(tm: number){ // мерцающие звёзды в верхней части неба
    for(let i=0;i<55;i++){
      const x=(i*97.13)%W, y=(i*53.7)%(H*0.6);
      const tw=0.3+0.7*Math.abs(Math.sin(tm*0.0008+i));
      ctx.fillStyle=hexa(COL.phosphor, 0.05+0.10*tw);
      ctx.fillRect(x,y,1.5,1.5);
    }
  }
  // Кэш виньетки: пересоздаём только при изменении размера экрана.
  let _vigGrad: CanvasGradient|null=null, _vigW=0, _vigH=0;
  function vignette(){ // мягкое затемнение краёв
    if(!_vigGrad||_vigW!==W||_vigH!==H){
      _vigGrad=ctx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,W*0.7);
      _vigGrad.addColorStop(0,'rgba(0,0,0,0)'); _vigGrad.addColorStop(1,'rgba(0,0,0,.42)');
      _vigW=W; _vigH=H;
    }
    ctx.fillStyle=_vigGrad; ctx.fillRect(0,0,W,H);
  }
  function heart(x: number,y: number,r: number,fill?: string|null){ // жизни в HUD
    if(ATLAS && SPRITES.blitC(fill?'heart':'heart-empty', x, y, r*6, r*6)) return;
    ctx.save(); ctx.translate(x,y); ctx.beginPath(); ctx.moveTo(0,r*0.7);
    ctx.bezierCurveTo(-r*1.3,-r*0.4,-r*0.5,-r*1.1,0,-r*0.35);
    ctx.bezierCurveTo(r*0.5,-r*1.1,r*1.3,-r*0.4,0,r*0.7); ctx.closePath();
    if(fill){ ctx.fillStyle=fill; ctx.shadowColor=hexa(fill,.6); ctx.shadowBlur=7; ctx.fill(); ctx.shadowBlur=0; }
    else { ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.muted,.45); ctx.stroke(); }
    ctx.restore();
  }

  // иконки услуг (центр в (cx,cy), размер r)
  // ремонт = гаечный ключ (handoff NIcon.repair): открытый зев + рукоять под 45°.
  // Вырез зева/оси рисуется цветом фона (hole) — как «дырка» у прежней шестерёнки.
  function iconWrench(cx: number,cy: number,r: number,col: string,hole?: string){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI/4); ctx.fillStyle=col;
    const hw=r*0.2;
    rr(-hw,-r*0.15,hw*2,r*1.05,hw); ctx.fill();                       // рукоять (скруглённый стержень)
    ctx.beginPath(); ctx.arc(0,-r*0.6,r*0.44,0,7); ctx.fill();        // головка
    ctx.fillStyle=hole||COL.tarmac;                                   // открытый зев (клин) цветом фона
    ctx.beginPath(); ctx.moveTo(-r*0.16,-r*0.55); ctx.lineTo(-r*0.46,-r*1.02);
    ctx.lineTo(r*0.46,-r*1.02); ctx.lineTo(r*0.16,-r*0.55); ctx.closePath(); ctx.fill();
    ctx.restore(); }
  function iconDrop(cx: number,cy: number,r: number,col: string){ ctx.save(); ctx.translate(cx,cy-r*0.1); ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(0,-r); ctx.bezierCurveTo(r*0.9,-r*0.1,r*0.85,r*0.9,0,r);
    ctx.bezierCurveTo(-r*0.85,r*0.9,-r*0.9,-r*0.1,0,-r); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-r*0.22,r*0.28,r*0.22,0,7); ctx.fillStyle=hexa('#ffffff',.4); ctx.fill(); ctx.restore(); }
  function iconPerson(cx: number,cy: number,r: number,col: string){ ctx.save(); ctx.translate(cx,cy); ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(0,-r*0.5,r*0.34,0,7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r*0.62,r*0.9); ctx.quadraticCurveTo(-r*0.6,-r*0.05,0,-r*0.05);
    ctx.quadraticCurveTo(r*0.6,-r*0.05,r*0.62,r*0.9); ctx.closePath(); ctx.fill(); ctx.restore(); }
  function iconDepart(cx: number,cy: number,r: number,col: string){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI/4);
    ctx.scale(r/26,r/26); planeShape(col); ctx.restore(); }
  function iconSnow(cx: number,cy: number,r: number,col: string){ ctx.save(); ctx.translate(cx,cy);   // снежинка: 6 лучей
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(1,r*0.16); ctx.lineCap='round';
    for(let k=0;k<6;k++){ ctx.rotate(Math.PI/3);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*0.62); ctx.lineTo(r*0.26,-r*0.84); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*0.62); ctx.lineTo(-r*0.26,-r*0.84); ctx.stroke();
    }
    ctx.restore(); }
  function drawIcon(type: string,cx: number,cy: number,r: number,col: string,hole?: string){
    if(type==='repair') iconWrench(cx,cy,r,col,hole);
    else if(type==='fuel') iconDrop(cx,cy,r,col);
    else if(type==='board') iconPerson(cx,cy,r,col);
    else if(type==='deice') iconSnow(cx,cy,r,col);
    else iconDepart(cx,cy,r,col);
  }
  // мишень-«цель уровня» (мокап NIcon.goal): два кольца + точка в центре
  function iconTarget(cx: number,cy: number,r: number,col: string){ ctx.save();
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.4,r*0.16); ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.54,0,7); ctx.stroke();
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx,cy,r*0.16,0,7); ctx.fill();
    ctx.restore(); }

  // силуэт авиалайнера (нос по курсу, +x; габарит ~48 единиц)
  function planeShape(col: string){ ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(26,0); ctx.quadraticCurveTo(14,-5,-6,-5); ctx.lineTo(-22,-3.5);
    ctx.lineTo(-22,3.5); ctx.lineTo(-6,5); ctx.quadraticCurveTo(14,5,26,0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3,-3); ctx.lineTo(-15,-22); ctx.lineTo(-20,-21); ctx.lineTo(-6,-3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3,3); ctx.lineTo(-15,22); ctx.lineTo(-20,21); ctx.lineTo(-6,3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16,-2.5); ctx.lineTo(-24,-10); ctx.lineTo(-27,-9.5); ctx.lineTo(-20,-2.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16,2.5); ctx.lineTo(-24,10); ctx.lineTo(-27,9.5); ctx.lineTo(-20,2.5); ctx.closePath(); ctx.fill(); }
  // тонкий неон-контур-джет для ГЛАВНОГО ЭКРАНА (planeQSvg из макета SKINS.neon): нос по +X —
  // контур фюзеляжа + 4 стреловидных пера, обводка COL.phosphor (#3ad2ff), без заливки. Координаты
  // центрированы (planeQSvg 32×32 − [16,16]); рисуется в системе, уже повёрнутой на ang (как
  // planeShape), поэтому доп. поворота носа НЕ нужно (это была гоча Варианта A с атлас-символом).
  function planeContour(){
    ctx.save(); ctx.scale(2.2,2.2);
    ctx.strokeStyle=COL.phosphor; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.lineWidth=0.7;
    ctx.shadowColor=hexa(COL.phosphor,.6); ctx.shadowBlur=4;
    ctx.beginPath();                                            // фюзеляж
    ctx.moveTo(13,0); ctx.bezierCurveTo(8,-3.6,-7,-3.4,-10.6,-2.6);
    ctx.lineTo(-10.6,2.6); ctx.bezierCurveTo(-7,3.4,8,3.6,13,0); ctx.closePath(); ctx.stroke();
    const F=[                                                   // крылья (2) + хвост (2)
      [[-1,0],[-9,-9.5],[-6.6,-9.5],[3,-1.6]],
      [[-1,0],[-9,9.5],[-6.6,9.5],[3,1.6]],
      [[-8.5,0],[-12,-5],[-10.4,-5],[-6.6,-1.2]],
      [[-8.5,0],[-12,5],[-10.4,5],[-6.6,1.2]],
    ];
    for(const f of F){ ctx.beginPath(); ctx.moveTo(f[0][0],f[0][1]);
      for(let i=1;i<f.length;i++) ctx.lineTo(f[i][0],f[i][1]); ctx.closePath(); ctx.stroke(); }
    ctx.restore();
  }
  // корпус с тенью/окнами/свечением; vip — золото, аварийный — тёплый светлый,
  // медицинский — белый с красным крестом на фюзеляже
  // визуальный масштаб борта (перспектива небо↔земля). На ВПП посадка и взлёт ведут
  // себя ПО-РАЗНОМУ — это не симметричная интерполяция:
  //  • ПОСАДКА: борт снижается с неба (A) на полосу, ужимаясь к точке касания; ПОСЛЕ
  //    касания размер фиксируется наземным (G) и больше не уменьшается — дальше борт
  //    катится/выкатывается на апрон тем же размером.
  //  • ВЗЛЁТ: пока борт разбегается ПО полосе — он наземный (G, маленький); расти к
  //    небесному (A) он начинает только ПОСЛЕ отрыва, за торцом ВПП, на дистанции
  //    K.TAKEOFF_LIFT_DIST.
  function planeScale(pl: any){
    const A=K.PLANE_SKY_SCALE, G=K.PLANE_GND_SCALE;
    if(pl.zone==='air') return A;
    if(pl.zone==='runway' && pl.runway){
      const r=pl.runway;
      const skyX = r.x + r.w;                 // правый (небесный) торец ВПП
      if(pl.landing){
        if(pl.touched) return G;              // коснулся — наземный, дальше НЕ ужимается
        const tdX = r.stopX + PLANE_LEN() + K.RW_TOUCHDOWN_OFF*ui;   // точка касания (настраиваемая)
        if(pl.x >= skyX) return A;
        if(pl.x <= tdX) return G;
        return G + (pl.x - tdX) / Math.max(1, skyX - tdX) * (A - G);
      }
      if(pl.takeoff){
        const liftX = skyX + K.RW_LIFTOFF_OFF*ui;        // точка отрыва (настраиваемая)
        if(pl.x <= liftX) return G;           // разбег по полосе — остаётся наземным
        const liftEnd = liftX + K.TAKEOFF_LIFT_DIST*ui;  // дорос до небесного — за точкой отрыва
        if(pl.x >= liftEnd) return A;
        return G + (pl.x - liftX) / Math.max(1, liftEnd - liftX) * (A - G);
      }
    }
    return G;   // field / bay / борт стоит/выкатывается на полосе
  }
  // Силуэт борта для тени: тот же спрайт, залитый сплошным чёрным (source-in сохраняет контур
  // по альфа-каналу). Строим один раз и кешируем по исходному изображению/канвасу — поэтому
  // отдельный «чёрный самолёт» в ассетах не нужен, тень всегда совпадает с реальным корпусом.
  const _planeSilCache = new WeakMap<object, HTMLCanvasElement>();
  function planeSilhouette(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement | null {
    if(typeof document === 'undefined') return null;
    const cached = _planeSilCache.get(src); if(cached) return cached;
    const w = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
    const h = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
    if(!(w > 0 && h > 0)) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const sctx = c.getContext('2d'); if(!sctx) return null;
    sctx.drawImage(src, 0, 0, w, h);
    sctx.globalCompositeOperation = 'source-in';            // непрозрачные пиксели → чёрные, контур сохранён
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, w, h);
    _planeSilCache.set(src, c);
    return c;
  }
  // Тень борта в воздухе — ПОЛНЫЙ СИЛУЭТ корпуса (а не овал), залитый чёрным. Высоту берём из
  // визуального масштаба planeScale (небо A → земля G): alt=1 в небе, 0 на земле, плавно между на
  // ВПП при посадке/взлёте. Солнце в правом верхнем углу → тень падает к низу-влево; чем выше борт,
  // тем дальше и крупнее тень (корпус тоже крупнее за счёт vs). По мере снижения тень съезжается к
  // борту, мельчает (вместе с vs) и бледнеет, полностью исчезая у земли (alt≈0). Силуэт берём из
  // того же спрайта, которым рисуется корпус (см. drawPlaneBodyAt), с фолбэком на процедурный контур.
  function drawPlaneShadow(pl: any, cx: number, cy: number, ang: number, vs: number){
    const A=K.PLANE_SKY_SCALE, G=K.PLANE_GND_SCALE;
    const alt = A>G ? Math.max(0, Math.min(1, (vs - G) / (A - G))) : 0;
    if(alt < 0.04) return;                                   // на земле тени нет
    const off = alt * K.PLANE_SHADOW_OFFSET * ui;            // смещение растёт с высотой
    const sx = cx - off * Math.SQRT1_2, sy = cy + off * Math.SQRT1_2;   // низ-влево
    const a = K.PLANE_SHADOW_ALPHA * Math.sqrt(alt);         // выше → темнее; у земли плавно в 0
    const scalePx = ui*0.5*SZ()*vs;                          // тот же масштаб, что у корпуса
    // источник силуэта — тот же спрайт, которым рисуется корпус (zoneSkin → handoff-PNG)
    let img: HTMLCanvasElement | null = null;
    if(!inMenu){
      const pSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('plane');
      if(pSkin && _hiOk(pSkin)) img = planeSilhouette(pSkin);
      else if(HANDOFF_IMG.ready && _hiOk(HANDOFF_IMG.plane)) img = planeSilhouette(HANDOFF_IMG.plane!);
    }
    ctx.save();
    ctx.globalAlpha = a;
    if(img){                                                 // PNG-спрайт нарисован носом вверх → +90° к курсу
      const dw = 62*scalePx, dh = 62*scalePx;
      ctx.translate(sx, sy); ctx.rotate(ang + Math.PI/2);
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
    } else {                                                 // фолбэк: процедурный силуэт planeShape (нос по +x)
      ctx.translate(sx, sy); ctx.rotate(ang); ctx.scale(scalePx, scalePx);
      planeShape('#000');
    }
    ctx.restore();
  }
  function drawPlaneBodyAt(x: number,y: number,ang: number,s: number,vip?: any,emergency?: any,medical?: any,liv?: number){
    if(LV.bonus && !inMenu){ drawCaterpillar(x,y,ang,s); return; }   // бонус-мир: борт → гусеница (в меню-радаре оставляем самолёт)
    if(!inMenu){   // скин самолёта (assets/skins) — ВМЕСТО спрайта/процедурки; не трогаем меню-контур
      const pSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('plane');
      if(pSkin){   // PNG нарисован носом вверх (как спрайт) → +90° к игровому курсу (нос вдоль +x)
        const dw=62*s, dh=62*s;
        ctx.save(); ctx.translate(x,y); ctx.rotate(ang + Math.PI/2); ctx.drawImage(pSkin, -dw/2, -dh/2, dw, dh); ctx.restore();
        return;
      }
    }
    // Handoff PNG plane — приоритет выше neon-атласа; нос вверх → +90° к курсу
    if(HANDOFF_IMG.ready && !inMenu){
      const livIdx = (liv != null) ? Math.max(0,Math.min(3,liv)) :
                     (medical ? 3 : emergency ? 1 : vip ? 2 : 0);
      const im = HANDOFF_IMG.planes[livIdx] || HANDOFF_IMG.plane;
      if(im && _hiOk(im)){
        const dw=62*s, dh=62*s;
        ctx.save(); ctx.translate(x,y); ctx.rotate(ang + Math.PI/2);
        ctx.drawImage(im as HTMLImageElement, -dw/2, -dh/2, dw, dh); ctx.restore();
        return;
      }
    }
    if(ATLAS && !inMenu){   // главный экран рисует борт контуром процедурно (ниже); геймплей — атлас-спрайт
      // sprite is authored nose-up; game heading has nose along +x → rotate ang+90°
      const _id = medical ? 'plane-medevac' : emergency ? 'plane-emergency' : vip ? 'plane-vip' : 'plane';
      if(SPRITES.blitC(_id, x, y, 62*s, 62*s, ang + Math.PI/2)) return;
    }
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.scale(s,s);
    if(inMenu){ planeContour(); ctx.restore(); return; }   // главный экран: тонкий неон-контур-джет (макет SKINS.neon)
    ctx.save(); ctx.translate(5,7); ctx.globalAlpha=.28; planeShape('#000'); ctx.restore();
    if(vip){ ctx.shadowColor=hexa(COL.gold,.6); ctx.shadowBlur=16; }
    else { ctx.shadowColor=hexa(COL.phosphor,.7); ctx.shadowBlur=10; }
    planeShape(vip?COL.gold:(emergency?'#e7d8cf':COL.paper));
    ctx.shadowBlur=0;
    ctx.fillStyle=hexa(COL.phosphor,.55); ctx.fillRect(-2,-1.2,18,2.4);
    ctx.fillStyle=hexa(COL.ink,.5); ctx.beginPath(); ctx.moveTo(26,0); ctx.lineTo(16,-3.2); ctx.lineTo(16,3.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle=hexa(COL.ink,.55);
    ctx.beginPath(); ctx.arc(-8,-12,2.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(-8,12,2.4,0,7); ctx.fill();
    if(medical){ ctx.fillStyle=COL.rose; ctx.fillRect(-7,-2,14,4); ctx.fillRect(-2,-7,4,14); } // красный крест поверх
    ctx.restore();
  }

  // неоновое поле: тёмный фон + радарная сетка/кольца/развёртка вместо
  // металлического апрона, терминала, травы и воды (боксы рисуются поверх)
  // Кэши для тяжёлых градиентов поля (зарево города + апрон) — пересоздаём при resize.
  let _neonCityGrad: CanvasGradient|null=null;
  let _neonCacheW=0, _neonCacheH=0;
  function drawCloudLayer(_tm: number): void {
    // cloud sprites: cloud-far / cloud-mid / cloud-near
    // Clip to sky zone: field.x1 → W
  }
  // Процедурная неон-линия по периметру апрона (та же, что раньше была запечена в
  // картинке апрона). Рисуется как скруглённый прямоугольник, но ПРЕРЫВАЕТСЯ там, где
  // к кромке апрона примыкают входы в ангары (проёмы боксов). Углы дуг рисуются всегда.
  function drawApronNeon(fx: number,fy: number,fw: number,fh: number,arc: number){
    const ni=9*ui;                                   // отступ линии внутрь от кромки текстуры
    const x0=fx+ni, y0=fy+ni, x1=fx+fw-ni, y1=fy+fh-ni;
    const r=Math.max(2, arc-ni);
    // Проёмы ангаров → разрывы по соответствующей кромке. Разрыв соответствует ШИРИНЕ
    // ВОРОТ (а не всему боксу): ворота — центральная часть фасада ангара, по краям бокса
    // стены/стойки. Так линия остаётся «столбиками» между смежными ангарами и прерывается
    // ровно напротив каждого въезда. DOOR_FRAC — доля фасада, занятая воротами.
    const DOOR_FRAC=0.56;
    const gap=(a: number,len: number)=>{ const d=len*(1-DOOR_FRAC)/2; return [a+d, a+len-d]; };
    const gT: number[][]=[], gB: number[][]=[], gL: number[][]=[], gR: number[][]=[];
    for(const b of bays){
      if(b.deice) continue;
      if(b.gate==='down' || (!b.gate && b.side==='top'))      gT.push(gap(b.x,b.w));
      else if(b.gate==='up' || (!b.gate && b.side==='bottom')) gB.push(gap(b.x,b.w));
      else if(b.gate==='right')                                gL.push(gap(b.y,b.h));
      else if(b.gate==='left')                                 gR.push(gap(b.y,b.h));
    }
    // [a,b] минус интервалы-разрывы → список видимых под-отрезков
    const subtract=(a: number,b: number,gaps: number[][])=>{
      const gs=gaps.map(g=>[Math.max(a,Math.min(b,g[0])), Math.max(a,Math.min(b,g[1]))])
                   .filter(g=>g[1]>g[0]).sort((p,q)=>p[0]-q[0]);
      const out: number[][]=[]; let cur=a;
      for(const g of gs){ if(g[0]>cur) out.push([cur,g[0]]); cur=Math.max(cur,g[1]); }
      if(cur<b) out.push([cur,b]);
      return out;
    };
    const hSeg=(xa: number,xb: number,y: number,gaps: number[][])=>{
      for(const s of subtract(xa,xb,gaps)){ ctx.moveTo(s[0],y); ctx.lineTo(s[1],y); }
    };
    const vSeg=(ya: number,yb: number,x: number,gaps: number[][])=>{
      for(const s of subtract(ya,yb,gaps)){ ctx.moveTo(x,s[0]); ctx.lineTo(x,s[1]); }
    };
    const corner=(cx: number,cy: number,a0: number,a1: number)=>{
      ctx.moveTo(cx+r*Math.cos(a0), cy+r*Math.sin(a0)); ctx.arc(cx,cy,r,a0,a1);
    };
    const trace=()=>{
      ctx.beginPath();
      hSeg(x0+r, x1-r, y0, gT);                       // верх
      hSeg(x0+r, x1-r, y1, gB);                       // низ
      vSeg(y0+r, y1-r, x0, gL);                       // лево
      vSeg(y0+r, y1-r, x1, gR);                       // право
      corner(x0+r,y0+r,Math.PI,1.5*Math.PI);         // верх-лево
      corner(x1-r,y0+r,1.5*Math.PI,2*Math.PI);       // верх-право
      corner(x1-r,y1-r,0,0.5*Math.PI);               // низ-право
      corner(x0+r,y1-r,0.5*Math.PI,Math.PI);         // низ-лево
    };
    ctx.save();
    ctx.lineCap='round'; ctx.lineJoin='round';
    trace();                                           // 1) свечение
    ctx.shadowColor=hexa('#27E6FF',.9); ctx.shadowBlur=12*ui;
    ctx.strokeStyle=hexa('#27E6FF',.85); ctx.lineWidth=3.2*ui; ctx.stroke();
    trace();                                           // 2) яркое ядро
    ctx.shadowBlur=0;
    ctx.strokeStyle=hexa('#bfefff',.95); ctx.lineWidth=1.4*ui; ctx.stroke();
    ctx.restore();
  }

  function drawNeonField(tm: number){
    // НЕОН-ГЕЙМПЛЕЙ (handoff, docs/design/skins/neon/handoff/): спокойный ночной УВД.
    // Апрон — ОГРАНИЧЕННАЯ зона руления слева с неон-рамкой (верх/лево/низ сплошные,
    // право открыто на ВПП). БЕЗ вращающейся радар-развёртки/антенны. Справа, ВНЕ
    // рамки — небо: звёзды, силуэт вышки УВД с маяком, зарево и силуэт города.
    ctx.fillStyle=COL.ink; ctx.fillRect(0,0,W,H);
    const ax=field.x0, ay=field.y0, ab=field.y1;
    const apR=field.x1;                          // правый край апрона (перед ВПП)
    const skyL=(field.rwR||W*0.85);              // левая кромка «неба» (правее ВПП)

    const bgSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('background');
    if(bgSkin){ ctx.drawImage(bgSkin, 0, 0, W, H); }
    else if(_hiOk(HANDOFF_IMG.bg)){ ctx.drawImage(HANDOFF_IMG.bg!, 0, 0, W, H); }
    else {
    // ===== небо справа (вне апрона) =====
    // звёзды (детерминированный разброс, мягкое мерцание)
    for(let i=0;i<30;i++){
      const sx=apR+22*ui + ((i*9973)%Math.max(1,Math.round(W-apR-26*ui)));
      const sy=12*ui + ((i*6131)%Math.max(1,Math.round((ab-ay)*0.6)));
      const tw=0.35+0.5*Math.abs(Math.sin(tm*0.0011+i));
      ctx.fillStyle=hexa('#cfeaff',.5*tw);
      ctx.beginPath(); ctx.arc(sx,sy,(i%3?1.4:2.2)*ui,0,7); ctx.fill();
    }
    // зарево + силуэт небоскрёбов вдоль нижней правой кромки (градиент кэшируется)
    if(!_neonCityGrad||_neonCacheW!==W||_neonCacheH!==H){
      _neonCityGrad=ctx.createRadialGradient(W*0.9,H,0,W*0.9,H,Math.min(W,H)*0.55);
      _neonCityGrad.addColorStop(0,hexa(COL.phosphor,.10)); _neonCityGrad.addColorStop(1,'rgba(0,0,0,0)');
      _neonCacheW=W; _neonCacheH=H;
    }
    ctx.fillStyle=_neonCityGrad; ctx.fillRect(skyL,H*0.45,W-skyL,H*0.55);
    const bn=8, bw=(W-skyL-14*ui)/bn;
    for(let i=0;i<bn;i++){
      const bx=skyL+8*ui+i*bw, bh=(16+((i*53)%34))*ui;
      ctx.fillStyle='#0b1a36'; ctx.fillRect(bx,H-bh,bw-5*ui,bh);
      ctx.fillStyle=hexa(COL.phosphor,.32); ctx.fillRect(bx,H-bh,bw-5*ui,2*ui);
      ctx.fillStyle=hexa(COL.gold,.65); ctx.fillRect(bx+4*ui,H-bh+7*ui,2*ui,2*ui);
    }
    // вышка УВД (справа сверху) + мигающий маяк
    const twx=W-30*ui, twy=ay+8*ui;
    ctx.fillStyle='#0b1832'; ctx.fillRect(twx,twy+18*ui,6*ui,44*ui);
    rr(twx-9*ui,twy+4*ui,24*ui,16*ui,4*ui); ctx.fillStyle='#0e1f44'; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.phosphor,.6); rr(twx-9*ui,twy+4*ui,24*ui,16*ui,4*ui); ctx.stroke();
    ctx.fillStyle=hexa(COL.rose,.4+.5*(0.5+0.5*Math.sin(tm*0.004)));
    ctx.beginPath(); ctx.arc(twx+3*ui,twy,3.4*ui,0,7); ctx.fill();
    }

    // ===== слой облаков (зона неба, правее апрона) =====
    drawCloudLayer(tm);

    // ===== VPP-коннекторы (Y-развилки) — ДО апрона, апрон скрывает их левый край =====
    // Пропорции из handoff (1600×800): vppConn 279×203 у правого края апрона (RX=862),
    // смещение центра: dx=-51+279/2=88.5, dy≈+2 — масштабируем по высоте полосы.
    if(_hiOk(HANDOFF_IMG.vppConn)){
      for(const rw of runways){
        const scale = rw.h / 80;            // 80px — эталонная высота ВПП в handoff
        const cw = 279 * scale, ch = 203 * scale;
        const cx = apR + 88.5 * scale;      // центр X: RX + (-51 + 279/2) * scale
        const cy = rw.cy + 2 * scale;
        _hiDraw(HANDOFF_IMG.vppConn, cx, cy, cw, ch);
      }
    }

    // ===== Апрон — текстура PNG со скруглёнными углами + ПРОЦЕДУРНАЯ неон-линия =====
    // Текстура апрона больше НЕ содержит запечённой неон-рамки: углы скругляются клипом,
    // а неон-линия рисуется поверх процедурно (drawApronNeon) и прерывается у входов в ангары.
    const fx=ax-8*ui, fy=ay-8*ui, fw=(apR-ax)+16*ui, fh=(ab-ay)+16*ui;
    const apArc=22*ui;
    const apronSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('apron');
    ctx.save();
    rr(fx,fy,fw,fh,apArc); ctx.clip();
    if(apronSkin){
      ctx.drawImage(apronSkin, fx, fy, fw, fh);
    } else if(_hiOk(HANDOFF_IMG.apron)){
      ctx.drawImage(HANDOFF_IMG.apron!, fx, fy, fw, fh);
    } else if(!(SPRITES.nineSlice && SPRITES.nineSlice('apron-frame', fx, fy, fw, fh, 57))){
      ctx.fillStyle=COL.tarmac; ctx.fillRect(fx,fy,fw,fh);
    }
    ctx.restore();
    drawApronNeon(fx,fy,fw,fh,apArc);

    if(LV.biome==='forest')   drawForestDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.biome==='arctic')   drawArcticDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.biome==='tropical') drawTropicalDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.biome==='desert')   drawDesertDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.biome==='mountain') drawMountainDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.biome==='megacity') drawCityDecor(tm, ax, ay, field.rwR!, ab);
    if(LV.bonus) drawBonusDecor(tm, ax, ay, field.rwR!, ab);
    // скин прилёта (assets/skins) — рисуется в свой прямоугольник из разметки (zones.arrival), если он задан
    const arrSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('arrival');
    if(arrSkin && field.arrivalX0!=null && field.arrivalX1!=null){
      const x0=field.arrivalX0, x1=field.arrivalX1, y0=field.arrivalY0??ay, y1=field.arrivalY1??ab;
      ctx.save(); rr(x0,y0,x1-x0,y1-y0,10*ui); ctx.clip(); ctx.drawImage(arrSkin, x0, y0, x1-x0, y1-y0); ctx.restore();
    }
  }

  function drawField(tm: number){ drawNeonField(tm); }   // единственная сцена поля — неоновая

  function drawRunways(tm: number){
    const WOW_BLUE = '#27E6FF';
    runways.forEach((r,i)=>{
      const rwSkin = SPRITES.zoneSkin && SPRITES.zoneSkin('runway');
      const rwHandoff = !rwSkin && _hiOk(HANDOFF_IMG.vpp);
      if(rwSkin || rwHandoff){
        const im = rwSkin || HANDOFF_IMG.vpp!;
        ctx.save(); rr(r.x,r.y,r.w,r.h,7*ui); ctx.clip(); ctx.drawImage(im, r.x, r.y, r.w, r.h); ctx.restore();
        if(r.closed){
          const cx=r.x+r.w/2, s=Math.min(r.w,r.h)*0.16;
          ctx.strokeStyle=hexa(COL.life,.8); ctx.lineWidth=3.5; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(cx-s,r.cy-s); ctx.lineTo(cx+s,r.cy+s);
          ctx.moveTo(cx+s,r.cy-s); ctx.lineTo(cx-s,r.cy+s); ctx.stroke();
          ctx.fillStyle=hexa(COL.life,.85); ctx.font=`${10*ui}px ${MONO}`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(t('canvas.closed'), cx, r.y+r.h-12*ui);
        }
        return;
      }

      // WOW нeon runway — тёмная подложка
      rr(r.x,r.y,r.w,r.h,7*ui); ctx.fillStyle=LV.bonus?'#6e5238':'#061426'; ctx.fill();

      if(!r.closed){
        // синяя неон-рамка (без shadowBlur)
        ctx.lineWidth=1.8; ctx.strokeStyle=hexa(WOW_BLUE,.75);
        rr(r.x,r.y,r.w,r.h,7*ui); ctx.stroke();

        // LED-точки: верхняя и нижняя кромки (10 штук)
        const dotR=2.5*ui, nH=9;
        ctx.fillStyle=WOW_BLUE;
        for(let k=0;k<=nH;k++){
          const lx=r.x+9*ui+k*(r.w-18*ui)/nH;
          ctx.beginPath(); ctx.arc(lx, r.y+5*ui, dotR, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(lx, r.y+r.h-5*ui, dotR, 0, 7); ctx.fill();
        }
        // LED-точки: левая и правая кромки (2 точки каждая, между угловыми)
        ctx.beginPath(); ctx.arc(r.x+5*ui, r.cy, dotR, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(r.x+r.w-5*ui, r.cy, dotR, 0, 7); ctx.fill();

        // белая осевая пунктирная (без реакции на занятость — иначе подсказка игроку)
        ctx.strokeStyle=hexa(COL.paper,.75); ctx.lineWidth=2*ui;
        ctx.setLineDash([16*ui,12*ui]);
        ctx.beginPath(); ctx.moveTo(r.x+14*ui, r.cy); ctx.lineTo(r.x+r.w-22*ui, r.cy); ctx.stroke();
        ctx.setLineDash([]);

        // пороговые маркеры (piano-keys) — только у воздушного (правого) торца
        const nB=5, bW=3.5*ui, bH=7*ui, bGap=3*ui;
        const ty0=r.cy-(nB*bH+(nB-1)*bGap)/2;
        ctx.fillStyle=hexa(COL.paper,.85);
        for(let k=0;k<nB;k++) ctx.fillRect(r.x+r.w-16*ui, ty0+k*(bH+bGap), bW, bH);

      } else {
        // закрытая ВПП: красная заливка + «X» + подпись
        rr(r.x,r.y,r.w,r.h,7*ui); ctx.fillStyle=hexa(COL.life,.16); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.muted,.18); rr(r.x,r.y,r.w,r.h,7*ui); ctx.stroke();
        const cx=r.x+r.w/2, s=Math.min(r.w,r.h)*0.16;
        ctx.strokeStyle=hexa(COL.life,.8); ctx.lineWidth=3.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(cx-s,r.cy-s); ctx.lineTo(cx+s,r.cy+s);
        ctx.moveTo(cx+s,r.cy-s); ctx.lineTo(cx-s,r.cy+s); ctx.stroke();
        ctx.fillStyle=hexa(COL.life,.85); ctx.font=`${10*ui}px ${MONO}`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(t('canvas.closed'), cx, r.y+r.h-12*ui);
      }
    });
  }

  // ---- лесной биом: отрисовка ----
  const FCOL = {edge:'#1d3a28', tree:'#2f7d4f', tree2:'#3fa15f', trunk:'#6b4f2a'};
  function pineTree(x: number,y: number,h: number,col: string){            // силуэт ёлки (вершина в y, основание ниже)
    const w=h*0.62;
    ctx.fillStyle=col;
    for(let k=0;k<3;k++){
      const ty=y+h*0.18*k, by=ty+h*0.42, ww=w*(0.6+0.2*k);
      ctx.beginPath(); ctx.moveTo(x,ty); ctx.lineTo(x-ww/2,by); ctx.lineTo(x+ww/2,by); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle=FCOL.trunk; ctx.fillRect(x-h*0.05, y+h*0.78, h*0.1, h*0.18);
  }
  function emoji(g: string,x: number,y: number,size: number,glow?: string){          // эмодзи-глиф по центру (x,y)
    ctx.save();
    ctx.font=`${size}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=COL.paper;                // фолбэк-цвет, если у системы нет цветных эмодзи
    if(glow){ ctx.shadowColor=glow; ctx.shadowBlur=9; }
    ctx.fillText(g,x,y); ctx.restore();
  }
  // ---- бонус-мир «луг бабочек»: гусеницы вместо бортов, цветы вместо боксов ----
  const BCOL = {sky:'#bfe8ff', meadow:'#d9f3c9', body:'#7fc241', body2:'#5fa830', petal:'#ff9ec7'};
  // три вида гусениц ↔ три цвета цветков ↔ три вида бабочек (пазл-сортировка):
  // species i соответствует типу бокса BTYPE[i]; цвет ведёт через все три стадии.
  const BTYPE = ['fuel','board','repair'];                 // какие боксы = какие виды
  const BSP = [
    { body:'#ff9ec7', body2:'#ef79a8', petal:'#ff5fa0', wing:'#ff8fc2', spot:'#ffe1ef' }, // розовый
    { body:'#ffd76a', body2:'#f0b53b', petal:'#ffc24d', wing:'#ffd169', spot:'#fff3cf' }, // золотой
    { body:'#c4a3ff', body2:'#a87cf0', petal:'#b07cff', wing:'#c79bff', spot:'#ece0ff' }, // сиреневый
  ];
  const bSpec = (type: string) => { const i = BTYPE.indexOf(type); return i<0 ? 0 : i; };  // тип бокса → вид
  // гусеница вдоль курса: нос (голова) по +x, сегменты тянутся к хвосту (−x)
  function drawCaterpillar(x: number,y: number,ang: number,s: number,sp?: number){
    const C = BSP[sp||0];
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.scale(s,s);
    // тень под тельцем
    ctx.save(); ctx.translate(3,6); ctx.globalAlpha=.22; ctx.fillStyle='#000';
    for(let i=0;i<6;i++){ ctx.beginPath(); ctx.arc(12-i*9, 0, 7-i*0.4, 0, 7); ctx.fill(); }
    ctx.restore();
    for(let i=5;i>=0;i--){            // от хвоста к голове — голова рисуется поверх
      ctx.beginPath(); ctx.arc(12-i*9, 0, 7-i*0.4, 0, 7);
      ctx.fillStyle = (i%2) ? C.body : C.body2; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(16, 0, 8.5, 0, 7); ctx.fillStyle=C.body; ctx.fill();   // голова
    ctx.fillStyle='#1c241a';          // глазки
    ctx.beginPath(); ctx.arc(20,-3.2,1.8,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 3.2,1.8,0,7); ctx.fill();
    ctx.strokeStyle=C.body2; ctx.lineWidth=1.6;  // усики с шариками
    ctx.beginPath(); ctx.moveTo(18,-4); ctx.lineTo(24,-9); ctx.moveTo(18,4); ctx.lineTo(24,9); ctx.stroke();
    ctx.fillStyle=C.petal;
    ctx.beginPath(); ctx.arc(24,-9,2,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(24,9,2,0,7); ctx.fill();
    ctx.restore();
  }
  // куколка (хризалида): висящая капля в цвете вида, с лёгким бликом
  function drawCocoon(x: number,y: number,s: number,sp?: number){
    const C = BSP[sp||0];
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.save(); ctx.translate(2,4); ctx.globalAlpha=.2; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(0,2,9,13,0,0,7); ctx.fill(); ctx.restore();
    ctx.fillStyle=C.body2;                          // тельце-капля
    ctx.beginPath(); ctx.moveTo(0,-15); ctx.quadraticCurveTo(11,-6,9,6); ctx.quadraticCurveTo(6,16,0,16);
    ctx.quadraticCurveTo(-6,16,-9,6); ctx.quadraticCurveTo(-11,-6,0,-15); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.body;                           // сегменты-насечки
    for(let i=-1;i<=2;i++){ ctx.beginPath(); ctx.ellipse(0,i*6,8-Math.abs(i),2.2,0,0,7); ctx.fill(); }
    ctx.fillStyle=C.spot; ctx.globalAlpha=.7;       // блик
    ctx.beginPath(); ctx.ellipse(-3,-6,2,4,0.4,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=C.body2; ctx.lineWidth=1.4;     // крючок-крепление к стеблю
    ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(0,-21); ctx.stroke();
    ctx.restore();
  }
  // бабочка вдоль курса: тельце по оси, 4 крыла в цвете вида + пятна
  function drawButterfly(x: number,y: number,ang: number,s: number,sp?: number){
    const C = BSP[sp||0], flap = 0.7+0.3*Math.abs(Math.sin(nowT*0.012));
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.scale(s,s);
    ctx.save(); ctx.scale(1, flap);                 // взмах: крылья «дышат» по вертикали
    ctx.fillStyle=C.wing;
    [-1,1].forEach(sg=>{                              // переднее и заднее крыло с каждой стороны
      ctx.beginPath(); ctx.ellipse(3, sg*11, 11, 8, sg*0.5, 0, 7); ctx.fill();   // переднее
      ctx.beginPath(); ctx.ellipse(-7, sg*10, 8, 7, sg*-0.4, 0, 7); ctx.fill();  // заднее
    });
    ctx.fillStyle=C.spot;                            // пятна-глазки на крыльях
    [-1,1].forEach(sg=>{ ctx.beginPath(); ctx.arc(4, sg*12, 2.6, 0, 7); ctx.fill(); });
    ctx.restore();
    ctx.fillStyle='#3a2c14';                         // тельце
    ctx.beginPath(); ctx.ellipse(0,0,3,9,0,0,7); ctx.fill();
    ctx.strokeStyle='#3a2c14'; ctx.lineWidth=1;      // усики
    ctx.beginPath(); ctx.moveTo(6,-1); ctx.lineTo(11,-4); ctx.moveTo(6,1); ctx.lineTo(11,4); ctx.stroke();
    ctx.restore();
  }
  // выбрать стадию по pl.bug: гусеница → куколка (в цветке) → бабочка (вылет)
  function drawBug(pl: any){
    const sp = pl.species||0, s = ui*0.5;
    if(pl.bug==='cocoon') drawCocoon(pl.x, pl.y, s, sp);
    else if(pl.bug==='fly') drawButterfly(pl.x, pl.y, pl.ang, s*1.1, sp);
    else drawCaterpillar(pl.x, pl.y, pl.ang, s, sp);
  }
  // простой цветок: лепестки по кругу + золотая серединка
  function drawFlower(cx: number,cy: number,r: number,col: string){
    ctx.save();
    ctx.fillStyle=col;
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2;
      ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*r*0.62, cy+Math.sin(a)*r*0.62, r*0.5, r*0.3, a, 0, 7); ctx.fill(); }
    ctx.fillStyle='#f4cf5e'; ctx.beginPath(); ctx.arc(cx,cy,r*0.42,0,7); ctx.fill();
    ctx.restore();
  }
  function roundCloud(x: number,y: number,r: number){
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.arc(x+r*0.9,y+r*0.25,r*0.78,0,7); ctx.arc(x-r*0.9,y+r*0.25,r*0.68,0,7); ctx.fill();
  }
  // луговой антураж поверх апрона: небо-градиент с облаками за «полосами» +
  // зелёный налёт на поле с россыпью цветочков (вместо воды/тармака ночного порта)
  function drawBonusDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    const sg=ctx.createLinearGradient(aR,0,aR,H); sg.addColorStop(0,BCOL.sky); sg.addColorStop(1,BCOL.meadow);
    ctx.fillStyle=sg; ctx.fillRect(aR,0,W-aR,H);
    ctx.fillStyle='rgba(255,255,255,.55)';
    for(let i=0;i<4;i++){
      const cyy=H*(i+1)/5 + Math.sin(tm*0.0004+i)*6;
      const span=Math.max(1, W-aR-40*ui);
      const cxx=aR+20*ui + ((i*53*ui) % span);
      roundCloud(cxx, cyy, 15*ui);
    }
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle='rgba(120,200,90,.16)'; ctx.fillRect(ax,ay,aR-ax,ab-ay);
    const pcol=[BCOL.petal, COL.gold, '#b58cf0'];
    for(let i=0;i<10;i++){
      const fxp=ax+18*ui + ((i*97*ui) % Math.max(1,(aR-ax-30*ui)));
      const fyp=ay+14*ui + ((i*61*ui) % Math.max(1,(ab-ay-24*ui)));
      drawFlower(fxp, fyp, 5*ui, pcol[i%3]);
    }
    ctx.restore();
  }
  // зелёный лесной антураж поверх фона апрона (вода справа → лесная кромка)
  function drawTropicalDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // тропическое море справа от ВПП
    ctx.fillStyle='#061a28'; ctx.fillRect(aR,0,W-aR,H);
    for(let i=0;i<5;i++){
      const wy=10*ui+i*(H-20*ui)/5;
      ctx.beginPath();
      for(let x=aR;x<=W;x+=3){
        const y=wy+Math.sin(x*0.07+tm*0.002+i*0.7)*3*ui;
        x===aR ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle=hexa(COL.teal,.10+.05*(i%2)); ctx.lineWidth=1.5; ctx.stroke();
    }
    const cols=Math.max(2, Math.round((W-aR)/(32*ui)));
    for(let r2=0;r2<3;r2++) for(let c2=0;c2<cols;c2++){
      const tx=aR+14*ui+c2*((W-aR-22*ui)/Math.max(1,cols-1));
      const ty=16*ui+r2*(H-32*ui)/3+(c2%2)*8*ui;
      emoji('🌴', tx, ty+Math.sin(tm*0.0004+c2)*2, 18*ui);
    }
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa(COL.teal,.03); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  function drawDesertDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // пустынные барханы справа от ВПП
    ctx.fillStyle='#1a1208'; ctx.fillRect(aR,0,W-aR,H);
    for(let i=0;i<6;i++){
      const bx=aR+(i*(W-aR)/6);
      const by=10*ui+i*(H-20*ui)/6+(i%2)*12*ui;
      const br=(20+i*4)*ui;
      ctx.beginPath(); ctx.ellipse(bx+8*ui, by, br, br*0.45, 0.2, 0, Math.PI*2);
      ctx.fillStyle=hexa('#c8872a', 0.10+0.04*(i%2)); ctx.fill();
    }
    const cols=Math.max(2, Math.round((W-aR)/(36*ui)));
    for(let r2=0;r2<2;r2++) for(let c2=0;c2<cols;c2++){
      const tx=aR+16*ui+c2*((W-aR-24*ui)/Math.max(1,cols-1));
      const ty=18*ui+r2*(H-36*ui)/2+(c2%3)*9*ui;
      emoji('🌵', tx, ty, 16*ui);
    }
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa('#c8872a',.03); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  function drawMountainDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // горные силуэты справа от ВПП
    ctx.fillStyle='#0d1018'; ctx.fillRect(aR,0,W-aR,H);
    for(let i=0;i<4;i++){
      const mx=aR+(i+0.5)*(W-aR)/4;
      const mh=(H*0.4+i*(H*0.07))*(0.9+0.2*(i%2));
      ctx.beginPath(); ctx.moveTo(mx-22*ui,H); ctx.lineTo(mx,H-mh); ctx.lineTo(mx+22*ui,H);
      ctx.closePath(); ctx.fillStyle=hexa('#2a3555', 0.35+0.1*(i%2)); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mx-6*ui,H-mh+10*ui); ctx.lineTo(mx,H-mh); ctx.lineTo(mx+6*ui,H-mh+10*ui);
      ctx.closePath(); ctx.fillStyle=hexa(COL.ice,.35); ctx.fill();
    }
    for(let i=0;i<3;i++){
      const cx=aR+10*ui+((i*73*ui+tm*0.01)%(Math.max(1,W-aR-20*ui)));
      const cy=H*0.15+i*(H*0.12);
      ctx.fillStyle=hexa(COL.ice,.07);
      ctx.beginPath(); ctx.ellipse(cx, cy, 16*ui, 7*ui, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa(COL.ice,.025); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  function drawCityDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // городские небоскрёбы справа от ВПП
    ctx.fillStyle='#080c18'; ctx.fillRect(aR,0,W-aR,H);
    const blds=6;
    for(let i=0;i<blds;i++){
      const bx=aR+(i*(W-aR)/blds);
      const bw=(W-aR)/blds*0.6;
      const bh=(H*0.3+i*(H*0.06))*(1+(i%3)*0.2);
      ctx.fillStyle=hexa('#1a2540', 0.55+0.1*(i%2));
      ctx.fillRect(bx+(W-aR)/blds*0.2, H-bh, bw, bh);
      const rows=Math.floor(bh/(8*ui));
      for(let row=0;row<rows;row++) for(let col=0;col<2;col++){
        const wx=bx+(W-aR)/blds*0.2+col*bw*0.45+bw*0.1;
        const wy=H-bh+6*ui+row*8*ui;
        ctx.fillStyle=hexa(COL.amber, Math.sin(i*7+row*3+col*11)<0.3?0:.35);
        ctx.fillRect(wx, wy, 3*ui, 4*ui);
      }
    }
    for(let i=0;i<8;i++){
      const lx=aR+8*ui+((i*61*ui)%(Math.max(1,W-aR-16*ui)));
      const ly=8*ui+((i*41*ui)%(H*0.3));
      ctx.fillStyle=hexa(COL.amber,.2+.1*(i%2));
      ctx.beginPath(); ctx.arc(lx,ly,1.5*ui,0,7); ctx.fill();
    }
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa(COL.amber,.025); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  function drawArcticDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // ледяная тундра справа от ВПП
    ctx.fillStyle='#0d1e2e'; ctx.fillRect(aR,0,W-aR,H);
    // снежные сугробы — неровная белая кромка
    const cols=Math.max(2, Math.round((W-aR)/(28*ui)));
    for(let r2=0;r2<5;r2++) for(let c2=0;c2<cols;c2++){
      const tx=aR+14*ui+c2*((W-aR-20*ui)/Math.max(1,cols-1));
      const ty=14*ui + r2*(H-28*ui)/5 + (c2%3)*7*ui + Math.sin(tm*0.0004+c2*1.3)*2;
      // сугроб — белый полуэллипс
      ctx.beginPath(); ctx.ellipse(tx, ty, 10*ui, 5*ui, 0, Math.PI, 0);
      ctx.fillStyle=hexa(COL.ice, 0.10+0.05*(r2%2)); ctx.fill();
    }
    // редкие точки-снежинки
    for(let i=0;i<12;i++){
      const sx=aR+8*ui + ((i*79*ui) % Math.max(1,W-aR-16*ui));
      const sy=8*ui + ((i*53*ui) % Math.max(1,H-16*ui));
      ctx.fillStyle=hexa(COL.ice,.35+.15*(i%2));
      ctx.font=`${8*ui}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('*', sx, sy+Math.sin(tm*0.003+i)*3);
    }
    // лёгкий ледяной налёт на тармак
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa(COL.ice,.04); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  function drawForestDecor(tm: number, ax: number, ay: number, aR: number, ab: number){
    // лесная кромка вместо воды за полосами
    ctx.fillStyle=FCOL.edge; ctx.fillRect(aR,0,W-aR,H);
    const cols=Math.max(2,Math.round((W-aR)/(34*ui)));
    for(let r2=0;r2<6;r2++) for(let c2=0;c2<cols;c2++){
      const tx=aR+18*ui+c2*((W-aR-24*ui)/Math.max(1,cols-1));
      const ty=18*ui + r2*(H-36*ui)/6 + (c2%2)*9*ui + Math.sin(tm*0.0006+c2)*1.5;
      pineTree(tx,ty,26*ui, r2%2?FCOL.tree:FCOL.tree2);
    }
    // лёгкий зелёный налёт на тармак
    ctx.save(); rr(ax,ay,aR-ax,ab-ay,9*ui); ctx.clip();
    ctx.fillStyle=hexa(FCOL.tree,.06); ctx.fillRect(ax,ay,aR-ax,ab-ay); ctx.restore();
  }
  // сервисное здание + помехи на полосах + спец-бригады
  function drawForest(tm: number){
    const sv=field.service;
    if(sv){
      // здание: корпус + крыша + гаражные ворота + эмблема
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#243b2d'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(FCOL.tree2,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(FCOL.tree2,.5);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      // гаражные ворота (выезд бригад)
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#16241b'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.amber,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('🔧', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(COL.amber,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    // помехи
    for(const h of hazards){
      if(h.kind==='tree'){
        const ang = (h.fallen?1:Math.min(1,h.t/h.fallTime)) * (Math.PI*0.46); // 0 → стоит, ~83° → лежит поперёк
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
        // ствол растёт «вверх» (−y) от основания у поля; при падении поворачивается на полосу
        ctx.fillStyle=FCOL.trunk; ctx.fillRect(-3*ui, -10*ui, 6*ui, 10*ui);
        pineTree(0, -40*ui, 34*ui, FCOL.tree2);
        ctx.restore();
        if(h.beaver) emoji('🦫', h.x+12*ui, h.y+8*ui, 13*ui, hexa(COL.amber,.5)); // бобёр грызёт у основания
      } else if(h.kind==='deer'){
        emoji('🦌', h.x, h.y, 22*ui, hexa(COL.amber,.4));
      } else if(h.kind==='snow'){
        emoji('❄️', h.x, h.y, 22*ui, hexa(COL.teal,.5));   // занос на полосе (плейсхолдер под арт)
      } else { // birds
        for(let k=0;k<3;k++) emoji('🐦', h.x+(k-1)*15*ui, h.y+Math.sin(tm*0.006+k)*4*ui, 13*ui, hexa(COL.phosphor,.4));
      }
      // подсказка «тапни — вышлю бригаду»: пульсирующее кольцо + иконка нужной бригады
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.phosphor,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        const ic = ({truck:'🚙', eagle:'🦅', chainsaw:'🪚', plow:'🚜', deice_truck:'🚒'} as Record<string, string>)[neededCrew(h)];
        emoji(ic, h.x, h.y-32*ui, 14*ui, hexa(COL.teal,.5));
      }
    }
    // спец-авто в пути / за работой
    for(const c of crews){
      const ic = ({truck:'🚙', eagle:'🦅', chainsaw:'🪚', plow:'🚜', deice_truck:'🚒'} as Record<string, string>)[c.kind];
      emoji(ic, c.x, c.y, 16*ui, hexa(COL.amber,.4));
      if(c.phase==='work'){               // искорки работы
        const pulse=Math.abs(Math.sin(tm*0.02));
        ctx.fillStyle=hexa(COL.gold,.4+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
  // арктический биом: снежный антураж + обледенение ВПП + деайсинг-бригады
  function drawArctic(tm: number){
    const sv=field.service;
    if(sv){
      // здание с арктической отделкой (синеватый оттенок вместо зелёного)
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#1a2a3a'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.ice,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(COL.ice,.4);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#0e1a26'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.ice,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('❄️', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(COL.ice,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    // ледяные пятна на полосах
    for(const h of hazards){
      if(h.kind==='icing'){
        // ледяная плёнка — голубоватый прямоугольник на полосе
        const iw=h.runway.w*0.55, ih=h.runway.h*0.7;
        ctx.save();
        rr(h.x-iw/2, h.y-ih/2, iw, ih, 6*ui);
        const pulse=0.45+0.35*Math.abs(Math.sin(tm*0.004));
        ctx.fillStyle=hexa(COL.ice, pulse*0.55); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.ice,.7); ctx.stroke();
        ctx.restore();
        emoji('🧊', h.x, h.y, 18*ui, hexa(COL.ice,.7));
      }
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.ice,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        emoji('🚒', h.x, h.y-32*ui, 14*ui, hexa(COL.ice,.5));
      }
    }
    // деайсинг-грузовики в пути / за работой
    for(const c of crews){
      emoji('🚒', c.x, c.y, 16*ui, hexa(COL.ice,.5));
      if(c.phase==='work'){
        const pulse=Math.abs(Math.sin(tm*0.018));
        ctx.fillStyle=hexa(COL.ice,.5+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
  // тропический биом: штормовые волны на ВПП + насосная бригада
  function drawTropical(tm: number){
    const sv=field.service;
    if(sv){
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#0d2c1e'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.teal,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(COL.teal,.4);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#061a10'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.teal,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('🌊', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(COL.teal,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    for(const h of hazards){
      if(h.kind==='storm_wave'){
        const pulse=0.5+0.35*Math.abs(Math.sin(tm*0.004));
        const iw=h.runway.w*0.6, ih=h.runway.h*0.75;
        ctx.save(); rr(h.x-iw/2, h.y-ih/2, iw, ih, 6*ui);
        ctx.fillStyle=hexa(COL.teal, pulse*0.45); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.teal,.65); ctx.stroke(); ctx.restore();
        emoji('🌊', h.x, h.y, 18*ui);
        // таймер самоликвидации
        const frac=Math.min(1, h.t/TROP.WAVE_LIFE);
        ctx.fillStyle=hexa(COL.teal,.2+.15*(1-frac));
        ctx.fillRect(h.x-12*ui, h.y-ih/2-5*ui, 24*ui*(1-frac), 3*ui);
      }
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.teal,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        emoji('🚛', h.x, h.y-32*ui, 14*ui, hexa(COL.teal,.5));
      }
    }
    for(const c of crews){
      emoji('🚛', c.x, c.y, 16*ui, hexa(COL.teal,.6));
      if(c.phase==='work'){
        const pulse=Math.abs(Math.sin(tm*0.018));
        ctx.fillStyle=hexa(COL.teal,.5+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
  // пустынный биом: песчаные бури на ВПП + пескоочиститель
  function drawDesert(tm: number){
    const SAND='#c8872a';
    const sv=field.service;
    if(sv){
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#2a1a08'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(SAND,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(SAND,.4);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#1a0e04'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(SAND,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('🌪️', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(SAND,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    for(const h of hazards){
      if(h.kind==='sandstorm'){
        const pulse=0.5+0.35*Math.abs(Math.sin(tm*0.005));
        const iw=h.runway.w*0.65, ih=h.runway.h*0.8;
        ctx.save(); rr(h.x-iw/2, h.y-ih/2, iw, ih, 6*ui);
        ctx.fillStyle=hexa(SAND, pulse*0.4); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(SAND,.6); ctx.stroke(); ctx.restore();
        emoji('🌪️', h.x, h.y, 20*ui);
      }
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(SAND,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        emoji('🚛', h.x, h.y-32*ui, 14*ui, hexa(SAND,.5));
      }
    }
    for(const c of crews){
      emoji('🚛', c.x, c.y, 16*ui, hexa(SAND,.5));
      if(c.phase==='work'){
        const pulse=Math.abs(Math.sin(tm*0.018));
        ctx.fillStyle=hexa(SAND,.5+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
  // горный биом: камнепады на ВПП + бульдозер
  function drawMountain(tm: number){
    const ROCK='#7099cc';
    const sv=field.service;
    if(sv){
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#121830'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(ROCK,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(ROCK,.4);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#0a0e1e'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(ROCK,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('⛰️', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(ROCK,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    for(const h of hazards){
      if(h.kind==='rockslide'){
        const iw=h.runway.w*0.45, ih=h.runway.h*0.75;
        ctx.save(); rr(h.x-iw/2, h.y-ih/2, iw, ih, 6*ui);
        const pulse=0.4+0.2*Math.abs(Math.sin(tm*0.003));
        ctx.fillStyle=hexa(ROCK, pulse*0.35); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(ROCK,.6); ctx.stroke(); ctx.restore();
        emoji('🪨', h.x, h.y, 20*ui);
      }
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(ROCK,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        emoji('🚜', h.x, h.y-32*ui, 14*ui, hexa(ROCK,.5));
      }
    }
    for(const c of crews){
      emoji('🚜', c.x, c.y, 16*ui, hexa(ROCK,.5));
      if(c.phase==='work'){
        const pulse=Math.abs(Math.sin(tm*0.018));
        ctx.fillStyle=hexa(ROCK,.5+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
  // биом мегаполиса: VIP-кортежи на ВПП + полицейский эскорт
  function drawCity(tm: number){
    const sv=field.service;
    if(sv){
      rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.fillStyle='#12182a'; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.amber,.6); rr(sv.x,sv.y,sv.w,sv.h,6*ui); ctx.stroke();
      ctx.fillStyle=hexa(COL.amber,.4);
      ctx.beginPath(); ctx.moveTo(sv.x-2*ui,sv.y); ctx.lineTo(sv.x+sv.w/2,sv.y-7*ui); ctx.lineTo(sv.x+sv.w+2*ui,sv.y); ctx.closePath(); ctx.fill();
      const dw=sv.w*0.4, dh=sv.h*0.5;
      rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.fillStyle='#08101e'; ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle=hexa(COL.amber,.5); rr(sv.x+sv.w/2-dw/2, sv.y+sv.h-dh, dw, dh, 3*ui); ctx.stroke();
      emoji('🚔', sv.x+sv.w/2, sv.y+sv.h*0.34, 13*ui);
      ctx.fillStyle=hexa(COL.amber,.8); ctx.font=`${7*ui}px ${MONO}`;
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(t('canvas.service'), sv.x+sv.w/2, sv.y+sv.h+2*ui);
    }
    for(const h of hazards){
      if(h.kind==='vip_motorcade'){
        const pulse=0.5+0.35*Math.abs(Math.sin(tm*0.006));
        const iw=h.runway.w*0.6, ih=h.runway.h*0.7;
        ctx.save(); rr(h.x-iw/2, h.y-ih/2, iw, ih, 6*ui);
        ctx.fillStyle=hexa(COL.amber, pulse*0.35); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=hexa(COL.amber,.6); ctx.stroke(); ctx.restore();
        emoji('🚗', h.x-10*ui, h.y, 14*ui); emoji('🚗', h.x+4*ui, h.y, 14*ui); emoji('🚗', h.x-3*ui, h.y, 14*ui);
        // таймер самоликвидации кортежа
        const frac=Math.min(1, h.t/CITY.MOTORCADE_LIFE);
        ctx.fillStyle=hexa(COL.amber,.2+.1*(1-frac));
        ctx.fillRect(h.x-12*ui, h.y-ih/2-5*ui, 24*ui*(1-frac), 3*ui);
      }
      if(!h.dispatched){
        const pulse=0.5+0.5*Math.abs(Math.sin(tm*0.005));
        ctx.lineWidth=2; ctx.strokeStyle=hexa(COL.amber,.3+0.4*pulse);
        ctx.beginPath(); ctx.arc(h.x, h.y, (24+4*pulse)*ui, 0, 7); ctx.stroke();
        emoji('🚔', h.x, h.y-32*ui, 14*ui, hexa(COL.amber,.5));
      }
    }
    for(const c of crews){
      emoji('🚔', c.x, c.y, 16*ui, hexa(COL.amber,.6));
      if(c.phase==='work'){
        const pulse=Math.abs(Math.sin(tm*0.025));
        ctx.fillStyle=hexa(COL.amber,.5+0.4*pulse);
        ctx.beginPath(); ctx.arc(c.x+8*ui, c.y-6*ui, 2*ui*(1+pulse), 0, 7); ctx.fill();
      }
    }
  }
