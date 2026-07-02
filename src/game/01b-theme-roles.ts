// ===== 01b-theme-roles — semantic Theme Roles over NEON_TOKENS + biome ThemeManager + PNG gradient-map recolor =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: DEFAULT_BIOME, theme, _hiDrawGradientMapped.
// Reads: 01 (NEON_TOKENS, THEME, ctx, _hiOk, _hiDraw); 02 (SPRITES) at runtime; 09 (invalidateRenderThemeCaches) at runtime.
//
// ЗАЧЕМ роли. Три слоя рендера (canvas-процедурка через COL/NEON_TOKENS, SVG-атлас через
// var(--token,#hex), PNG-растр) сейчас знают КОНКРЕТНЫЕ имена неон-токенов (amber, phosphor,
// tarmac…), привязанные к текущему тёмно-неоновому облику. Чтобы добавить биом с другой
// палитрой (следующий — tropical shore) БЕЗ правки кода отрисовки, вводим прослойку
// СЕМАНТИЧЕСКИХ РОЛЕЙ: рендер спрашивает роль ('accent-warm', 'hazard'…), а какой токен/hex
// за ней стоит — решает активный биом. Значения дефолтного биома скопированы 1-в-1 из
// NEON_TOKENS → вид ПИКСЕЛЬ-В-ПИКСЕЛЬ прежний. Здесь НЕ меняем значения NEON_TOKENS.

interface GradientStop { stop: number; color: string; }
interface ThemeBiome {
  name: string;
  // Сырая палитра токенов для процедурки (COL читает THEME.tokens) и SVG-passthrough
  // (blit/blitC мёржат THEME.tokens в спрайт как var(--token,value)). У дефолтного биома
  // это ровно NEON_TOKENS — поэтому COL/SVG на дефолте не меняются.
  tokens: Record<string, string>;
  // Семантические роли → hex активного биома. Рендер обращается сюда через theme.getRole().
  roles: Record<string, string>;
  // PNG gradient-map recolor: ключ ассета → градиент светотени (см. _hiDrawGradientMapped).
  // У дефолтного биома пусто → recolor НЕ применяется, растр рисуется как раньше.
  gradientMaps?: Record<string, GradientStop[]>;
}

// Дефолтный биом «dark-neon»: роли ↔ существующие NEON_TOKENS. Группировка по правилу 60/30/10
// (см. промпт «Theme Roles»). Значения — существующие токены, БЕЗ изменения цветов.
const DEFAULT_BIOME: ThemeBiome = {
  name: 'dark-neon',
  tokens: NEON_TOKENS,
  roles: {
    // 60% — фон / игровое поле
    'bg-primary':    NEON_TOKENS.ink,          // заливка неон-поля (drawNeonField)
    'bg-secondary':  NEON_TOKENS.tarmac,       // поверхность апрона / пол ангара
    // 30% — статичные структуры (ангары · ВПП · апрон)
    'structure-1':   NEON_TOKENS.led,          // неон-кант апрона + рамка/LED-точки ВПП
    'structure-2':   NEON_TOKENS['led-core'],  // яркое ядро неон-канта апрона
    // 10% — интерактив (борт · целевой ангар · траектория)
    'accent-active': NEON_TOKENS.phosphor,     // траектория игрока, кольцо выделения, свечение борта
    'accent-warm':   NEON_TOKENS.amber,        // тёплый акцент (запас терпения, ремонт)
    // статусные роли
    'hazard':        NEON_TOKENS.life,         // опасность / закрытая ВПП / краш / SOS
    'success':       NEON_TOKENS.green,        // доступно / апгрейд / успех
    // HUD
    'ui-text':       NEON_TOKENS['hud-text'],  // значения/иконки левого меню
    'ui-glow':       NEON_TOKENS['hud-glow'],  // свечение рамки левого меню
  },
  gradientMaps: {},   // дефолт: recolor выключен → растр 1-в-1 как раньше
};

// Порядок ролей для UI-редактора (tuning.html «Тема») + обратный маппинг роль→токен.
// ROLE_TOKEN — какой сырой NEON_TOKENS-токен несёт эта роль в дефолтном облике; нужен,
// чтобы правка роли в редакторе перекрашивала И роль-точки (canvas), И все COL/SVG
// использования соответствующего токена (иначе поменялись бы только 4 роль-места).
const ROLE_KEYS = ['bg-primary','bg-secondary','structure-1','structure-2','accent-active','accent-warm','hazard','success','ui-text','ui-glow'] as const;
const ROLE_TOKEN: Record<string, string> = {
  'bg-primary':'ink', 'bg-secondary':'tarmac', 'structure-1':'led', 'structure-2':'led-core',
  'accent-active':'phosphor', 'accent-warm':'amber', 'hazard':'life', 'success':'green',
  'ui-text':'hud-text', 'ui-glow':'hud-glow',
};

// ── ThemeManager: активный биом + доступ к ролям/токенам/градиент-мапам ─────────────
// Без фреймворков: module-level singleton в общем скоупе IIFE. Переключение биома —
// theme.setBiome(biome); getRole() читает активный биом на каждом кадре, поэтому смена
// биома перекрашивает всё БЕЗ правки кода отрисовки.
const theme = {
  activeBiome: DEFAULT_BIOME as ThemeBiome,
  // роль → hex активного биома (фолбэк на дефолтный биом, если биом её не задал)
  getRole(role: string): string {
    return this.activeBiome.roles[role] || DEFAULT_BIOME.roles[role] || NEON_TOKENS.phosphor;
  },
  // сырой токен активного биома (фолбэк на NEON_TOKENS) — для мест, где роль не подходит
  getToken(name: string): string {
    return (this.activeBiome.tokens && this.activeBiome.tokens[name]) || NEON_TOKENS[name];
  },
  // градиент-мап для PNG-ассета в активном биоме, либо null (recolor не задан)
  getGradientMap(key: string): GradientStop[] | null {
    const g = this.activeBiome.gradientMaps; return (g && g[key]) || null;
  },
  // Собрать биом из переопределений ролей: берём дефолтные роли, накатываем overrides,
  // и ПРОИЗВОДИМ tokens (через ROLE_TOKEN) — так правка роли перекрашивает и роль-точки
  // (canvas), и все COL/SVG использования соответствующего токена. Токены без роли
  // (teal/ice/rose/gold/muted/paper…) остаются неоновыми. Используется редактором
  // палитры в tuning.html (__THEME.buildBiome).
  buildBiome(name: string, roleOverrides?: Record<string, string>, gradientMaps?: Record<string, GradientStop[]>): ThemeBiome {
    const roles = Object.assign({}, DEFAULT_BIOME.roles, roleOverrides || {});
    const tokens = Object.assign({}, NEON_TOKENS);
    for (const role in ROLE_TOKEN) if (roles[role]) tokens[ROLE_TOKEN[role]] = roles[role];
    return { name: name || 'custom', tokens, roles, gradientMaps: gradientMaps || {} };
  },
  // Переключить активный биом и переинициализировать зависимые кэши.
  //  • THEME.tokens := биом.tokens → COL (процедурка) и SVG-passthrough перекрашиваются сами;
  //  • SPRITES.releaseCaches() → отпустить декодированные/перекрашенные SVG-растры и паттерны;
  //  • _gmCache.clear() → пересчитать PNG gradient-map под новый биом (один раз, не per-frame);
  //  • invalidateRenderThemeCaches() (09) → offscreen неон-линии апрона + пред-масштаб спрайтов.
  // Перерисовку НЕ форсируем: rAF-цикл (10-scene-loop) берёт новые роли со следующего кадра.
  setBiome(biome: ThemeBiome): void {
    if (!biome || typeof biome !== 'object') return;
    this.activeBiome = biome;
    THEME.tokens = biome.tokens || NEON_TOKENS;
    if (SPRITES && SPRITES.releaseCaches) SPRITES.releaseCaches();
    _gmCache.clear();
    if (typeof invalidateRenderThemeCaches === 'function') invalidateRenderThemeCaches();
  },
};

// ── PNG gradient-map recolor (для ДЕКОРАТИВНОГО/повторяющегося растра между биомами) ──
// Красит светотень ассета в палитру биома, сохраняя его люминансность (composite 'color'
// адаптирует hue/sat, оставляя яркость исходника). Ожидается grayscale-версия ассета для
// предсказуемого результата, но работает и на цветном (тогда 'color' перекроет его тон).
//
// Recolor считается ОДИН РАЗ на (ассет × биом) и кэшируется в offscreen-канвасе (в натуральном
// размере ассета — как обычный drawImage, только тон посчитан однажды, а не каждый кадр).
// Прозрачность сохраняется: после заливки градиентом обрезаем результат по альфе ассета
// ('destination-in'). Кэш сбрасывается в theme.setBiome() и должен чиститься при уходе в фон
// (memory-android17) — сейчас он маленький (LRU ≤ _GM_MAX) и переживает лишь активный биом.
const _gmCache = new Map<string, HTMLCanvasElement>();
const _GM_MAX = 8;
function _gmKeyOf(im: HTMLImageElement | HTMLCanvasElement): string {
  return String((im as HTMLImageElement).src || 'canvas');
}
function _gmCanvas(im: HTMLImageElement | HTMLCanvasElement, stops: GradientStop[]): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const iw = (im as HTMLImageElement).naturalWidth || (im as HTMLCanvasElement).width;
  const ih = (im as HTMLImageElement).naturalHeight || (im as HTMLCanvasElement).height;
  if (!(iw > 0 && ih > 0)) return null;
  const key = _gmKeyOf(im) + '|' + theme.activeBiome.name + '|' + JSON.stringify(stops);
  let c = _gmCache.get(key);
  if (c) { _gmCache.delete(key); _gmCache.set(key, c); return c; }   // LRU: освежаем
  c = document.createElement('canvas'); c.width = iw; c.height = ih;
  const g = c.getContext('2d'); if (!g) return null;
  g.drawImage(im, 0, 0, iw, ih);                       // светотень-источник (destination)
  g.globalCompositeOperation = 'color';                // сохраняет luminosity, красит hue/sat
  const grad = g.createLinearGradient(0, ih, 0, 0);
  stops.forEach(s => grad.addColorStop(s.stop, s.color));
  g.fillStyle = grad; g.fillRect(0, 0, iw, ih);
  g.globalCompositeOperation = 'destination-in';       // вернуть прозрачность по альфе ассета
  g.drawImage(im, 0, 0, iw, ih);
  g.globalCompositeOperation = 'source-over';
  _gmCache.set(key, c);
  if (_gmCache.size > _GM_MAX) { const first = _gmCache.keys().next().value; if (first !== undefined) _gmCache.delete(first); }
  return c;
}
// Нарисовать перекрашенный градиент-мапом ассет по центру (cx,cy) с поворотом (рад→нет, deg).
// Возвращает false, если ассет не готов/нет размеров — вызывающий падает на обычный drawImage.
function _hiDrawGradientMapped(im: HTMLImageElement | HTMLCanvasElement | null, cx: number, cy: number, w: number, h: number, rotDeg: number, gradientStops: GradientStop[]): boolean {
  if (!_hiOk(im)) return false;
  const recolored = _gmCanvas(im!, gradientStops);
  if (!recolored) return false;
  return _hiDraw(recolored, cx, cy, w, h, rotDeg);
}
