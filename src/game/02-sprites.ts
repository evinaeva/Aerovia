// ===== 02-sprites — sprite atlas — load, cache & recolor; resolved palette =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: COL, SPRITES, SVC, tokenOf, refreshSpriteMode.
// Reads: 01 (ctx, PALETTE, NEON_TOKENS, THEME, ATLAS); 03 (t); 06 (save, dpr).

  const SPRITES = (() => {
    const cache = new Map<string, HTMLImageElement>();
    const stripF = (s: string) => s.replace(/\s*filter="url\([^)]*\)"/g, ''); // drop filter refs (defs live in the sheet, not the standalone svg)
    // детерминированная подпись набора токенов для ключа кэша (sorted)
    function tokSig(t: Record<string, string>){
      const keys = Object.keys(t).sort();
      let s = '';
      for(const k of keys) s += k + ':' + t[k] + ';';
      return s;
    }
    // <style> с CSS-переменными темы; пусто, когда переопределений нет (дефолт)
    function styleBlock(t: Record<string, string>){
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
    const pngCache = new Map<string, HTMLImageElement>();   // 'skin/id' -> Image
    const pngIds = new Map();     // skin -> Set<id>
    // Скины-переопределения (для tuning-превью): проверяются до neon, каждый id берётся
    // из первого скина, у которого он есть, иначе фолбэк на neon. Пустой список = только neon.
    let skinOverrides: string[] = [];
    function pngImg(id: string): HTMLImageElement | null {
      for (const skin of [...skinOverrides, 'neon']) {
        const set = pngIds.get(skin);
        if (!set || !set.has(id)) continue;
        const key = skin + '/' + id;
        let im = pngCache.get(key);
        if (!im) {
          im = new Image(); im.decoding = 'async';
          im.src = 'assets/sprites/' + skin + '/' + id + '.png';
          pngCache.set(key, im);
        }
        return im;   // может ещё грузиться — ok() ниже это учитывает (фолбэк до загрузки)
      }
      return null;
    }
    function img(id: string, w: number, h: number, color?: any): HTMLImageElement | null {
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
    const ok = (im: HTMLImageElement | null): im is HTMLImageElement => !!(im && im.complete && im.naturalWidth > 0);

    // ── Пер-зонные скины (примерка из tuning-воркбенча). Картинки адресуются по URL
    // (assets/skins/<zone>/<name>/*.png), НЕ через манифест/атлас. Рисуются ВМЕСТО
    // процедурной отрисовки зоны, когда готовы (см. гейты в 09/09b). Путь полностью
    // отдельный от skinOverrides/pngImg/loadSkin: при пустой карте каждый аксессор
    // отдаёт null → движок рисует как раньше, байт-в-байт (ATLAS/skinReady не трогаются).
    type ZoneSkinMap = {
      apron?: string | null; runway?: string | null; arrival?: string | null;
      background?: string | null; plane?: string | null;
      hangar?: { fuel?: string; board?: string; repair?: string; deice?: string; locked?: string } | null;
    };
    let zoneSkins: ZoneSkinMap = {};
    const zoneImgCache = new Map<string, HTMLImageElement>();   // url -> Image
    function zoneImg(url?: string | null): HTMLImageElement | null {
      if (!url || typeof Image === 'undefined') return null;
      let im = zoneImgCache.get(url);
      if (!im) { im = new Image(); im.decoding = 'async'; im.crossOrigin = 'anonymous'; im.src = url; zoneImgCache.set(url, im); }
      return im;   // может ещё грузиться — zoneSkin()/ok() это учитывают (фолбэк до загрузки)
    }
    // объединяет активную тему (THEME.tokens) с per-call переопределением.
    // Строку (currentColor) пропускаем как есть. Без темы и без override —
    // возвращаем сам color, чтобы дефолтный путь не плодил пустые объекты в кэше.
    function withTheme(color?: any){
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
    interface SpriteApi {
      ready: boolean;
      skinReady: boolean;
      readonly palette: Record<string, string>;
      setTheme(tokens: any): void;
      has(id: string): boolean;
      blitC(id: string, cx: number, cy: number, dw: number, dh: number, rot?: number, color?: any): boolean;
      blit(id: string, dx: number, dy: number, dw: number, dh: number, color?: any): boolean;
      pattern(id: string, tile: number): CanvasPattern | null;
      loadSkin?: (skin: string) => void;
      setSkinOverrides?: (skins: string[]) => void;
      hasOverrides?: () => boolean;
      setZoneSkins?: (map: ZoneSkinMap) => void;
      zoneSkin?: (zone: string, state?: string) => HTMLImageElement | null;
      hasZoneSkin?: (zone: string, state?: string) => boolean;
      getZoneSkins?: () => ZoneSkinMap;
    }
    const A: SpriteApi = {
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
    // Какие из SHEETS реально есть у скина как SVG-лист; остальное у neon приходит из
    // PNG-атласа (manifest) и базовых листов. Без этого loadSkin дёргал все 5 и ловил
    // 404 на neon/planeflow-{hud,effects,brand}.svg. Держать в синхроне с precache в sw.js.
    // neon: SVG-листы aircraft+field; arctic/neon2: только PNG-манифест, SVG-листов нет (иначе 404)
    const SKIN_SHEETS: Record<string, string[]> = { neon: ['aircraft', 'field'], arctic: [], neon2: [] };
    const loadedSkins = new Set();
    // загрузить пер-скиновый набор листов из assets/sprites/<skin>/planeflow-*.svg.
    // Символы в них должны быть с id-префиксом `<skin>-` (напр. `neon-bay-repair`),
    // чтобы не конфликтовать с базовыми и резолвиться через img() при активном скине.
    // Когда хотя бы один символ доехал — A.skinReady=true и режим спрайтов
    // пересчитывается (см. refreshSpriteMode), так что нарисованный арт включается сам.
    A.setSkinOverrides = function(skins: string[]){
      skinOverrides = (skins || []).filter((s: string) => s !== 'neon');
      skinOverrides.forEach((s: string) => A.loadSkin!(s));
    };
    A.hasOverrides = () => skinOverrides.length > 0;
    // Пер-зонные скины: карта { zone: url } (ангар → { state: url }). Прогреваем декод,
    // чтобы первый готовый кадр не мигнул процедуркой. zoneSkin() отдаёт картинку только
    // когда она реально загружена (ok()), иначе null — вызывающий код падает в процедурку.
    A.setZoneSkins = function (map) {
      zoneSkins = (map && typeof map === 'object') ? map : {};
      if (zoneSkins.hangar) Object.values(zoneSkins.hangar).forEach(u => zoneImg(u));
      (['apron', 'runway', 'arrival', 'background', 'plane'] as const).forEach(z => zoneImg(zoneSkins[z]));
    };
    A.zoneSkin = function (zone, state) {
      if (zone === 'hangar') {
        const h = zoneSkins.hangar; if (!h) return null;
        const im = zoneImg((h as Record<string, string>)[state || 'locked']); return ok(im) ? im : null;
      }
      const im = zoneImg((zoneSkins as Record<string, string | null>)[zone]); return ok(im) ? im : null;
    };
    A.hasZoneSkin = (zone, state) => !!A.zoneSkin!(zone, state);
    A.getZoneSkins = () => zoneSkins;
    A.loadSkin = function(skin: string){
      if (!skin || loadedSkins.has(skin)) return;
      loadedSkins.add(skin);
      try {
        if (typeof fetch === 'undefined' || typeof Image === 'undefined') return;
        const h = document.createElement('div');
        h.id = 'pf-sprites-' + skin; h.setAttribute('aria-hidden', 'true');
        h.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        document.body.appendChild(h);
        const urls = (SKIN_SHEETS[skin] || SHEETS).map(n => 'assets/sprites/' + skin + '/planeflow-' + n + '.svg');
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
            A.loadSkin!('neon');   // подтянуть neon-арт
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
    if (!SPRITES.skinReady) SPRITES.loadSkin!('neon');
    ATLAS = !!SPRITES.skinReady;
  }
  refreshSpriteMode();

  // ---- palette helpers ----
  // COL — палитра для процедурного фолбэка. Значения берутся из :root (дефолтный
  // вид), но переопределение темы (THEME.tokens) имеет приоритет, чтобы перекраска
  // одинаково ложилась и на спрайты, и на процедурную отрисовку. Дефолт (тема
  // пустая) → берётся :root → вид 1-в-1 как раньше. `coin` — алиас `gold`.
  const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL: Record<string, string> = {};
  {
    const base: Record<string, string> = {};
    // Имена COL → токен темы (NEON_TOKENS). green·green-bright·purple·core добавлены
    // к списку: неон-геймплей опирается на них (точки апгрейда/affordable-рамка/чип ↑
    // и тон 3-й ВПП — green; цель уровня — purple; подложки — core), но в :root их нет,
    // поэтому без проброса COL.green/.purple/.core был бы undefined в процедуре (тогда
    // канвас тихо игнорирует fill/strokeStyle и берёт прошлый цвет). Значения — из
    // THEME.tokens. Один список на оба прохода (base + геттеры), чтобы не разъехались.
    const COL_NAMES = ['ink','tarmac','tarmac-2','water','phosphor','paper','muted','amber','teal','ice','rose','gold','life','coin','green','green-bright','purple','core'];
    COL_NAMES.forEach(n => base[n] = css('--'+n));
    const tokenOf: Record<string, string> = { paper:'cream-100', coin:'gold' }; // имя COL → имя токена темы
    COL_NAMES.forEach(n => Object.defineProperty(COL, n, {
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
