// ===== 11b-editor — in-game level constructor (place hangars/runways → export layout JSON) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: edOpen, edClose, edToLevel (+ window.__EDITOR test hook).
// Reads: 04 (K, SVC_TYPES); 06 (layout state: inMenu, LV, bays, runways, curBiome, curBonus, survival, levelIdx, levelKey); 06 (layout()); 08 (reset()); 11 (showStart, hideAllScreens).
//
// Dev-facing tool (entry in the debug popup). Editor labels are literal strings on purpose —
// no t() keys, so it stays out of the i18n parity check. It edits ITS OWN state (ED) and
// draws to its OWN canvas (#edCanvas); the game loop/handlers stay idle (running=false).

  // ---- editor state ----
  // hangars: {type, x, y(0..1 of apron), open, up}; runways: {y(0..1 of field height), landingOpen, takeoffOpen, openCost}
  interface EdHangar { type: string; x: number; y: number; open: boolean; up: boolean; }
  interface EdRunway { y: number; landingOpen: boolean; takeoffOpen: boolean; openCost: number; }
  const ED: {
    hangars: EdHangar[]; runways: EdRunway[]; services: string[]; maxUp: number;
    sel: { kind: string; i: number } | null; drag: any; cv: HTMLCanvasElement | null; g: CanvasRenderingContext2D | null;
    showSnaps: boolean;
  } = {
    hangars: [], runways: [{ y: 0.5, landingOpen: true, takeoffOpen: true, openCost: 0 }],
    services: SVC_TYPES.slice(), maxUp: K.BAY_MAX_LVL,
    sel: null, drag: null, cv: null, g: null,
    showSnaps: true,
  };
  const ED_DRAFT_KEY = 'pf_editor_draft';
  const ED_TONE: Record<string, string> = { fuel: '#22e3c6', board: '#ff8db0', repair: '#ffc14d' };
  const ED_LABEL: Record<string, string> = { fuel: 'топливо', board: 'борт', repair: 'ремонт' };
  const ED_HMAX = 14, ED_GX = 12, ED_GY = 10;   // лимит ангаров; шаг сетки привязки

  function edEl<T extends HTMLElement>(id: string){ return document.getElementById(id) as T | null; }
  const edSnap = (v: number, n: number) => Math.round(v * n) / n;
  const edClamp01 = (v: number) => Math.max(0, Math.min(1, v));

  // апрон (где стоят ангары, ~левые 63%) и полоса ВПП (правее) — те же пропорции, что у поля игры
  function edRects(){
    const cv = ED.cv!; const W = cv.clientWidth, H = cv.clientHeight, M = 14;
    const ax0 = M, ay0 = M + 30, ax1 = Math.round(W * 0.63), ay1 = H - M;     // апрон
    const rwL = ax1, rwR = Math.round(W * 0.84);                              // полоса ВПП
    const ftop = M, fbot = H - M;                                            // вертикальный диапазон ВПП
    return { W, H, ax0, ay0, ax1, ay1, rwL, rwR, ftop, fbot };
  }
  const edHx = (R: any, x: number) => R.ax0 + x * (R.ax1 - R.ax0);
  const edHy = (R: any, y: number) => R.ay0 + y * (R.ay1 - R.ay0);
  function edHangarBox(R: any, h: EdHangar){ const w = 62, hh = 40; return { x: edHx(R, h.x) - w / 2, y: edHy(R, h.y) - hh / 2, w, h: hh }; }
  function edRunwayBox(R: any, r: EdRunway){ const cy = R.ftop + r.y * (R.fbot - R.ftop), rh = 26; return { x: R.rwL, y: cy - rh / 2, w: R.rwR - R.rwL, h: rh, cy }; }

  function edResize(){
    const cv = ED.cv; if (!cv) return;
    const wrap = cv.parentElement as HTMLElement; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ED.g!.setTransform(dpr, 0, 0, dpr, 0, 0);
    edDraw();
  }

  function edRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number){
    r = Math.min(r, w / 2, h / 2); g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function edDraw(){
    const g = ED.g, cv = ED.cv; if (!g || !cv) return;
    const R = edRects();
    g.clearRect(0, 0, R.W, R.H);
    g.fillStyle = '#0a1020'; g.fillRect(0, 0, R.W, R.H);
    // апрон
    g.fillStyle = 'rgba(34,227,198,.04)'; g.fillRect(R.ax0, R.ay0, R.ax1 - R.ax0, R.ay1 - R.ay0);
    g.strokeStyle = 'rgba(127,155,176,.35)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.strokeRect(R.ax0, R.ay0, R.ax1 - R.ax0, R.ay1 - R.ay0); g.setLineDash([]);
    // сетка привязки
    g.strokeStyle = 'rgba(127,155,176,.10)';
    g.beginPath();
    for (let i = 1; i < ED_GX; i++){ const x = edHx(R, i / ED_GX); g.moveTo(x, R.ay0); g.lineTo(x, R.ay1); }
    for (let i = 1; i < ED_GY; i++){ const y = edHy(R, i / ED_GY); g.moveTo(R.ax0, y); g.lineTo(R.ax1, y); }
    g.stroke();
    g.fillStyle = 'rgba(127,155,176,.5)'; g.font = '11px system-ui'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('поле · апрон (тяни ангары)', R.ax0 + 4, 4);
    g.textAlign = 'right'; g.fillText('ВПП · заход справа →', R.rwR, 4);
    // ВПП
    ED.runways.forEach((r, i) => {
      const b = edRunwayBox(R, r); const seld = ED.sel && ED.sel.kind === 'runway' && ED.sel.i === i;
      g.fillStyle = 'rgba(58,210,255,.14)'; edRoundRect(g, b.x, b.y, b.w, b.h, 5); g.fill();
      g.strokeStyle = seld ? '#fff' : '#3ad2ff'; g.lineWidth = seld ? 2.5 : 1.4; edRoundRect(g, b.x, b.y, b.w, b.h, 5); g.stroke();
      g.strokeStyle = 'rgba(58,210,255,.55)'; g.lineWidth = 1; g.setLineDash([7, 6]);
      g.beginPath(); g.moveTo(b.x + 6, b.cy); g.lineTo(b.x + b.w - 6, b.cy); g.stroke(); g.setLineDash([]);
    });
    // ангары
    ED.hangars.forEach((h, i) => {
      const b = edHangarBox(R, h); const col = ED_TONE[h.type] || '#9fb0c8';
      const seld = ED.sel && ED.sel.kind === 'hangar' && ED.sel.i === i;
      g.fillStyle = h.open ? 'rgba(12,23,54,.95)' : 'rgba(12,18,38,.95)'; edRoundRect(g, b.x, b.y, b.w, b.h, 7); g.fill();
      g.strokeStyle = seld ? '#fff' : col; g.lineWidth = seld ? 2.5 : 1.6; g.setLineDash(h.open ? [] : [5, 4]);
      edRoundRect(g, b.x, b.y, b.w, b.h, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = col; g.font = '12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ED_LABEL[h.type] || h.type, b.x + b.w / 2, b.y + b.h / 2 - 1);
      // мини-индикаторы: замок (закрыт) слева-сверху, ↑ (апгрейд) справа-сверху
      g.font = '10px system-ui'; g.textBaseline = 'top';
      g.fillStyle = h.open ? 'rgba(127,155,176,.6)' : '#ffd23b'; g.textAlign = 'left';
      g.fillText(h.open ? '○' : '⌧', b.x + 5, b.y + 4);
      g.fillStyle = (h.up && ED.maxUp > 0) ? '#5dca7a' : 'rgba(127,155,176,.4)'; g.textAlign = 'right';
      g.fillText((h.up && ED.maxUp > 0) ? '↑' + ED.maxUp : '–', b.x + b.w - 5, b.y + 4);
    });
    // snap-overlay: стрелка у ворот ангара + маркер порога ВПП (показывается при showSnaps)
    if(ED.showSnaps){
      // ворота ангара — жёлтая стрелка на той кромке, откуда самолёт въезжает
      ED.hangars.forEach(h => {
        const b = edHangarBox(R, h);
        const gx = edHx(R, h.x), gy = edHy(R, h.y);
        const dT=gy-R.ay0, dB=R.ay1-gy, dL=gx-R.ax0, dR=R.ax1-gx, m=Math.min(dT,dB,dL,dR);
        const odx = m===dL?-1: m===dR?1: 0, ody = m===dT?-1: m===dB?1: 0;
        const ex = b.x+b.w/2 + odx*(b.w/2), ey = b.y+b.h/2 + ody*(b.h/2);
        const ax = ex+odx*10, ay = ey+ody*10;
        g.strokeStyle='#ffd23b'; g.lineWidth=1.5; g.setLineDash([3,3]);
        g.beginPath(); g.moveTo(ex,ey); g.lineTo(ax,ay); g.stroke(); g.setLineDash([]);
        g.fillStyle='#ffd23b'; g.font='9px system-ui'; g.textAlign='center'; g.textBaseline='middle';
        g.fillText('▶', ax+odx*5, ay+ody*5);
      });
      // ВПП — маркер порога посадки (правый торец) и флажки посадки/взлёта
      ED.runways.forEach(r => {
        const b = edRunwayBox(R, r);
        // порог посадки
        g.strokeStyle='rgba(58,210,255,.7)'; g.lineWidth=2; g.setLineDash([]);
        g.beginPath(); g.moveTo(b.x+b.w-4, b.y+3); g.lineTo(b.x+b.w-4, b.y+b.h-3); g.stroke();
        // флажки
        g.font='9px system-ui'; g.textBaseline='middle';
        const landCol = r.landingOpen ? '#5dca7a' : 'rgba(127,155,176,.4)';
        const takeCol = r.takeoffOpen ? '#5dca7a' : 'rgba(127,155,176,.4)';
        g.fillStyle=landCol; g.textAlign='right'; g.fillText('↓', b.x+b.w-8, b.cy-5);
        g.fillStyle=takeCol; g.textAlign='right'; g.fillText('↑', b.x+b.w-8, b.cy+5);
      });
    }
  }

  // ---- hit-test / pointer ----
  function edPt(e: PointerEvent){ const r = ED.cv!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function edHit(p: { x: number; y: number }){
    const R = edRects();
    for (let i = ED.hangars.length - 1; i >= 0; i--){ const b = edHangarBox(R, ED.hangars[i]); if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) return { kind: 'hangar', i }; }
    for (let i = ED.runways.length - 1; i >= 0; i--){ const b = edRunwayBox(R, ED.runways[i]); if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) return { kind: 'runway', i }; }
    return null;
  }
  function edDown(e: PointerEvent){
    e.preventDefault(); const p = edPt(e); const hit = edHit(p);
    ED.sel = hit; ED.drag = hit ? { moved: false, p } : null;
    edRenderSide(); edDraw();
  }
  function edMove(e: PointerEvent){
    if (!ED.drag || !ED.sel) return; e.preventDefault();
    const p = edPt(e); const R = edRects();
    if (ED.sel.kind === 'hangar'){
      const h = ED.hangars[ED.sel.i];
      h.x = edSnap(edClamp01((p.x - R.ax0) / (R.ax1 - R.ax0)), ED_GX);
      h.y = edSnap(edClamp01((p.y - R.ay0) / (R.ay1 - R.ay0)), ED_GY);
    } else {
      ED.runways[ED.sel.i].y = edSnap(edClamp01((p.y - R.ftop) / (R.fbot - R.ftop)), ED_GY);
    }
    ED.drag.moved = true; edDraw();
  }
  function edUp(){ ED.drag = null; edRenderSide(); }

  // ---- mutators ----
  function edAddHangar(type: string){
    if (ED.hangars.length >= ED_HMAX) return;
    // ставим в свободную клетку у верхней кромки апрона
    const x = edSnap(0.1 + (ED.hangars.length % 5) * 0.18, ED_GX), y = edSnap(0.12 + Math.floor(ED.hangars.length / 5) * 0.22, ED_GY);
    ED.hangars.push({ type, x: edClamp01(x), y: edClamp01(y), open: true, up: true });
    ED.sel = { kind: 'hangar', i: ED.hangars.length - 1 }; edRenderSide(); edDraw();
  }
  function edAddRunway(){
    if (ED.runways.length >= K.RUNWAY_MAX) return;
    ED.runways.push({ y: edSnap(0.2 + ED.runways.length * 0.15, ED_GY), landingOpen: true, takeoffOpen: true, openCost: 0 });
    ED.sel = { kind: 'runway', i: ED.runways.length - 1 }; edRenderSide(); edDraw();
  }
  function edDeleteSel(){
    if (!ED.sel) return;
    if (ED.sel.kind === 'hangar') ED.hangars.splice(ED.sel.i, 1); else ED.runways.splice(ED.sel.i, 1);
    ED.sel = null; edRenderSide(); edDraw();
  }

  // ---- serialize / level ----
  function edLayoutObj(){
    return {
      services: ED.services.slice(),
      maxUp: ED.maxUp,
      layout: {
        hangars: ED.hangars.map(h => ({ type: h.type, x: +h.x.toFixed(2), y: +h.y.toFixed(2), open: h.open, up: h.up })),
        runways: ED.runways.map(r => {
          const rd: any = { y: +r.y.toFixed(2) };
          if(!r.landingOpen) rd.landingOpen = false;
          if(!r.takeoffOpen) rd.takeoffOpen = false;
          if(r.openCost) rd.openCost = r.openCost;
          return rd;
        }),
      },
    };
  }
  // полноценный Level для тест-прогона: набор услуг сводим к тем, под которые есть ангар
  // (иначе борт с услугой без ангара застрянет); цель/темп/события — нейтральные дефолты.
  function edToLevel(){
    const have = new Set(ED.hangars.map(h => h.type));
    let services = ED.services.filter(s => have.has(s)); if (!services.length) services = Array.from(have);
    const obj = edLayoutObj();
    return {
      pace: 0.4, objective: { metric: 'served', stars: [6, 8, 10], target: 10 }, events: {},
      services, maxUp: obj.maxUp, layout: obj.layout,
    } as any;
  }
  // предупреждения честности (живой статус) — лёгкое зеркало validateLevels
  function edWarnings(){
    const w: string[] = [];
    if (ED.runways.length < 1) w.push('нет ни одной ВПП');
    const have = new Set(ED.hangars.map(h => h.type));
    for (const s of ED.services) if (!have.has(s)) w.push('нет ангара под услугу «' + (ED_LABEL[s] || s) + '»');
    if (!ED.hangars.some(h => h.open)) w.push('ни один ангар не открыт на старте');
    return w;
  }

  function edExportText(){ return JSON.stringify(edLayoutObj(), null, 2); }
  async function edExport(){
    const text = edExportText();
    const file = new File([text], 'planeflow-level.json', { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })){ await navigator.share({ files: [file], title: 'PlaneFlow level' }); return; } } catch (e) { /* отмена/нет поддержки → скачивание */ }
    try { const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'planeflow-level.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); } catch (e) {}
    try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
    const st = edEl('edStatus'); if (st) { st.textContent = 'экспортировано (файл + буфер)'; setTimeout(() => edRenderSide(), 1800); }
  }
  function edSaveDraft(){ try { localStorage.setItem(ED_DRAFT_KEY, edExportText()); const st = edEl('edStatus'); if (st) { st.textContent = 'черновик сохранён'; setTimeout(() => edRenderSide(), 1500); } } catch (e) {} }
  function edLoadObj(o: any){
    if (!o || !o.layout) return;
    ED.hangars = (o.layout.hangars || []).map((h: any) => ({ type: h.type, x: edClamp01(+h.x || 0), y: edClamp01(+h.y || 0), open: h.open !== false, up: h.up !== false }));
    ED.runways = (o.layout.runways || []).map((r: any) => ({ y: edClamp01(+r.y || 0), landingOpen: r.landingOpen !== false, takeoffOpen: r.takeoffOpen !== false, openCost: r.openCost || 0 }));
    ED.services = Array.isArray(o.services) && o.services.length ? o.services.filter((s: string) => SVC_TYPES.includes(s)) : SVC_TYPES.slice();
    ED.maxUp = (o.maxUp == null) ? K.BAY_MAX_LVL : Math.max(0, Math.min(K.BAY_MAX_LVL, o.maxUp));
    ED.sel = null;
  }
  function edLoadDraft(){ try { const o = JSON.parse(localStorage.getItem(ED_DRAFT_KEY) || 'null'); if (o){ edLoadObj(o); edRenderSide(); edDraw(); } } catch (e) {} }
  // открыть существующий уровень кампании: явный layout берём как есть, старый sides — конвертируем
  function edOpenLevel(idx: number){ const lv = LEVELS[idx]; if (!lv) return; edLoadObj(levelToEditorObj(lv)); edRenderSide(); edDraw(); }

  function edPlayTest(){
    if (!ED.runways.length || !ED.hangars.length) return;
    curBiome = null; curBonus = null; survival = false;
    levelIdx = -1; levelKey = 'editor'; LV = edToLevel();
    bays = []; runways = []; layout();
    edHideScreen(); inMenu = false; reset();
  }

  // ---- side panel (inspector + level options) ----
  function edBtn(label: string, on: boolean, cb: () => void){
    const b = document.createElement('button'); b.className = 'm-btn m-btn--ghost m-btn--sm' + (on ? ' ed-on' : '');
    b.textContent = label; b.onclick = cb; return b;
  }
  function edRow(label: string){ const r = document.createElement('div'); r.className = 'ed-row'; const l = document.createElement('span'); l.className = 'ed-row__l'; l.textContent = label; r.appendChild(l); return r; }
  function edRenderSide(){
    const side = edEl('edSide'); if (!side) return; side.innerHTML = '';
    // палитра «Добавить» — всегда на виду, вверху панели
    const add = document.createElement('div'); add.className = 'ed-card';
    add.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Добавить' }));
    const ar = document.createElement('div'); ar.className = 'ed-row';
    ([['fuel', '+ топливо'], ['board', '+ борт'], ['repair', '+ ремонт']] as [string, string][]).forEach(([tp, lbl]) => ar.appendChild(edBtn(lbl, false, () => edAddHangar(tp))));
    ar.appendChild(edBtn('+ ВПП', false, edAddRunway));
    add.appendChild(ar); side.appendChild(add);
    // открыть существующий уровень кампании
    const opn = document.createElement('div'); opn.className = 'ed-card';
    opn.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Открыть уровень' }));
    const lsel = document.createElement('select'); lsel.className = 'ed-sel'; lsel.style.width = '100%';
    lsel.innerHTML = '<option value="">— L1..L' + LEVELS.length + ' —</option>' + LEVELS.map((_, i) => '<option value="' + i + '">L' + (i + 1) + ' · ' + levelName(i) + '</option>').join('');
    lsel.onchange = () => { if (lsel.value !== '') edOpenLevel(+lsel.value); };
    opn.appendChild(lsel); side.appendChild(opn);
    // статус честности
    const warn = edWarnings(); const st = edEl('edStatus');
    if (st && st.textContent && /сохранён|экспортировано/.test(st.textContent)) { /* кратковременный статус — не перетираем */ }
    else if (st) st.textContent = warn.length ? ('⚠ ' + warn.length) : '✓ валидна';
    // инспектор выбранного
    const insp = document.createElement('div'); insp.className = 'ed-card';
    if (ED.sel && ED.sel.kind === 'hangar'){
      const h = ED.hangars[ED.sel.i];
      insp.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Ангар: ' + (ED_LABEL[h.type] || h.type) }));
      const tr = edRow('Тип'); SVC_TYPES.forEach(tp => tr.appendChild(edBtn(ED_LABEL[tp] || tp, h.type === tp, () => { h.type = tp; edRenderSide(); edDraw(); }))); insp.appendChild(tr);
      const or = edRow('На старте'); or.appendChild(edBtn('открыт', h.open, () => { h.open = true; edRenderSide(); edDraw(); })); or.appendChild(edBtn('закрыт', !h.open, () => { h.open = false; edRenderSide(); edDraw(); })); insp.appendChild(or);
      const ur = edRow('Апгрейд'); ur.appendChild(edBtn('вкл', h.up, () => { h.up = true; edRenderSide(); edDraw(); })); ur.appendChild(edBtn('выкл', !h.up, () => { h.up = false; edRenderSide(); edDraw(); })); insp.appendChild(ur);
      const dr = document.createElement('div'); dr.className = 'ed-row'; dr.appendChild(edBtn('🗑 удалить', false, edDeleteSel)); insp.appendChild(dr);
    } else if (ED.sel && ED.sel.kind === 'runway'){
      const r = ED.runways[ED.sel.i];
      insp.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'ВПП' }));
      insp.appendChild(Object.assign(document.createElement('div'), { className: 'ed-row__l', textContent: 'Тяни вверх/вниз. Горизонтальная, заход справа.' }));
      const lr = edRow('Посадка'); lr.appendChild(edBtn('открыта', r.landingOpen, ()=>{ r.landingOpen=true; edRenderSide(); edDraw(); })); lr.appendChild(edBtn('закрыта', !r.landingOpen, ()=>{ r.landingOpen=false; edRenderSide(); edDraw(); })); insp.appendChild(lr);
      const tr = edRow('Взлёт');   tr.appendChild(edBtn('открыт',  r.takeoffOpen, ()=>{ r.takeoffOpen=true; edRenderSide(); edDraw(); })); tr.appendChild(edBtn('закрыт',  !r.takeoffOpen, ()=>{ r.takeoffOpen=false; edRenderSide(); edDraw(); })); insp.appendChild(tr);
      const ocr = edRow('Цена открытия');
      const ocIn = document.createElement('input'); ocIn.type='number'; ocIn.min='0'; ocIn.step='50'; ocIn.value=String(r.openCost); ocIn.className='ed-range'; ocIn.style.width='64px';
      const ocOut = document.createElement('span'); ocOut.className='ed-out'; ocOut.textContent = r.openCost ? String(r.openCost) : 'бесплатно';
      ocIn.oninput=()=>{ r.openCost=Math.max(0,+ocIn.value||0); ocOut.textContent=r.openCost?String(r.openCost):'бесплатно'; };
      ocr.appendChild(ocIn); ocr.appendChild(ocOut); insp.appendChild(ocr);
      const dr = document.createElement('div'); dr.className = 'ed-row'; dr.appendChild(edBtn('🗑 удалить', false, edDeleteSel)); insp.appendChild(dr);
    } else {
      insp.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Ничего не выбрано' }));
      insp.appendChild(Object.assign(document.createElement('div'), { className: 'ed-row__l', textContent: 'Добавь элемент палитрой и тяни по полю. Тап — выбрать.' }));
    }
    side.appendChild(insp);
    // настройки уровня
    const lvl = document.createElement('div'); lvl.className = 'ed-card';
    lvl.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Уровень' }));
    const sr = edRow('Услуги в игре');
    SVC_TYPES.forEach(tp => sr.appendChild(edBtn(ED_LABEL[tp] || tp, ED.services.includes(tp), () => {
      const on = ED.services.includes(tp);
      if (on && ED.services.length > 1) ED.services = ED.services.filter(s => s !== tp); else if (!on) ED.services.push(tp);
      edRenderSide();
    })));
    lvl.appendChild(sr);
    const mr = edRow('Глубина апгрейда');
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(K.BAY_MAX_LVL); slider.step = '1'; slider.value = String(ED.maxUp); slider.className = 'ed-range';
    const out = document.createElement('span'); out.className = 'ed-out'; out.textContent = String(ED.maxUp);
    slider.oninput = () => { ED.maxUp = +slider.value; out.textContent = String(ED.maxUp); edDraw(); };
    mr.appendChild(slider); mr.appendChild(out); lvl.appendChild(mr);
    const cr = edRow('Элементы'); cr.appendChild(Object.assign(document.createElement('span'), { className: 'ed-out', textContent: ED.hangars.length + ' ангаров · ' + ED.runways.length + ' ВПП' })); lvl.appendChild(cr);
    side.appendChild(lvl);
    // предупреждения списком
    if (warn.length){
      const wc = document.createElement('div'); wc.className = 'ed-card ed-warn';
      wc.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: '⚠ Проверь' }));
      warn.forEach(x => wc.appendChild(Object.assign(document.createElement('div'), { className: 'ed-row__l', textContent: '• ' + x })));
      side.appendChild(wc);
    }
    // файл: экспорт готового layout + черновик в localStorage
    const file = document.createElement('div'); file.className = 'ed-card';
    file.appendChild(Object.assign(document.createElement('div'), { className: 'ed-card__t', textContent: 'Файл' }));
    file.appendChild(Object.assign(document.createElement('div'), { className: 'ed-row__l', textContent: 'Экспорт — отдать JSON уровня (поделиться/скачать). Черновик — сохранить/вернуть в этом браузере.' }));
    const fr = document.createElement('div'); fr.className = 'ed-row';
    fr.appendChild(edBtn('Экспорт', false, edExport));
    fr.appendChild(edBtn('Сохранить черновик', false, edSaveDraft));
    fr.appendChild(edBtn('Загрузить черновик', false, edLoadDraft));
    file.appendChild(fr); side.appendChild(file);
  }

  // ---- open / close ----
  function edHideScreen(){ const s = edEl('editorScreen'); if (s) s.classList.add('hidden'); }
  function edOpen(){
    inMenu = true; running = false; paused = false;
    if (typeof hideAllScreens === 'function') hideAllScreens();
    const scr = edEl('editorScreen'); if (!scr) return; scr.classList.remove('hidden');
    ED.cv = edEl<HTMLCanvasElement>('edCanvas'); if (ED.cv) ED.g = ED.cv.getContext('2d');
    edRenderSide();
    requestAnimationFrame(() => { edResize(); });   // дождаться раскладки оверлея для размеров канваса
  }
  function edClose(){ edHideScreen(); if (typeof showStart === 'function') showStart(); }

  // ---- wiring (DOM присутствует в шаблоне на момент склейки IIFE) ----
  (function edWire(){
    const open = edEl('edOpenBtn'); if (open) open.onclick = edOpen;
    const close = edEl('edCloseBtn'); if (close) close.onclick = edClose;
    const test = edEl('edTestBtn'); if (test) test.onclick = edPlayTest;
    // палитра/файл/«открыть уровень» рендерятся в боковой панели (edRenderSide) — там и навешиваются обработчики
    const cv = edEl<HTMLCanvasElement>('edCanvas');
    if (cv){ cv.addEventListener('pointerdown', edDown); cv.addEventListener('pointermove', edMove); window.addEventListener('pointerup', edUp); }
    window.addEventListener('resize', () => { const s = edEl('editorScreen'); if (s && !s.classList.contains('hidden')) edResize(); });
  })();

  // тест-хук: round-trip и сериализация без DOM/канваса
  if (typeof location !== 'undefined' && /[?&]test=1(?:&|$)/.test(location.search)){
    (window as any).__EDITOR = { ED, edLayoutObj, edToLevel, edWarnings, edLoadObj };
  }
