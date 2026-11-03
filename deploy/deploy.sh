#!/usr/bin/env bash
# Деплой на прод: собирает фронтенд, выкладывает его в /var/www/daralearn.kz
# и пересобирает/перезапускает бэкенд. Запуск от era (без sudo): ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT=/var/www/daralearn.kz

cd "$ROOT"
[ -f .env ] || { echo "Нет файла .env (см. .env.example)"; exit 1; }

echo "==> Сборка фронтенда"
# Сборка от владельца каталога (а не root внутри контейнера), иначе в dist/ и
# node_modules/ появляются root-файлы и rsync/npm от era потом падают.
OWNER="$(stat -c %u:%g "$ROOT/frontend")"
docker run --rm --user "$OWNER" -e HOME=/tmp -v "$ROOT/frontend:/app" -w /app node:20-alpine \
  sh -c "npm ci --no-audit --no-fund || npm install --no-audit --no-fund; npm run build"

echo "==> Бэкенд"
docker compose up -d --build
for i in $(seq 1 30); do
  curl -fs http://127.0.0.1:8000/api/health >/dev/null && break
  sleep 1
done
curl -fs http://127.0.0.1:8000/api/health >/dev/null || { echo "Бэкенд не отвечает, фронтенд не обновлён"; exit 1; }

echo "==> Выкладка фронтенда"
# --omit-dir-times: era не всегда владелец каталогов в $WEB_ROOT (напр. создан
# ранее от root), а utime() на чужой каталог не даёт даже при праве записи —
# rsync иначе падает на "failed to set times", и из-за set -e весь деплой срывается.
rsync -a --omit-dir-times --delete "$ROOT/frontend/dist/" "$WEB_ROOT/"
echo "Готово: https://daralearn.kz"
