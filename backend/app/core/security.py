"""Пароли (bcrypt) и сессия ученика: JWT в httpOnly-cookie."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db

COOKIE = "dl_session"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def set_session(response: Response, user_id: int) -> None:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    token = jwt.encode({"sub": str(user_id), "exp": exp}, settings.jwt_secret, algorithm="HS256")
    response.set_cookie(COOKIE, token, max_age=settings.session_days * 86400, httponly=True,
                        secure=settings.is_production, samesite="lax", path="/api")


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/api")


def current_user(dl_session: str = Cookie(default=""), db: Session = Depends(get_db)):
    # Импорт здесь, чтобы core не зависел от модулей при загрузке.
    from app.modules.school.models import User

    if not dl_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно войти")
    try:
        payload = jwt.decode(dl_session, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Сессия истекла")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно войти")
    return user


def require_role(*roles: str):
    """Зависимость: пользователь с одной из ролей (админ проходит всегда)."""
    def dep(user=Depends(current_user)):
        if user.role != "admin" and user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")
        return user
    return dep
