  function buildUI() {
    groupsEl.innerHTML = '';
    const snap = MT.snapshot();

    Object.keys(MT.groups).forEach(gKey => {
      if (HIDDEN_GROUPS.has(gKey)) return;
      const params = MT.params.filter(p => p.group === gKey);
      if (!params.length) return;

      const det = document.createElement('details');
      det.dataset.group = gKey;
      det.dataset.subtab = subtabOf(gKey);

      // Wide card for groups with many params or boolean-only groups
      const allBool = params.every(p => typeof p.def === 'boolean');
      if (params.length > 5 || allBool) det.classList.add('wide');

      det.innerHTML = '<summary><span class="sum-arrow">▸</span>' +
        escHtml(MT.groups[gKey]) +
        '<span class="sum-count">' + params.length + '</span></summary>';

      if (allBool) {
        const grid = document.createElement('div');
        grid.className = 'toggle-grid';
        params.forEach(p => {
          const card = document.createElement('label');
          card.className = 'toggle-card';
          card.dataset.key = p.key;
          const v = snap[p.key];
          const inv = isDisableFlag(p);
          const on  = inv ? !v : v;          // displayed state
          card.title = p.key + (p.description ? ' — ' + p.description : '');
          card.innerHTML =
            '<span class="lbl">' + escHtml(posLabel(p)) + '</span>' + hintBtn(p) +
            '<span class="mt-toggle"><input type="checkbox" data-key="' + p.key + '"' + (inv ? ' data-invert="1"' : '') + (on ? ' checked' : '') + '><span class="track"></span></span>';
          grid.appendChild(card);
        });
        det.appendChild(grid);

      } else {
        const grid = document.createElement('div');
        grid.className = 'mt-params-grid';

        params.forEach(p => {
          const isNum = typeof p.def !== 'boolean' && typeof p.def !== 'string';
          // Numeric rows are <div> (not <label>): a <label> would forward
          // clicks on the −/+ buttons to the number input.
          const row = document.createElement(isNum ? 'div' : 'label');
          const v = snap[p.key];
          row.dataset.key = p.key;

          // Full info in tooltip; visible label stays short
          const tipParts = [p.key];
          if (p.unit) tipParts.push('(' + p.unit + ')');
          if (p.category) tipParts.push('· ' + p.category);
          if (p.description) tipParts.push('— ' + p.description);
          const badges = [];
          if (p.liveSafe) badges.push('live');
          if (p.requiresReplay) badges.push('replay');
          if (p.visualsOnly) badges.push('visual');
          if (p.affectsGameplay && !p.visualsOnly) badges.push('gameplay');
          if (badges.length) tipParts.push('[' + badges.join(', ') + ']');
          row.title = tipParts.join(' ');

          const unitHtml = p.unit ? ' <small>' + escHtml(p.unit) + '</small>' : '';
          const lblHtml = '<span class="lbl-wrap"><span class="lbl">' + escHtml(posLabel(p)) + unitHtml + '</span>' + hintBtn(p) + '</span>';

          if (typeof p.def === 'boolean') {
            const inv = isDisableFlag(p);
            const on  = inv ? !v : v;
            row.className = 'mt-row mt-bool';
            row.innerHTML = lblHtml +
              '<span class="mt-toggle"><input type="checkbox" data-key="' + p.key + '"' + (inv ? ' data-invert="1"' : '') + (on ? ' checked' : '') + '><span class="track"></span></span>';
          } else if (typeof p.def === 'string') {
            row.className = 'mt-row mt-string';
            const opts = SELECT_OPTIONS[p.key];
            if (opts) {
              const optHtml = opts.map(o =>
                '<option value="' + escHtml(o[0]) + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'
              ).join('');
              row.innerHTML = lblHtml +
                '<select class="mt-text" data-key="' + p.key + '">' + optHtml + '</select>';
            } else {
              row.innerHTML = lblHtml +
                '<input class="mt-text" data-key="' + p.key + '" type="text" value="' + escHtml(String(v)) + '">';
            }
          } else {
            row.className = 'mt-row';
            const numAttrs =
              (p.min  != null ? ' min="'  + p.min  + '"' : '') +
              (p.max  != null ? ' max="'  + p.max  + '"' : '') +
              (p.step != null ? ' step="' + p.step + '"' : '');
            row.innerHTML = lblHtml +
              '<div class="mt-stepper">' +
                '<button type="button" class="mt-step" data-key="' + p.key + '" data-dir="-1" tabindex="-1" aria-label="Уменьшить">−</button>' +
                '<input class="mt-num" data-key="' + p.key + '" type="number" inputmode="decimal"' + numAttrs + ' value="' + v + '">' +
                '<button type="button" class="mt-step" data-key="' + p.key + '" data-dir="1" tabindex="-1" aria-label="Увеличить">+</button>' +
              '</div>';
          }
          grid.appendChild(row);
        });
        det.appendChild(grid);
      }

      groupsEl.appendChild(det);
    });

    wireInputs();
    buildSubtabs();
    if (typeof syncScenarioBar === 'function') syncScenarioBar();
  }

  // Params that feed the field LAYOUT (bay/runway/plane geometry) rather than a
  // per-frame physics read. layout() only re-runs on resize, so after applying one
  // of these we poke the game with a 'resize' event to recompute the playfield live.
  const LAYOUT_KEYS = new Set(['K.PLANE_SCALE', 'K.RUNWAY_RATIO', 'K.RUNWAY_R', 'K.HANGAR_RATIO']);
  function nudgeLayout(key) {
    if (!LAYOUT_KEYS.has(key)) return;
    try { gameFrame.contentWindow.dispatchEvent(new Event('resize')); } catch (_) {}
  }

  function wireInputs() {
    groupsEl.addEventListener('input', e => {
      const key = e.target.dataset && e.target.dataset.key;
      if (!key || !MT) return;
      if (e.target.type === 'checkbox') return;            // handled in 'change'
      const isText = e.target.type === 'text' || e.target.tagName === 'SELECT';
      const val = isText ? e.target.value : parseFloat(e.target.value);
      if (!isText && !Number.isFinite(val)) return;
      groupsEl.querySelectorAll('[data-key="' + key + '"]').forEach(el => {
        if (el !== e.target) el.value = val;
      });
      MT.apply({ [key]: val }, false);
      nudgeLayout(key);
      setStatus(key + '  →  ' + val);
    });

    groupsEl.addEventListener('change', e => {
      const key = e.target.dataset && e.target.dataset.key;
      if (!key || !MT) return;
      if (e.target.type === 'checkbox') {
        // Inverted ("Отключить …") toggles store the opposite of what's shown.
        const val = e.target.dataset.invert ? !e.target.checked : e.target.checked;
        // keep mirrored copies of the same toggle (e.g. дубль слоёв в «Боксы и ВПП») in sync
        groupsEl.querySelectorAll('input[type=checkbox][data-key="' + key + '"]').forEach(el => {
          if (el !== e.target) el.checked = el.dataset.invert ? !val : val;
        });
        MT.apply({ [key]: val }, true);
        setStatus(key + '  →  ' + val);
        // Включение слоя зон захвата сразу показывает оверлей превью — там живут
        // ручки перетаскивания/масштаба полукруглой зоны (см. Field overlay).
        if (val && (key === 'MT.DEBUG_BAY_SNAP_ZONES' || key === 'MT.DEBUG_RUNWAY_SNAP_ZONES' || key === 'MT.DEBUG_MOTION_POINTS') && window._setZones) window._setZones(true);
      } else if (e.target.type === 'text' || e.target.tagName === 'SELECT') {
        MT.apply({ [key]: e.target.value }, true);
        setStatus(key + '  →  ' + e.target.value);
      } else {
        MT.apply({ [key]: parseFloat(e.target.value) }, true);
      }
      nudgeLayout(key);
    });

  }

  // −/+ stepper buttons (Motion params + lab stubs): nudge the number field in
  // the same .mt-stepper by its step, then dispatch input/change so the relevant
  // listeners (delegated MT handlers, or inline lab oninput) apply it.
  // Pointer-based so a *held* button auto-repeats (and accelerates) instead of
  // just selecting the «+»; document-level so it covers every stepper anywhere.
  (function () {
    let activeBtn = null, holdTimer = null;

    // One nudge. Returns false when the value can't change (already clamped at
    // min/max) so the auto-repeat can stop instead of spinning uselessly.
    function doStep(btn) {
      const wrap  = btn.closest('.mt-stepper');
      const input = wrap && wrap.querySelector('input[type=number]');
      if (!input || input.disabled) return false;
      const dir  = parseFloat(btn.dataset.dir) || 1;
      const step = parseFloat(input.step) || 1;
      const dec  = (String(input.step).split('.')[1] || '').length;   // step decimals → avoid float drift
      let val = parseFloat(input.value);
      if (!Number.isFinite(val)) val = 0;
      const before = val;
      val = +(val + dir * step).toFixed(dec);
      if (input.min !== '' && val < +input.min) val = +input.min;
      if (input.max !== '' && val > +input.max) val = +input.max;
      if (val === before) return false;   // clamped — nothing to do
      input.value = val;
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    function stopHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      activeBtn = null;
    }

    // After an initial delay, repeat — speeding up the longer it's held.
    function startHold() {
      let n = 0;
      function tick() {
        if (!activeBtn || !doStep(activeBtn)) { stopHold(); return; }
        n++;
        const interval = n < 12 ? 70 : n < 30 ? 40 : 20;
        holdTimer = setTimeout(tick, interval);
      }
      holdTimer = setTimeout(tick, 380);
    }

    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest && e.target.closest('.mt-step');
      if (!btn) return;
      if (e.button != null && e.button > 0) return;   // ignore right/middle click
      e.preventDefault();                              // no focus jump / text-selection
      activeBtn = btn;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      if (doStep(btn)) startHold();                    // immediate first step, then hold-repeat
    });
    document.addEventListener('pointerup',     stopHold);
    document.addEventListener('pointercancel', stopHold);
    window.addEventListener('blur', stopHold);
  })();

  function syncUI() {
    if (!MT) return;
    const snap = MT.snapshot();
    groupsEl.querySelectorAll('[data-key]').forEach(el => {
      const v = snap[el.dataset.key];
      if (v == null) return;
      if (el.type === 'checkbox') el.checked = el.dataset.invert ? !v : !!v;
      else el.value = v;
    });
  }

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    groupsEl.querySelectorAll('.mt-row, .toggle-card').forEach(row => {
      const p = MT && MT.params.find(x => x.key === row.dataset.key);
      const labelEl = row.querySelector('b') || row.querySelector('.lbl');
      const visible = !q ||
        (row.dataset.key && row.dataset.key.toLowerCase().includes(q)) ||
        (labelEl && labelEl.textContent.toLowerCase().includes(q)) ||
        (p && p.description && p.description.toLowerCase().includes(q)) ||
        (p && p.category && p.category.toLowerCase().includes(q));
      row.style.display = visible ? '' : 'none';
    });
    // While searching, span every sub-tab (the sub-tab filter is suspended);
    // when the query is cleared, restore the active sub-tab.
    subtabBar.classList.toggle('searching', !!q);
    if (q) {
      const tab = activeTopTab();
      groupsEl.querySelectorAll('details').forEach(det => {
        // Search spans sub-tabs, but stays within the active top-level tab —
        // groups owned by the other tab (e.g. demo groups while on «Движение») stay hidden.
        if (SUBTAB_TAB[det.dataset.subtab] !== tab) { det.style.display = 'none'; return; }
        const hasVisible = [...det.querySelectorAll('.mt-row, .toggle-card')].some(r => r.style.display !== 'none');
        det.style.display = hasVisible ? '' : 'none';
        det.open = true;
      });
    } else if (currentSubtab) {
      applySubtab(currentSubtab);
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!MT) return;
    if (!confirm(T.confirmReset)) return;
    MT.reset(); syncUI(); resetCutout();
    // Reset the safe-zone overlay state too, so «Сбросить всё» really resets all.
    document.querySelectorAll('#zones-list input[data-zone]').forEach(i => { i.checked = true; });
    if (window._zoneVis) Object.keys(window._zoneVis).forEach(k => { window._zoneVis[k] = true; });
    if (window._setZones)        window._setZones(false);    // overlay off
    if (window._closeZonesPanel) window._closeZonesPanel();  // legend hidden
    setStatus(T.paramsReset);
  });

  // Единый экспорт: всё, что настроено одним файлом — черновик уровня (разметка +
  // сложность + скины), правки кампании LEVELS и движковые ручки MotionTuning.
  function unifiedExportText() {
    const out = { aerovia: 'tuning/v1', exportedAt: new Date().toISOString() };
    try { if (window.Draft) out.level = window.Draft.export(); } catch (_) {}
    try { if (Array.isArray(labLevels) && labLevels.length) out.levels = labLevels; } catch (_) {}
    try { if (MT) out.motionTuning = JSON.parse(MT.export()); } catch (_) {}
    return JSON.stringify(out, null, 2);
  }
  function applyUnifiedImport(data) {
    if (data.motionTuning && MT) { try { MT.importText(JSON.stringify(data.motionTuning)); syncUI(); } catch (_) {} }
    if (data.level && window.Draft && window.Draft.import) { try { window.Draft.import(data.level); } catch (_) {} }
    if (Array.isArray(data.levels) && window._importLevels) { try { window._importLevels(data.levels); } catch (_) {} }
  }

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([unifiedExportText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aerovia-tuning.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(T.exportDone);
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const data = JSON.parse(text);
        if (data && (data.aerovia || data.level || data.motionTuning || (data.levels && data.version == null))) {
          applyUnifiedImport(data);                                            // единый формат
        } else if (data && (data.layout || data.objective || data.apron)) {
          if (window.Draft && window.Draft.import) window.Draft.import(data);   // одиночный уровень/разметка
        } else if (data && data.version != null && Array.isArray(data.levels)) {
          if (window._importLevels) window._importLevels(data.levels);          // старый экспорт кампании
        } else if (MT) {
          MT.importText(text); syncUI();                                        // движковые ручки (старый формат)
        }
        setStatus(T.importDone(file.name));
      } catch (err) { setStatus(T.importError(err.message)); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  function setStatus(msg) { if (statusBar) statusBar.textContent = msg; }   /* status bar removed — no-op safe */

  /* ── Level & Difficulty labs ──────────────────────────────────────────────
     Editor + live analysis over the REAL campaign data. The game iframe loads
     with ?test=1, which exposes window.__GAME (LEVELS + the pure config helpers
     and analyzeLevel from src/game/14-level-analysis.ts) — ?test=1 only attaches
     that hook, it does not change gameplay or visuals.

     Edits go onto a deep-cloned WORKING COPY (labLevels), never the running
     campaign in the preview, and re-run the same pure functions the game uses
     (analyzeLevel / levelEconomy / paceInterval …). "Save" is JSON export — paste
     the values back into LEVELS in src/game/04-config-levels.ts. The difficulty
     model is documented in docs/design/game-design/difficulty_curve.md. */
  let GAME = null;          // window.__GAME once the iframe is ready
  let labLevels = [];       // editable deep clones of GAME.LEVELS
  let labSel = 0;           // selected level index, shared by both labs
  let diffSource = 'draft'; // вкладка «Сложность»: анализировать черновик «Разметки» или уровень кампании

  const LAB_CALM = 4;       // CALM_LEVELS — no specials before L5 (validateLevels)
  const LAB_EVENT_LBL = { vip:'VIP', emergency:'Mayday', rush:'Час пик', medical:'Медэвак' };
  const LAB_FACTOR_LBL = {
    traffic:'Трафик (темп)', capacity:'Загрузка боксов', events:'Спецборты',
    timePressure:'Время / race', economy:'Экономика', geometry:'Геометрия поля',
  };
  const LAB_SVC_LBL = { fuel:'🛢 Топливо', board:'🚪 Посадка', repair:'🔧 Ремонт', cargo:'📦 Карго', vip:'⭐ VIP' };

