import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims
from ..notifications import notify

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


# ── Thread-notification link helpers ────────────────────────────────────
# Every "new message" notification's `link` field doubles as a pointer to
# *which* thread it's about, keyed by the other participant's id — a
# teacher_id for a student recipient, a student rollno for a teacher
# recipient. GET /conversations and PATCH /conversations/{id}/read both
# rely on being able to parse this back out, so the format is centralized
# here rather than duplicated at each call site.
def _thread_notify_link(recipient_role: str, other_id: int) -> str:
    if recipient_role == "student":
        return f"/appointment/{other_id}"
    return f"/dashboard?student_id={other_id}"


_STUDENT_LINK_RE = re.compile(r"^/appointment/(\d+)$")
_TEACHER_LINK_RE = re.compile(r"^/dashboard\?student_id=(\d+)$")


def _other_id_from_link(role: str, link: Optional[str]) -> Optional[int]:
    if not link:
        return None
    match = _STUDENT_LINK_RE.match(link) if role == "student" else _TEACHER_LINK_RE.match(link)
    return int(match.group(1)) if match else None


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
async def send_message(payload: MessageCreate, authorization: Optional[str] = Header(default=None)):
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
    result = inserted[0] if inserted else row

    # Best-effort — a notification hiccup should never fail sending the
    # message itself.
    try:
        preview = payload.body.strip()
        if len(preview) > 120:
            preview = preview[:117] + "..."

        if sender_role == "student":
            sender_rows = supabase.table("student").select("name").eq("rollno", payload.student_id).execute().data
            sender_name = sender_rows[0]["name"] if sender_rows else "A student"
            await notify(
                recipient_role="teacher",
                recipient_id=payload.teacher_id,
                type="message",
                title=f"New message from {sender_name}",
                body=preview,
                link=_thread_notify_link("teacher", payload.student_id),
            )
        else:
            sender_rows = supabase.table("teacher").select("name").eq("teacher_id", payload.teacher_id).execute().data
            sender_name = sender_rows[0]["name"] if sender_rows else "A professor"
            await notify(
                recipient_role="student",
                recipient_id=payload.student_id,
                type="message",
                title=f"New message from {sender_name}",
                body=preview,
                link=_thread_notify_link("student", payload.teacher_id),
            )
    except Exception:  # noqa: BLE001
        pass

    return result


# ── Conversations ────────────────────────────────────────────────────────
# One entry per counterpart the signed-in user has ever exchanged messages
# with — powers the real Messages.jsx page (previously static/mock data).
# There's no dedicated "conversations" table: this derives the list from
# `message` rows plus unread counts from message-type `notification` rows,
# rather than from `appointment` rows, since a conversation can exist
# without ever becoming a booking (Appointment.jsx lets a student message a
# professor before requesting any session).

@router.get("/conversations")
def list_conversations(authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    role = claims.get("role")
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=403, detail="Unknown role.")
    subject = int(claims["sub"])

    own_col = "student_id" if role == "student" else "teacher_id"
    other_col = "teacher_id" if role == "student" else "student_id"

    rows = _run_query(
        lambda: (
            supabase.table("message")
            .select("*")
            .eq(own_col, subject)
            .order("created_at")
            .execute()
            .data
        ),
        "load your conversations",
    )

    # Ascending order means the last write for each counterpart ends up
    # holding their most recent message.
    last_by_other: dict[int, dict] = {}
    for r in rows:
        last_by_other[r[other_col]] = r

    if not last_by_other:
        return []

    other_ids = list(last_by_other.keys())
    if role == "student":
        directory = _run_query(
            lambda: (
                supabase.table("teacher")
                .select("teacher_id,name,department,designation")
                .in_("teacher_id", other_ids)
                .execute()
                .data
            ),
            "load the professor directory",
        )
        directory_by_id = {d["teacher_id"]: d for d in directory}
    else:
        directory = _run_query(
            lambda: (
                supabase.table("student")
                .select("rollno,name,branch,year")
                .in_("rollno", other_ids)
                .execute()
                .data
            ),
            "load the student directory",
        )
        directory_by_id = {d["rollno"]: d for d in directory}

    unread_counts: dict[int, int] = {}
    notif_rows = _run_query(
        lambda: (
            supabase.table("notification")
            .select("link")
            .eq("recipient_role", role)
            .eq("recipient_id", subject)
            .eq("type", "message")
            .eq("read", False)
            .execute()
            .data
        ),
        "load unread message counts",
    )
    for n in notif_rows:
        other_id = _other_id_from_link(role, n.get("link"))
        if other_id is not None:
            unread_counts[other_id] = unread_counts.get(other_id, 0) + 1

    out = []
    for other_id, last in last_by_other.items():
        info = directory_by_id.get(other_id, {})
        if role == "student":
            department = info.get("department")
            designation = info.get("designation")
        else:
            department = info.get("branch")
            designation = f"Year {info['year']}" if info.get("year") else None
        out.append({
            "id": other_id,
            "name": info.get("name"),
            "department": department,
            "designation": designation,
            "last_message": {
                "body": last.get("body"),
                "sender_role": last.get("sender_role"),
                "created_at": last.get("created_at"),
            },
            "unread": unread_counts.get(other_id, 0),
        })

    out.sort(key=lambda c: c["last_message"]["created_at"] or "", reverse=True)
    return out


# PATCH /api/messages/conversations/{other_id}/read — marks this thread's
# unread message-type notifications as read. `other_id` is the counterpart's
# id (a teacher_id when the caller is a student, a rollno when the caller is
# a teacher) rather than a notification_id, since Messages.jsx knows which
# conversation it just opened, not which notification rows back it.
@router.patch("/conversations/{other_id}/read")
def mark_conversation_read(other_id: int, authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    role = claims.get("role")
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=403, detail="Unknown role.")
    subject = int(claims["sub"])

    target_link = _thread_notify_link(role, other_id)

    _run_query(
        lambda: (
            supabase.table("notification")
            .update({"read": True})
            .eq("recipient_role", role)
            .eq("recipient_id", subject)
            .eq("type", "message")
            .eq("link", target_link)
            .eq("read", False)
            .execute()
            .data
        ),
        "mark this conversation as read",
    )
    return {"ok": True}
