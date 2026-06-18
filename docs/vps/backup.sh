#!/bin/bash
# Daily VPS backup: PlaneFlow OTA bundles + configs → Google Drive
# Lives at /opt/backups/backup.sh — cron: 0 3 * * * /opt/backups/backup.sh >> /opt/backups/backup.log 2>&1
set -euo pipefail
STAMP=$(date +%Y%m%d)
KEEP=7

OTA_DIR=/opt/capgo-ota
CFG=/opt/backups/configs

# конфиги — небольшие, держим историю за KEEP дней
mkdir -p "$CFG"
cp /etc/caddy/Caddyfile                  "$CFG/Caddyfile-$STAMP"
cp /etc/systemd/system/capgo-ota.service "$CFG/capgo-ota.service-$STAMP"
cp "$OTA_DIR/updates.json"               "$CFG/updates.json-$STAMP"
find "$CFG" -mtime +$KEEP -delete

# sync to Google Drive (rclone, scope=drive.file)
rclone sync "$OTA_DIR/bundles" gdrive:vps-backups/bundles  --quiet
rclone sync "$CFG"             gdrive:vps-backups/configs  --quiet

echo "[backup] done $STAMP"
