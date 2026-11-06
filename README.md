# DaraLearn

Платформа, которая помогает найти учебный пробел ученика, дать нужную помощь и проверить результат.
Подробности — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Стек
- **backend/** — Python 3.12, FastAPI, SQLAlchemy, PostgreSQL
- **frontend/** — React 18 + Vite

## Локальная разработка
```bash
cp .env.example .env              # задать POSTGRES_PASSWORD
docker compose up -d              # база + API на http://localhost:8000/api/docs

cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Деплой
```bash
sudo ./deploy/deploy.sh
```

## Заявки с лендинга
Заявки сохраняются в таблицу `leads` и видны админу в кабинете («Заявки»). Список через - API:
```bash
curl -s https://daralearn.kz/api/leads -H "X-Admin-Token: $ADMIN_TOKEN"
```

## Документы
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — модули и инфраструктура
- [docs/PLAN.md](docs/PLAN.md) — план V0: границы, модель данных, API, этапы, метрики

## Мониторинг и логи
- `deploy/monitor.sh` раз в минуту (systemd `daralearn-monitor.timer`) дёргает `https://daralearn.kz/api/health`
  (он проверяет и базу: 503, если Postgres недоступен) и отчитывается в Healthchecks.io; тот шлёт email команде
  при падении (с кодом ответа и хвостом логов бэкенда) и при восстановлении. Если умер весь сервер — пинги
  прекращаются, и Healthchecks тоже шлёт алерт.
- Установка (один раз, от root):
  ```bash
  cp deploy/monitor.env.example /etc/daralearn-monitor.env && chmod 600 /etc/daralearn-monitor.env  # вписать HC_PING_URL
  cp deploy/daralearn-monitor.{service,timer} /etc/systemd/system/
  systemctl daemon-reload && systemctl enable --now daralearn-monitor.timer
  ```
- Логи контейнеров ротируются (3 × 10 МБ на сервис): `docker compose logs --tail 200 backend`.
