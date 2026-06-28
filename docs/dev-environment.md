# Дев-окружение (prod ⟂ dev) — веб и APK

> **Зачем.** После релиза пушить прямо в `main` (= прод у всех игроков) опасно. Нужна
> промежуточная ступень: изменения сначала попадают в **дев**, там проверяются, и только
> потом — в **прод**. Раздельно и для веб-версии (PWA), и для Android-приложения (APK).

## Маршрут изменений

```
feature-ветка  →  PR в dev  →  (проверка на дев-вебе/дев-APK)  →  PR dev → main  →  ПРОД
```

- `main` — **прод** (как и раньше).
- `dev` — **стейджинг**. Ветка-гейт перед релизом.

## Две трубы деплоя

| | Прод (push в `main`) | Дев (push в `dev`) |
|---|---|---|
| Workflow | `.github/workflows/deploy.yml` | `.github/workflows/deploy-dev.yml` |
| Веб | GitHub Pages → `planeflow.jevgenia.com` | VPS (Caddy) → `dev.planeflow.jevgenia.com` |
| OTA-канал | `capgo.jevgenia.com/updates` → `updates.json` | `capgo.jevgenia.com/updates/dev` → `updates-dev.json` |
| Бандлы | `planeflow-<ver>.zip` | `planeflow-dev-<ver>.zip` |
| APK appId | `com.planeflow.game` | `com.planeflow.game.dev` |
| APK имя | PlaneFlow: Air Traffic Control | PlaneFlow (Dev) |

Дев-APK ставится **рядом** с прод-версией (разный `appId`) и обновляется по воздуху из
своего канала — поэтому пересобирать APK нужно редко (только при изменении нативной
оболочки); правки игры прилетают в установленный дев-APK через OTA.

## Что уже в репозитории (этим PR)

- **`capacitor.config.ts`** — переключатель по env `OTA_CHANNEL`. Без переменной — прод
  (как раньше); `OTA_CHANNEL=dev` → дев-`appId` и дев-`updateUrl`.
- **`.github/workflows/deploy-dev.yml`** — дев-конвейер: тот же гейт (tsc + сборка + тесты),
  rsync сайта на VPS и заливка дев OTA-бандла. **Pages не трогает.**
- **`.github/workflows/deploy.yml`** — retention сужен до `planeflow-[0-9]*.zip`, чтобы прод-уборка
  не удаляла дев-бандлы (живут в одном каталоге).
- **`docs/vps/server.py`** — отдаёт манифест по каналу: `/updates` → `updates.json`,
  `/updates/dev` → `updates-dev.json` (канал из URL выбирает ключ в фиксированном
  словаре `CHANNEL_MANIFESTS`; имя файла — константа, обход каталога невозможен).
- **`docs/vps/Caddyfile`** — добавлен vhost `dev.planeflow.jevgenia.com` (статика дев-веба).

Дев-конвейер использует **те же секреты**, что и прод: `OTA_SSH_KEY`, `OTA_HOST`, `OTA_USER`.

## Ручной чек-лист (вне репозитория)

Эти шаги нельзя выполнить из CI — нужны твои действия.

### 1. DNS
- [ ] A/AAAA-запись `dev.planeflow.jevgenia.com` → IP VPS (тот же, что `capgo.jevgenia.com`).

### 2. VPS
- [ ] Создать каталог дев-веба и дать deploy-юзеру (`OTA_USER`) права на запись:
      `sudo mkdir -p /opt/planeflow-dev/site && sudo chown -R <OTA_USER> /opt/planeflow-dev`
- [ ] Залить обновлённый responder и перезапустить:
      `scp docs/vps/server.py <user>@<vps>:/opt/capgo-ota/server.py`,
      затем `sudo systemctl restart capgo-ota`.
- [ ] Залить обновлённый Caddyfile и перечитать:
      `scp docs/vps/Caddyfile <user>@<vps>:/etc/caddy/Caddyfile`,
      затем `sudo systemctl reload caddy` (Caddy сам получит TLS-сертификат на новый поддомен).
- [ ] Проверка: `curl https://capgo.jevgenia.com/updates/dev` (после первого дев-деплоя),
      `curl -I https://dev.planeflow.jevgenia.com`.

> На Windows эти scp/ssh выполнять **только из PowerShell** (см. `docs/capgo-self-host-migration.md`).

### 3. Создать ветку `dev`
- [ ] `git switch -c dev origin/main && git push -u origin dev` — первый push запустит
      `deploy-dev.yml` и наполнит дев-веб и `updates-dev.json`.
- [ ] (Желательно) включить branch protection на `main` и `dev` в настройках репозитория,
      чтобы в `main` попадало только через PR из `dev`.

### 4. Дев-APK (нужны Android SDK / Play Console — вне этого окружения)
- [ ] Собрать дев-флейвор с переменной окружения:
      `OTA_CHANNEL=dev npm run build:www && OTA_CHANNEL=dev npx cap sync android`,
      затем собрать APK/AAB как обычно (`scripts/setup-android.mjs`, `docs/capacitor-android.md`).
- [ ] У дев-APK держать **низкий** нативный `versionName` (напр. `0.0.1`), чтобы любой OTA-бандл
      считался обновлением.
- [ ] Поставить дев-APK на телефон (sideload или внутренний трек Play Console). Он встанет
      рядом с прод-версией и будет тянуть обновления из канала `dev`.

## Откат

Дев-окружение полностью аддитивно: ничего из прод-трубы не меняется по поведению.
Чтобы отключить — удалить `deploy-dev.yml`, vhost из `Caddyfile`, ветку `dev`; прод
(`main` → Pages + `/updates`) продолжит работать как прежде.
