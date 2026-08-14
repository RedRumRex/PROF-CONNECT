# The signed-in user's own notification feed — powers the bell dropdown in
# Navbar.jsx. Rows are created elsewhere (see ../notifications.py, called
# from appointments.py and messages.py); this router only reads and
# acknowledges them.
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims

router = APIRouter(tags=["notifications"])


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _run_query(fn, action: str):
    """Same CORS-safe wrapper used in messages.py — an unhandled exception
    here bypasses Starlette's CORS middleware, which the browser reports as
    an opaque "Load failed" instead of a real error message."""
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "notification" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The 'notification' table hasn't been created in Supabase yet. "
                    "Run the notification-table block at the bottom of db/schema.sql "
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


# GET /api/notifications
# The caller's own notifications, most recent first — paints the bell
# dropdown + unread badge on load.
@router.get("")
def list_notifications(authorization: Optional[str] = Header(default=None)):
    _require_db()
    role, recipient_id = _identity(authorization)

    return _run_query(
        lambda: (
            supabase.table("notification")
            .select("*")
            .eq("recipient_role", role)
            .eq("recipient_id", recipient_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
        ),
        "load your notifications",
    )


# PATCH /api/notifications/{id}/read
@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, authorization: Optional[str] = Header(default=None)):
    _require_db()
    role, recipient_id = _identity(authorization)

    rows = _run_query(
        lambda: supabase.table("notification").select("*").eq("notification_id", notification_id).execute().data,
        "load that notification",
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if rows[0]["recipient_role"] != role or rows[0]["recipient_id"] != recipient_id:
        raise HTTPException(status_code=403, detail="This notification does not belong to you.")

    updated = _run_query(
        lambda: (
            supabase.table("notification")
            .update({"read": True})
            .eq("notification_id", notification_id)
            .execute()
            .data
        ),
        "update that notification",
    )
    return updated[0] if updated else rows[0]


# PATCH /api/notifications/read-all
@router.patch("/read-all")
def mark_all_read(authorization: Optional[str] = Header(default=None)):
    _require_db()
    role, recipient_id = _identity(authorization)

    _run_query(
        lambda: (
            supabase.table("notification")
            .update({"read": True})
            .eq("recipient_role", role)
            .eq("recipient_id", recipient_id)
            .eq("read", False)
            .execute()
            .data
        ),
        "update your notifications",
    )
    return {"ok": True}
