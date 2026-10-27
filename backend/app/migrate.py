"""Запуск при старте контейнера: миграции до head, затем загрузка учебных материалов."""
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.db import SessionLocal, engine
from app.modules.content.seed import seed_content

BASELINE = "0001"
log = logging.getLogger("migrate")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: [%(name)s] %(message)s")
    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    tables = inspect(engine).get_table_names()
    if "alembic_version" not in tables and "users" in tables:
        # база создана ещё через create_all: схема совпадает с базовой миграцией
        log.info("existing schema without alembic_version: stamping %s", BASELINE)
        command.stamp(cfg, BASELINE)
    command.upgrade(cfg, "head")
    with SessionLocal() as db:
        seed_content(db)


if __name__ == "__main__":
    main()
