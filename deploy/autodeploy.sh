#!/usr/bin/env bash
# Автодеплой: раз в минуту (systemd-таймер daralearn-autodeploy.timer) проверяет
# origin/main и, если там новые коммиты, подтягивает их и запускает deploy.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0

echo "==> Новые коммиты: $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)"
git merge --ff-only origin/main
./deploy/deploy.sh
