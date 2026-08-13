from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    validate_password_strength,
    require_claims,
)

router = APIRouter(tags=["auth"])


# ── Request/response models ─────────────────────────────────────────────

class StudentSignup(BaseModel):
    rollno: int
    name: str
    phone_no: int
    branch: str
    email: EmailStr
    year: int
    password: str


class TeacherSignup(BaseModel):
    teacher_id: int
    name: str
    room_number: str
    department: str
    designation: str
    h_index: int
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    role: Literal["student", "teacher"]
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Literal["student", "teacher"]
    profile: dict


class MeResponse(BaseModel):
    role: Literal["student", "teacher"]
    profile: dict


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


# ── Signup ───────────────────────────────────────────────────────────────
# Creates the row in student/teacher AND the matching *_auth row. Does NOT
# return a token — the frontend redirects back to /login after signup.

@router.post("/signup/student", status_code=201)
def signup_student(payload: StudentSignup):
    _require_db()

    pw_error = validate_password_strength(payload.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    if supabase.table("student").select("rollno").eq("rollno", payload.rollno).execute().data:
        raise HTTPException(status_code=409, detail="A student with this roll number already exists.")
    if supabase.table("student").select("rollno").eq("email", payload.email).execute().data:
        raise HTTPException(status_code=409, detail="A student with this email already exists.")

    supabase.table("student").insert({
        "rollno": payload.rollno,
        "name": payload.name,
        "phone_no": payload.phone_no,
        "branch": payload.branch,
        "email": payload.email,
        "year": payload.year,
    }).execute()

    supabase.table("student_auth").insert({
        "rollno": payload.rollno,
        "password_hash": hash_password(payload.password),
    }).execute()

    return {"message": "Student account created. Please log in."}


@router.post("/signup/teacher", status_code=201)
def signup_teacher(payload: TeacherSignup):
    _require_db()

    pw_error = validate_password_strength(payload.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    if supabase.table("teacher").select("teacher_id").eq("teacher_id", payload.teacher_id).execute().data:
        raise HTTPException(status_code=409, detail="A teacher with this ID already exists.")
    if supabase.table("teacher_auth").select("teacher_id").eq("email", payload.email).execute().data:
        raise HTTPException(status_code=409, detail="A teacher with this email already exists.")

    supabase.table("teacher").insert({
        "teacher_id": payload.teacher_id,
        "name": payload.name,
        "room_number": payload.room_number,
        "department": payload.department,
        "designation": payload.designation,
        "h_index": payload.h_index,
    }).execute()

    supabase.table("teacher_auth").insert({
        "teacher_id": payload.teacher_id,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
    }).execute()

    return {"message": "Teacher account created. Please log in."}


# ── Login ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    _require_db()

    invalid = HTTPException(status_code=401, detail="Invalid email or password.")

    if payload.role == "student":
        students = supabase.table("student").select("*").eq("email", payload.email).execute().data
        if not students:
            raise invalid
        profile = students[0]

        auth_rows = supabase.table("student_auth").select("*").eq("rollno", profile["rollno"]).execute().data
        if not auth_rows or not verify_password(payload.password, auth_rows[0]["password_hash"]):
            raise invalid

        supabase.table("student_auth").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
        }).eq("rollno", profile["rollno"]).execute()

        token = create_access_token(subject=str(profile["rollno"]), role="student")
        return TokenResponse(access_token=token, role="student", profile=profile)

    # role == "teacher"
    auth_rows = supabase.table("teacher_auth").select("*").eq("email", payload.email).execute().data
    if not auth_rows or not verify_password(payload.password, auth_rows[0]["password_hash"]):
        raise invalid
    auth = auth_rows[0]

    teachers = supabase.table("teacher").select("*").eq("teacher_id", auth["teacher_id"]).execute().data
    profile = teachers[0] if teachers else {"teacher_id": auth["teacher_id"]}
    profile["email"] = auth["email"]

    supabase.table("teacher_auth").update({
        "last_login_at": datetime.now(timezone.utc).isoformat(),
    }).eq("teacher_id", auth["teacher_id"]).execute()

    token = create_access_token(subject=str(auth["teacher_id"]), role="teacher")
    return TokenResponse(access_token=token, role="teacher", profile=profile)


# ── Current user ─────────────────────────────────────────────────────────
# Re-reads the logged-in user's row fresh from the DB on every call — the
# source of truth for what the Profile/Dashboard pages display, instead of
# relying only on the snapshot cached in localStorage at login time.

@router.get("/me", response_model=MeResponse)
def me(authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    role = claims.get("role")
    subject = claims.get("sub")

    if role == "student":
        rows = supabase.table("student").select("*").eq("rollno", int(subject)).execute().data
        if not rows:
            raise HTTPException(status_code=404, detail="Student record not found. It may have been removed.")
        return MeResponse(role="student", profile=rows[0])

    if role == "teacher":
        teachers = supabase.table("teacher").select("*").eq("teacher_id", int(subject)).execute().data
        profile = teachers[0] if teachers else {"teacher_id": int(subject)}

        auth_rows = supabase.table("teacher_auth").select("email").eq("teacher_id", int(subject)).execute().data
        if auth_rows:
            profile["email"] = auth_rows[0]["email"]

        if not teachers:
            raise HTTPException(status_code=404, detail="Teacher record not found. It may have been removed.")
        return MeResponse(role="teacher", profile=profile)

    raise HTTPException(status_code=401, detail="Invalid session token. Please log in again.")
