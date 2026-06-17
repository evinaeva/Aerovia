# Переход с Capgo Cloud на self-host (свой VPS)

> Как съехать с платного **Capgo Cloud** (~$12/мес после триала) на **бесплатный self-host**
> на своём сервере (Contabo VPS), не трогая саму игру. Это план переезда «на потом» — текущая
> облачная настройка уже работает (см. [`capacitor-android.md`](capacitor-android.md) §«Capgo OTA»
> и [`backlog.md`](backlog.md) §«Переход на Capacitor + Capgo»).

## Когда это делать
- Хочешь **$0** вместо ~$12/мес и готова **держать свой сервис** (БД, бэкапы, TLS, апдейты).
- Нужен полный контроль над данными.

**Не стоит**, если возни не хочется: проще остаться на Cloud за $12/мес или вообще без OTA
(обновления через стор). Решение по тарифу — в [`backlog.md`](backlog.md).

## Что меняется (и что НЕ меняется)
Меняется только **где живёт бэкенд OTA**: облако Capgo → твой VPS.
- **НЕ меняется:** код игры, плагин `@capgo/capacitor-updater`, `notifyAppReady()` в `13-init.js`,
  схема версий бандла, `versionName` (из `setup-android.mjs`), шаг сборки бандла в CI — всё
  переиспользуется как есть.
- **Меняется:** 3 адреса в `capacitor.config.ts` (куда плагин ходит за обновлениями) + цель CLI
  в `deploy.yml` (куда лить бандл) + **разовая пересборка APK** (адреса зашиваются в нативную
  сборку на этапе `cap sync`).

> ⚠️ Уже установленные APK, которые смотрят на Capgo Cloud, **сами не переключатся** — нужен
> новый APK с новыми адресами. Для нашего масштаба (ты + пара тестеров) это нормально.

## Архитектура self-host
Бэкенд Capgo — это в основном **Supabase** (Postgres + auth + storage + edge-функции
`updates` / `channel_self` / `stats`) из репозитория [Cap-go/capgo](https://github.com/Cap-go/capgo);
бандлы лежат в Supabase Storage (или S3-совместимом хранилище).

**Требования к VPS:**
- Docker;
- Supabase self-host — это несколько контейнеров, рекомендуется **≥ 4 ГБ RAM**;
- **домен + HTTPS обязателен** (напр. поддомен `capgo.jevgenia.com` с сертификатом).

> ⚠️ Contabo уже крутит banner-qa (`/opt/banner-qa`, :8090). Перед установкой проверь, что хватит
> RAM и не конфликтуют порты; при нехватке ресурсов — отдельный VPS или другой инстанс Supabase.

## Шаги

### 1. Сервер (по официальным гайдам — они source of truth, команды со временем меняются)
1. Поднять **Supabase** через Docker — [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting/docker).
2. Развернуть бэкенд/функции **Capgo** — [Cap-go/capgo](https://github.com/Cap-go/capgo)
   + обзор [self-hosted Capgo](https://capgo.app/blog/self-hosted-capgo/).
3. Поднять **HTTPS** на поддомен (напр. `capgo.jevgenia.com`) через reverse-proxy (nginx/Caddy) —
   как уже сделано для banner-qa.
4. Создать приложение `com.planeflow.game` и канал `production` в своей консоли (или через CLI),
   залогинить CLI в свой инстанс.

### 2. Репозиторий (точные правки)
**`capacitor.config.ts`** — добавить 3 адреса в блок `CapacitorUpdater` (подставить свой хост):
```ts
plugins: {
  CapacitorUpdater: {
    autoUpdate: true,
    updateUrl:  'https://capgo.jevgenia.com/functions/v1/updates',
    channelUrl: 'https://capgo.jevgenia.com/functions/v1/channel_self',
    statsUrl:   'https://capgo.jevgenia.com/functions/v1/stats',
  },
},
```
Без этих ключей плагин по умолчанию ходит в облако Capgo (`https://plugin.capgo.app/...`).

**`.github/workflows/deploy.yml`** — нацелить CLI на свой инстанс. В шаг «Capgo OTA — выгрузка
бандла» добавить env, чтобы `bundle upload` лил в твой Supabase, а не в облако:
```yaml
        env:
          CAPGO_TOKEN: ${{ secrets.CAPGO_TOKEN }}    # ключ ТВОЕГО инстанса (не облачный)
          SUPA_URL:    ${{ secrets.CAPGO_SUPA_URL }}  # https://capgo.jevgenia.com
          SUPA_ANON:   ${{ secrets.CAPGO_SUPA_ANON }} # anon-ключ твоего Supabase
```
Саму команду `bundle upload com.planeflow.game --channel production --bundle "$VER" --path www
--no-code-check` менять **не надо** — отличается только адрес назначения через env.

> Точные имена переменных/флагов (`SUPA_URL`/`SUPA_ANON` либо `--supa-host`/`--supa-anon`) сверь
> с актуальной докой [CLI self-hosted](https://capgo.app/docs/plugins/updater/local-dev/cli/) —
> без них CLI по умолчанию шлёт в облако Capgo.

Добавить секреты в GitHub (Settings → Secrets and variables → Actions): `CAPGO_SUPA_URL`,
`CAPGO_SUPA_ANON`, и обновить `CAPGO_TOKEN` на ключ своего инстанса.

### 3. Пересборка APK + публикация
```
git checkout main && git pull
npm install && npm run build:www
npm run setup:android && npx cap sync android
# Android Studio: Build/Run → поставить новый APK на телефон
```
После этого push в `main` → CI зальёт бандл уже в твой инстанс, телефон с новым APK потянет
обновления с `capgo.jevgenia.com`.

## Проверка
- Бандл появился в твоей консоли Capgo на канале `production`.
- Телефон (с новым APK) делает запросы к `capgo.jevgenia.com` (проверь логи плагина / nginx).
- Видимая правка → push в `main` → переоткрыть игру дважды → изменение приехало
  (механика «дважды» — в [`capacitor-android.md`](capacitor-android.md)).

## Откат на облако
Убрать 3 URL из `capacitor.config.ts` (или вернуть облачные), убрать `SUPA_*` env из `deploy.yml`,
вернуть `CAPGO_TOKEN` облака → пересобрать APK. Плагин снова пойдёт в Capgo Cloud.

## Честно про усилия
Это **не «правка в репо», а поднятие и обслуживание сервиса**: Supabase = несколько контейнеров,
плюс БД, бэкапы, TLS, обновления. Репо-часть — ~10 минут; сервер — несколько часов на разворот
плюс постоянная поддержка. Если время дороже $12/мес — оставайся на Cloud. Если хочешь $0 и
контроль (и VPS всё равно есть) — это рабочий путь.

---
Ссылки: [self-hosted Capgo](https://capgo.app/blog/self-hosted-capgo/) ·
[Cap-go/capgo](https://github.com/Cap-go/capgo) ·
[Supabase self-host](https://supabase.com/docs/guides/self-hosting/docker) ·
[CLI self-hosted](https://capgo.app/docs/plugins/updater/local-dev/cli/).
