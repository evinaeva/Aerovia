  /* ── Ресурсы: примерка скинов (плейсхолдеры) — выбор сохраняется в черновике ─ */
  (function () {
    const HANGAR_SKINS = [['default','⬜ Базовый'],['neon','🟦 Неон'],['industrial','🏭 Индастриал'],['wood','🟫 Дерево']];
    const BG_SKINS     = [['default','🌃 Ночь-радар'],['desert','🏜 Пустыня'],['snow','❄ Снег'],['ocean','🌊 Океан']];
    function buildGroup(elId, items, key) {
      const el = document.getElementById(elId); if (!el) return;
      el.innerHTML = items.map(([v, lbl]) =>
        '<label class="lab-chip" data-skin="' + v + '"><input type="radio" name="skin-' + key + '" value="' + v + '"> ' + lbl + '</label>').join('');
      el.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
        if (!window.Draft) return;
        const patch = {}; patch[key] = r.value; window.Draft.setSkins(patch); syncResources();
      }));
    }
    function syncResources() {
      if (!window.Draft) return;
      const sk = window.Draft.getSkins();
      [['hangar','skin-hangar','skin-hangar-cur'],['background','skin-bg','skin-bg-cur']].forEach(([key, gid, curId]) => {
        const cur = sk[key] || 'default';
        const g = document.getElementById(gid);
        if (g) g.querySelectorAll('label[data-skin]').forEach(l => {
          const on = l.dataset.skin === cur;
          l.classList.toggle('on', on);
          const inp = l.querySelector('input'); if (inp) inp.checked = on;
        });
        const c = document.getElementById(curId); if (c) c.textContent = cur;
      });
    }
    buildGroup('skin-hangar', HANGAR_SKINS, 'hangar');
    buildGroup('skin-bg', BG_SKINS, 'background');
    window._resourcesSync = syncResources;
  })();

