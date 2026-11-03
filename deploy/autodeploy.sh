#!/usr/bin/env bash
# Автодеплой: раз в минуту (systemd-таймер daralearn-autodeploy.timer) проверяет
# origin/main и, если там новые коммиты, выкладывает их.
#
# Выкладывается ТОЛЬКО main: рабочая копия принудительно переключается на main и
# сбрасывается на origin/main (локальные правки и чекаут других веток в этом
# каталоге будут затёрты). Что сейчас checked out — не важно: сравнивается
# последний успешно выложенный коммит main с origin/main.
#
# Тело обёрнуто в { ...; exit; }, чтобы bash прочитал скрипт целиком до
# git reset — иначе reset, меняющий этот самый файл, ломает выполнение.
{
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Последний успешно выложенный коммит (лежит в .git, git его не трекает).
STATE="$(git rev-parse --git-dir)/autodeploy-deployed"

git fetch -q origin main
TARGET="$(git rev-parse origin/main)"

# Первый запуск после установки: считаем выложенным текущий локальный main.
[ -f "$STATE" ] || git rev-parse refs/heads/main > "$STATE"

[ "$(cat "$STATE")" = "$TARGET" ] && exit 0

echo "==> Новые коммиты main: $(git rev-parse --short "$(cat "$STATE")") -> $(git rev-parse --short "$TARGET")"
CUR="$(git symbolic-ref -q --short HEAD || git rev-parse --short HEAD)"
[ "$CUR" = main ] || echo "==> Внимание: был checked out '$CUR', переключаюсь на main"

git checkout -q -f main
git reset -q --hard "$TARGET"

./deploy/deploy.sh

# Записываем только после успешного деплоя — при ошибке повторим на следующем тике.
echo "$TARGET" > "$STATE"
exit 0
}
