# Google Play — Data Safety (готовые ответы)

Форма Data Safety в Play Console заполняется по **фактическому поведению той сборки,
что публикуется**. Учитываем **две оси**: (1) подключён ли **нативный Google Play Games**
(см. раздел ниже — для Android-сборки на Capacitor он **обязателен** и сам по себе делает
ответ «Yes»); (2) подключён ли провайдер **аналитики** (сценарии A/B). Связано с
[`analytics.md`](analytics.md), [`play-games-setup.md`](play-games-setup.md) и
[`privacy.html`](../privacy.html).

> Ключевое правило Google: **«сбор» = данные ПЕРЕДАЮТСЯ с устройства.** Хранение только
> локально (localStorage) сбором НЕ считается.

Privacy policy URL для формы: `https://planeflow.jevgenia.com/privacy.html`

> **TL;DR для Android-сборки (Capacitor + Play Games).** Как только в сборке есть нативный
> вход Play Games (`Account.authProvider`/`Leaderboard.provider`/`ACH.unlock`), идентификатор
> игрока и счета/ачивки уходят на серверы Google → **«Does your app collect or share data?» = Yes**,
> даже если аналитика ещё на сценарии A. Заполняем блок «Play Games» ниже + (если есть)
> сценарий B по аналитике. Веб-сборка (PWA на Pages) Play Games не использует → для неё годится
> сценарий A.

---

## Play Games (Android-сборка) — обязательно при нативном входе

> Применяется к Android-сборке с подключённым нативным Play Games (план — раздел
> «Переход на Capacitor + Capgo» в [`backlog.md`](backlog.md), ID — в
> [`play-games-setup.md`](play-games-setup.md)). Вход **опциональный** (играть можно без него),
> но в сборке функция есть → её декларируем.

**Does your app collect or share any of the required user data types?** → **Yes**
(Collected: Yes. Shared: No — данные обрабатывает Google Play Games Services от имени игрока,
не передаём третьим лицам для их целей.)

| Data type | Категория Play | Collected | Purpose | Optional? |
|---|---|---|---|---|
| Play Games player ID (идентификатор игрока) | **Device or other IDs** | Yes | App functionality | Optional* |
| Отображаемое имя (gamer tag) и аватар Play Games | **Personal info** → Name | Yes | App functionality | Optional* |
| Ачивки и счёт в лидербордах (прогресс) | **App activity** → In-app actions | Yes | App functionality | Optional* |

\* **Optional**, т.к. данные уходят только если игрок **сам вошёл** через Play Games; без входа
наружу ничего не идёт.

Дополнительно по каждому типу:
- **Shared with third parties:** No (обработка платформой Google Play Games от имени игрока —
  это не «sharing» в смысле Play; саму платформу указываем в privacy policy).
- **Processed ephemerally:** No (ачивки/рекорды хранятся на стороне Google).
- **Data encrypted in transit:** Yes.
- **Users can request deletion:** да — игрок управляет gamer-tag, ачивками и счётами и удаляет
  их через свой Google-аккаунт / настройки Play Games (ссылки — в [`privacy.html`](../privacy.html)).

> Эти данные собирает и обрабатывает **Google** (Play Games Services) под
> [политикой Google](https://policies.google.com/privacy); наша задача — задекларировать факт
> и сослаться на Google в privacy policy. Если аналитика тоже подключена — объединить
> декларации с таблицей сценария B (не дублировать одинаковые типы).

---

## Сценарий A — без Play Games и без провайдера аналитики (веб/PWA)

Применяется к сборке **без нативного Play Games** (веб-версия на Pages) и пока провайдер
аналитики не подключён. Аналитика пишется только в локальный буфер (sink = console +
localStorage), **наружу ничего не уходит**. Прогресс/настройки — тоже локально.

> ⚠️ Для **Android-сборки с Play Games** этот сценарий НЕ годится — см. блок «Play Games»
> выше (ответ становится **Yes**).

**Does your app collect or share any of the required user data types?** → **No**

Обоснование (на случай вопросов ревью): всё хранится на устройстве, не передаётся на
серверы, стирается при очистке данных/удалении приложения. Личные данные не собираются.

Остальные поля:
- **Data encrypted in transit:** Yes (сайт по HTTPS).
- **Users can request data deletion:** аккаунта нет; данные на устройстве, удаляются
  очисткой данных/удалением приложения (описано в privacy policy).

---

## Сценарий B — когда подключим провайдера (Firebase/GA4/свой бэкенд)

Как только `Analytics.sink` начнёт слать события на сервер — **переключить форму на
Yes** и задекларировать ниже. Анонимно, без рекламы, не продаём.

**Does your app collect or share any of the required user data types?** → **Yes**
(Collected: Yes. Shared: No — данные идут только нашему процессору, не третьим лицам для
их целей.)

| Data type | Категория Play | Collected | Purpose | Optional? |
|---|---|---|---|---|
| Случайный идентификатор установки (UUID) | **Device or other IDs** | Yes | Analytics | —* |
| Игровые события (level start/finish, tutorial, настройки), сессии | **App activity** → In-app actions | Yes | Analytics | —* |
| Версия приложения, язык, платформа, размер экрана | **App info and performance** → Diagnostics | Yes | Analytics | —* |
| Ошибки/краши | **App info and performance** → Crash logs | Yes | App functionality, Analytics | —* |

\* Если согласие через `Analytics.setConsent` сделаем опциональным баннером — отметить
данные как **Optional** (пользователь может отказаться). Если шлём всегда после
обязательного согласия — **Required**.

Дополнительно по каждому типу:
- **Shared with third parties:** No (передача провайдеру-обработчику от нашего имени не
  считается «sharing» в смысле Play, но провайдера указать в privacy policy).
- **Processed ephemerally:** No (храним для агрегированной статистики).
- **Data encrypted in transit:** Yes.
- **Users can request deletion:** идентификатор анонимный; описать механизм (сброс
  идентификатора / запрос на удаление по email из privacy policy).

> При выборе провайдера свериться с его документацией по Data Safety (у Firebase/GA4
> есть готовая таблица соответствия) и обновить и форму, и [`privacy.html`](../privacy.html).
