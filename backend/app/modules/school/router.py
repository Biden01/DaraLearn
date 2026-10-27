"""Школа: пользователи, классы, роли. В V0 — календарь ученика и обращения в поддержку."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, hash_password, require_role
from app.modules.decisions.models import AuditLog
from app.modules.leads.notify import send_telegram
from app.modules.school import people_import
from app.modules.school.access import class_students, get_class, new_code, visible_classes
from app.modules.school.models import CalendarEvent, ClassMember, Invite, School, SchoolClass, SupportMessage, User

router = APIRouter(prefix="/school", tags=["school"])


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    day: date
    time: str = Field(default="", pattern=r"^$|^([01]\d|2[0-3]):[0-5]\d$")
    kind: Literal["lesson", "homework", "test", "other"] = "lesson"


class SupportIn(BaseModel):
    text: str = Field(min_length=3, max_length=3000)


def _event_out(e: CalendarEvent) -> dict:
    return {"id": e.id, "title": e.title, "day": e.day.isoformat(), "time": e.time, "kind": e.kind}


@router.get("/calendar")
def calendar(start: date, end: date, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(CalendarEvent).where(CalendarEvent.user_id == user.id, CalendarEvent.day >= start,
                                                  CalendarEvent.day <= end).order_by(CalendarEvent.day, CalendarEvent.time))
    return [_event_out(e) for e in rows]


@router.post("/calendar", status_code=status.HTTP_201_CREATED)
def add_event(payload: EventIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    e = CalendarEvent(user_id=user.id, **payload.model_dump())
    db.add(e)
    db.commit()
    return _event_out(e)


@router.delete("/calendar/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    e = db.get(CalendarEvent, event_id)
    if not e or e.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(e)
    db.commit()


@router.post("/support", status_code=status.HTTP_201_CREATED)
def support(payload: SupportIn, background: BackgroundTasks, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    m = SupportMessage(user_id=user.id, text=payload.text.strip())
    db.add(m)
    db.commit()
    background.add_task(send_telegram, f"Обращение в поддержку от {user.name} <{user.email}>:\n{m.text}")
    return {"id": m.id}


# ---------- Управление: школы, классы, коды, ученики ----------

MAX_IMPORT_BYTES = 2 * 1024 * 1024


class SchoolIn(BaseModel):
    name: str = Field(min_length=2, max_length=300)
    city: str = Field(default="", max_length=120)


class InviteIn(BaseModel):
    role: Literal["teacher", "curator"]
    days: int = Field(default=30, ge=1, le=365)
    max_uses: int = Field(default=20, ge=1, le=500)


class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    grade: int = Field(ge=5, le=11)
    subject: str = Field(default="math", max_length=50)
    school_id: int | None = None  # для админа


class UserPatch(BaseModel):
    role: Literal["student", "teacher", "curator", "admin"] | None = None
    school_id: int | None = None
    reset_password: bool = False


def audit(db: Session, actor: User, action: str, entity: str, entity_id: int | None, **data) -> None:
    db.add(AuditLog(actor_id=actor.id, action=action, entity=entity, entity_id=entity_id, data=data))


def _invite_out(i: Invite) -> dict:
    return {"id": i.id, "code": i.code, "role": i.role, "uses": i.uses, "max_uses": i.max_uses,
            "expires_at": i.expires_at.isoformat() if i.expires_at else None}


def _class_out(db: Session, c: SchoolClass) -> dict:
    teacher = db.get(User, c.teacher_id) if c.teacher_id else None
    inv = db.scalar(select(Invite).where(Invite.class_id == c.id).order_by(Invite.id.desc()))
    n = db.scalar(select(func.count()).select_from(ClassMember).where(ClassMember.class_id == c.id)) or 0
    return {"id": c.id, "name": c.name, "grade": c.grade, "subject": c.subject, "school_id": c.school_id,
            "teacher": teacher.name if teacher else None, "students": n, "code": inv.code if inv else None}


@router.get("/schools")
def list_schools(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    out = []
    for s in db.scalars(select(School).order_by(School.name)):
        invites = db.scalars(select(Invite).where(Invite.school_id == s.id, Invite.class_id.is_(None)).order_by(Invite.id.desc()))
        staff = db.scalar(select(func.count()).select_from(User).where(User.school_id == s.id, User.role.in_(["teacher", "curator"])))
        out.append({"id": s.id, "name": s.name, "city": s.city, "staff": staff,
                    "classes": db.scalar(select(func.count()).select_from(SchoolClass).where(SchoolClass.school_id == s.id)),
                    "invites": [_invite_out(i) for i in invites]})
    return out


@router.post("/schools", status_code=status.HTTP_201_CREATED)
def create_school(payload: SchoolIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    s = School(name=payload.name.strip(), city=payload.city.strip())
    db.add(s)
    db.flush()
    audit(db, user, "school.create", "school", s.id, name=s.name)
    db.commit()
    return {"id": s.id, "name": s.name, "city": s.city}


@router.post("/schools/{school_id}/invites", status_code=status.HTTP_201_CREATED)
def create_school_invite(school_id: int, payload: InviteIn, user: User = Depends(require_role("admin")),
                         db: Session = Depends(get_db)) -> dict:
    if not db.get(School, school_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    inv = Invite(code=new_code(), role=payload.role, school_id=school_id, max_uses=payload.max_uses, created_by=user.id,
                 expires_at=datetime.now(timezone.utc) + timedelta(days=payload.days))
    db.add(inv)
    db.commit()
    return _invite_out(inv)


@router.get("/classes")
def classes(user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> list[dict]:
    return [_class_out(db, c) for c in visible_classes(db, user)]


@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(payload: ClassIn, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    school_id = payload.school_id if user.role == "admin" else user.school_id
    if not school_id or not db.get(School, school_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_school")
    c = SchoolClass(school_id=school_id, teacher_id=user.id if user.role == "teacher" else None,
                    name=payload.name.strip(), grade=payload.grade, subject=payload.subject)
    db.add(c)
    db.flush()
    db.add(Invite(code=new_code(), role="student", school_id=school_id, class_id=c.id, max_uses=100, created_by=user.id))
    audit(db, user, "class.create", "class", c.id, name=c.name)
    db.commit()
    return _class_out(db, c)


@router.post("/classes/{class_id}/code")
def regenerate_code(class_id: int, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    c = get_class(db, user, class_id)
    for old in db.scalars(select(Invite).where(Invite.class_id == c.id)):
        old.max_uses = old.uses  # старый код больше не работает
    db.add(Invite(code=new_code(), role="student", school_id=c.school_id, class_id=c.id, max_uses=100, created_by=user.id))
    db.commit()
    return _class_out(db, c)


@router.get("/classes/{class_id}/students")
def students(class_id: int, user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> list[dict]:
    get_class(db, user, class_id)
    return [{"id": s.id, "name": s.name, "login": s.login, "email": s.email, "grade": s.grade}
            for s in class_students(db, class_id)]


@router.delete("/classes/{class_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student(class_id: int, student_id: int, user: User = Depends(require_role("teacher")),
                   db: Session = Depends(get_db)) -> None:
    get_class(db, user, class_id)
    m = db.scalar(select(ClassMember).where(ClassMember.class_id == class_id, ClassMember.user_id == student_id))
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(m)
    audit(db, user, "class.remove_student", "class", class_id, student_id=student_id)
    db.commit()


@router.post("/classes/{class_id}/import")
async def import_students(class_id: int, file: UploadFile = File(...), user: User = Depends(require_role("teacher")),
                          db: Session = Depends(get_db)) -> Response:
    """Таблица: ФИО в первой колонке. Ответ — Excel с логинами и временными паролями."""
    c = get_class(db, user, class_id)
    data = await file.read(MAX_IMPORT_BYTES + 1)
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large")
    try:
        rows = people_import.read_rows(file.filename or "", data)
    except Exception:  # noqa: BLE001  битый файл
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad_file")
    names = [r[0] for r in rows if r and r[0]][:200]
    if not names:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty_file")
    taken = set(db.scalars(select(User.login).where(User.login.is_not(None))))
    out = []
    for name in names:
        base, n = people_import.base_login(name), 1
        login = base
        while login in taken:
            n += 1
            login = f"{base}{n}"
        taken.add(login)
        pwd = people_import.temp_password()
        s = User(login=login, name=name, password_hash=hash_password(pwd), grade=c.grade, school_id=c.school_id,
                 must_change_password=True)
        db.add(s)
        db.flush()
        db.add(ClassMember(class_id=c.id, user_id=s.id))
        out.append((name, login, pwd))
    audit(db, user, "class.import_students", "class", c.id, count=len(out))
    db.commit()
    return Response(people_import.credentials_xlsx(out),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="class-{c.id}-logins.xlsx"'})


@router.get("/users")
def list_users(q: str = "", role: str = "", user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(User).order_by(User.id.desc()).limit(300)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(User.name).like(like) | func.lower(User.email).like(like) | User.login.like(like))
    if role:
        stmt = stmt.where(User.role == role)
    schools = {s.id: s.name for s in db.scalars(select(School))}
    return [{"id": u.id, "name": u.name, "email": u.email, "login": u.login, "role": u.role,
             "school": schools.get(u.school_id), "school_id": u.school_id, "created_at": u.created_at.isoformat()}
            for u in db.scalars(stmt)]


@router.patch("/users/{user_id}")
def patch_user(user_id: int, payload: UserPatch, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if u.id == user.id and payload.role and payload.role != "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot_demote_self")
    out = {}
    if payload.role:
        u.role = payload.role
    if payload.school_id is not None:
        u.school_id = payload.school_id or None
    if payload.reset_password:
        out["password"] = people_import.temp_password()
        u.password_hash = hash_password(out["password"])
        u.must_change_password = True
    audit(db, user, "user.update", "user", u.id, role=payload.role, reset=payload.reset_password)
    db.commit()
    return {"id": u.id, "role": u.role, "school_id": u.school_id, **out}
