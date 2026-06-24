  /* ── Ресурсы: примерка скинов зон на превью (холст «Разметки», геометрия 1:1) ───
     Реестр скинов читается из assets/skins/index.json (его собирает scan-skins.mjs).
     Выбор по зонам хранится в черновике (Draft.getSkins/setSkins) и едет в экспорт.
     Картинки выбранных скинов отдаются холсту разметки через window._setSkinPreview;
     рисует их модуль 12 в точные прямоугольники зон (см. _zoneSpec / drawSkinOverlay). */
  (function () {
    const ZONES = [
      ['apron', 'Апрон'],
      ['hangar', 'Ангар'], ['runway', 'ВПП'], ['plane', 'Самолёт'],
      ['arrival', 'Зона ожидания'],
      ['background', 'Декоративный фон'],
    ];
    const ZONE_GROUP = ['hangar', 'runway', 'plane'];   // эти три зоны — в одну строку парами «лейбл + селект»
    // состояния ангара для примерки (id движка + RU-подпись); 'auto' = по типу ангара
    const HANGAR_STATES = [
      ['auto', 'по типу'], ['fuel', 'заправка'], ['board', 'посадка'],
      ['repair', 'ремонт'], ['deice', 'антилёд'], ['occupied', 'занят'], ['locked', 'закрыт'],
    ];
    let registry = {};            // zone → [ { name, label, dir, states } ]
    const imgCache = new Map();   // path → HTMLImageElement
    let hangarState = 'auto', pips = 0, maxUp = 3;

    function img(path) {
      if (!path) return null;
      let im = imgCache.get(path);
      if (!im) { im = new Image(); im.onload = pushPreview; im.src = path; imgCache.set(path, im); }
      return im;
    }
    const skinById = (zone, id) => (registry[zone] || []).find(s => s.id === id) || null;

    // собрать { zone → Image } (для hangar — { state → Image }) из текущего выбора.
    // Выбор хранится как стабильный id скина (он же едет в экспорт) — не имя папки.
    function buildImages() {
      const out = {};
      if (!window.Draft) return out;
      const sk = window.Draft.getSkins();
      ZONES.forEach(([zone]) => {
        const sel = sk[zone];
        if (!sel || sel === 'default') return;
        const skin = skinById(zone, sel);
        if (!skin) return;
        if (zone === 'hangar') {
          out.hangar = {};
          Object.entries(skin.states).forEach(([st, p]) => { out.hangar[st] = img(p); });
        } else {
          out[zone] = img(Object.values(skin.states)[0]);   // не-ангарные зоны: одна картинка
        }
      });
      return out;
    }
    function pushPreview() {
      if (window._setSkinPreview) window._setSkinPreview({ images: buildImages(), hangarState, pips, maxUp });
    }
    // Резолв текущего выбора (Draft) в URL'ы картинок скинов по зонам. 'default' → null
    // (зону рисует движок сам). Ангар → { state: url } по 5 состояниям (fuel/board/repair/deice/locked).
    function buildZoneSkinUrls() {
      const out = {};
      if (!window.Draft) return out;
      const sk = window.Draft.getSkins();
      ZONES.forEach(([zone]) => {
        const sel = sk[zone];
        if (!sel || sel === 'default') { out[zone] = null; return; }
        const skin = skinById(zone, sel);
        if (!skin) { out[zone] = null; return; }
        if (zone === 'hangar') {
          const h = {};
          ['fuel', 'board', 'repair', 'deice', 'locked'].forEach(st => { h[st] = skin.states[st] || skin.states.locked || null; });
          out.hangar = h;
        } else {
          out[zone] = Object.values(skin.states)[0] || null;   // не-ангарные зоны: одна картинка
        }
      });
      return out;
    }
    // Проброс выбранных скинов в игровой iframe (превью/тест-игра): движок рисует их
    // ВМЕСТО процедурной отрисовки зоны (см. SPRITES.setZoneSkins + гейты в 09/09b).
    function pushSkinToGame() {
      try {
        const gw = document.getElementById('game-frame')?.contentWindow;
        if (!gw || !gw.__SPRITES || !gw.__SPRITES.setZoneSkins) return;
        gw.__SPRITES.setZoneSkins(buildZoneSkinUrls());
      } catch (_) {}
    }

    /* ---- UI: селекторы скинов по зонам (C27–C29: <select> вместо чипов) ---- */
    function makeZoneSel(zone) {
      const sel = document.createElement('select');
      sel.className = 'lab-select skin-zone-sel'; sel.style.maxWidth = '30ch'; sel.dataset.zone = zone;
      const opts = [['default', 'дефолт']].concat((registry[zone] || []).map(s => [s.id, s.label]));   // значение = стабильный id скина (едет в экспорт); 'default' = базовый неон (движок рисует сам)
      opts.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; sel.appendChild(o); });
      sel.addEventListener('change', () => { if (!window.Draft) return; const p = {}; p[zone] = sel.value; window.Draft.setSkins(p); syncResources(); });
      return sel;
    }
    function buildZones() {
      const host = document.getElementById('skin-zones'); if (!host) return;
      host.innerHTML = '';
      let groupRow = null;
      ZONES.forEach(([zone, label]) => {
        if (ZONE_GROUP.includes(zone)) {   // ангар/ВПП/самолёт — пары «лейбл + селект» в одной строке
          if (!groupRow) { groupRow = document.createElement('div'); groupRow.className = 'skin-zone-row'; host.appendChild(groupRow); }
          const pair = document.createElement('div'); pair.style.cssText = 'display:flex;align-items:center;gap:5px;flex:none;';
          const lbl = document.createElement('span'); lbl.className = 'skin-zone-lab'; lbl.style.width = 'auto'; lbl.style.whiteSpace = 'nowrap'; lbl.textContent = label;
          pair.appendChild(lbl); pair.appendChild(makeZoneSel(zone)); groupRow.appendChild(pair);
        } else {
          groupRow = null;
          const row = document.createElement('div'); row.className = 'skin-zone-row';
          const lab = document.createElement('div'); lab.className = 'skin-zone-lab'; lab.textContent = label; row.appendChild(lab);
          row.appendChild(makeZoneSel(zone)); host.appendChild(row);
        }
      });
    }
    /* ---- UI: состояние ангара ---- */
    function buildStates() {
      const host = document.getElementById('skin-hangar-state'); if (!host) return;
      host.innerHTML = '';
      HANGAR_STATES.forEach(([val, txt]) => {
        const c = document.createElement('label'); c.className = 'lab-chip'; c.dataset.state = val; c.textContent = txt;
        c.addEventListener('click', e => { e.preventDefault(); hangarState = val; syncResources(); });
        host.appendChild(c);
      });
    }
    /* ---- UI: число купленных точек апгрейда (0..maxUp) ---- */
    function buildPips() {
      const host = document.getElementById('skin-hangar-pips'); if (!host) return;
      host.innerHTML = '';
      for (let i = 0; i <= maxUp; i++) {
        const b = document.createElement('button'); b.className = 'p-btn' + (i === pips ? ' on' : ''); b.textContent = i;
        b.addEventListener('click', () => { pips = i; syncResources(); });
        host.appendChild(b);
      }
    }
    /* ---- живые размеры зон из холста разметки ---- */
    function renderSpec() {
      const host = document.getElementById('skin-spec'); if (!host) return;
      const spec = window._zoneSpec ? window._zoneSpec() : null;
      const sub = document.getElementById('skin-spec-sub');
      if (!spec) { host.innerHTML = '<span class="lab-empty">Открой превью в режиме «Разметка».</span>'; return; }
      if (sub) sub.textContent = spec.canvas.W + '×' + spec.canvas.H + ' · ui ' + spec.ui;
      const rows = [
        ['Длина борта', spec.planeLen + ' px'],
        ['Ангар (квадрат)', spec.hangarSide + ' px · ×' + spec.hangarRatio + ' борта'],
        ['ВПП (ширина)', spec.runwayH + ' px · ×' + spec.runwayRatio + ' борта'],
        ['Апрон', spec.apron.w + '×' + spec.apron.h + ' px'],
        ['Прилёт', spec.arrival.w + '×' + spec.arrival.h + ' px'],
        ['Ангаров / ВПП', spec.hangars.length + ' / ' + spec.runways.length],
      ];
      host.innerHTML = rows.map(([k, v]) => '<div class="skin-spec-row"><span>' + k + '</span><b>' + v + '</b></div>').join('');
    }
    /* ---- пересинхрон контролов + превью ---- */
    function syncResources() {
      if (!window.Draft) return;
      const nextMax = Math.max(0, ((window.Draft.raw && window.Draft.raw().maxUp) | 0) || 3);
      if (nextMax !== maxUp) { maxUp = nextMax; if (pips > maxUp) pips = maxUp; }
      const sk = window.Draft.getSkins();
      document.querySelectorAll('#skin-zones select.skin-zone-sel').forEach(sel =>
        sel.value = sk[sel.dataset.zone] || 'default');
      document.querySelectorAll('#skin-hangar-state .lab-chip').forEach(c =>
        c.classList.toggle('on', c.dataset.state === hangarState));
      const sc = document.getElementById('skin-state-cur');
      if (sc) {
        const f = HANGAR_STATES.find(s => s[0] === hangarState);
        let txt = f ? f[1] : hangarState;
        // «занят» рисует борт поверх панели только если выбран скин самолёта — иначе подскажем
        if (hangarState === 'occupied' && (sk.plane || 'default') === 'default') txt += ' · нужен скин самолёта';
        sc.textContent = txt;
      }
      buildPips();
      renderSpec();
      pushPreview();
      pushSkinToGame();
    }

    function loadRegistry() {
      fetch('assets/skins/index.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : {})
        .then(j => { registry = j || {}; buildZones(); syncResources(); })
        .catch(() => {
          registry = {}; buildZones();
          const w = document.getElementById('skin-warn'); if (w) w.textContent = 'реестр скинов не загружен (assets/skins/index.json)';
        });
    }

    buildStates(); buildPips(); loadRegistry();
    window._resourcesSync = syncResources;
  })();
