from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR

router = APIRouter(tags=["teachers"])


class TeacherPublic(BaseModel):
    teacher_id: int
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    room_number: Optional[str] = None
    h_index: Optional[int] = None
    avatar_url: Optional[str] = None


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _run_query(fn, action: str):
    """Same CORS-safe wrapper used elsewhere (messages.py, timetable.py,
    availability_store.py) — an unhandled exception here bypasses
    Starlette's CORS middleware, which the browser reports as an opaque
    "Load failed" instead of a real error message. Added here specifically
    because `avatar_url` (added for the "Add Profile Photo" feature) won't
    exist until the migration in README.md's "Profile photo" section runs."""
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "avatar_url" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The 'avatar_url' column hasn't been added to 'teacher' yet. "
                    "Run the profile-photo `alter table` statements from README.md's "
                    "'Profile photo' section in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Could not {action}: {msg}")


# GET /api/teachers
# Public directory of every teacher on file — backs the professor grid
# merged into the Home page. No auth required; only non-sensitive columns
# are selected (no email, no *_auth table).
@router.get("", response_model=list[TeacherPublic])
def list_teachers():
    _require_db()
    return _run_query(
        lambda: (
            supabase.table("teacher")
            .select("teacher_id,name,department,designation,room_number,h_index,avatar_url")
            .order("name")
            .execute()
            .data
        ),
        "load the professor directory",
    )


# GET /api/teachers/{teacher_id}
# Single teacher lookup — backs the "Full Profile" / booking pages reached
# from the Explore grid. Public, same non-sensitive column set as the list.
@router.get("/{teacher_id}", response_model=TeacherPublic)
def get_teacher(teacher_id: int):
    _require_db()
    rows = _run_query(
        lambda: (
            supabase.table("teacher")
            .select("teacher_id,name,department,designation,room_number,h_index,avatar_url")
            .eq("teacher_id", teacher_id)
            .execute()
            .data
        ),
        "load that professor",
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    return rows[0]
