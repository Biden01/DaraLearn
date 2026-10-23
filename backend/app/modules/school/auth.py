"""Регистрация, вход и профиль ученика."""
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import clear_session, current_user, hash_password, set_session, verify_password
from app.modules.leads.router import client_ip
from app.modules.school.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_LIMIT = 10        # попыток
LOGIN_WINDOW = 600      # секунд
_attempts: dict[str, deque[float]] = defaultdict(deque)


def check_login_rate(ip: str) -> None:
    now = time.monotonic()
    q = _attempts[ip]
    while q and now - q[0] > LOGIN_WINDOW:
        q.popleft()
    if len(q) >= LOGIN_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too_many_attempts")
    q.append(now)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    grade: int = Field(default=8, ge=5, le=11)
    lang: Literal["kk", "ru"] = "kk"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    grade: int | None = Field(default=None, ge=5, le=11)
    lang: Literal["kk", "ru"] | None = None
    weekly_goal: int | None = Field(default=None, ge=5, le=300)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    grade: int
    lang: str
    role: str
    weekly_goal: int

    model_config = {"from_attributes": True}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    check_login_rate(client_ip(request))
    email = payload.email.lower()
    if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "email_taken")
    user = User(email=email, password_hash=hash_password(payload.password), name=payload.name.strip(),
                grade=payload.grade, lang=payload.lang)
    db.add(user)
    db.commit()
    set_session(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    check_login_rate(client_ip(request))
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad_credentials")
    set_session(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_session(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(user, k, v.strip() if isinstance(v, str) else v)
    db.add(user)
    db.commit()
    return user
