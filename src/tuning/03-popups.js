  /* ── Popup system ──────────────────────────────────────────────────────── */
  const allPopups  = document.querySelectorAll('.tb-popup');
  const backdrop   = document.getElementById('popup-backdrop');

  function openPopup(id) {
    if (window._closeZonesPanel) window._closeZonesPanel();   // don't overlap the «Зоны» panel
    const toolbar = document.getElementById('toolbar-wrap');
    const tRect   = toolbar.getBoundingClientRect();
    const top     = tRect.bottom + 6;
    allPopups.forEach(p => {
      p.classList.remove('open');
      p.style.top = top + 'px';
    });
    const popup = document.getElementById(id);
    if (popup) {
      popup.style.top = top + 'px';
      popup.classList.add('open');
      backdrop.style.display = '';
    }
  }

  function closeAllPopups() {
    allPopups.forEach(p => p.classList.remove('open'));
    backdrop.style.display = 'none';
  }

  function togglePopup(id) {
    const popup = document.getElementById(id);
    const wasOpen = popup && popup.classList.contains('open');
    closeAllPopups();
    if (!wasOpen) openPopup(id);
  }

  backdrop.addEventListener('click', closeAllPopups);
  document.getElementById('btn-size-toggle').addEventListener('click',   () => togglePopup('popup-size'));
  document.getElementById('btn-file-toggle').addEventListener('click',   () => togglePopup('popup-file'));

