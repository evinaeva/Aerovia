# Android TWA — упаковка PlaneFlow для Google Play

> ⚠️ **Решение продукт-овнера 2026-06-15: упаковка переводится с TWA на Capacitor + Capgo.**
> Причина — нативный **Google Play Games** (вход, ачивки, рейтинги игроков), которого в
> чистом TWA нет (нет моста JS↔native). Частые обновления без ревью стора возвращает
> **Capgo (OTA)**. План миграции — в [`backlog.md`](backlog.md) (раздел «Переход на
> Capacitor + Capgo»). Этот раннбук остаётся как **история TWA-пути**; при Capacitor часть
> шагов ниже отпадает (Bubblewrap, `assetlinks.json`, Digital Asset Links, сабдомен под TWA).

Заворачиваем PWA в **TWA** (Trusted Web Activity): нативный `.aab` для Google Play,
который полноэкранно показывает наш хостящийся сайт. Логика/ассеты не дублируются —
обновления выезжают с веба, без ревью стора (кроме смены самой обёртки).

## Что уже лежит в репозитории

- [`twa-manifest.json`](../twa-manifest.json) — конфиг Bubblewrap (значения под PlaneFlow).
- [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) — Digital Asset Links
  (с плейсхолдером отпечатка — заполняется после первой загрузки в Play Console).
- [`.nojekyll`](../.nojekyll) — чтобы GitHub Pages **отдавал** папку `.well-known`
  (Jekyll по умолчанию игнорирует пути на `.`).

Домен `planeflow.jevgenia.com` уже проставлен в `twa-manifest.json`. Остаётся подставить
`REPLACE_WITH_PLAY_APP_SIGNING_SHA256` в `assetlinks.json` после первой загрузки в Play
(см. шаг 5).

## Предусловия

- Домен `jevgenia.com` (используем сабдомен `planeflow.jevgenia.com`).
- Google Play Console — аккаунт разработчика ($25 разово, см. шаг 4).
- Локально: Node 18+. **JDK 17 и Android SDK Bubblewrap скачивает сам** (в
  `~/.bubblewrap`) — отдельно ставить не нужно.

## Статус

- ✅ Шаг 1–2 — хостинг на `planeflow.jevgenia.com` (SSL, assetlinks отдаётся).
- ✅ Шаг 3 — `.aab` собран.
- ✅ Шаг 4 — Developer-аккаунт зарегистрирован и **верифицирован (2026-06-15)**. Осталось: закрытый трек (≥12 тестеров, 14 дней).
- ⬜ Шаг 5 — вписать SHA-256 в assetlinks после первой загрузки.

---

## Шаг 1. Сабдомен `planeflow.jevgenia.com` → GitHub Pages

Выбран **отдельный сабдомен** (изолирован от личного сайта, assetlinks под контролем
этого репо, будущий переезд дешёвый). **packageId `com.planeflow.game` от домена не
зависит** — домен потом можно сменить без смены приложения в Play.

**Порядок важен — сначала DNS, потом Pages,** иначе живой сайт временно ляжет
(github.io начнёт редиректить на ещё не резолвящийся домен):

1. В DNS `jevgenia.com` добавить запись:
   `CNAME` `planeflow` → `evinaeva.github.io`.
2. Дождаться, пока запись разрезолвится (`nslookup planeflow.jevgenia.com`).
3. Repo → Settings → Pages → Custom domain = `planeflow.jevgenia.com`, дождаться
   «DNS check successful» (GitHub сам запишет файл `CNAME` в репо), включить
   **Enforce HTTPS**.

После этого сайт открывается с **корня сабдомена** (`https://planeflow.jevgenia.com/`),
а не с `/Aerovia/` — поэтому `start_url`/иконки в TWA-конфиге указывают на корень.

## Шаг 2. Проверить конфиги

Домен в `twa-manifest.json` уже проставлен (`planeflow.jevgenia.com`). Убедиться, что
после шага 1 отдают 200 OK:
- `https://planeflow.jevgenia.com/manifest.json`
- `https://planeflow.jevgenia.com/.well-known/assetlinks.json`

## Шаг 3. Сгенерировать Android-проект и `.aab` (Bubblewrap)

**Запускать через `npx`** (глобально CLI не ставили; так не нужно возиться с PATH).
Команды выполняются в любой рабочей папке вне веб-репо (Bubblewrap создаст там
Android-проект) — у нас это `C:\Users\exZhe`.

```powershell
# 1) генерация проекта из живого web-манифеста
npx @bubblewrap/cli init --manifest https://planeflow.jevgenia.com/manifest.json

# 2) сборка .aab + .apk
npx @bubblewrap/cli build
```

**Ответы мастера `init`** (выяснено на практике):

| Вопрос | Ответ |
|---|---|
| Install the JDK? | **Yes** (качает JDK 17 в `~/.bubblewrap`) |
| Install the Android SDK? | **Yes** ← не «No»! «No» значит «у меня уже есть, дай путь» |
| Application name / Short name | `PlaneFlow — air traffic control` / `PlaneFlow` |
| **Application ID** | **`com.planeflow.game`** (вечная личность в Play, не менять) |
| Starting version code | `1` (Enter; растить +1 на каждый апдейт обёртки) |
| Display mode / Orientation | `fullscreen` / `landscape` |
| Theme / background color | `#16131f` / `#110e18` |
| **Include support for Play Billing?** | **No** (IAP пока нет; добавим пересборкой) |
| Generate a new signing key? | **Yes** → путь `./android.keystore`, alias `android` |
| First/last name, org и т.п. (DN ключа) | **не обязательно настоящие** — можно бренд `PlaneFlow`; двухбуквенный код страны; в конце `yes` |

> Если `bubblewrap` «is not recognized» — это нормально, команда не на PATH; всегда
> через `npx @bubblewrap/cli …`.

**Про подпись:** созданный `android.keystore` — это **upload-ключ**. В Play включаем
**Play App Signing** (по умолчанию): настоящий ключ подписи держит Google, у тебя
только upload-ключ. Поэтому SHA-256 для assetlinks берётся из Play Console (шаг 5).

**Артефакты** (в рабочей папке): `app-release-bundle.aab` (→ Play),
`app-release-signed.apk` (тест на телефоне).

> ⚠️ **Бэкап:** сохрани `android.keystore` + **оба пароля** (keystore и key) в надёжном
> месте. Потеряешь — обновления выпускать нельзя (только болезненный сброс через Google).
> Сам Android-проект и `.aab`/`.apk` бэкапить не нужно — пересобираются `build`-ом.

## Шаг 4. Регистрация Developer-аккаунта и закрытое тестирование

1. **Зарегистрироваться как Google Play Developer** на play.google.com/console —
   отдельно от Gmail, **разовый взнос $25**. Тип **Personal** (соло) или
   **Organization** (нужен D-U-N-S). Пройти **верификацию личности** (реальные
   имя/адрес — в отличие от DN keystore); может занять **часы–пару дней**.
2. **Create app** → имя **PlaneFlow**, тип «Game», бесплатное; privacy policy URL
   (см. [`privacy.html`](../privacy.html)) и Data Safety (см. [`play-data-safety.md`](play-data-safety.md)).
3. **Testing → Closed testing** → создать трек, загрузить `app-release-bundle.aab`,
   **Play App Signing** оставить включённым. Для перехода в production по новым
   правилам — **≥12 тестеров минимум 14 дней**.

## Шаг 5. Заполнить assetlinks отпечатком и доказать владение

1. Play Console → Setup → **App integrity → App signing** → скопировать
   **SHA-256 certificate fingerprint** (ключа подписи приложения).
2. Вставить его в `.well-known/assetlinks.json` вместо
   `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` (можно добавить и SHA-256 upload-ключа
   вторым элементом массива — оба валидны).
3. Закоммитить, дождаться передеплоя Pages. Проверить:
   `https://planeflow.jevgenia.com/.well-known/assetlinks.json` отдаёт правильный отпечаток.
4. Перезапустить приложение на телефоне — TWA при старте сверяет Asset Links; если
   совпало, **исчезает адресная строка Chrome** (это и есть признак валидного TWA).

> Удобный валидатор связки: Google Statement List Generator and Tester, либо
> `https://developers.google.com/digital-asset-links/tools/generator`.

## Дальнейшие обновления

- **Контент игры** (`index.html` и т.п.) — через PR в `main` (как обычно; в `main` сами не
  мержим — мёрж делает владелец); после мёржа Pages обновляет сайт, TWA подхватывает на
  следующем запуске. **Стор не трогаем.**
- **Саму обёртку** (иконка/имя/permissions/версия) — поднять `appVersionCode` в
  `twa-manifest.json`, `bubblewrap build`, залить новый `.aab`.

## Чек-лист перед публикацией

- [x] Домен на Pages, HTTPS, `CNAME` в репо.
- [x] `manifest.json` и `assetlinks.json` отдаются 200 с корня домена.
- [x] `.aab` собран; `android.keystore` + пароли забэкаплены.
- [x] Developer-аккаунт зарегистрирован и верифицирован (2026-06-15).
- [ ] Privacy policy URL ([`privacy.html`](../privacy.html)) + Data Safety ([`play-data-safety.md`](play-data-safety.md)).
- [ ] `.aab` загружен, Play App Signing включён.
- [ ] SHA-256 вставлен в `assetlinks.json`, Pages передеплоен, адресная строка пропала.
- [ ] Закрытый трек, ≥12 тестеров.

Связанные доки: метрики/приватность — [`analytics.md`](analytics.md); общий план —
[`backlog.md`](backlog.md) (раздел «Soft Launch & Metrics»).
