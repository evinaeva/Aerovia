# Play Games Services — настройка и состояние

> Нативный Google Play Games для Android-сборки (Capacitor). Здесь — **рабочее состояние**
> настройки в Play Console и **ID для кода-моста**. План миграции целиком —
> [`backlog.md`](backlog.md) (раздел «Переход на Capacitor + Capgo»); легаси-путь TWA —
> [`android-twa.md`](android-twa.md); список медалей — [`achievements.md`](achievements.md).

## Личность проекта

| Поле | Значение |
|---|---|
| Application ID (PGS) | `533472253687` |
| Package / applicationId | `com.planeflow.game` (вечный, не менять) |
| Язык по умолчанию | English (`en-US`) |
| Статус | Черновик (не опубликовано) |

## Достижения — первая партия (5 из 49, черновик)

Условие выдачи живёт в коде (`ACH` в `src/game/12-achievements-medals.ts`); Play Games
хранит только витрину (название/описание/иконка/очки/тип). Маппинг «медаль в игре →
достижение Play Games» для кода-моста:

| medal id (код) | PGS Name | PGS achievement ID | Тип | Очки |
|---|---|---|---|---|
| `land1` | First Contact | `CgkI962yq8MPEAIQAw` | standard | 5 |
| `svc1` | Hands On | `CgkI962yq8MPEAIQBA` | standard | 5 |
| `takeoff1` | Bon Voyage | `CgkI962yq8MPEAIQBQ` | standard | 5 |
| `level1` | Shift Done | `CgkI962yq8MPEAIQAQ` | standard | 10 |
| `land10` | Tower Trainee | `CgkI962yq8MPEAIQAg` | incremental (10 шагов) | 10 |

Использовано **35 / 2000** очков. Остальные 44 медали — следующими партиями (тип и
hidden/revealed фиксируются на публикации, поэтому добавляем партиями и тестируем).

## Лидерборд

| Name | ID | Формат | Порядок |
|---|---|---|---|
| Survival — Forest | `CgkI962yq8MPEAIQAA` | Numeric | Larger is better |

## Локализация (RU — в работе)

Тексты EN залиты (это дефолтная локаль). RU пока нет: bulk-импорт
`AchievementsLocalizations.csv` отклоняет `ru-RU`, пока русский не добавлен в языки игры,
и нельзя дублировать дефолтную локаль (`en-US`). Способ: открыть каждую ачивку в
Достижениях → «Добавить перевод» → Russian (это заводит язык), либо после этого —
повторный импорт только `ru-RU`-строк. Готовые тексты — в [`achievements.md`](achievements.md)
и `play-games-import/files/AchievementsLocalizations.csv`.

## Что редактируется после публикации

- ✅ **Меняется всегда:** название, описание, иконка, очки, порядок; **условие выдачи** (это код).
- ❌ **Фиксируется на публикации:** тип (standard/incremental + число шагов), hidden/revealed;
  **удалить ачивку нельзя** (только до публикации). Лидерборды удаляются и после публикации.
- → Поэтому **публикуем только после теста** по черновику (тестерам черновик доступен без публикации).

## Импорт-тулинг

`play-games-import/` — генератор иконок (`build-icons.mjs`, Playwright/Chromium: 512×512
неон-диск + эмодзи) и CSV для bulk-импорта. Иконки/ZIP — **плейсхолдеры** (в .gitignore,
регенерируются скриптом); перед публикацией заменить реальным артом (иконки правятся всегда).
CSV — **без строки заголовков**, ключ — колонка `Name`, ZIP — **без подпапок**.

## Осталось

1. ⏸️ **Credentials (#3)** — вписать **debug SHA-1** Capacitor-сборки (package `com.planeflow.game`);
   release-SHA из Play App Signing — позже.
2. ⏸️ **SDK (#4)** — Capacitor + плагин Play Games + мост (`Account.authProvider` /
   `Leaderboard.provider` / `ACH.unlock` по таблице выше).
3. ✅ **Тестеры** — аккаунт-владелец добавлен; при тесте на телефоне с другим аккаунтом — добавить его.
4. 🚫 **Публикация (#6)** — только после теста на телефоне.
