#!/usr/bin/env bash
# Мониторинг прода: раз в минуту (daralearn-monitor.timer) проверяет
# https://daralearn.kz/api/health снаружи — через DNS, TLS, nginx, бэкенд и базу.
#
# Результат шлётся в Healthchecks.io (HC_PING_URL), он и рассылает email команде:
#   ok   -> пинг HC_PING_URL         (после сбоя придёт письмо «восстановлено»)
#   сбой -> пинг HC_PING_URL/fail    (письмо «DOWN» с кодом ответа и хвостом логов)
#   сервер умер / таймер не работает -> пингов нет, Healthchecks сам шлёт «DOWN».
#
# Настройки: /etc/daralearn-monitor.env (см. deploy/monitor.env.example).
set -uo pipefail

URL=${HEALTH_URL:-https://daralearn.kz/api/health}
: "${HC_PING_URL:?задайте HC_PING_URL в /etc/daralearn-monitor.env}"
COMPOSE_DIR=${COMPOSE_DIR:-/home/era/daralearn}

check() {
  curl -sS -o /tmp/daralearn-health.$$ -w '%{http_code}' --max-time 10 "$URL" 2>/tmp/daralearn-health-err.$$
}

# Две попытки с паузой, чтобы не будить людей из-за одного сетевого чиха.
code=$(check); [ "$code" = 200 ] || { sleep 5; code=$(check); }
body=$(head -c 300 /tmp/daralearn-health.$$ 2>/dev/null)
err=$(cat /tmp/daralearn-health-err.$$ 2>/dev/null)
rm -f /tmp/daralearn-health.$$ /tmp/daralearn-health-err.$$

ping_hc() {  # $1 = "" | "/fail", stdin = тело (попадает в письмо)
  curl -fsS -m 10 --retry 3 -o /dev/null --data-binary @- "${HC_PING_URL}$1" \
    || echo "monitor: не удалось достучаться до Healthchecks" >&2
}

if [ "$code" = 200 ]; then
  echo "ok $URL" | ping_hc ""
  exit 0
fi

echo "monitor: FAIL $URL -> HTTP $code $err" >&2
{
  echo "DaraLearn: $URL ответил HTTP $code"
  [ -n "$err" ]  && echo "curl: $err"
  [ -n "$body" ] && echo "ответ: $body"
  echo
  echo "== docker compose ps =="
  (cd "$COMPOSE_DIR" && docker compose ps --format 'table {{.Service}}\t{{.Status}}') 2>&1
  echo
  echo "== последние логи backend =="
  (cd "$COMPOSE_DIR" && docker compose logs --no-color --tail 40 backend) 2>&1 | tail -c 6000
} | ping_hc "/fail"
exit 1
