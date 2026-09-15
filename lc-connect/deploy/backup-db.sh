#!/usr/bin/env bash
# Nightly backup of the laser_components Postgres DB: local dump + off-box copy to the CFI NAS.
# Installed as user timer lc-backup.timer (see deploy/lc-backup.{service,timer}).
set -euo pipefail
APP=/home/bogdan/Desktop/Projects/laser_components/lc-connect
LOCAL=/home/bogdan/backups/laser_components
NAS=/mnt/dysk/backups/laser_components
KEEP_DAYS=30
URL="$(grep '^DATABASE_URL=' "$APP/.env" | cut -d= -f2- | sed 's/[?&]schema=public//')"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$LOCAL"
OUT="$LOCAL/laser_components_$STAMP.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$URL" --file="$OUT.tmp"
mv "$OUT.tmp" "$OUT"
pg_restore --list "$OUT" >/dev/null   # integrity check: the archive must be readable
SIZE=$(stat -c %s "$OUT")
find "$LOCAL" -name 'laser_components_*.dump' -mtime +$KEEP_DAYS -delete
echo "$(date -Is) local ok $OUT ${SIZE}B"
# off-box copy (NAS is a soft CIFS automount over VPN; never let it hang the job)
if timeout 60 mkdir -p "$NAS" 2>/dev/null && timeout 300 cp "$OUT" "$NAS/$(basename "$OUT").tmp" && timeout 30 mv "$NAS/$(basename "$OUT").tmp" "$NAS/$(basename "$OUT")"; then
  timeout 60 find "$NAS" -name 'laser_components_*.dump' -mtime +$KEEP_DAYS -delete 2>/dev/null || true
  echo "$(date -Is) nas ok"
else
  echo "$(date -Is) nas FAILED (local copy exists)"; exit 2
fi
