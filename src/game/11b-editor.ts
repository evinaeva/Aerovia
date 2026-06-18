// ===== 11b-editor — in-game level constructor =====
// Canvas shows a phone frame (landscape) with safe-zone overlays.
// Hangars & runways are dragged inside the safe zone; coords are 0..1 relative to it.
// Three phone-size presets (S/M/L) let the designer preview layout at different aspect ratios.
// Provides: edOpen, edClose, edToLevel (+ window.__EDITOR test hook).

  // ---- interfaces ----
  interface EdHangar {
    type: string; x: number; y: number;
    open: boolean; openCost: number;
    gate: 'auto'|'up'|'down'|'left'|'right';
  }
  interface EdRunway {
    y: number;
    landingOpen: boolean; landingCost: number;
    takeoffOpen: boolean; takeoffCost: number;
  }
  interface EdObjective { metric: 'served'|'upgrades'; star1: number; star2: number; star3: number; timerSecs: number; raceMode: boolean; }

  // ---- phone frame constants ----
  // Landscape dp sizes for three common Android phones.
  const ED_PHONES = {
    S: { w: 640, h: 360, label: 'S 640×360' },
    M: { w: 800, h: 390, label: 'M 800×390' },
    L: { w: 960, h: 432, label: 'L 960×432' },
  } as const;
  type EdPhoneSize = keyof typeof ED_PHONES;
  // 48 dp sides = max(camera notch ~48, back-swipe ~40) → one number covers both threats.
  const ED_SAFE = { top: 24, bottom: 48, side: 48 }; // dp

  // ---- state ----
  const ED: {
    hangars: EdHangar[]; runways: EdRunway[];
    services: string[]; maxUp: number;
    upgradesEnabled: boolean; upgradeCost: number;
    pace: number; startMoney: number;
    objective: EdObjective;
    evVip: boolean; evEmergency: boolean; evMedical: boolean; evRush: boolean;
    weather: boolean; deice: boolean; combo: boolean; express: boolean;
    phoneSize: EdPhoneSize;
    sel: { kind: string; i: number } | null; drag: any;
    cv: HTMLCanvasElement | null; g: CanvasRenderingContext2D | null;
    showSnaps: boolean;
  } = {
    hangars: [],
    runways: [{ y: 0.5, landingOpen: true, landingCost: 0, takeoffOpen: true, takeoffCost: 0 }],
    services: SVC_TYPES.slice(), maxUp: K.BAY_MAX_LVL,
    upgradesEnabled: true, upgradeCost: 0,
    pace: 0.4, startMoney: K.START_MONEY,
    objective: { metric: 'served', star1: 6, star2: 8, star3: 10, timerSecs: 0, raceMode: false },
    evVip: false, evEmergency: false, evMedical: false, evRush: false,
    weather: false, deice: false, combo: true, express: true,
    phoneSize: 'M',
    sel: null, drag: null, cv: null, g: null, showSnaps: true,
  };

  const ED_DRAFT_KEY = 'pf_editor_draft';
  const ED_TONE: Record<string,string> = { fuel:'#22e3c6', board:'#ff8db0', repair:'#ffc14d' };
  const ED_LABEL: Record<string,string> = { fuel:'топливо', board:'борт', repair:'ремонт' };
  const ED_GATE_LABELS: Record<string,string> = { auto:'авто', up:'↑', down:'↓', left:'←', right:'→' };
  const ED_HMAX = 14, ED_GX = 12, ED_GY = 10;

  // ---- tiny helpers ----
  function edEl<T extends HTMLElement>(id: string){ return document.getElementById(id) as T|null; }
  const edSnap = (v: number, n: number) => Math.round(v * n) / n;
  const edClamp01 = (v: number) => Math.max(0, Math.min(1, v));

  // ---- phone frame geometry ----
  // Returns pixel coords for the phone chassis and the safe zone within it.
  function edPhoneFrame() {
    const cv = ED.cv!;
    const W = cv.clientWidth, H = cv.clientHeight;
    const ph = ED_PHONES[ED.phoneSize];
    const pad = 20;
    const sc = Math.min((W - pad*2) / ph.w, (H - pad*2) / ph.h);
    const fw = ph.w * sc, fh = ph.h * sc;
    const fx = (W - fw) / 2, fy = (H - fh) / 2;
    const sl = fx + ED_SAFE.side   * sc;  // safe-zone left edge
    const sr = fx + fw - ED_SAFE.side * sc;  // safe-zone right edge
    const st = fy + ED_SAFE.top    * sc;  // safe-zone top
    const sb = fy + fh - ED_SAFE.bottom * sc; // safe-zone bottom
    return { W, H, fx, fy, fw, fh, sl, sr, st, sb, sc, ph };
  }
  type PhoneFrame = ReturnType<typeof edPhoneFrame>;

  function edHangarBox(R: PhoneFrame, h: EdHangar) {
    const HW = 62, HH = 38;
    const cx = R.sl + h.x * (R.sr - R.sl);
    const cy = R.st + h.y * (R.sb - R.st);
    return { x: cx - HW/2, y: cy - HH/2, w: HW, h: HH, cx, cy };
  }
  function edRunwayBox(R: PhoneFrame, r: EdRunway) {
    const cy = R.st + r.y * (R.sb - R.st);
    const rh = 24;
    return { x: R.sl, y: cy - rh/2, w: R.sr - R.sl, h: rh, cy };
  }

  // ---- canvas resize ----
  function edResize() {
    const cv = ED.cv; if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w === 0 || h === 0) { requestAnimationFrame(() => edResize()); return; }
    cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
    ED.g!.setTransform(dpr, 0, 0, dpr, 0, 0);
    edDraw();
  }

  function edRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w/2, h/2); g.beginPath();
    g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r);
    g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath();
  }

  // ---- draw ----
  function edDraw() {
    const g = ED.g, cv = ED.cv; if (!g || !cv) return;
    const R = edPhoneFrame();
    const { W, H, fx, fy, fw, fh, sl, sr, st, sb, sc } = R;
    const sw = sr - sl, sh = sb - st;

    // canvas bg
    g.fillStyle = '#060b1a'; g.fillRect(0, 0, W, H);

    // phone chassis
    const bezelR = Math.max(10, Math.min(fw, fh) * 0.07);
    g.fillStyle = '#12182c';
    edRoundRect(g, fx, fy, fw, fh, bezelR); g.fill();
    g.strokeStyle = 'rgba(127,155,176,.32)'; g.lineWidth = 1.5;
    edRoundRect(g, fx, fy, fw, fh, bezelR); g.stroke();

    // left/right danger strips (back-swipe + camera)
    const sideW = ED_SAFE.side * sc;
    g.fillStyle = 'rgba(255,60,40,.13)';
    g.fillRect(fx, fy, sideW, fh);   // left
    g.fillRect(sr, fy, sideW, fh);   // right

    // camera notch circles — both sides (sensorLandscape: camera can end up on either side)
    const nr = Math.max(5, 5.5 * sc);
    const ncy = fy + fh / 2;
    g.strokeStyle = 'rgba(255,148,30,.8)'; g.lineWidth = 1.5; g.setLineDash([3, 3]);
    g.beginPath(); g.arc(fx + sideW/2, ncy, nr, 0, Math.PI*2); g.stroke();
    g.beginPath(); g.arc(sr + sideW/2, ncy, nr, 0, Math.PI*2); g.stroke();
    g.setLineDash([]);

    // top zone (notification / status bar)
    const topH = ED_SAFE.top * sc, botH = ED_SAFE.bottom * sc;
    g.fillStyle = 'rgba(100,108,225,.10)';
    g.fillRect(sl, fy, sw, topH);
    // bottom zone (home / recents swipe)
    g.fillRect(sl, sb, sw, botH);

    // safe zone interior
    g.fillStyle = 'rgba(34,227,198,.03)';
    g.fillRect(sl, st, sw, sh);
    g.strokeStyle = 'rgba(34,227,198,.45)'; g.lineWidth = 1.5; g.setLineDash([6, 5]);
    g.strokeRect(sl + .8, st + .8, sw - 1.6, sh - 1.6);
    g.setLineDash([]);

    // grid inside safe zone
    g.strokeStyle = 'rgba(127,155,176,.07)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < ED_GX; i++) { const x = sl + (i/ED_GX)*sw; g.moveTo(x, st); g.lineTo(x, sb); }
    for (let i = 1; i < ED_GY; i++) { const y = st + (i/ED_GY)*sh; g.moveTo(sl, y); g.lineTo(sr, y); }
    g.stroke();

    // zone labels
    g.font = '10px system-ui'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(120,128,225,.5)'; g.textAlign = 'left';
    if (topH > 11) g.fillText('уведомления', sl + 4, fy + topH/2);
    if (botH > 11) g.fillText('home · recents', sl + 4, sb + botH/2);

    // side labels (rotated)
    if (sideW > 22) {
      g.fillStyle = 'rgba(255,70,40,.45)';
      g.save(); g.translate(fx + sideW/2, fy + fh/2); g.rotate(-Math.PI/2);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '9px system-ui';
      g.fillText('back-свайп · камера', 0, 0); g.restore();
      g.save(); g.translate(sr + sideW/2, fy + fh/2); g.rotate(Math.PI/2);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '9px system-ui';
      g.fillText('back-свайп · камера', 0, 0); g.restore();
    }

    // plane entry hint (right edge = where aircraft enter)
    g.fillStyle = 'rgba(58,210,255,.38)'; g.font = '10px system-ui';
    g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('← борты', sr - 4, st + 3);

    // safe zone size info below phone
    const szW = Math.round(sw / sc), szH = Math.round(sh / sc);
    g.fillStyle = 'rgba(127,155,176,.35)'; g.font = '10px system-ui';
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('safe zone ' + szW + '×' + szH + ' dp', W/2, fy + fh + 4);

    // empty canvas hint
    if (ED.hangars.length === 0 && ED.runways.length === 0) {
      g.fillStyle = 'rgba(34,227,198,.16)'; g.font = 'bold 13px system-ui';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('зона перетаскивания', sl + sw/2, st + sh/2 - 10);
      g.font = '11px system-ui'; g.fillStyle = 'rgba(34,227,198,.09)';
      g.fillText('добавь ангары и ВПП из панели →', sl + sw/2, st + sh/2 + 10);
    }

    // runways — full safe-zone width, y draggable
    ED.runways.forEach((r, i) => {
      const b = edRunwayBox(R, r);
      const seld = ED.sel?.kind === 'runway' && ED.sel.i === i;
      g.fillStyle = 'rgba(58,210,255,.13)';
      edRoundRect(g, b.x, b.y, b.w, b.h, 4); g.fill();
      g.strokeStyle = seld ? '#fff' : '#3ad2ff'; g.lineWidth = seld ? 2.5 : 1.4;
      edRoundRect(g, b.x, b.y, b.w, b.h, 4); g.stroke();
      // centerline
      g.strokeStyle = 'rgba(58,210,255,.35)'; g.lineWidth = 1; g.setLineDash([8, 6]);
      g.beginPath(); g.moveTo(b.x+6, b.cy); g.lineTo(b.x+b.w-6, b.cy); g.stroke(); g.setLineDash([]);
      // threshold bar (right edge = aircraft entry)
      g.strokeStyle = 'rgba(58,210,255,.7)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(b.x+b.w-3, b.y+4); g.lineTo(b.x+b.w-3, b.y+b.h-4); g.stroke();
      // landing / takeoff indicators
      g.font = '10px system-ui'; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillStyle = r.landingOpen ? '#5dca7a' : 'rgba(127,155,176,.35)';
      g.fillText('↓посадка', b.x+b.w-7, b.cy-6);
      g.fillStyle = r.takeoffOpen ? '#5dca7a' : 'rgba(127,155,176,.35)';
      g.fillText('↑взлёт', b.x+b.w-7, b.cy+6);
    });

    // hangars
    ED.hangars.forEach((h, i) => {
      const b = edHangarBox(R, h);
      const col = ED_TONE[h.type] || '#9fb0c8';
      const seld = ED.sel?.kind === 'hangar' && ED.sel.i === i;
      g.fillStyle = h.open ? 'rgba(12,23,54,.95)' : 'rgba(12,18,38,.95)';
      edRoundRect(g, b.x, b.y, b.w, b.h, 7); g.fill();
      g.strokeStyle = seld ? '#fff' : col; g.lineWidth = seld ? 2.5 : 1.6;
      g.setLineDash(h.open ? [] : [5, 4]);
      edRoundRect(g, b.x, b.y, b.w, b.h, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = col; g.font = '12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ED_LABEL[h.type] || h.type, b.x+b.w/2, b.y+b.h/2-1);
      g.font = '10px system-ui'; g.textBaseline = 'top';
      g.fillStyle = h.open ? 'rgba(127,155,176,.6)' : '#ffd23b'; g.textAlign = 'left';
      g.fillText(h.open ? '○' : '⌧', b.x+4, b.y+3);
      g.fillStyle = (ED.upgradesEnabled && ED.maxUp>0) ? '#5dca7a' : 'rgba(127,155,176,.4)'; g.textAlign = 'right';
      g.fillText((ED.upgradesEnabled && ED.maxUp>0) ? '↑'+ED.maxUp : '–', b.x+b.w-4, b.y+3);
    });

    // gate-direction snap arrows
    if (ED.showSnaps) {
      ED.hangars.forEach(h => {
        const b = edHangarBox(R, h);
        let odx = 0, ody = 0;
        if (h.gate !== 'auto') {
          odx = h.gate==='left'?-1: h.gate==='right'?1: 0;
          ody = h.gate==='up'?-1: h.gate==='down'?1: 0;
        } else {
          const m = Math.min(h.x, 1-h.x, h.y, 1-h.y);
          odx = m===h.x?-1: m===1-h.x?1: 0;
          ody = m===h.y?-1: m===1-h.y?1: 0;
        }
        const ex = b.x+b.w/2 + odx*b.w/2, ey = b.y+b.h/2 + ody*b.h/2;
        const ax = ex+odx*10, ay = ey+ody*10;
        g.strokeStyle = '#ffd23b'; g.lineWidth = 1.5; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(ex, ey); g.lineTo(ax, ay); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ffd23b'; g.font = '9px system-ui';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('▶', ax+odx*5, ay+ody*5);
      });
    }
  }

  // ---- pointer events ----
  function edPt(e: PointerEvent) { const r = ED.cv!.getBoundingClientRect(); return { x: e.clientX-r.left, y: e.clientY-r.top }; }
  function edHit(p: {x:number;y:number}) {
    const R = edPhoneFrame();
    for (let i = ED.hangars.length-1; i>=0; i--) { const b = edHangarBox(R, ED.hangars[i]); if (p.x>b.x&&p.x<b.x+b.w&&p.y>b.y&&p.y<b.y+b.h) return {kind:'hangar',i}; }
    for (let i = ED.runways.length-1; i>=0; i--) { const b = edRunwayBox(R, ED.runways[i]); if (p.x>b.x&&p.x<b.x+b.w&&p.y>b.y&&p.y<b.y+b.h) return {kind:'runway',i}; }
    return null;
  }

  function edDown(e: PointerEvent) {
    e.preventDefault(); const p = edPt(e); const hit = edHit(p);
    ED.sel = hit; ED.drag = hit ? {moved:false, p} : null;
    edRenderSide(); edDraw();
  }
  function edMove(e: PointerEvent) {
    if (!ED.drag || !ED.sel) return; e.preventDefault();
    const p = edPt(e); const R = edPhoneFrame();
    const sw = R.sr-R.sl, sh = R.sb-R.st;
    if (ED.sel.kind === 'hangar') {
      const h = ED.hangars[ED.sel.i];
      h.x = edSnap(edClamp01((p.x-R.sl)/sw), ED_GX);
      h.y = edSnap(edClamp01((p.y-R.st)/sh), ED_GY);
    } else {
      ED.runways[ED.sel.i].y = edSnap(edClamp01((p.y-R.st)/sh), ED_GY);
    }
    ED.drag.moved = true; edDraw();
  }
  function edUp() { ED.drag = null; edRenderSide(); }

  // ---- add / delete ----
  function edAddHangar(type: string) {
    if (ED.hangars.length >= ED_HMAX) return;
    const col = ED.hangars.length % 4, row = Math.floor(ED.hangars.length / 4);
    const x = edSnap(edClamp01(0.06 + col * 0.13), ED_GX);
    const y = edSnap(edClamp01(0.12 + row * 0.28), ED_GY);
    ED.hangars.push({ type, x, y, open:true, openCost:0, gate:'auto' });
    ED.sel = { kind:'hangar', i: ED.hangars.length-1 }; edRenderSide(); edDraw();
  }
  function edAddRunway() {
    const maxRw = (K as any).RUNWAY_MAX ?? 5;
    if (ED.runways.length >= maxRw) return;
    const yDef = [0.5, 0.25, 0.75, 0.12, 0.88];
    const y = edSnap(yDef[ED.runways.length] ?? edClamp01(0.1 + ED.runways.length * 0.12), ED_GY);
    ED.runways.push({ y, landingOpen:true, landingCost:0, takeoffOpen:true, takeoffCost:0 });
    ED.sel = { kind:'runway', i: ED.runways.length-1 }; edRenderSide(); edDraw();
  }
  function edDeleteSel() {
    if (!ED.sel) return;
    if (ED.sel.kind === 'hangar') ED.hangars.splice(ED.sel.i, 1); else ED.runways.splice(ED.sel.i, 1);
    ED.sel = null; edRenderSide(); edDraw();
  }

  // ---- export / import ----
  function edLayoutObj() {
    const o: any = {
      services: ED.services.slice(),
      maxUp: ED.maxUp,
      pace: +ED.pace.toFixed(2),
      layout: {
        hangars: ED.hangars.map(h => {
          const hd: any = { type:h.type, x:+h.x.toFixed(3), y:+h.y.toFixed(3) };
          if (!h.open)  hd.open = false;
          if (h.openCost)  hd.openCost = h.openCost;
          if (!ED.upgradesEnabled) hd.up = false;
          if (h.gate !== 'auto') hd.gate = h.gate;
          if (ED.upgradeCost) hd.upgradeCost = ED.upgradeCost;
          return hd;
        }),
        runways: ED.runways.map(r => {
          const rd: any = { y: +r.y.toFixed(3) };
          if (!r.landingOpen) rd.landingOpen = false;
          if (r.landingCost)  rd.landingCost = r.landingCost;
          if (!r.takeoffOpen) rd.takeoffOpen = false;
          if (r.takeoffCost)  rd.takeoffCost = r.takeoffCost;
          return rd;
        }),
      },
      objective: (function() {
        const ob: any = { metric:ED.objective.metric, stars:[ED.objective.star1, ED.objective.star2, ED.objective.star3] };
        if (ED.objective.timerSecs > 0) ob.time = ED.objective.timerSecs;
        if (ED.objective.raceMode && ED.objective.timerSecs > 0) ob.race = true;
        return ob;
      })(),
    };
    if (ED.startMoney !== K.START_MONEY) o.startMoney = ED.startMoney;
    if (!ED.upgradesEnabled) o.upgradesEnabled = false;
    if (ED.upgradeCost) o.upgradeCost = ED.upgradeCost;
    const ev: any = {};
    if (ED.evVip) ev.vip=true; if (ED.evEmergency) ev.emergency=true;
    if (ED.evMedical) ev.medical=true; if (ED.evRush) ev.rush=true;
    if (Object.keys(ev).length) o.events = ev;
    if (ED.weather) o.weather = true;
    if (ED.deice)   o.deice   = true;
    if (!ED.combo)  o.combo   = false;
    if (!ED.express) o.express = false;
    return o;
  }
  function edToLevel() {
    const have = new Set(ED.hangars.map(h => h.type));
    let services = ED.services.filter(s => have.has(s)); if (!services.length) services = Array.from(have);
    const obj = edLayoutObj(); obj.services = services; return obj as any;
  }
  function edWarnings() {
    const w: string[] = [];
    if (ED.runways.length < 1) w.push('нет ни одной ВПП');
    else {
      if (!ED.runways.some(r => r.landingOpen)) w.push('ни одна ВПП не разрешает посадку');
      if (!ED.runways.some(r => r.takeoffOpen)) w.push('ни одна ВПП не разрешает взлёт');
    }
    const have = new Set(ED.hangars.map(h => h.type));
    for (const s of ED.services) if (!have.has(s)) w.push('нет ангара под услугу «'+(ED_LABEL[s]||s)+'»');
    if (!ED.hangars.some(h => h.open)) w.push('ни один ангар не открыт на старте');
    const o = ED.objective;
    if (!(o.star1<=o.star2 && o.star2<=o.star3 && o.star1>0)) w.push('звёзды должны идти по возрастанию');
    if (o.raceMode && o.timerSecs<=0) w.push('режим гонки требует таймер > 0');
    return w;
  }

  function edExportText() { return JSON.stringify(edLayoutObj(), null, 2); }
  async function edExport() {
    const text = edExportText();
    const file = new File([text], 'planeflow-level.json', {type:'application/json'});
    try { if (navigator.canShare && navigator.canShare({files:[file]})) { await navigator.share({files:[file], title:'PlaneFlow level'}); return; } } catch(_) {}
    try { const blob=new Blob([text],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='planeflow-level.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),5000); } catch(_) {}
    try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch(_) {}
    const st = edEl('edStatus'); if (st) { st.textContent='экспортировано'; setTimeout(()=>edRenderSide(),1800); }
  }
  function edSaveDraft() {
    try { localStorage.setItem(ED_DRAFT_KEY, edExportText()); const st=edEl('edStatus'); if(st){st.textContent='черновик сохранён'; setTimeout(()=>edRenderSide(),1500);} } catch(_) {}
  }
  function edLoadObj(o: any) {
    if (!o || !o.layout) return;
    ED.hangars = (o.layout.hangars||[]).map((h: any) => ({
      type:h.type, x:edClamp01(+h.x||0), y:edClamp01(+h.y||0),
      open:h.open!==false, openCost:h.openCost||0,
      gate:(['up','down','left','right'].includes(h.gate)?h.gate:'auto') as EdHangar['gate'],
    }));
    ED.runways = (o.layout.runways||[]).map((r: any) => ({
      y:edClamp01(+r.y||0),
      landingOpen:r.landingOpen!==false, landingCost:r.landingCost||0,
      takeoffOpen:r.takeoffOpen!==false, takeoffCost:r.takeoffCost||0,
    }));
    ED.services = Array.isArray(o.services)&&o.services.length ? o.services.filter((s: string)=>SVC_TYPES.includes(s)) : SVC_TYPES.slice();
    ED.maxUp = (o.maxUp==null)?K.BAY_MAX_LVL:Math.max(0,Math.min(K.BAY_MAX_LVL,o.maxUp));
    // map-level upgrade settings: prefer root fields; fall back to inferring from per-hangar (old JSONs)
    ED.upgradesEnabled = (o.upgradesEnabled !== undefined) ? o.upgradesEnabled !== false
      : !(o.layout.hangars||[]).some((h: any) => h.up === false);
    const hWithCost = (o.layout.hangars||[]).find((h: any) => h.upgradeCost);
    ED.upgradeCost = (o.upgradeCost != null) ? Math.max(0, +o.upgradeCost||0) : (hWithCost ? hWithCost.upgradeCost : 0);
    ED.pace = (o.pace!=null)?Math.max(0,Math.min(1,+o.pace||0)):0.4;
    ED.startMoney = (o.startMoney!=null)?Math.max(0,+o.startMoney||K.START_MONEY):K.START_MONEY;
    const ob = o.objective||{};
    const stars: number[] = Array.isArray(ob.stars)?ob.stars:[6,8,10];
    ED.objective = { metric:ob.metric==='upgrades'?'upgrades':'served', star1:+stars[0]||6, star2:+stars[1]||8, star3:+stars[2]||10, timerSecs:+ob.time||0, raceMode:!!ob.race };
    const ev = o.events||{};
    ED.evVip=!!ev.vip; ED.evEmergency=!!ev.emergency; ED.evMedical=!!ev.medical; ED.evRush=!!ev.rush;
    ED.weather=!!o.weather; ED.deice=!!o.deice;
    ED.combo=o.combo!==false; ED.express=o.express!==false;
    ED.sel = null;
  }
  function edLoadDraft() { try { const o=JSON.parse(localStorage.getItem(ED_DRAFT_KEY)||'null'); if(o){edLoadObj(o);edRenderSide();edDraw();} } catch(_) {} }
  function edOpenLevel(idx: number) { const lv=LEVELS[idx]; if(!lv) return; edLoadObj(levelToEditorObj(lv)); edRenderSide(); edDraw(); }

  function edPlayTest() {
    if (!ED.runways.length || !ED.hangars.length) return;
    curBiome=null; curBonus=null; survival=false;
    levelIdx=-1; levelKey='editor'; LV=edToLevel();
    bays=[]; runways=[]; layout();
    testFromEditor = true;
    edHideScreen(); inMenu=false; reset();
  }

  // ---- side-panel helpers ----
  function edBtn(label: string, on: boolean, cb: ()=>void) {
    const b=document.createElement('button'); b.className='m-btn m-btn--ghost m-btn--sm'+(on?' ed-on':'');
    b.textContent=label; b.onclick=cb; return b;
  }
  function edRow(label: string) {
    const r=document.createElement('div'); r.className='ed-row';
    const l=document.createElement('span'); l.className='ed-row__l'; l.textContent=label;
    r.appendChild(l); return r;
  }
  function edNumIn(val: number, min: number, max: number, step: number, onChange: (v:number)=>void) {
    const inp=document.createElement('input'); inp.type='number'; inp.min=String(min); inp.max=String(max); inp.step=String(step);
    inp.value=String(val); inp.className='ed-range'; inp.style.width='72px';
    inp.oninput=()=>{ const v=Math.max(min,Math.min(max,+inp.value||min)); onChange(v); };
    return inp;
  }
  function edOut(text: string) { return Object.assign(document.createElement('span'),{className:'ed-out',textContent:text}); }

  // ---- side panel render ----
  function edRenderSide() {
    const side=edEl('edSide'); if(!side) return; side.innerHTML='';

    // palette
    const add=document.createElement('div'); add.className='ed-card';
    add.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Добавить'}));
    const ar=document.createElement('div'); ar.className='ed-row';
    (['fuel','board','repair'] as const).forEach(tp=>ar.appendChild(edBtn('+ '+(ED_LABEL[tp]||tp), false, ()=>edAddHangar(tp))));
    ar.appendChild(edBtn('+ ВПП', false, edAddRunway));
    add.appendChild(ar); side.appendChild(add);

    // open level
    const opn=document.createElement('div'); opn.className='ed-card';
    opn.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Открыть уровень'}));
    const lsel=document.createElement('select'); lsel.className='ed-sel'; lsel.style.width='100%';
    lsel.innerHTML='<option value="">— L1..L'+LEVELS.length+' —</option>'+LEVELS.map((_,i)=>'<option value="'+i+'">L'+(i+1)+' · '+levelName(i)+'</option>').join('');
    lsel.onchange=()=>{ if(lsel.value!=='') edOpenLevel(+lsel.value); };
    opn.appendChild(lsel); side.appendChild(opn);

    // status
    const warn=edWarnings(); const st=edEl('edStatus');
    if (st&&st.textContent&&/сохранён|экспортировано/.test(st.textContent)) {}
    else if (st) st.textContent=warn.length?('⚠ '+warn.length):'✓ валидна';

    // HANGAR inspector
    if (ED.sel&&ED.sel.kind==='hangar') {
      const h=ED.hangars[ED.sel.i];
      const insp=document.createElement('div'); insp.className='ed-card';
      insp.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Ангар: '+(ED_LABEL[h.type]||h.type)}));

      const tr=edRow('Тип');
      SVC_TYPES.forEach(tp=>tr.appendChild(edBtn(ED_LABEL[tp]||tp, h.type===tp, ()=>{h.type=tp;edRenderSide();edDraw();})));
      insp.appendChild(tr);

      const or=edRow('На старте');
      or.appendChild(edBtn('открыт',  h.open,  ()=>{h.open=true;  edRenderSide();edDraw();}));
      or.appendChild(edBtn('закрыт', !h.open, ()=>{h.open=false; edRenderSide();edDraw();}));
      insp.appendChild(or);

      if (!h.open) {
        const ocr=edRow('Цена открытия');
        const ocOut=edOut(h.openCost?String(h.openCost):'глобальная');
        ocr.appendChild(edNumIn(h.openCost,0,9999,50,v=>{h.openCost=v;ocOut.textContent=v?String(v):'глобальная';}));
        ocr.appendChild(ocOut); insp.appendChild(ocr);
      }

      const gr=edRow('Ворота');
      (['auto','up','down','left','right'] as EdHangar['gate'][]).forEach(g2=>gr.appendChild(edBtn(ED_GATE_LABELS[g2],h.gate===g2,()=>{h.gate=g2;edRenderSide();edDraw();})));
      insp.appendChild(gr);

      const dr=document.createElement('div'); dr.className='ed-row';
      dr.appendChild(edBtn('🗑 удалить',false,edDeleteSel)); insp.appendChild(dr);
      side.appendChild(insp);

    // RUNWAY inspector
    } else if (ED.sel&&ED.sel.kind==='runway') {
      const r=ED.runways[ED.sel.i];
      const insp=document.createElement('div'); insp.className='ed-card';
      insp.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'ВПП'}));
      insp.appendChild(Object.assign(document.createElement('div'),{className:'ed-row__l',textContent:'Тяни вверх/вниз. Борты заходят справа →'}));

      const lr=edRow('Посадка');
      lr.appendChild(edBtn('открыта',  r.landingOpen,  ()=>{r.landingOpen=true;  edRenderSide();edDraw();}));
      lr.appendChild(edBtn('закрыта', !r.landingOpen, ()=>{r.landingOpen=false; edRenderSide();edDraw();}));
      insp.appendChild(lr);

      const lcR=edRow('Цена посадки');
      const lcOut=edOut(r.landingCost?String(r.landingCost):'бесплатно');
      lcR.appendChild(edNumIn(r.landingCost,0,9999,50,v=>{r.landingCost=v;lcOut.textContent=v?String(v):'бесплатно';}));
      lcR.appendChild(lcOut); insp.appendChild(lcR);

      const tr2=edRow('Взлёт');
      tr2.appendChild(edBtn('открыт',  r.takeoffOpen,  ()=>{r.takeoffOpen=true;  edRenderSide();edDraw();}));
      tr2.appendChild(edBtn('закрыт', !r.takeoffOpen, ()=>{r.takeoffOpen=false; edRenderSide();edDraw();}));
      insp.appendChild(tr2);

      const tcR=edRow('Цена взлёта');
      const tcOut=edOut(r.takeoffCost?String(r.takeoffCost):'бесплатно');
      tcR.appendChild(edNumIn(r.takeoffCost,0,9999,50,v=>{r.takeoffCost=v;tcOut.textContent=v?String(v):'бесплатно';}));
      tcR.appendChild(tcOut); insp.appendChild(tcR);

      const dr=document.createElement('div'); dr.className='ed-row';
      dr.appendChild(edBtn('🗑 удалить',false,edDeleteSel)); insp.appendChild(dr);
      side.appendChild(insp);

    } else {
      const insp=document.createElement('div'); insp.className='ed-card';
      insp.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Ничего не выбрано'}));
      insp.appendChild(Object.assign(document.createElement('div'),{className:'ed-row__l',textContent:'Добавь элемент из палитры и тяни по экрану. Тап — выбрать.'}));
      side.appendChild(insp);
    }

    // LEVEL settings — card "Борты" (plane services + upgrades + objectives)
    const lvl=document.createElement('div'); lvl.className='ed-card';
    lvl.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Борты'}));

    const sr2=edRow('Услуги');
    SVC_TYPES.forEach(tp=>sr2.appendChild(edBtn(ED_LABEL[tp]||tp, ED.services.includes(tp), ()=>{
      const on=ED.services.includes(tp);
      if(on&&ED.services.length>1) ED.services=ED.services.filter(s=>s!==tp); else if(!on) ED.services.push(tp);
      edRenderSide();
    }))); lvl.appendChild(sr2);

    const upEnR=edRow('Апгрейды');
    upEnR.appendChild(edBtn('вкл',  ED.upgradesEnabled,  ()=>{ED.upgradesEnabled=true;  edRenderSide();edDraw();}));
    upEnR.appendChild(edBtn('выкл', !ED.upgradesEnabled, ()=>{ED.upgradesEnabled=false; edRenderSide();edDraw();}));
    lvl.appendChild(upEnR);

    if (ED.upgradesEnabled) {
      const mr=edRow('Макс. уровень ↑');
      const depSl=document.createElement('input'); depSl.type='range'; depSl.min='0'; depSl.max=String(K.BAY_MAX_LVL); depSl.step='1'; depSl.value=String(ED.maxUp); depSl.className='ed-range';
      const depOut=edOut(String(ED.maxUp));
      depSl.oninput=()=>{ ED.maxUp=+depSl.value; depOut.textContent=String(ED.maxUp); edDraw(); };
      mr.appendChild(depSl); mr.appendChild(depOut); lvl.appendChild(mr);

      const upCR=edRow('Цена ↑');
      const ucOut=edOut(ED.upgradeCost?String(ED.upgradeCost):'по умолчанию');
      upCR.appendChild(edNumIn(ED.upgradeCost,0,9999,10,v=>{ED.upgradeCost=v;ucOut.textContent=v?String(v):'по умолчанию';}));
      upCR.appendChild(ucOut); lvl.appendChild(upCR);
    }

    const cR=edRow('Комбо');
    cR.appendChild(edBtn('вкл',  ED.combo,  ()=>{ED.combo=true;  edRenderSide();}));
    cR.appendChild(edBtn('выкл', !ED.combo, ()=>{ED.combo=false; edRenderSide();}));
    lvl.appendChild(cR);

    const exR=edRow('Экспресс');
    exR.appendChild(edBtn('вкл',  ED.express,  ()=>{ED.express=true;  edRenderSide();}));
    exR.appendChild(edBtn('выкл', !ED.express, ()=>{ED.express=false; edRenderSide();}));
    lvl.appendChild(exR);

    const paceR=edRow('Темп');
    const paceSl=document.createElement('input'); paceSl.type='range'; paceSl.min='0'; paceSl.max='1'; paceSl.step='0.02'; paceSl.value=String(ED.pace); paceSl.className='ed-range';
    const paceOut=edOut(ED.pace.toFixed(2));
    paceSl.oninput=()=>{ ED.pace=+paceSl.value; paceOut.textContent=ED.pace.toFixed(2); };
    paceR.appendChild(paceSl); paceR.appendChild(paceOut); lvl.appendChild(paceR);

    const smR=edRow('Старт $');
    const smOut=edOut(String(ED.startMoney));
    smR.appendChild(edNumIn(ED.startMoney,0,9999,10,v=>{ED.startMoney=v;smOut.textContent=String(v);}));
    smR.appendChild(smOut); lvl.appendChild(smR);

    const metR=edRow('Цель');
    metR.appendChild(edBtn('принято',  ED.objective.metric==='served',   ()=>{ED.objective.metric='served';   edRenderSide();}));
    metR.appendChild(edBtn('апгрейды', ED.objective.metric==='upgrades', ()=>{ED.objective.metric='upgrades'; edRenderSide();}));
    lvl.appendChild(metR);

    const s1R=edRow('1★'); s1R.appendChild(edNumIn(ED.objective.star1,1,999,1,v=>{ED.objective.star1=v;})); lvl.appendChild(s1R);
    const s2R=edRow('2★'); s2R.appendChild(edNumIn(ED.objective.star2,1,999,1,v=>{ED.objective.star2=v;})); lvl.appendChild(s2R);
    const s3R=edRow('3★'); s3R.appendChild(edNumIn(ED.objective.star3,1,999,1,v=>{ED.objective.star3=v;})); lvl.appendChild(s3R);

    const tmR=edRow('Таймер (сек)');
    const tmOut=edOut(ED.objective.timerSecs?String(ED.objective.timerSecs)+' с':'выкл');
    tmR.appendChild(edNumIn(ED.objective.timerSecs,0,3600,30,v=>{ED.objective.timerSecs=v;tmOut.textContent=v?String(v)+' с':'выкл';if(!v)ED.objective.raceMode=false;edRenderSide();}));
    tmR.appendChild(tmOut); lvl.appendChild(tmR);

    if (ED.objective.timerSecs>0) {
      const raceR=edRow('Гонка');
      raceR.appendChild(edBtn('вкл',  ED.objective.raceMode,  ()=>{ED.objective.raceMode=true;  edRenderSide();}));
      raceR.appendChild(edBtn('выкл', !ED.objective.raceMode, ()=>{ED.objective.raceMode=false; edRenderSide();}));
      lvl.appendChild(raceR);
    }

    const cr=edRow('Элементы');
    cr.appendChild(edOut(ED.hangars.length+' ангаров · '+ED.runways.length+' ВПП'));
    lvl.appendChild(cr); side.appendChild(lvl);

    // LEVEL settings — card "Условия" (weather, events)
    const cond=document.createElement('div'); cond.className='ed-card';
    cond.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'Условия'}));

    const evR=edRow('VIP');        evR.appendChild(edBtn('вкл', ED.evVip,       ()=>{ED.evVip=!ED.evVip;             edRenderSide();})); cond.appendChild(evR);
    const emR=edRow('Аварийный');  emR.appendChild(edBtn('вкл', ED.evEmergency, ()=>{ED.evEmergency=!ED.evEmergency; edRenderSide();})); cond.appendChild(emR);
    const medR=edRow('Медицинский'); medR.appendChild(edBtn('вкл', ED.evMedical,()=>{ED.evMedical=!ED.evMedical;   edRenderSide();})); cond.appendChild(medR);
    const rushR=edRow('Час пик');  rushR.appendChild(edBtn('вкл', ED.evRush,    ()=>{ED.evRush=!ED.evRush;         edRenderSide();})); cond.appendChild(rushR);

    const wR=edRow('Погода');  wR.appendChild(edBtn('вкл', ED.weather, ()=>{ED.weather=!ED.weather; edRenderSide();})); cond.appendChild(wR);
    const dR=edRow('Де-айсинг'); dR.appendChild(edBtn('вкл', ED.deice, ()=>{ED.deice=!ED.deice;   edRenderSide();})); cond.appendChild(dR);
    side.appendChild(cond);

    if (warn.length) {
      const wc=document.createElement('div'); wc.className='ed-card ed-warn';
      wc.appendChild(Object.assign(document.createElement('div'),{className:'ed-card__t',textContent:'⚠ Проверь'}));
      warn.forEach(x=>wc.appendChild(Object.assign(document.createElement('div'),{className:'ed-row__l',textContent:'• '+x})));
      side.appendChild(wc);
    }
  }

  // ---- new map ----
  function edNewMap() {
    ED.hangars = [];
    ED.runways = [{ y: 0.5, landingOpen: true, landingCost: 0, takeoffOpen: true, takeoffCost: 0 }];
    ED.services = SVC_TYPES.slice(); ED.maxUp = K.BAY_MAX_LVL;
    ED.upgradesEnabled = true; ED.upgradeCost = 0;
    ED.pace = 0.4; ED.startMoney = K.START_MONEY;
    ED.objective = { metric: 'served', star1: 6, star2: 8, star3: 10, timerSecs: 0, raceMode: false };
    ED.evVip = false; ED.evEmergency = false; ED.evMedical = false; ED.evRush = false;
    ED.weather = false; ED.deice = false; ED.combo = true; ED.express = true;
    ED.sel = null;
    edRenderSide(); edDraw();
  }

  // ---- phone size buttons ----
  function edUpdateSzBtns() {
    (['S','M','L'] as const).forEach(sz => {
      const b = edEl('edSz'+sz); if (b) b.classList.toggle('ed-on', ED.phoneSize === sz);
    });
  }

  // ---- open / close ----
  function edHideScreen() { const s=edEl('editorScreen'); if(s) s.classList.add('hidden'); }
  function edOpen() {
    inMenu=true; running=false; paused=false;
    if (typeof hideAllScreens==='function') hideAllScreens();
    const scr=edEl('editorScreen'); if(!scr) return; scr.classList.remove('hidden');
    ED.cv=edEl<HTMLCanvasElement>('edCanvas'); if(ED.cv) ED.g=ED.cv.getContext('2d');
    edUpdateSzBtns(); edRenderSide();
    requestAnimationFrame(()=>{ edResize(); });
  }
  function edClose() { edHideScreen(); if(typeof showStart==='function') showStart(); }

  // ---- wire ----
  (function edWire() {
    const open=edEl('edOpenBtn');  if(open)  open.onclick=edOpen;
    const close=edEl('edCloseBtn'); if(close) close.onclick=edClose;
    const test=edEl('edTestBtn');  if(test)  test.onclick=edPlayTest;
    const exp=edEl('edExportBtn'); if(exp)   exp.onclick=edExport;
    const newBtn=edEl('edNewBtn'); if(newBtn) newBtn.onclick=()=>{
      if(confirm('Удалить черновик и начать новую карту?')) edNewMap();
    };

    // phone-size toggle
    (['S','M','L'] as const).forEach(sz => {
      const b=edEl('edSz'+sz);
      if (b) b.onclick=()=>{ ED.phoneSize=sz; edUpdateSzBtns(); edResize(); };
    });

    const cv=edEl<HTMLCanvasElement>('edCanvas');
    if (cv) {
      cv.addEventListener('pointerdown', edDown);
      cv.addEventListener('pointermove', edMove);
      window.addEventListener('pointerup', edUp);
    }
    window.addEventListener('resize', ()=>{ const s=edEl('editorScreen'); if(s&&!s.classList.contains('hidden')) edResize(); });
  })();

  if (typeof location!=='undefined' && /[?&]test=1(?:&|$)/.test(location.search)) {
    (window as any).__EDITOR = { ED, edLayoutObj, edToLevel, edWarnings, edLoadObj };
  }
