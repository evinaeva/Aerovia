# PlaneFlow — боевой бэкенд: Play Games (Android) + Firebase (веб) + анти-чит/анти-пиратство

> Дизайн-документ перехода от **каркаса** рейтингов (см. [`leaderboards.md`](leaderboards.md))
> к боевому соревновательному слою. Решение продукт-овнера **2026-06-15** (обновлено):
>
> - **Android:** упаковка **Capacitor** (вместо TWA) + **Google Play Games Services (PGS)** —
>   медали игрока становятся ачивками в Google Play, начисляется **XP/уровень Play Games**,
>   лидерборд Survival ведётся нативным лидербордом PGS.
> - **Веб (PWA на сайте):** **Firebase** (вход Google + Cloud Functions + Firestore) как
>   рейтинг/идентичность для браузерных игроков, которым PGS недоступен.
> - **Анти-чит/анти-пиратство:** сервер — источник истины + **Play Integrity** (через App Check
>   на вебе и нативно на Android).
>
> Это **план**. Код пишем по фазам ниже. Здесь зафиксированы решения, контракты и точные
> изменения по файлам, чтобы фазы шли без переоткрытия вопросов.
>
> Смежные доки: каркас/метрика — [`leaderboards.md`](leaderboards.md); медали —
> [`achievements.md`](../../achievements.md) и `src/game/12-achievements-medals.js`;
> приватность — [`../../play-data-safety.md`](../../play-data-safety.md),
> [`../../../privacy.html`](../../../privacy.html); бэклог — [`../../backlog.md`](../../backlog.md).

---

## TL;DR

1. **Можно ли подделать счёт Survival?** Сейчас — тривиально (клиентский `served`, mock в
   `localStorage`, прямой `window.PFLeaderboard.submitRun`). Честный рейтинг — только с
   **сервером-источником истины**.
2. **Защита от копирования вне Google Play?** Код открыт by design — защищаем **сервис**:
   **Play Integrity** не пускает запросы из неподлинных сборок; клон без нашего бэкенда/PGS
   теряет рейтинги, ачивки и XP.
3. **Медали/опыт в аккаунте Google Play?** Только через **Play Games Services**, а PGS требует
   **нативного моста** — поэтому Android-упаковка меняется с TWA на **Capacitor**.

---

## Платформенная развилка

| | **Android (Play)** | **Веб (PWA на сайте)** |
| --- | --- | --- |
| Упаковка | **Capacitor** (WebView + нативные плагины) | как сейчас — статический PWA на GitHub Pages |
| Идентичность | **Play Games sign-in** | **Firebase Auth (Google)** |
| Ачивки/XP | **PGS achievements** (видны в Google Play, дают XP) | медали остаются внутри игры (PGS на вебе нет) |
| Лидерборд Survival | **нативный лидерборд PGS** | **Firebase** (Cloud Functions + Firestore) |
| Анти-чит | Play Integrity + серверный сабмит в PGS | App Check (Play Integrity provider) + Cloud Function |

> **Почему так.** PGS — нативный Android-слой Google; из чистого веба он недоступен, поэтому
> на сайте его не будет в принципе. Зато на Android он бесплатно даёт ачивки/XP/лидерборд
> прямо в Google Play и базовый антифрод. Веб-игроки обслуживаются параллельно через Firebase.
> Игровой код один; различается лишь, **какой провайдер** подключается на старте.

---

## ⚠️ Последствие смены TWA → Capacitor (важно зафиксировать)

Текущий TWA **грузит живой сайт** — поэтому работает «запушил репо → мгновенное обновление»
(см. `sw.js`). **Capacitor по умолчанию упаковывает веб-сборку внутрь APK** и крутит её из
локального WebView. Плюсы: самодостаточность, нативные плагины (PGS), офлайн. Минус: **обновление
Android-сборки идёт через релиз нового APK в Play**, а не мгновенно из репозитория.

- **Веб-версия (PWA)** сохраняет мгновенные обновления — ничего не теряет.
- Для Android либо принимаем релизный цикл Play (норма для игр), либо позже добавляем
  live-update (например Capgo) — **открытый вопрос**, не блокер.
- `.well-known/assetlinks.json`: его роль «делегирование TWA» уходит; остаётся полезен для
  App Links/диплинков и подписи. Не удаляем — переосмысляем при переходе.

---

## Архитектура — тот же свопаемый провайдер, выбор по платформе

Каркас уже изолировал всё в две точки — **игровой код вокруг не меняется**:

```
игра (endLevel, экран рейтинга, ACH.give/giveForce)
        │  submitRun() / top() / unlock(medalId)        ← НЕ меняются
        ▼
   Leaderboard ── provider ─►  выбор на старте по платформе:
        │                       [ pgsProvider ]      ← Android (Capacitor + Play Games)
        │                       [ firebaseProvider ] ← Веб (Cloud Functions + Firestore)
        │                       [ mockProvider ]     ← офлайн/без сети (остаётся fallback)
        └─ account ─► Account ── authProvider ─► [ pgsAuth ] / [ firebaseAuth ] / [ mockAuth ]
```

- `Leaderboard.provider` — сеттер `{submit, top}`, см. `src/game/07-audio-services.js:289`.
- `Account.authProvider` — сеттер `()=>Promise<{id,name,provider}>`, см. `:248`.
- **Медали → PGS:** новый тонкий хук в `ACH.give`/`ACH.giveForce`
  (`src/game/12-achievements-medals.js:77,92`) при разблокировке вызывает нативный
  `unlockAchievement(pgsId)` на Android. На вебе/в mock хук — no-op.

---

## Play Games Services — ачивки, XP, лидерборд (Android)

### Ачивки и XP
- Каждую медаль из `defs` (`12-achievements-medals.js:12-70`, ~48 шт. со стабильными `id`)
  заводим как **achievement в Play Console**. Таблица соответствия `medalId → pgsAchievementId`
  живёт в новом нативном/JS-мосте.
- **XP/уровень Play Games считает Google сам** из очков, назначенных ачивкам в Play Console —
  отдельно «давать опыт» не нужно. Это и есть «опыт в аккаунте Google Play».
- Накопительные медали (с `prog`, напр. `land10000`) удобно делать **incremental
  achievements** PGS; одноразовые — **standard**.
- Скрытые (`hidden:true`) → PGS hidden achievements. Соревновательные (`comp:true`,
  ранг-медали) — тоже ачивки, выдаются через `giveForce`.

### Лидерборд Survival
- Нативный **PGS-лидерборд** с метрикой `served`. PGS даёт встроенные срезы daily/weekly/all-time
  — близко к нашим week/month/all (расхождение month↔weekly зафиксировать в UI; см. открытый вопрос).
- **Анти-чит:** не сабмитить счёт прямо с клиента в PGS (он клиент-доверчив). Хардовый путь —
  **серверный сабмит**: клиент получает *server auth code* от PGS, шлёт на Cloud Function,
  функция меняет его на токен и пишет счёт/ачивку в **PGS REST API** уже после валидации.
  То есть Firebase участвует и для Android — как валидатор перед PGS.

---

## Firebase — веб-рейтинг + валидатор (общий)

- **Веб-идентичность:** `firebaseAuth = () => signInWithGoogle().then(u=>({id:u.uid,name:u.displayName||null,provider:'google'}))`.
- **Cloud Functions** (callable, авто-проверка auth + App Check):

  **`submitRun({mode,score[,replay]}) → {score, ranks:{alltime,month,week}}`**
  1. `uid = context.auth.uid` (иначе отказ); App Check валиден (иначе отказ).
  2. Санити: `mode∈{survival}`, `0 ≤ score ≤ HARD_CAP`. **HARD_CAP выводим из `paceCap` и
     времени** (макс. бортов в минуту × длительность) — продукт-овнер подтвердил принцип.
  3. **Фаза 3 (replay):** если есть `replay` — переиграть детерминированную партию, взять
     **серверный `served`**, клиентский `score` — только для сверки (расхождение → отказ).
  4. Запись с **серверным `ts`** (`serverTimestamp()`); `accountId` = `uid` (не из payload).
  5. Обновить агрегат топ-N; вернуть места по срезам.

  **`top(period,mode)`** — чтение денормализованного топ-N (не вся коллекция — экономия Firestore).

  **`deleteAccount()`** — **полное удаление** всех данных игрока (см. приватность).

- **Периоды** — та же чистая `periodBucket` (UTC/ISO-8601), что на клиенте (`leaderboards.md`).

---

## Модель данных Firestore (веб) — черновик

```
runs/{autoId}                 // append-only, serverTimestamp
  accountId, name, mode, score, ts, v, flagged?
leaderboard/{mode}/{period}   // денормализованный топ-N для дешёвого top()
  entries: [{ accountId, name, score, ts }]   // ≤ TOP_N
accounts/{uid}
  name, createdAt, bestScore:{survival:Number}
```
- **Security Rules:** прямая запись клиента в `runs`/`leaderboard` запрещена — пишет только
  Cloud Function (admin). Клиент читает публичный `leaderboard/*` и свой `accounts/{uid}`.

---

## Угрозы → меры

| Вектор | Где сейчас | Мера |
| --- | --- | --- |
| Счёт — клиентский `served`, шлётся как есть | `10-scene-loop.js:137`, `07-audio-services.js:296` | сервер-источник истины; PGS-сабмит через Cloud Function |
| Прямой `window.PFLeaderboard.submitRun({score:1e9})` | дев-экспорт | App Check / Play Integrity + sanity-потолки |
| Правка `localStorage` | mock-провайдер | данные в Firestore/PGS, не в браузере |
| `ts`/`accountId` от клиента | `07-audio-services.js:295-296` | серверный `ts`; `uid` из токена |
| Debug-читы (`pf_debug`) | `08-gameplay.js:421` | клиент не сабмитит при активных читах; сервер метит выбросы |
| Перезалитый APK / чужой хост | открытый код | **Play Integrity** (App Check на вебе, нативно на Android) |
| Ник без модерации | `Account.setName` | серверная санитизация (на вебе); на Android ник из Play-профиля |

---

## Идентичность — по платформе

- **Android:** Play Games sign-in (ник/аватар из Play-профиля; кросс-девайс, анти-чит крепче).
- **Веб:** Firebase Auth (Google). `mockAuth` остаётся офлайн-fallback'ом.
- Аккаунт переживает «Сбросить прогресс» (ключ `pf_account_v1` — кэш профиля).

---

## Анти-пиратство (Вопрос 2) — защищаем сервис

1. **Play Integrity** — главный рычаг. На Android нативно, на вебе через **Firebase App Check
   (провайдер Play Integrity)**: бэкенд принимает запросы только из подлинной сборки. Клон/чужой
   сайт не получат валидный токен → рейтинги/ачивки/XP для них мертвы.
2. **PGS сам по себе** привязан к Google-аккаунту и Play — клон не сможет писать ачивки/XP
   в чужой Play-профиль без подлинной подписи приложения.
3. **Ценность на сервере/в PGS** — соло-игра у клона останется (неизбежно для открытого кода),
   но соревновательный слой без нашего бэкенда не работает.
4. Подпись: `android.keystore` в секрете, **Play App Signing**.

---

## Приватность / Play Data Safety (блокер релиза)

Реальные аккаунты (Google/Play-профиль, ник, e-mail) = персональные данные. До релиза:
- обновить [`../../../privacy.html`](../../../privacy.html) и форму
  **Play Data Safety** ([`../../play-data-safety.md`](../../play-data-safety.md));
- **Удаление аккаунта = полное стирание** (решение продукт-овнера): `deleteAccount` удаляет
  `accounts/{uid}`, все его `runs`, записи в агрегатах `leaderboard/*` и, по возможности,
  данные в PGS. **Хранить данные удалённых игроков не будем.**

---

## Изменения по файлам

| Файл / артефакт | Изменение | Фаза |
| --- | --- | --- |
| Android-упаковка | **TWA → Capacitor** (новый Android-проект, бандл веб-сборки, плагины) | 1 |
| Capacitor PGS-плагин + нативный мост | sign-in, `unlockAchievement`, `submitScore`, server auth code | 1 |
| Play Console | завести ~48 ачивок (`medalId→pgsId`, очки→XP) + лидерборд Survival | 1 |
| `index.template.html` | Firebase compat-SDK (CDN) для веб-сборки (auth/functions/app-check) | 1 |
| `src/game/07b-providers.js` (новый) | `pgsProvider` / `firebaseProvider` / `pgsAuth` / `firebaseAuth` + конфиг | 1 |
| `scripts/build.mjs` | добавить новый модуль в конкатенацию (после `07`) | 1 |
| `src/game/13-init.js` | выбор провайдера по платформе (Capacitor? PGS : сеть? Firebase : mock) | 1 |
| `src/game/12-achievements-medals.js` | хук в `give`/`giveForce` → `unlockAchievement(pgsId)` (no-op вне Android) | 1 |
| `src/game/07-audio-services.js` | блок сабмита при активных `pf_debug`-читах | 1 |
| Firebase проект | Cloud Functions `submitRun`/`top`/`deleteAccount` + Rules + App Check + серверный сабмит в PGS REST | 2 |
| `src/game/08-gameplay.js` | запись лога инпутов (seed спавнов + тапы) для replay | 3 |
| `privacy.html`, `docs/play-data-safety.md` | данные аккаунта/ника + удаление | до релиза |

**Не меняются:** `submitRun()` caller в `endLevel`, экран рейтинга, метрика `served`,
`periodBucket`, логика медалей (хук лишь добавляет вызов наружу).

---

## Фазы

| Фаза | Что | Где | Статус |
| --- | --- | --- | --- |
| **0** | Этот дизайн-док | `docs/` | ✅ |
| **1** | Capacitor-упаковка + PGS (ачивки/XP/лидерборд) + Firebase для веба + выбор провайдера + хук медалей + блок сабмита при читах | Android-проект, `src/game/`, Play Console, Firebase | план |
| **2** | Cloud Functions (sanity-валидация, серверный `ts`/`uid`) + Rules + App Check (Play Integrity) + серверный сабмит в PGS + `deleteAccount` | Firebase | план |
| **3** | Replay-валидация: лог инпутов + серверный пересчёт `served` (путь «а» — после запуска по факту накрутки) | `08-gameplay.js` + Firebase | позже |
| **—** | privacy.html + Play Data Safety + удаление | docs | до релиза |

---

## Открытые вопросы продукт-овнеру

1. **Релизный цикл Android.** Принимаем «обновления Android через новый APK в Play» (норма),
   или сразу закладываем live-update (Capgo)? *(не блокер; по умолчанию — через Play)*
2. **Срезы лидерборда.** PGS даёт daily/weekly/all-time, у нас спроектированы week/month/all.
   Выравниваем UI под PGS (daily/weekly/all-time) на Android, а месяц оставляем только вебу —
   или ведём свой серверный лидерборд и для Android тоже (тогда PGS — только ачивки/XP)?
3. **HARD_CAP** — конкретная цифра «бортов за N минут» для sanity-валидации (принцип утверждён).
4. *(Решено)* Вход — Play Games на Android + Google на вебе. Replay — путь «а». Удаление — полное.
