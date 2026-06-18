# OTA self-host на своём VPS — как работает

> **Переход завершён (2026-06-18).** Вместо облака Capgo (~$12/мес) OTA работает на **своём
> Contabo VPS** через крошечный Python-responder — без Supabase, без Docker. CI заливает бандл
> по SSH; плагин `@capgo/capacitor-updater` тянет обновления с `capgo.jevgenia.com`.

## Архитектура

```
GitHub CI (push main)
    │
    ├─ SCP planeflow-0.X.Y.zip → VPS:/opt/capgo-ota/bundles/.tmp → mv (атомарно)
    └─ SCP updates.json         → VPS:/opt/capgo-ota/updates.json.tmp → mv (атомарно)

Телефон (APK)
    │
    └─ GET https://capgo.jevgenia.com/updates
           │
           Caddy (авто-TLS) → capgo-ota.service (Python, :8099)
                                   reads /opt/capgo-ota/updates.json
                                   compares version → { version, url, checksum } или up to date
           │
    ├─ GET /bundles/planeflow-0.X.Y.zip   → Caddy file_server (статика)
    └─ GET /health                        → Python: { ok, latest_version, bundle_count, disk_free_gb }
                                              HTTP 503 если ok=false
```

**Файлы конфигурации (актуальные снимки в репо):**
- [`docs/vps/server.py`](vps/server.py) — Python-responder (запускается как `capgo-ota.service`)
- [`docs/vps/Caddyfile`](vps/Caddyfile) — Caddy: TLS, роутинг, access log
- [`docs/vps/capgo-ota.service`](vps/capgo-ota.service) — systemd-юнит с OnFailure→Telegram
- [`docs/vps/backup.sh`](vps/backup.sh) — ежедневный бэкап бандлов + конфигов на Google Drive

## Что в репозитории

**`capacitor.config.ts`** — три адреса, зашиваемые в APK:
```ts
CapacitorUpdater: {
  autoUpdate: true,
  updateUrl:  'https://capgo.jevgenia.com/updates',
  channelUrl: 'https://capgo.jevgenia.com/channel_self',
  statsUrl:   'https://capgo.jevgenia.com/stats',
},
```

**`.github/workflows/deploy.yml`** — CI-шаг OTA (атомарный деплой + retention):
```yaml
# zip www/ → бандл
# atomic: SCP в .tmp, затем SSH mv
scp ... planeflow-$VER.zip.tmp → mv planeflow-$VER.zip
scp ... updates.json.tmp       → mv updates.json
# retention: оставить последние 10 бандлов
ssh ... "ls -t /opt/capgo-ota/bundles/planeflow-*.zip | tail -n +11 | xargs rm -f"
```

## Мониторинг (VPS)

| Что | Где | Как оповещает |
|-----|-----|---------------|
| Сервис упал | `capgo-ota.service` OnFailure | Telegram |
| Диск > 80%, TLS < 30 дней, `/health` 503 | cron `/opt/backups/monitor.sh` раз в час | Telegram |
| Сайт недоступен | UptimeRobot каждые 5 мин | Email + можно в Telegram |

Бандлы и конфиги → Google Drive (`rclone sync`, ежедневно 03:00).

## Обновление responder/Caddyfile на VPS

```powershell
# скопировать обновлённый server.py
scp -i $env:USERPROFILE\.ssh\delegatron_deploy_ed25519 `
    docs/vps/server.py claude-deploy@185.239.209.185:/opt/capgo-ota/server.py
ssh -i $env:USERPROFILE\.ssh\delegatron_deploy_ed25519 `
    claude-deploy@185.239.209.185 "sudo systemctl restart capgo-ota"

# Caddyfile
scp ... docs/vps/Caddyfile claude-deploy@185.239.209.185:/etc/caddy/Caddyfile
ssh ... "sudo systemctl reload caddy"
```

> **На Windows — ТОЛЬКО PowerShell** (Bash коверкает путь к ключу → fail2ban).

## Откат на облако Capgo

Убрать три `*Url` из `capacitor.config.ts` (или вернуть `https://plugin.capgo.app/...`),
убрать OTA-шаг из `deploy.yml`, вернуть `CAPGO_TOKEN` облака → пересобрать APK.

## Если бандлы закончатся (диск)

```bash
# посмотреть
ls -lh /opt/capgo-ota/bundles/ | tail -20
# удалить вручную (retention оставляет 10 — обычно достаточно)
ls -t /opt/capgo-ota/bundles/*.zip | tail -n +6 | xargs rm -f
```
