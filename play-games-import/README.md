# play-games-import

Плейсхолдер-ассеты и bulk-импорт достижений для Play Games Services.
Состояние настройки и все ID — в [`../docs/play-games-setup.md`](../docs/play-games-setup.md).

- `build-icons.mjs` — генератор иконок 512×512 (Playwright/Chromium): неон-диск + эмодзи медали.
- `files/Achievements*.csv` — данные bulk-импорта. CSV **без строки заголовков**; ключ,
  связывающий все три файла, — колонка `Name`.
- Иконки (`*.png`) и `*.zip` — генерируемые плейсхолдеры (в `.gitignore`), регенерируются скриптом.

## Регенерация и импорт

    npx playwright install chromium      # один раз
    node play-games-import/build-icons.mjs

Затем запаковать содержимое `files/` (+ нужные `*.png`) в ZIP **без подпапок** и
импортировать: Play Console → Достижения → Импорт.

## RU-локализация

`files/AchievementsLocalizations.csv` Play Console отклоняет, пока в игре не добавлен
русский язык и пока строки дублируют дефолтную локаль `en-US`. Подробности и обходной
путь — в [`../docs/play-games-setup.md`](../docs/play-games-setup.md).
