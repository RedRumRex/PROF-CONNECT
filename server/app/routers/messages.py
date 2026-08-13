from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims

router = APIRouter(tags=["messages"])


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _run_query(fn, action: str):
    """Runs a Supabase call and converts any exception into a clean
    HTTPException (with CORS headers, readable in the browser) instead of
    letting it escape unhandled — an unhandled exception here bypasses
    Starlette's CORS middleware entirely, which the browser reports as an
    opaque network failure ("Load failed" / "Failed to fetch") instead of
    a real error message."""
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "message" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The 'message' table hasn't been created in Supabase yet. "
                    "Run the message-table block at the bottom of db/schema.sql "
                    "in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Could not {action}: {msg}")


def _check_participant(claims: dict, student_id: int, teacher_id: int) -> str:
    """Confirms the caller is one of the two participants in this thread and
    returns their sender_role ('student' | 'teacher')."""
    role = claims.get("role")
    subject = int(claims["sub"])
    if role == "student" and subject == student_id:
        return "student"
    if role == "teacher" and subject == teacher_id:
        return "teacher"
    raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")


class MessageCreate(BaseModel):
    student_id: int
    teacher_id: int
    body: str


# ── Thread ───────────────────────────────────────────────────────────────
# One thread per (student, teacher) pair. Either participant can read it —
# used by the student's booking-page chat and the teacher's per-request
# "Message" button on the Dashboard.

@router.get("/thread")
def get_thread(
    student_id: int,
    teacher_id: int,
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    claims = require_claims(authorization)
    _check_participant(claims, student_id, teacher_id)

    return _run_query(
        lambda: (
            supabase.table("message")
            .select("*")
            .eq("student_id", student_id)
            .eq("teacher_id", teacher_id)
            .order("created_at")
            .execute()
            .data
        ),
        "load this conversation",
    )


@router.post("", status_code=201)
def send_message(payload: MessageCreate, authorization: Optional[str] = Header(default=None)):
    _require_db()
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    claims = require_claims(authorization)
    sender_role = _check_participant(claims, payload.student_id, payload.teacher_id)

    row = {
        "student_id": payload.student_id,
        "teacher_id": payload.teacher_id,
        "sender_role": sender_role,
        "body": payload.body.strip(),
    }
    inserted = _run_query(
        lambda: supabase.table("message").insert(row).execute().data,
        "send that message",
    )
    return inserted[0] if inserted else row
