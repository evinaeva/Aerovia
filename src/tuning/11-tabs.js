  /* ── Tab switching ────────────────────────────────────────────────────── */
  (function () {
    const searchWrap  = document.getElementById('search-wrap');
    const bottomPane  = document.getElementById('bottom-pane');
    const levelViewEl  = document.getElementById('level-view');
    const layoutViewEl = document.getElementById('layout-view');
    const motionViewEl = document.getElementById('motion-view');
    const diffViewEl   = document.getElementById('difficulty-view');
    const assetViewEl  = document.getElementById('asset-view');
    const testViewEl   = document.getElementById('test-view');

    function activateTab(tab) {
      document.querySelectorAll('.t-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      const isLayout   = tab === 'layout';
      const hasSubtabs = SUBTAB_TABS.has(tab);   // «Движение» и «Сложность»
      searchWrap.style.visibility = hasSubtabs ? 'visible' : 'hidden';
      groupsEl.style.display    = hasSubtabs ? '' : 'none';
      levelViewEl.style.display = tab === 'level'      ? 'flex' : 'none';
      layoutViewEl.style.display = isLayout             ? 'flex' : 'none';
      if (motionViewEl) motionViewEl.style.display = tab === 'motion'     ? 'flex' : 'none';
      diffViewEl.style.display  = tab === 'difficulty' ? 'flex' : 'none';
      assetViewEl.style.display = tab === 'assets'     ? 'flex' : 'none';
      if (testViewEl) testViewEl.style.display = tab === 'test' ? 'flex' : 'none';
      // «Движение» и «Сложность» встраивают #groups в свой view для единого скролла.
      if (tab === 'motion' && motionViewEl) {
        if (groupsEl.parentNode !== motionViewEl) motionViewEl.appendChild(groupsEl);
        groupsEl.classList.add('groups-embedded');
      } else if (tab === 'difficulty') {
        if (groupsEl.parentNode !== diffViewEl) diffViewEl.appendChild(groupsEl);
        groupsEl.classList.add('groups-embedded');
      } else {
        if (groupsEl.parentNode === motionViewEl || groupsEl.parentNode === diffViewEl)
          bottomPane.insertBefore(groupsEl, levelViewEl);
        groupsEl.classList.remove('groups-embedded');
      }
      // #groups and the sub-tab bar are shared by both sub-tabbed tops — rebuild the
      // bar for whichever is now active and reveal its (remembered) sub-tab.
      if (hasSubtabs) buildSubtabs();
      else subtabBar.style.display = 'none';
      // Превью (холст разметки ↔ игровой iframe) больше НЕ привязано к вкладке —
      // им управляет левый рельс (см. runTest/returnToMarkup). Любая вкладка
      // настроек кормит то же единое превью.
      // освежаем вкладки, которые читают черновик (он мог измениться в «Разметке»)
      if (tab === 'motion'     && GAME) renderDiffEditor();
      if (tab === 'difficulty' && GAME) { renderDiffEditor(); renderDiff(); }
      if (tab === 'assets'  && window._resourcesSync) window._resourcesSync();
      if (tab === 'test'    && window._testSync)      window._testSync();
    }
    window._activateTab = activateTab;
    document.querySelectorAll('.t-tab').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
  })();

  /* ── Collapsible lab sections ────────────────────────────────────────────
     Any .lab-section.collapsible folds/unfolds when its <h3> is clicked. The
     «Уровни» sections ship collapsed by default (class in markup), so the tab
     opens as a compact stack of headers instead of one long scroll. Delegated
     so it works no matter when a section is built. The campaign list keeps its
     selected row in view after unfolding. */
  (function () {
    document.addEventListener('click', e => {
      const h3 = e.target.closest('.lab-section.collapsible > h3');
      if (!h3) return;
      const sec = h3.parentNode;
      const nowOpen = sec.classList.toggle('collapsed') === false;
      // unfolding the campaign list: re-center the chosen level in its scroll box
      if (nowOpen && sec.querySelector('#level-table-wrap')) {
        const selRow = sec.querySelector('#level-table-wrap tr.sel');
        if (selRow) selRow.scrollIntoView({ block: 'nearest' });
      }
    });
  })();

