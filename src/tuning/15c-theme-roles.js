  /* ── «Тема»: редактор ролей цвета по биомам ───────────────────────────────
     Крутит цвета семантических РОЛЕЙ (Theme Roles, см. src/game/01b-theme-roles)
     для дефолтного «Неона» и любого имеющегося биома, с ЖИВЫМ превью в игровом
     iframe. Общение с игрой — через window.__THEME (same-origin iframe), тот же
     приём, что у «Скинов» (__SPRITES). Правки хранятся в localStorage и едут в
     экспорт (JSON), чтобы потом их можно было зашить как палитру биома.
     Токены без роли (teal/ice/rose/gold/muted/paper…) остаются неоновыми —
     редактор покрывает 10 семантических ролей, а не весь сырой токен-сет. */
  (function () {
    const LS_KEY = 'pf_theme_palettes_v1';
    // RU-подписи ролей (ключи приходят из __THEME.ROLE_KEYS игры)
    const ROLE_LABEL = {
      'bg-primary':   ['Фон основной', '60% · поле'],
      'bg-secondary': ['Фон вторичный', '60% · апрон/пол'],
      'structure-1':  ['Структуры 1', '30% · неон-кант ВПП/апрона'],
      'structure-2':  ['Структуры 2', '30% · ядро канта'],
      'accent-active':['Акцент активный', '10% · борт/трасса/выделение'],
      'accent-warm':  ['Акцент тёплый', '10% · терпение/ремонт'],
      'hazard':       ['Опасность', 'краш/закрытая ВПП/SOS'],
      'success':      ['Успех', 'апгрейд/доступно'],
      'ui-text':      ['UI текст', 'значения HUD'],
      'ui-glow':      ['UI свечение', 'рамка HUD'],
    };
    // id биома → RU-подпись (эмодзи добавим из __GAME.BIOMES, если есть)
    const BIOME_LABEL = {
      'dark-neon':'Неон (дефолт)', forest:'Лес', arctic:'Арктика', tropical:'Тропики',
      desert:'Пустыня', mountain:'Горы', megacity:'Мегаполис',
    };

    let palettes = load();          // { biomeKey: { role: '#hex' } }
    let current = 'dark-neon';
    let roleKeys = null;            // из игры (ROLE_KEYS), null пока игра не готова

    const gw = () => { try { return document.getElementById('game-frame').contentWindow; } catch (e) { return null; } };
    const api = () => { const w = gw(); return (w && w.__THEME) || null; };

    function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
    function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(palettes)); } catch (e) {} }

    // палитра биома: сохранённая правка, иначе снимок неон-дефолта из игры
    function paletteOf(key) {
      const t = api(); const def = t ? t.roleDefaults() : {};
      return Object.assign({}, def, palettes[key] || {});
    }
    // список биомов для селекта: неон + имеющиеся биомы игры
    function biomeList() {
      const w = gw();
      const emoji = {};
      try { (w.__GAME.BIOMES || []).forEach(b => { emoji[b.id] = b.emoji; }); } catch (e) {}
      const ids = ['dark-neon'].concat(Object.keys(BIOME_LABEL).filter(k => k !== 'dark-neon'));
      return ids.map(id => ({ key: id, label: (emoji[id] ? emoji[id] + ' ' : '') + (BIOME_LABEL[id] || id) }));
    }

    // применить текущую палитру в игру (живое превью). tokens производятся в игре.
    function apply() {
      const t = api(); if (!t) return;
      t.apply(current, paletteOf(current));
    }

    function exportObj() {
      return { name: current, roles: paletteOf(current) };
    }
    function refreshJson() {
      const ta = document.getElementById('theme-json');
      if (ta) ta.value = JSON.stringify(exportObj(), null, 2);
    }

    function renderRows() {
      const host = document.getElementById('theme-roles'); if (!host) return;
      const t = api();
      if (!t || !roleKeys) { host.innerHTML = '<span class="lab-empty">Ждём запуска игры…</span>'; return; }
      const pal = paletteOf(current);
      host.innerHTML = '';
      roleKeys.forEach(role => {
        const [lbl, sub] = ROLE_LABEL[role] || [role, ''];
        const hex = pal[role] || '#000000';
        const row = document.createElement('div');
        row.className = 'theme-role';
        row.innerHTML =
          '<span class="tr-lbl">' + lbl + ' <small>' + sub + '</small></span>' +
          '<input type="color" value="' + hex + '">' +
          '<input type="text" value="' + hex.toUpperCase() + '" maxlength="7" spellcheck="false">';
        const [ , colorEl, textEl ] = row.children;
        const set = (v) => {
          if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
          palettes[current] = palettes[current] || {};
          palettes[current][role] = v.toLowerCase();
          colorEl.value = v.toLowerCase(); textEl.value = v.toUpperCase();
          persist(); apply(); refreshJson();
        };
        colorEl.addEventListener('input', () => set(colorEl.value));
        textEl.addEventListener('change', () => set(textEl.value.trim()));
        host.appendChild(row);
      });
      refreshJson();
    }

    function renderBiomeSelect() {
      const sel = document.getElementById('theme-biome'); if (!sel) return;
      const list = biomeList();
      if (!list.some(b => b.key === current)) current = 'dark-neon';
      sel.innerHTML = list.map(b => '<option value="' + b.key + '"' + (b.key === current ? ' selected' : '') + '>' + b.label + '</option>').join('');
    }

    // Полная пересборка вкладки при входе / готовности игры.
    function sync() {
      const t = api();
      roleKeys = t ? (t.ROLE_KEYS || null) : null;
      renderBiomeSelect();
      renderRows();
      apply();          // показать текущий биом на превью
    }
    window._themeSync = sync;
    // Вернуть игру к дефолтному неону (зовётся при уходе с вкладки, чтобы другие
    // вкладки/тест видели «настоящую» игру, а не редактируемую палитру).
    window._themeResetGame = () => { const t = api(); if (t) t.reset(); };

    // ── обработчики контролов ──
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'theme-biome') { current = e.target.value; renderRows(); apply(); }
    });
    document.addEventListener('click', (e) => {
      if (!e.target) return;
      if (e.target.id === 'theme-reset') {
        delete palettes[current]; persist(); renderRows(); apply();
      } else if (e.target.id === 'theme-copy') {
        const txt = JSON.stringify(exportObj(), null, 2);
        try { navigator.clipboard.writeText(txt); } catch (e2) {}
        const ta = document.getElementById('theme-json'); if (ta) { ta.value = txt; ta.select && ta.select(); }
        const btn = e.target; const old = btn.textContent; btn.textContent = 'Скопировано ✓';
        setTimeout(() => { btn.textContent = old; }, 1200);
      }
    });
  })();
