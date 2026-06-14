# Android TWA — упаковка PlaneFlow для Google Play

Заворачиваем PWA в **TWA** (Trusted Web Activity): нативный `.aab` для Google Play,
который полноэкранно показывает наш хостящийся сайт. Логика/ассеты не дублируются —
обновления выезжают с веба, без ревью стора (кроме смены самой обёртки).

## Что уже лежит в репозитории

- [`twa-manifest.json`](../twa-manifest.json) — конфиг Bubblewrap (значения под PlaneFlow).
- [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) — Digital Asset Links
  (с плейсхолдером отпечатка — заполняется после первой загрузки в Play Console).
- [`.nojekyll`](../.nojekyll) — чтобы GitHub Pages **отдавал** папку `.well-known`
  (Jekyll по умолчанию игнорирует пути на `.`).

Везде, где стоит `REPLACE_WITH_YOUR_DOMAIN` / `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`,
нужно подставить реальные значения (см. шаги ниже).

## Предусловия

- Куплен домен (выбрали «свой домен»), напр. `aerovia.app`.
- Google Play Console — аккаунт разработчика ($25 разово).
- Локально: Node 18+, JDK 17+ (есть). Android SDK Bubblewrap скачает сам при первом запуске.

---

## Шаг 1. Домен → GitHub Pages

1. В DNS домена добавить запись на GitHub Pages:
   - apex (`aerovia.app`): четыре `A`-записи на `185.199.108–111.153`, **или**
   - суб-домен (`play.aerovia.app`): `CNAME` → `evinaeva.github.io`.
2. В репозитории создать файл `CNAME` в корне с одной строкой — самим доменом:
   ```
   aerovia.app
   ```
3. Repo → Settings → Pages → Custom domain = домен, дождаться «DNS check successful»,
   включить **Enforce HTTPS**.

После этого сайт открывается с **корня домена** (`https://aerovia.app/`), а не с
`/Aerovia/` — поэтому `start_url`/иконки в TWA-конфиге уже указывают на корень.

## Шаг 2. Подставить домен в конфиги

Заменить `REPLACE_WITH_YOUR_DOMAIN` на свой домен в:
- `twa-manifest.json` (поля `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl`, `fullScopeUrl`),

Проверить, что доступны (200 OK):
- `https://<домен>/manifest.json`
- `https://<домен>/.well-known/assetlinks.json`

## Шаг 3. Сгенерировать Android-проект и `.aab` (Bubblewrap)

```bash
npm i -g @bubblewrap/cli      # или npx @bubblewrap/cli ...

# инициализация из живого web-манифеста (значения сверять с нашим twa-manifest.json)
bubblewrap init --manifest https://<домен>/manifest.json

# собрать .aab + .apk; на этом шаге создаётся upload-ключ android.keystore
bubblewrap build
```

Bubblewrap спросит данные для **upload-ключа** (keystore) — сохрани пароли в надёжном
месте, ключ не теряй. Альтернатива — Play App Signing (рекомендуется, см. ниже):
Google держит ключ подписи приложения, ты — только upload-ключ.

Артефакты: `app-release-bundle.aab` (загружаем в Play), `app-release-signed.apk`
(для локального теста на телефоне).

## Шаг 4. Закрытое тестирование в Play Console

1. Create app → заполнить листинг (имя **PlaneFlow**, иконка, скриншоты — см. бэклог).
2. **Testing → Closed testing** → создать трек, добавить тестеров (нужно ≥12 человек
   на 14 дней для последующего перехода в production по новым правилам Google).
3. Загрузить `.aab`. Включить **Play App Signing** (по умолчанию).

## Шаг 5. Заполнить assetlinks отпечатком и доказать владение

1. Play Console → Setup → **App integrity → App signing** → скопировать
   **SHA-256 certificate fingerprint** (ключа подписи приложения).
2. Вставить его в `.well-known/assetlinks.json` вместо
   `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` (можно добавить и SHA-256 upload-ключа
   вторым элементом массива — оба валидны).
3. Закоммитить, дождаться передеплоя Pages. Проверить:
   `https://<домен>/.well-known/assetlinks.json` отдаёт правильный отпечаток.
4. Перезапустить приложение на телефоне — TWA при старте сверяет Asset Links; если
   совпало, **исчезает адресная строка Chrome** (это и есть признак валидного TWA).

> Удобный валидатор связки: Google Statement List Generator and Tester, либо
> `https://developers.google.com/digital-asset-links/tools/generator`.

## Дальнейшие обновления

- **Контент игры** (`index.html` и т.п.) — просто пушим в `main`; Pages обновляет
  сайт, TWA подхватывает на следующем запуске. **Стор не трогаем.**
- **Саму обёртку** (иконка/имя/permissions/версия) — поднять `appVersionCode` в
  `twa-manifest.json`, `bubblewrap build`, залить новый `.aab`.

## Чек-лист перед публикацией

- [ ] Домен на Pages, HTTPS enforced, `CNAME` в репо.
- [ ] `manifest.json` и `assetlinks.json` отдаются 200 с корня домена.
- [ ] `.aab` собран, Play App Signing включён.
- [ ] SHA-256 вставлен в `assetlinks.json`, Pages передеплоен, адресная строка пропала.
- [ ] Data Safety форма (см. [`analytics.md`](analytics.md)) и privacy policy URL.
- [ ] Закрытый трек, ≥12 тестеров.

Связанные доки: метрики/приватность — [`analytics.md`](analytics.md); общий план —
[`backlog.md`](backlog.md) (раздел «Soft Launch & Metrics»).
