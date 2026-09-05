# Personal weekly timetable — either role can upload one (see
# app/timetable_parser.py for the CSV format/validation, README.md's
# "Timetable" section for the user-facing spec). One row per class in
# `timetable_entry`, keyed by owner_role + owner_id — same pattern as
# notification's recipient_role/recipient_id, since which table owner_id
# points at (student.rollno vs teacher.teacher_id) depends on owner_role.
from typing import Optional

from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims
from ..timetable_parser import parse_timetable_csv, TimetableParseError

router = APIRouter(tags=["timetable"])


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _run_query(fn, action: str):
    """Same CORS-safe wrapper used elsewhere (messages.py, notifications.py,
    availability_store.py) — an unhandled exception here bypasses
    Starlette's CORS middleware, which the browser reports as an opaque
    "Load failed" instead of a real error message."""
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "timetable_entry" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The 'timetable_entry' table hasn't been created in Supabase yet. "
                    "Run the timetable block at the bottom of db/schema.sql "
                    "in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Could not {action}: {msg}")


def _identity(authorization: Optional[str]):
    claims = require_claims(authorization)
    role = claims.get("role")
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=403, detail="Unknown role.")
    return role, int(claims["sub"])


def _serialize(row: dict) -> dict:
    return {
        "entry_id": row.get("entry_id"),
        "day": row["day_of_week"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "subject": row["subject"],
        "room": row.get("room"),
        "instructor": row.get("instructor"),
        # Older rows predating this column default to "lecture" at the DB
        # level (see db/schema.sql), but fall back here too just in case.
        "type": row.get("class_type") or "lecture",
    }


# GET /api/timetable/me — the signed-in user's own timetable (either role).
@router.get("/me")
def get_my_timetable(authorization: Optional[str] = Header(default=None)):
    _require_db()
    role, owner_id = _identity(authorization)

    rows = _run_query(
        lambda: (
            supabase.table("timetable_entry")
            .select("*")
            .eq("owner_role", role)
            .eq("owner_id", owner_id)
            .order("start_time")
            .execute()
            .data
        ),
        "load your timetable",
    )
    return [_serialize(r) for r in rows]


# POST /api/timetable/upload — parses the uploaded CSV and replaces this
# user's *entire* timetable with it. A re-upload is meant to supersede the
# last one, not append to it (re-uploading a corrected file after fixing a
# typo shouldn't leave the old, wrong rows sitting alongside the new ones).
@router.post("/upload")
async def upload_timetable(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    role, owner_id = _identity(authorization)

    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    raw = await file.read()

    try:
        parsed = parse_timetable_csv(raw)
    except TimetableParseError as e:
        # A list of specific, line-numbered problems — not a single vague
        # message — so the frontend can show the student everything to fix
        # in one pass instead of a slow fix-one-error-at-a-time loop.
        raise HTTPException(status_code=422, detail=e.errors)

    _run_query(
        lambda: (
            supabase.table("timetable_entry")
            .delete()
            .eq("owner_role", role)
            .eq("owner_id", owner_id)
            .execute()
            .data
        ),
        "clear your previous timetable",
    )

    rows_to_insert = [
        {
            "owner_role": role,
            "owner_id": owner_id,
            "day_of_week": entry["day"],
            "start_time": entry["start_time"].isoformat(),
            "end_time": entry["end_time"].isoformat(),
            "subject": entry["subject"],
            "room": entry["room"],
            "instructor": entry["instructor"],
            "class_type": entry["type"],
        }
        for entry in parsed
    ]

    inserted = _run_query(
        lambda: supabase.table("timetable_entry").insert(rows_to_insert).execute().data,
        "save your timetable",
    )
    return [_serialize(r) for r in inserted]


# GET /api/timetable/teacher/{teacher_id} — read-only view of a professor's
# timetable, visible to *any* signed-in student or teacher (not just the
# professor themselves) — this is what the professor's profile page uses.
# There is deliberately no student-equivalent of this endpoint: a student's
# own timetable (get_my_timetable above) is visible only to that student.
@router.get("/teacher/{teacher_id}")
def get_teacher_timetable(teacher_id: int, authorization: Optional[str] = Header(default=None)):
    _require_db()
    require_claims(authorization)  # any signed-in student or teacher may view

    rows = _run_query(
        lambda: (
            supabase.table("timetable_entry")
            .select("*")
            .eq("owner_role", "teacher")
            .eq("owner_id", teacher_id)
            .order("start_time")
            .execute()
            .data
        ),
        "load that professor's timetable",
    )
    return [_serialize(r) for r in rows]


# DELETE /api/timetable/me — clears the signed-in user's timetable (e.g.
# before uploading a new one from scratch, or if they just want it gone).
@router.delete("/me")
def clear_my_timetable(authorization: Optional[str] = Header(default=None)):
    _require_db()
    role, owner_id = _identity(authorization)

    _run_query(
        lambda: (
            supabase.table("timetable_entry")
            .delete()
            .eq("owner_role", role)
            .eq("owner_id", owner_id)
            .execute()
            .data
        ),
        "clear your timetable",
    )
    return {"ok": True}
