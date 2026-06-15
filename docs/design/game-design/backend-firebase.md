# PlaneFlow — боевой бэкенд рейтингов на Firebase + анти-чит + анти-пиратство

> Дизайн-документ перехода от **каркаса** рейтингов (см. [`leaderboards.md`](leaderboards.md))
> к **боевому** соревновательному слою: реальные аккаунты, серверная валидация счёта против
> накрутки, и защита Play-сборки от перезалитых клонов. Решение продукт-овнера **2026-06-15**:
> бэкенд — **Firebase** (не свой VPS), вход — **Google** (через Firebase Auth), защита от
> накрутки и клонов — **серверная валидация + Firebase App Check c Play Integrity**.
>
> Этот док — **план (Фаза 0)**. Код ещё не пишем; здесь зафиксированы решения, контракты и
> точные изменения по файлам, чтобы фазы 1–3 шли без переоткрытия вопросов.
>
> Смежные доки: каркас и метрика — [`leaderboards.md`](leaderboards.md); приватность —
> [`../../play-data-safety.md`](../../play-data-safety.md), [`../../../privacy.html`](../../../privacy.html);
> бэклог — [`../../backlog.md`](../../backlog.md).

---

## TL;DR — два вопроса, один корень

1. **Можно ли подделать счёт / рейтинг Survival?** Сейчас — да, тривиально (клиентский
   счёт, mock-провайдер в `localStorage`, прямой вызов `window.PFLeaderboard.submitRun`).
   Честный рейтинг возможен **только с сервером-источником истины**.
2. **Как защитить игру от копирования вне Google Play?** Код PWA открыт by design (статический
   сайт на GitHub Pages) — «спрятать» его нельзя. Защищаем **сервис**, а не байты: чужой
   клон без нашего бэкенда теряет рейтинги/аккаунты, а **App Check c Play Integrity** не пускает
   запросы из неподлинных сборок.

Оба вопроса закрываются одним бэкендом. Firebase выбран потому, что даёт вход Google,
серверные функции, правила доступа и App Check «из коробки», без администрирования сервера.

---

## Почему Firebase, а не свой VPS

| | Firebase | Свой VPS (Contabo) |
| --- | --- | --- |
| Администрирование (ОС, TLS, бэкапы, мониторинг) | нет (managed) | всё на нас |
| Вход Google | из коробки (Firebase Auth) | пишем сами (OAuth) |
| Анти-клон (App Check + Play Integrity) | из коробки | интегрируем сами |
| Серверная логика | Cloud Functions | свой рантайм |
| Цена на старте | бесплатный тир (Spark) | фикс. $/мес |
| Риск при росте | счёт растёт с нагрузкой → следить за схемой | фикс. цена, но потолок мощности |

Для инди-масштаба нагрузка крошечная (запись/чтение строк, лёгкая валидация). Свой VPS —
**план Б** на случай, если упрёмся в лимиты или захотим тяжёлый replay-движок (Фаза 3).
Бесплатный тир Firebase: следим, чтобы чтения не разрастались (хранить **топ-N агрегатом**,
не читать всех игроков на каждый запрос).

---

## Архитектура — тот же свопаемый провайдер

Каркас уже изолировал всё в две точки замены — **код игры вокруг не меняется**:

```
игра (endLevel, экран рейтинга)
        │  submitRun() / top() / me() / bestScore()      ← НЕ меняются
        ▼
   Leaderboard ── provider ─►  [ mockProvider ]   ← офлайн-fallback (остаётся!)
        │                      [ firebaseProvider ] ← онлайн, через Cloud Functions
        └─ account ─► Account ── authProvider ─► [ mockAuth ] ← офлайн-fallback
                                                 [ firebaseAuth (Google) ] ← онлайн
```

- `Leaderboard.provider` — сеттер с проверкой формы `{submit, top}`, см.
  `src/game/07-audio-services.js:289`.
- `Account.authProvider` — сеттер `() => Promise<{id,name,provider}>`, см.
  `src/game/07-audio-services.js:248`.
- **Mock остаётся офлайн-fallback'ом.** PWA обязана работать без сети; при отсутствии сети/конфига
  игра тихо падает на локальный mock (рейтинг — демо), при появлении сети — на Firebase.

---

## Угрозы и меры (что именно ломается сейчас)

| Вектор | Где сейчас | Мера в боевом бэкенде |
| --- | --- | --- |
| Счёт — клиентская переменная `served`, шлётся как есть | `10-scene-loop.js:137`, `07-audio-services.js:296` | **Сервер — источник истины:** Cloud Function валидирует и пишет; клиентскому числу не доверяем |
| Прямой вызов `window.PFLeaderboard.submitRun({score:1e9})` | дев-экспорт `Leaderboard` | App Check (запрос только из подлинного клиента) + sanity-потолки на сервере |
| Правка `localStorage` (`pf_lb_v1`, `pf_save_v1`, `pf_account_v1`) | mock-провайдер | данные рейтинга живут в Firestore, не в браузере |
| `ts` ставит клиент | `07-audio-services.js:296` | **серверный timestamp** (`FieldValue.serverTimestamp()`), клиентский игнорируем |
| `accountId` из тела запроса | `07-audio-services.js:295` | берём из **проверенного auth-токена** (`context.auth.uid`), не из payload |
| Debug-читы (`pf_debug`: infiniteLives и т.п.) накручивают заход | `06-state-layout.js`, `08-gameplay.js:421` | клиент **не шлёт** заход, если активны читы; сервер дополнительно метит/режет выбросы |
| Перезалитый APK / чужой хост | TWA = обёртка над открытым сайтом | **App Check c Play Integrity** — функции принимают только подлинную сборку из Play |
| Ник без модерации | `Account.setName` (slice 24) | серверная санитизация/фильтр + при необходимости модерация |

---

## Контракт Cloud Functions (Фаза 2)

Две callable-функции (HTTPS callable, авторизация + App Check проверяются автоматически):

### `submitRun(data) → { score, ranks:{ alltime, month, week } }`
- **Вход (от клиента):** `{ mode:'survival', score:Number }` — и **на Фазе 3** ещё
  `replay` (см. ниже). Больше клиенту не доверяем ничего.
- **Сервер:**
  1. `uid = context.auth.uid` (иначе — отказ); App Check валиден (иначе — отказ).
  2. Санити: `mode ∈ {survival}`, `0 ≤ score ≤ HARD_CAP` (потолок исходя из достижимого темпа
     `paceCap`/времени; считаем по `04-config-levels.js`). Выбросы режем/флагуем.
  3. **Фаза 3:** если есть `replay` — переиграть детерминированную партию и **взять серверный
     `served`**, клиентский `score` использовать только для сверки (расхождение → отклонить).
  4. Запись `{ accountId:uid, name, mode, score, ts:serverTimestamp() }`.
  5. Обновить агрегаты топов; вернуть место игрока в каждом срезе.
- **Периоды** считаются той же чистой функцией `periodBucket` (UTC, ISO-8601), что и на клиенте
  (`leaderboards.md` → «Периоды»). Контракт срезов на сервере **обязан совпадать** с клиентом.

### `top(period, mode) → [{ rank, accountId, name, score, ts }] (≤ TOP_N)`
- Чтение агрегата лучшего-на-аккаунт за срез. **Не** читать всю коллекцию на каждый вызов
  (стоимость Firestore) — держать денормализованный топ-N документ, обновляемый в `submitRun`.

> `firebaseProvider` в игре — тонкая обёртка: `submit(entry)` → `httpsCallable('submitRun')`,
> `top(p,m)` → `httpsCallable('top')`. Сигнатуры идентичны mock — `submitRun()`/`top()`/UI не меняются.

---

## Модель данных Firestore (черновик)

```
runs/{autoId}            // журнал (append-only), serverTimestamp
  accountId, name, mode, score, ts, v, flagged?
leaderboard/{mode}/{period}   // денормализованный топ-N (для дешёвого top())
  entries: [{ accountId, name, score, ts }]   // отсортировано, ≤ TOP_N
accounts/{uid}
  name, createdAt, bestScore:{survival:Number}
```

- **Security Rules:** прямой доступ клиента на запись в `runs`/`leaderboard` — **запрещён**.
  Пишет только Cloud Function (admin). Клиент читает `leaderboard/*` (публичный топ) и свой `accounts/{uid}`.
- Это и есть «сервер — источник истины»: клиент физически не может вписать счёт мимо функции.

---

## Идентичность — Google-вход через Firebase Auth (не Play Games)

⚠️ Уточнение к каркасу: приложение в Play — **TWA (веб)**, не нативное. Полноценный
**Play Games Services**-вход — нативная интеграция, в чистом TWA неудобен. Практичный путь —
**Firebase Auth с Google-провайдером** (web OAuth, redirect/popup). Функционально закрывает
реальные аккаунты и кросс-девайс профиль; встаёт в `Account.authProvider`, ничего вокруг не
трогая. `mockAuth` остаётся офлайн-fallback'ом.

- `firebaseAuth = () => signInWithGoogle().then(u => ({ id:u.uid, name:u.displayName||null, provider:'google' }))`.
- Аккаунт по-прежнему переживает «Сбросить прогресс» (ключ `pf_account_v1` — кэш профиля).

---

## Анти-пиратство (Вопрос 2) — защищаем сервис, не байты

Полностью запретить копирование открытого PWA нельзя. Что реально работает (по убыванию силы):

1. **Firebase App Check + провайдер Play Integrity.** Cloud Functions принимают запросы
   **только из подлинного, неизменённого APK из Play**. Перезалитый клон или чужой сайт не
   получат валидный App Check-токен → рейтинги/аккаунты для них не работают. Это главный рычаг.
2. **Digital Asset Links — уже есть** (`.well-known/assetlinks.json`, отпечаток ключа подписи).
   Чужой APK не сможет открывать наш домен в полноэкранном TWA без адресной строки. **Условие:**
   `android.keystore` — в секрете, использовать **Play App Signing**.
3. **Ценность на сервере.** Топы/медали/синхронизация работают только через наш бэкенд →
   клон без него теряет соревновательную часть. (Соло-игра у клона останется — это неизбежно.)
4. **Косметика (слабая, по желанию):** проверка `location.hostname` на старте, минификация
   бандла. Обходится легко — не считать защитой.

---

## Приватность / Play Data Safety (блокер релиза)

Реальные аккаунты с никами и e-mail Google = **персональные данные**. До публикации обновлённой
сборки с входом:
- обновить [`../../../privacy.html`](../../../privacy.html) (что собираем: Google-аккаунт, ник, счёт);
- обновить форму **Play Data Safety** ([`../../play-data-safety.md`](../../play-data-safety.md));
- решить хранение/удаление (право на удаление аккаунта — функция `deleteAccount`).

Это **обязательное** условие Google Play, не опциональное.

---

## Изменения по файлам (для фаз 1–3)

| Файл | Изменение | Фаза |
| --- | --- | --- |
| `index.template.html` | подключить Firebase compat-SDK через CDN `<script>` (auth, functions, app-check) | 1 |
| `src/game/07b-firebase.js` (новый) | `firebaseProvider {submit,top}` + `firebaseAuth` + init App Check; конфиг проекта | 1 |
| `scripts/build.mjs` | добавить новый модуль в список конкатенации (после `07`) | 1 |
| `src/game/13-init.js` | при онлайне/конфиге: `Leaderboard.provider=firebaseProvider; Account.authProvider=firebaseAuth`; иначе mock | 1 |
| `src/game/07-audio-services.js` | блокировать сабмит при активных `pf_debug`-читах (пометка/skip) | 1 |
| Firebase проект | Cloud Functions `submitRun`/`top`/`deleteAccount`, Firestore Rules, App Check (Play Integrity), денормализация топ-N | 2 |
| `src/game/08-gameplay.js` (+submit payload) | запись лога инпутов партии (seed спавнов + тапы) для replay | 3 |
| `privacy.html`, `docs/play-data-safety.md` | данные аккаунта/ника | до релиза |

**Не меняются:** `submitRun()` caller в `endLevel`, экран рейтинга, ранг-медали `ACH.onRank`,
метрика `served`, `periodBucket`. Каркас для этого и строился.

> Замечание по сборке: `index.html` — генерируемый артефакт (конкатенация `src/`, без бандлера),
> поэтому Firebase подключаем **compat-SDK через CDN** (глобальный `firebase`, совместим с
> не-модульным IIFE игры) — проще, чем тянуть npm-бандл в `build.mjs`.

---

## Фазы

| Фаза | Что | Где | Статус |
| --- | --- | --- | --- |
| **0** | Этот дизайн-док: решения, контракты, изменения по файлам | `docs/` | ← сейчас |
| **1** | Firebase-провайдер + Google-вход + swap в init (mock как fallback) + блок сабмита при читах | `src/game/` | план |
| **2** | Cloud Functions (серверный `ts`/`uid`, sanity-валидация) + Firestore Rules + App Check (Play Integrity) | Firebase | план |
| **3** | Replay-валидация: лог инпутов в геймплее + серверный пересчёт `served` | `08-gameplay.js` + Firebase | позже |
| **—** | privacy.html + Play Data Safety | docs | до релиза |

---

## Открытые вопросы продукт-овнеру

1. **Google-вход** подтверждаем как способ входа (вместо нативного Play Games)? — рекомендуется для TWA.
2. **HARD_CAP счёта** для sanity-валидации Фазы 2 — вывести из `paceCap`/времени; нужен разумный
   потолок «бортов за N минут».
3. **Replay (Фаза 3)** — делаем сразу серьёзно или сначала запускаем с sanity-потолками + App Check,
   а replay добавляем по факту накрутки?
4. **Удаление аккаунта** — обязательная функция для Play Data Safety; подтвердить объём данных.
