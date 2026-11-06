#!/usr/bin/env bash
# Автодеплой: раз в минуту (systemd-таймер daralearn-autodeploy.timer) проверяет
# origin/main и, если там новые коммиты и CI на них зелёный, выкладывает их.
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

# Выкладываем только коммит, на котором CI (.github/workflows/ci.yml, push в
# main) прошёл. Пока идёт — ждём следующего тика; упал — не выкладываем, ждём
# исправляющий коммит. GitHub API без токена (репо публичный), запрос только
# когда есть невыложенный коммит, так что лимит 60/час не задевается.
REPO="${GH_REPO:-$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}"
FAILED_MARK="$(git rev-parse --git-dir)/autodeploy-ci-failed"
CI="$(curl -fsS -m 20 -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/actions/workflows/ci.yml/runs?head_sha=$TARGET&event=push&branch=main&per_page=1" \
  | jq -r '.workflow_runs[0] // {} | "\(.status // "none") \(.conclusion // "-")"')" \
  || { echo "==> Не удалось узнать статус CI для ${TARGET:0:7}, повторю позже" >&2; exit 0; }
case "$CI" in
  "completed success") ;;
  completed\ *)
    # Пишем в журнал один раз на коммит, а не каждую минуту.
    if [ "$(cat "$FAILED_MARK" 2>/dev/null)" != "$TARGET" ]; then
      echo "==> CI на ${TARGET:0:7} не прошёл ($CI) — не выкладываю, прод остаётся на $(git rev-parse --short "$(cat "$STATE")")" >&2
      echo "$TARGET" > "$FAILED_MARK"
    fi
    exit 0 ;;
  *) exit 0 ;;  # CI ещё не начался или идёт
esac

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
