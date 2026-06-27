  /* ── Layout designer (field / zone editor) ──────────────────────────────
     Standalone visual editor: drag the apron, runways, hangars and the
     arrival zone on a phone-shaped canvas, resize the zones, then export a
     layout-JSON compatible with LEVELS[].layout in 04-config-levels.ts.
     Mostly self-contained — the one exception is the UI-reserved zone (HUD /
     pause button), which it reads from the game's safetyRects so objects can't
     be placed there (see reservedRectsPx / hitsReserved). */
  (function () {
    const cv = document.getElementById('ly-canvas');
    if (!cv) return;
    const g = cv.getContext('2d');

    const HANGAR = {
      fuel:   { label: 'топливо', col: '#22e3c6' },
      board:  { label: 'борт',    col: '#ff8db0' },
      repair: { label: 'ремонт',  col: '#ffc14d' },
    };
    const EVENTS = [ ['vip','VIP'], ['emergency','авария'], ['medical','медицина'], ['rush','час пик'] ];
    // все типы событий (для вкладки «Сложность» и экспорта): + туман/ветер
    const ALL_EVENTS = ['vip','emergency','medical','rush','fog','wind'];
    const RW_COL = '#3ad2ff';
    // зоны под скины (вкладка «Ресурсы»): порядок = порядок в UI и в экспорте
    const SKIN_ZONES = ['hangar', 'apron', 'runway', 'plane', 'arrival', 'background'];
    const defaultSkins = () => SKIN_ZONES.reduce((o, z) => (o[z] = 'default', o), {});
    const HANDLE = 9;                     // zone resize-handle hit size, px
    const Z_MIN  = 0.06;                  // smallest zone edge, normalized
    const LS_KEY  = 'pf_tuning_layout_v1';     // legacy single-layout (migrated → templates)
    const TPL_KEY = 'pf_tuning_templates_v1';  // { active, items: { name: LE } }
    const LAY_KEY = 'pf_tuning_layers_v1';     // view layer visibility + grid/snap
    const SNAP    = 0.02;                      // snap step, normalized

    const DEFAULTS = () => ({
      apron:   { x: 0.035, y: 0.17, w: 0.585, h: 0.74 },
      arrival: { x: 0.855, y: 0.17, w: 0.13,  h: 0.74 },
      hangars: [
        { type: 'fuel',   x: 0.22, y: 0.18, open: true, gate: 'auto' },
        { type: 'board',  x: 0.55, y: 0.18, open: true, gate: 'auto' },
        { type: 'repair', x: 0.22, y: 0.82, open: true, gate: 'auto' },
      ],
      runways: [
        { y: 0.34, landingOpen: true, takeoffOpen: true },
        { y: 0.70, landingOpen: true, takeoffOpen: true },
      ],
      pace: 0.4, startMoney: 0, maxUp: 3, minUp: 0, stars: [6, 8, 10],
      events: { vip: false, emergency: false, medical: false, rush: false, fog: false, wind: false },
      // вкладка «Сложность» — расширенные ручки (0/false = дефолт движка, в JSON не пишутся)
      metric: 'served', time: 0, race: false,
      weather: false, deice: false, calm: 0,
      crashPenalty: 0, latePenalty: 0,
      openCost: 0, upgCost: 0, rwOpenCost: 0,         // цена бокса / апгрейда / открытия полосы (0 = дефолт)
      cond: { money: null, lives: null, upg: null, timeTier: null, maxLate: null, maxCrash: null },  // доп-условия звёзд (null = выкл)
      // оформление (таб «Ресурсы»): примеряется на превью воркбенча, выбор едет в JSON.
      // Имя = stable id скина из реестра assets/skins/index.json ('default' = без скина).
      skins: defaultSkins(),
    });

    const BLANK = () => { const d = DEFAULTS(); d.hangars = []; d.runways = []; return d; };
    const clone = o => JSON.parse(JSON.stringify(o));

    let LE = DEFAULTS();
    let sel = null;            // {kind:'apron'|'arrival'|'hangar'|'runway', i?}
    let drag = null;           // active pointer-drag descriptor
    let active = false;        // tab currently visible
    let templates = {};        // name → LE snapshot (field templates, in localStorage)
    let curTpl = '';           // active template name
    let layers = { apron: true, arrival: true, runways: true, hangars: true, gates: true, grid: false, snap: false };
    // оверлей «примерка скинов» (вкладка «Ресурсы»): рисуется поверх редактора, когда
    // вкладка «Скины» активна. images: zone→Image (для hangar — состояние→Image). Геометрия
    // зон та же, что у редактора и игры (1:1) — скин ложится ровно туда, где будет в игре.
    let skinOverlay = { on: false, images: {}, hangarState: 'auto', pips: 0, maxUp: 3, sim: true };

    /* ---- persistence ---- */
    function saveLayers() { try { localStorage.setItem(LAY_KEY, JSON.stringify(layers)); } catch (_) {} }
    function save() {
      try {
        if (curTpl) templates[curTpl] = clone(LE);
        localStorage.setItem(TPL_KEY, JSON.stringify({ active: curTpl, items: templates }));
        localStorage.setItem(LS_KEY, JSON.stringify(LE));    // back-compat: keep last layout
      } catch (_) {}
    }
    function load() {
      // templates
      try {
        const t = JSON.parse(localStorage.getItem(TPL_KEY) || 'null');
        if (t && t.items && typeof t.items === 'object' && Object.keys(t.items).length) {
          templates = t.items;
          curTpl = (t.active && templates[t.active]) ? t.active : Object.keys(templates)[0];
        }
      } catch (_) {}
      // migrate legacy single layout → first template
      if (!Object.keys(templates).length) {
        let base = DEFAULTS();
        try {
          const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
          if (o && o.apron && Array.isArray(o.hangars) && Array.isArray(o.runways)) base = Object.assign(DEFAULTS(), o);
        } catch (_) {}
        curTpl = 'Поле 1'; templates[curTpl] = base;
      }
      LE = Object.assign(DEFAULTS(), clone(templates[curTpl] || DEFAULTS()));
      // layers
      try { const l = JSON.parse(localStorage.getItem(LAY_KEY) || 'null'); if (l && typeof l === 'object') layers = Object.assign(layers, l); } catch (_) {}
    }
    const snapV = v => layers.snap ? Math.round(v / SNAP) * SNAP : v;

    /* ---- geometry (normalized → px) ---- */
    function dims() { return { W: cv.clientWidth || 1, H: cv.clientHeight || 1 }; }
    function rectPx(r) { const { W, H } = dims(); return { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H }; }
    // Геометрия техники — единый источник размеров боксов И ВПП, чтобы «Разметка» и
    // «Тестовая игра» рисовали их одинаково. КЛЮЧЕВОЕ: холст редактора и игровой iframe
    // живут в ОДНОМ шелле телефона, то есть в одном px-масштабе (1:1). Размер бокса в
    // игре НЕ пропорционален ширине поля — он = 31·PLANE_SCALE·ui·RATIO, где `ui` зажат
    // в 0.7–1.5 (06-state-layout). Поэтому пересчёт game-px→editor-px через коэф W/fd.W
    // НЕЛЬЗЯ: пока скрытый iframe ещё не принял размер шелла, fd.W мал, коэф огромен —
    // и боксы раздувались (тот самый баг). Считаем напрямую из размеров ХОЛСТА и тех же
    // коэффициентов K — без какого-либо масштабирования и без зависимости от готовности
    // iframe. K берём из игры, если доступна; иначе дефолты движка (04-config-levels).
    function gameGeom() {
      const { W, H } = dims();
      let K = null;
      try { const fw = gameFrame.contentWindow; K = fw && fw.__GAME && fw.__GAME.K; } catch (_) {}
      const ps  = (K && +K.PLANE_SCALE)  || 1;
      const hr  = (K && +K.HANGAR_RATIO) || 2.5;   // фолбэк = дефолт движка (04-config-levels)
      const rr  = (K && +K.RUNWAY_RATIO) || 1.6;   // фолбэк = дефолт движка (04-config-levels)
      const rwr = (K && +K.RUNWAY_R)     || 0.84;
      const ui = Math.max(0.7, Math.min(1.5, Math.min(W / 1100, H / 620)));  // как в игре
      return { plane: 31 * ps * ui, hr, rr, rwr };   // plane = длина борта (px холста = px игры)
    }
    // Сторона бокса — КВАДРАТНАЯ и привязана к размеру борта так же, как в игре
    // (PR #222: сторона ангара = длина борта × K.HANGAR_RATIO). Меняешь масштаб борта
    // в «Движении» (K.PLANE_SCALE) — бокс в превью меняется вместе с игрой.
    function hangarSidePx() {
      const ap = rectPx(LE.apron);
      const gm = gameGeom();
      return Math.min(gm.plane * gm.hr, ap.w / 2.4);   // тот же потолок, что и в игре (не съедать апрон)
    }
    function hangarPx(h) {
      const ap = rectPx(LE.apron);
      const s = hangarSidePx();
      const cx = ap.x + h.x * ap.w, cy = ap.y + h.y * ap.h;
      // как в игре (06-state-layout: b.x/b.y зажаты в field) — бокс не вылезает за
      // апрон, иначе в превью ангар у края торчит наружу, а в тестовой игре он внутри.
      const x = Math.max(ap.x, Math.min(ap.x + ap.w - s, cx - s / 2));
      const y = Math.max(ap.y, Math.min(ap.y + ap.h - s, cy - s / 2));
      return { x, y, w: s, h: s, cx, cy };
    }
    // Ширина (высота на холсте) ВПП привязана к размеру борта так же, как в игре
    // (06-state-layout: rh = длина борта × K.RUNWAY_RATIO) — иначе ВПП на «Разметке»
    // и в «Тестовой игре» получались разного размера. Та же формула из коэффициентов.
    // Левый край: rwL = fx1 - 8*ui (заходит на 8*ui px внутрь апрона — как в игре).
    // Правый край: rwR = W*K.RUNWAY_R — параметризован; читаем K из игры как остальные.
    function runwayPx(r) {
      const ap = rectPx(LE.apron), { W, H } = dims();
      const gm = gameGeom();
      const ui = Math.max(0.7, Math.min(1.5, Math.min(W / 1100, H / 620)));
      const hh = gm.plane * gm.rr;
      const cy = ap.y + r.y * ap.h;
      const x = ap.x + ap.w - 8 * ui;   // совпадает с rwL = fx1 - 8*ui в игре
      const right = W * gm.rwr;          // совпадает с rwR = W*K.RUNWAY_R в игре
      return { x, y: cy - hh / 2, w: right - x, h: hh, cy };
    }
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const clampZone = z => { z.w = Math.max(Z_MIN, Math.min(1, z.w)); z.h = Math.max(Z_MIN, Math.min(1, z.h)); z.x = Math.max(0, Math.min(1 - z.w, z.x)); z.y = Math.max(0, Math.min(1 - z.h, z.y)); };

    /* ---- UI-reserved zone (untouchable) ----
       Read the game's UI-reserved rects (HUD + pause button) and scale them into
       this canvas's px space. Objects can't be dragged into these, and they're
       painted as a solid fill so it's obvious nothing goes there. Empty when the
       game iframe isn't ready — then there's simply no constraint. */
    function reservedRectsPx() {
      try {
        const fd = gameFrame.contentWindow && gameFrame.contentWindow.__FIELD;
        const sr = fd && fd.safetyRects;
        if (!sr || !fd.W || !fd.H) return [];
        const { W, H } = dims();
        const sx = W / fd.W, sy = H / fd.H;
        const out = [];
        const push = (r, label) => { if (r && r.w > 0 && r.h > 0) out.push({ x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy, label: r.label || label }); };
        // HUD + кнопка паузы (как было)
        (sr.uiReservedRects || []).forEach(r => push(r, 'UI'));
        // вырез камеры / чёлка
        push(sr.cutoutRect, 'вырез');
        // зоны android-жестов по краям экрана (left/right свайпы, домой/назад снизу)
        const gi = sr.gestureInsets;
        if (gi) {
          if (gi.l > 0) push({ x: 0,           y: 0,           w: gi.l, h: fd.H }, 'жест');
          if (gi.r > 0) push({ x: fd.W - gi.r, y: 0,           w: gi.r, h: fd.H }, 'жест');
          if (gi.t > 0) push({ x: 0,           y: 0,           w: fd.W, h: gi.t }, 'жест');
          if (gi.b > 0) push({ x: 0,           y: fd.H - gi.b, w: fd.W, h: gi.b }, 'жест');
        }
        // системные safe-area отступы (скругления углов, сторона выреза)
        const sa = sr.safeAreaInsets;
        if (sa) {
          if (sa.l > 0) push({ x: 0,           y: 0,           w: sa.l, h: fd.H }, 'отступ');
          if (sa.r > 0) push({ x: fd.W - sa.r, y: 0,           w: sa.r, h: fd.H }, 'отступ');
          if (sa.t > 0) push({ x: 0,           y: 0,           w: fd.W, h: sa.t }, 'отступ');
          if (sa.b > 0) push({ x: 0,           y: fd.H - sa.b, w: fd.W, h: sa.b }, 'отступ');
        }
        return out;
      } catch (_) { return []; }
    }
    function hitsReserved(box) {
      if (!box) return false;
      return reservedRectsPx().some(r =>
        box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y);
    }
    // Боксы не должны налезать друг на друга: вплотную (встык) — можно, перекрытие — нет.
    // EPS даёт допуск, чтобы касание край-в-край не считалось пересечением.
    function boxesOverlap(a, b) {
      const EPS = 0.5;
      return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS &&
             a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
    }
    function hitsOtherHangar(idx) {
      if (idx == null || !LE.hangars[idx]) return false;
      const me = hangarPx(LE.hangars[idx]);
      return LE.hangars.some((h, i) => i !== idx && boxesOverlap(me, hangarPx(h)));
    }
    // px box of whatever a drag descriptor is currently moving/resizing
    function dragBoxPx(d) {
      if (!d) return null;
      if (d.mode === 'move-obj') return d.kind === 'hangar' ? hangarPx(LE.hangars[d.i]) : runwayPx(LE.runways[d.i]);
      return rectPx(d.kind === 'apron' ? LE.apron : LE.arrival);
    }

    /* ---- draw ---- */
    function resize() {
      if (!active) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) { requestAnimationFrame(resize); return; }
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2); g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    function zoneHandles(z) {
      const r = rectPx(z), mx = r.x + r.w / 2, my = r.y + r.h / 2;
      return {
        nw: { x: r.x, y: r.y }, n: { x: mx, y: r.y }, ne: { x: r.x + r.w, y: r.y },
        e:  { x: r.x + r.w, y: my }, se: { x: r.x + r.w, y: r.y + r.h }, s: { x: mx, y: r.y + r.h },
        sw: { x: r.x, y: r.y + r.h }, w: { x: r.x, y: my },
      };
    }
    function drawGrid() {
      const { W, H } = dims(), step = SNAP;
      g.strokeStyle = 'rgba(58,210,255,.07)'; g.lineWidth = 1;
      for (let f = step; f < 1; f += step) {
        const x = Math.round(f * W) + .5, y = Math.round(f * H) + .5;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      }
    }
    function draw() {
      const { W, H } = dims();
      g.clearRect(0, 0, W, H);
      // screen frame backdrop
      g.fillStyle = '#04080f'; g.fillRect(0, 0, W, H);
      if (skinOverlay.on) drawBgSkin();   // декоративный фон-скин рисуется ПОД зонами
      if (layers.grid) drawGrid();
      g.strokeStyle = 'rgba(58,210,255,.18)'; g.lineWidth = 1; g.strokeRect(.5, .5, W - 1, H - 1);

      // arrival zone (right, air) — «опасная» зона
      if (layers.arrival) {
        const arr = rectPx(LE.arrival);
        g.fillStyle = 'rgba(245,200,66,.07)';
        g.fillRect(arr.x, arr.y, arr.w, arr.h);
        g.strokeStyle = 'rgba(245,200,66,.5)'; g.setLineDash([5, 4]); g.lineWidth = 1.4;
        g.strokeRect(arr.x, arr.y, arr.w, arr.h); g.setLineDash([]);
        g.fillStyle = 'rgba(245,200,66,.85)'; g.font = '10px system-ui';
        g.fillText('прилёт', arr.x + 5, arr.y + 13);
      }

      // runways (between apron & arrival)
      if (layers.runways) LE.runways.forEach((r, i) => {
        const b = runwayPx(r), on = sel && sel.kind === 'runway' && sel.i === i;
        g.fillStyle = 'rgba(58,130,255,.10)'; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = on ? '#fff' : RW_COL; g.lineWidth = on ? 2 : 1.4;
        g.strokeRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([6, 5]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(b.x, b.cy); g.lineTo(b.x + b.w, b.cy); g.stroke(); g.setLineDash([]);
        g.fillStyle = RW_COL; g.font = '9px system-ui';
        let tag = 'ВПП' + (i + 1);
        if (!r.landingOpen) tag += ' ⊘пос'; if (!r.takeoffOpen) tag += ' ⊘взл';
        g.fillText(tag, b.x + 4, b.y + b.h - 4);
      });

      // apron — «безопасная» зона
      if (layers.apron) {
        const ap = rectPx(LE.apron), apOn = sel && sel.kind === 'apron';
        g.fillStyle = 'rgba(34,227,198,.06)'; roundRect(ap.x, ap.y, ap.w, ap.h, 10); g.fill();
        g.strokeStyle = apOn ? '#fff' : 'rgba(34,227,198,.55)'; g.lineWidth = apOn ? 2 : 1.5;
        roundRect(ap.x, ap.y, ap.w, ap.h, 10); g.stroke();
        g.fillStyle = 'rgba(34,227,198,.7)'; g.font = '10px system-ui';
        g.fillText('апрон', ap.x + 6, ap.y + 14);
      }

      // hangars
      if (layers.hangars) LE.hangars.forEach((h, i) => {
        const b = hangarPx(h), tone = (HANGAR[h.type] || HANGAR.fuel).col;
        const on = sel && sel.kind === 'hangar' && sel.i === i;
        g.fillStyle = h.open ? tone + '33' : 'rgba(120,120,120,.18)';
        roundRect(b.x, b.y, b.w, b.h, 5); g.fill();
        g.strokeStyle = on ? '#fff' : (h.open ? tone : 'rgba(200,200,200,.45)');
        g.lineWidth = on ? 2 : 1.4; roundRect(b.x, b.y, b.w, b.h, 5); g.stroke();
        g.fillStyle = h.open ? tone : 'rgba(220,220,220,.6)'; g.font = '9px system-ui';
        g.fillText((HANGAR[h.type] || {}).label || h.type, b.x + 4, b.y + 11);
        if (!h.open) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('🔒', b.x + b.w - 13, b.y + 12); }
        // gate arrow
        const dir = layers.gates ? gateDir(h) : null;
        if (dir) {
          const cx = b.cx, cy = b.cy, len = 11;
          g.strokeStyle = on ? '#fff' : tone; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dir.x * len, cy + dir.y * len); g.stroke();
        }
      });

      // UI-reserved zone (HUD / pause) — solid fill, drawn on top: nothing goes here
      reservedRectsPx().forEach(r => {
        g.fillStyle = 'rgba(255,220,0,.5)';
        g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeStyle = 'rgba(255,220,0,.95)'; g.lineWidth = 1.5;
        g.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
        g.fillStyle = 'rgba(40,30,0,.9)'; g.font = '9px system-ui';
        g.fillText(r.label || 'UI', r.x + 4, r.y + 11);
      });

      // selected-zone handles
      if (sel && (sel.kind === 'apron' || sel.kind === 'arrival') && layers[sel.kind === 'apron' ? 'apron' : 'arrival']) {
        const hs = zoneHandles(sel.kind === 'apron' ? LE.apron : LE.arrival);
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(34,227,198,.9)'; g.lineWidth = 1;
        Object.values(hs).forEach(p => { g.fillRect(p.x - HANDLE / 2, p.y - HANDLE / 2, HANDLE, HANDLE); g.strokeRect(p.x - HANDLE / 2, p.y - HANDLE / 2, HANDLE, HANDLE); });
      }

      if (skinOverlay.on) drawSkinOverlay();   // примерка скинов зон поверх редактора
    }
    function gateDir(h) {
      const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      if (h.gate && h.gate !== 'auto') return map[h.gate];
      // auto: point toward nearest apron edge
      const d = [['up', h.y], ['down', 1 - h.y], ['left', h.x], ['right', 1 - h.x]].sort((a, b) => a[1] - b[1]);
      return map[d[0][0]];
    }

    /* ---- skins preview (вкладка «Ресурсы») ----
       Живая геометрия зон + отрисовка скинов в их прямоугольники. Та же геометрия, что
       у редактора и игры (1:1), поэтому скин примеряется ровно на месте будущего объекта. */
    function zoneSpec() {
      const { W, H } = dims(), gm = gameGeom();
      const ui = Math.max(0.7, Math.min(1.5, Math.min(W / 1100, H / 620)));
      const R = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
      return {
        canvas: { W: Math.round(W), H: Math.round(H) },
        ui: +ui.toFixed(2),
        planeLen: Math.round(gm.plane),
        hangarSide: Math.round(hangarSidePx()), hangarRatio: gm.hr,
        runwayH: Math.round(gm.plane * gm.rr), runwayRatio: gm.rr,
        apron: R(rectPx(LE.apron)), arrival: R(rectPx(LE.arrival)),
        hangars: LE.hangars.map(h => ({ type: h.type, open: !!h.open, rect: R(hangarPx(h)) })),
        runways: LE.runways.map(r => ({ rect: R(runwayPx(r)) })),
      };
    }
    // Экспортирует геометрию холста разметки в формате window.__FIELD (как игра),
    // чтобы 13-zones-overlay мог показывать зоны захвата и ручки даже в режиме «Разметка».
    window._layoutField = function () {
      const { W, H } = dims();
      if (W <= 1 || H <= 1) return null;
      const gm = gameGeom();
      const ui = Math.max(0.7, Math.min(1.5, Math.min(W / 1100, H / 620)));
      function autoGate(h) {
        if (h.gate && h.gate !== 'auto') return h.gate;
        const d = [['up', h.y], ['down', 1 - h.y], ['left', h.x], ['right', 1 - h.x]];
        d.sort(function (a, b) { return a[1] - b[1]; });
        return d[0][0];
      }
      return {
        W: W, H: H, ui: ui, planeLen: gm.plane,
        runways: LE.runways.map(function (r) {
          const b = runwayPx(r);
          return { x: b.x, y: b.y, w: b.w, h: b.h, cy: b.cy,
                   stopX: b.x + 26 * ui, exitX: b.x + b.w + 10 * ui,
                   closed: false,
                   landingOpen:  r.landingOpen  !== false,
                   takeoffOpen: r.takeoffOpen !== false };
        }),
        bays: LE.hangars.filter(function (h) { return h.open !== false; }).map(function (h) {
          const b = hangarPx(h);
          return { x: b.x, y: b.y, w: b.w, h: b.h, cx: b.cx, cy: b.cy,
                   open: true, gate: autoGate(h) };
        }),
        planes: [],
      };
    };

    const imgOk = im => im && im.complete && im.naturalWidth > 0;
    function drawBgSkin() {
      const im = skinOverlay.images.background;
      if (!imgOk(im)) return;
      const { W, H } = dims();
      g.drawImage(im, 0, 0, W, H);   // фон растягивается на весь шелл
    }
    function drawHangarSim(b, st) {
      // симуляция накладок движка, чтобы дизайнер видел, что НЕ запекать в панель:
      // точки апгрейда (pips) по центру-низу + замок/цена у закрытого.
      if (st !== 'locked') {
        const total = Math.max(0, skinOverlay.maxUp | 0);
        if (!total) return;
        const dr = 3.2, gp = 4, plW = total * (dr * 2 + gp) + gp, plH = dr * 2 + 6;
        const plX = b.x + b.w / 2 - plW / 2, plY = b.y + b.h - plH - 3;
        roundRect(plX, plY, plW, plH, plH / 2); g.fillStyle = 'rgba(8,14,30,.72)'; g.fill();
        for (let i = 0; i < total; i++) {
          const dx = plX + gp + i * (dr * 2 + gp) + dr;
          g.beginPath(); g.arc(dx, plY + plH / 2, dr, 0, 7);
          g.fillStyle = i < skinOverlay.pips ? '#5de08a' : 'rgba(95,123,176,.35)'; g.fill();
        }
      } else {
        g.fillStyle = 'rgba(245,200,66,.92)'; g.font = '10px system-ui';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🔒 100', b.x + b.w / 2, b.y + b.h / 2);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }
    }
    function drawSkinOverlay() {
      const im = skinOverlay.images || {};
      if (layers.apron && imgOk(im.apron)) { const r = rectPx(LE.apron); g.drawImage(im.apron, r.x, r.y, r.w, r.h); }
      if (layers.arrival && imgOk(im.arrival)) { const r = rectPx(LE.arrival); g.drawImage(im.arrival, r.x, r.y, r.w, r.h); }
      if (layers.runways && imgOk(im.runway)) LE.runways.forEach(r => { const b = runwayPx(r); g.drawImage(im.runway, b.x, b.y, b.w, b.h); });
      if (layers.hangars) LE.hangars.forEach(h => {
        const b = hangarPx(h);
        const occ = skinOverlay.hangarState === 'occupied';
        const st = !h.open ? 'locked' : (skinOverlay.hangarState === 'auto' || occ ? h.type : skinOverlay.hangarState);
        const hi = im.hangar && im.hangar[st];
        if (imgOk(hi)) g.drawImage(hi, b.x, b.y, b.w, b.h);
        if (h.open && occ && imgOk(im.plane)) { const ps = b.w * 0.62; g.drawImage(im.plane, b.x + b.w / 2 - ps / 2, b.y + b.h / 2 - ps / 2, ps, ps); }
        if (skinOverlay.sim) drawHangarSim(b, st);
      });
    }

    /* ---- hit testing ---- */
    function ptIn(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
    function hitHandle(z, x, y) {
      const hs = zoneHandles(z);
      for (const k in hs) { const p = hs[k]; if (Math.abs(x - p.x) <= HANDLE && Math.abs(y - p.y) <= HANDLE) return k; }
      return null;
    }
    function pick(x, y) {
      // 1) resize handle of currently-selected zone
      if (sel && (sel.kind === 'apron' || sel.kind === 'arrival')) {
        const z = sel.kind === 'apron' ? LE.apron : LE.arrival;
        const h = hitHandle(z, x, y);
        if (h) return { kind: sel.kind, handle: h };
      }
      // 2) hangars (top-most first)
      for (let i = LE.hangars.length - 1; i >= 0; i--) if (ptIn(hangarPx(LE.hangars[i]), x, y)) return { kind: 'hangar', i };
      // 3) runways
      for (let i = LE.runways.length - 1; i >= 0; i--) if (ptIn(runwayPx(LE.runways[i]), x, y)) return { kind: 'runway', i };
      // 4) arrival body, then apron body
      if (ptIn(rectPx(LE.arrival), x, y)) return { kind: 'arrival' };
      if (ptIn(rectPx(LE.apron), x, y)) return { kind: 'apron' };
      return null;
    }
    // Map client coords into the canvas's own logical space. When the canvas sits
    // inside the CSS-scaled phone shell, its on-screen rect is smaller than its
    // logical (clientWidth) size, so divide out that scale — otherwise drags land
    // off-target. Outside the shell the ratio is 1, so this is a no-op there.
    function evPos(e) {
      const r = cv.getBoundingClientRect();
      const sx = (cv.clientWidth  || r.width)  / (r.width  || 1);
      const sy = (cv.clientHeight || r.height) / (r.height || 1);
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    }

    cv.addEventListener('pointerdown', e => {
      const p = evPos(e), hit = pick(p.x, p.y);
      if (!hit) { sel = null; drag = null; renderSide(); draw(); return; }
      const { W, H } = dims();
      if (hit.handle) {
        const z = hit.kind === 'apron' ? LE.apron : LE.arrival;
        drag = { mode: 'resize', kind: hit.kind, handle: hit.handle, start: { x: p.x, y: p.y }, z0: Object.assign({}, z) };
      } else if (hit.kind === 'hangar' || hit.kind === 'runway') {
        sel = { kind: hit.kind, i: hit.i };
        drag = { mode: 'move-obj', kind: hit.kind, i: hit.i, start: { x: p.x, y: p.y } };
      } else {
        sel = { kind: hit.kind };
        const z = hit.kind === 'apron' ? LE.apron : LE.arrival;
        drag = { mode: 'move-zone', kind: hit.kind, start: { x: p.x, y: p.y }, x0: z.x, y0: z.y };
      }
      cv.setPointerCapture(e.pointerId);
      renderSide(); draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = evPos(e), { W, H } = dims();
      const dx = (p.x - drag.start.x) / W, dy = (p.y - drag.start.y) / H;
      // Snapshot the thing being moved so we can revert if it lands in the
      // untouchable UI-reserved zone.
      const prevStart = drag.start;
      let restore = null;
      if (drag.mode === 'move-obj') {
        const arr = drag.kind === 'hangar' ? LE.hangars : LE.runways;
        const snap = Object.assign({}, arr[drag.i]);
        restore = () => Object.assign(arr[drag.i], snap);
      } else {
        const z = drag.kind === 'apron' ? LE.apron : LE.arrival;
        const snap = Object.assign({}, z);
        restore = () => Object.assign(z, snap);
      }
      if (drag.mode === 'move-zone') {
        const z = drag.kind === 'apron' ? LE.apron : LE.arrival;
        z.x = snapV(drag.x0 + dx); z.y = snapV(drag.y0 + dy); clampZone(z);
      } else if (drag.mode === 'resize') {
        const z = drag.kind === 'apron' ? LE.apron : LE.arrival, s = drag.z0, h = drag.handle;
        let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
        if (h.includes('w')) x0 = snapV(clamp01(s.x + dx));
        if (h.includes('e')) x1 = snapV(clamp01(s.x + s.w + dx));
        if (h.includes('n')) y0 = snapV(clamp01(s.y + dy));
        if (h.includes('s')) y1 = snapV(clamp01(s.y + s.h + dy));
        z.x = Math.min(x0, x1 - Z_MIN); z.w = Math.max(Z_MIN, x1 - x0);
        z.y = Math.min(y0, y1 - Z_MIN); z.h = Math.max(Z_MIN, y1 - y0);
        clampZone(z);
      } else if (drag.mode === 'move-obj') {
        const ap = LE.apron;
        if (drag.kind === 'hangar') {
          const o = LE.hangars[drag.i];
          o.x = snapV(clamp01(o.x + dx / ap.w)); o.y = snapV(clamp01(o.y + dy / ap.h));
        } else {
          const o = LE.runways[drag.i];
          o.y = snapV(clamp01(o.y + dy / ap.h));
        }
        drag.start = { x: p.x, y: p.y };
      }
      // Reject the move if it now overlaps the untouchable UI-reserved zone,
      // or (for hangars) overlaps another hangar — встык можно, перекрытие нет.
      const badHangar = drag.mode === 'move-obj' && drag.kind === 'hangar' && hitsOtherHangar(drag.i);
      if (hitsReserved(dragBoxPx(drag)) || badHangar) { restore(); drag.start = prevStart; }
      draw();
    });
    function endDrag(e) { if (!drag) return; drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (_) {} renderSide(); save(); }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    document.addEventListener('keydown', e => {
      if (!active) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && (sel.kind === 'hangar' || sel.kind === 'runway')) {
        const t = e.target; if (t && /input|textarea|select/i.test(t.tagName)) return;
        e.preventDefault(); delSelected();
      }
    });

    /* ---- add / delete ---- */
    function addHangar(type) {
      LE.hangars.push({ type, x: 0.5, y: 0.5, open: true, gate: 'auto' });
      sel = { kind: 'hangar', i: LE.hangars.length - 1 };
      renderSide(); save(); draw();
    }
    function addRunway() {
      const MAX = 4;   // K.RUNWAY_MAX — на карте мин. 1, макс. 4 ВПП
      if (LE.runways.length >= MAX) { setStatus('Максимум ' + MAX + ' ВПП на карте.'); return; }
      const ys = LE.runways.map(r => r.y);
      let y = 0.5; for (let k = 1; k <= 9; k++) { const c = k / 10; if (!ys.some(v => Math.abs(v - c) < 0.05)) { y = c; break; } }
      LE.runways.push({ y, landingOpen: true, takeoffOpen: true });
      sel = { kind: 'runway', i: LE.runways.length - 1 };
      renderSide(); save(); draw();
    }
    function delSelected() {
      if (!sel) return;
      if (sel.kind === 'hangar') LE.hangars.splice(sel.i, 1);
      else if (sel.kind === 'runway') LE.runways.splice(sel.i, 1);
      else return;
      sel = null; renderSide(); save(); draw();
    }

    /* ---- side panel ---- */
    const $ = id => document.getElementById(id);
    function seg(label, opts, cur, on) {
      const wrap = document.createElement('div'); wrap.className = 'ly-prop-row';
      const lab = document.createElement('span'); lab.className = 'lbl-main'; lab.textContent = label; wrap.appendChild(lab);
      const box = document.createElement('div'); box.className = 'ly-seg';
      opts.forEach(([val, txt]) => {
        const b = document.createElement('button'); b.className = 'p-btn' + (val === cur ? ' on' : ''); b.textContent = txt;
        b.addEventListener('click', () => { on(val); });
        box.appendChild(b);
      });
      wrap.appendChild(box); return wrap;
    }
    function toggleRow(label, val, on) {
      const wrap = document.createElement('div'); wrap.className = 'ly-prop-row';
      const lab = document.createElement('span'); lab.className = 'lbl-main'; lab.textContent = label; wrap.appendChild(lab);
      const b = document.createElement('button'); b.className = 'p-btn' + (val ? ' on' : ''); b.textContent = val ? 'да' : 'нет';
      b.style.minWidth = '54px'; b.addEventListener('click', () => on(!val));
      const box = document.createElement('div'); box.className = 'ly-seg'; box.appendChild(b); wrap.appendChild(box); return wrap;
    }
    function readout(label, txt) {
      const wrap = document.createElement('div'); wrap.className = 'ly-prop-row';
      const lab = document.createElement('span'); lab.className = 'lbl-main'; lab.textContent = label; wrap.appendChild(lab);
      const v = document.createElement('span'); v.style.cssText = 'font-size:12px;color:var(--muted)'; v.textContent = txt; wrap.appendChild(v);
      return wrap;
    }
    function renderSelBody() {
      const name = $('ly-sel-name'), body = $('ly-sel-body');
      body.innerHTML = '';
      if (!sel) { name.textContent = '—'; body.innerHTML = '<span class="lab-empty">Кликни объект на холсте.</span>'; return; }
      if (sel.kind === 'hangar') {
        const h = LE.hangars[sel.i]; name.textContent = 'ангар #' + (sel.i + 1);
        body.appendChild(seg('Услуга', [['fuel','топливо'],['board','борт'],['repair','ремонт']], h.type, v => { h.type = v; save(); renderSide(); draw(); }));
        body.appendChild(seg('Ворота', [['auto','авто'],['up','↑'],['down','↓'],['left','←'],['right','→']], h.gate || 'auto', v => { h.gate = v; save(); renderSide(); draw(); }));
        body.appendChild(toggleRow('Открыт на старте', !!h.open, v => { h.open = v; save(); renderSide(); draw(); }));
        body.appendChild(readout('Позиция (% апрона)', Math.round(h.x * 100) + ' · ' + Math.round(h.y * 100)));
      } else if (sel.kind === 'runway') {
        const r = LE.runways[sel.i]; name.textContent = 'ВПП #' + (sel.i + 1);
        body.appendChild(toggleRow('Посадка', !!r.landingOpen, v => { r.landingOpen = v; save(); renderSide(); draw(); }));
        body.appendChild(toggleRow('Взлёт', !!r.takeoffOpen, v => { r.takeoffOpen = v; save(); renderSide(); draw(); }));
        body.appendChild(readout('Позиция Y (% апрона)', Math.round(r.y * 100) + ''));
      } else {
        name.textContent = sel.kind === 'apron' ? 'апрон (зона)' : 'зона прилёта';
        body.innerHTML = '<span class="lab-empty">Двигай мышью; меняй размер за уголки рамки или числами в блоке «Зоны».</span>';
      }
    }
    function zoneEditor(label, key) {
      const z = LE[key], wrap = document.createElement('div');
      wrap.className = 'ly-prop-row';
      const lab = document.createElement('span'); lab.className = 'lbl-main'; lab.textContent = label; wrap.appendChild(lab);
      const box = document.createElement('div'); box.className = 'ly-seg';
      [['x','x'],['y','y'],['w','ш'],['h','в']].forEach(([f, t]) => {
        const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'ly-prop-num';
        inp.style.width = '52px'; inp.min = 0; inp.max = 100; inp.step = 1; inp.title = t;
        inp.value = Math.round(z[f] * 100);
        inp.addEventListener('change', () => {
          let v = Math.max(0, Math.min(100, +inp.value || 0)) / 100; z[f] = v; clampZone(z);
          inp.value = Math.round(z[f] * 100); save(); draw();
        });
        box.appendChild(inp);
      });
      wrap.appendChild(box); return wrap;
    }
    function renderZones() {
      const host = $('ly-zones'); host.innerHTML = '';
      const hint = document.createElement('div');
      hint.className = 'grid-note';
      hint.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:4px';
      hint.textContent = 'x · y · ширина · высота (в % экрана)';
      host.appendChild(hint);
      host.appendChild(zoneEditor('Апрон', 'apron'));
      host.appendChild(zoneEditor('Прилёт', 'arrival'));
    }
    // Параметры черновика (темп/деньги/maxUp/звёзды/события) редактируются в табе
    // «Сложность» (de-*), а не здесь — отдельных контролов в «Разметке»/«Уровни» нет.
    function renderSide() { renderSelBody(); renderZones(); }

    /* ---- field templates + view layers ---- */
    const LAYER_DEFS = [
      ['apron', '🟢 Земля'], ['arrival', '🟡 Небо'],
      ['runways', '✈ ВПП'], ['hangars', '🏠 Ангары'], ['gates', '➤ Ворота'],
      ['grid', '▦ Сетка'], ['snap', '🧲 Привязка'],
    ];
    function renderLayers() {
      const host = $('ly-layers'); if (!host) return; host.innerHTML = '';
      LAYER_DEFS.forEach(([k, txt]) => {
        const c = document.createElement('label'); c.className = 'lab-chip' + (layers[k] ? ' on' : '');
        c.innerHTML = '<input type="checkbox"' + (layers[k] ? ' checked' : '') + '><span>' + txt + '</span>';
        c.addEventListener('click', e => { e.preventDefault(); layers[k] = !layers[k]; saveLayers(); renderLayers(); draw(); });
        host.appendChild(c);
      });
    }
    function renderTpl() {
      const selEl = $('ly-tpl-sel'); if (!selEl) return; selEl.innerHTML = '';
      Object.keys(templates).forEach(name => {
        const o = document.createElement('option'); o.value = name; o.textContent = name;
        if (name === curTpl) o.selected = true; selEl.appendChild(o);
      });
      const fn = $('ly-filename'); if (fn) fn.placeholder = 'aerovia-' + slug(curTpl) + '.json';
    }
    function uniqName(base) { let n = base, k = 2; while (templates[n]) n = base + ' ' + (k++); return n; }
    function refreshAll() { renderSide(); renderTpl(); renderLayers(); draw(); if (typeof renderDiffEditor === 'function' && GAME) { try { renderDiffEditor(); } catch (_) {} } }
    function selectTpl(name) {
      if (!templates[name] || name === curTpl) { renderTpl(); return; }
      templates[curTpl] = clone(LE);                          // stash current edits
      curTpl = name;
      LE = Object.assign(DEFAULTS(), clone(templates[name]));
      sel = null; save(); refreshAll();
    }
    function newTpl(blank) {
      const suggested = blank ? uniqName('Поле') : uniqName(curTpl + ' копия');
      const nm = (prompt(blank ? 'Имя нового (пустого) поля:' : 'Имя копии поля:', suggested) || '').trim();
      if (!nm) return;
      const name = uniqName(nm);
      templates[curTpl] = clone(LE);                          // stash current
      templates[name] = blank ? BLANK() : clone(LE);
      curTpl = name;
      LE = Object.assign(DEFAULTS(), clone(templates[name]));
      sel = null; save(); refreshAll();
    }
    function renameTpl() {
      const nm = (prompt('Новое имя шаблона:', curTpl) || '').trim();
      if (!nm || nm === curTpl) return;
      const name = uniqName(nm), data = templates[curTpl];
      delete templates[curTpl]; templates[name] = data; curTpl = name;
      save(); renderTpl();
    }
    function delTpl() {
      if (Object.keys(templates).length <= 1) {
        if (!confirm('Это последний шаблон. Очистить его до пустого поля?')) return;
        templates[curTpl] = BLANK();
      } else {
        if (!confirm('Удалить шаблон «' + curTpl + '»?')) return;
        delete templates[curTpl]; curTpl = Object.keys(templates)[0];
      }
      LE = Object.assign(DEFAULTS(), clone(templates[curTpl])); sel = null; save(); refreshAll();
    }

    /* ---- export / import ---- */
    function round4(r) { return { x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) }; }
    function exportObj() {
      const services = Array.from(new Set(LE.hangars.map(h => h.type)));
      const o = {
        pace: +(+LE.pace).toFixed(2),
        objective: { metric: 'served', stars: [LE.stars[0], LE.stars[1], LE.stars[2]] },
        services,
        maxUp: LE.maxUp,
        layout: {
          apron: round4(LE.apron),
          zones: { arrival: round4(LE.arrival) },
          hangars: LE.hangars.map(h => {
            const d = { type: h.type, x: +h.x.toFixed(3), y: +h.y.toFixed(3) };
            if (!h.open) d.open = false;
            if (h.gate && h.gate !== 'auto') d.gate = h.gate;
            return d;
          }),
          runways: LE.runways.map(r => {
            const d = { y: +r.y.toFixed(3) };
            if (!r.landingOpen) d.landingOpen = false;
            if (!r.takeoffOpen) d.takeoffOpen = false;
            return d;
          }),
        },
      };
      if (LE.startMoney > 0) o.startMoney = LE.startMoney;
      const ev = {}; ALL_EVENTS.forEach(k => { if (LE.events[k]) ev[k] = true; });
      if (Object.keys(ev).length) o.events = ev;
      // --- вкладка «Сложность»: расширенные ручки (пишем только не-дефолтные) ---
      const O = o.objective;
      if (LE.metric && LE.metric !== 'served') O.metric = LE.metric;     // upgrades / survival
      if (LE.time > 0) { O.time = Math.round(LE.time); if (LE.race) O.race = true; }
      ['money', 'lives', 'upg', 'timeTier', 'maxLate', 'maxCrash'].forEach(k => {
        const a = LE.cond && LE.cond[k];
        if (Array.isArray(a) && a.length === 3) O[k] = a.map(n => Math.round(+n) || 0);
      });
      if (LE.weather) o.weather = true;
      if (LE.deice) o.deice = true;
      if (LE.calm > 0) o.calm = +(+LE.calm).toFixed(2);
      // фазовые множители скорости на ВПП: пишем только не-дефолтные (≠ 1)
      { const m = LE.motion || {}, mo = {};
        ['landBefore', 'landAfter', 'takeoffRoll', 'climb'].forEach(k => {
          const v = +m[k]; if (isFinite(v) && v !== 1) mo[k] = +v.toFixed(2);
        });
        if (Object.keys(mo).length) o.motion = mo; }
      if (LE.crashPenalty > 0) o.crashPenalty = +(+LE.crashPenalty).toFixed(2);
      if (LE.latePenalty > 0) o.latePenalty = +(+LE.latePenalty).toFixed(2);
      if (LE.minUp > 0) o.minUp = Math.round(LE.minUp);
      // экон-ручки уровня штампуются на объекты (движок читает per-hangar / per-runway)
      if (LE.openCost > 0) o.layout.hangars.forEach(h => { if (h.open === false) h.openCost = Math.round(LE.openCost); });
      if (LE.upgCost > 0)  o.layout.hangars.forEach(h => { h.upgCost = Math.round(LE.upgCost); });
      if (LE.rwOpenCost > 0) o.layout.runways.forEach(r => {
        if (r.landingOpen === false) r.landingCost = Math.round(LE.rwOpenCost);
        if (r.takeoffOpen === false) r.takeoffCost = Math.round(LE.rwOpenCost);
      });
      // оформление: пишем только не-дефолтные выборы скинов зон (по всем зонам).
      // Так выбранные в воркбенче скины едут ВМЕСТЕ с экспортом черновика.
      const sk = LE.skins || {};
      const skOut = {};
      SKIN_ZONES.forEach(z => { if (sk[z] && sk[z] !== 'default') skOut[z] = sk[z]; });
      if (Object.keys(skOut).length) o.skins = skOut;
      return o;
    }
    /* Validator — splits issues into blocking errors and non-blocking warnings.
       Errors gate the export (level would be unplayable); warnings are advisory. */
    function validate() {
      const E = [], W = [], ap = LE.apron, arr = LE.arrival, s = LE.stars;
      // structural — a level needs a way in, a way out and somewhere to serve
      if (!LE.runways.length) E.push('нет ни одной ВПП');
      else {
        if (!LE.runways.some(r => r.landingOpen)) E.push('ни одна ВПП не разрешает посадку');
        if (!LE.runways.some(r => r.takeoffOpen)) E.push('ни одна ВПП не разрешает взлёт');
      }
      if (!LE.hangars.length) E.push('нет ни одного ангара');
      else if (!LE.hangars.some(h => h.open)) E.push('ни один ангар не открыт на старте');
      // passability — apron and arrival must not overlap (no corridor for runways)
      const ox = Math.min(ap.x + ap.w, arr.x + arr.w) - Math.max(ap.x, arr.x);
      const oy = Math.min(ap.y + ap.h, arr.y + arr.h) - Math.max(ap.y, arr.y);
      if (ox > 0 && oy > 0) E.push('апрон и зона прилёта пересекаются — нет коридора для руления/ВПП');
      else if (ap.x + ap.w > arr.x + 0.001) W.push('апрон заходит правее левой границы прилёта');
      if (arr.x + arr.w / 2 < ap.x + ap.w / 2) W.push('зона прилёта левее апрона — борта обычно заходят справа');
      if (arr.w < 0.05) W.push('зона прилёта слишком узкая (<5%)');
      // runways must connect to the apron vertically
      LE.runways.forEach((r, i) => {
        if (r.y < 0.02 || r.y > 0.98) W.push('ВПП' + (i + 1) + ' вне апрона по вертикали');
      });
      // stars must be ascending
      if (!(s[0] > 0 && s[0] <= s[1] && s[1] <= s[2])) E.push('звёзды должны идти по возрастанию (1★ ≤ 2★ ≤ 3★)');
      return { errors: E, warns: W };
    }
    function warnings() { const v = validate(); return v.errors.concat(v.warns); }
    /* ---- filename ---- */
    function slug(s) {
      return (s || '').toString().trim().toLowerCase()
        .replace(/[^a-z0-9а-яё]+/giu, '-').replace(/^-+|-+$/g, '') || 'layout';
    }
    // Экспорт/импорт черновика консолидированы в верхнем меню «Файл»
    // (window.Draft.export/import) — отдельных кнопок в табах больше нет.
    // Запуск тестовой игры консолидирован в левом рельсе (window._runTest).
    // Здесь только отдаём наружу проверку «можно ли играть»: при ошибках разметки
    // показываем ту же модалку подтверждения, что и экспорт, и лишь потом стартуем.
    window._confirmPlay = function (onProceed) {
      const v = validate();
      if (v.errors.length) { showValidateModal(v, onProceed, 'Сыграть всё равно', 'Запустить уровень всё равно?'); return; }
      onProceed();
    };
    /* Blocking pre-action validator modal (errors → confirm before export/play).
       goLabel/subText подставляются на каждый вызов — модалка общая для «Экспорт» и «Сыграть». */
    function showValidateModal(v, onProceed, goLabel, subText) {
      let back = document.getElementById('ly-validate-modal');
      if (!back) {
        back = document.createElement('div');
        back.id = 'ly-validate-modal';
        back.innerHTML =
          '<div class="zwm-box">' +
            '<div class="zwm-title">⛔ Уровень непроходим</div>' +
            '<div class="zwm-sub"></div>' +
            '<div class="zwm-list"></div>' +
            '<div class="zwm-btns">' +
              '<button class="p-btn" id="lyv-cancel" type="button">Отмена</button>' +
              '<button class="p-btn zwm-go" id="lyv-go" type="button"></button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(back);
        const close = () => { back.style.display = 'none'; back._go = null; };
        back.querySelector('#lyv-cancel').addEventListener('click', close);
        back.querySelector('#lyv-go').addEventListener('click', () => { const fn = back._go; close(); if (fn) fn(); });
        back.addEventListener('click', e => { if (e.target === back) close(); });
      }
      back.querySelector('.zwm-sub').textContent = 'Проверка нашла блокирующие проблемы. ' + (subText || 'Продолжить всё равно?');
      back.querySelector('#lyv-go').textContent = goLabel || 'Продолжить всё равно';
      back.querySelector('.zwm-list').innerHTML =
        v.errors.map(w => '<div class="zwm-item err">⛔ ' + escHtml(w) + '</div>').join('') +
        v.warns.map(w => '<div class="zwm-item warn">⚠ ' + escHtml(w) + '</div>').join('');
      back._go = onProceed;
      back.style.display = 'flex';
    }
    function importObj(o) {
      try {
        const L = o.layout || o;
        const next = DEFAULTS();
        if (L.apron) next.apron = Object.assign(next.apron, L.apron);
        if (L.zones && L.zones.arrival) next.arrival = Object.assign(next.arrival, L.zones.arrival);
        if (Array.isArray(L.hangars)) next.hangars = L.hangars.map(h => ({ type: h.type || 'fuel', x: +h.x || 0.5, y: +h.y || 0.5, open: h.open !== false, gate: h.gate || 'auto' }));
        if (Array.isArray(L.runways)) next.runways = L.runways.map(r => ({ y: +r.y || 0.5, landingOpen: r.landingOpen !== false, takeoffOpen: r.takeoffOpen !== false }));
        if (o.pace != null) next.pace = +o.pace;
        if (o.startMoney != null) next.startMoney = +o.startMoney;
        if (o.maxUp != null) next.maxUp = +o.maxUp;
        if (o.objective && Array.isArray(o.objective.stars)) next.stars = o.objective.stars.slice(0, 3);
        if (o.events) EVENTS.forEach(([k]) => { next.events[k] = !!o.events[k]; });
        if (o.skins) SKIN_ZONES.forEach(z => { if (o.skins[z]) next.skins[z] = o.skins[z]; });   // back-compat: старый JSON с hangar/background импортируется как есть
        if (o.motion && typeof o.motion === 'object') {
          next.motion = {};
          ['landBefore', 'landAfter', 'takeoffRoll', 'climb'].forEach(k => {
            const v = +o.motion[k]; if (isFinite(v)) next.motion[k] = Math.max(0.1, Math.min(3, v));
          });
        }
        LE = next; sel = null; save(); refreshAll();
        if (window._resourcesSync) window._resourcesSync();
      } catch (err) { $('ly-warn').textContent = 'не удалось импортировать JSON'; }
    }

    /* ---- единый доступ к черновику для других вкладок (Сложность / Ресурсы / Тест / мастер).
       Черновик = текущий шаблон «Разметки» (LE), он же автосохраняется в localStorage. ---- */
    function ensureSkins() { LE.skins = Object.assign(defaultSkins(), LE.skins || {}); return LE.skins; }
    // дозаполнить старый черновик новыми полями вкладки «Сложность» (миграция на лету)
    function ensureDiffFields() {
      const d = DEFAULTS();
      ['minUp', 'metric', 'time', 'race', 'weather', 'deice', 'calm', 'crashPenalty', 'latePenalty', 'openCost', 'upgCost', 'rwOpenCost']
        .forEach(k => { if (LE[k] === undefined) LE[k] = d[k]; });
      if (!LE.events) LE.events = {}; ['fog', 'wind'].forEach(k => { if (LE.events[k] === undefined) LE.events[k] = false; });
      if (!LE.cond) LE.cond = { money: null, lives: null, upg: null, timeTier: null, maxLate: null, maxCrash: null };
      else if (LE.cond.upg === undefined) LE.cond.upg = null;   // миграция: добавлено поле upg
      if (!LE.motion) LE.motion = {};   // фазовые множители скорости на ВПП (пусто = все ×1)
      return LE;
    }
    window.Draft = {
      export:   () => exportObj(),
      import:   (o) => importObj(o),                      // восстановить черновик из JSON (единый импорт «Файл»)
      validate: () => validate(),
      play:     () => { if (window._runTest) window._runTest(); },
      name:     () => curTpl || 'черновик',
      raw:      () => ensureDiffFields(),                 // живая ссылка на LE (для вкладки «Сложность»)
      commit:   () => { save(); refreshAll(); },          // сохранить + пересинхронить контролы «Разметки»
      getSkins: () => Object.assign(defaultSkins(), LE.skins || {}),
      setSkins: (patch) => { Object.assign(ensureSkins(), patch || {}); save(); },
      zoneSpec: () => zoneSpec(),                         // живая геометрия зон для вкладки «Скины»
    };

    /* ---- param controls ----
       Параметры черновика (темп/деньги/maxUp/звёзды/события) правятся в табе
       «Сложность» (de-*); здесь остаётся только геометрия поля. */
    document.querySelectorAll('[data-add-hangar]').forEach(b => b.addEventListener('click', () => addHangar(b.dataset.addHangar)));
    $('ly-add-runway').addEventListener('click', addRunway);
    $('ly-del').addEventListener('click', delSelected);
    // Экспорт/импорт черновика консолидированы в верхнем меню «Файл» (см. window.Draft.export/import).
    $('ly-reset').addEventListener('click', () => { LE = DEFAULTS(); sel = null; save(); refreshAll(); });
    // template controls
    $('ly-tpl-sel').addEventListener('change', e => selectTpl(e.target.value));
    $('ly-tpl-new').addEventListener('click', () => newTpl(true));
    $('ly-tpl-dup').addEventListener('click', () => newTpl(false));
    $('ly-tpl-rename').addEventListener('click', renameTpl);
    $('ly-tpl-del').addEventListener('click', delTpl);

    /* ---- activation ---- */
    // The point of «Разметка» is to lay out the field directly on the phone
    // mock-up — drop the apron, runways and hangars onto the real device shape
    // and instantly see them against the dangerous zones (cutout, gesture insets,
    // safe-area, HUD). So while the tab is open we move the editor canvas INTO
    // the phone shell (covering the live game, which keeps running underneath to
    // supply those zones) and overlay only the safety frames on top. There is no
    // canvas in the scrolling tab body any more — just the controls.
    const stageWrap = document.querySelector('.ly-stage-wrap');
    const hint      = document.getElementById('ly-hint');
    const shellEl   = document.getElementById('phone-shell');
    const gameFrm   = document.getElementById('game-frame');
    const fieldOv   = document.getElementById('field-overlay');
    let   canvasHome = null;   // { parent, next } — the canvas's parking spot in the tab

    window._layoutActivate = function (show) {
      const wasActive = active;
      active = !!show;
      if (cv && shellEl && fieldOv) {
        if (active && !wasActive) {            // entering «Разметка»
          if (!canvasHome) canvasHome = { parent: cv.parentNode, next: cv.nextSibling };
          shellEl.classList.add('ly-editing');
          if (gameFrm) gameFrm.style.visibility = 'hidden';   // game runs on, just hidden
          shellEl.insertBefore(cv, fieldOv);                  // canvas under the zone overlay
          if (hint) shellEl.insertBefore(hint, fieldOv);
          if (window._enterEditorZones) window._enterEditorZones();   // zones on, editor mode
          resize();   // canvas is now in the visible shell — fit it immediately
        } else if (!active && wasActive && canvasHome) {   // leaving «Разметка»
          if (window._exitEditorZones) window._exitEditorZones();
          if (gameFrm) gameFrm.style.visibility = '';
          shellEl.classList.remove('ly-editing');
          canvasHome.parent.insertBefore(cv, canvasHome.next);
          if (hint && stageWrap) stageWrap.appendChild(hint);
        }
      }
      if (active) { resize(); requestAnimationFrame(() => { resize(); }); ensureGameGeom(); }
    };
    // Размер боксов/ВПП теперь считается из размеров холста и коэффициентов борта
    // (gameGeom), поэтому на первой загрузке он корректен сразу — ждать iframe не нужно.
    // Но коэффициенты K приходят из игры чуть позже самого холста (и пользователь мог
    // сменить K.PLANE_SCALE в «Движении»). Поэтому, как только игра становится доступна,
    // делаем финальную перерисовку — чтобы превью встало по реальным K, а не по дефолтам.
    let geomWaitTimer = 0;
    function ensureGameGeom(tries) {
      clearTimeout(geomWaitTimer);
      if (!active) return;
      tries = tries == null ? 40 : tries;          // ~3.2 c суммарно — игра грузится быстрее
      let K = null;
      try { const fw = gameFrm && gameFrm.contentWindow; K = fw && fw.__GAME && fw.__GAME.K; } catch (_) {}
      if (K) { resize(); return; }                 // K готовы — перерисовка по реальным коэф.
      if (tries <= 0) return;
      geomWaitTimer = setTimeout(() => ensureGameGeom(tries - 1), 80);
    }
    // Re-fit when the phone size picker changes the shell dimensions.
    window._layoutResize = function () { if (active) resize(); };
    window.addEventListener('resize', () => { if (active) resize(); });

    // Поверхности единого превью для левого рельса (runTest/returnToMarkup):
    //   markup-surface = холст в шелле, iframe скрыт;  test-surface = iframe виден.
    window._enterMarkupSurface = function () { window._layoutActivate(true); };
    window._exitMarkupSurface  = function () { window._layoutActivate(false); };

    // Превью скинов (вкладка «Ресурсы») рисуется поверх ЭТОГО же холста разметки
    // (геометрия 1:1 с игрой). Вкладка управляет им через эти хуки.
    window._zoneSpec      = function () { return zoneSpec(); };
    window._setSkinPreview = function (st) { Object.assign(skinOverlay, st || {}); if (active && skinOverlay.on) draw(); };
    window._skinPreviewOn  = function (on) { skinOverlay.on = !!on; if (active) draw(); };

    // boot (начальную активацию режима «Разметка» делает контроллер левого рельса —
    // он идёт ниже, когда уже определены хуки зон _enterEditorZones/_fieldActivate)
    load(); refreshAll();
  })();

