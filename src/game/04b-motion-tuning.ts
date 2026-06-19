// ===== 04b-motion-tuning — live designer tuning registry, persistence & presets =====
// One fragment of the single game IIFE. Provides: MT, mtOpenPanel.
// Reads: 04 (K, FOR).

  type MtParam = {
    key: string; group: string; label: string;
    target: 'K' | 'FOR' | 'META'; name: string; def: number | boolean | number[] | string;
    min?: number; max?: number; step?: number; unit?: string;
    category?: string; description?: string; valueType?: 'number' | 'boolean' | 'string' | 'number[]';
    affectsGameplay?: boolean; visualsOnly?: boolean; liveSafe?: boolean; requiresReplay?: boolean; exportable?: boolean; debugOnly?: boolean;
    note: string; impact: string;
  };

  const MT_STORE_KEY   = 'pf_motion_tuning_v1';
  const MT_PRESETS_KEY = 'pf_motion_presets_v1';

  const MT_META_VALUES: Record<string, number | boolean | string | number[]> = {};

  const MT_GROUP_CATEGORY: Record<string, string> = {
    movement:'Движение', turns:'Повороты', routing:'Маршрутизация',
    takeoff:'Взлёт', approach:'Заход на посадку', landing:'Посадка', timing:'Тайминги', service:'Обслуживание',
    spawn:'Поток', collisions:'Столкновения', effects:'Эффекты', bay_nav:'Бокс: заезд/выезд',
    events:'События', weather:'Погода', forest:'Лесной биом', ctrl:'Контроль событий',
    safe_areas:'Безопасные зоны и жесты',
  };

  const MT_PLANNED_PARAMS: MtParam[] = [
    {key:'MT.ROUTE_SNAP_ENABLED', group:'snap_zones', category:'Зоны захвата', label:'Привязка маршрута', target:'META', name:'ROUTE_SNAP_ENABLED', def:false, note:'Запланированная привязка конечной точки маршрута к объектам; геймплей не затронут.', impact:'Заглушка для будущей привязки маршрута к ВПП/боксам.', affectsGameplay:true, liveSafe:false, requiresReplay:true, exportable:true},
    {key:'MT.SNAP_RADIUS', group:'snap_zones', category:'Зоны захвата', label:'Радиус зоны захвата', target:'META', name:'SNAP_RADIUS', def:40, min:0, max:180, step:1, unit:'px', note:'Запланированный радиус зон захвата ВПП/боксов; геймплей не затронут.', impact:'Определит дистанцию захвата конечной точки маршрута.', affectsGameplay:true, liveSafe:false, requiresReplay:true, exportable:true},
    {key:'MT.RUNWAY_HIT_PADDING', group:'runway_geometry', category:'Геометрия ВПП', label:'Поле касания ВПП', target:'META', name:'RUNWAY_HIT_PADDING', def:16, min:0, max:120, step:1, unit:'px', note:'Запланированное расширение области касания ВПП.', impact:'Сделает попадание на ВПП менее точным — удобнее управление.', affectsGameplay:true, liveSafe:false, requiresReplay:true, exportable:true},
    {key:'MT.BAY_HIT_PADDING', group:'service_bay_geometry', category:'Геометрия боксов', label:'Поле касания бокса', target:'META', name:'BAY_HIT_PADDING', def:12, min:0, max:120, step:1, unit:'px', note:'Запланированное расширение области касания бокса.', impact:'Сделает попадание в бокс менее точным — удобнее управление.', affectsGameplay:true, liveSafe:false, requiresReplay:true, exportable:true},
    {key:'MT.DEBUG_RUNWAY_SNAP_ZONES', group:'debug_overlays', category:'Отладочные слои', label:'Зоны захвата ВПП', target:'META', name:'DEBUG_RUNWAY_SNAP_ZONES', def:false, note:'Заглушка отладочного слоя — заработает после добавления рендера.', impact:'Не влияет на геймплей в этом патче.', visualsOnly:true, liveSafe:true, exportable:true, debugOnly:true},
    {key:'MT.DEBUG_BAY_SNAP_ZONES', group:'debug_overlays', category:'Отладочные слои', label:'Зоны захвата боксов', target:'META', name:'DEBUG_BAY_SNAP_ZONES', def:false, note:'Заглушка отладочного слоя — заработает после добавления рендера.', impact:'Не влияет на геймплей в этом патче.', visualsOnly:true, liveSafe:true, exportable:true, debugOnly:true},
    {key:'MT.DEBUG_RAW_ROUTE_POINTS', group:'debug_overlays', category:'Отладочные слои', label:'Точки маршрута', target:'META', name:'DEBUG_RAW_ROUTE_POINTS', def:false, note:'Заглушка отладочного слоя — заработает после добавления рендера маршрутных точек.', impact:'Не влияет на геймплей в этом патче.', visualsOnly:true, liveSafe:true, exportable:true, debugOnly:true},
    {key:'MT.SCENARIO', group:'mobile_preview', category:'Превью', label:'Сценарий превью', target:'META', name:'SCENARIO', def:'complete_cycle', note:'Запланированный выбор сценария: посадка, взлёт, руление, цикл обслуживания.', impact:'Сохраняется и экспортируется; привязка к воспроизведению — будущая работа.', liveSafe:false, requiresReplay:true, exportable:true},

    // ── Безопасные зоны: ручной override safe-area insets (Workbench) ────────
    {key:'MT.SA_INSET_TOP',    group:'safe_areas', category:'Safe insets', label:'Safe inset сверху',    target:'META', name:'SA_INSET_TOP',    def:0,   min:0, max:120, step:1, unit:'px', note:'Ручной override safe-area-inset-top. 0 = читать из env(). Применяется для симуляции в Workbench.',        impact:'Смещает верхний край contentSafeRect.', liveSafe:true, exportable:true },
    {key:'MT.SA_INSET_RIGHT',  group:'safe_areas', category:'Safe insets', label:'Safe inset справа',    target:'META', name:'SA_INSET_RIGHT',  def:0,   min:0, max:120, step:1, unit:'px', note:'Ручной override safe-area-inset-right. 0 = читать из env().',                                            impact:'Смещает правый край contentSafeRect.', liveSafe:true, exportable:true },
    {key:'MT.SA_INSET_BOTTOM', group:'safe_areas', category:'Safe insets', label:'Safe inset снизу',     target:'META', name:'SA_INSET_BOTTOM', def:0,   min:0, max:120, step:1, unit:'px', note:'Ручной override safe-area-inset-bottom. 0 = читать из env().',                                            impact:'Смещает нижний край contentSafeRect.', liveSafe:true, exportable:true },
    {key:'MT.SA_INSET_LEFT',   group:'safe_areas', category:'Safe insets', label:'Safe inset слева',     target:'META', name:'SA_INSET_LEFT',   def:0,   min:0, max:120, step:1, unit:'px', note:'Ручной override safe-area-inset-left. 0 = читать из env().',                                             impact:'Смещает левый край contentSafeRect.', liveSafe:true, exportable:true },

    // ── Вырез камеры ─────────────────────────────────────────────────────────
    {key:'MT.SA_CUTOUT_SIDE',   group:'safe_areas', category:'Вырез камеры', label:'Сторона выреза',      target:'META', name:'SA_CUTOUT_SIDE',   def:'none', note:"Сторона выреза камеры для симуляции: 'none', 'left', 'right', 'top'.", impact:'Определяет, где находится вырез. Смещает соответствующий safe inset.', liveSafe:true, exportable:true },
    {key:'MT.SA_CUTOUT_W',      group:'safe_areas', category:'Вырез камеры', label:'Ширина выреза',       target:'META', name:'SA_CUTOUT_W',      def:28,  min:0, max:80,  step:1, unit:'px', note:'Ширина (толщина) выреза камеры в px.',                                    impact:'Увеличивает effective safe inset на стороне выреза.', liveSafe:true, exportable:true },
    {key:'MT.SA_CUTOUT_H',      group:'safe_areas', category:'Вырез камеры', label:'Длина выреза',        target:'META', name:'SA_CUTOUT_H',      def:90,  min:0, max:200, step:1, unit:'px', note:'Высота (длина вдоль края) выреза камеры в px.',                           impact:'Определяет протяжённость зоны выреза.', liveSafe:true, exportable:true },
    {key:'MT.SA_CUTOUT_OFFSET', group:'safe_areas', category:'Вырез камеры', label:'Смещение выреза',     target:'META', name:'SA_CUTOUT_OFFSET', def:0,   min:0, max:400, step:1, unit:'px', note:'Смещение выреза от верхнего края (в ландшафте — от левого/правого торца).', impact:'Позиция выреза вдоль стороны экрана.', liveSafe:true, exportable:true },

    // ── Жесты Android ────────────────────────────────────────────────────────
    {key:'MT.SA_GESTURE_LEFT',   group:'safe_areas', category:'Жесты Android', label:'Жест «назад» (лево)',   target:'META', name:'SA_GESTURE_LEFT',   def:24, min:0, max:60, step:1, unit:'px', note:'Ширина зоны жеста «назад» у левого края. По умолчанию 24 dp (gesture nav).', impact:'Запрещает старт маршрута у левого края.', liveSafe:true, exportable:true },
    {key:'MT.SA_GESTURE_RIGHT',  group:'safe_areas', category:'Жесты Android', label:'Жест «назад» (право)',  target:'META', name:'SA_GESTURE_RIGHT',  def:24, min:0, max:60, step:1, unit:'px', note:'Ширина зоны жеста «назад» у правого края.',                                  impact:'Запрещает старт маршрута у правого края.', liveSafe:true, exportable:true },
    {key:'MT.SA_GESTURE_TOP',    group:'safe_areas', category:'Жесты Android', label:'Жест шторки (верх)',    target:'META', name:'SA_GESTURE_TOP',    def:0,  min:0, max:60, step:1, unit:'px', note:'Высота зоны жеста шторки у верхнего края (обычно 0 в игре).',               impact:'Запрещает старт маршрута у верхнего края.', liveSafe:true, exportable:true },
    {key:'MT.SA_GESTURE_BOTTOM', group:'safe_areas', category:'Жесты Android', label:'Жест «домой» (низ)',    target:'META', name:'SA_GESTURE_BOTTOM', def:24, min:0, max:60, step:1, unit:'px', note:'Высота зоны жеста «домой/свернуть» у нижнего края.',                          impact:'Запрещает старт маршрута у нижнего края.', liveSafe:true, exportable:true },

    // ── Отступы зон ──────────────────────────────────────────────────────────
    {key:'MT.SA_ROUTE_START_PAD',  group:'safe_areas', category:'Отступы', label:'Отступ начала маршрута',     target:'META', name:'SA_ROUTE_START_PAD',  def:32, min:0, max:80, step:1, unit:'px', note:'Дополнительный отступ от внешнего края жест-зоны для начала маршрута.',  impact:'Размер routeStartAllowedRect от краёв.', liveSafe:true, exportable:true },
    {key:'MT.SA_ROUTE_DRAW_PAD',   group:'safe_areas', category:'Отступы', label:'Отступ рисования маршрута',  target:'META', name:'SA_ROUTE_DRAW_PAD',   def:0,  min:0, max:80, step:1, unit:'px', note:'Отступ routeDrawAllowedRect. 0 = маршрут может подходить к самому краю жест-зоны.', impact:'Ограничивает область рисования.', liveSafe:true, exportable:true },
    {key:'MT.SA_ROUTE_TARGET_PAD', group:'safe_areas', category:'Отступы', label:'Отступ цели маршрута',       target:'META', name:'SA_ROUTE_TARGET_PAD', def:16, min:0, max:80, step:1, unit:'px', note:'Отступ routeTargetAllowedRect для ВПП/боксов.',                            impact:'Snap-точки не должны быть у самого края.', liveSafe:true, exportable:true },
    {key:'MT.SA_CONTENT_PAD',      group:'safe_areas', category:'Отступы', label:'Отступ контентной зоны',     target:'META', name:'SA_CONTENT_PAD',      def:0,  min:0, max:40, step:1, unit:'px', note:'Дополнительный запас contentSafeRect от safeAreaInsets.',                 impact:'Консервативный отступ для контента.', liveSafe:true, exportable:true },
    {key:'MT.SA_INTERACTIVE_PAD',  group:'safe_areas', category:'Отступы', label:'Отступ интерактивной зоны',  target:'META', name:'SA_INTERACTIVE_PAD',  def:0,  min:0, max:40, step:1, unit:'px', note:'Дополнительный запас interactiveSafeRect от жест-зон.',                   impact:'Консервативный отступ для кнопок и объектов.', liveSafe:true, exportable:true },
    {key:'MT.SA_HUD_PAD',          group:'safe_areas', category:'Отступы', label:'Отступ HUD',                 target:'META', name:'SA_HUD_PAD',          def:0,  min:0, max:40, step:1, unit:'px', note:'Дополнительный отступ HUD от safeAreaInsets.',                            impact:'HUD отступает дальше от вырезов.', liveSafe:true, exportable:true },
    {key:'MT.SA_BUTTON_PAD',       group:'safe_areas', category:'Отступы', label:'Отступ кнопок',              target:'META', name:'SA_BUTTON_PAD',       def:0,  min:0, max:40, step:1, unit:'px', note:'Дополнительный отступ критичных кнопок (пауза) от жест-зон.',            impact:'Кнопки отступают дальше от краёв.', liveSafe:true, exportable:true },

    // ── Поведение (флаги — не влияют на геймплей до следующего ревью) ────────
    {key:'MT.SA_BLOCK_ROUTE_START',     group:'safe_areas', category:'Поведение', label:'Блок старта в жест-зоне',    target:'META', name:'SA_BLOCK_ROUTE_START',     def:true,  note:'Флаг: блокировать начало маршрута в зоне системных жестов (реализация — в след. PR).', impact:'Предотвратит конфликт drag-start с жестами Android.', liveSafe:true, exportable:true },
    {key:'MT.SA_ALLOW_ROUTE_GESTURE',   group:'safe_areas', category:'Поведение', label:'Продолжение через жест-зону', target:'META', name:'SA_ALLOW_ROUTE_GESTURE',   def:true,  note:'Флаг: разрешить продолжение маршрута через жест-зону после старта.',                  impact:'При false — маршрут обрезается у границы жест-зоны.', liveSafe:true, exportable:true },
    {key:'MT.SA_BLOCK_TARGETS_GESTURE', group:'safe_areas', category:'Поведение', label:'Блок целей в жест-зоне',     target:'META', name:'SA_BLOCK_TARGETS_GESTURE', def:true,  note:'Флаг: snap-точки ВПП/боксов не должны попадать в жест-зону.',                         impact:'Валидация предупреждений в Workbench.', liveSafe:true, exportable:true },
    {key:'MT.SA_BLOCK_OBJ_CUTOUT',      group:'safe_areas', category:'Поведение', label:'Блок объектов в вырезе',     target:'META', name:'SA_BLOCK_OBJ_CUTOUT',      def:true,  note:'Флаг: игровые объекты не должны перекрываться с зоной выреза камеры.',               impact:'Валидация предупреждений в Workbench.', liveSafe:true, exportable:true },

    // ── Отладка ───────────────────────────────────────────────────────────────
    {key:'MT.SA_DEBUG_OVERLAY', group:'safe_areas', category:'Отладка', label:'Debug overlay на канвасе', target:'META', name:'SA_DEBUG_OVERLAY', def:false, note:'Показывать зоны безопасности поверх игры на канвасе (для отладки на устройстве).', impact:'Не влияет на геймплей.', visualsOnly:true, liveSafe:true, exportable:true, debugOnly:true },
  ];

  const MT_PARAMS: MtParam[] = [
    // ── движение ──────────────────────────────────────────────────────────────
    {key:'K.TURN',        group:'turns',    label:'Поворот в полёте/рулении',  target:'K',  name:'TURN',         def:K.TURN,         min:.5,  max:8,   step:.05,  note:'rad/sec: ограничение доворота в steer()/turnTo().',          impact:'Выше — резче повороты и меньше радиус маршрута.'},
    {key:'K.SPEED_AIR',  group:'movement', label:'Скорость в воздухе',        target:'K',  name:'SPEED_AIR',    def:K.SPEED_AIR,    min:20,  max:160, step:1,    note:'Скорость захода, глиссады и воздушного маршрута.',           impact:'Определяет темп посадок и сколько времени есть на реакции.'},
    {key:'K.SPEED_TAXI', group:'movement', label:'Скорость руления',          target:'K',  name:'SPEED_TAXI',   def:K.SPEED_TAXI,   min:10,  max:120, step:1,    note:'Базовая скорость на поле до погодных множителей.',           impact:'Выше — быстрее обслуживание, но сложнее избегать столкновений.'},
    // ── взлёт ─────────────────────────────────────────────────────────────────
    {key:'K.SPEED_TAKEOFF',     group:'takeoff',  label:'Скорость взлёта',         target:'K',  name:'SPEED_TAKEOFF',     def:K.SPEED_TAKEOFF,     min:40,  max:260, step:1,    note:'Разгон и уход за край экрана.',                              impact:'Сокращает время занятости ВПП при вылете.'},
    {key:'K.TAKEOFF_HOLD',      group:'takeoff',  label:'Пауза перед взлётом',     target:'K',  name:'TAKEOFF_HOLD',      def:K.TAKEOFF_HOLD,      min:0,   max:2.5, step:.05,  note:'Секунды выравнивания перед разгоном.',                        impact:'Больше — длиннее остановка и выше риск очередей.'},
    {key:'K.TAKEOFF_OVERSHOOT', group:'takeoff',  label:'Цель разгона за ВПП',     target:'K',  name:'TAKEOFF_OVERSHOOT', def:K.TAKEOFF_OVERSHOOT, min:0,   max:800, step:10,   note:'px за exitX — цель steer() при разгоне.',                    impact:'Меньше — борт чуть раньше уходит за край и вызывает depart.'},
    // ── заход на посадку ─────────────────────────────────────────────────────
    {key:'K.APPROACH_SPEED_MULT',group:'approach',label:'Скорость захода ×',        target:'K',  name:'APPROACH_SPEED_MULT',def:K.APPROACH_SPEED_MULT,min:.2,  max:1,   step:.05,  note:'Финальный заход = SPEED_AIR × этот множитель.',              impact:'Ниже — медленнее и точнее; выше — быстрее, сложнее попасть.'},
    {key:'K.PLANE_SKY_SCALE',   group:'approach', label:'Масштаб борта в небе',     target:'K',  name:'PLANE_SKY_SCALE',   def:K.PLANE_SKY_SCALE,   min:.5,  max:3,   step:.05,  visualsOnly:true, note:'Визуальный масштаб борта в воздухе.',                         impact:'Больше — заметнее самолёты; влияет только на рендер.'},
    {key:'K.PLANE_GND_SCALE',   group:'approach', label:'Масштаб борта на земле',   target:'K',  name:'PLANE_GND_SCALE',   def:K.PLANE_GND_SCALE,   min:.3,  max:2,   step:.05,  visualsOnly:true, note:'Визуальный масштаб борта на земле.',                          impact:'Больше — крупнее наземные борта.'},
    // ── посадка ──────────────────────────────────────────────────────────────
    {key:'K.LAND_ALIGN_SPEED',  group:'landing',  label:'Скорость центровки',       target:'K',  name:'LAND_ALIGN_SPEED',  def:K.LAND_ALIGN_SPEED,  min:1,   max:30,  step:.5,   note:'lerp-скорость довыравнивания по оси ВПП при посадке/взлёте.',impact:'Выше — резче прилипание к оси; ниже — плавнее.'},
    {key:'K.LAND_BUMP_MS',      group:'landing',  label:'Длительность толчка',      target:'K',  name:'LAND_BUMP_MS',      def:K.LAND_BUMP_MS,      min:0,   max:1000,step:10,   visualsOnly:true, note:'Продолжительность визуального отскока при касании, мс.',     impact:'0 — убрать толчок; 500+ — длинный плавный отскок.'},
    {key:'K.LAND_BUMP_AMP',     group:'landing',  label:'Амплитуда толчка',         target:'K',  name:'LAND_BUMP_AMP',     def:K.LAND_BUMP_AMP,     min:0,   max:20,  step:.5,   visualsOnly:true, note:'Высота отскока корпуса при касании, ui-единиц.',              impact:'0 — без отскока; выше — заметнее «прыжок» при посадке.'},
    // ── маршрутизация ─────────────────────────────────────────────────────────
    {key:'K.ARRIVE', group:'routing', label:'Захват точки маршрута',          target:'K',  name:'ARRIVE',       def:K.ARRIVE,       min:2,   max:40,  step:1,    note:'Минимальный порог достижения waypoint.',                    impact:'Больше — плавнее, но менее точное следование линии.'},
    {key:'K.GRAB',   group:'routing', label:'Радиус выбора борта',            target:'K',  name:'GRAB',         def:K.GRAB,         min:16,  max:90,  step:1,    note:'Радиус тапа/захвата.',                                      impact:'Влияет на удобство взаимодействия.'},
    // ── столкновения ──────────────────────────────────────────────────────────
    {key:'K.CRASH_DIST', group:'collisions', label:'Дистанция краша',         target:'K',  name:'CRASH_DIST',   def:K.CRASH_DIST,   min:8,   max:60,  step:1,    note:'Физический контакт наземных бортов.',                       impact:'Выше — игра строже к разъездам.'},
    // ── эффекты ───────────────────────────────────────────────────────────────
    {key:'K.NEAR_DIST',   group:'effects', label:'Дистанция near-miss',       target:'K',  name:'NEAR_DIST',    def:K.NEAR_DIST,    min:16,  max:120, step:1,    visualsOnly:true, note:'Порог эффекта «уфф».',                                      impact:'Выше — чаще визуальная реакция на опасные манёвры.'},
    {key:'K.NEAR_COOL',   group:'effects', label:'Кулдаун near-miss',         target:'K',  name:'NEAR_COOL',    min:.2,  max:8,   step:.1,    visualsOnly:true, def:K.NEAR_COOL,    note:'Антидребезг на пару бортов.',                               impact:'Меньше — чаще повторы эффекта.'},
    {key:'K.SLOWMO_DUR',  group:'effects', label:'Длительность slowmo',       target:'K',  name:'SLOWMO_DUR',   def:K.SLOWMO_DUR,   min:0,   max:2,   step:.05,  visualsOnly:true, note:'Секунды замедления при near-miss.',                          impact:'Усиливает драму опасного сближения.'},
    {key:'K.SLOWMO_SCALE',group:'effects', label:'Масштаб slowmo',            target:'K',  name:'SLOWMO_SCALE', def:K.SLOWMO_SCALE, min:.1,  max:1,   step:.05,  visualsOnly:true, note:'Множитель времени при slowmo.',                             impact:'Ниже — эффект заметнее.'},
    // ── тайминги ──────────────────────────────────────────────────────────────
    {key:'K.AIR_BASE',    group:'timing', label:'Воздушное терпение',         target:'K',  name:'AIR_BASE',     def:K.AIR_BASE,     min:5,   max:90,  step:1,    note:'Окно посадки обычного борта.',                              impact:'Ниже — сильнее давление до посадки.'},
    {key:'K.GROUND_BASE', group:'timing', label:'Наземное терпение база',     target:'K',  name:'GROUND_BASE',  def:K.GROUND_BASE,  min:10,  max:180, step:1,    note:'Базовый таймер после посадки.',                             impact:'Ниже — меньше времени на обслуживание.'},
    {key:'K.GROUND_STEP', group:'timing', label:'Терпение за услугу',         target:'K',  name:'GROUND_STEP',  def:K.GROUND_STEP,  min:0,   max:90,  step:1,    note:'Добавка таймера за оставшуюся услугу.',                      impact:'Компенсирует длинные цепочки услуг.'},
    // ── обслуживание ──────────────────────────────────────────────────────────
    {key:'K.SERVE_BASE',    group:'service', label:'Время обслуживания',      target:'K',  name:'SERVE_BASE',   def:K.SERVE_BASE,   min:.3,  max:12,  step:.1,   note:'Секунды базовой услуги до апгрейдов.',                      impact:'Определяет длительность стоянки в боксе.'},
    {key:'K.UP_SPEED',      group:'service', label:'Бонус скорости апгрейда', target:'K',  name:'UP_SPEED',     def:K.UP_SPEED,     min:0,   max:1,   step:.01,  note:'+скорость за уровень ангара.',                              impact:'Выше — апгрейды сильнее ускоряют поток.'},
    {key:'K.TWO_SVC_CHANCE',group:'service', label:'Шанс двух услуг',         target:'K',  name:'TWO_SVC_CHANCE',def:K.TWO_SVC_CHANCE,min:0, max:1,   step:.01,  note:'Вероятность двух запросов.',                                impact:'Выше — длиннее маршруты и больше чек.'},
    // ── поток (spawn) ─────────────────────────────────────────────────────────
    {key:'K.PACE_IVL_SLOW',group:'spawn', label:'Интервал spawn slow',        target:'K',  name:'PACE_IVL_SLOW',def:K.PACE_IVL_SLOW,min:1,   max:12,  step:.1,   note:'Интервал при pace=0.',                                      impact:'Выше — спокойнее ранние уровни.'},
    {key:'K.PACE_IVL_FAST',group:'spawn', label:'Интервал spawn fast',        target:'K',  name:'PACE_IVL_FAST',def:K.PACE_IVL_FAST,min:.5,  max:8,   step:.1,   note:'Интервал при pace=1.',                                      impact:'Ниже — плотнее поток на сложных картах.'},
    {key:'K.SPAWN_MIN',    group:'spawn', label:'Минимум spawn',              target:'K',  name:'SPAWN_MIN',    def:K.SPAWN_MIN,    min:.3,  max:6,   step:.1,   note:'Нижний предел интервала.',                                  impact:'Ограничивает максимальный хаос.'},
    {key:'K.SPAWN_DECAY',  group:'spawn', label:'Ускорение spawn/принятый',   target:'K',  name:'SPAWN_DECAY',  def:K.SPAWN_DECAY,  min:0,   max:.2,  step:.005, note:'Срез интервала за обслуженный борт.',                       impact:'Делает смену быстрее к концу.'},
    {key:'K.PACE_CAP_LOW', group:'spawn', label:'Лимит бортов pace 0',        target:'K',  name:'PACE_CAP_LOW', def:K.PACE_CAP_LOW, min:1,   max:12,  step:1,    note:'Одновременные борты при pace=0.',                           impact:'Ниже — проще спокойные уровни.'},
    {key:'K.PACE_CAP_HIGH',group:'spawn', label:'Лимит бортов pace 1',        target:'K',  name:'PACE_CAP_HIGH',def:K.PACE_CAP_HIGH,min:2,   max:20,  step:1,    note:'Одновременные борты при pace=1.',                           impact:'Выше — сильнее нагрузка поля.'},
    {key:'K.PACE_DEFAULT', group:'spawn', label:'Pace по умолчанию',          target:'K',  name:'PACE_DEFAULT', def:K.PACE_DEFAULT, min:0,   max:1,   step:.01,  note:'Фон для не-кампании.',                                      impact:'Меняет общий темп бонус/биом режимов.'},
    {key:'K.MAX_PLANES',   group:'spawn', label:'Жёсткий лимит бортов',       target:'K',  name:'MAX_PLANES',   def:K.MAX_PLANES,   min:1,   max:30,  step:1,    note:'Потолок одновременных бортов.',                             impact:'Ограничивает нагрузку и производительность.'},
    {key:'K.SURV_RAMP_SECS',group:'spawn',label:'Survival ramp',              target:'K',  name:'SURV_RAMP_SECS',def:K.SURV_RAMP_SECS,min:30,max:900, step:5,    note:'Секунды выхода survival к pace=1.',                         impact:'Ниже — быстрее нарастает сложность.'},
    // ── события ───────────────────────────────────────────────────────────────
    {key:'K.VIP_CHANCE',       group:'events', label:'Шанс VIP',              target:'K',  name:'VIP_CHANCE',       def:K.VIP_CHANCE,       min:0,  max:1,   step:.01, note:'Доля VIP при включённом событии.',    impact:'Меняет частоту дорогих срочных бортов.'},
    {key:'K.EMERGENCY_CHANCE', group:'events', label:'Шанс аварийного',       target:'K',  name:'EMERGENCY_CHANCE', def:K.EMERGENCY_CHANCE, min:0,  max:1,   step:.01, note:'Вероятность emergency.',              impact:'Добавляет давление в воздухе.'},
    {key:'K.MEDICAL_CHANCE',   group:'events', label:'Шанс медицинского',     target:'K',  name:'MEDICAL_CHANCE',   def:K.MEDICAL_CHANCE,   min:0,  max:1,   step:.01, note:'Вероятность medical.',                impact:'Чаще приоритетные борта.'},
    {key:'K.MEDICAL_AIR',      group:'events', label:'Множитель air medical', target:'K',  name:'MEDICAL_AIR',      def:K.MEDICAL_AIR,      min:.1, max:1.5, step:.05, note:'Множитель воздушного терпения.',      impact:'Ниже — medical срочнее.'},
    {key:'K.RUSH_PERIOD',      group:'events', label:'Период rush',           target:'K',  name:'RUSH_PERIOD',      def:K.RUSH_PERIOD,      min:5,  max:120, step:1,   note:'Период часа пик.',                    impact:'Ниже — чаще волны.'},
    {key:'K.RUSH_DUR',         group:'events', label:'Длительность rush',     target:'K',  name:'RUSH_DUR',         def:K.RUSH_DUR,         min:1,  max:60,  step:1,   note:'Длительность волны.',                 impact:'Дольше — больше плотных участков.'},
    // ── погода ────────────────────────────────────────────────────────────────
    {key:'K.FOG_TAXI',          group:'weather', label:'Туман taxi ×',        target:'K',  name:'FOG_TAXI',          def:K.FOG_TAXI,          min:.1, max:1, step:.05, note:'Множитель руления в тумане.',  impact:'Ниже — туман сильнее тормозит поле.'},
    {key:'K.WEATHER_RAIN_TAXI', group:'weather', label:'Дождь taxi ×',        target:'K',  name:'WEATHER_RAIN_TAXI', def:K.WEATHER_RAIN_TAXI, min:.1, max:1, step:.05, note:'Множитель руления в дождь.',   impact:'Ниже — дождь сильнее замедляет.'},
    {key:'K.WEATHER_SNOW_TAXI', group:'weather', label:'Снег taxi ×',         target:'K',  name:'WEATHER_SNOW_TAXI', def:K.WEATHER_SNOW_TAXI, min:.1, max:1, step:.05, note:'Множитель руления в снег.',    impact:'Ниже — снег сильнее замедляет.'},
    // ── лесной биом ───────────────────────────────────────────────────────────
    {key:'FOR.CREW_SPEED', group:'forest', label:'Скорость бригады', target:'FOR', name:'CREW_SPEED', def:FOR.CREW_SPEED, min:60,  max:600, step:5,  note:'px/sec спец-авто.',        impact:'Выше — быстрее реакция на помехи.'},
    {key:'FOR.WORK_TIME',  group:'forest', label:'Работа бригады',   target:'FOR', name:'WORK_TIME',  def:FOR.WORK_TIME,  min:.2,  max:8,   step:.1, note:'Секунды работы у помехи.', impact:'Выше — дольше закрыта полоса.'},
    // ── бокс: заезд / стоянка / выезд ────────────────────────────────────────
    {key:'K.BAY_DOCK_SPEED',  group:'bay_nav', label:'Скорость в боксе ×',   target:'K', name:'BAY_DOCK_SPEED',  def:K.BAY_DOCK_SPEED,  min:.1, max:2,   step:.05, note:'Движение внутри бокса = SPEED_TAXI × это значение.',     impact:'Ниже — медленнее и аккуратнее; выше — короче стоянка.'},
    {key:'K.BAY_ALIGN_SPEED', group:'bay_nav', label:'Выравнивание по оси',  target:'K', name:'BAY_ALIGN_SPEED', def:K.BAY_ALIGN_SPEED, min:1,  max:30,  step:.5,  note:'lerp-скорость центровки на оси ворот (вход и выход).',   impact:'Выше — резче прилипание к оси; ниже — плавнее.'},
    {key:'K.BAY_HEAD_SPEED',  group:'bay_nav', label:'Скорость разворота',   target:'K', name:'BAY_HEAD_SPEED',  def:K.BAY_HEAD_SPEED,  min:.5, max:15,  step:.5,  note:'Скорость поворота носа при заезде и выезде из бокса.',   impact:'Выше — резче разворот; ниже — плавнее.'},
    // ── контроль событий (on/off) ─────────────────────────────────────────────
    {key:'K.DISABLE_VIP',       group:'ctrl', label:'Отключить VIP-борты',    target:'K', name:'DISABLE_VIP',       def:true, note:'Блокирует спавн VIP при любом K.VIP_CHANCE.',       impact:'Чистит поле для теста скорости без дорогих бортов.'},
    {key:'K.DISABLE_EMERGENCY', group:'ctrl', label:'Отключить аварийные',    target:'K', name:'DISABLE_EMERGENCY', def:true, note:'Блокирует «топливо на нуле».',                       impact:'Убирает экстренные ситуации из тестовой сессии.'},
    {key:'K.DISABLE_MEDICAL',   group:'ctrl', label:'Отключить медицинские',  target:'K', name:'DISABLE_MEDICAL',   def:true, note:'Блокирует медицинские борты.',                       impact:'Устраняет приоритетные прерывания.'},
    {key:'K.DISABLE_RUSH',      group:'ctrl', label:'Отключить час пик',      target:'K', name:'DISABLE_RUSH',      def:true, note:'Не запускает волну rush (RUSH_PERIOD/RUSH_DUR).',    impact:'Стабильный поток без всплесков.'},
    {key:'K.DISABLE_WEATHER',   group:'ctrl', label:'Отключить погоду',       target:'K', name:'DISABLE_WEATHER',   def:true, note:'Не даёт начаться дождю/снегу; сбрасывает текущую.',  impact:'Постоянная ясная погода для теста скорости руления.'},
    {key:'K.DISABLE_SLOWMO',    group:'ctrl', label:'Отключить slowmo',       target:'K', name:'DISABLE_SLOWMO',    def:true, note:'Near-miss не замедляет время.',                     impact:'Непрерывный темп без визуальных пауз.'},
    {key:'K.DISABLE_FOREST',    group:'ctrl', label:'Отключить лесные помехи',target:'K', name:'DISABLE_FOREST',    def:true, note:'Блокирует спавн и очищает елки, птиц, оленей, снег.', impact:'Убирает лесные прерывания с ВПП.'},
    {key:'K.DISABLE_DEICE',     group:'ctrl', label:'Отключить деайсинг',     target:'K', name:'DISABLE_DEICE',     def:true, note:'Не добавляет деайсинг в список услуг при снеге.',     impact:'Упрощает маршруты при тестировании в снег.'},
    {key:'K.DISABLE_BAY',       group:'ctrl', label:'Отключить боксы',        target:'K', name:'DISABLE_BAY',       def:true, note:'Пропускает все услуги в боксах — сразу к вылету.',   impact:'Чистый тест руления и взлёта без обслуживания.'},
  ];

  MT_PARAMS.forEach(p => {
    p.category = p.category || MT_GROUP_CATEGORY[p.group] || p.group;
    p.description = p.description || p.note;
    p.valueType = p.valueType || (Array.isArray(p.def) ? 'number[]' : typeof p.def === 'boolean' ? 'boolean' : typeof p.def === 'string' ? 'string' : 'number');
    p.visualsOnly = p.visualsOnly ?? false;
    p.affectsGameplay = p.affectsGameplay ?? !p.visualsOnly;
    p.liveSafe = p.liveSafe ?? true;
    p.requiresReplay = p.requiresReplay ?? false;
    p.exportable = p.exportable ?? true;
    p.debugOnly = p.debugOnly ?? false;
  });
  MT_PLANNED_PARAMS.forEach(p => { MT_META_VALUES[p.name] = p.def; MT_PARAMS.push(p); });

  const MT_GROUPS: Record<string, string> = {
    input_touch:'Ввод и касания', route_drawing:'Маршрутизация', route_smoothing:'Сглаживание маршрута', snap_zones:'Зоны захвата', runway_geometry:'Геометрия ВПП',
    movement:'Движение', turns:'Повороты', routing:'Маршрутизация',
    takeoff:'Взлёт', approach:'Заход на посадку', landing:'Посадка', rollout_stop:'Пробег и остановка',
    timing:'Тайминги', service:'Обслуживание', spawn:'Поток', collisions:'Столкновения', effects:'Эффекты',
    bay_nav:'Бокс: заезд/выезд', service_bay_geometry:'Геометрия боксов', service_bay_exit:'Выезд из бокса', aircraft_state:'Состояние борта', aircraft_scale:'Масштаб борта',
    events:'События', weather:'Погода', sound_haptics:'Звук и вибрация', debug_overlays:'Отладочные слои', presets_persistence:'Пресеты',
    forest:'Лесной биом', ctrl:'⚙ Контроль событий', mobile_preview:'Превью',
    safe_areas:'📐 Безопасные зоны и жесты',
  };

  function mtTarget(p: MtParam): any { return p.target === 'META' ? MT_META_VALUES : p.target === 'FOR' ? FOR as any : K as any; }
  function mtGet(p: MtParam): any    { return mtTarget(p)[p.name]; }

  function mtSet(key: string, value: any): boolean {
    const p = MT_PARAMS.find(x => x.key === key);
    if (!p) return false;
    const t = mtTarget(p);
    if (typeof p.def === 'string') {
      t[p.name] = String(value);
    } else if (Array.isArray(p.def)) {
      t[p.name] = String(value).split(',').map((x: string) => +x.trim()).filter((x: number) => Number.isFinite(x));
    } else if (typeof p.def === 'boolean') {
      t[p.name] = !!value;
    } else {
      let n = +value;
      if (!Number.isFinite(n)) return false;
      if (p.min != null) n = Math.max(p.min, n);
      if (p.max != null) n = Math.min(p.max, n);
      t[p.name] = n;
    }
    return true;
  }

  function mtSnapshot(): Record<string, any> {
    const o: Record<string, any> = {};
    MT_PARAMS.forEach(p => o[p.key] = mtGet(p));
    return o;
  }

  function mtApply(values: Record<string, any>, persist = true): void {
    Object.keys(values || {}).forEach(k => mtSet(k, values[k]));
    if (persist) try { localStorage.setItem(MT_STORE_KEY, JSON.stringify(mtSnapshot())); } catch (_) {}
    mtRenderPanel();
  }

  function mtReset(): void {
    const o: Record<string, any> = {};
    MT_PARAMS.forEach(p => o[p.key] = p.def);
    mtApply(o);
  }

  function mtLoad(): void {
    try { const raw = localStorage.getItem(MT_STORE_KEY); if (raw) mtApply(JSON.parse(raw), false); } catch (_) {}
  }

  function mtPresets(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem(MT_PRESETS_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function mtSavePreset(name: string): void {
    const ps = mtPresets(); ps[name] = mtSnapshot();
    localStorage.setItem(MT_PRESETS_KEY, JSON.stringify(ps));
    mtRenderPanel();
  }

  function mtApplyPreset(name: string): void {
    const ps = mtPresets(); if (ps[name]) mtApply(ps[name]);
  }

  function mtExport(): string {
    return JSON.stringify({ schemaVersion: 2, version: 1, exportedAt: new Date().toISOString(), values: mtSnapshot() }, null, 2);
  }

  function mtImportText(text: string): void {
    const o = JSON.parse(text);
    const schemaVer: number = o.schemaVersion || o.version || 1;
    if (schemaVer > 2) console.warn('[MT] импорт JSON схемы v' + schemaVer + '; поддерживается v2 — возможна потеря данных');
    mtApply(o.values || o);
  }

  const MT = {
    params: MT_PARAMS, groups: MT_GROUPS,
    snapshot: mtSnapshot, apply: mtApply, reset: mtReset,
    export: mtExport, importText: mtImportText,
    savePreset: mtSavePreset, applyPreset: mtApplyPreset,
  };

  function escHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function mtBuildHTML(ps: Record<string, any>): string {
    const presetOpts = Object.keys(ps).map(n => '<option>' + escHtml(n) + '</option>').join('');
    const groups = Object.keys(MT_GROUPS).map(g => {
      const rows = MT_PARAMS.filter(p => p.group === g).map(p => {
        const unit = p.unit ? ' (' + escHtml(p.unit) + ')' : '';
        const desc = p.description || p.note || '';
        const meta = '<span><b>' + escHtml(p.label) + unit + '</b><em>' + escHtml(p.key + (p.category ? ' · ' + p.category : '')) + (desc ? ' — ' + escHtml(desc) : '') + '</em></span>';
        if (typeof p.def === 'boolean') {
          return '<label class="mt-row mt-bool">' + meta + '<input type="checkbox" data-mt="' + p.key + '" ' + (mtGet(p) ? 'checked' : '') + '></label>';
        }
        if (typeof p.def === 'string') {
          return '<label class="mt-row">' + meta + '<input class="mt-num" data-mt="' + p.key + '" type="text" value="' + escHtml(String(mtGet(p))) + '"></label>';
        }
        return '<label class="mt-row">' + meta +
          '<input type="range" data-mt="' + p.key + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + mtGet(p) + '">' +
          '<input class="mt-num" data-mt="' + p.key + '" type="number" step="' + p.step + '" value="' + mtGet(p) + '">' +
        '</label>';
      }).join('');
      if (!rows) return '';
      return '<details open><summary>' + escHtml(MT_GROUPS[g]) + '</summary>' + rows + '</details>';
    }).join('');
    return (
      '<div class="mt-head"><b>Motion Tuning</b><button id="mtClose">×</button></div>' +
      '<div class="mt-actions">' +
        '<button id="mtReset">Reset</button>' +
        '<button id="mtExport">Export JSON</button>' +
        '<button id="mtImport">Import JSON</button>' +
        '<input type="file" id="mtImportFile" accept=".json" style="display:none">' +
        '<input id="mtPresetName" placeholder="Название пресета">' +
        '<button id="mtSavePreset">Save</button>' +
        '<select id="mtPreset"><option value="">Пресет…</option>' + presetOpts + '</select>' +
      '</div>' +
      groups
    );
  }

  function mtWirePanel(root: HTMLElement): void {
    root.querySelector('#mtClose')!.addEventListener('click', () => root.classList.add('hidden'));
    root.querySelector('#mtReset')!.addEventListener('click', mtReset);

    root.querySelector('#mtExport')!.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([mtExport()], { type: 'application/json' }));
      a.download = 'motion-tuning.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    // Import через <input type="file"> — без блокирующего prompt()
    root.querySelector('#mtImport')!.addEventListener('click', () => {
      (root.querySelector('#mtImportFile') as HTMLInputElement).click();
    });
    root.querySelector('#mtImportFile')!.addEventListener('change', (e: any) => {
      const file: File | undefined = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { mtImportText(ev.target!.result as string); }
        catch (err) { console.error('[MT] import error:', err); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    root.querySelector('#mtSavePreset')!.addEventListener('click', () => {
      const i = root.querySelector('#mtPresetName') as HTMLInputElement;
      if (i.value.trim()) mtSavePreset(i.value.trim());
    });

    root.querySelector('#mtPreset')!.addEventListener('change', (e: any) => {
      if (e.target.value) mtApplyPreset(e.target.value);
    });

    root.querySelectorAll('[data-mt]').forEach((el: any) => el.addEventListener('input', (e: any) => {
      mtSet(e.target.dataset.mt, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
      try { localStorage.setItem(MT_STORE_KEY, JSON.stringify(mtSnapshot())); } catch (_) {}
      // синхронизировать slider ↔ number для того же параметра
      root.querySelectorAll('[data-mt="' + e.target.dataset.mt + '"]').forEach((x: any) => {
        if (x !== e.target) x.value = e.target.value;
      });
    }));
  }

  function mtRenderPanel(): void {
    const root = document.getElementById('motionTuningPanel');
    if (!root || root.classList.contains('hidden')) return;
    root.innerHTML = mtBuildHTML(mtPresets());
    mtWirePanel(root);
  }

  function mtOpenPanel(): void {
    let root = document.getElementById('motionTuningPanel');
    if (!root) {
      root = document.createElement('div');
      root.id = 'motionTuningPanel';
      root.className = 'motion-tuning';
      document.getElementById('stage')!.appendChild(root);
    }
    root.classList.remove('hidden');
    mtRenderPanel();
  }

  mtLoad();
