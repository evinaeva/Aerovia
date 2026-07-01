  /* ── Workbench logic (unchanged) ─────────────────────────────────────── */

  const gameFrame  = document.getElementById('game-frame');
  const groupsEl   = document.getElementById('groups');
  const statusBar  = document.getElementById('status-bar');
  const searchEl   = document.getElementById('search');

  let MT = null;

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function pollMT() {
    try {
      const mt = gameFrame.contentWindow && gameFrame.contentWindow.__MT;
      if (mt && Array.isArray(mt.params) && mt.params.length) {
        MT = mt;
        buildUI();
        setStatus(T.paramsReady(mt.params.length));
        // Превью «Разметка» — режим по умолчанию: первая отрисовка холста прошла ДО
        // загрузки игры (запасной размер бокса). Теперь __FIELD готов — перерисуем,
        // чтобы ангары/ВПП встали в РЕАЛЬНЫЙ размер из игры, а не из фолбэка.
        if (window._layoutResize) window._layoutResize();
        return;
      }
    } catch (_) {}
    setTimeout(pollMT, 150);
  }

  gameFrame.addEventListener('load', () => { setTimeout(pollMT, 80); setTimeout(pollGame, 80); });

  // ── Scenario bar (floating top-left of preview): sync with MT on load/change ──
  (function() {
    const sel = document.getElementById('scenario-sel');
    if (!sel) return;
    sel.addEventListener('change', function() {
      if (!MT) return;
      MT.apply({ 'MT.SCENARIO': sel.value }, true);
    });
    // syncScenarioBar() is called from buildUI() to keep the select in sync
  })();

  function syncScenarioBar() {
    const sel = document.getElementById('scenario-sel');
    if (!sel || !MT) return;
    const v = MT.snapshot()['MT.SCENARIO'];
    sel.value = (v != null ? String(v) : 'none');
  }

  /* ── Sub-tabs for the «Движение» & «Сложность» tabs ────────────────────────
     ~20 parameter groups in one list is unreadable, so we bucket them by domain
     and show one bucket at a time. Each <details> card is tagged data-subtab.
     Each sub-tab declares its `owner` top-level tab; the sub-tab bar shows only
     the sub-tabs belonging to whichever owner tab is currently active.
     Бывший таб «Настройки игры» удалён — его движковые группы (Контроль/Поток/
     События) теперь живут под редактором «Сложности» (см. activateTab). */
  const subtabBar = document.getElementById('subtab-bar');
  let   currentSubtab = null;                               // active sub-tab key
  const lastSubtab = { motion: null, difficulty: null };   // last sub-tab used, per owner tab

  const SUBTABS = [
    // «Движение» tab — plane physics / flight / ground tuning.
    { owner:'motion',     key:'plane',   icon:'✈',  label:'Самолёт',  groups:['movement','turns','routing','collisions','effects','weather'] },
    { owner:'motion',     key:'takeoff', icon:'🛫', label:'Взлёт',    groups:['takeoff','aircraft_scale','flight_overlay'] },
    { owner:'motion',     key:'landing', icon:'🛬', label:'Посадка',  groups:['approach','landing','rollout_stop'] },
    { owner:'motion',     key:'bays',    icon:'🅿', label:'Боксы',    groups:['service','bay_nav','service_bay_geometry','snap_zones'] },
    { owner:'motion',     key:'runway',  icon:'🛤', label:'ВПП',      groups:['runway_geometry','debug_overlays'] },
    { owner:'motion',     key:'ui',      icon:'🎬', label:'Анимации', groups:['ui_anim'] },
    // «Сложность» tab — движковые ручки тест/демо-сессии (один подтаб).
    { owner:'difficulty', key:'control', icon:'⚙',  label:'Настройки',      groups:['ctrl','spawn','timing','events'] },
    // 'zones' (safe_areas) intentionally not surfaced — see HIDDEN_GROUPS below.
    // Those params describe a target device's reserved screen regions for the
    // layout-overlay / export-warning diagnostics; the operator can't (and needn't)
    // change them, so the sub-tab is hidden. The «📐 Зоны» overlay toggle and the
    // export warnings keep working off the default values.
  ];
  const SUBTAB_OF  = {};   // group key   -> sub-tab key
  const SUBTAB_TAB = {};   // sub-tab key -> owner top-level tab
  SUBTABS.forEach(st => { SUBTAB_TAB[st.key] = st.owner; st.groups.forEach(g => { SUBTAB_OF[g] = st.key; }); });
  // Top-level tabs that present their groups through the sub-tab bar.
  const SUBTAB_TABS = new Set(['motion', 'difficulty']);
  // Anything unmapped lands in the demo «Контроль» sub-tab so nothing disappears.
  function subtabOf(group) { return SUBTAB_OF[group] || 'control'; }
  function activeTopTab() { return document.querySelector('.t-tab.active')?.dataset.tab; }

  function applySubtab(key) {
    currentSubtab = key;
    if (SUBTAB_TAB[key]) lastSubtab[SUBTAB_TAB[key]] = key;
    subtabBar.querySelectorAll('.s-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === key));
    groupsEl.querySelectorAll('details[data-subtab]').forEach(d => {
      d.style.display = d.dataset.subtab === key ? '' : 'none';
    });
    // Секция per-level ×-множителей ВПП видна только в подтабах «Взлёт» и «Посадка»
    document.querySelectorAll('.motion-runway-section').forEach(el => {
      el.style.display = (key === 'takeoff' || key === 'landing') ? '' : 'none';
    });
  }

  // (Re)build the sub-tab bar for the active top-level tab, then reveal that tab's
  // last-used sub-tab (or its first). Called on first param load and on tab switches.
  function buildSubtabs() {
    if (!subtabBar) return;
    const tab = activeTopTab();
    const counts = {};
    groupsEl.querySelectorAll('details[data-subtab]').forEach(d => {
      counts[d.dataset.subtab] = (counts[d.dataset.subtab] || 0) + 1;
    });
    const available = SUBTABS.filter(st => st.owner === tab && counts[st.key]);
    subtabBar.innerHTML = '';
    available.forEach(st => {
      const b = document.createElement('button');
      b.className = 's-tab';
      b.dataset.subtab = st.key;
      b.innerHTML = '<span>' + st.icon + '</span><span>' + st.label +
        '</span><span class="s-count">' + counts[st.key] + '</span>';
      b.addEventListener('click', () => applySubtab(st.key));
      subtabBar.appendChild(b);
    });
    subtabBar.style.display = (available.length > 1 && SUBTAB_TABS.has(tab)) ? 'flex' : 'none';
    let want = lastSubtab[tab];
    if (!want || !available.some(st => st.key === want)) want = available.length ? available[0].key : null;
    if (want) applySubtab(want);
  }

  // Groups the tuning panel intentionally hides (kept in the game's MotionTuning
  // for other tooling, but not surfaced here). Forest-biome knobs live here.
  // 'safe_areas' = the Android cutout/gesture/inset zone params: they only feed
  // the layout overlay and export warnings (read-only device simulation), so the
  // operator has nothing to change — hidden from the panel.
  // 'mobile_preview' = the single «Сценарий превью» knob (MT.SCENARIO). It is
  // already driven by the scenario picker in the mode rail above the preview, so
  // the duplicate row in the «Самолёт» sub-tab is hidden — the rail picker stays
  // the one place to choose the preview scenario.
  const HIDDEN_GROUPS = new Set(['forest', 'safe_areas', 'mobile_preview']);

  // Enum params shown as a dropdown instead of a free-text field.
  const SELECT_OPTIONS = {
    'MT.BAY_GRAB_SHAPE': [
      ['semicircle', 'Полукруг'],
      ['square',     'Квадрат'],
    ],
    'MT.RUNWAY_GRAB_SHAPE': [
      ['semicircle', 'Полукруг'],
      ['square',     'Квадрат'],
    ],
    'MT.SCENARIO': [
      ['none',           'Выкл'],
      ['complete_cycle', 'Полный цикл'],
      ['landing',        'Посадка'],
      ['takeoff',        'Взлёт'],
      ['taxi',           'Руление'],
      ['service',        'Обслуживание'],
    ],
    'MT.SA_CUTOUT_SIDE': [
      ['none',  'Без выреза'],
      ['left',  'Слева'],
      ['right', 'Справа'],
      ['top',   'Сверху'],
    ],
  };

  // "Контроль событий" toggles are stored as DISABLE_* flags (on = feature off),
  // which reads backwards. Show them as the plain feature with normal polarity:
  // label without the "Отключить " prefix, and toggle on = feature ON.
  function isDisableFlag(p) { return /^Отключить\s+/i.test(p.label); }
  function posLabel(p) {
    if (!isDisableFlag(p)) return p.label;
    const s = p.label.replace(/^Отключить\s+/i, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // «?» button for a parameter row — tap opens the floating explanation popup
  // (the same affordance as the «Зоны» panel). The Russian note rides on
  // data-hint. Omitted when a param has no description.
  function hintBtn(p) {
    if (!p || !p.description) return '';
    return '<button class="hint-q" type="button" aria-label="Пояснение" aria-expanded="false" data-hint="' +
      escHtml(p.description) + '">?</button>';
  }

