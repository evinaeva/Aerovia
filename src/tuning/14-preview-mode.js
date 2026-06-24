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
  // skipConfirm=true — пропускает модалку валидации (для авто-запуска из вкладки «Ресурсы»).
  function runTest(skipConfirm) {
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
        if (window._resourcesSync) window._resourcesSync();   // (пере)применить зон-скины после загрузки уровня (на случай гонки с custom)
        setStatus(T.testRunning);
      } catch (e) { setStatus('Test: ' + e.message); }
    };
    // валидируем как «Сыграть»: при ошибках — модалка с подтверждением
    if (!skipConfirm && window._confirmPlay) window._confirmPlay(start); else start();
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
  // Авто-запуск с ретраями: ждём пока __PLAY будет готов (iframe мог ещё не загрузиться).
  // skipConfirm=true — без модалки валидации, бесконечные жизни/деньги включаются как обычно.
  window._runTestWhenReady = function () {
    let n = 0;
    (function tryStart() {
      const w = gameFrame && gameFrame.contentWindow;
      if (w && w.__PLAY && window.Draft) { runTest(true); return; }
      if (n++ < 20) setTimeout(tryStart, 500);   // до 10 секунд
    })();
  };

  { const mk = document.getElementById('mode-markup'); if (mk) mk.addEventListener('click', returnToMarkup); }
  { const ts = document.getElementById('mode-test');   if (ts) ts.addEventListener('click', runTest); }
  syncModeButtons();
  // Старт: превью в режиме «Разметка» — холст в шелле, игровой iframe скрыт
  // (главный экран не мелькает). Хуки зон уже определены к этому моменту.
  if (window._enterMarkupSurface) window._enterMarkupSurface();

  // ── Zoom: крупный план ВПП / Ангар со слайдером и точным центрированием ──
  (function () {
    const shell   = document.getElementById('phone-shell');
    const wrapper = document.getElementById('phone-wrapper');
    const slider  = document.getElementById('zoom-slider');
    const valLbl  = document.getElementById('zoom-val');
    if (!shell || !wrapper || !slider || !valLbl) return;

    let zoneKey = '';   // '' | 'runway' | 'bay'

    // Текущий базовый масштаб (fit-scale, выставленный applyPhone).
    // wrapper.offsetWidth = round(ph.w * baseScale), shell.style.width = ph.w.
    function getBaseScale() {
      const pW = parseFloat(shell.style.width);
      return pW > 0 ? wrapper.offsetWidth / pW : 1;
    }

    function fmtScale(v) {
      const s = (Math.round(v * 4) / 4).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      return '×' + s;
    }

    function applyZoom() {
      const userZoom = parseFloat(slider.value);
      valLbl.textContent = fmtScale(userZoom);

      const bs = getBaseScale();

      if (!zoneKey) {
        shell.style.transformOrigin = 'top left';
        shell.style.transform = 'scale(' + bs + ')';
        return;
      }

      let cx, cy;
      try {
        const fd = gameFrame.contentWindow && gameFrame.contentWindow.__FIELD;
        if (!fd || !fd.W) return;   // игра ещё не запущена — ждём
        if (zoneKey === 'runway' && fd.runways && fd.runways.length) {
          const r = fd.runways[0];
          cx = (r.x + r.w * 0.5) / fd.W;
          cy = r.cy / fd.H;
        } else if (zoneKey === 'bay' && fd.bays && fd.bays.length) {
          const b = fd.bays.find(function(b) { return b.open; }) || fd.bays[0];
          cx = (b.x + b.w * 0.5) / fd.W;
          cy = (b.y + b.h * 0.5) / fd.H;
        } else { return; }
      } catch (_) { return; }

      // translate(tx,ty) scale(sc) с origin top left:
      //   точка (cx*pW, cy*pH) в shell-пространстве → (cx*pW*sc + tx, cy*pH*sc + ty) в wrapper
      //   хотим её в центре wrapper: cx*pW*sc + tx = wW/2  →  tx = wW/2 - cx*pW*sc
      const sc  = bs * userZoom;
      const pW  = parseFloat(shell.style.width)  || (wrapper.offsetWidth / bs);
      const pH  = parseFloat(shell.style.height) || (wrapper.offsetHeight / bs);
      const wW  = wrapper.offsetWidth;
      const wH  = wrapper.offsetHeight;
      const tx  = wW / 2 - cx * pW * sc;
      const ty  = wH / 2 - cy * pH * sc;

      shell.style.transformOrigin = 'top left';
      shell.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    }

    function resetZoom() {
      zoneKey = '';
      slider.disabled = true;
      document.querySelectorAll('.zoom-zb').forEach(function(b) {
        b.classList.toggle('active', b.dataset.zone === '');
      });
      const bs = getBaseScale();
      shell.style.transformOrigin = 'top left';
      shell.style.transform = 'scale(' + bs + ')';
    }

    // Кнопки зоны
    document.querySelectorAll('.zoom-zb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        zoneKey = this.dataset.zone;
        document.querySelectorAll('.zoom-zb').forEach(function(b) {
          b.classList.toggle('active', b.dataset.zone === zoneKey);
        });
        slider.disabled = !zoneKey;
        applyZoom();
      });
    });

    // Слайдер
    slider.addEventListener('input', applyZoom);

    // Хук: переприменить зум после смены размера телефона (applyPhone → _onPhoneApplied)
    window._onPhoneApplied = applyZoom;

    // Сброс при переключении в «Разметку»
    window._previewZoomReset = resetZoom;
    const origReturnToMarkup = window._returnToMarkup;
    window._returnToMarkup = function() {
      resetZoom();
      if (origReturnToMarkup) origReturnToMarkup();
    };
  })();

