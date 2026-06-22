  /* ── Тест: предполётная проверка + запуск черновика ──────────────────────── */
  (function () {
    function syncTest() {
      const nameEl = document.getElementById('test-draft-name');
      if (nameEl && window.Draft) nameEl.textContent = window.Draft.name();
      const cl = document.getElementById('test-checklist'); if (!cl) return;
      if (!window.Draft) { cl.innerHTML = '<span class="lab-empty">Ждём запуска игры…</span>'; return; }
      const v = window.Draft.validate();
      cl.innerHTML = (!v.errors.length && !v.warns.length)
        ? '<div style="font-size:12px;color:var(--accent2)">✓ Всё готово — уровень проходим.</div>'
        : v.errors.map(e => '<div style="font-size:11px;color:#ff8080;padding:2px 0">⛔ ' + escHtml(e) + '</div>').join('')
          + v.warns.map(w => '<div style="font-size:11px;color:#e3c522;padding:2px 0">⚠ ' + escHtml(w) + '</div>').join('');
    }
    // Кнопки вкладки «Тест» — те же действия, что и левый рельс единого превью.
    const play = document.getElementById('test-play');
    if (play) play.addEventListener('click', () => { if (window._runTest) window._runTest(); setTimeout(syncTest, 60); });
    const stop = document.getElementById('test-stop');
    if (stop) stop.addEventListener('click', () => {
      if (window._returnToMarkup) window._returnToMarkup();
      const st = document.getElementById('test-status'); if (st) st.textContent = 'вернулись к разметке';
    });
    window._testSync = syncTest;
  })();

})();
