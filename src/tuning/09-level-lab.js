  function labGame() {
    try { const fw = gameFrame.contentWindow; return fw && fw.__GAME ? fw.__GAME : null; } catch (_) { return null; }
  }
  function labLevelName(i) { try { return GAME.levelName(i); } catch (_) { return 'Уровень ' + (i + 1); } }
  function labRunways(lv)  { return lv.layout && lv.layout.runways ? lv.layout.runways.length : (lv.runways || 1); }
  function labEventList(lv){ const ev = lv.events || {}; return Object.keys(LAB_EVENT_LBL).filter(k => ev[k]).map(k => LAB_EVENT_LBL[k]); }
  function labFmt(n, d)    { return Number(n).toFixed(d == null ? 2 : d); }
  function curLevel()      { return labLevels[labSel]; }

  function pollGame() {
    const g = labGame();
    if (g && Array.isArray(g.LEVELS) && g.LEVELS.length && typeof g.analyzeLevel === 'function') {
      GAME = g; cloneLevels(); buildLabs(); return;
    }
    setTimeout(pollGame, 150);
  }

  function cloneLevels() {
    labLevels = GAME.LEVELS.map(lv => JSON.parse(JSON.stringify(lv)));   // plain data — safe to clone
  }

  function buildLabs() {
    if (!GAME) return;
    buildDiffSelect();
    wireDiffSource();
    buildDiffEditor();
    buildEvents();
    wireEditor();
    document.getElementById('lab-reset').onclick  = resetEdits;
    const lvlFilter = document.getElementById('level-filter');
    if (lvlFilter && !lvlFilter._wired) { lvlFilter._wired = true; lvlFilter.addEventListener('input', applyLevelFilter); }
    const cap = document.getElementById('diff-cap');
    if (cap && GAME.K) cap.textContent = labFmt(GAME.K.ECON_DIFF_CAP, 1);
    // «Старт. деньги 0 = дефолт» — spell out what the default actually is
    // (K.START_MONEY), so the editor doesn't have to guess. Two identical hints:
    // the level editor («Правка уровня») and the draft editor («Сложность»).
    const defMoney = (GAME.K && GAME.K.START_MONEY != null) ? GAME.K.START_MONEY : 0;
    ['ed-money-hint', 'de-money-hint'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0 = дефолт (' + defMoney + ')';
    });
    labSelect(Math.min(labSel, labLevels.length - 1));
  }

  /* ---- overview table + pace sparkline (rebuilt on every edit) ---- */
  function renderTable() {
    const wrap = document.getElementById('level-table-wrap');
    let h = '<table class="lab-table"><thead><tr>' +
      '<th>#</th><th>Имя</th><th>pace</th><th>инт.</th><th>одн.</th><th>звёзды</th><th>ВПП</th><th>боксы</th><th>события</th><th>сложн.</th>' +
      '</tr></thead><tbody>';
    labLevels.forEach((lv, i) => {
      const pace = GAME.levelPace(lv);
      const rep  = GAME.analyzeLevel(lv);
      const stars = ((lv.objective && lv.objective.stars) || []).join('/');
      const evs   = labEventList(lv);
      const open  = GAME.countOpenHangars(lv), tot = GAME.countTotalHangars(lv);
      h += '<tr data-idx="' + i + '"' + (i === labSel ? ' class="sel"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(labLevelName(i)) + '</td>' +
        '<td>' + labFmt(pace) + '</td>' +
        '<td>' + labFmt(GAME.paceInterval(pace), 1) + 's</td>' +
        '<td>' + GAME.paceCap(pace) + '</td>' +
        '<td>' + (stars || '—') + '</td>' +
        '<td>' + labRunways(lv) + '</td>' +
        '<td>' + open + '/' + tot + '</td>' +
        '<td>' + (evs.length ? escHtml(evs.join(' · ')) : '—') + '</td>' +
        '<td class="diff-cell">' + Math.round(rep.total * 100) + '%</td>' +
        '</tr>';
    });
    h += '</tbody></table>';
    wrap.innerHTML = h;
    wrap.querySelectorAll('tr[data-idx]').forEach(tr =>
      tr.addEventListener('click', () => labSelect(+tr.dataset.idx)));
    applyLevelFilter();
    // keep the chosen level in view inside the bounded scroll box
    const selRow = wrap.querySelector('tr.sel');
    if (selRow) selRow.scrollIntoView({ block: 'nearest' });
  }

  // Filter the campaign list by level number ("12") or name. Rows are hidden
  // in place (data-idx preserved) so selection/edit keep pointing at the right
  // level — this keeps the list usable when there are hundreds of levels.
  function applyLevelFilter() {
    const wrap = document.getElementById('level-table-wrap');
    const input = document.getElementById('level-filter');
    const countEl = document.getElementById('level-count');
    if (!wrap) return;
    const q = (input && input.value || '').trim().toLowerCase();
    const rows = wrap.querySelectorAll('tr[data-idx]');
    let shown = 0;
    rows.forEach(tr => {
      const i = +tr.dataset.idx;
      const hay = ((i + 1) + ' ' + labLevelName(i)).toLowerCase();
      const hit = !q || hay.indexOf(q) !== -1;
      tr.classList.toggle('hidden', !hit);
      if (hit) shown++;
    });
    if (countEl) countEl.textContent = q ? (shown + ' / ' + rows.length) : (rows.length + ' ур.');
  }

  function renderPaceChart() {
    const chart = document.getElementById('level-pace-chart');
    const axis  = document.getElementById('level-pace-axis');
    let bars = '', ax = '';
    labLevels.forEach((lv, i) => {
      const pace = GAME.levelPace(lv);
      const ht   = Math.round(8 + pace * 92);    // 8%..100% so pace 0 is still visible
      bars += '<div class="pace-bar' + (i === labSel ? ' sel' : '') + '" data-idx="' + i + '" style="height:' + ht + '%" title="L' + (i + 1) + ' · pace ' + labFmt(pace) + '"></div>';
      ax   += '<span>' + (i + 1) + '</span>';
    });
    chart.innerHTML = bars; axis.innerHTML = ax;
    chart.querySelectorAll('.pace-bar').forEach(b =>
      b.addEventListener('click', () => labSelect(+b.dataset.idx)));
  }

  function buildDiffSelect() {
    const sel = document.getElementById('diff-level-sel');
    sel.innerHTML = labLevels.map((lv, i) =>
      '<option value="' + i + '">L' + (i + 1) + ' · ' + escHtml(labLevelName(i)) + '</option>').join('');
    sel.onchange = () => labSelect(+sel.value);
  }

  function wireDiffSource() {
    const wrap = document.getElementById('diff-source');
    if (!wrap) return;
    wrap.querySelectorAll('input[name="diffsrc"]').forEach(r => {
      r.addEventListener('change', () => {
        diffSource = r.value;
        wrap.querySelectorAll('.lab-chip').forEach(c => c.classList.toggle('on', c.dataset.src === diffSource));
        const camp = diffSource === 'campaign';
        document.getElementById('diff-level-row').style.display = camp ? '' : 'none';
        document.getElementById('diff-src-hint').textContent = camp
          ? 'Анализируется выбранный уровень кампании (правки идут по рабочей копии вкладки «Уровни»).'
          : 'Анализируется твой черновик из «Разметки». Меняй поле/темп там — здесь обновится при возврате.';
        renderDiff();
      });
    });
  }

  function buildEvents() {
    document.getElementById('ed-events').innerHTML = Object.keys(LAB_EVENT_LBL).map(k =>
      '<label class="lab-chip" data-ev="' + k + '"><input type="checkbox" data-ev="' + k + '"> ' + escHtml(LAB_EVENT_LBL[k]) + '</label>').join('');
    document.querySelectorAll('#ed-events input[data-ev]').forEach(el => {
      el.addEventListener('change', () => {
        const lv = curLevel(); lv.events = lv.events || {};
        if (el.checked) lv.events[el.dataset.ev] = true; else delete lv.events[el.dataset.ev];
        el.closest('.lab-chip').classList.toggle('on', el.checked);
        recompute();
      });
    });
  }

  /* ---- editor wiring: each control writes the working copy, then recompute.
     Controls are −/+ steppers (matches the Motion tab); the document-level
     .mt-step handler nudges the number field and dispatches 'input', which is
     the event we listen to here. ---- */
  function bindNum(id, set) {
    const n = document.getElementById(id);
    n.addEventListener('input', () => { const v = parseFloat(n.value); if (!Number.isFinite(v)) return; set(v); recompute(); });
  }
  function wireEditor() {
    bindNum('ed-pace', v => { curLevel().pace = Math.max(0, Math.min(1, v)); });
    bindNum('ed-runways', v => { const lv = curLevel(); if (!lv.layout) lv.runways = Math.round(v); });
    bindNum('ed-money', v => { const lv = curLevel(); if (v > 0) lv.startMoney = Math.round(v); else delete lv.startMoney; });
    bindNum('ed-time', v => { const o = curLevel().objective; if (v > 0) o.time = Math.round(v); else delete o.time; });
    ['ed-s1', 'ed-s2', 'ed-s3'].forEach((id, k) => {
      document.getElementById(id).addEventListener('input', e => {
        const o = curLevel().objective; o.stars = (o.stars || []).slice(0, 3);
        o.stars[k] = Math.max(1, Math.round(parseFloat(e.target.value) || 1));
        o.target = o.stars[2];   // 3★ = target (schema)
        recompute();
      });
    });
  }

  /* ---- load the selected level's values into the editor controls ---- */
  function loadEditor() {
    const lv = curLevel(), o = lv.objective || {};
    document.getElementById('ed-name').textContent = 'L' + (labSel + 1) + ' · ' + labLevelName(labSel);
    const setNum = (id, v) => { document.getElementById(id).value = v; };
    setNum('ed-pace', GAME.levelPace(lv));
    const isLayout = !!lv.layout;
    setNum('ed-runways', labRunways(lv));
    document.getElementById('ed-runways').disabled = isLayout;   // layout maps: runways come from the editor
    setNum('ed-money', lv.startMoney || 0);
    setNum('ed-time', o.time || 0);
    const st = o.stars || [];
    document.getElementById('ed-s1').value = st[0] != null ? st[0] : '';
    document.getElementById('ed-s2').value = st[1] != null ? st[1] : '';
    document.getElementById('ed-s3').value = st[2] != null ? st[2] : '';
    const ev = lv.events || {};
    document.querySelectorAll('#ed-events input[data-ev]').forEach(cb => {
      cb.checked = !!ev[cb.dataset.ev];
      cb.closest('.lab-chip').classList.toggle('on', cb.checked);
    });
    renderBays();
  }

  function renderBays() {
    const box = document.getElementById('ed-bays'), lv = curLevel();
    if (lv.layout) {
      box.innerHTML = '<span class="lab-empty">Раскладка задаётся в игровом конструкторе (явный layout). ' +
        'Здесь правятся темп, события, звёзды, деньги и время.</span>';
      return;
    }
    const sides = lv.sides || {};
    const keys = ['top', 'left', 'bottom'].filter(s => sides[s]);
    if (!keys.length) { box.innerHTML = '<span class="lab-empty">Нет сторон с боксами.</span>'; return; }
    box.innerHTML = keys.map(s => {
      const c = sides[s];
      const name = (LAB_SVC_LBL[c.type] || c.type);
      return '<div class="ed-bay-row">' +
        '<span class="ed-bay-lbl">' + escHtml(s) + ' · ' + escHtml(name) + '</span>' +
        '<input type="number" min="1" max="6" step="1" data-side="' + s + '" data-f="slots" value="' + c.slots + '" title="слотов">' +
        '<input type="number" min="0" max="6" step="1" data-side="' + s + '" data-f="open" value="' + c.open + '" title="открыто на старте">' +
        '</div>';
    }).join('');
    box.querySelectorAll('input[data-side]').forEach(inp => {
      inp.addEventListener('input', () => {
        const c = curLevel().sides[inp.dataset.side];
        let v = Math.max(0, Math.round(parseFloat(inp.value) || 0));
        if (inp.dataset.f === 'slots') { v = Math.max(1, v); c.slots = v; if (c.open > v) c.open = v; }
        else { c.open = Math.min(v, c.slots); }
        recompute();
      });
    });
  }

  /* ---- single entry point after any edit: rebuild everything from working copy ---- */
  function recompute() {
    renderTable();
    renderPaceChart();
    renderStarsWarn();
    renderDiff();
  }

  function renderStarsWarn() {
    const o = curLevel().objective || {}, st = o.stars || [];
    const warn = document.getElementById('ed-stars-warn');
    const issues = [];
    if (st.length < 3 || st.some(x => !(x > 0))) issues.push('нужны три порога ★');
    else if (!(st[0] < st[1] && st[1] < st[2])) issues.push('пороги должны строго возрастать (s1<s2<s3)');
    if (labSel < LAB_CALM && labEventList(curLevel()).length) issues.push('спецборты до L5 — валидатор это запретит');
    warn.textContent = issues.length ? '⚠ ' + issues.join(' · ') : '';
  }

  function labSelect(idx) {
    if (!GAME) return;
    labSel = Math.max(0, Math.min(labLevels.length - 1, idx | 0));
    const sel = document.getElementById('diff-level-sel');
    if (sel && +sel.value !== labSel) sel.value = String(labSel);
    loadEditor();
    recompute();
  }

  function labEconRow(k, v) {
    return '<tr><td style="color:var(--muted)">' + escHtml(k) +
      '</td><td style="text-align:right;font-weight:600;color:var(--text)">' + escHtml(String(v)) + '</td></tr>';
  }

  // какой уровень анализирует вкладка «Сложность»: черновик «Разметки» или выбранный уровень кампании
  function diffSourceLevel() {
    if (diffSource === 'draft' && window.Draft) {
      try { return window.Draft.export(); } catch (_) {}
    }
    return curLevel();
  }
  function renderDiff() {
    // «Уровни» → живой ярлык сложности всегда считаем по редактируемому уровню кампании
    try { document.getElementById('ed-diff-live').textContent = 'сложность ' + Math.round(GAME.analyzeLevel(curLevel()).total * 100) + '%'; } catch (_) {}
    const lv  = diffSourceLevel();
    const rep = GAME.analyzeLevel(lv);
    const pace = rep.pace;

    document.getElementById('diff-total').textContent      = labFmt(rep.total);
    document.getElementById('diff-pace').textContent       = labFmt(pace);
    document.getElementById('diff-pace-sub').textContent   = labFmt(GAME.paceInterval(pace), 1) + 's · ' + GAME.paceCap(pace) + ' бортов';
    document.getElementById('diff-econ-score').textContent = labFmt(rep.difficulty);
    document.getElementById('diff-stars').textContent      = ((lv.objective && lv.objective.stars) || []).join(' / ') || '—';

    document.getElementById('diff-factors').innerHTML = rep.components.map(c => {
      const lbl = LAB_FACTOR_LBL[c.label] || c.label;
      const pct = Math.round(c.score * 100);
      return '<div class="lab-bar-row">' +
        '<span class="lab-bar-label">' + escHtml(lbl) + ' <small style="color:var(--muted)">×' + labFmt(c.weight) + '</small></span>' +
        '<div class="lab-bar-track"><div class="lab-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="lab-bar-val">+' + labFmt(c.contrib) + '</span>' +
        '</div>';
    }).join('');

    const ec = rep.economy;
    document.getElementById('diff-econ').innerHTML =
      '<table class="f-table">' +
      labEconRow('Стартовые деньги', ec.startMoney) +
      labEconRow('Оплата за услугу', ec.svcReward) +
      labEconRow('Поток за смену',   ec.flow) +
      labEconRow('Цена набора',      Math.round(ec.kitCost)) +
      labEconRow('Щедрость',         '×' + labFmt(ec.generosity)) +
      labEconRow('Скилл-добор',      '×' + labFmt(ec.skillMult)) +
      '</table>';

    document.getElementById('diff-warnings').innerHTML = rep.warnings.length
      ? rep.warnings.map(w => '<div style="font-size:11px;color:#e3c522;padding:2px 0">⚠ ' + escHtml(w) + '</div>').join('')
      : '<span class="lab-empty">✓ Нет замечаний</span>';
    renderPass();
  }

