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

# disk space warning (>80% = warn; виден в логе и Google Drive)
DISK_PCT=$(df / | tail -1 | awk '{gsub(/%/,""); print $5}')
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
[ "$DISK_PCT" -gt 80 ] && echo "[backup] WARNING: disk ${DISK_PCT}% used, ${DISK_FREE} free — пора чистить бандлы"

# sync to Google Drive (rclone, scope=drive.file)
rclone sync "$OTA_DIR/bundles" gdrive:vps-backups/bundles  --quiet
rclone sync "$CFG"             gdrive:vps-backups/configs  --quiet

echo "[backup] done $STAMP — bundles: $(ls $OTA_DIR/bundles/*.zip 2>/dev/null | wc -l), disk: ${DISK_PCT}% used"
