#!/usr/bin/env bash
# Дамп базы DaraLearn в /root/backups, хранится 14 дней.
# Запуск по расписанию (от root): 15 3 * * * /home/era/daralearn/deploy/backup.sh
set -euo pipefail
DIR=${BACKUP_DIR:-/root/backups}
mkdir -p "$DIR"; chmod 700 "$DIR"
OUT="$DIR/daralearn-$(date +%F-%H%M).dump"
docker exec daralearn-db-1 pg_dump -U daralearn -Fc daralearn > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$DIR" -name 'daralearn-*.dump' -mtime +14 -delete
echo "backup ok: $OUT"
