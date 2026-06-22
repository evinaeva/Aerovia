  /* ── Splitter drag (pointer events → works for mouse, touch & pen) ──────── */
  (function () {
    const topPane  = document.getElementById('top-pane');
    const splitter = document.getElementById('splitter');

    // Actual visible height of the flex column (matches the body's dvh; on iOS
    // this is the real visible area, unlike window.innerHeight which can report
    // the taller layout viewport).
    function viewH() { return document.body.clientHeight || window.innerHeight || 800; }

    // Default: 52% of viewport for top pane
    let topH = Math.round(viewH() * 0.52);

    function setTopH(h) {
      // Viewport-aware clamps: reserve at least ~28% (min 120px) for the
      // bottom pane so the divider still has travel on short landscape phones,
      // where a fixed 300px reserve would peg it and break dragging.
      const vh        = viewH();
      const minTop    = 60;
      // ~300px floor on desktop, but only ~40% of a short landscape phone so the
      // divider keeps real travel; the bottom pane scrolls within whatever is left.
      const minBottom = Math.max(120, Math.min(300, Math.round(vh * 0.4)));
      const maxTop    = Math.max(minTop, vh - minBottom);
      topH = Math.max(minTop, Math.min(h, maxTop));
      topPane.style.height = topH + 'px';
      applyPhone(phoneKey);
    }

    setTopH(topH);
    // Re-clamp on rotation / viewport changes — incl. iOS showing/hiding its
    // toolbars (visualViewport), which changes the visible height.
    window.addEventListener('resize', () => setTopH(topH));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => setTopH(topH));

    splitter.addEventListener('pointerdown', e => {
      e.preventDefault();
      splitter.classList.add('dragging');
      const startY = e.clientY;
      const startH = topH;
      try { splitter.setPointerCapture(e.pointerId); } catch (_) {}

      function onMove(ev) { setTopH(startH + ev.clientY - startY); }
      function onUp(ev) {
        splitter.classList.remove('dragging');
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
        splitter.removeEventListener('pointercancel', onUp);
        try { splitter.releasePointerCapture(ev.pointerId); } catch (_) {}
      }
      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
      splitter.addEventListener('pointercancel', onUp);
    });
  })();

  /* initial render after layout settles */
  requestAnimationFrame(() => applyPhone(phoneKey));

