// ===== 04-config-levels — tuning constants, level/biome/bonus definitions & level math =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: K, LEVELS (L1–L11 рукописные; L12+ достраивает сборщик в 14-level-analysis из CAMPAIGN_LAYOUTS/CAMPAIGN_PLAN), BIOMES, BONUS, LV, levelEconomy, levelEffects, levelEvents, levelPace/paceInterval/paceCap, airPatience, dayCycle, objectiveDesc, EVENT_KEYS, SVC_TYPES, WEATHER_KINDS, curBiome, curBonus.
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
  // Прямоугольник в нормированных 0..1 координатах ЭКРАНА (не апрона).
  interface ZoneRect { x: number; y: number; w: number; h: number; }
  // apron — границы зоны руления (умолч. вычисляется движком ~63% ширины);
  // zones.arrival/waiting — зоны прилёта/ожидания бортов. Их пишет визуальный
  // редактор разметки (tuning.html → таб «Разметка»); движок пока их игнорирует
  // (геометрия апрона процедурная) — поля задают замысел до доработки рендера.
  // Пер-левел оверрайды вида (опциональны): runwayRatio/runwayR замещают глобальные
  // K.RUNWAY_RATIO/K.RUNWAY_R только для этого уровня; fitRunways — раскладывать ВПП
  // равномерно ВНУТРИ апрона с учётом их ширины (нижняя не вылезает на любом экране);
  // noHud — скрыть HUD и не резервировать место сверху (для кастомных композиций).
  interface LevelLayout { hangars: HangarDef[]; runways: RunwayDef[]; apron?: ZoneRect; zones?: { arrival?: ZoneRect; waiting?: ZoneRect }; runwayRatio?: number; runwayR?: number; fitRunways?: boolean; noHud?: boolean; }
  interface Events { vip?: boolean; emergency?: boolean; medical?: boolean; rush?: boolean; fog?: boolean; wind?: boolean; [k: string]: boolean | undefined; }
  // Цель уровня + градация звёзд. stars=[1★,2★,3★] — пороги по ОСНОВНОЙ метрике
  // (served: бортов · upgrades: апгрейдов · survival: секунд продержаться). Ниже —
  // ОПЦИОНАЛЬНЫЕ доп-условия (каждое пер-тир, длиной 3, выровнено на [1★,2★,3★]).
  // Тир засчитывается, если выполнены ВСЕ заданные условия этого тира (AND). Условия
  // ≥ (money/lives/upg) идут по возрастанию, ≤ (timeTier/maxLate/maxCrash) — по убыванию.
  // Подробный разбор и происхождение из референса — docs/design/game-design/star-conditions.md.
  interface Objective {
    metric: 'served' | 'upgrades' | 'survival';
    stars: number[]; target?: number; time?: number; race?: boolean;
    upg?: number[];       // ≥ апгрейдов (только с metric:'served')
    money?: number[];     // ≥ касса к концу смены
    lives?: number[];     // ≥ осталось жизней
    timeTier?: number[];  // ≤ уложиться за столько секунд (быстрее = выше ★)
    maxLate?: number[];   // ≤ наземных просрочек
    maxCrash?: number[];  // ≤ крушений
  }
  interface Level {
    pace?: number; objective: Objective;
    // геометрия — ЛИБО явный layout (конструктор), ЛИБО старые sides+runways (слоты,
    // авто-раскладка в две ангары). Движок читает layout, если он задан, иначе sides.
    layout?: LevelLayout; runways?: number;
    sides?: { top?: SideCfg; left?: SideCfg; bottom?: SideCfg };
    services?: string[];   // какие услуги запрашивают борты (подмножество SVC_TYPES; умолч. все)
    maxUp?: number;        // глубина апгрейда на уровне 0..BAY_MAX_LVL (умолч. потолок); 0 — без апгрейдов
    minUp?: number;        // нижняя граница «вилки» апгрейда 0..maxUp (экон-ручка: считается набор от minUp до maxUp)
    events?: Events; startMoney?: number;
    crashPenalty?: number; // 0..1 — доля вознаграждения борта, списывается с кассы при крэше
    latePenalty?: number;  // 0..1 — доля вознаграждения при истечении наземного терпения (умолч. 0.5)
    biome?: string; bonus?: string; weather?: boolean; deice?: boolean;
    calm?: number; survRamp?: number; combo?: boolean; express?: boolean;
    // фазовые множители скорости на ВПП (× к базовой; умолч. 1 = как сейчас).
    // Задаются в конструкторе (tuning.html), зашиваются в экспорт уровня и
    // применяются движением посадки/взлёта (см. 08b-gameplay-step).
    motion?: { landBefore?: number; landAfter?: number; takeoffRoll?: number; climb?: number };
    // авто-генератор (см. 14-level-analysis): target — точечный override кривой сложности
    // (0..1, иначе берётся campaignTarget(index)); archetype — акцент факторов уровня.
    target?: number; archetype?: string;
  }
  interface Biome { id: string; emoji: string; ready: boolean; level?: Level; }
  interface Bonus { id: number; after: number; emoji: string; level: Level; }
  const K = {
    TURN: 0.5,            // rad/sec поворот в полёте
    // Точка опоры борта на нарисованном маршруте. По линии всегда идёт НОС, но КУРС
    // борт держит не по мгновенной касательной у носа (тогда корпус «крутят за нос» —
    // как игрушку), а по жёсткому стержню нос→хвост: хвост волочится за носом, точка
    // без бокового скольжения уезжает к основным стойкам шасси (под крылья), как у
    // настоящего самолёта на рулении. Длина стержня = длина борта × STEER_TRAIL.
    // 1.0 — опора у хвоста, максимально плавный доворот; меньше — опора ближе к носу,
    // острее реакция. 0 отключает модель (курс по касательной у носа, как было).
    STEER_TRAIL: 0.45,
    SPEED_AIR: 55,        // скорость захода на посадку
    SPEED_TAXI: 56,       // скорость руления по земле
    SPEED_TAKEOFF: 143,   // максимальная скорость разбега по ВПП
    TAKEOFF_INIT_SPEED: 0,   // начальная скорость перед разбегом (px/s; 0 = с места)
    TAKEOFF_ACCEL: 110,      // ускорение при разбеге (px/s²)
    SPEED_CLIMB: 217,        // максимальная скорость в наборе высоты после отрыва (px/s)
    TAKEOFF_CLIMB_ACCEL: 130,// ускорение после отрыва от земли (px/s²)
    LAND_ROLLOUT_DECEL: 0,   // замедление при пробеге после касания (px/s²)
    // визуальная «перспектива»: в небе борт ближе к наблюдателю — крупнее, на земле
    // мельче. На ВПП масштаб плавно меняется по ходу полосы (посадка ужимает, взлёт
    // раздувает). Чисто визуально — на столкновения/хваты не влияет.
    PLANE_SKY_SCALE: 1.75,// масштаб борта в небе
    PLANE_GND_SCALE: 1.35,// масштаб на земле/поле
    // ── тень борта в воздухе (солнце в правом верхнем углу) ──────────────────────
    // Видна только пока борт в воздухе: высоту берём из визуального масштаба (небо→земля),
    // поэтому на посадке/взлёте тень плавно съезжается к борту и пропадает на касании.
    // На земле борта тени нет (игра — условный вид сверху). Чисто визуально.
    PLANE_SHADOW_OFFSET: 40, // смещение тени от борта на максимальной высоте (px·ui), к низу-влево
    PLANE_SHADOW_ALPHA: 0.62,// базовая непрозрачность тени
    // ── размер техники: борт задаёт размер ВПП и ангара на ВСЕХ картах ──────────
    // PLANE_SCALE — общий масштаб «крупности» борта (×1). Длина борта = 31·SZ·ui;
    // из неё через коэффициенты ниже выводятся ширина ВПП и сторона квадратного
    // ангара, поэтому изменение PLANE_SCALE автоматически масштабирует полосы и
    // ангары на всех уровнях (геометрия общая, число — один масштаб).
    // Масштаб-кит подобран «от борта» (борт — единица масштаба): на десктопе (ui=1.5)
    // борт ≈77px ∈ норма 55–80; на телефоне ui упирается в пол 0.7, поэтому борт чуть
    // крупнее для читаемости («лучше чуть крупнее и проще»). Ангар/ВПП выводятся из борта
    // коэффициентами ниже и попадают в дизайн-нормы (ангар 2.5–4× борт; ВПП ≈размах+запас).
    PLANE_SCALE: 1.22,    // общий масштаб борта (крупность техники)
    RUNWAY_RATIO: 1.6,    // ширина ВПП / длина борта (≈ размах + запас); десктоп ВПП ≈91px ∈ норма 90–150
    RUNWAY_R: 0.83,       // правый (небесный) край ВПП, доля ширины экрана; длина ≈(RUNWAY_R−0.63)×W
    HANGAR_RATIO: 2.5,    // сторона квадратного ангара / длина борта (дизайн-норма: ангар 2.5–4× борт)
    // после отрыва борт дорастает с наземного до небесного масштаба на этой дистанции
    // ЗА торцом ВПП (px·ui). Пока он катится по полосе — остаётся наземным (маленьким).
    TAKEOFF_LIFT_DIST: 330,
    LAND_BUMP_MS: 330,    // длительность визуального «толчка» при касании, мс
    APPROACH_SPEED_MULT: 1.0,  // скорость финального захода = SPEED_AIR × это
    LAND_ALIGN_SPEED: 17,       // lerp-скорость довыравнивания по оси ВПП
    LAND_BUMP_AMP: 2,          // амплитуда толчка при касании, ui-единиц
    TAKEOFF_OVERSHOOT: 540,    // цель разгона: exitX + это (px за краем экрана)
    // пробег после посадки: севший борт скатывается с ВПП вглубь апрона и встаёт
    // перед входом — на столько px·ui левее кромки апрона (field.x1).
    LAND_ROLLOUT: 50,
    // (бывш. TAKEOFF_HOLD удалён — борт больше не замирает на старте; см. 08b взлёт)
    DISABLE_VIP:       false as boolean,  // отключить VIP-борты (для отладки скорости)
    DISABLE_EMERGENCY: false as boolean,  // отключить аварийные борты
    DISABLE_MEDICAL:   false as boolean,  // отключить медицинские борты
    DISABLE_RUSH:      false as boolean,  // отключить часы пик
    DISABLE_WEATHER:   false as boolean,  // отключить погодные условия
    DISABLE_SLOWMO:    false as boolean,  // отключить slowmo при near-miss
    DISABLE_FOREST:    false as boolean,  // отключить лесные помехи (елки, птицы, олени, снег)
    DISABLE_DEICE:     false as boolean,  // не добавлять деайсинг в список услуг
    DISABLE_BAY:       false as boolean,  // пропустить все услуги в боксах → сразу к вылету
    APRON_SPAWN:       false as boolean, // демо: у левого края апрона всегда стоит готовый к взлёту борт (replaces when taken/crashed)
    BAY_DOCK_SPEED:  0.85, // скорость движения в боксе (доля от SPEED_TAXI)
    BAY_ALIGN_SPEED: 6,    // lerp-скорость бокового выравнивания по оси ворот
    BAY_HEAD_SPEED:  2,    // скорость поворота носа при заезде/выезде из бокса
    // ── настраиваемые точки ВПП и ангара (Motion Tuning; px·ui вдоль оси, 0 = штатное
    //    поведение). Перетаскиваются на превью в tuning.html (слой «Точки ВПП/ангара»). ──
    RW_TOUCHDOWN_OFF:  50, // сдвиг точки касания вдоль ВПП от штатной (stopX+корпус). + = дальше в небо (касание раньше/дальше от апрона)
    RW_LIFTOFF_OFF:   -83, // сдвиг точки отрыва на взлёте от торца ВПП (exitX). + = отрыв дальше в небо (позже)
    RW_ALIGN_OFF:        24, // сдвиг точки начала выравнивания по оси ВПП от небесного торца (rwR). + = выравнивание раньше (дальше в небо)
    TAKEOFF_ALIGN_OFF:   30, // сдвиг точки начала выравнивания по оси ВПП от апронного торца. + = выравнивание начинается дальше от ВПП (раньше, в апроне)
    BAY_APPROACH_DIST: 0,  // дистанция точки подъезда к ангару от ворот наружу (px·ui): борт доезжает до неё, центрируется по оси и заезжает. 0 = заезд сразу
    ARRIVE: 2,
    // Базовый «захват» ПРОМЕЖУТОЧНОЙ точки нарисованного маршрута (px·ui). На плавных
    // дугах борт идёт почти вплотную к линии (раньше захват turnR·0.6 ≈ 45–67 px съедал
    // по 4–5 узлов и борт заметно срезал даже пологие круги). На крутых изломах (круче
    // радиуса разворота) захват в followPath адаптивно растёт — борт плавно срезает дугу
    // заранее, без заноса наружу. Конечная точка и авто-маршрут по-прежнему доезжают вплотную (ARRIVE).
    PATH_CAPTURE: 20,
    GRAB: 55,    // 55px ≈ 10 мм — надёжный захват пальцем; мышью 37 хватало, но тач требует больше
    CRASH_DIST: 21,       // столкновение на поле
    NEAR_DIST: 24,        // «едва разошлись»: ближе — near-miss «уфф» (но не краш)
    NEAR_COOL: 1.1,       // антидребезг near-miss на одну пару бортов, сек
    SLOWMO_DUR: 0,        // лёгкое замедление времени при near-miss, сек
    SLOWMO_SCALE: 0.1,    // во сколько раз замедляется время в этот миг
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
    START_MONEY: 0,
    BAY_OPEN_COST: 100,
    BAY_UP_COST: [80,160,320,640,1280], // апгрейд до ур.1/2/3/4/5 (глобальный потолок BAY_MAX_LVL)
    BAY_MAX_LVL: 5,                    // абсолютный потолок прокачки; per-level maxUp может срезать ниже
    RUNWAY_MAX: 4,                  // потолок числа ВПП на карте (layout): мин. 1, макс. 4
    UP_SPEED: 0.25,       // +25% скорости за уровень
    // кривая сложности кампании (см. campaignTarget в 14-level-analysis): обучение →
    // подъём → насыщающееся плато < 1.0; капстоны каждый capstoneEvery-й уровень на ~1.0.
    // Расширение кампании = больше уровней на том же плато (raw-сложность не растёт выше).
    CURVE: { tutorialLen: 10, rampEnd: 30, plateauHeight: 0.9, capstoneEvery: 10 },
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
    FOG_TAXI: 0.1,                    // множитель скорости руления в тумане
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
    WEATHER_RAIN_TAXI: 0.1,           // множитель скорости руления под дождём
    WEATHER_SNOW_TAXI: 0.09,          // множитель скорости руления под снегом (хуже дождя)
    // разделение кампании: L1..TUTORIAL_COUNT — рукописные туториалы (монотонный pace);
    // дальше pace живёт по кривой campaignTarget (L11 — рукописный тест штрафов,
    // L12–L50 собираются из скелетов CAMPAIGN_PLAN, см. сборщик в 14-level-analysis)
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

  // ---- арктический биом: обледенение ВПП и деайсинг-бригады ----
  // Полоса периодически покрывается льдом → закрывается до приезда деайсинг-грузовика.
  // Де-айсинг обязателен для КАЖДОГО борта перед вылетом (не только в снегопад).
  const ARC = {
    SPAWN_FIRST: 12,
    SPAWN_MIN: 15, SPAWN_MAX: 26,
    CREW_SPEED: 230,       // медленнее из-за мороза
    WORK_TIME: 2.5,        // разморозка занимает дольше
    REWARD: 15,
  };

  // ---- тропический биом: штормовые волны на ВПП ----
  // Волна периодически захлёстывает полосу → закрывается; уходит сама через WAVE_LIFE сек
  // либо насосная бригада откачивает воду быстрее.
  const TROP = {
    SPAWN_FIRST: 10,
    SPAWN_MIN: 12, SPAWN_MAX: 22,
    WAVE_LIFE: 10,         // волна уходит сама — можно подождать или выслать насосы
    CREW_SPEED: 255,
    WORK_TIME: 1.8,
    REWARD: 13,
  };

  // ---- пустынный биом: песчаные бури на ВПП ----
  // Песчаная буря засыпает полосу → закрыта до прибытия пескоочистителя (не уходит сама).
  const DSRT = {
    SPAWN_FIRST: 11,
    SPAWN_MIN: 14, SPAWN_MAX: 24,
    CREW_SPEED: 240,
    WORK_TIME: 2.2,
    REWARD: 14,
  };

  // ---- горный биом: камнепады на ВПП ----
  // Камни с горы перекрывают полосу → нужен бульдозер. Медленная бригада — горный рельеф.
  const MNTN = {
    SPAWN_FIRST: 14,
    SPAWN_MIN: 18, SPAWN_MAX: 32,
    CREW_SPEED: 210,       // медленнее — горный рельеф
    WORK_TIME: 3.2,        // тяжёлые камни убирать дольше
    REWARD: 16,
  };

  // ---- биом мегаполиса: VIP-кортежи на ВПП ----
  // Кортеж перекрывает полосу; рассасывается сам через MOTORCADE_LIFE сек или
  // игрок высылает полицейский эскорт для быстрого разгона.
  const CITY = {
    SPAWN_FIRST: 8,
    SPAWN_MIN: 10, SPAWN_MAX: 20,
    MOTORCADE_LIFE: 12,    // кортеж рассасывается сам, если не реагировать
    CREW_SPEED: 300,       // полиция реагирует быстро
    WORK_TIME: 1.2,
    REWARD: 11,
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
  // ── ГЕНЕРИРУЕМАЯ КАМПАНИЯ (L12–L50): скелеты уровней ──────────────────────
  // Рукописная часть каждого уровня — РАСКЛАДКА и СОБЫТИЯ (autoDifficulty их принципиально
  // не генерирует — это ручки оператора). Остальное (pace, пороги звёзд, доп-условия
  // тиров, цены, штрафы) детерминированно выводится кривой campaignTarget(n) + ротацией
  // акцентов archetypeForIndex(n) в сборщике в конце 14-level-analysis.ts (там объявлен
  // ARCHETYPES — отсюда его звать нельзя, TDZ). Методичка — difficulty_curve.md;
  // события кластерами «введение → консолидация», капстоуны L20/30/40/50 — все четыре.
  //
  // Фабрики раскладок (каждый уровень получает СВОЮ копию — сборщик штампует цены
  // per-объект). Координаты как в конструкторе: hangar.x/y — доля апрона, runway.y — 0..1.
  // Инварианты: есть ангар каждой услуги; открыт хотя бы один каждого типа; ≥1 открытая
  // посадка и ≥1 открытый взлёт (validateLevels).
  //
  // ГЕОМЕТРИЯ ПРОВЕРЕНА против движка (06-state-layout: ворота по ближайшей кромке,
  // ВПП идут от правой кромки апрона): ряды — y 0.04/0.96 при x∈{0.15,0.50,0.85} (на
  // портрете ближайшая кромка остаётся верх/низ); левая колонна — x 0.02 (слева от
  // апрона, зона ВПП недостижима); правые ангары (x 0.98) — ТОЛЬКО в просветах между
  // полосами и не больше 1–2 на карту (на десктопе они задевают полосы так же, как
  // правый ангар рукописного L11 — принятая база, на телефоне чисто).
  const CAMPAIGN_LAYOUTS: Record<string, () => LevelLayout> = {
    // самый щадящий: 6 ангаров (4 открыто), 2 полностью открытые ВПП
    compact6: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.04, open:true  },
        { type:'board',  x:0.50, y:0.04, open:true  },
        { type:'repair', x:0.85, y:0.04, open:true  },
        { type:'fuel',   x:0.15, y:0.96, open:true  },
        { type:'board',  x:0.50, y:0.96, open:false },
        { type:'repair', x:0.85, y:0.96, open:false },
      ],
      runways:[ { y:0.35 }, { y:0.65 } ],
    }),
    // по мотивам L11: 2 ВПП (нижний взлёт куплен отдельно), докупка по бокам
    twinstrip: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.04, open:true  },
        { type:'board',  x:0.85, y:0.04, open:true  },
        { type:'repair', x:0.15, y:0.96, open:true  },
        { type:'fuel',   x:0.50, y:0.96, open:false },
        { type:'board',  x:0.98, y:0.50, open:false },  // просвет между ВПП 0.35/0.65
        { type:'repair', x:0.02, y:0.50, open:false },
      ],
      runways:[ { y:0.35 }, { y:0.65, takeoffOpen:false } ],
    }),
    // классика: 9 ангаров — два ряда + левая колонна, 3 открытые ВПП
    classic9: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.04, open:true  },
        { type:'board',  x:0.50, y:0.04, open:true  },
        { type:'repair', x:0.85, y:0.04, open:true  },
        { type:'repair', x:0.15, y:0.96, open:false },
        { type:'fuel',   x:0.50, y:0.96, open:false },
        { type:'board',  x:0.85, y:0.96, open:false },
        { type:'fuel',   x:0.02, y:0.20, open:false },
        { type:'board',  x:0.02, y:0.50, open:false },
        { type:'repair', x:0.02, y:0.80, open:false },
      ],
      runways:[ { y:0.25 }, { y:0.50 }, { y:0.75 } ],
    }),
    // «угловой апрон»: все службы снизу и справа, верх — чистое небо; 2 ВПП
    corner: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.96, open:true  },
        { type:'board',  x:0.50, y:0.96, open:true  },
        { type:'repair', x:0.85, y:0.96, open:true  },
        { type:'fuel',   x:0.98, y:0.34, open:false },  // просвет между ВПП 0.20/0.48
        { type:'repair', x:0.98, y:0.88, open:false },  // ниже нижней полосы
        { type:'board',  x:0.02, y:0.50, open:false },
      ],
      runways:[ { y:0.20 }, { y:0.48 } ],
    }),
    // большой хаб: 11 ангаров (4 открыто), 3 ВПП, посадка средней докупается
    hub: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.04, open:true  },
        { type:'board',  x:0.50, y:0.04, open:true  },
        { type:'repair', x:0.85, y:0.04, open:true  },
        { type:'fuel',   x:0.15, y:0.96, open:true  },
        { type:'board',  x:0.50, y:0.96, open:false },
        { type:'repair', x:0.85, y:0.96, open:false },
        { type:'board',  x:0.02, y:0.14, open:false },
        { type:'fuel',   x:0.02, y:0.42, open:false },
        { type:'repair', x:0.02, y:0.66, open:false },
        { type:'board',  x:0.02, y:0.95, open:false },
        { type:'repair', x:0.98, y:0.36, open:false }, // просвет между ВПП 0.22/0.50
      ],
      runways:[ { y:0.22 }, { y:0.50, landingOpen:false }, { y:0.78 } ],
    }),
    // максимум полос: 4 ВПП (крайние направления докупаются), 8 ангаров
    quadway: () => ({
      hangars:[
        { type:'fuel',   x:0.15, y:0.04, open:true  },
        { type:'board',  x:0.50, y:0.04, open:true  },
        { type:'repair', x:0.85, y:0.04, open:true  },
        { type:'repair', x:0.15, y:0.96, open:false },
        { type:'fuel',   x:0.50, y:0.96, open:false },
        { type:'board',  x:0.85, y:0.96, open:false },
        { type:'fuel',   x:0.02, y:0.30, open:false },
        { type:'board',  x:0.02, y:0.70, open:false },
      ],
      runways:[ { y:0.14, landingOpen:false }, { y:0.38 }, { y:0.62 }, { y:0.86, takeoffOpen:false } ],
      fitRunways:true,
    }),
  };
  // План L12–L50 (порядок = номер уровня). lay — ключ CAMPAIGN_LAYOUTS; events — ручной
  // ввод оператора; target/archetype опциональны (иначе кривая + ротация по номеру).
  interface CampaignSpec { lay: string; events: Events; target?: number; archetype?: string; }
  const CAMPAIGN_PLAN: CampaignSpec[] = [
    // ── блок A (L12–L19): знакомые спецборты по одному-по два на НОВЫХ раскладках ──
    { lay:'compact6',  events:{ vip:true } },                                    // L12
    { lay:'twinstrip', events:{ emergency:true } },                              // L13
    { lay:'classic9',  events:{ vip:true, emergency:true } },                    // L14 консолидация
    { lay:'compact6',  events:{ rush:true } },                                   // L15
    { lay:'corner',    events:{ vip:true, rush:true } },                         // L16
    { lay:'twinstrip', events:{ medical:true } },                                // L17
    { lay:'classic9',  events:{ vip:true, medical:true } },                      // L18
    { lay:'hub'   ,     events:{ emergency:true, rush:true } },                   // L19
    { lay:'classic9',  events:{ vip:true, emergency:true, rush:true, medical:true } }, // L20 КАПСТОУН
    // ── блок B (L21–L29): пары → тройки, растущая ёмкость карт ──
    { lay:'corner',    events:{ vip:true, medical:true } },                      // L21
    { lay:'quadway',   events:{ emergency:true, rush:true } },                   // L22
    { lay:'twinstrip', events:{ vip:true, emergency:true } },                    // L23
    { lay:'classic9',  events:{ rush:true, medical:true } },                     // L24
    { lay:'compact6',  events:{ vip:true, rush:true } },                         // L25
    { lay:'hub'   ,     events:{ emergency:true, medical:true } },                // L26
    { lay:'quadway',   events:{ vip:true, emergency:true, rush:true } },         // L27
    { lay:'corner',    events:{ vip:true, rush:true, medical:true } },           // L28
    { lay:'classic9',  events:{ emergency:true, rush:true, medical:true } },     // L29
    { lay:'quadway',   events:{ vip:true, emergency:true, rush:true, medical:true } }, // L30 КАПСТОУН
    // ── блок C (L31–L39): плато — ротация пар и троек ──
    { lay:'twinstrip', events:{ vip:true, emergency:true } },                    // L31
    { lay:'corner',    events:{ rush:true, medical:true } },                     // L32
    { lay:'hub'   ,     events:{ vip:true, emergency:true, medical:true } },      // L33
    { lay:'classic9',  events:{ vip:true, rush:true, medical:true } },           // L34
    { lay:'quadway',   events:{ emergency:true, rush:true, medical:true } },     // L35
    { lay:'compact6',  events:{ vip:true, emergency:true } },                    // L36
    { lay:'hub'   ,     events:{ vip:true, emergency:true, rush:true } },         // L37
    { lay:'twinstrip', events:{ rush:true, medical:true } },                     // L38
    { lay:'quadway',   events:{ vip:true, emergency:true, medical:true } },      // L39
    { lay:'hub'   ,     events:{ vip:true, emergency:true, rush:true, medical:true } }, // L40 КАПСТОУН
    // ── блок D (L41–L49): плато — финальная ротация перед экзаменом ──
    { lay:'compact6',  events:{ vip:true, rush:true } },                         // L41
    { lay:'classic9',  events:{ emergency:true, medical:true } },                // L42
    { lay:'corner',    events:{ vip:true, emergency:true, rush:true } },         // L43
    { lay:'quadway',   events:{ emergency:true, rush:true, medical:true } },     // L44
    { lay:'twinstrip', events:{ vip:true, medical:true } },                      // L45
    { lay:'hub'   ,     events:{ vip:true, rush:true, medical:true } },           // L46
    { lay:'classic9',  events:{ vip:true, emergency:true, rush:true } },         // L47
    { lay:'corner',    events:{ emergency:true, rush:true, medical:true } },     // L48
    { lay:'quadway',   events:{ vip:true, emergency:true, medical:true } },      // L49
    // финальный экзамен: самый большой хаб на максимальном target (переопределяет кривую)
    { lay:'hub'   ,     events:{ vip:true, emergency:true, rush:true, medical:true }, target:1.0 }, // L50 ФИНАЛЬНЫЙ КАПСТОУН
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
    { id:'arctic', emoji:'❄️', ready:true,
      level:{ biome:'arctic', weather:true, deice:true, objective:{ metric:'served', stars:[8,10,12] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
    { id:'tropical', emoji:'🏝️', ready:true,
      level:{ biome:'tropical', weather:true, deice:false, objective:{ metric:'served', stars:[9,11,13] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
    { id:'desert',   emoji:'🐪', ready:true,
      level:{ biome:'desert', weather:false, deice:false, objective:{ metric:'served', stars:[9,11,13] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
    { id:'mountain', emoji:'🏔️', ready:true,
      level:{ biome:'mountain', weather:false, deice:false, objective:{ metric:'served', stars:[7,9,11] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
    { id:'megacity', emoji:'🌆', ready:true,
      level:{ biome:'megacity', weather:false, deice:false, objective:{ metric:'served', stars:[11,13,15] },
        sides:{ top:{type:'fuel',slots:2,open:1}, left:{type:'board',slots:2,open:1}, bottom:{type:'repair',slots:2,open:1} },
        runways:3 } },
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
  // нижняя граница вилки апгрейда [0, maxUp] (умолч. 0). Экон-ручка: «набор» учитывает
  // только подъём от minUp до maxUp — выше minUp боксы как бы уже прокачаны, ниже maxUp
  // ещё есть что купить. minUp=0 ⇒ всё как раньше (числа экономики не меняются).
  function levelMinUp(lv?: Level){ const L = lv || LV; const m = L && L.minUp; const v = (m==null) ? 0 : m; return Math.max(0, Math.min(levelMaxUp(lv), v)); }
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
    // вилка апгрейда: покупается только подъём minUp→maxUp; spanFrac=1 при minUp=0 (как раньше)
    const maxUpL = levelMaxUp(lv);
    const spanFrac = maxUpL > 0 ? (maxUpL - levelMinUp(lv)) / maxUpL : 0;
    const upgCost = maxUpL > 0 ? workingBays * upgShare * upgCostBase * K.ECON_UP_FRAC * spanFrac : 0;
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
    if(o.metric==='survival') return t('obj.survival', {time: fmtTime(o.target ?? o.time ?? 0)});
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
