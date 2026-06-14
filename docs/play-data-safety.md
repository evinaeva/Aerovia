# Google Play — Data Safety (готовые ответы)

Форма Data Safety в Play Console заполняется по **фактическому поведению той сборки,
что публикуется**. У нас два сценария — выбираем по тому, подключён ли провайдер
аналитики. Связано с [`analytics.md`](analytics.md) и [`privacy.html`](../privacy.html).

> Ключевое правило Google: **«сбор» = данные ПЕРЕДАЮТСЯ с устройства.** Хранение только
> локально (localStorage) сбором НЕ считается.

Privacy policy URL для формы: `https://planeflow.jevgenia.com/privacy.html`

---

## Сценарий A — текущая сборка (провайдер НЕ подключён)

Аналитика пишется только в локальный буфер (sink = console + localStorage), **наружу
ничего не уходит**. Прогресс/настройки — тоже локально.

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
