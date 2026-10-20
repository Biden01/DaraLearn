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
Заявки сохраняются в таблицу `leads`. Если в `.env` заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`,
о каждой заявке приходит сообщение в Telegram. Посмотреть список:
```bash
curl -s https://daralearn.kz/api/leads -H "X-Admin-Token: $ADMIN_TOKEN"
```

## Документы
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — модули и инфраструктура
- [docs/PLAN.md](docs/PLAN.md) — план V0: границы, модель данных, API, этапы, метрики
