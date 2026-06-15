// @ts-nocheck -- TODO(ts-migration): type this module, then remove this line
  const SPRITES = (() => {
    const cache = new Map();
    const stripF = s => s.replace(/\s*filter="url\([^)]*\)"/g, ''); // drop filter refs (defs live in the sheet, not the standalone svg)
    // детерминированная подпись набора токенов для ключа кэша (sorted)
    function tokSig(t){
      const keys = Object.keys(t).sort();
      let s = '';
      for(const k of keys) s += k + ':' + t[k] + ';';
      return s;
    }
    // <style> с CSS-переменными темы; пусто, когда переопределений нет (дефолт)
    function styleBlock(t){
      const keys = Object.keys(t);
      if(!keys.length) return '';
      let css = '';
      for(const k of keys) css += '--' + k + ':' + t[k] + ';';
      return '<style>:root{' + css + '}</style>';
    }
    // PNG-арт пер-скина (растровый, с запечённым glow/глянцем/тенями — без SVG-
    // фильтров и токенов; кросс-платформенно надёжно). Какие id доступны как PNG —
    // задаёт манифест assets/sprites/<skin>/manifest.json (массив id); сам файл —
    // assets/sprites/<skin>/<id>.png. PNG имеет наивысший приоритет в img().
    const pngCache = new Map();   // 'skin/id' -> Image
    const pngIds = new Map();     // skin -> Set<id>
    function pngImg(id){
      const set = pngIds.get('neon');
      if(!set || !set.has(id)) return null;
      const key = 'neon/' + id;
      let im = pngCache.get(key);
      if(!im){
        im = new Image(); im.decoding = 'async';
        im.src = 'assets/sprites/neon/' + id + '.png';
        pngCache.set(key, im);
      }
      return im;   // может ещё грузиться — ok() ниже это учитывает (фолбэк до загрузки)
    }
    function img(id, w, h, color){
      // PNG-арт neon — высший приоритет (рисуется как есть, без темы)
      const pim = pngImg(id); if(pim) return pim;
      const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      // color может быть строкой (legacy currentColor) или объектом-переопределением токенов
      const tokens = (color && typeof color === 'object') ? color : null;
      const cstr = (typeof color === 'string') ? color : '';
      const sig = tokens ? tokSig(tokens) : '';
      // override (SVG): символ `neon-<id>` (если загружен из assets/sprites/neon/)
      // имеет приоритет над базовым — нарисованный neon-арт «встаёт» поверх движка
      // без правок call-site'ов.
      let symId = id;
      if(document.getElementById('neon-' + id)) symId = 'neon-' + id;
      const key = symId + '@' + pw + 'x' + ph + cstr + (sig ? '#' + sig : '');
      let im = cache.get(key);
      if(!im){
        const sym = document.getElementById(symId);
        if(!sym) return null;
        const vb = sym.getAttribute('viewBox') || '0 0 64 64';
        const cattr = cstr ? ' color="'+cstr+'"' : '';
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb +
                    '" width="' + pw + '" height="' + ph + '"' + cattr + '>' +
                    (tokens ? styleBlock(tokens) : '') + stripF(sym.innerHTML) + '</svg>';
        im = new Image(); im.decoding = 'async';
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        cache.set(key, im);
      }
      return im;
    }
    const ok = im => im && im.complete && im.naturalWidth > 0;
    // объединяет активную тему (THEME.tokens) с per-call переопределением.
    // Строку (currentColor) пропускаем как есть. Без темы и без override —
    // возвращаем сам color, чтобы дефолтный путь не плодил пустые объекты в кэше.
    function withTheme(color){
      const base = THEME.tokens;
      const hasBase = base && Object.keys(base).length;
      if(color && typeof color === 'object'){
        return hasBase ? Object.assign({}, base, color) : color;
      }
      // color — строка (или undefined): применяем активную тему, если она есть.
      // строковый currentColor через объект не пробросить, поэтому если есть и
      // тема, и строка — строка важнее для route-arrow (тема его не трогает).
      if(typeof color === 'string') return color;
      return hasBase ? base : undefined;
    }
    const A = {
      ready: false,
      skinReady: false,   // true когда загружены пер-скиновые листы активного скина
      get palette(){ return PALETTE; },
      // применить/сбросить тему: setTheme({gold:'#fff'}) — частично, setTheme(null) — сброс
      setTheme(tokens){ THEME.tokens = (tokens && typeof tokens === 'object') ? tokens : {}; },
      has(id){ return !!document.getElementById(id); },
      blitC(id, cx, cy, dw, dh, rot, color){
        if(!A.ready) return false; const im = img(id, dw, dh, withTheme(color)); if(!ok(im)) return false;
        ctx.save(); ctx.translate(cx, cy); if(rot) ctx.rotate(rot);
        ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh); ctx.restore(); return true;
      },
      blit(id, dx, dy, dw, dh, color){
        if(!A.ready) return false; const im = img(id, dw, dh, withTheme(color)); if(!ok(im)) return false;
        ctx.drawImage(im, dx, dy, dw, dh); return true;
      },
      // бесшовный тайл → CanvasPattern (кэш по id+размеру+теме); null, пока спрайт не готов
      pattern(id, tile){
        if(!A.ready) return null;
        const tk = (THEME.tokens && Object.keys(THEME.tokens).length) ? THEME.tokens : null;
        const sig = tk ? JSON.stringify(Object.keys(tk).sort().map(k=>k+tk[k])) : '';
        const key = id + '#' + Math.round(tile * dpr) + sig;
        let p = patterns.get(key);
        if(p) return p;
        const im = img(id, tile, tile, tk || undefined);
        if(!ok(im)) return null;
        try{
          p = ctx.createPattern(im, 'repeat');
          if(p && p.setTransform && typeof DOMMatrix !== 'undefined')
            p.setTransform(new DOMMatrix().scale(1 / dpr));
          if(p) patterns.set(key, p);
          return p;
        }catch(e){ return null; }
      }
    };
    const patterns = new Map();
    const SHEETS = ['aircraft', 'field', 'hud', 'effects', 'brand'];
    const loadedSkins = new Set();
    // загрузить пер-скиновый набор листов из assets/sprites/<skin>/planeflow-*.svg.
    // Символы в них должны быть с id-префиксом `<skin>-` (напр. `neon-bay-repair`),
    // чтобы не конфликтовать с базовыми и резолвиться через img() при активном скине.
    // Когда хотя бы один символ доехал — A.skinReady=true и режим спрайтов
    // пересчитывается (см. refreshSpriteMode), так что нарисованный арт включается сам.
    A.loadSkin = function(skin){
      if (!skin || loadedSkins.has(skin)) return;
      loadedSkins.add(skin);
      try {
        if (typeof fetch === 'undefined' || typeof Image === 'undefined') return;
        const h = document.createElement('div');
        h.id = 'pf-sprites-' + skin; h.setAttribute('aria-hidden', 'true');
        h.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        document.body.appendChild(h);
        const urls = SHEETS.map(n => 'assets/sprites/' + skin + '/planeflow-' + n + '.svg');
        Promise.all(urls.map(u => fetch(u).then(r => r.ok ? r.text() : '').catch(() => '')))
          .then(parts => {
            const html = parts.join('\n');
            if (html.trim()) { h.innerHTML = html; if (h.querySelector('symbol')) A.skinReady = true; }
            if (typeof refreshSpriteMode === 'function') refreshSpriteMode();
          }).catch(() => {});
        // PNG-манифест: список id, доступных как растровые ассеты этого скина
        fetch('assets/sprites/' + skin + '/manifest.json')
          .then(r => r.ok ? r.json() : null)
          .then(m => {
            const ids = Array.isArray(m) ? m : (m && Array.isArray(m.png) ? m.png : null);
            if (ids && ids.length) { pngIds.set(skin, new Set(ids)); A.skinReady = true; }
            if (typeof refreshSpriteMode === 'function') refreshSpriteMode();
          }).catch(() => {});
      } catch (e) { /* ignore */ }
    };
    // fetch base sheets into a hidden holder, then go live (browser only; no-op under the test harness)
    try {
      if (typeof fetch !== 'undefined' && typeof Image !== 'undefined') {
        const holder = document.createElement('div');
        holder.id = 'pf-sprites'; holder.setAttribute('aria-hidden', 'true');
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        document.body.appendChild(holder);
        const sheets = SHEETS.map(n => 'assets/sprites/planeflow-' + n + '.svg');
        Promise.all(sheets.map(u => fetch(u).then(r => r.ok ? r.text() : '').catch(() => '')))
          .then(parts => {
            holder.innerHTML = parts.join('\n'); A.ready = true;
            A.loadSkin('neon');   // подтянуть neon-арт
            if (typeof refreshSpriteMode === 'function') refreshSpriteMode();
          })
          .catch(() => {});
      }
    } catch (e) { /* non-DOM env: stay procedural */ }
    return A;
  })();

  // Решает, рисовать ли через спрайт-атлас (ATLAS=true) или процедурно (false):
  // атлас включается, когда neon-арт (assets/sprites/neon/) загружен (A.skinReady);
  // до этого — процедурный неоновый фолбэк, и параллельно подтягиваем арт.
  function refreshSpriteMode(){
    if (!SPRITES.skinReady) SPRITES.loadSkin('neon');
    ATLAS = !!SPRITES.skinReady;
  }
  refreshSpriteMode();

  // ---- palette helpers ----
  // COL — палитра для процедурного фолбэка. Значения берутся из :root (дефолтный
  // вид), но переопределение темы (THEME.tokens) имеет приоритет, чтобы перекраска
  // одинаково ложилась и на спрайты, и на процедурную отрисовку. Дефолт (тема
  // пустая) → берётся :root → вид 1-в-1 как раньше. `coin` — алиас `gold`.
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = {};
  {
    const base = {};
    ['ink','tarmac','tarmac-2','water','phosphor','paper','muted','amber','teal','ice','rose','gold','life','coin']
      .forEach(n => base[n] = css('--'+n));
    const tokenOf = { paper:'cream-100', coin:'gold' }; // имя COL → имя токена темы
    ['ink','tarmac','tarmac-2','water','phosphor','paper','muted','amber','teal','ice','rose','gold','life','coin']
      .forEach(n => Object.defineProperty(COL, n, {
        enumerable: true,
        get(){ const t = THEME.tokens; const tk = tokenOf[n] || n; return (t && t[tk]) || base[n]; }
      }));
  }

  // service -> color (названия услуг — в i18n: svc.*)
  const SVC = {
    repair: {color: COL.amber},
    fuel:   {color: COL.teal},
    board:  {color: COL.rose},
    deice:  {color: COL.ice},
    depart: {color: COL.gold},
  };

  // ---- i18n ----
  // Весь видимый игроком текст — через t(key, params). en — основной/фолбэк.
  // Значение-массив = формы множественного числа (выбор по params.n через _plural).
  // Добавление языка = добавить словарь (_name, _locale, _plural + ключи), логика не меняется.
