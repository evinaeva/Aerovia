  /* ───── РЕДАКТОР СЛОЖНОСТИ — все контролы пишут в черновик «Разметки» (window.Draft) ───── */
  const DE_EVENTS = [['vip','VIP'],['emergency','авария'],['medical','медицина'],['rush','час пик'],['fog','туман'],['wind','ветер']];
  const DE_COND   = [['money','💰 Деньги','≥',100],['lives','♥ Жизни','≥',1],['timeTier','⏱ За время, с','≤',120],['maxLate','⌛ Просрочек','≤',0],['maxCrash','💥 Крушений','≤',0]];
  const _clamp01 = v => Math.max(0, Math.min(1, v));
  function draftLE()    { return (window.Draft && window.Draft.raw) ? window.Draft.raw() : null; }
  function draftCommit(){ if (window.Draft && window.Draft.commit) window.Draft.commit(); }
  function afterDiffEdit(){ renderDiff(); }            // пересчитать анализ + валидатор (renderPass внутри)
  let diffEditorBuilt = false;
  function buildDiffEditor() {
    if (diffEditorBuilt) return;
    const evHost = document.getElementById('de-events');
    if (evHost) evHost.innerHTML = DE_EVENTS.map(([k,t]) =>
      `<label class="lab-chip" data-de-ev="${k}"><input type="checkbox"><span>${t}</span></label>`).join('');
    const condHost = document.getElementById('de-cond');
    if (condHost) condHost.innerHTML = DE_COND.map(([k,t,op]) =>
      `<div class="de-cond-row" data-de-cond="${k}" style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
         <label class="lab-chip" style="flex:none;white-space:nowrap" data-de-cond-tog="${k}"><input type="checkbox"><span>${t} ${op}</span></label>
         <input class="lab-num de-cond-v" type="number" step="1" data-i="0" style="flex:1;text-align:center" disabled>
         <input class="lab-num de-cond-v" type="number" step="1" data-i="1" style="flex:1;text-align:center" disabled>
         <input class="lab-num de-cond-v" type="number" step="1" data-i="2" style="flex:1;text-align:center" disabled>
       </div>`).join('');
    const bindLE = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => { const le = draftLE(); if (!le) return; fn(le, el); draftCommit(); afterDiffEdit(); }); };
    bindLE('de-pace',  (le,el)=> le.pace = _clamp01(+el.value||0));
    bindLE('de-money', (le,el)=> le.startMoney = Math.max(0, Math.min(2000, Math.round(+el.value||0))));
    bindLE('de-time',  (le,el)=> le.time = Math.max(0, Math.round(+el.value||0)));
    bindLE('de-calm',  (le,el)=> le.calm = Math.max(0, +el.value||0));
    bindLE('de-crash', (le,el)=> le.crashPenalty = _clamp01(+el.value||0));
    bindLE('de-late',  (le,el)=> le.latePenalty = _clamp01(+el.value||0));
    bindLE('de-open',  (le,el)=> le.openCost = Math.max(0, Math.round(+el.value||0)));
    bindLE('de-upg',   (le,el)=> le.upgCost = Math.max(0, Math.round(+el.value||0)));
    bindLE('de-rwcost',(le,el)=> le.rwOpenCost = Math.max(0, Math.round(+el.value||0)));
    bindLE('de-minup', (le,el)=> { le.minUp = Math.max(0, Math.min(5, Math.round(+el.value||0))); if (le.minUp > (le.maxUp??5)) le.maxUp = le.minUp; });
    bindLE('de-maxup', (le,el)=> { le.maxUp = Math.max(0, Math.min(5, Math.round(+el.value||0))); if ((le.minUp||0) > le.maxUp) le.minUp = le.maxUp; });
    // фазовые множители скорости на ВПП → черновик level.motion (× к базовой, 0.1..3)
    const _clampMot = v => Math.max(0.1, Math.min(3, +v||1));
    [['de-mot-landbefore','landBefore'],['de-mot-landafter','landAfter'],['de-mot-takeoffroll','takeoffRoll'],['de-mot-climb','climb']]
      .forEach(([id,key]) => bindLE(id, (le,el)=> { le.motion = le.motion || {}; le.motion[key] = _clampMot(el.value); }));
    ['de-s1','de-s2','de-s3'].forEach((id,i)=> bindLE(id, (le,el)=>{ le.stars = (le.stars||[1,1,1]).slice(0,3); le.stars[i] = Math.max(1, Math.round(+el.value||1)); }));
    const metric = document.getElementById('de-metric');
    if (metric) metric.addEventListener('change', () => { const le = draftLE(); if (!le) return; le.metric = metric.value; draftCommit(); renderDiffEditor(); afterDiffEdit(); });
    document.querySelectorAll('#de-events [data-de-ev]').forEach(chip =>
      chip.addEventListener('click', e => { e.preventDefault(); const le = draftLE(); if (!le) return; const k = chip.dataset.deEv; le.events = le.events || {}; le.events[k] = !le.events[k]; draftCommit(); renderDiffEditor(); afterDiffEdit(); }));
    document.querySelectorAll('#de-modes [data-mode]').forEach(chip =>
      chip.addEventListener('click', e => { e.preventDefault(); const le = draftLE(); if (!le) return; const k = chip.dataset.mode; le[k] = !le[k]; draftCommit(); renderDiffEditor(); afterDiffEdit(); }));
    document.querySelectorAll('#de-cond [data-de-cond-tog]').forEach(tog =>
      tog.addEventListener('click', e => { e.preventDefault(); const le = draftLE(); if (!le) return; const k = tog.dataset.deCondTog; le.cond = le.cond || {};
        if (le.cond[k]) le.cond[k] = null; else { const def = (DE_COND.find(c=>c[0]===k)||[])[3]||0; le.cond[k] = [def,def,def]; }
        draftCommit(); renderDiffEditor(); afterDiffEdit(); }));
    document.querySelectorAll('#de-cond .de-cond-v').forEach(inp =>
      inp.addEventListener('input', () => { const le = draftLE(); if (!le) return; const row = inp.closest('[data-de-cond]'); const k = row.dataset.deCond; if (!le.cond || !le.cond[k]) return; le.cond[k][+inp.dataset.i] = Math.round(+inp.value||0); draftCommit(); afterDiffEdit(); }));
    const auto = document.getElementById('de-auto'), autoVal = document.getElementById('de-auto-val');
    if (auto) auto.addEventListener('input', () => { autoVal.textContent = auto.value + '%'; });
    const apply = document.getElementById('de-auto-apply');
    if (apply) apply.addEventListener('click', () => applyAuto(+((auto&&auto.value)||40) / 100));
    diffEditorBuilt = true;
  }
  function applyAuto(target) {
    const le = draftLE(); if (!le || !GAME || !GAME.autoDifficulty) return;
    const k = GAME.autoDifficulty(target);
    le.pace = k.pace;
    le.events = Object.assign({ vip:false, emergency:false, medical:false, rush:false, fog:false, wind:false }, k.events || {});
    if (k.objective) { le.metric = k.objective.metric || 'served'; le.stars = (k.objective.stars || le.stars).slice(0,3); le.time = k.objective.time || 0; le.race = !!k.objective.race; }
    le.weather = !!k.weather; le.deice = false;
    draftCommit(); renderDiffEditor(); afterDiffEdit();
    setStatus('Авто-сложность ' + Math.round(target*100) + '% → черновик обновлён');
  }
  function renderDiffEditor() {
    const le = draftLE(); if (!le) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('de-pace', le.pace); set('de-money', le.startMoney||0); set('de-time', le.time||0); set('de-calm', le.calm||0);
    set('de-crash', le.crashPenalty||0); set('de-late', le.latePenalty||0);
    set('de-open', le.openCost||0); set('de-upg', le.upgCost||0); set('de-rwcost', le.rwOpenCost||0);
    set('de-minup', le.minUp||0); set('de-maxup', le.maxUp!=null ? le.maxUp : 3);
    { const m = le.motion || {};
      set('de-mot-landbefore', m.landBefore ?? 1); set('de-mot-landafter', m.landAfter ?? 1);
      set('de-mot-takeoffroll', m.takeoffRoll ?? 1); set('de-mot-climb', m.climb ?? 1); }
    set('de-s1', (le.stars||[])[0]); set('de-s2', (le.stars||[])[1]); set('de-s3', (le.stars||[])[2]);
    const metric = document.getElementById('de-metric'); if (metric) metric.value = le.metric || 'served';
    const lbl = document.getElementById('de-stars-lbl');
    if (lbl) lbl.textContent = le.metric==='survival' ? 'Пороги 1★ / 2★ / 3★ (секунды)' : le.metric==='upgrades' ? 'Пороги 1★ / 2★ / 3★ (апгрейды)' : 'Пороги 1★ / 2★ / 3★ (борта)';
    document.querySelectorAll('#de-events [data-de-ev]').forEach(chip => { const on = !!(le.events && le.events[chip.dataset.deEv]); chip.classList.toggle('on', on); const cb = chip.querySelector('input'); if (cb) cb.checked = on; });
    document.querySelectorAll('#de-modes [data-mode]').forEach(chip => { const on = !!le[chip.dataset.mode]; chip.classList.toggle('on', on); const cb = chip.querySelector('input'); if (cb) cb.checked = on; });
    document.querySelectorAll('#de-cond [data-de-cond]').forEach(row => { const k = row.dataset.deCond; const arr = le.cond && le.cond[k]; const on = Array.isArray(arr);
      const tog = row.querySelector('[data-de-cond-tog]'); tog.classList.toggle('on', on); const tcb = tog.querySelector('input'); if (tcb) tcb.checked = on;
      row.querySelectorAll('.de-cond-v').forEach(inp => { inp.disabled = !on; inp.value = on ? arr[+inp.dataset.i] : ''; }); });
    const s = le.stars || [], w = document.getElementById('de-stars-warn');
    if (w) w.textContent = (s[0]>0 && s[0]<=s[1] && s[1]<=s[2]) ? '' : '⚠ пороги должны идти по возрастанию';
  }
  function renderPass() {
    const host = document.getElementById('diff-pass'); if (!host || !GAME || !GAME.validatePassable) return;
    let lv; try { lv = window.Draft ? window.Draft.export() : curLevel(); } catch (_) { lv = curLevel(); }
    if (!lv) { host.innerHTML = '<span class="lab-empty">—</span>'; return; }
    const rep = GAME.validatePassable(lv);
    const rows = rep.tiers.map(tr =>
      `<div class="lab-bar-row"><span class="lab-bar-label">${tr.star}★ ${tr.ok?'🟢':'🔴'}</span>` +
      `<span style="flex:1;font-size:11px;color:${tr.ok?'var(--muted)':'#e3c522'}">${tr.ok?'достижимо':escHtml(tr.reasons.join(' · '))}</span></div>`).join('');
    const gl = rep.globalReasons.length ? '<div style="font-size:11px;color:#e3c522;padding:2px 0">⚠ ' + rep.globalReasons.map(escHtml).join(' · ') + '</div>' : '';
    host.innerHTML = gl + rows + `<div style="margin-top:6px;font-weight:600;color:${rep.ok?'#22e3c6':'#e3c522'}">${rep.ok?'✓ Проходим на все три звезды':'✗ Есть недостижимые тиры'}</div>`;
  }

  /* Экспорт кампании LEVELS теперь идёт через единый экспорт «Файл» (см.
     unifiedExportText → поле `levels`); отдельных кнопок выгрузки в табе нет. */
  function resetEdits() {
    if (!GAME) return;
    if (!confirm('Сбросить все правки уровней к значениям из игры?')) return;
    cloneLevels();
    buildDiffSelect();
    labSelect(Math.min(labSel, labLevels.length - 1));
    setStatus('Правки уровней сброшены.');
  }
  // Восстановить правленый массив LEVELS из единого импорта «Файл».
  window._importLevels = function (arr) {
    if (!Array.isArray(arr) || !GAME) return;
    labLevels = arr.map(lv => JSON.parse(JSON.stringify(lv)));
    buildDiffSelect();
    labSelect(Math.min(labSel, labLevels.length - 1));
  };

