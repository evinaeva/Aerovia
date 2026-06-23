  /* ── Единое превью: режим «Разметка» ↔ «Тестовая игра» ─────────────────────
     Одно постоянное превью. Левый рельс переключает, ЧТО в нём видно:
       • markup — схематичный холст #ly-canvas (редактор поля), iframe скрыт;
       • test   — настоящая игра в iframe, запущенная из текущей разметки.
     Режим не зависит от активной нижней вкладки (настройки кормят то же превью).
     Главный экран игры не показываем: в markup iframe скрыт, на старте — markup;
     лес выключаем (K.DISABLE_FOREST), кастомный уровень не имеет биома. */
  let previewMode = 'markup';

  function syncModeButtons() {
    const mk = document.getElementById('mode-markup');
    const ts = document.getElementById('mode-test');
    if (mk) mk.classList.toggle('active', previewMode === 'markup');
    if (ts) ts.classList.toggle('active', previewMode === 'test');
  }

  // Запустить (или перезапустить) тестовую игру из текущей разметки.
  // Перезапуск важен: даёт «применить» свежие правки сложности/событий/уровня.
  function runTest() {
    const w = gameFrame.contentWindow;
    if (!w || !w.__PLAY || !window.Draft) { setStatus(T.testNotLoaded); return; }
    const start = () => {
      try {
        if (window._exitMarkupSurface) window._exitMarkupSurface();   // показать iframe, снять холст
        w.__SUPPRESS_GOALS = true;   // в превью конструктора не показываем окно постановки целей
        // бесконечные жизни + деньги (тест-чит игры)
        ['optLives', 'optMoney'].forEach(id => {
          const el = w.document.getElementById(id);
          if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        // чистое поле: без лесных помех/деайсинга; готовый борт у левого края апрона.
        // Боксы ВКЛ (DISABLE_BAY=false): у прилетающих бортов есть нужды — они обязаны
        // заехать в боксы. Депо-борт на апроне не затронут (у него только 'depart').
        if (MT) { MT.apply({ 'K.DISABLE_FOREST': true, 'K.DISABLE_DEICE': true, 'K.APRON_SPAWN': true, 'K.DISABLE_BAY': false }, false); syncUI(); }
        const obj = window.Draft.export();
        w.__PLAY.store(obj);
        if (!w.__PLAY.custom(obj)) {           // кастомный уровень = бесконечный (без objective.target)
          setStatus(T.testFailed);
          if (window._enterMarkupSurface) window._enterMarkupSurface();   // откат к холсту
          previewMode = 'markup'; syncModeButtons();
          return;
        }
        previewMode = 'test'; syncModeButtons();
        setStatus(T.testRunning);
      } catch (e) { setStatus('Test: ' + e.message); }
    };
    // валидируем как «Сыграть»: при ошибках — модалка с подтверждением
    if (window._confirmPlay) window._confirmPlay(start); else start();
  }

  // Вернуться к разметке: остановить игру и снова показать холст.
  // iframe прячем ДО клика по backBtn — чтобы мелькание главного меню не было видно.
  function returnToMarkup() {
    const w = gameFrame.contentWindow;
    try {
      if (MT) { MT.apply({ 'K.APRON_SPAWN': false, 'K.DISABLE_BAY': true }, false); syncUI(); }
      if (window._enterMarkupSurface) window._enterMarkupSurface();   // прячет iframe, монтирует холст
      const backBtn = w && w.document.getElementById('backBtn');
      if (backBtn) backBtn.click();
    } catch (_) {}
    previewMode = 'markup'; syncModeButtons();
    setStatus(T.markupMode);
  }

  window._runTest = runTest;
  window._returnToMarkup = returnToMarkup;
  window._getPreviewMode = () => previewMode;

  { const mk = document.getElementById('mode-markup'); if (mk) mk.addEventListener('click', returnToMarkup); }
  { const ts = document.getElementById('mode-test');   if (ts) ts.addEventListener('click', runTest); }
  syncModeButtons();
  // Старт: превью в режиме «Разметка» — холст в шелле, игровой iframe скрыт
  // (главный экран не мелькает). Хуки зон уже определены к этому моменту.
  if (window._enterMarkupSurface) window._enterMarkupSurface();

  // ── Zoom: крупный план ВПП → Ангар → Сброс ──────────────────────────────
  (function () {
    const ZOOM_STATES = [null, 'runway', 'bay'];
    const ZOOM_LABELS = {
      null:    'Крупный план — ВПП / Ангар / Сброс',
      runway:  'Крупный план: ВПП  (клик → Ангар)',
      bay:     'Крупный план: Ангар  (клик → Сброс)',
    };
    let zi = 0;
    const btn   = document.getElementById('btn-zoom');
    const shell = document.getElementById('phone-shell');
    if (!btn || !shell) return;

    function applyZoom(target) {
      if (!target) {
        shell.style.transform = '';
        shell.style.transformOrigin = '';
        btn.classList.remove('tb-active');
        btn.title = ZOOM_LABELS[null];
        return;
      }
      try {
        const fd = gameFrame.contentWindow && gameFrame.contentWindow.__FIELD;
        if (!fd || !fd.W) { zi = 0; applyZoom(null); return; }
        let cx, cy, sc;
        if (target === 'runway' && fd.runways && fd.runways.length) {
          const r = fd.runways[0];
          cx = (r.x + r.w * 0.5) / fd.W;
          cy = r.cy / fd.H;
          sc = 3;
        } else if (target === 'bay' && fd.bays && fd.bays.length) {
          const b = fd.bays.find(function(b) { return b.open; }) || fd.bays[0];
          cx = (b.x + b.w * 0.5) / fd.W;
          cy = (b.y + b.h * 0.5) / fd.H;
          sc = 4;
        } else {
          zi = 0; applyZoom(null); return;
        }
        shell.style.transformOrigin = (cx * 100) + '% ' + (cy * 100) + '%';
        shell.style.transform = 'scale(' + sc + ')';
        btn.classList.add('tb-active');
        btn.title = ZOOM_LABELS[target];
      } catch (e) { zi = 0; applyZoom(null); }
    }

    btn.addEventListener('click', function () {
      zi = (zi + 1) % ZOOM_STATES.length;
      applyZoom(ZOOM_STATES[zi]);
    });

    // Сброс зума при смене режима (Разметка / Тестовая игра)
    window._previewZoomReset = function () { zi = 0; applyZoom(null); };
    const origReturnToMarkup = window._returnToMarkup;
    window._returnToMarkup = function () { if (window._previewZoomReset) window._previewZoomReset(); if (origReturnToMarkup) origReturnToMarkup(); };
  })();

