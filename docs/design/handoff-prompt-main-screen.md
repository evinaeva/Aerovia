# Промпт для «claude design» → техническая инструкция по главному экрану

> **Как использовать.** Скопируй весь блок ниже (от «КОНТЕКСТ» до конца) в тот чат
> с Claude, где ты нарисовал макет главного экрана, **после** макета. Claude вернёт
> не картинку, а инструкцию по внедрению в этот репозиторий — её применяет другой
> Claude/разработчик, у которого есть код, но нет твоего макета перед глазами.
> Контракт ниже самодостаточен: design-Claude репозиторий не видит, поэтому все имена
> токенов/классов/иконок вшиты в промпт.

---

КОНТЕКСТ

Ты только что нарисовал макет **главного экрана (start / главное меню)** игры PlaneFlow.
Не рисуй заново. Преврати свой макет в **техническую инструкцию по внедрению** в уже
существующую кодовую базу. Инструкцию применяет другой разработчик/Claude, у которого
есть репозиторий, но **нет твоего макета перед глазами**, — поэтому всё выражай в терминах
кода ниже, без «на глаз» и без расплывчатых прилагательных.

Цель: по твоей инструкции макет должен «натянуться» на проект **быстро и без догадок** —
максимально переиспользуя существующие токены и компоненты, и **явно помечая каждое
отклонение**.

ПРОЕКТ (контракт, которому обязана соответствовать инструкция)

Облик. Один-единственный скин — `neon`: тёмный «ночной радар» с неоновым свечением.
Других палитр/тем нет. Главный экран рисуется **поверх живого игрового canvas** (`#c`,
ночное радар-поле) — фон НЕ плоская заливка, под меню крутится сцена, читаемость даёт
полупрозрачный scrim (`.pf-scrim`). Не вводи новых цветовых идентичностей: каждый цвет
макета сопоставь существующему токену `--m-*`. Если оттенок реально новый — помечай его
`NEW TOKEN` с предложенным именем и значением.

Где живёт код (и куда нельзя писать).
- DOM экранов — `index.template.html` (шаблон). `index.html` — **генерируемый артефакт,
  его не трогаем и как место правки не упоминаем**.
- Все стили — `src/styles.css`.
- JS-обвязка главного меню — `src/game/11-menu-ui.ts` (фрагмент общего IIFE: **без
  import/export**, TypeScript strict).
- Тексты — `src/game/03-i18n.ts`.
- Сборка — `npm run build`; типы — `npm run typecheck`.

Готовые токены (`:root` в `styles.css`) — ПЕРЕИСПОЛЬЗУЙ, не изобретай:
- Поверхности: `--m-panel #0f1c3c`, `--m-panel-2 #0a1228`, `--m-panel-3 #14264e`,
  `--m-panel-border`, `--m-panel-edge` (верхний блик), `--m-panel-shadow`, `--m-divider`.
- Радиусы: `--m-r-panel 14`, `--m-r-card 12`, `--m-r-chip 10`, `--m-r-btn 12`.
- Текст: `--m-text-strong #dff4ff`, `--m-text-body #b9d2e8`, `--m-text-muted #6f88b5`,
  `--m-kicker`.
- Семантика/бренд: `--m-primary #6cc88f` (+`--m-primary-deep`, `--m-primary-text`,
  `--m-primary-glow`), `--m-danger #e85f7e`, `--m-gold #e6c562`, `--m-life`,
  `--m-plane #6fc6dd`, `--m-coin`, `--m-accent #6fc6dd` (+`--m-accent-glow`).
- Ghost-кнопка: `--m-ghost-bg`, `--m-ghost-border`, `--m-ghost-text`.
- Размеры кнопок: `--m-btn-h 52`, `--m-btn-h-lg 60`, `--m-btn-h-sm 42`, `--m-btn-stroke`.
- Поле/scrim: `--m-board` (radial-gradient), `--m-scrim`, `--m-board-blur`.
- Шрифты: `--m-font-display "Fredoka"` (заголовки/бренд), `--m-font-ui "Nunito"` (UI/текст).
- Моушн: `--m-ease`, `--m-ease-bounce`, `--m-dur 0.24s`.

Готовые компоненты (классы) — ПЕРЕИСПОЛЬЗУЙ:
- `.overlay` — полноэкранный слой экрана; `.screen` (inset:0, flex-колонка),
  `.screen--center` (центрирование).
- `.panel` — модальная карточка; ширина через `--panel-w` (деф. 432),
  `.panel--wide` 600 / `.panel--wide2` 680 / `.panel--wide3` 720.
- `.m-btn` — кнопка; модификаторы `--primary` (зелёный CTA), `--ghost` (стеклянная),
  `--danger` (розовая), `--lg`/`--sm`, `--block` (во всю ширину). Внутри:
  `<span class="mic" data-mic="ИМЯ"></span>` (иконка) + `<span class="m-btn__t">текст</span>`.
- `.icon-btn` — квадратная иконочная кнопка; `--flag`, `--danger`.
- `.chip` — чип-счётчик; `--star/--life/--coin/--plane/--time`; внутри `.chip__ic` и `.muted`.
- `.m-title` (`--xl 40 / --lg 32 / --md 26`), `.m-kicker`, `.m-counter`.
- `.switch` (тоггл; `.on`, `.knob`) + `.set-row`/`.set-row__label`/`.set-row__hint`.
- Бренд-блок: `.pf-brand` → `.brand__kicker`, `.brand__mark` (`.brand__plane`,
  `.brand__word` c `.brand__w1`/`.brand__w2`), `.brand__tag`, `.brand__ver`.
- Раскладка старт-экрана: `.pf-main` (full-bleed, дети `position:absolute`), `.pf-scrim`,
  `.pf-chips` (верх-право), `.pf-cta.panel` с `.menu-col` (верт. стек кнопок, право),
  `.pf-corner` (низ-право, кластер иконок), `.corner-debug` (низ-лево).

Иконки. Инлайн-SVG: либо `SVGIC('имя')` в JS (возвращает `<svg>`), либо статикой
`<span class="mic" data-mic="имя"></span>` (заполняется `applyMenuIcons()` на старте).
Цвет наследуется через `currentColor`. Доступные имена:
- контурные: moon, tree, gear, medal, share, list, again, refresh, home, check, back, fwd,
  lock, gift, trophy, bug, hand, clock, inf, expand;
- заливные: play, next, plane, heart, star, coin, pause.
Новую иконку давай как `viewBox="0 0 24 24"`, только `<path>`/примитивы (без обёртки `<svg>`),
и укажи карту: контурную (`_ICO_STROKE`: обернётся `fill=none stroke=currentColor sw=2
linecap/linejoin=round`) или заливную (`_ICO_FILL`: `fill=currentColor`).

i18n. Ни одной зашитой строки. В DOM — `data-i18n="key"` (→ textContent) или
`data-i18n-aria="key"` (→ aria-label); в JS — `t('key')` / `t('key',{n:…})`. Ключи лежат
в объекте `I18N` в `03-i18n.ts`, языки `en` (источник истины) и `ru` (обязан нести тот же
набор ключей — иначе ошибка `tsc`). Существующие ключи старта: `start.kicker`,
`start.tagline`, `start.play`, `start.survival`, `start.version`.

Переключение экранов / обвязка. `hideAllScreens()` прячет все оверлеи `#…Screen`;
`showStart()` показывает старт и зовёт `updateStartChips()`. У каждого интерактивного
элемента — стабильный `id`; вешается в `11-menu-ui.ts` как
`document.getElementById('id')!.onclick = handler`.

ТЕКУЩЕЕ УСТРОЙСТВО ГЛАВНОГО ЭКРАНА (база, от которой считаем диф)

DOM (`#startScreen > .screen.pf-main`):
- `.pf-scrim` — scrim над живым canvas;
- `.pf-chips` → `.chip.chip--star` (`#startStars` / `#startStarsMax`) — сумма звёзд;
- `.pf-brand` — kicker (`start.kicker`) · wordmark `PLANE`/`FLOW` · tagline (`start.tagline`)
  · версия (`start.version` + `#ver`);
- `.pf-cta.panel` → `.menu-col`: `#startBtn` (`.m-btn--primary --lg --block`, play, `start.play`)
  и `#survivalBtn` (`.m-btn--ghost --lg --block`, inf, `start.survival`);
- `.pf-corner` — `#fsBtn` (expand) · `#medalsBtn` (medal) · `#leaderboardBtn` (trophy) ·
  `#settingsMenuBtn` (gear) · `#langFlagBtn` (флаг);
- `.corner-debug` — `#debugToggleBtn` + попап `#debugPop` (дев-чекбоксы).

JS (`11-menu-ui.ts`): `showStart()`, `updateStartChips()`, `hideAllScreens()`; обвязка —
`startBtn→showLevels`, `survivalBtn→showBiomes`, `settingsMenuBtn→openSettings`,
`fsBtn→toggleFullscreen`, `langFlagBtn→cycle lang`. CSS старт-экрана — медиа-блок
`#startScreen .pf-*` в конце `styles.css` (абсолютное позиционирование детей, z-index).

ФОРМАТ ТВОЕЙ ИНСТРУКЦИИ (выдай ровно эти разделы, в этом порядке)

1. **Резюме намерения** — 2–4 строки: что меняется относительно текущего экрана и что
   остаётся. Одно главное действие на экран (одна основная CTA).
2. **Token diff** — таблица: каждый цвет/радиус/тень/размер из макета → существующий
   `--m-*`, либо `NEW TOKEN` (имя + значение + что добавить в `:root`). Никаких сырых hex
   в правилах — только через токены.
3. **DOM-спека** — готовый HTML-фрагмент `#startScreen` как он должен выглядеть в
   `index.template.html`: каждому узлу — `id`, `class`, `data-i18n`/`data-i18n-aria`,
   `data-mic`. Узлы помечай `[ADD]`/`[CHANGE]`/`[REMOVE]` относительно базы выше. Классы —
   из каталога; новые — только если переиспользовать нельзя.
4. **CSS-спека** — добавления/правки в `src/styles.css`, привязанные к существующим
   селекторам; новые правила — только где reuse невозможен; все значения — через токены.
   Учти слой над canvas (`z-index`, scrim) и адаптив (правь блок `#startScreen .pf-*`).
5. **Иконки** — для каждой новой: имя + сырой SVG-path + карта (`_ICO_STROKE`/`_ICO_FILL`).
6. **i18n-ключи** — таблица новых/изменённых ключей с текстами `en` и `ru` (оба обязательны).
7. **JS-обвязка** — для каждого нового/изменённого контрола: его `id`, обработчик и куда
   его вписать в `11-menu-ui.ts` (например: `getElementById('x').onclick = showLevels`).
   Если нужен новый экран — укажи его `id` и добавление в список `hideAllScreens()`.
8. **Лейаут и размеры** — позиции в % / токенах (точки привязки, отступы, max-width),
   landscape-first, крупные тач-зоны под большой палец (правило проекта: «нет мелкому
   мобильному UI»).
9. **Моушн** — через `--m-ease`/`--m-dur` и существующие `@keyframes screenIn`/`panelIn`;
   любые новые переходы выражай в этих терминах.
10. **Чего НЕ трогать** — геометрию геймплея/canvas и `HUD_H`; `index.html`; идентичность
    палитры `--m-*`.
11. **Чек-лист приёмки** — `npm run build` и `npm run typecheck` зелёные; нет новых сырых
    hex и зашитых строк; обе локали (en/ru) влезают; читаемо в landscape на телефоне.

ПРАВИЛА
- Reuse-first: сперва существующий токен/класс/иконка/ключ; новое — только с явной пометкой
  и обоснованием.
- Конкретика: реальные имена `id`/классов/токенов/ключей, copy-paste-ready фрагменты
  HTML/CSS/SVG. Без «красиво», «современно», «воздушно».
- Если макет конфликтует с контрактом (новый цвет, плоский фон вместо живого поля, мелкие
  тач-зоны) — не замалчивай: вынеси в отдельный список «Конфликты с контрактом» с вариантом
  разрешения.
