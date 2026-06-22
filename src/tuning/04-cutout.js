  /* ── Cutout / navigation options (combinable, not a single radio) ───────── */
  // The screen shape used to be a single mutually-exclusive preset. It is really
  // three orthogonal axes that combine — so each is its own toggle now:
  //   • camera  : 'none' | 'left' | 'right'  — a side camera cutout (left/right
  //               are mutually exclusive; clicking the active one clears it)
  //   • rounded : bool                        — rounded corners add side safe-area insets
  //   • threeBtn: bool                        — old 3-button nav removes the gesture insets
  // e.g. «левая камера + скруглённые углы» or «3 кнопки + левая камера» are all valid.
  const cutoutState = { camera: 'none', rounded: false, threeBtn: false };

  // Camera geometry (matches MT.SA_CUTOUT_* values).
  const CAMERA_W = 28, CAMERA_H = 90, CAMERA_OFFSET = 135;
  const ROUND_INSET = 12;     // side safe-area inset added by rounded corners
  const GEST = 24;            // gesture-nav exclusion width (0 under 3-button nav)

  // Resolve the active toggle set into the flat MT/cutout values the rest of the
  // page already understands (side/w/h/offset/insets/gesture widths).
  function resolveCutout() {
    const cam = cutoutState.camera;
    return {
      side:   cam,
      w:      cam === 'none' ? 0 : CAMERA_W,
      h:      cam === 'none' ? 0 : CAMERA_H,
      offset: cam === 'none' ? 0 : CAMERA_OFFSET,
      saL:    cutoutState.rounded ? ROUND_INSET : 0,
      saR:    cutoutState.rounded ? ROUND_INSET : 0,
      gestL:  cutoutState.threeBtn ? 0 : GEST,
      gestR:  cutoutState.threeBtn ? 0 : GEST,
      gestB:  cutoutState.threeBtn ? 0 : GEST,
    };
  }

  // Human-readable summary of the active combination (for the status line).
  function cutoutSummary() {
    const parts = [];
    if (cutoutState.camera !== 'none') parts.push(T.cutoutLabels[cutoutState.camera]);
    if (cutoutState.rounded)  parts.push(T.cutoutLabels.round);
    if (cutoutState.threeBtn) parts.push(T.cutoutLabels['3btn']);
    return parts.length ? parts.join(' + ') : T.cutoutNone;
  }

  const cutoutSim = document.getElementById('cutout-sim');

  // The red-dashed cutout preview (#cutout-sim) shows whenever a side camera is
  // active. When the zones overlay is also on, drawOverlay() draws the cutout
  // inside the SVG too, but cutoutSim lives on the phone FRAME (above the bezel),
  // so together they show both where the camera notch is on the device AND where
  // it lands inside the game canvas — two complementary views, not duplicates.
  function refreshCutoutSim() {
    const show = cutoutState.camera !== 'none';
    cutoutSim.style.display = show ? 'block' : 'none';
  }
  window._refreshCutoutSim = refreshCutoutSim;

  // Reflect cutoutState onto the panel rows: camera rows reflect the chosen side,
  // rounded/3-button reflect their own flags. Multiple rows can be active at once.
  function syncCutoutButtons() {
    document.querySelectorAll('.co-btn').forEach(b => {
      const k = b.dataset.co;
      const on = (k === 'left'  && cutoutState.camera === 'left')  ||
                 (k === 'right' && cutoutState.camera === 'right') ||
                 (k === 'round' && cutoutState.rounded)            ||
                 (k === '3btn'  && cutoutState.threeBtn);
      b.classList.toggle('active', on);
    });
  }

  // Toggle one option. left/right are mutually exclusive (and clicking the active
  // one clears it); rounded and 3-button flip independently.
  // rounded/3btn только влияют на safetyRects — эффект виден только в зонах-оверлее,
  // поэтому при их включении автоматически открываем «Зоны» (чтобы пользователь
  // сразу видел, что изменилось).
  function toggleCutout(opt) {
    if (opt === 'left' || opt === 'right') {
      cutoutState.camera = (cutoutState.camera === opt) ? 'none' : opt;
    } else if (opt === 'round') {
      cutoutState.rounded = !cutoutState.rounded;
    } else if (opt === '3btn') {
      cutoutState.threeBtn = !cutoutState.threeBtn;
    } else { return; }
    applyCutout();
    if ((opt === 'round' || opt === '3btn') && !window._zonesOn && window._setZones) {
      window._setZones(true);
    }
  }

  // Reset everything back to «без выреза, жест-навигация».
  function resetCutout() { cutoutState.camera = 'none'; cutoutState.rounded = false; cutoutState.threeBtn = false; applyCutout(); }

  function applyCutout() {
    const co    = resolveCutout();
    const ph    = PHONES.find(p => p.key === phoneKey);
    const scale = ph ? getScale(phoneKey) : 1;

    syncCutoutButtons();

    // Visual overlay positioned in phone-wrapper coordinates.
    // cutoutSim is a sibling of phone-shell so it renders above the iframe.
    // phone-shell has border: 7px; absolute children start at the padding edge (inside border).
    // Map from phone-shell padding-relative (cx, cy) → phone-wrapper visual:
    //   wrapper_pos = (BORDER + cx) * scale
    const BORDER = 7;
    if (co.side !== 'none' && ph) {
      // cx/cy are in the shell's CONTENT coordinates (inside the 7px bezel) — the same
      // space the game measures for safetyRects. Use the shell's real content width
      // (clientWidth) for the right edge, NOT ph.w (the label size incl. the bezel),
      // so the right-side cutout lines up with the game's computed cutoutRect.
      const contentW = shell.clientWidth || (ph.w - 2 * BORDER);
      let cx = 0, cy = co.offset;
      if (co.side === 'right') cx = contentW - co.w;
      cutoutSim.style.left    = Math.round((BORDER + cx) * scale) + 'px';
      cutoutSim.style.top     = Math.round((BORDER + cy) * scale) + 'px';
      cutoutSim.style.width   = Math.round(co.w * scale) + 'px';
      cutoutSim.style.height  = Math.round(co.h * scale) + 'px';
    }
    refreshCutoutSim();   // visibility depends on the camera + the zones-overlay state

    // Push new values into the game iframe's MT and trigger recalculation.
    try {
      const mt = gameFrame.contentWindow && gameFrame.contentWindow.__MT;
      if (!mt) return;
      mt.apply({
        'MT.SA_CUTOUT_SIDE':    co.side,
        'MT.SA_CUTOUT_W':       co.w,
        'MT.SA_CUTOUT_H':       co.h,
        'MT.SA_CUTOUT_OFFSET':  co.offset,
        'MT.SA_INSET_LEFT':     co.saL,
        'MT.SA_INSET_RIGHT':    co.saR,
        'MT.SA_GESTURE_LEFT':   co.gestL,
        'MT.SA_GESTURE_RIGHT':  co.gestR,
        'MT.SA_GESTURE_BOTTOM': co.gestB,
      }, true);
      // Trigger game resize so calcSafetyRects() re-reads updated MT values.
      try { gameFrame.contentWindow.dispatchEvent(new Event('resize')); } catch(_) {}
      if (MT) syncUI();
      setStatus(T.cutoutPreset(cutoutSummary()));
    } catch (e) { /* iframe not ready yet */ }
  }

  // ── Floating explanation popup ─────────────────────────────────────────
  // One shared bubble for every «?» button (the «Зоны» panel rows AND the
  // motion/difficulty parameter rows). Tapping a «?» anchors the popup to that
  // button; the explanation text rides on the button's data-hint attribute.
  // Works on touch (unlike title= tooltips) and — unlike the old inline hint —
  // floats over the layout instead of expanding a row, so nothing below shifts.
  // Tapping the same «?» again, tapping elsewhere, scrolling or resizing hides it.
  const hintPop = (function () {
    const el = document.createElement('div');
    el.className = 'hint-pop';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    let anchor = null;

    function hide() {
      if (!anchor) return;
      el.classList.remove('open');
      anchor.setAttribute('aria-expanded', 'false');
      anchor = null;
    }

    function place(btn) {
      const r = btn.getBoundingClientRect();
      const pw = el.offsetWidth, ph = el.offsetHeight, gap = 6, margin = 8;
      // Prefer below the button; flip above if it would overflow the viewport.
      let top = r.bottom + gap;
      if (top + ph > window.innerHeight - margin) {
        const above = r.top - gap - ph;
        top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - ph);
      }
      // Centre on the button horizontally, clamped to the viewport.
      let left = r.left + r.width / 2 - pw / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - pw));
      el.style.top = top + 'px';
      el.style.left = left + 'px';
    }

    function toggle(btn) {
      if (anchor === btn) { hide(); return; }
      hide();
      const text = btn.getAttribute('data-hint');
      if (!text) return;
      el.textContent = text;
      el.classList.add('open');         // visible first so offsetWidth/Height read
      anchor = btn;
      btn.setAttribute('aria-expanded', 'true');
      place(btn);
    }

    // A «?» anywhere toggles the popup; any other interaction dismisses it.
    document.addEventListener('click', e => {
      const btn = e.target.closest('.hint-q, .zp-info');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      toggle(btn);
    });
    document.addEventListener('pointerdown', e => {
      if (!anchor) return;
      if (el.contains(e.target) || e.target.closest('.hint-q, .zp-info')) return;
      hide();
    }, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return { hide };
  })();

  // Cutout/navigation options live as rows inside the «Зоны» panel. Each row TOGGLES
  // one option (several can be on at once); its «?» opens a floating popup with a
  // Russian explanation (click/tap — so it works on touch, where title= tooltips
  // never show, and without pushing the rows below it down).
  (function buildCutoutList() {
    const host = document.getElementById('cutout-list');
    if (!host) return;
    const order = ['left', 'right', 'round', '3btn'];
    host.innerHTML = order.map(k =>
      '<div class="zp-row-wrap">' +
        '<div class="zp-row co-btn" data-co="' + k + '">' +
          '<span class="co-dot"></span>' +
          '<span class="zp-label">' + escHtml(T.cutoutLabels[k]) + '</span>' +
          '<button class="zp-info" type="button" aria-label="Пояснение" aria-expanded="false" data-hint="' + escHtml(T.cutoutHints[k]) + '">?</button>' +
        '</div>' +
      '</div>'
    ).join('');
    host.querySelectorAll('.co-btn').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.zp-info')) return;   // «?» handled separately
        toggleCutout(row.dataset.co);
      });
    });
    syncCutoutButtons();
  })();

