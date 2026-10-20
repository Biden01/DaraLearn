import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import Base, engine
from app.modules.content.router import router as content_router
from app.modules.decisions.router import router as decisions_router
from app.modules.events.router import router as events_router
from app.modules.leads import models as _lead_models  # noqa: F401  регистрирует таблицу
from app.modules.leads.router import router as leads_router
from app.modules.school.router import router as school_router
from app.modules.state.router import router as state_router
from app.modules.tutor.router import router as tutor_router
from app.modules.verification.router import router as verification_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s: [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # До появления миграций (Alembic) создаём таблицы при старте.
    Base.metadata.create_all(engine)
    yield


# В проде Swagger и схему не публикуем.
app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok"}


for r in (school_router, content_router, events_router, state_router,
          decisions_router, tutor_router, verification_router, leads_router):
    api.include_router(r)

app.include_router(api)
