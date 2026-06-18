#!/bin/bash
# Daily VPS backup: postgres (delegatron) + static configs
# Lives at /opt/backups/backup.sh — cron: 0 3 * * * /opt/backups/backup.sh >> /opt/backups/backup.log 2>&1
set -euo pipefail
STAMP=$(date +%Y%m%d)
KEEP=7

PG_DIR=/opt/backups/postgres
sudo -u postgres pg_dump delegatron         | gzip > "$PG_DIR/delegatron-$STAMP.sql.gz"
sudo -u postgres pg_dump delegatron_sandbox | gzip > "$PG_DIR/delegatron_sandbox-$STAMP.sql.gz"
find "$PG_DIR" -name "*.sql.gz" -mtime +$KEEP -delete

CFG=/opt/backups/configs
cp /etc/caddy/Caddyfile                  "$CFG/Caddyfile-$STAMP"
cp /etc/systemd/system/capgo-ota.service "$CFG/capgo-ota.service-$STAMP"
find "$CFG" -mtime +$KEEP -delete

# sync to Google Drive (rclone, scope=drive.file — видит только свои файлы)
rclone sync "$PG_DIR"  gdrive:vps-backups/postgres --quiet
rclone sync "$CFG"     gdrive:vps-backups/configs  --quiet

echo "[backup] done $STAMP"
