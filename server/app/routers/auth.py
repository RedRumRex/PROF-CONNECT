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


def _delete_and_verify(table: str, col: str, value) -> None:
    """Deletes every row where `col` = `value` from `table`, and raises a
    precise, actionable error if Supabase reports back that 0 rows were
    removed — instead of treating that as success.

    This distinguishes the two ways a delete can silently do nothing:
    - No row matched at all (checked with a SELECT first) — not
      necessarily wrong (e.g. cleaning up a table the account never had
      rows in), so this alone isn't an error for the *_auth/main tables
      either, since a row existing at signup should always still be there.
    - A row *does* match on SELECT, but the DELETE itself reports 0 rows
      removed — this is the "silently did nothing" case (e.g. a Row Level
      Security policy blocking deletes specifically, a BEFORE DELETE
      trigger swallowing it, or a stale schema cache) and is the one worth
      surfacing loudly, since it produces exactly the bug reported here:
      the frontend sees a 200 and moves on, but the row — and the ability
      to log back in with it — never actually goes away.
    """
    existing = supabase.table(table).select(col).eq(col, value).execute().data
    if not existing:
        return  # Nothing to delete here — not an error.

    result = supabase.table(table).delete().eq(col, value).execute()
    if not result.data:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Deleting from '{table}' (where {col} = {value}) found a matching row "
                f"but the database reported 0 rows removed. This points to something on "
                f"the '{table}' table specifically blocking deletes — check Supabase "
                f"dashboard: Authentication -> Policies for a Row Level Security policy "
                f"on '{table}', or Database -> Triggers for a trigger intercepting DELETE."
            ),
        )


# ── Delete account ───────────────────────────────────────────────────────
# Permanently removes the signed-in user's data. The frontend's "Delete
# Account" confirmation (Settings.jsx) is the only gate — this endpoint
# trusts the caller's JWT and deletes on request.
#
# Every related row is deleted explicitly here, in child-before-parent
# order, rather than relying on `on delete cascade` doing it for us — a
# live test showed the *_auth row surviving a `teacher`/`student` row
# deletion with no error at all (the account could still log in
# afterwards), so the cascade FK declared in db/schema.sql can't be
# trusted to actually be in effect on every project. The *_auth and main
# rows are additionally verified via `_delete_and_verify` above, since
# those two are what actually gate whether the account can still log in —
# an unverified `.delete()` call can report success while quietly
# deleting nothing at all.
#
# `notification` and `timetable_entry` are polymorphic (recipient_role/
# recipient_id, owner_role/owner_id) rather than foreign keys at all, since
# which table they point at depends on the role. The uploaded avatar
# (Supabase Storage, `avatars/{role}/{id}`) is removed best-effort too.
@router.delete("/me")
def delete_account(authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    role = claims.get("role")
    subject = claims.get("sub")
    if role not in ("student", "teacher") or subject is None:
        raise HTTPException(status_code=401, detail="Invalid session token. Please log in again.")
    owner_id = int(subject)

    own_col = "student_id" if role == "student" else "teacher_id"
    auth_table, auth_key = ("student_auth", "rollno") if role == "student" else ("teacher_auth", "teacher_id")
    main_table, main_key = ("student", "rollno") if role == "student" else ("teacher", "teacher_id")

    # Best-effort cleanup — none of these should block the account deletion
    # below, and a failure here (e.g. a table that doesn't exist yet on an
    # older project) shouldn't stop the rest from running.
    for cleanup in (
        lambda: supabase.table("message").delete().eq(own_col, owner_id).execute(),
        lambda: supabase.table("appointment").delete().eq(own_col, owner_id).execute(),
        lambda: supabase.table("notification").delete().eq("recipient_role", role).eq("recipient_id", owner_id).execute(),
        lambda: supabase.table("timetable_entry").delete().eq("owner_role", role).eq("owner_id", owner_id).execute(),
        lambda: supabase.storage.from_("avatars").remove([f"{role}/{owner_id}"]),
    ):
        try:
            cleanup()
        except Exception:  # noqa: BLE001
            pass

    # These two are what actually gate whether the account still works —
    # verified, not just attempted. The auth row goes first since that's
    # what login checks; if it fails, the main row is left alone rather
    # than half-deleting the account.
    try:
        _delete_and_verify(auth_table, auth_key, owner_id)
        _delete_and_verify(main_table, main_key, owner_id)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Could not delete your account: {e}")

    return {"message": "Account deleted."}
