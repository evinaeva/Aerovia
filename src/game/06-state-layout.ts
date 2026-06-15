  let levelIdx = 0, levelKey = 0, levelPassed = false, upgradesDone = 0;
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
  // Persisted player data — the save shape. Typed even while the rest of this
  // module is still @ts-nocheck, so other modules get checked against it (e.g.
  // a renamed/typo'd `save.unlocked` becomes a compile error).
  interface Save {
    unlocked: number;
    best: Record<string, number>;
    stars: Record<string, number>;
    lang: string | null;
    ach: string[];
    stats: Record<string, number>;
    sound: boolean;
    vibro: boolean;
    tutorialDone: boolean;
  }
  let save: Save = {unlocked:1, best:{}, stars:{}, lang:null, ach:[], stats:{}, sound:true, vibro:true, tutorialDone:false};
  // LEGACY_SAVE_KEY: до переименования в PlaneFlow сейв жил под старым ключом —
  // читаем его как фолбэк, чтобы прогресс игроков не сгорел (см. loadGame)
  const SAVE_KEY = 'planeflow_save_v1', LEGACY_SAVE_KEY = 'tower_save_v1', VERSION = '0.26';

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
  const HUD_H = () => Math.round(44*ui);
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
  interface Bay { side: string; type: string; slot: number; open: boolean; open0?: boolean; lvl: number; occupied: any; x: number; y: number; w: number; h: number; deice?: boolean; }
  interface Runway { occupied: any; closed: boolean; x?: number; y?: number; w?: number; h?: number; cy?: number; stopX?: number; exitX?: number; }
  interface Field { x0: number; y0: number; x1: number; y1: number; hoverX?: number; rwL?: number; rwR?: number; service?: any; }
  interface Rect { x: number; y: number; w: number; h: number; }
  let bays: Bay[] = [], runways: Runway[] = [], field: Field = {x0:0,y0:0,x1:0,y1:0}, pauseBtn: Rect = {} as Rect;
  // Единый масштаб «крупности» техники: размеры борта, ВПП и бокса выводятся из него
  // ОДНОЙ общей формулой (общая для всех скинов — меняется лишь число). Само число —
  // визуальный масштаб техники (×1; геометрия выводится из него одной формулой).
  const SZ = () => 1;
  // длина корпуса борта (наземная), px — геометрия касания/отрыва на ВПП. Совпадает
  // с размером отрисовки drawPlaneBodyAt (62 · ui·0.5·SZ()) при наземном масштабе.
  const PLANE_LEN = () => 31 * SZ() * ui;
  function layout(){
    const hud = HUD_H();
    const M = 12*ui;
    // field taxi area (left ~60%); runways on right
    const fx0 = M, fy0 = hud + M;
    const fx1 = W*0.58, fy1 = H - M;
    field = {x0:fx0, y0:fy0, x1:fx1, y1:fy1};

    const bw = Math.min(56*ui*SZ(), (fx1-fx0)/2.4);
    const bh = bw*0.72;

    // build bays once (preserve open/level state across resize)
    // НЕОН-КОМПОЗИЦИЯ (handoff, docs/design/skins/neon/handoff/): боксы всех услуг
    // раскладываются в ДВЕ сквозные ангары — вдоль верхней и нижней кромок апрона.
    // Левой рейки нет; услуги (fuel/board/repair) ЧЕРЕДУЮТСЯ между ангарами. Это
    // ОБЩАЯ раскладка (одинакова для всех скинов).
    if(!bays.length){
      bays = [];
      const all: { type: string; open: boolean }[] = [];
      for(const side of ['top','left','bottom']){
        const cfg = (LV.sides as Record<string, SideCfg>)[side];
        for(let i=0;i<cfg.slots;i++) all.push({type:cfg.type, open:i<cfg.open});
      }
      all.forEach((b,i)=>{
        bays.push({ side:(i%2===0?'top':'bottom'), type:b.type, slot:i,
                    open:b.open, open0:b.open, lvl:0, occupied:null, x:0,y:0,w:bw,h:bh });
      });
      // отдельный бокс де-айсинга (инфраструктура: всегда открыт, без апгрейда) —
      // у правого края поля, ворота в поле; нужен только в снегопад (см. spawnPlane)
      if(LV.deice) bays.push({side:'deice', type:'deice', slot:0, deice:true,
                              open:true, lvl:0, occupied:null, x:0,y:0,w:bw,h:bh});
    }
    // position bays — две сплошные ангары: стойла встык по всей ширине апрона
    const bySide = (s: string) => bays.filter(b=>b.side===s);
    const hangH = Math.max(bh, Math.round((fy1-fy0)*0.13));   // ангара чуть выше под стойло-проезд
    function packRow(arr: Bay[], yTop: number){
      const n=arr.length; if(!n) return;
      const cellW=(fx1-fx0)/n;
      arr.forEach((b,i)=>{ b.w=cellW; b.h=hangH; b.x=fx0+i*cellW; b.y=yTop; });
    }
    packRow(bySide('top'), fy0);
    packRow(bySide('bottom'), fy1-hangH);
    // де-айс-бокс — у правого края поля, по центру по вертикали
    const de = bays.find(b=>b.side==='deice');
    if(de){ de.w=bw; de.h=bh; de.x=fx1-bw; de.y=(fy0+fy1)/2-bh/2; }

    // runways on right
    const rwL = W*0.60, rwR = W*0.85;
    const n = LV.runways;
    const top0 = hud + M, bot0 = H - M;
    const gap = 14*ui*SZ();                 // просвет между полосами (растёт вместе с ВПП)
    const rh = 38*ui*SZ();                  // ширина ВПП привязана к SZ() (≈ размах борта)
    const rwY0 = top0 + Math.max(0, ((bot0-top0) - (rh*n + gap*(n-1))) / 2); // центрируем n-слотов по вертикали
    // НЕОН-КОМПОЗИЦИЯ: показываем ВСЕ n ВПП вертикально-симметрично (центральная
    // больше не пропускается) — см. docs/design/skins/neon/handoff/
    const slots = []; for(let i=0;i<n;i++) slots.push(i);
    if(!runways.length || runways.length!==slots.length){
      runways = slots.map(()=>({occupied:null, closed:false}));
    }
    slots.forEach((slotIdx,k)=>{
      const r=runways[k];
      r.x=rwL; r.y=rwY0 + slotIdx*(rh+gap); r.w=rwR-rwL; r.h=rh;
      r.cy = r.y + r.h/2;
      r.stopX = rwL + 26*ui;   // куда докатывается севший борт (полевой край)
      r.exitX = rwR + 10*ui;   // правый (водный) край
    });
    // hover x для прилетающих
    field.hoverX = W*0.93;
    field.rwL = rwL; field.rwR = rwR;

    // кнопка паузы отодвинута от правого края на запас + safe-area, чтобы не
    // оказаться под скруглением/вырезом телефона и нормально нажиматься
    pauseBtn = {x: W - safe.r - 16*ui - 36*ui, y: 6*ui, w: 36*ui, h: 30*ui};

    // сервисное здание биом-карт — сверху по центру апрона, между верхними боксами;
    // отсюда выезжают спец-бригады. У классических уровней его нет.
    if(LV.biome){
      const sw=Math.min(88*ui, (field.x1-field.x0)*0.32), sh=28*ui;
      field.service={ x:(field.x0+field.x1)/2 - sw/2, y:fy0+2*ui, w:sw, h:sh };
    } else field.service=null;
  }

  // ---- game state ----
  let planes=[], money=0, lives=0, served=0, gameTime=0;
  let running=false, paused=false, lastTs=0, spawnTimer=0, spawnedTotal=0;
  // статистика смены для экрана итога: пик одновременной нагрузки + временной ряд
  // (нагрузка/принято) для графика; lastShift — снимок последней смены для шеринга
  let statPeak=0, statSamples=[], statStep=1.5, statNextAt=0, lastShift=null;
  let inMenu=true;         // пока открыты меню/уровни/медали — на канвасе сцена-радар, не поле
  let nowT=0;              // время кадра (мс) для анимаций отрисовки
  let effects=[];          // анимации крушений
  let lossLog=[], toast=null;
  const debug={infiniteLives:false, richStart:false, unlockAll:false};
  const BIG_MONEY=999999;
  // отладочные читы сохраняются отдельным ключом и восстанавливаются при перезаходе
  const DEBUG_KEY='pf_debug';
  function loadDebug(){ try{ const d=JSON.parse(localStorage.getItem(DEBUG_KEY) || 'null'); if(d&&typeof d==='object'){ debug.infiniteLives=!!d.infiniteLives; debug.richStart=!!d.richStart; debug.unlockAll=!!d.unlockAll; } }catch(e){} }
  function saveDebug(){ try{ localStorage.setItem(DEBUG_KEY, JSON.stringify({infiniteLives:debug.infiniteLives, richStart:debug.richStart, unlockAll:debug.unlockAll})); }catch(e){} }
  function syncDebugUI(){ const a=document.getElementById('optLives') as HTMLInputElement|null, b=document.getElementById('optMoney') as HTMLInputElement|null, c=document.getElementById('optUnlockAll') as HTMLInputElement|null; if(a)a.checked=debug.infiniteLives; if(b)b.checked=debug.richStart; if(c)c.checked=debug.unlockAll; }
  let floaters=[];         // плавающие награды «+N ₿» / «×N комбо» / «уфф!» над полем
  let alarmAt=0;           // антидребезг тревожного бипа терпения
  let slowmo=0;            // секунды лёгкого замедления времени (near-miss)
  let nearMissPairs={};    // key «idA-idB» → время, до которого пара «остыла»
  let planeSeq=0;          // id бортов для антидребезга near-miss
  let tut=null;            // состояние тихого туториала: {step:'land'|'service'|'takeoff', plane}
  // лесной биом: активные помехи на полосах + выехавшие бригады + таймер спавна
  let hazards=[], crews=[], hazardSeq=0, nextHazard=0;
  function addFloat(x: number, y: number, text: string, col: string){ floaters.push({x,y,text,col,t:0,life:1.15}); }

  // ---- звук и вибрация (идеи из копилки: раздел 1) ----
  // Весь звук — синтез Web Audio, без файлов: события игры рождают мягкие ноты
  // одной гаммы (пентатоника ля-минор), краш — шумовой удар. Контекст создаётся
  // по первому жесту (autoplay-политика). Звук необязателен: всё дублируется
  // визуалом, выключатели — в настройках паузы (save.sound / save.vibro).
