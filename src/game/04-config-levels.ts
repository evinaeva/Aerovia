// ===== 04-config-levels — tuning constants, level/biome/bonus definitions & level math =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: K, LEVELS, BIOMES, BONUS, LV, levelEconomy, levelEffects, levelEvents, levelPace/paceInterval/paceCap, airPatience, dayCycle, objectiveDesc, EVENT_KEYS, SVC_TYPES, WEATHER_KINDS, curBiome, curBonus.
// Reads: 03 (I18N, t, lang, DEFAULT_LANG); 06 (state: gameTime, served, runways, save, combo, debug, weather, effects, levelIdx).

  // ===== config shapes (types only; erased at build) =====
  interface SideCfg { type: string; slots: number; open: number; }
  // РАССТАНОВКА (конструктор уровня): уровень может задать явный layout вместо sides.
  // Координаты hangar.x/y нормированы 0..1 по апрону (field.x0..x1, y0..y1) — не зависят
  // от экрана. Один ангар = одно место: тип услуги, позиция, открыт/закрыт (open, умолч.
  // true), апгрейдируется ли (up, умолч. true) и куда смотрят ворота (gate; если опустить —
  // выводится из ближайшей кромки апрона). ВПП — горизонтальные (заход справа): задаётся
  // только вертикальная позиция y (0..1) и их число; len зарезервирован под будущую длину.
  interface HangarDef { type: string; x: number; y: number; open?: boolean; up?: boolean; gate?: 'up'|'down'|'left'|'right'; openCost?: number; upgCost?: number; }
  interface RunwayDef { y: number; len?: number; landingOpen?: boolean; takeoffOpen?: boolean; landingCost?: number; takeoffCost?: number; }
  interface LevelLayout { hangars: HangarDef[]; runways: RunwayDef[]; }
  interface Events { vip?: boolean; emergency?: boolean; medical?: boolean; rush?: boolean; fog?: boolean; wind?: boolean; [k: string]: boolean | undefined; }
  interface Objective { metric: 'served' | 'upgrades'; stars: number[]; target?: number; time?: number; race?: boolean; upg?: number[]; }
  interface Level {
    pace?: number; objective: Objective;
    // геометрия — ЛИБО явный layout (конструктор), ЛИБО старые sides+runways (слоты,
    // авто-раскладка в две ангары). Движок читает layout, если он задан, иначе sides.
    layout?: LevelLayout; runways?: number;
    sides?: { top?: SideCfg; left?: SideCfg; bottom?: SideCfg };
    services?: string[];   // какие услуги запрашивают борты (подмножество SVC_TYPES; умолч. все)
    maxUp?: number;        // глубина апгрейда на уровне 0..BAY_MAX_LVL (умолч. потолок); 0 — без апгрейдов
    events?: Events; startMoney?: number;
    crashPenalty?: number; // 0..1 — доля вознаграждения борта, списывается с кассы при крэше
    latePenalty?: number;  // 0..1 — доля вознаграждения при истечении наземного терпения (умолч. 0.5)
    biome?: string; bonus?: string; weather?: boolean; deice?: boolean;
    calm?: number; survRamp?: number; combo?: boolean; express?: boolean;
  }
  interface Biome { id: string; emoji: string; ready: boolean; level?: Level; }
  interface Bonus { id: number; after: number; emoji: string; level: Level; }
  const K = {
    TURN: 3.2,            // rad/sec поворот в полёте
    SPEED_AIR: 60,        // скорость захода на посадку
    SPEED_TAXI: 45,       // скорость руления по земле
    SPEED_TAKEOFF: 150,   // разгон на взлёте
    // визуальная «перспектива»: в небе борт ближе к наблюдателю — крупнее, на земле
    // мельче. На ВПП масштаб плавно меняется по ходу полосы (посадка ужимает, взлёт
    // раздувает). Чисто визуально — на столкновения/хваты не влияет.
    PLANE_SKY_SCALE: 1.5, // масштаб борта в небе
    PLANE_GND_SCALE: 1.0, // масштаб на земле/поле
    LAND_BUMP_MS: 280,    // длительность визуального «толчка» при касании, мс
    TAKEOFF_HOLD: 0.5,    // крошечная остановка перед разгоном на взлёте, сек
    ARRIVE: 12,
    GRAB: 42,
    CRASH_DIST: 24,       // столкновение на поле
    NEAR_DIST: 52,        // «едва разошлись»: ближе — near-miss «уфф» (но не краш)
    NEAR_COOL: 2.2,       // антидребезг near-miss на одну пару бортов, сек
    SLOWMO_DUR: 0.30,     // лёгкое замедление времени при near-miss, сек
    SLOWMO_SCALE: 0.45,   // во сколько раз замедляется время в этот миг
    // Воздушное терпение — ФИКСИРОВАННОЕ окно посадки обычного борта, НЕ зависит от
    // уровня/сложности (иначе на дальних уровнях борт пришлось бы сажать за секунду).
    // Рост сложности идёт через ТЕМП (частота прилёта + одновременность), а не через
    // поджатие этого окна. Спецборты урезают окно множителем (см. spawnPlane → airMult).
    AIR_BASE: 30,         // фикс. воздушное терпение обычного борта, сек (одинаково на всех уровнях)
    GROUND_BASE: 60,      // базовое наземное терпение, сек
    GROUND_STEP: 30,      // + за каждую услугу
    SERVE_BASE: 3.0,      // базовое время обслуживания в боксе
    VIP_CHANCE: 0.25,
    TWO_SVC_CHANCE: 0.45, // доля бортов с 2 услугами (иначе 1) — задаёт средний чек смены
    // Темп уровня (pace 0..1) — ГЛАВНАЯ ось сложности: чем выше, тем меньше «простоя»
    // между действиями. pace задаёт базовый интервал спавна и лимит одновременных
    // бортов (см. update()/spawn и levelDifficulty). Воздушное терпение pace НЕ трогает.
    PACE_IVL_SLOW: 4.6,   // базовый интервал спавна при pace=0 (спокойно), сек
    PACE_IVL_FAST: 2.4,   // базовый интервал спавна при pace=1 (плотно), сек
    SPAWN_MIN: 1.8,       // абсолютный пол интервала (после внутриуровневого ускорения)
    SPAWN_DECAY: 0.04,    // на сколько укорачивается интервал за каждый принятый борт
    PACE_CAP_LOW: 4,      // лимит одновременных бортов при pace=0
    PACE_CAP_HIGH: 10,    // лимит одновременных бортов при pace=1
    PACE_DEFAULT: 0.25,   // pace для не-кампании (биом/бонус) — спокойный фон
    MAX_PLANES: 10,       // жёсткий потолок одновременных бортов (биом/бонус)
    SURV_RAMP_SECS: 300,  // Survival: за сколько сек стартовый темп карты (level.pace) выходит на максимум (1.0)
    START_MONEY: 100,
    BAY_OPEN_COST: 100,
    BAY_UP_COST: [80,160,320,640,1280], // апгрейд до ур.1/2/3/4/5 (глобальный потолок BAY_MAX_LVL)
    BAY_MAX_LVL: 5,                    // абсолютный потолок прокачки; per-level maxUp может срезать ниже
    RUNWAY_MAX: 5,                  // потолок числа ВПП на карте (layout): вертикально больше не помещается
    UP_SPEED: 0.25,       // +25% скорости за уровень
    // --- экономика: оплата за услугу и стартовая касса ВЫВОДЯТСЯ из самого уровня
    //     функцией levelEconomy() (см. docs/design/game-design/economy.md). Константы
    //     ниже — настроечные ручки модели, а не деньги напрямую. ---
    SVC_MIN: 10, SVC_MAX: 32,   // границы оплаты за услугу (вип/срочный/мед дают ×bonus сверху)
    ECON_OPEN_FRAC: 0.7,        // какую долю докупаемых боксов уровень «ожидает» открыть
    ECON_UP_FRAC:   0.6,        // и долю работающих боксов, что возьмут апгрейд ур.1
    ECON_FLOW_SECS: 6,          // таймерные карты: оценка потока — один платный борт раз в N сек
    ECON_KIT_FLOOR: 0.8,        // competent-игрок должен суметь купить хотя бы эту долю «набора»
    // щедрость: набор по карману competent-игроку (×generosity ≥ kit). База ≥1 гарантирует,
    // что деньги НЕ блокируют 3★; прибавка за сложность компенсирует хаос/штрафы на тяжёлых картах
    ECON_GEN_BASE: 1.0, ECON_GEN_DIFF: 0.35,
    // реалистичный «скилл-добор» от ВКЛЮЧЁННЫХ эффектов (комбо/экспресс): сколько игрок
    // реально берёт сверх базы. Сложность рвёт серии → добор тем меньше, чем сложнее карта.
    ECON_COMBO_REAL: 0.5,       // доля теоретического максимума комбо, что реально достижима
    ECON_EXPRESS_SHARE: 0.35,   // базовая доля бортов, уходящих экспрессом
    ECON_CHAOS: 0.5,            // насколько сложность срезает комбо/экспресс (0..1)
    // множитель сложности (levelDifficulty): взвешенная сумма сигналов карты, как в жанре
    // (плотность потока · спецборты · таймер · среда), нормируется в ~[0, ECON_DIFF_CAP]
    ECON_W_EVENT: 0.25, ECON_W_TIME: 0.5, ECON_W_DENS: 0.5, ECON_W_ENV: 0.3,
    ECON_DIFF_NORM: 2.0, ECON_FLOW_REF: 32, ECON_DIFF_CAP: 1.2,
    START_LIVES: 3,
    // комбо / экспресс
    COMBO_MAX: 10, COMBO_STEP: 0.1,   // множитель денег до x2 за серию чистых вылетов
    EXPRESS_TIME: 12,                 // сек от посадки до вылета для экспресс-бонуса
    EXPRESS_BONUS: 1.5,               // x1.5 денег за быстрый цикл
    // спец-борты / события
    EMERGENCY_CHANCE: 0.12,           // доля бортов «топливо на нуле»
    EMERGENCY_BONUS: 1.5,             // x1.5 денег за аварийный борт
    MEDICAL_CHANCE: 0.10,             // доля «медицинских» бортов (приоритет)
    MEDICAL_AIR: 0.7,                 // множитель воздушного терпения медицинского (срочный)
    MEDICAL_BONUS: 2.5,               // x2.5 денег за медицинский (приоритетный борт)
    RUSH_PERIOD: 35, RUSH_DUR: 8,     // «час пик»: период и длительность волны
    WIND_PERIOD: 28, WIND_DUR: 12,    // смена ветра: период и длительность закрытия ВПП
    FOG_PERIOD: 45, FOG_DUR: 10,      // туман: период и длительность
    FOG_TAXI: 0.55,                   // множитель скорости руления в тумане
    // «туман»/«ветер» сбивают ритм (меняют скорость бортов и доступность полос),
    // поэтому глушим их на всех уровнях. Код механик оставлен целиком — достаточно
    // вернуть флаг в false, чтобы события снова заработали по конфигу уровня/биома.
    WEATHER_EVENTS_OFF: true,         // глобально отключить туман+ветер во всех режимах
    // атмосфера (чистая логика; визуал — за слоем дизайна, рендер просто читает
    // nightAmount/weather). day/night — фоновые «часы», на сложность не влияют.
    DAYNIGHT_PERIOD: 150,             // сек на полный круг день→ночь→день
    // погода — опциональный движок, включается флагом weather:true у уровня/биома
    WEATHER_PERIOD: 40,               // период попыток смены погоды
    WEATHER_DUR: 16,                  // длительность погодного окна
    WEATHER_SNOW_CHANCE: 0.5,         // доля снега среди непогоды (иначе дождь)
    WEATHER_RAIN_TAXI: 0.8,           // множитель скорости руления под дождём
    WEATHER_SNOW_TAXI: 0.6,           // множитель скорости руления под снегом (хуже дождя)
    // разделение кампании: L1..TUTORIAL_COUNT — рукописные туториалы (монотонный pace),
    // L(TUTORIAL_COUNT+1)..50 — генерируются процедурно (своя кривая сложности)
    TUTORIAL_COUNT: 10,
  };

  // типы услуг (боксов) — единый источник правды. Объявлен рано: levelEconomy (через
  // levelServices) зовётся ещё на инициализации модуля, раньше прежнего места ниже.
  const SVC_TYPES  = ['fuel','board','repair'];

  // ---- лесной биом: помехи на ВПП и спец-бригады (см. docs/backlog.md) ----
  // Идея: на полосу лезут природные помехи (падающее дерево, олень, птицы), игрок
  // тапает по помехе — из сервисного здания выезжает нужная бригада и убирает её.
  // Деревья грызут бобры → дерево падает медленнее, можно успеть прислать пилу.
  const FOR = {
    SPAWN_FIRST: 7,        // первая помеха через N сек после старта
    SPAWN_MIN: 9, SPAWN_MAX: 17,   // интервал между помехами
    TREE_FALL: 6.0,        // сек падения дерева до перекрытия полосы
    TREE_FALL_BEAVER: 11,  // бобёр грызёт — дерево падает медленнее (больше времени)
    BEAVER_CHANCE: 0.5,    // доля деревьев с бобром
    DEER_LIFE: 14,         // олень сам уходит, если не отреагировать
    BIRD_LIFE: 9,          // птицы сами улетают
    CREW_SPEED: 260,       // скорость спец-авто, px/сек
    WORK_TIME: 1.4,        // сек работы бригады на месте
    REWARD: 12,            // премия за устранённую помеху
  };

  // ---- level config ----
  // КАЖДЫЙ уровень — один шаг кривой «медленного нарастания сложности» (паттерн —
  // в docs/design/game-design/level-pattern.md). По нему же делаем будущие карты.
  //
  // objective:
  //   metric : 'served' | 'upgrades' — что считаем (принятые борты / апгрейды).
  //   stars  : [s1, s2, s3] — градация по звёздам (как в референсе): значение
  //            metric для 1★ / 2★ / 3★ по возрастанию. s3 — «потолок» уровня
  //            (по нему рисуется цель и им же ограничивается спавн). target
  //            проставляется автоматически = stars[2] (см. normObjective).
  //   time   : сек — лимит на время (необязателен). Часы тикают в обратку.
  //   race   : true — «успей за время» (L5): бортов столько, сколько успеешь
  //            принять; счёта-потолка нет, уровень кончается только по времени.
  //   upg    : [u1, u2, u3] — доп. порог по апгрейдам ДЛЯ ВЫСШИХ ЗВЁЗД при
  //            metric:'served' (L3): чтобы взять 2★/3★, нужно и принять борты,
  //            и сделать апгрейды (как ✈+🔧 в референсе).
  // sides/runways/startMoney — как раньше (startMoney по умолчанию K.START_MONEY).
  // events — спецборты/динамика (vip / rush / medical / emergency / fog / wind).
  //   L1–L6 — ОБУЧАЮЩИЙ БЛОК: чистые механики, без спецсобытий. Спецборты
  //   вводятся только с L7 (vip→L7, rush→L8, medical→L10) — см. validateLevels.
  // Имя/вызов/подсказка — в словаре: level.t.<n> / level.d.<n> / level.h.<n>.
  // КРИВАЯ ПО ИНТЕНСИВНОСТИ, а не по объёму: сложность растёт через ТЕМП (поле pace 0..1 —
  // частота прилёта + одновременность бортов), а воздушное терпение фикс. (K.AIR_BASE).
  // Структура — КЛАСТЕРЫ «введение → консолидация»: не каждый уровень даёт новую игрушку,
  // иначе их тяжело держать в памяти. Освоил пару механик → уровень-закрепление со всеми
  // сразу. pace по кампании НЕ убывает (валидатор это проверяет). Спецсобытия — не раньше
  // спокойного блока L1–L4 (см. CALM_LEVELS в validateLevels): vip→L5, emergency→L6,
  // rush→L8, medical→L9; каждый спецборт дебютирует один раз, дальше комбинируется.
  // Имя/вызов/подсказка — в словаре: level.t.<n> / level.d.<n> / level.h.<n>.
  const LEVELS: Level[] = [
    // ── СПОКОЙНЫЙ БЛОК (L1–L4): чистые механики, без спецсобытий, низкий темп ──
    // L1 — посадка и обслуживание: маленькая цель, самый низкий темп (бережём первые 5 минут).
    { pace:0.00, objective:{ metric:'served', stars:[6,7,8] },
      sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
      runways:3, events:{} },
    // L2 — введение: открой второй бокс (экономика). Темп чуть выше.
    { pace:0.12, objective:{ metric:'served', stars:[8,10,12] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{} },
    // L3 — введение: апгрейды (цель ✈ + порог 🔧 на 2★/3★).
    { pace:0.22, objective:{ metric:'served', stars:[10,12,14], upg:[0,2,4] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{} },
    // L4 — КОНСОЛИДАЦИЯ: всё из блока (открыть+апгрейд+развод) под ровным потоком, без новой
    //   игрушки. Темп заметно выше — меньше пауз между действиями.
    { pace:0.34, objective:{ metric:'served', stars:[12,15,18] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{} },
    // ── БЛОК СПЕЦБОРТОВ (L5–L10): по одному новому, с консолидацией ──
    // L5 — введение: VIP (золотой, нетерпеливее, платит больше).
    { pace:0.44, objective:{ metric:'served', stars:[14,16,18] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ vip:true } },
    // L6 — введение: «топливо на нуле» (садить ПЕРВЫМ — острое давление воздуха).
    { pace:0.54, objective:{ metric:'served', stars:[14,16,18] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ emergency:true } },
    // L7 — КОНСОЛИДАЦИЯ: VIP + аварийный вместе, плотнее, без новой игрушки. Слегка зажата касса.
    { pace:0.64, objective:{ metric:'served', stars:[16,19,22] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ vip:true, emergency:true }, startMoney:90 },
    // L8 — введение: час пик (волны прилётов поверх знакомого VIP).
    { pace:0.74, objective:{ metric:'served', stars:[18,21,24] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ vip:true, rush:true } },
    // L9 — введение: медицинский (приоритет, быстрый цикл) поверх знакомого VIP.
    { pace:0.86, objective:{ metric:'served', stars:[18,21,24] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ vip:true, medical:true } },
    // L10 — КАПСТОУН: всё сразу на максимальном темпе, зажатые ресурсы. Экзамен диспетчера.
    { pace:1.00, objective:{ metric:'served', stars:[22,26,30] },
      sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
      runways:3, events:{ vip:true, emergency:true, rush:true, medical:true }, startMoney:80 },
    // L11 — ТЕСТ штрафов: crashPenalty 50% + latePenalty 40%. Explicit layout, 2 ВПП.
    // Взлётный конец нижней ВПП закрыт — игрок сам решает, когда открыть.
    { pace:0.38,
      objective:{ metric:'served', stars:[16,20,24] },
      layout:{
        hangars:[
          { type:'fuel',   x:0.20, y:0.10, open:true  },
          { type:'board',  x:0.55, y:0.10, open:true  },
          { type:'repair', x:0.20, y:0.90, open:true  },
          { type:'fuel',   x:0.55, y:0.90, open:false, openCost:120 },
          { type:'board',  x:0.85, y:0.50, open:false, openCost:150 },
        ],
        runways:[
          { y:0.35, landingOpen:true,  takeoffOpen:true  },
          { y:0.65, landingOpen:true,  takeoffOpen:false, takeoffCost:100 },
        ],
      },
      events:{ vip:true },
      startMoney:200, maxUp:2,
      crashPenalty:0.50,
      latePenalty:0.40,
    },
  ];
  // ---- biome maps (отдельная от кампании ветка карт) ----
  // Каждый биом — это конфиг уровня (как в LEVELS) + флаг biome для темы/помех.
  // ready:false — биом в работе, на экране показан как «скоро». Сервисное здание
  // (откуда выезжают спец-бригады) рисуется сверху поля у всех биом-карт.
  const BIOMES: Biome[] = [
    { id:'forest', emoji:'🌲', ready:true,
      level:{ biome:'forest', weather:true, deice:true, objective:{ metric:'served', stars:[10,12,14] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
    { id:'arctic',   emoji:'❄️', ready:false },
    { id:'tropical', emoji:'🏝️', ready:false },
    { id:'desert',   emoji:'🐪', ready:false },
    { id:'mountain', emoji:'🏔️', ready:false },
    { id:'megacity', emoji:'🌆', ready:false },
  ];
  // ---- бонус-уровни (шуточный «другой мир» каждые 5 уровней) ----
  // Открывается после прохождения каждого 5-го уровня кампании (after=5,10,…) и
  // показывается в списке между N и N+1 как «N½» (не отдельный уровень кампании —
  // прогресс она не двигает, ключ сохранения строковый 'bonus_<id>', как у биомов).
  // Тот же движок «веди от А до Б», но реколор: борты → гусеницы, боксы → цветы,
  // удачный вылет → бабочка (🐛 → 🌸 → 🦋). Правила-сюрпризы: спокойный мир без
  // событий/спецбортов и с увеличенным терпением (level.calm), а каждый вылет —
  // метаморфоза в бабочку с бонус-нектаром (см. depart()).
  const BONUS: Bonus[] = [
    { id:0, after:5,  emoji:'🦋',
      level:{ bonus:'butterfly', calm:1.5, objective:{ metric:'served', stars:[6,7,8] },
        sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
        runways:3 } },
    { id:1, after:10, emoji:'🦋',
      level:{ bonus:'butterfly', calm:1.5, objective:{ metric:'served', stars:[8,10,12] },
        sides:{ top:{type:'fuel',slots:3,open:1}, left:{type:'board',slots:3,open:1}, bottom:{type:'repair',slots:3,open:1} },
        runways:3 } },
  ];
  // Звёзды-градация: единая модель для кампании, биомов и бонусов. Из stars[] выводим
  // target (потолок уровня = 3★) — на него опираются HUD, спавн-кап и пути завершения.
  function normObjective(o: Objective): Objective { if(o && Array.isArray(o.stars) && o.target==null) o.target = o.stars[o.stars.length-1]; return o; }
  LEVELS.forEach(lv=>normObjective(lv.objective));
  BIOMES.forEach(b=>{ if(b.level) normObjective(b.level.objective); });
  BONUS.forEach(b=>{ if(b.level) normObjective(b.level.objective); });

  // ---- ЭКОНОМИКА УРОВНЯ (деньги выводятся из сложности карты и её эффектов) ----
  // Деньги живут ВНУТРИ смены (сбрасываются каждый уровень — переноса нет). Чтобы
  // покупки (открыть/прокачать боксы) ощущались одинаково на ЛЮБОЙ карте — нынешней и
  // будущей — оплату за услугу (svcReward) и стартовую кассу (startMoney) мы НЕ задаём
  // вручную по уровням, а ВЫВОДИМ из конфига уровня. Модель гибкая: смотрит на поток
  // бортов, сложность и какие денежные эффекты (комбо/экспресс) реально включены.
  //
  // Опоры (как в time-management-жанре: Diner Dash и т.п. — база должна окупаться сама,
  // а «цепочки»/комбо — это бонус сверху за мастерство):
  //
  //   (A) «НАБОР» (buy-side) — что игрок должен суметь купить, пройдя смену на 3★:
  //         openable = Σ(slots−open) по сторонам;  working = открытые + round(openable·OPEN_FRAC)
  //         kitCost  = round(openable·OPEN_FRAC)·BAY_OPEN_COST + working·BAY_UP_COST[0]·UP_FRAC
  //
  //   (B) «СЛОЖНОСТЬ» (levelDifficulty 0..~1) — взвешенная сумма сигналов карты: плотность
  //       потока, активные спецборты, таймер/race, среда (погода/де-айс). Чем сложнее карта,
  //       тем ЩЕДРЕЕ деньги (generosity = GEN_BASE + GEN_DIFF·difficulty), потому что хаос
  //       съедает доход штрафами и рвёт серии. GEN_BASE ≥ 1 ⇒ деньги НЕ блокируют 3★.
  //
  //   (C) «СКИЛЛ-ДОБОР» (skillMult) — реалистичный множитель ТОЛЬКО от ВКЛЮЧЁННЫХ на карте
  //       эффектов (levelEffects): комбо (до ×2) и экспресс (×1.5). На ранних/коротких или
  //       тяжёлых картах добор меньше (серия не успевает вырасти / рвётся хаосом), а если
  //       эффект на карте ОТКЛЮЧЁН — его вклад 0. Так «комбо/экспресс вводятся постепенно»:
  //       выключаешь их на первых уровнях — экономика сама поднимает базовую оплату.
  //
  // Сводим: реальный доход competent-игрока должен ровно покрывать набор с запасом —
  //   startMoney + svcReward·avgNSvc·flow·skillMult  =  kitCost·generosity
  // решаем относительно svcReward и зажимаем в [SVC_MIN, SVC_MAX]. Слабый игрок (без
  // серий) получит меньше — «непросто»; чистая игра даёт весь набор с запасом — «честно».

  // комбо/экспресс по умолчанию ВКЛЮЧЕНЫ; уровень может их отключить (combo:false /
  // express:false) — постепенный ввод денежных эффектов. Экономика читает эти же флаги.
  function levelEffects(lv: Level){
    return { combo: !(lv && lv.combo === false), express: !(lv && lv.express === false) };
  }
  // темп уровня (интенсивность) 0..1 — ГЛАВНАЯ ось сложности; задаёт частоту прилёта и
  // одновременность (см. K.PACE_*). Воздушное терпение от него НЕ зависит.
  function levelPace(lv: Level){ const p = lv && lv.pace; return Math.max(0, Math.min(1, p==null ? 0 : p)); }
  // интервал спавна (сек) от темпа: pace 0 → SLOW, pace 1 → FAST; по ходу смены чуть
  // ускоряется (served), но не ниже пола. В час пик база ×0.5 (без пола — короткая волна).
  function paceInterval(pace: number, served?: number, rush?: boolean){
    const base = K.PACE_IVL_SLOW + (K.PACE_IVL_FAST - K.PACE_IVL_SLOW) * pace;
    return rush ? base * 0.5 : Math.max(K.SPAWN_MIN, base - (served||0) * K.SPAWN_DECAY);
  }
  // лимит одновременных бортов в небе от темпа: pace 0 → CAP_LOW, pace 1 → CAP_HIGH.
  function paceCap(pace: number){ return Math.round(K.PACE_CAP_LOW + (K.PACE_CAP_HIGH - K.PACE_CAP_LOW) * pace); }
  // SURVIVAL: темп нарастает со временем заезда от стартового (level.pace, иначе спокойный
  // дефолт) до 1.0 за SURV_RAMP_SECS (или level.survRamp). Чем дольше держишься — тем плотнее
  // поток и больше бортов в небе разом: это и есть растущая «сложность выживания» карты.
  function survivalPace(){
    const start = (LV && LV.pace!=null) ? levelPace(LV) : K.PACE_DEFAULT;
    const ramp  = (LV && LV.survRamp) || K.SURV_RAMP_SECS;
    const k = Math.max(0, Math.min(1, gameTime / ramp));
    return Math.min(1, start + (1 - start) * k);
  }
  // воздушное терпение борта (сек): ФИКС. окно K.AIR_BASE, спецборты урезают множителем;
  // от уровня/темпа НЕ зависит (только спец-тип и calm-бонус спокойного мира).
  function airPatience(flags?: Events, calm?: number){
    const f: Events = flags || {};
    const m = f.emergency ? 0.4 : (f.vip ? 0.5 : (f.medical ? K.MEDICAL_AIR : 1));
    return K.AIR_BASE * m * (calm || 1);
  }
  // вес каждого спецсобытия в сложности (mед/час-пик давят сильнее вип-джета)
  const EVENT_DIFF: Record<string, number> = { vip:0.5, rush:1.0, medical:1.0, emergency:0.8, fog:0.8, wind:0.8 };
  function levelFlow(o: Objective){
    const target = o && o.target!=null ? o.target : (o && Array.isArray(o.stars) ? o.stars[o.stars.length-1] : 1);
    return (o && o.metric==='served' && !o.race) ? Math.max(1, target)
                                                 : Math.max(1, Math.round(((o&&o.time)||180) / K.ECON_FLOW_SECS));
  }
  // множитель сложности уровня 0..~ECON_DIFF_CAP (чистая функция конфига)
  function levelDifficulty(lv: Level){
    const o: Objective = (lv && lv.objective) || ({} as Objective), ev: Events = (lv && lv.events) || {};
    let eventScore = 0; for(const k in EVENT_DIFF) if(ev[k]) eventScore += EVENT_DIFF[k];
    const dens = levelPace(lv);                                   // интенсивность (темп) — главная ось
    const timeScore = o.race ? 1 : (o.time ? 0.5 : 0);            // давление времени
    const envScore = ((lv&&lv.weather)?1:0) + ((lv&&lv.deice)?1:0); // погода/де-айс
    let d = (K.ECON_W_EVENT*eventScore + K.ECON_W_TIME*timeScore
           + K.ECON_W_DENS*dens + K.ECON_W_ENV*envScore) / K.ECON_DIFF_NORM;
    if(lv && lv.calm && lv.calm > 0) d /= lv.calm;                          // спокойный мир (бонус) — легче
    return Math.max(0, Math.min(K.ECON_DIFF_CAP, d));
  }
  // какие услуги запрашивают борты на карте (подмножество SVC_TYPES; умолч. — все три).
  // Урезанный набор — рычаг разнообразия: уровень «только топливо+борт» и т.п.
  function levelServices(lv?: Level){ const L = lv || LV; const s = L && L.services; return (Array.isArray(s) && s.length) ? s : SVC_TYPES; }
  // глубина апгрейда на уровне: одна на всех ангаров, в [0, BAY_MAX_LVL] (умолч. потолок).
  // 0 — апгрейдов нет; per-hangar up:false выключает апгрейд только своего ангара.
  function levelMaxUp(lv?: Level){ const L = lv || LV; const m = L && L.maxUp; const v = (m==null) ? K.BAY_MAX_LVL : m; return Math.max(0, Math.min(K.BAY_MAX_LVL, v)); }
  // перевод старой раскладки sides → формат конструктора (layout). Повторяет геометрию
  // packRow: плоский список слотов сторон чередуется верх/низ-ряд, ряды раскладываются по
  // ширине апрона; ВПП — по числу lv.runways, равномерно по вертикали. Нужен редактору,
  // чтобы открыть существующий уровень кампании. Услуги/maxUp — дефолтные (legacy: все три,
  // потолок прокачки). Чистая функция (без DOM) — её же удобно тестировать.
  function sidesToLayout(lv: Level){
    const sides: Record<string, SideCfg | undefined> = (lv && lv.sides) || {};
    const flat: { type: string; open: boolean }[] = [];
    for(const s of ['top','left','bottom']){ const c = sides[s]; if(!c) continue; for(let i=0;i<c.slots;i++) flat.push({type:c.type, open:i<c.open}); }
    const rows: { type: string; open: boolean }[][] = [[], []];   // 0 — верхний ряд, 1 — нижний (чередуем, как packRow)
    flat.forEach((b,i)=> rows[i%2].push(b));
    const hangars: any[] = [];
    ([[rows[0],0.10],[rows[1],0.90]] as [{type:string;open:boolean}[], number][]).forEach(([arr,y])=>{
      const n = arr.length; arr.forEach((b,k)=> hangars.push({ type:b.type, x:+(((k+0.5)/n)).toFixed(2), y, open:b.open, up:true }));
    });
    const nR = Math.max(1, (lv && lv.runways) || 1);
    const runways: any[] = []; for(let i=0;i<nR;i++) runways.push({ y:+((nR===1?0.5:0.15+0.7*i/(nR-1))).toFixed(2) });
    return { services: SVC_TYPES.slice(), maxUp: (lv && lv.maxUp!=null) ? lv.maxUp : K.BAY_MAX_LVL, layout:{ hangars, runways } };
  }
  // уровень → объект для конструктора: явный layout отдаём как есть, иначе конвертируем из sides.
  function levelToEditorObj(lv: Level){
    if(lv && lv.layout) return { services: ((lv.services as string[]) || SVC_TYPES).slice(), maxUp: (lv.maxUp!=null) ? lv.maxUp : K.BAY_MAX_LVL, layout: lv.layout };
    return sidesToLayout(lv);
  }
  function levelEconomy(lv: Level){
    const o: Objective = (lv && lv.objective) || ({} as Objective);
    // «набор» считается из РАССТАНОВКИ: layout (один ангар = одно место) или старые sides
    // (слоты). open0 — открыто на старте, openable — докупаемо; upgShare — доля рабочих
    // мест, которые вообще апгрейдятся (up!==false).
    // Per-hangar цены: openCost/upgCost на ангаре замещают глобальные K.BAY_OPEN/UP_COST;
    // закрытые направления ВПП (landingOpen/takeoffOpen) добавляются к kit отдельно.
    let open0 = 0, openable = 0, upgShare = 1;
    let openCostAvg = K.BAY_OPEN_COST;    // средняя цена открытия закрытых ангаров
    let upgCostBase  = K.BAY_UP_COST[0];  // средняя цена 1-го апгрейда
    let rwDirKitCost = 0;                 // сумма стоимости закрытых направлений ВПП
    if(lv && lv.layout && lv.layout.hangars){
      const hs = lv.layout.hangars;
      let openCostSum = 0;
      for(const h of hs){
        if(h.open===false){ openable++; openCostSum += h.openCost ?? K.BAY_OPEN_COST; }
        else open0++;
      }
      if(openable > 0) openCostAvg = openCostSum / openable;
      const upg = hs.filter(h=>h.up!==false);
      upgShare = hs.length ? upg.length / hs.length : 0;
      if(upg.length > 0) upgCostBase = upg.reduce((s,h)=>s+(h.upgCost??K.BAY_UP_COST[0]),0) / upg.length;
      // направления ВПП: все закрытые ожидаются к покупке (стоимость ≥0)
      if(lv.layout.runways){
        for(const rd of lv.layout.runways){
          if(rd.landingOpen===false) rwDirKitCost += rd.landingCost ?? 0;
          if(rd.takeoffOpen===false) rwDirKitCost += rd.takeoffCost ?? 0;
        }
      }
    } else {
      const sides: Record<string, SideCfg | undefined> = (lv && lv.sides) || {};
      for(const s of ['top','left','bottom']){
        const c = sides[s]; if(!c) continue;
        open0 += c.open; openable += Math.max(0, c.slots - c.open);
      }
    }
    const startMoney = (lv && lv.startMoney) || K.START_MONEY;
    // 2 услуги на борт возможны только если в игре ≥2 типов услуг
    const avgNSvc = 1 + (levelServices(lv).length >= 2 ? K.TWO_SVC_CHANCE : 0);
    const flow = levelFlow(o);
    // (A) набор, который смена должна профинансировать. Апгрейд-часть учитывает потолок
    // уровня (maxUp:0 → апгрейдов нет) и долю апгрейдируемых мест (upgShare).
    const expectOpen  = Math.round(openable * K.ECON_OPEN_FRAC);
    const workingBays = open0 + expectOpen;
    const upgCost = levelMaxUp(lv) > 0 ? workingBays * upgShare * upgCostBase * K.ECON_UP_FRAC : 0;
    const kitCost = expectOpen * openCostAvg + upgCost + rwDirKitCost;
    // (B) сложность → щедрость
    const difficulty = levelDifficulty(lv);
    const generosity = K.ECON_GEN_BASE + K.ECON_GEN_DIFF * difficulty;
    // (C) реалистичный скилл-добор от включённых эффектов
    const fx = levelEffects(lv);
    const comboReach   = Math.min(flow, K.COMBO_MAX) / K.COMBO_MAX;
    const comboHead    = fx.combo   ? (K.COMBO_STEP*K.COMBO_MAX) * comboReach * (1 - K.ECON_CHAOS*difficulty) * K.ECON_COMBO_REAL : 0;
    const expressHead  = fx.express ? (K.EXPRESS_BONUS - 1) * K.ECON_EXPRESS_SHARE * (1 - K.ECON_CHAOS*difficulty) : 0;
    const skillMult    = 1 + Math.max(0, comboHead) + Math.max(0, expressHead);
    // сводим и решаем относительно оплаты за услугу
    const need = Math.max(0, kitCost * generosity - startMoney);
    const svcReward = Math.max(K.SVC_MIN, Math.min(K.SVC_MAX,
      Math.round(need / (avgNSvc * flow * skillMult))));
    return { startMoney, svcReward, flow, kitCost, openable, difficulty, generosity, skillMult, effects:fx };
  }

  let LV: Level = LEVELS[0], curBiome: Biome | null = null, curBonus: Bonus | null = null;
  let econ = levelEconomy(LV);          // {startMoney, svcReward, …} — пересчитывается в reset()
  let lvFx = levelEffects(LV);          // какие денежные эффекты включены на текущей карте
  // бонус после прохождения уровня №levelNum (1-based); открыт, если тот пройден на ≥1★
  // (или включён отладочный тумблер «Открыть все уровни» — как у кампании, см. renderLevels)
  function bonusAfter(levelNum: number){ return BONUS.find(b=>b.after===levelNum) || null; }
  function bonusUnlocked(b: Bonus){ return debug.unlockAll || (save.stars[b.after-1]||0) >= 1; }
  function bonusName(b: Bonus){
    const key = 'bonus.t.'+b.id;
    const has = (I18N[lang] && I18N[lang][key]!=null) || (I18N[DEFAULT_LANG] && I18N[DEFAULT_LANG][key]!=null);
    return has ? t(key) : t('bonus.name', {n:b.after});
  }
  function objectiveDesc(){
    const o = LV.objective;
    const params = {n: o.target ?? 0, time: o.time ? fmtTime(o.time) : ''};
    if(LV.bonus) return t('bonus.obj', params);   // «выпусти N гусениц бабочками»
    if(o.race) return t('obj.race', params);      // «прими сколько успеешь за {time}»
    if(o.metric==='upgrades') return t('obj.upgrades', params);
    return o.time ? t('obj.servedTimed', params) : t('obj.served', params);
  }
  // какие события активны на текущем уровне. Кампания — по конфигу уровня
  // (LV.events). Биом-карты (Survival) — все спецборты включены, а динамические события
  // для них настраиваются отдельно в reset() (у леса — свои помехи вместо ветра/тумана).
  function levelEvents(){
    return LV.biome ? { vip:true, emergency:true, medical:true, rush:false, fog:false, wind:false }
                    : (LV.events || {});
  }
  // имя уровня кампании: t('level.t.<n>') если задано, иначе общий «Уровень N»
  function levelName(idx?: number){
    const i = (idx==null ? levelIdx : idx), key = 'level.t.'+(i+1);
    const has = (I18N[lang] && I18N[lang][key]!=null) || (I18N[DEFAULT_LANG] && I18N[DEFAULT_LANG][key]!=null);
    return has ? t(key) : t('level.name', {n:i+1});
  }

  // ---- самопроверка конфига (страховка под новые механики) ----
  // Цель ровно та, для которой и заводили тесты: при добавлении уровня / события /
  // механики сразу ловить нарушение старых правил, а не ловить регрессию в проде.
  // validateGame() возвращает список проблем (пустой = всё ок). Зовётся мягко на
  // старте (console.error) и жёстко из тестов. См. docs/DEV.md, раздел «Тесты».
  const EVENT_KEYS = ['vip','emergency','medical','rush','fog','wind'];
  const WEATHER_KINDS = ['clear','rain','snow'];
  // «часы» суток: фаза 0..1 (0 — полдень) и «ночность» 0..1 (1 — глубокая ночь).
  // Чистая функция времени: визуал берёт night, на саму игру это не влияет.
  function dayCycle(time: number){
    const P = K.DAYNIGHT_PERIOD;
    const phase = ((time % P) + P) % P / P;             // 0..1, устойчиво к time<0
    const night = (1 - Math.cos(phase * 2 * Math.PI)) / 2;  // плавно 0→1→0
    return { phase, night };
  }
  // множитель скорости руления по погоде: ясно=1, дождь/снег — медленнее (снег хуже)
  function weatherTaxiMult(w: string){
    return w==='snow' ? K.WEATHER_SNOW_TAXI : w==='rain' ? K.WEATHER_RAIN_TAXI : 1;
  }
  // L1–L4 — спокойный блок (чистые механики, низкий темп). Спецсобытия вводятся только с L5.
  const CALM_LEVELS = 4;
