  /* ── Phone size presets ────────────────────────────────────────────────── */
  const PHONES = [
    { key: 'st',  label: 'XS стресс-тест',    w: 720, h: 320 },
    { key: 's',   label: 'S Android Common',   w: 800, h: 360 },
    { key: 'm',   label: 'M Android Common+',  w: 832, h: 384 },
    { key: 'l',   label: 'L Android Tall',     w: 873, h: 393 },
    { key: 'xl',  label: 'XL Android Large',   w: 915, h: 412 },
    { key: 'xxl', label: 'XXL Android Wide',   w: 960, h: 432 },
  ];
  let phoneKey = 's';

  const shell   = document.getElementById('phone-shell');
  const wrapper = document.getElementById('phone-wrapper');
  const label   = document.getElementById('phone-label');

  function getScale(key) {
    const ph      = PHONES.find(p => p.key === key);
    const pane    = document.getElementById('top-pane');
    const toolbar = document.getElementById('toolbar-wrap');
    const rail    = document.getElementById('mode-rail');
    const toolH   = toolbar ? toolbar.offsetHeight + 6 : 0;
    // левый рельс режимов («Разметка»/«Тестовая игра») + gap #preview-row съедают
    // ширину — иначе превью раздувается и выпихивает кнопки за край (особенно на тач)
    const railW   = rail ? rail.offsetWidth + 12 : 0;
    const availW  = pane.clientWidth  - 20 - railW;
    const availH  = pane.clientHeight - toolH - 30;
    return Math.min(1, availW / ph.w, availH / ph.h);
  }

  function applyPhone(key) {
    phoneKey = key;
    const ph    = PHONES.find(p => p.key === key);
    const scale = getScale(key);

    shell.style.width     = ph.w + 'px';
    shell.style.height    = ph.h + 'px';
    shell.style.transform = 'scale(' + scale + ')';

    wrapper.style.width  = Math.round(ph.w * scale) + 'px';
    wrapper.style.height = Math.round(ph.h * scale) + 'px';

    label.textContent = T.livePreview + ' · ' + ph.label + ' · ' + ph.w + '×' + ph.h;

    document.querySelectorAll('.sz-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.size === key);
    });
    // Update size button label in toolbar
    const tbLbl = document.getElementById('tb-size-label');
    if (tbLbl) tbLbl.textContent = ph.key === 'st' ? 'XS' : ph.key.toUpperCase();

    applyCutout();
    if (window._layoutResize) window._layoutResize();   // editor canvas follows the shell size
    if (window._onPhoneApplied) window._onPhoneApplied();   // zoom re-applies after resize/size-change
  }

  // Size strip buttons (inside popup)
  document.querySelectorAll('.sz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPhone(btn.dataset.size);
      closeAllPopups();
    });
  });

  // Resize handle: drag right/down = larger, drag left/up = smaller
  // Snaps through PHONES steps; 80px = one step
  (function () {
    const handle = document.getElementById('resize-handle');
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      handle.classList.add('dragging');
      const startX    = e.clientX;
      const startIdx  = PHONES.findIndex(p => p.key === phoneKey);
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const step = Math.round(dx / 80);
        const idx = Math.max(0, Math.min(PHONES.length - 1, startIdx + step));
        if (PHONES[idx].key !== phoneKey) applyPhone(PHONES[idx].key);
      }
      function onUp(ev) {
        handle.classList.remove('dragging');
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  })();

  window.addEventListener('resize', () => applyPhone(phoneKey));

