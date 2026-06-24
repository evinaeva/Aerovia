  /* ── Safe-zone frames overlay + legend panel (toolbar «Зоны» button) ───────
     Independent of the active tab. The «Зоны» button opens the legend panel
     (docked under the top-right buttons) and reveals the safety-zone frames.
     The panel's × hides the legend without turning the zones off; the master
     toggle inside the panel turns the overlay on/off; per-row toggles filter
     which zones are drawn (via window._zoneVis, read by drawOverlay). */
  (function () {
    const btn    = document.getElementById('btn-frames-toggle');
    const panel  = document.getElementById('zones-panel');
    const close  = document.getElementById('zones-panel-close');
    const master = document.getElementById('zones-master');
    if (!btn || !panel) return;

    let panelOpen = false;
    let zonesOn   = false;

    function syncBtn() { btn.classList.toggle('tb-active', panelOpen || zonesOn); }

    function setZones(on) {
      zonesOn = on;
      window._zonesOn = on;            // read by refreshCutoutSim()
      if (master) master.checked = on;
      panel.classList.toggle('zones-off', !on);
      if (window._fieldActivate) window._fieldActivate(on, on ? 'safe' : '');
      if (window._refreshCutoutSim) window._refreshCutoutSim();
      syncBtn();
    }
    function openPanel() {
      if (typeof closeAllPopups === 'function') closeAllPopups();  // don't overlap toolbar popups
      panelOpen = true;
      panel.classList.add('open');
      if (!zonesOn) setZones(true);   // opening the legend reveals the zones
      else syncBtn();
    }
    function closePanel() {            // hide the legend, leave the zones as-is
      panelOpen = false;
      panel.classList.remove('open');
      syncBtn();
    }
    window._setZones        = setZones;
    window._closeZonesPanel = closePanel;

    // «Разметка» integration (#9): entering the layout editor turns the zones overlay
    // on in editor-only mode and lights this button + legend (so the per-zone toggles
    // and cutout presets all work while editing); leaving restores the overlay to
    // whatever it was before. The toolbar state stays the single source of truth.
    let savedZones = null;
    window._enterEditorZones = function () {
      if (savedZones == null) savedZones = zonesOn;
      if (window._fieldSetEditorOnly) window._fieldSetEditorOnly(true);
      if (window._fieldSetTestMode)   window._fieldSetTestMode(false);
      setZones(true);
    };
    window._exitEditorZones = function () {
      if (window._fieldSetEditorOnly) window._fieldSetEditorOnly(false);
      const restore = savedZones == null ? false : savedZones;
      savedZones = null;
      setZones(restore);
      if (!restore) closePanel();   // don't strand the legend open over the live game
      if (window._fieldSetTestMode)   window._fieldSetTestMode(true);
    };

    setZones(false);                   // initial: overlay off, panel closed
    btn.addEventListener('click', () => {
      // The button toggles the legend panel; zones follow the panel. When the panel
      // is hidden but zones are still on (after the × or while in «Разметка»), a click
      // re-opens the legend so you can reach the per-zone toggles — turning the overlay
      // fully off is then the panel's master toggle (or a second click).
      if (panelOpen) { closePanel(); setZones(false); }   // panel open → power everything off
      else openPanel();                                    // panel closed → open legend (+ zones)
    });
    if (close)  close.addEventListener('click', closePanel);  // hide legend, keep zones
    if (master) master.addEventListener('change', () => setZones(master.checked));

    // Click outside the panel (and not on the «Зоны» button) hides the legend,
    // leaving the zones as-is — same as the × button.
    document.addEventListener('click', (e) => {
      if (!panelOpen) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      closePanel();
    });
  })();

  /* ── Field overlay ────────────────────────────────────────────────────── */
  (function () {
    const overlay  = document.getElementById('field-overlay');
    let   fieldOn  = false;
    let   overlayTab = '';
    let   editorOnly = false;   // «Разметка» mode: draw only the danger zones, not the live game's field
    let   testOn     = false;   // test mode: keep overlay ticking for draggable control points

    function getField() {
      if (editorOnly && window._layoutField) {
        var lf = window._layoutField();
        if (lf) return lf;
      }
      try { const fw = gameFrame.contentWindow; return fw && fw.__FIELD ? fw.__FIELD : null; } catch(_) { return null; }
    }
    function gateEntr(b) {
      const g = b.gate;
      if (g === 'up')    return { x: b.x + b.w * .5, y: b.y };
      if (g === 'down')  return { x: b.x + b.w * .5, y: b.y + b.h };
      if (g === 'left')  return { x: b.x,              y: b.y + b.h * .5 };
      if (g === 'right') return { x: b.x + b.w,        y: b.y + b.h * .5 };
      return { x: b.x + b.w * .5, y: b.y + b.h * .5 };
    }
    // единичный вектор «наружу из ворот» бокса (в сторону поля/захода)
    function gateDir(b) {
      return ({ up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] })[b.gate] || [0,1];
    }
    function zoneCol(z) {
      return { air:'#f5c842', land:'#f08030', takeoff:'#60d060', bay:'#b060f0', field:'#40d0c0', runway:'#4090f0' }[z] || '#aaa';
    }

    // Intersection of a list of rects ({x,y,w,h}); null if any is missing/empty or
    // they don't overlap. Used to collapse the near-identical route zones into the
    // single strictest (smallest) one.
    function rectIntersect(rects) {
      var x0 = -Infinity, y0 = -Infinity, x1 = Infinity, y1 = Infinity;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (!r || r.w <= 0 || r.h <= 0) return null;
        x0 = Math.max(x0, r.x);       y0 = Math.max(y0, r.y);
        x1 = Math.min(x1, r.x + r.w); y1 = Math.min(y1, r.y + r.h);
      }
      if (x1 <= x0 || y1 <= y0) return null;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }

    // Actual rendered size of the achievement toast (#achToast) inside the game
    // iframe. offsetWidth/Height already honour its content and the max-width:86%
    // cap, so this is the real box — not the worst-case 86%-wide rectangle. The
    // toast is normally empty/hidden in the preview, so we briefly inject sample
    // content to get a representative natural size, then restore it (synchronous,
    // so nothing paints in between). Returns {w,h} in iframe CSS px, or null.
    function measureToast() {
      try {
        const doc = gameFrame.contentWindow && gameFrame.contentWindow.document;
        const el  = doc && doc.getElementById('achToast');
        if (!el) return null;
        const ic  = doc.getElementById('achIc');
        const ttl = doc.getElementById('achTtl');
        const dsc = doc.getElementById('achDsc');
        const empty = !ttl || !ttl.textContent.trim();
        let saved = null;
        if (empty && ic && ttl && dsc) {
          saved = { ic: ic.textContent, ttl: ttl.textContent, dsc: dsc.textContent };
          ic.textContent  = '🏅';
          ttl.textContent = 'Первая посадка';
          dsc.textContent = 'Ты посадил первый борт без происшествий.';
        }
        const w = el.offsetWidth, h = el.offsetHeight;
        if (saved) { ic.textContent = saved.ic; ttl.textContent = saved.ttl; dsc.textContent = saved.dsc; }
        if (w < 1 || h < 1) return null;
        return { w: w, h: h };
      } catch (_) { return null; }
    }

    function drawOverlay() {
      const fd = getField();
      if (!fd || !fd.W) { overlay.innerHTML = ''; return; }
      const W = fd.W, H = fd.H;
      overlay.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const snap   = MT ? MT.snapshot() : {};
      const arrive = +(snap['K.ARRIVE'] || 12);
      const GDX = { up:0, down:0, left:-1, right:1 };
      const GDY = { up:-1, down:1, left:0, right:0 };
      let s = '<defs><marker id="ga" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">'
            + '<path d="M0,0 L0,6 L6,3 z" fill="rgba(34,200,100,.8)"/></marker></defs>';
      // In «Разметка» editor mode the canvas already draws the field being designed,
      // so skip the live game's runways/bays/planes — keep only the danger zones below.
      if (!editorOnly) {
      (fd.runways || []).forEach((r, i) => {
        s += '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="rgba(58,130,255,.05)" stroke="rgba(58,210,255,.5)" stroke-width="1.5"/>';
        s += '<line x1="'+r.x+'" y1="'+r.cy+'" x2="'+(r.x+r.w)+'" y2="'+r.cy+'" stroke="rgba(255,255,255,.15)" stroke-width="1" stroke-dasharray="6 4"/>';
        s += '<line x1="'+r.stopX+'" y1="'+r.y+'" x2="'+r.stopX+'" y2="'+(r.y+r.h)+'" stroke="rgba(245,200,66,.85)" stroke-width="1.5" stroke-dasharray="4 3"/>';
        s += '<text x="'+(r.stopX+2)+'" y="'+(r.y+10)+'" font-size="8" fill="rgba(245,200,66,.9)">stop</text>';
        s += '<line x1="'+r.exitX+'" y1="'+r.y+'" x2="'+r.exitX+'" y2="'+(r.y+r.h)+'" stroke="rgba(240,128,48,.85)" stroke-width="1.5" stroke-dasharray="4 3"/>';
        s += '<text x="'+(r.exitX+2)+'" y="'+(r.y+10)+'" font-size="8" fill="rgba(240,128,48,.9)">exit</text>';
        s += '<text x="'+(r.x+3)+'" y="'+(r.y+r.h-3)+'" font-size="8" fill="rgba(58,210,255,.65)">ВПП'+(i+1)+(r.closed?' ✕':'')+'</text>';
      });
      (fd.bays || []).forEach(b => {
        const col = b.occupied ? 'rgba(180,96,240,.7)' : (b.open ? 'rgba(34,200,100,.55)' : 'rgba(200,80,80,.5)');
        s += '<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="'+col+'" fill-opacity=".1" stroke="'+col+'" stroke-width="1.5"/>';
        const ge = gateEntr(b);
        const dx = GDX[b.gate]||0, dy = GDY[b.gate]||0;
        s += '<circle cx="'+ge.x+'" cy="'+ge.y+'" r="3" fill="'+col+'"/>';
        s += '<line x1="'+ge.x+'" y1="'+ge.y+'" x2="'+(ge.x+dx*12)+'" y2="'+(ge.y+dy*12)+'" stroke="'+col+'" stroke-width="1.5" marker-end="url(#ga)"/>';
        s += '<text x="'+(b.x+2)+'" y="'+(b.y+9)+'" font-size="7" fill="'+col+'">'+(b.type||'')+'</text>';
      });
      (fd.planes || []).forEach(pl => {
        const col = zoneCol(pl.zone);
        if (pl.path && pl.path.length) {
          const pts = pl.x+','+pl.y+' '+pl.path.map(p => p.x+','+p.y).join(' ');
          s += '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="5 3"/>';
          const wp = pl.path[0];
          s += '<circle cx="'+wp.x+'" cy="'+wp.y+'" r="'+arrive+'" fill="none" stroke="'+col+'" stroke-opacity=".35" stroke-width="1" stroke-dasharray="3 3"/>';
          s += '<circle cx="'+wp.x+'" cy="'+wp.y+'" r="2.5" fill="'+col+'" fill-opacity=".8"/>';
        }
        s += '<circle cx="'+pl.x+'" cy="'+pl.y+'" r="5" fill="'+col+'" fill-opacity=".85" stroke="rgba(0,0,0,.3)" stroke-width="1"/>';
      });
      } // !editorOnly

      // ── Safety zones overlay (shown in "Зоны" tab or when SA_DEBUG_OVERLAY is on) ──
      const showSafe = editorOnly || overlayTab === 'safe' || !!snap['MT.SA_DEBUG_OVERLAY'];
      if (showSafe && fd.safetyRects) {
        const sr = fd.safetyRects;
        const gi = sr.gestureInsets;
        const sa = sr.safeAreaInsets;
        // per-zone visibility (toggled from the «Зоны» legend); missing key = shown
        const vis = window._zoneVis || {};
        const zv  = function (k) { return vis[k] !== false; };

        // gesture edge strips (red hatched)
        if (zv('gesture')) [
          [0,       0,       gi.l, H,    'жест←'],
          [W - gi.r, 0,      gi.r, H,    'жест→'],
          [0,       0,       W,    gi.t, 'жест↑'],
          [0,       H - gi.b, W,   gi.b, 'жест↓'],
        ].forEach(function(row) {
          var rx=row[0], ry=row[1], rw=row[2], rh=row[3], lbl=row[4];
          if (rw <= 0 || rh <= 0) return;
          s += '<rect x="'+rx+'" y="'+ry+'" width="'+rw+'" height="'+rh+'" fill="rgba(255,60,60,.16)" stroke="rgba(255,60,60,.5)" stroke-width="1" stroke-dasharray="4 3"/>';
          var tx = rx + 2, ty = ry + (rh > 14 ? rh * 0.5 : 9);
          s += '<text x="'+tx+'" y="'+ty+'" font-size="7" fill="rgba(255,110,70,.95)" dominant-baseline="middle">'+lbl+'</text>';
        });

        // safe-area strips where they extend beyond gesture zone (orange)
        if (zv('safe')) [
          [0,        0,        sa.l,  H,    sa.l > gi.l],
          [W - sa.r, 0,        sa.r,  H,    sa.r > gi.r],
          [0,        0,        W,     sa.t, sa.t > gi.t],
          [0,        H - sa.b, W,     sa.b, sa.b > gi.b],
        ].forEach(function(row) {
          var rx=row[0], ry=row[1], rw=row[2], rh=row[3], cond=row[4];
          if (!cond || rw <= 0 || rh <= 0) return;
          s += '<rect x="'+rx+'" y="'+ry+'" width="'+rw+'" height="'+rh+'" fill="rgba(255,160,60,.13)" stroke="rgba(255,160,60,.4)" stroke-width="1"/>';
        });

        // cutout (black overlay with red border)
        var cr = sr.cutoutRect;
        if (zv('cutout') && cr && cr.w > 0 && cr.h > 0) {
          s += '<rect x="'+cr.x+'" y="'+cr.y+'" width="'+cr.w+'" height="'+cr.h+'" fill="rgba(0,0,0,.55)" stroke="rgba(255,60,60,.85)" stroke-width="2"/>';
          s += '<text x="'+(cr.x+2)+'" y="'+(cr.y+9)+'" font-size="7" fill="rgba(255,80,80,.9)">'+T.zoneOvCutout+'</text>';
        }

        // content / interactive safe rects (outlines only — drawn on top)
        [
          { k: 'content',     r: sr.contentSafeRect,     col: 'rgba(34,210,255,.75)', da: '6 3', lbl: T.zoneOvContent     },
          { k: 'interactive', r: sr.interactiveSafeRect, col: 'rgba(34,240,100,.75)', da: '5 4', lbl: T.zoneOvInteractive },
        ].forEach(function(item) {
          var r=item.r, col=item.col, da=item.da, lbl=item.lbl;
          if (!zv(item.k) || !r || r.w <= 0 || r.h <= 0) return;
          var daAttr = da ? ' stroke-dasharray="' + da + '"' : '';
          s += '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="none" stroke="'+col+'" stroke-width="1.5"'+daAttr+'/>';
          s += '<text x="'+(r.x+2)+'" y="'+(r.y+9)+'" font-size="7" fill="'+col+'">'+lbl+'</text>';
        });

        // route zone (merged) — routeStart/routeDraw/routeTarget are near-identical
        // nested rects, so collapse them into a single zone = their intersection,
        // i.e. the strictest (smallest) one. That's the safe area to design against.
        if (zv('route')) {
          var rIsec = rectIntersect([
            sr.routeStartAllowedRect, sr.routeDrawAllowedRect, sr.routeTargetAllowedRect,
          ]);
          if (rIsec && rIsec.w > 0 && rIsec.h > 0) {
            s += '<rect x="'+rIsec.x+'" y="'+rIsec.y+'" width="'+rIsec.w+'" height="'+rIsec.h+'" fill="none" stroke="rgba(50,255,50,1)" stroke-width="1.5"/>';
            s += '<text x="'+(rIsec.x+2)+'" y="'+(rIsec.y+9)+'" font-size="7" fill="rgba(50,255,50,1)">'+T.zoneOvRoute+'</text>';
          }
        }

        // UI reserved (HUD, pause button) — SOLID fill: an untouchable zone. In the
        // layout editor (LE) objects can't be dragged into it either (see LE drag
        // clamp), so it reads as a hard "nothing goes here" block.
        if (zv('uiReserved')) (sr.uiReservedRects || []).forEach(function(r) {
          if (!r || r.w <= 0 || r.h <= 0) return;
          s += '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="rgba(255,220,0,.5)" stroke="rgba(255,220,0,.95)" stroke-width="1.5"/>';
          s += '<text x="'+(r.x+2)+'" y="'+(r.y+8)+'" font-size="6" fill="rgba(40,30,0,.9)">'+r.label+'</text>';
        });

        // Achievement toast (#achToast) — ACTUAL box, not the 86% worst case. We read
        // the live element's rendered size (offsetWidth/Height respects its content and
        // the max-width:86% cap) and place it per its CSS rules: centred, top 13%.
        // W/H here are the iframe's innerWidth/innerHeight in CSS px (06-state-layout
        // sets W=window.innerWidth, H=window.innerHeight) — same units as the CSS, 1:1.
        if (zv('toast')) {
          var tb = measureToast();
          if (tb) {
            var tW = Math.min(tb.w, W * 0.86);   // never wider than the CSS cap
            var tH = tb.h;
            var tX = (W - tW) / 2;               // centred (left:50% + translateX(-50%))
            var tY = H * 0.13;                   // CSS top:13%
            s += '<rect x="'+tX+'" y="'+tY+'" width="'+tW+'" height="'+tH+'" rx="6" '
               + 'fill="rgba(244,207,94,.10)" stroke="rgba(244,207,94,.85)" stroke-width="1.5" stroke-dasharray="6 4"/>';
            s += '<text x="'+(tX+4)+'" y="'+(tY+10)+'" font-size="7" fill="rgba(244,207,94,.95)">'+T.zoneOvToast+'</text>';
          }
        }
      }

      // ── Зоны захвата + ручки перетаскивания/масштаба ──────────────────────────
      // Раздельно: бокс, ВПП-посадка, ВПП-взлёт (у каждой свои radius/offset; форма —
      // на тип). Рисуем у репрезентативного объекта. Ручка-центр двигает зону (OFFSET
      // вдоль оси захода), ручка-апекс масштабирует (RADIUS). Тянем → пишем MT-параметр.
      if (!editorOnly) {
        s += grabZoneSvg('bay', snap, fd);
        s += grabZoneSvg('rwland', snap, fd);
        s += grabZoneSvg('rwtake', snap, fd);
        s += motionPointsSvg(snap, fd);
      }

      overlay.innerHTML = s;
    }

    // Конфиг трёх настраиваемых зон захвата (по одной форме на тип; у ВПП — две стороны).
    const GRAB_DEFS = {
      bay:    { flag:'MT.DEBUG_BAY_SNAP_ZONES',    shapeKey:'MT.BAY_GRAB_SHAPE',    radKey:'MT.BAY_GRAB_RADIUS',            offKey:'MT.BAY_GRAB_OFFSET',            col:'#b060f0' },
      rwland: { flag:'MT.DEBUG_RUNWAY_SNAP_ZONES', shapeKey:'MT.RUNWAY_GRAB_SHAPE', radKey:'MT.RUNWAY_LAND_GRAB_RADIUS',    offKey:'MT.RUNWAY_LAND_GRAB_OFFSET',    col:'#3ad2ff' },
      rwtake: { flag:'MT.DEBUG_RUNWAY_SNAP_ZONES', shapeKey:'MT.RUNWAY_GRAB_SHAPE', radKey:'MT.RUNWAY_TAKEOFF_GRAB_RADIUS', offKey:'MT.RUNWAY_TAKEOFF_GRAB_OFFSET', col:'#60d060' },
    };
    // Геометрия зоны (anchor = точка при OFFSET=0; u = вектор наружу, в сторону захода).
    function grabZoneGeom(kind, fd) {
      if (kind === 'bay') {
        const b = (fd.bays || []).find(x => x.open && x.gate);
        return b ? { anchor: gateEntr(b), u: gateDir(b) } : null;
      }
      const r = (fd.runways || []).find(x => !x.closed);
      if (!r) return null;
      if (kind === 'rwland') return { anchor: { x: r.x + r.w, y: r.cy }, u: [1, 0] };   // посадка: правый торец (небо)
      return { anchor: { x: r.x, y: r.cy }, u: [-1, 0] };                                // взлёт: левый торец (апрон)
    }
    function grabZoneSvg(kind, snap, fd) {
      const def = GRAB_DEFS[kind];
      if (snap[def.flag] !== true) return '';
      const geom = grabZoneGeom(kind, fd);
      if (!geom) return '';
      const R = +(snap[def.radKey] || 0), off = +(snap[def.offKey] || 0), col = def.col;
      const u = geom.u, a = geom.anchor;
      const cx = a.x + u[0] * off, cy = a.y + u[1] * off;          // центр зоны
      const square = snap[def.shapeKey] === 'square';
      let out = '';
      if (R > 0) {
        if (square) {                                              // квадрат со стороной 2R
          out += '<rect x="' + (cx - R) + '" y="' + (cy - R) + '" width="' + (R * 2) + '" height="' + (R * 2) + '" fill="' + col + '" fill-opacity=".10" stroke="' + col + '" stroke-width="1.4" stroke-dasharray="5 4"/>';
        } else {                                                   // полукруг (купол по +u)
          const base = Math.atan2(u[1], u[0]); let pts = '';
          for (let i = 0; i <= 28; i++) { const an = base - Math.PI / 2 + Math.PI * i / 28; pts += (cx + Math.cos(an) * R).toFixed(1) + ',' + (cy + Math.sin(an) * R).toFixed(1) + ' '; }
          out += '<polygon points="' + pts + '" fill="' + col + '" fill-opacity=".10" stroke="' + col + '" stroke-width="1.4" stroke-dasharray="5 4"/>';
        }
      }
      const hd = Math.max(R, 26);                                   // апекс грабельный даже при R=0
      const ax = cx + u[0] * hd, ay = cy + u[1] * hd;
      out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ax + '" y2="' + ay + '" stroke="' + col + '" stroke-opacity=".5" stroke-width="1"/>';
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#0a1020" stroke="' + col + '" stroke-width="2" data-grab="' + kind + '-o" style="pointer-events:auto;cursor:move"/>';
      out += '<circle cx="' + ax + '" cy="' + ay + '" r="7" fill="' + col + '" stroke="#0a1020" stroke-width="2" data-grab="' + kind + '-r" style="pointer-events:auto;cursor:crosshair"/>';
      return out;
    }

    // ── Перетаскиваемые точки ВПП/ангара (геймплейные K.RW_* / K.BAY_APPROACH_DIST) ──
    // В отличие от «зон захвата» (только Workbench), эти точки РЕАЛЬНО управляют игрой:
    // место касания/отрыва/начала выравнивания на ВПП и точку подъезда к ангару.
    const MP_COL   = { rwtd:'#f5c842', rwlift:'#60d060', rwalign:'#3ad2ff', rwtkalign:'#f08060', bayapp:'#b060f0' };
    const MP_PARAM = { rwtd:'K.RW_TOUCHDOWN_OFF', rwlift:'K.RW_LIFTOFF_OFF', rwalign:'K.RW_ALIGN_OFF', rwtkalign:'K.TAKEOFF_ALIGN_OFF', bayapp:'K.BAY_APPROACH_DIST' };
    const MP_LABEL = { rwtd:'касание', rwlift:'отрыв', rwalign:'выравн.', rwtkalign:'выравн.↑', bayapp:'подъезд' };
    function repRunway(fd) { return (fd.runways || []).find(x => !x.closed) || (fd.runways || [])[0]; }
    function repBay(fd)    { return (fd.bays || []).find(x => x.open && x.gate); }
    function mpAnchor(kind, fd) {
      const ui = fd.ui || 1, PL = fd.planeLen || 0;
      if (kind === 'bayapp') {
        const b = repBay(fd); if (!b) return null;
        const ge = gateEntr(b), u = gateDir(b);
        return { x: ge.x, y: ge.y, ux: u[0], uy: u[1], ui };
      }
      const r = repRunway(fd); if (!r) return null;
      const ax = kind === 'rwtd' ? r.stopX + PL : kind === 'rwlift' ? r.exitX : kind === 'rwalign' ? (r.x + r.w) : r.x;
      const ux = kind === 'rwtkalign' ? -1 : 1;
      return { x: ax, y: r.cy, ux, uy: 0, ui, r };
    }
    const MP_PT_VIS = { rwtd: 'MT.SHOW_TD_PT', rwlift: 'MT.SHOW_LIFT_PT', rwalign: 'MT.SHOW_ALIGN_PT', rwtkalign: 'MT.SHOW_TAKEOFF_ALIGN_PT' };
    function motionPointsSvg(snap, fd) {
      if (snap['MT.DEBUG_MOTION_POINTS'] !== true) return '';
      let out = '';
      const r = repRunway(fd);
      if (r) ['rwtd', 'rwlift', 'rwalign', 'rwtkalign'].forEach(kind => {
        if (snap[MP_PT_VIS[kind]] === false) return;   // per-point visibility toggle
        const a = mpAnchor(kind, fd); if (!a) return;
        const off = +(snap[MP_PARAM[kind]] || 0), col = MP_COL[kind];
        const x = a.x + a.ux * off * a.ui;
        out += '<line x1="' + x + '" y1="' + r.y + '" x2="' + x + '" y2="' + (r.y + r.h) + '" stroke="' + col + '" stroke-width="2" stroke-dasharray="3 3"/>';
        out += '<text x="' + (x + 2) + '" y="' + (r.y + r.h + 10) + '" font-size="8" fill="' + col + '">' + MP_LABEL[kind] + '</text>';
        out += '<circle cx="' + x + '" cy="' + r.cy + '" r="7" fill="#0a1020" stroke="' + col + '" stroke-width="2" data-mp="' + kind + '" style="pointer-events:auto;cursor:ew-resize"/>';
      });
      const a = mpAnchor('bayapp', fd);
      if (a) {
        const d = +(snap[MP_PARAM.bayapp] || 0), col = MP_COL.bayapp;
        const x = a.x + a.ux * d * a.ui, y = a.y + a.uy * d * a.ui;
        out += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + x + '" y2="' + y + '" stroke="' + col + '" stroke-opacity=".6" stroke-width="1.5"/>';
        out += '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#0a1020" stroke="' + col + '" stroke-width="2" data-mp="bayapp" style="pointer-events:auto;cursor:move"/>';
        out += '<text x="' + (x + 9) + '" y="' + y + '" font-size="8" fill="' + col + '">' + MP_LABEL.bayapp + '</text>';
      }
      return out;
    }
    let mpdrag = null;
    function applyMpDrag(e) {
      if (!mpdrag || !MT) return;
      const fd = getField(); if (!fd) return;
      const a = mpAnchor(mpdrag, fd); if (!a) return;
      const p = evGamePt(e);
      const val = ((p.x - a.x) * a.ux + (p.y - a.y) * a.uy) / a.ui;
      MT.apply({ [MP_PARAM[mpdrag]]: clampParam(MP_PARAM[mpdrag], Math.round(val)) }, false);
      syncUI(); drawOverlay();
    }

    // ── drag/scale ручек зоны захвата прямо на превью ────────────────────────────
    function clampParam(key, v) {
      const pr = MT && MT.params.find(x => x.key === key);
      if (pr) { if (pr.min != null && v < pr.min) v = pr.min; if (pr.max != null && v > pr.max) v = pr.max; }
      return v;
    }
    function evGamePt(e) {
      const fd = getField(); const rect = overlay.getBoundingClientRect();
      const W = (fd && fd.W) || rect.width || 1, H = (fd && fd.H) || rect.height || 1;
      return { x: (e.clientX - rect.left) / (rect.width || 1) * W, y: (e.clientY - rect.top) / (rect.height || 1) * H };
    }
    let zdrag = null;   // { kind:'bay'|'rwland'|'rwtake', mode:'o'|'r' }
    function applyZoneDrag(e) {
      if (!zdrag || !MT) return;
      const fd = getField(); if (!fd) return;
      const geom = grabZoneGeom(zdrag.kind, fd); if (!geom) return;
      const def = GRAB_DEFS[zdrag.kind];
      const p = evGamePt(e), u = geom.u, a = geom.anchor;
      if (zdrag.mode === 'o') {
        const off = clampParam(def.offKey, (p.x - a.x) * u[0] + (p.y - a.y) * u[1]);   // проекция на ось
        MT.apply({ [def.offKey]: Math.round(off) }, false);
      } else {
        const off = +(MT.snapshot()[def.offKey] || 0);
        const cx = a.x + u[0] * off, cy = a.y + u[1] * off;
        const R = clampParam(def.radKey, (p.x - cx) * u[0] + (p.y - cy) * u[1]);
        MT.apply({ [def.radKey]: Math.round(R) }, false);
      }
      syncUI(); drawOverlay();
    }
    overlay.addEventListener('pointerdown', e => {
      const mp = e.target && e.target.getAttribute && e.target.getAttribute('data-mp');
      if (mp) {
        e.preventDefault(); e.stopPropagation();
        mpdrag = mp;
        overlay.style.pointerEvents = 'auto';
        try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
        applyMpDrag(e);
        return;
      }
      const g = e.target && e.target.getAttribute && e.target.getAttribute('data-grab');
      if (!g) return;
      e.preventDefault(); e.stopPropagation();
      const i = g.lastIndexOf('-');
      zdrag = { kind: g.slice(0, i), mode: g.slice(i + 1) };
      overlay.style.pointerEvents = 'auto';
      try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
      applyZoneDrag(e);
    });
    overlay.addEventListener('pointermove', e => { if (mpdrag) applyMpDrag(e); else if (zdrag) applyZoneDrag(e); });
    function endZdrag(e) {
      if (mpdrag) {
        const key = MT && MP_PARAM[mpdrag];
        if (key) { const snap = MT.snapshot(); MT.apply({ [key]: snap[key] }, true); setStatus(key + '  →  ' + snap[key]); }
        mpdrag = null;
        overlay.style.pointerEvents = 'none';
        try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }
      if (!zdrag) return;
      const def = MT && GRAB_DEFS[zdrag.kind];
      if (!def) { zdrag = null; overlay.style.pointerEvents = 'none'; return; }
      const snap = MT.snapshot();
      MT.apply({ [def.radKey]: snap[def.radKey], [def.offKey]: snap[def.offKey] }, true);   // persist финал
      setStatus(def.radKey + '  →  ' + snap[def.radKey] + ' · ' + def.offKey + '  →  ' + snap[def.offKey]);
      zdrag = null;
      overlay.style.pointerEvents = 'none';
      try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    overlay.addEventListener('pointerup', endZdrag);
    overlay.addEventListener('pointercancel', endZdrag);

    // Safe-zone validation — runs on demand (map export), not live. Reads the
    // live game field; returns [] when the game isn't running or has no rects.
    function zoneWarnings() {
      const fd = getField();
      if (!fd || !fd.safetyRects) return [];
      const sr = fd.safetyRects;
      function rectsOverlap(a, b) {
        return b.w > 0 && b.h > 0 && a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
      }
      function inRect(px, py, r) {
        return r.w > 0 && r.h > 0 && px >= r.x && px <= r.x+r.w && py >= r.y && py <= r.y+r.h;
      }
      const warnings = [];
      const rt = sr.routeTargetAllowedRect;
      const cr = sr.cutoutRect || { w:0 };
      (fd.runways || []).forEach(function(r, i) {
        const lbl = 'ВПП '+(i+1);
        if (cr.w > 0 && rectsOverlap(r, cr))
          warnings.push(T.warnHitCutout(lbl));
        if (rt && !inRect(r.stopX, r.cy, rt))
          warnings.push(T.warnStopOutside(lbl));
      });
      (fd.bays || []).forEach(function(b) {
        if (cr.w > 0 && rectsOverlap(b, cr))
          warnings.push(T.warnBayCutout(b.type || '?'));
      });
      return warnings;
    }
    window._zoneWarnings = zoneWarnings;

    let ticking = false;
    function tick() {
      if (!fieldOn && !testOn) { ticking = false; return; }
      if (ticking && arguments[0] !== true) return;   // already looping — don't start a second
      ticking = true;
      drawOverlay();
      setTimeout(() => tick(true), 150);
    }

    window._fieldActivate = function (on, tab) {
      fieldOn  = on;
      overlayTab = tab || '';
      overlay.style.display = (on || testOn) ? '' : 'none';
      if (on) tick();
    };
    window._fieldSetTestMode = function (on) {
      testOn = !!on;
      overlay.style.display = (fieldOn || testOn) ? '' : 'none';
      if (testOn && !ticking) tick();
    };
    // immediate redraw (used by the «Зоны» legend toggles for snappy feedback)
    window._fieldRedraw = function () { if (fieldOn) drawOverlay(); };
    // «Разметка» editor mode: draw ONLY the danger zones (skip the live game's
    // runways/bays/planes) on top of the editor canvas. This just flips the flag —
    // whether the overlay is visible at all is owned by the toolbar «Зоны» state
    // (setZones), so the two no longer fight over fieldOn/display (see #9).
    window._fieldSetEditorOnly = function (on) {
      editorOnly = !!on;
      if (fieldOn) drawOverlay();
    };
  })();

