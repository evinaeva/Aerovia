  /* Per-zone overlay visibility — shared with drawOverlay() (toolbar «Зоны»).
     Each key gates one safety-zone group; default all-visible. */
  window._zoneVis = window._zoneVis || {
    gesture: true, safe: true, cutout: true, content: true, interactive: true,
    route: true, uiReserved: true,
    toast: true,
  };

  /* zone legend — подписи берутся из i18n (T.zone*), а не зашиты в разметку.
     Каждый пункт — отдельная строка с тоглом, который скрывает/показывает зону. */
  (function renderZoneLegend() {
    const host = document.getElementById('zones-list');
    if (!host) return;
    // [key, swatch-class, swatch-style, label]
    const items = [
      ['gesture',     'z-sw fill', 'background:rgba(255,60,60,.4);border:1px solid rgba(255,60,60,.7)', T.zoneGesture],
      ['safe',        'z-sw fill', 'background:rgba(255,160,60,.3);border:1px solid rgba(255,160,60,.6)', T.zoneSafeInsets],
      ['cutout',      'z-sw fill', 'background:rgba(0,0,0,.5);border:1px solid rgba(255,60,60,.8)', T.zoneCutout],
      ['content',     'z-sw', 'background:rgba(34,210,255,.9)', T.zoneContent],
      ['interactive', 'z-sw', 'background:rgba(34,240,100,.9)', T.zoneInteractive],
      ['route',       'z-sw', 'background:rgba(50,255,50,1)', T.zoneRoute],
      ['uiReserved',  'z-sw fill', 'background:rgba(255,220,0,.5);border:1px solid rgba(255,220,0,.9)', T.zoneUiReserved],
      ['toast',       'z-sw fill', 'background:rgba(244,207,94,.22);border:1px solid rgba(244,207,94,.85)', T.zoneToast],
    ];
    // The row is a <div>, NOT a <label>: a <label> wrapping both the «?» <button>
    // and the checkbox would associate with the FIRST labelable descendant — the
    // button — so every row click opened the hint instead of toggling the zone.
    // The toggle is its own <label> (its only labelable child is the checkbox), and
    // a row-level handler toggles the zone when you click the swatch/text.
    host.innerHTML = items.map(it =>
      '<div class="zp-row-wrap">' +
        '<div class="zp-row">' +
          '<span class="' + it[1] + '" style="' + it[2] + '"></span>' +
          '<span class="zp-label">' + it[3] + '</span>' +
          '<button class="zp-info" type="button" aria-label="Пояснение" aria-expanded="false" data-hint="' + escHtml(T.zoneHints[it[0]] || '') + '">?</button>' +
          '<label class="mt-toggle"><input type="checkbox" data-zone="' + it[0] + '"' +
            (window._zoneVis[it[0]] !== false ? ' checked' : '') + '><span class="track"></span></label>' +
        '</div>' +
      '</div>'
    ).join('');
    host.querySelectorAll('input[data-zone]').forEach(inp => {
      inp.addEventListener('change', () => {
        window._zoneVis[inp.dataset.zone] = inp.checked;
        if (window._fieldRedraw) window._fieldRedraw();
      });
    });
    // Click anywhere on the row (except the «?» or the toggle, which handle
    // themselves) toggles the zone — keeps the old "tap the row" affordance.
    host.querySelectorAll('.zp-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.zp-info') || e.target.closest('.mt-toggle')) return;
        const cb = row.querySelector('input[data-zone]');
        if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
  })();

