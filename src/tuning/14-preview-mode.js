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

  { const mk = document.getElementById('mode-markup'); if (mk) mk.addEventListener('click', returnToMarkup); }
  { const ts = document.getElementById('mode-test');   if (ts) ts.addEventListener('click', runTest); }
  syncModeButtons();
  // Старт: превью в режиме «Разметка» — холст в шелле, игровой iframe скрыт
  // (главный экран не мелькает). Хуки зон уже определены к этому моменту.
  if (window._enterMarkupSurface) window._enterMarkupSurface();

