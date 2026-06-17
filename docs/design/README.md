# PlaneFlow — дизайн-хаб

Единое место для **всего по дизайну и арту**: визуальная библия, геймдизайн, облик и
брифы для художника, wireframes, референсы и рабочие материалы. Раньше это было
разбросано по `docs/art-direction/`, `assets/design/` и `assets/references/` — теперь
собрано здесь.

> Рантайм-арт (то, что грузит сама игра) живёт отдельно в
> [`../../assets/sprites/`](../../assets/sprites/README.md) и
> [`../../assets/icon/`](../../assets/icon/) — его не трогаем.

## Структура

| Папка | Что внутри |
| --- | --- |
| [`art-direction/`](art-direction/README.md) | **Визуальная библия**: стиль, камера, палитра, UI-правила, библиотека объектов, do/don't, референс-панели. |
| [`game-design/`](game-design/README.md) | **Геймдизайн**: игровой цикл, прогрессия/уровни, события, типы бортов/аэропортов, MVP-план. |
| [`skins/`](skins/README.md) | **Облик игры (neon) и бриф для художника** + как нарисованный арт встаёт в движок (PNG-пайплайн). |
| [`wireframes/`](wireframes/README.md) | Отрисованные **макеты всех экранов** + screen-flow (генератор `build.py`). |
| [`style-explore/`](style-explore/README.md) | Разведка визуальных стилей геймплея (выбран `neon`). |
| [`references/`](references/) | Мастер-референсы стайл-гайда (картинки). |
| [`sprite-batches/`](sprite-batches/) | Ранние партии спрайт-продакшна (`batch2`). |
| [`integration/`](integration/PLAN.md) | План интеграции дизайн-системы + референс-лоадер спрайтов. |

## Ходовые файлы (start here)

- **Арт-библия (с этого начинают):** [`art-direction/art_direction_v1.md`](art-direction/art_direction_v1.md)
- **Палитра / цветовые токены:** [`art-direction/color_palette.md`](art-direction/color_palette.md)
- **UI-правила (HUD, кнопки, иконки, motion):** [`art-direction/ui_rules.md`](art-direction/ui_rules.md)
- **Wireframes / раскладка экранов:** [`art-direction/wireframes.md`](art-direction/wireframes.md) (рендеры — в [`wireframes/`](wireframes/README.md))
- **Игровой цикл:** [`game-design/gameplay_loop.md`](game-design/gameplay_loop.md)
- **Прогрессия и уровни:** [`game-design/progression.md`](game-design/progression.md)
- **Облик — обзор и пайплайн:** [`skins/README.md`](skins/README.md)
- **Бриф облика (neon):** [`skins/neon/BRIEF.md`](skins/neon/BRIEF.md)

## Связанное (вне хаба)

- **Рантайм-спрайты + спека токенов:** [`../../assets/sprites/README.md`](../../assets/sprites/README.md)
- **Иконка приложения:** [`../../assets/icon/`](../../assets/icon/)
- **Правила игры (для игрока):** [`../FAQ.md`](../FAQ.md)
- **Дев-доки (устройство кода):** [`../DEV.md`](../DEV.md)
- **Статус готовности ассетов:** [`../assets.md`](../assets.md)
- **Бриф проекта:** [`../tower_project_brief.md`](../tower_project_brief.md)
