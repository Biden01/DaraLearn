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
