# Persisted "is this professor in their room right now" toggle, keyed by
# the real numeric teacher_id from the `teacher` table (Supabase). This is
# distinct from the legacy Raspberry-Pi-door-unit store in store.py — that
# one is keyed by fake seed slugs ("aris-thorne", etc.) left over from
# before the app had real DB-backed teachers, and nothing in the UI reads
# from it anymore.
#
# Previously an in-memory dict (status reset to "away" on every backend
# restart — see CONTEXT.md's "Known outstanding items"). Now backed by the
# `teacher.available` / `teacher.available_updated_at` columns added at the
# bottom of db/schema.sql, so a professor's status survives a restart.
#
# Function names/signatures are unchanged from the in-memory version on
# purpose — routers/availability.py needed zero changes to pick this up.
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from .db import supabase, SUPABASE_ERROR


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _run_query(fn, action: str):
    """Same CORS-safe wrapper used elsewhere (messages.py, notifications.py)
    — an unhandled exception here bypasses Starlette's CORS middleware,
    which the browser reports as an opaque "Load failed" instead of a real
    error message."""
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "available" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The teacher.available/available_updated_at columns haven't been "
                    "added yet. Run the availability-persistence block at the bottom "
                    "of db/schema.sql in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Could not {action}: {msg}")


def _row_to_record(row: dict) -> dict:
    return {
        "status": "available" if row.get("available") else "away",
        # No column backs a note today — the toggle never sent one (see
        # AvailabilityUpdate in routers/availability.py) — kept in the shape
        # for compatibility with anything reading statusMap[id].note.
        "note": None,
        "updatedAt": row.get("available_updated_at"),
    }


def get_status(teacher_id: int) -> dict:
    _require_db()
    rows = _run_query(
        lambda: (
            supabase.table("teacher")
            .select("available,available_updated_at")
            .eq("teacher_id", teacher_id)
            .execute()
            .data
        ),
        "load this professor's availability",
    )
    if not rows:
        return {"status": "away", "note": None, "updatedAt": None}
    return _row_to_record(rows[0])


def list_statuses() -> dict[int, dict]:
    _require_db()
    rows = _run_query(
        lambda: (
            supabase.table("teacher")
            .select("teacher_id,available,available_updated_at")
            .execute()
            .data
        ),
        "load availability",
    )
    return {r["teacher_id"]: _row_to_record(r) for r in rows}


def set_status(teacher_id: int, *, available: bool, note: Optional[str] = None) -> dict:
    _require_db()
    now = datetime.now(timezone.utc).isoformat()
    updated = _run_query(
        lambda: (
            supabase.table("teacher")
            .update({"available": available, "available_updated_at": now})
            .eq("teacher_id", teacher_id)
            .execute()
            .data
        ),
        "update your availability",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    return _row_to_record(updated[0])
