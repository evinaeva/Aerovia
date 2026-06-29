// ===== 06-state-layout — all mutable game state, the save shape, canvas/field metrics & bay/runway layout =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: save, planes, bays, runways, money, lives, served, gameTime, field, W/H/SZ, VERSION, layout, resize, debug, currentMode, addFloat, calcSafetyRects, … (the shared state).
// Reads: 01 (cv, ctx); 04 (LV, curBiome, curBonus, levelName, bonusName); 03 (t, lang); 04b (MT_META_VALUES — for safe-zone params).

  let levelIdx = 0, levelKey: number | string = 0, levelPassed = false, upgradesDone = 0;
  // levelKey — ключ сохранения текущей карты: число для кампании (совместимо со
  // старыми сейвами), строка вида 'b_forest' для биом-карт (свои звёзды/рекорды).
  function currentLevelName(){
    if(LV.bonus) return curBonus ? bonusName(curBonus) : t('bonus.name', {n:''});
    if(LV.biome) return t('biome.'+LV.biome+'.name');
    return levelName();      // кампания: красивое имя уровня (level.t.<n>) с фолбэком
  }
  let combo = 0, runCrashes = 0, runPenalties = 0;   // серия / счётчики чистоты прохождения
  let rushUntil = 0, nextRush = 0;                    // «час пик»
  let windUntil = 0, nextWind = 0;                    // смена ветра (закрытие ВПП)
  let fogUntil = 0, nextFog = 0;                      // туман
  let weather = 'clear', weatherUntil = 0, nextWeather = 0; // погода: clear|rain|snow
  let dayPhase = 0, nightAmount = 0;                  // «часы» суток (логика; рендер читает)
  let survival = false;                               // survival (на картах): режим с условием смерти, счёт за заход → в глобальный рейтинг
  // единый источник истины о текущем режиме (логика, не контент): survival/biome/bonus/campaign.
  // Раньше режим вычислялся инлайн-тернарником в нескольких местах — теперь одна функция (см. CLAUDE.md).
  function currentMode(){ return survival ? 'survival' : (curBiome ? 'biome' : (curBonus ? 'bonus' : 'campaign')); }
  // Persisted player data — the save shape. This is the typed contract every
  // module reads through, so a renamed/typo'd field (e.g. `save.unlocked`)
  // becomes a compile error anywhere it's used.
  interface Save {
    unlocked: number;
    best: Record<string, number>;
    stars: Record<string, number>;
    lang: string | null;
    ach: string[];
    stats: Record<string, number>;
    sound: boolean;
    vibro: boolean;
    eco: boolean;
    tutorialDone: boolean;
  }
  let save: Save = {unlocked:1, best:{}, stars:{}, lang:null, ach:[], stats:{}, sound:true, vibro:true, eco:false, tutorialDone:false};
  // LEGACY_SAVE_KEY: до переименования в PlaneFlow сейв жил под старым ключом —
  // читаем его как фолбэк, чтобы прогресс игроков не сгорел (см. loadGame)
  const SAVE_KEY = 'planeflow_save_v1', LEGACY_SAVE_KEY = 'tower_save_v1', VERSION = '__GAME_VERSION__';

  // ---- canvas sizing ----
  let W=0, H=0, dpr=1, ui=1;
  // отступы безопасной зоны (вырез/скругления телефона). Читаем реальные px с
  // невидимого пробника, у которого padding = env(safe-area-inset-*) — так HUD и
  // кнопка паузы не залезают под бортик экрана (viewport-fit=cover включён).
  let safe={t:0,r:0,b:0,l:0}, safeProbe: HTMLDivElement | null = null;
  function readSafe(){
    if(!safeProbe){
      safeProbe=document.createElement('div');
      safeProbe.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;'+
        'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(safeProbe);
    }
    const cs=getComputedStyle(safeProbe);
    safe={t:parseFloat(cs.paddingTop)||0, r:parseFloat(cs.paddingRight)||0,
          b:parseFloat(cs.paddingBottom)||0, l:parseFloat(cs.paddingLeft)||0};
  }
  // HUD PNG — 640×67; рисуется по центру шириной 50% W → высота = W/2 * 67/640 = W*67/1280
  // высота HUD-полосы сверху; уровень с layout.noHud скрывает HUD и не резервирует место
  const HUD_H = () => (LV && LV.layout && LV.layout.noHud) ? 0 : Math.round(W * 67 / 1280);
  function resize(){
    dpr = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W*dpr; cv.height = H*dpr;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ui = Math.max(0.7, Math.min(1.5, Math.min(W/1100, H/620)));
    readSafe();
    layout();
    fitOverlays();
  }
  window.addEventListener('resize', resize);

  // ---- авто-подгон панелей меню под экран телефона ----
  // Любой оверлей (меню, пауза, итог, настройки…) ужимается до размеров вьюпорта,
  // если его панель выше/шире экрана — так меню перестаёт скроллиться на телефоне.
  function fitOverlays(){
    const vw = window.innerWidth, vh = window.innerHeight, margin = 10;
    document.querySelectorAll('.overlay').forEach(ov=>{
      const panel = ov.querySelector('.panel') as HTMLElement | null;
      if(!panel) return;
      panel.style.transform=''; // сброс перед замером натуральных размеров
      if(ov.classList.contains('hidden')) return;
      const r = panel.getBoundingClientRect();
      const s = Math.min(1, (vh-margin)/r.height, (vw-margin)/r.width);
      if(s < 0.999) panel.style.transform = 'scale('+s+')';
    });
  }
  // пере-подгон при смене видимости оверлея (show/hide меняют класс hidden)
  if(typeof MutationObserver==='function'){
    const _ovFit = new MutationObserver(()=>requestAnimationFrame(fitOverlays));
    document.querySelectorAll('.overlay').forEach(ov=>_ovFit.observe(ov,{attributes:true,attributeFilter:['class']}));
  }

  // ---- layout: bays, runways, hover slots ----
  interface Bay { side: string; type: string; slot: number; open: boolean; open0?: boolean; lvl: number; occupied: any; x: number; y: number; w: number; h: number; deice?: boolean; up?: boolean; gate?: string; gx?: number; gy?: number; openCost: number; upgCost?: number; }
  interface Runway { occupied: any; closed: boolean; hazard?: any; x: number; y: number; w: number; h: number; cy: number; stopX: number; exitX: number; landingOpen: boolean; takeoffOpen: boolean; landingOpen0: boolean; takeoffOpen0: boolean; landingCost: number; takeoffCost: number; }
  interface Field { x0: number; y0: number; x1: number; y1: number; hoverX?: number; arrivalY0?: number; arrivalY1?: number; arrivalX0?: number; arrivalX1?: number; rwL?: number; rwR?: number; service?: any; }
  interface Rect { x: number; y: number; w: number; h: number; }
  let bays: Bay[] = [], runways: Runway[] = [], field: Field = {x0:0,y0:0,x1:0,y1:0}, pauseBtn: Rect = {} as Rect;
  // Единый масштаб «крупности» техники: размеры борта, ВПП и бокса выводятся из него
  // ОДНОЙ общей формулой (общая для всех скинов — меняется лишь число). Само число —
  // визуальный масштаб техники (×1; геометрия выводится из него одной формулой).
  const SZ = () => K.PLANE_SCALE;
  // длина корпуса борта (наземная), px — геометрия касания/отрыва на ВПП. Совпадает
  // с размером отрисовки drawPlaneBodyAt (62 · ui·0.5·SZ()) при наземном масштабе.
  const PLANE_LEN = () => 31 * SZ() * ui;
  function layout(){
    const hud = HUD_H();
    const M = 12*ui;
    // полоса под инфо-бар нужды борта (drawPlaneCard) между HUD и апроном — как
    // зарезервированная лента в макете (PlaneCard на y100); верхняя ангара садится под неё
    // Положение апрона по умолчанию (из тюнинга, доли экрана).
    // LV.layout.apron переопределяет для уровней конструктора.
    const _defAp = { x:0.0689, y:0.1329, w:0.6177, h:0.7877 };
    let fx0 = 0, fy0 = 0, fx1 = 0, fy1 = 0;
    { const ap = (LV.layout && LV.layout.apron) || _defAp;
      fx0 = ap.x*W; fx1 = (ap.x+ap.w)*W; fy0 = Math.max(hud+M, ap.y*H); fy1 = (ap.y+ap.h)*H; }
    field = {x0:fx0, y0:fy0, x1:fx1, y1:fy1};

    // ангар — КВАДРАТНЫЙ: сторона выводится из длины борта через K.HANGAR_RATIO,
    // поэтому масштаб борта (K.PLANE_SCALE) автоматически масштабирует ангары на
    // всех картах. Верхний предел — чтобы ангар не съедал апрон на узких полях.
    const bw = Math.min(PLANE_LEN()*K.HANGAR_RATIO, (fx1-fx0)/2.4);
    const bh = bw;   // квадрат

    // build bays once (preserve open/level state across resize)
    // НЕОН-КОМПОЗИЦИЯ (handoff, docs/design/skins/neon/handoff/): боксы всех услуг
    // раскладываются в ДВЕ сквозные ангары — вдоль верхней и нижней кромок апрона.
    // Левой рейки нет; услуги (fuel/board/repair) ЧЕРЕДУЮТСЯ между ангарами. Это
    // ОБЩАЯ раскладка (одинакова для всех скинов).
    if(!bays.length){
      bays = [];
      if(LV.layout && LV.layout.hangars){
        // КОНСТРУКТОР: один ангар = одно место. (gx,gy) — доля апрона; пиксели ставятся
        // ниже. open/up/gate — по конфигу (gate авто-выводится при раскладке, если опущен).
        LV.layout.hangars.forEach((hg,i)=>{
          const open = hg.open!==false;
          bays.push({ side:'free', type:hg.type, slot:i, open, open0:open,
                      up:hg.up!==false, gate:hg.gate, gx:hg.x, gy:hg.y,
                      openCost: hg.openCost ?? K.BAY_OPEN_COST,
                      upgCost: hg.upgCost,
                      lvl:0, occupied:null, x:0,y:0,w:bw,h:bh });
        });
      } else {
        // СТАРАЯ РАСКЛАДКА: слоты сторон → плоский список, чередуем верх/низ, встык в две ангары.
        const all: { type: string; open: boolean }[] = [];
        const sides = (LV.sides || {}) as Record<string, SideCfg>;
        for(const side of ['top','left','bottom']){
          const cfg = sides[side]; if(!cfg) continue;
          for(let i=0;i<cfg.slots;i++) all.push({type:cfg.type, open:i<cfg.open});
        }
        all.forEach((b,i)=>{
          bays.push({ side:(i%2===0?'top':'bottom'), type:b.type, slot:i,
                      open:b.open, open0:b.open,
                      openCost: K.BAY_OPEN_COST, upgCost: undefined,
                      lvl:0, occupied:null, x:0,y:0,w:bw,h:bh });
        });
      }
      // отдельный бокс де-айсинга (инфраструктура: всегда открыт, без апгрейда) —
      // у правого края поля, ворота в поле; нужен только в снегопад (см. spawnPlane).
      // При K.DISABLE_DEICE деайсинг не запрашивается, поэтому и бокс не ставим —
      // иначе на поле висит неиспользуемая инфраструктура.
      if(LV.deice && !K.DISABLE_DEICE) bays.push({side:'deice', type:'deice', slot:0, deice:true,
                              open:true, openCost:0, lvl:0, occupied:null, x:0,y:0,w:bw,h:bh});
    }
    // position bays
    const bySide = (s: string) => bays.filter(b=>b.side===s);
    const hangH = bh;   // квадратный ангар: высота = ширине (bw из K.HANGAR_RATIO)
    if(LV.layout){
      // КОНСТРУКТОР: ставим каждый ангар по его нормированной позиции; ворота — к открытому
      // полю (ближайшая кромка апрона), если не заданы. side выводим из gate, чтобы
      // неон-рендер вертикальных ангаров (верх/низ) рисовался правильно; горизонтальные
      // ворота (left/right) рисуются процедурным боксом (drawBay → bayWalls по dirOut).
      bays.filter(b=>b.side==='free' || b.gx!=null).forEach(b=>{
        const cx = fx0 + (b.gx||0)*(fx1-fx0), cy = fy0 + (b.gy||0)*(fy1-fy0);
        b.w = bw; b.h = hangH;
        if(!b.gate){
          const dT=cy-fy0, dB=fy1-cy, dL=cx-fx0, dR=fx1-cx, m=Math.min(dT,dB,dL,dR);
          b.gate = m===dT?'down' : m===dB?'up' : m===dL?'right' : 'left';
        }
        b.side = b.gate==='down' ? 'top' : b.gate==='up' ? 'bottom' : 'free';
        // ангар снаружи апрона: ворота вровень с кромкой апрона
        if(b.gate==='down')       { b.x=Math.max(fx0,Math.min(fx1-b.w,cx-b.w/2)); b.y=fy0-b.h; }
        else if(b.gate==='up')    { b.x=Math.max(fx0,Math.min(fx1-b.w,cx-b.w/2)); b.y=fy1; }
        else if(b.gate==='right') { b.x=fx0-b.w; b.y=Math.max(fy0,Math.min(fy1-b.h,cy-b.h/2)); }
        else                      { b.x=fx1;     b.y=Math.max(fy0,Math.min(fy1-b.h,cy-b.h/2)); }
      });
    } else {
      // СТАРАЯ РАСКЛАДКА: две сплошные ангары — стойла встык по всей ширине апрона.
      // Правая граница — fx1-8*ui (rwL): ВПП заходит на 8*ui внутрь апрона (мостик),
      // боксы не должны попадать в эту зону мостика.
      const bayRight = fx1 - 8*ui;
      const packRow = (arr: Bay[], yTop: number) => {
        const n=arr.length; if(!n) return;
        const cellW=(bayRight-fx0)/n;
        arr.forEach((b,i)=>{ b.w=cellW; b.h=hangH; b.x=fx0+i*cellW; b.y=yTop; });
      };
      packRow(bySide('top'), fy0 - hangH);
      packRow(bySide('bottom'), fy1);
    }
    // де-айс-бокс — у правого края поля, по центру по вертикали
    const de = bays.find(b=>b.side==='deice');
    if(de){ de.w=bw; de.h=bh; de.x=fx1-bw; de.y=(fy0+fy1)/2-bh/2; }

    // runways on right
    // полевой торец ВПП заходит на самую кромку апрона → «мост» апрон→небо (полосы не
    // висят в пустоте); длина ВПП ≈0.21W (макет 318/1600≈0.20W), правый край = K.RUNWAY_R×W
    // RUNWAY_R/RUNWAY_RATIO можно переопределить пер-уровнем (LV.layout.runwayR/runwayRatio)
    const rwR_ratio = (LV.layout && LV.layout.runwayR != null) ? LV.layout.runwayR : K.RUNWAY_R;
    const rw_ratio  = (LV.layout && LV.layout.runwayRatio != null) ? LV.layout.runwayRatio : K.RUNWAY_RATIO;
    const rwL = fx1 - 8*ui, rwR = W * rwR_ratio;
    const top0 = hud + M, bot0 = H - M;
    // ширина ВПП выводится из длины борта через RUNWAY_RATIO — масштаб борта
    // (K.PLANE_SCALE) масштабирует полосы на всех картах; просвет — доля ширины ВПП.
    const rh = PLANE_LEN()*rw_ratio;  // ширина ВПП ≈ длина борта × коэф
    const gap = rh*0.37;                    // просвет между полосами ~ доля ширины ВПП
    // центры полос по вертикали: КОНСТРУКТОР — по нормированному y каждой ВПП; иначе —
    // n полос симметрично по центру (старая неон-композиция, центральная не пропускается).
    let cys: number[];
    if(LV.layout && LV.layout.runways){
      if(LV.layout.fitRunways){
        // ВПП раскладываются РОВНО внутри апрона С УЧЁТОМ их ширины (rh): верхний край 1-й =
        // кромка апрона (fy0), нижний край последней = fy1. Нижняя ВПП не вылезает за апрон ни
        // на каком экране/телефоне (фикс. доли rd.y «плыли» из-за ui). Важно лишь ЧИСЛО ВПП.
        const n = LV.layout.runways.length;
        const a = fy0 + rh/2, b = fy1 - rh/2, mid = (fy0+fy1)/2;
        cys = (n<=1 || b<=a) ? LV.layout.runways.map(()=>mid)
                             : LV.layout.runways.map((_,i)=> a + (b-a)*i/(n-1));
      } else {
        // rd.y = доля высоты апрона (как в редакторе «Разметка»), не экрана
        cys = LV.layout.runways.map(rd => Math.max(top0+rh/2, Math.min(bot0-rh/2, fy0 + rd.y*(fy1-fy0))));
      }
    } else {
      const n = Math.max(1, LV.runways || 1);
      const rwY0 = top0 + Math.max(0, ((bot0-top0) - (rh*n + gap*(n-1))) / 2);
      cys = []; for(let i=0;i<n;i++) cys.push(rwY0 + i*(rh+gap) + rh/2);
    }
    if(!runways.length || runways.length!==cys.length){
      const rdefs = (LV.layout && LV.layout.runways) ? LV.layout.runways : [];
      runways = cys.map((_,k)=>{
        const rd = rdefs[k];
        const lo = rd ? (rd.landingOpen!==false) : true;
        const to = rd ? (rd.takeoffOpen!==false) : true;
        return { occupied:null, closed:false, x:0, y:0, w:0, h:0, cy:0, stopX:0, exitX:0,
                 landingOpen:lo, takeoffOpen:to, landingOpen0:lo, takeoffOpen0:to,
                 landingCost: rd ? (rd.landingCost??0) : 0,
                 takeoffCost: rd ? (rd.takeoffCost??0) : 0 };
      });
    }
    cys.forEach((cy,k)=>{
      const r=runways[k];
      r.x=rwL; r.y=cy - rh/2; r.w=rwR-rwL; r.h=rh; r.cy=cy;
      r.stopX = rwL + 26*ui;   // куда докатывается севший борт (полевой край)
      r.exitX = rwR + 10*ui;   // правый (водный) край
    });
    // hover x для прилетающих
    field.hoverX = rwR + W*0.09;  // зона ожидания: 9% экрана правее торца ВПП
    field.arrivalY0 = undefined; field.arrivalY1 = undefined;
    field.arrivalX0 = undefined; field.arrivalX1 = undefined;
    { const az = LV.layout && LV.layout.zones && LV.layout.zones.arrival;
      if(az){
        field.hoverX = (az.x + az.w/2) * W;
        field.arrivalY0 = az.y * H;
        field.arrivalY1 = (az.y + az.h) * H;
        field.arrivalX0 = az.x * W;             // X-границы — для отрисовки скина прилёта (09)
        field.arrivalX1 = (az.x + az.w) * W;
      }
    }
    field.rwL = rwL; field.rwR = rwR;

    // кнопка паузы отодвинута от правого края на запас + safe-area, чтобы не
    // оказаться под скруглением/вырезом телефона и нормально нажиматься
    if(LV.layout && LV.layout.noHud){
      // noHud (кастом-уровень / чистая композиция): HUD-кнопки паузы нет, поэтому
      // ставим отдельную круглую кнопку в ЗАВЕДОМО не-интерактивный верх-левый угол.
      // Борты прилетают справа и садятся в полосы; апрон/ангары — центр и право —
      // сюда не доходят ни тапы по технике, ни траектории. Учтён safe-area выреза.
      const d=44*ui;
      pauseBtn = {x: safe.l + 12*ui, y: safe.t + 12*ui, w:d, h:d};
    } else {
      pauseBtn = {x: W - safe.r - 16*ui - 36*ui, y: safe.t + 6*ui, w: 36*ui, h: 30*ui};
    }

    // сервисное здание биом-карт — сверху по центру апрона, между верхними боксами;
    // отсюда выезжают спец-бригады. У классических уровней его нет.
    if(LV.biome){
      const sw=Math.min(88*ui, (field.x1-field.x0)*0.32), sh=28*ui;
      field.service={ x:(field.x0+field.x1)/2 - sw/2, y:fy0+2*ui, w:sw, h:sh };
    } else field.service=null;
  }

  // ---- safety rects ----
  interface SafetyRects {
    viewportRect: Rect;
    safeAreaInsets: { t: number; r: number; b: number; l: number };
    cutoutRect: Rect;
    gestureInsets: { t: number; r: number; b: number; l: number };
    uiReservedRects: Array<Rect & { label: string }>;
    decorativeOnlyRects: Array<Rect & { label: string }>;
    contentSafeRect: Rect;
    interactiveSafeRect: Rect;
    routeStartAllowedRect: Rect;
    routeDrawAllowedRect: Rect;
    routeTargetAllowedRect: Rect;
    cssReadSafe: { t: number; r: number; b: number; l: number };
  }

  // Computes all safety/gesture/cutout rects from current viewport and MT_META_VALUES.
  // Does NOT change any gameplay — read-only view of what zones exist.
  // Called by __FIELD.safetyRects in 13-init.js for Workbench overlay.
  function calcSafetyRects(): SafetyRects {
    function n(key: string, def: number): number {
      const v = MT_META_VALUES[key]; return typeof v === 'number' ? v : def;
    }
    function s(key: string, def: string): string {
      const v = MT_META_VALUES[key]; return typeof v === 'string' ? v : def;
    }

    // Manual safe-area insets; 0 means fall back to CSS env()-probe value
    const saT = n('SA_INSET_TOP',    0) || safe.t;
    const saR = n('SA_INSET_RIGHT',  0) || safe.r;
    const saB = n('SA_INSET_BOTTOM', 0) || safe.b;
    const saL = n('SA_INSET_LEFT',   0) || safe.l;

    // Camera / notch cutout
    const cutSide   = s('SA_CUTOUT_SIDE', 'none');
    const cutW      = n('SA_CUTOUT_W', 28);
    const cutH      = n('SA_CUTOUT_H', 90);
    const cutOffset = n('SA_CUTOUT_OFFSET', 0);

    let cutoutRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    if (cutSide === 'left')  cutoutRect = { x: 0,       y: cutOffset, w: cutW, h: cutH };
    if (cutSide === 'right') cutoutRect = { x: W - cutW, y: cutOffset, w: cutW, h: cutH };
    if (cutSide === 'top')   cutoutRect = { x: cutOffset, y: 0,       w: cutH, h: cutW };

    // Cutout inflates the corresponding safe inset
    const effSaL = cutSide === 'left'  ? Math.max(saL, cutW) : saL;
    const effSaR = cutSide === 'right' ? Math.max(saR, cutW) : saR;
    const effSaT = cutSide === 'top'   ? Math.max(saT, cutW) : saT;

    // Android gesture exclusion zones
    const gestL = n('SA_GESTURE_LEFT',   24);
    const gestR = n('SA_GESTURE_RIGHT',  24);
    const gestT = n('SA_GESTURE_TOP',    0);
    const gestB = n('SA_GESTURE_BOTTOM', 24);

    // Per-zone padding addons
    const routeStartPad  = n('SA_ROUTE_START_PAD',  32);
    const routeDrawPad   = n('SA_ROUTE_DRAW_PAD',   0);
    const routeTargetPad = n('SA_ROUTE_TARGET_PAD', 16);
    const contentPad     = n('SA_CONTENT_PAD',      0);
    const interactivePad = n('SA_INTERACTIVE_PAD',  0);

    const viewportRect: Rect = { x: 0, y: 0, w: W, h: H };

    // contentSafeRect: viewport minus effective safe-area insets
    const contentSafeRect: Rect = {
      x: effSaL + contentPad, y: effSaT + contentPad,
      w: W - effSaL - effSaR - 2 * contentPad,
      h: H - effSaT - saB    - 2 * contentPad,
    };

    // interactiveSafeRect: safe-area AND gesture exclusion
    const iL = Math.max(effSaL, gestL) + interactivePad;
    const iR = Math.max(effSaR, gestR) + interactivePad;
    const iT = Math.max(effSaT, gestT) + interactivePad;
    const iB = Math.max(saB,   gestB)  + interactivePad;
    const interactiveSafeRect: Rect = { x: iL, y: iT, w: W - iL - iR, h: H - iT - iB };

    // routeStartAllowedRect (strictest — player must not begin drag near edges)
    const rsL = Math.max(effSaL, gestL) + routeStartPad;
    const rsR = Math.max(effSaR, gestR) + routeStartPad;
    const rsT = Math.max(effSaT, gestT) + routeStartPad;
    const rsB = Math.max(saB,   gestB)  + routeStartPad;
    const routeStartAllowedRect: Rect = { x: rsL, y: rsT, w: W - rsL - rsR, h: H - rsT - rsB };

    // routeDrawAllowedRect (looser — continuing drag can approach closer to edge)
    const rdL = Math.max(effSaL, gestL) + routeDrawPad;
    const rdR = Math.max(effSaR, gestR) + routeDrawPad;
    const rdT = Math.max(effSaT, gestT) + routeDrawPad;
    const rdB = Math.max(saB,   gestB)  + routeDrawPad;
    const routeDrawAllowedRect: Rect = { x: rdL, y: rdT, w: W - rdL - rdR, h: H - rdT - rdB };

    // routeTargetAllowedRect (snap points — runways, bays)
    const rtL = Math.max(effSaL, gestL) + routeTargetPad;
    const rtR = Math.max(effSaR, gestR) + routeTargetPad;
    const rtT = Math.max(effSaT, gestT) + routeTargetPad;
    const rtB = Math.max(saB,   gestB)  + routeTargetPad;
    const routeTargetAllowedRect: Rect = { x: rtL, y: rtT, w: W - rtL - rtR, h: H - rtT - rtB };

    const uiReservedRects: Array<Rect & { label: string }> = [
      { label: 'HUD',       x: 0, y: 0, w: W, h: HUD_H() + Math.max(effSaT, gestT) },
      { label: 'PauseBtn',  x: pauseBtn.x, y: pauseBtn.y, w: pauseBtn.w, h: pauseBtn.h },
    ];

    const decorativeOnlyRects: Array<Rect & { label: string }> = [];
    if (effSaL > 0) decorativeOnlyRects.push({ label: 'safe-left',   x: 0,          y: 0,          w: effSaL, h: H      });
    if (effSaR > 0) decorativeOnlyRects.push({ label: 'safe-right',  x: W - effSaR, y: 0,          w: effSaR, h: H      });
    if (effSaT > 0) decorativeOnlyRects.push({ label: 'safe-top',    x: 0,          y: 0,          w: W,      h: effSaT });
    if (saB    > 0) decorativeOnlyRects.push({ label: 'safe-bottom', x: 0,          y: H - saB,    w: W,      h: saB    });

    return {
      viewportRect,
      safeAreaInsets:  { t: effSaT, r: effSaR, b: saB,  l: effSaL },
      cutoutRect,
      gestureInsets:   { t: gestT,  r: gestR,  b: gestB, l: gestL  },
      uiReservedRects,
      decorativeOnlyRects,
      contentSafeRect,
      interactiveSafeRect,
      routeStartAllowedRect,
      routeDrawAllowedRect,
      routeTargetAllowedRect,
      cssReadSafe: { t: safe.t, r: safe.r, b: safe.b, l: safe.l },
    };
  }

  // ---- game state ----
  let planes: any[] = [], money=0, lives=0, served=0, gameTime=0;
  let running=false, paused=false, lastTs=0, spawnTimer=0, spawnedTotal=0;
  // статистика смены для экрана итога: пик одновременной нагрузки + временной ряд
  // (нагрузка/принято) для графика; lastShift — снимок последней смены для шеринга
  let statPeak=0, statSamples: any[]=[], statStep=1.5, statNextAt=0, lastShift: any=null;
  let inMenu=true;         // пока открыты меню/уровни/медали — на канвасе сцена-радар, не поле
  let nowT=0;              // время кадра (мс) для анимаций отрисовки
  let effects: any[]=[];          // анимации крушений
  let lossLog: any[]=[], toast: any=null;
  const debug={infiniteLives:false, richStart:false, unlockAll:false, profiler:false};
  // Кастом-уровень (кнопка «Свой уровень») — песочница/демо, не кампания: счёт не
  // двигает прогресс (levelKey==='custom'), поэтому играется с БЕСКОНЕЧНЫМИ жизнями
  // (борт не теряется при крушении/таймауте). Чит «∞ жизни» из отладки — тоже сюда.
  function livesInfinite(){ return debug.infiniteLives || levelKey==='custom'; }
  const BIG_MONEY=999999;
  // отладочные читы сохраняются отдельным ключом и восстанавливаются при перезаходе
  const DEBUG_KEY='pf_debug';
  function loadDebug(){ try{ const d=JSON.parse(localStorage.getItem(DEBUG_KEY) || 'null'); if(d&&typeof d==='object'){ debug.infiniteLives=!!d.infiniteLives; debug.richStart=!!d.richStart; debug.unlockAll=!!d.unlockAll; debug.profiler=!!d.profiler; } }catch(e){} }
  function saveDebug(){ try{ localStorage.setItem(DEBUG_KEY, JSON.stringify({infiniteLives:debug.infiniteLives, richStart:debug.richStart, unlockAll:debug.unlockAll, profiler:debug.profiler})); }catch(e){} }
  function syncDebugUI(){ const a=document.getElementById('optLives') as HTMLInputElement|null, b=document.getElementById('optMoney') as HTMLInputElement|null, c=document.getElementById('optUnlockAll') as HTMLInputElement|null, d=document.getElementById('optProfiler') as HTMLInputElement|null; if(a)a.checked=debug.infiniteLives; if(b)b.checked=debug.richStart; if(c)c.checked=debug.unlockAll; if(d)d.checked=debug.profiler; }
  let floaters: any[]=[];         // плавающие награды «+N ₿» / «×N комбо» / «уфф!» над полем
  let alarmAt=0;           // антидребезг тревожного бипа терпения
  let slowmo=0;            // секунды лёгкого замедления времени (near-miss)
  let nearMissPairs: Record<string, any>={};    // key «idA-idB» → время, до которого пара «остыла»
  let planeSeq=0;          // id бортов для антидребезга near-miss
  let depotPlane: any=null; // демо K.APRON_SPAWN: текущий готовый борт у левого края апрона
  let tut: any=null;            // состояние тихого туториала: {step:'land'|'service'|'takeoff', plane}
  // лесной биом: активные помехи на полосах + выехавшие бригады + таймер спавна
  let hazards: any[]=[], crews: any[]=[], hazardSeq=0, nextHazard=0;
  function addFloat(x: number, y: number, text: string, col: string){ floaters.push({x,y,text,col,t:0,life:1.15}); }

  // ---- звук и вибрация (идеи из копилки: раздел 1) ----
  // Весь звук — синтез Web Audio, без файлов: события игры рождают мягкие ноты
  // одной гаммы (пентатоника ля-минор), краш — шумовой удар. Контекст создаётся
  // по первому жесту (autoplay-политика). Звук необязателен: всё дублируется
  // визуалом, выключатели — в настройках паузы (save.sound / save.vibro).
