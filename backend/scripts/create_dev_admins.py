"""Админ-аккаунты разработчиков (логин = имя на Scrum-доске). Существующих не трогает.

docker exec -i daralearn-backend-1 python - < backend/scripts/create_dev_admins.py
"""
from sqlalchemy import select

from app import models  # noqa: F401  регистрирует таблицы
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.modules.school.models import User
from app.modules.school.people_import import temp_password

TEAM = ("era", "daul", "ali", "gala")

with SessionLocal() as db:
    for login in TEAM:
        if db.scalar(select(User).where(User.login == login)):
            print(f"{login}: уже есть")
            continue
        pw = temp_password()
        db.add(User(login=login, name=login.capitalize(), role="admin", password_hash=hash_password(pw),
                    must_change_password=True, lang="ru"))
        print(f"{login}: {pw}")
    db.commit()
