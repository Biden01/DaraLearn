#!/usr/bin/env bash
# Деплой на прод: собирает фронтенд, выкладывает его в /var/www/daralearn.kz
# и пересобирает/перезапускает бэкенд. Запуск: sudo ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT=/var/www/daralearn.kz

cd "$ROOT"
[ -f .env ] || { echo "Нет файла .env (см. .env.example)"; exit 1; }

echo "==> Сборка фронтенда"
docker run --rm -v "$ROOT/frontend:/app" -w /app node:20-alpine \
  sh -c "npm ci --no-audit --no-fund || npm install --no-audit --no-fund; npm run build"

echo "==> Бэкенд"
docker compose up -d --build
for i in $(seq 1 30); do
  curl -fs http://127.0.0.1:8000/api/health >/dev/null && break
  sleep 1
done
curl -fs http://127.0.0.1:8000/api/health >/dev/null || { echo "Бэкенд не отвечает, фронтенд не обновлён"; exit 1; }

echo "==> Выкладка фронтенда"
rsync -a --delete "$ROOT/frontend/dist/" "$WEB_ROOT/"
echo "Готово: https://daralearn.kz"
