# Real teacher "available in my room" toggle — professor-only feature.
# Distinct from routers/professors.py (the legacy Raspberry-Pi-door-unit
# bridge, keyed by fake seed professor ids and gated by device/admin API
# keys). This router is keyed by the real numeric teacher_id and gated by
# the teacher's own JWT, so a professor can only ever set their own status.
#
# Broadcasts through the same socket.io "status:update" channel as the
# legacy system (see ../sockets.py), so the existing frontend
# useLiveStatus() hook picks up changes with no socket-side changes needed.
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .. import availability_store as store
from ..auth_utils import require_claims
from ..sockets import broadcast_status_update

router = APIRouter(tags=["availability"])


class AvailabilityUpdate(BaseModel):
    available: bool


# GET /api/availability
# Bulk read — used by useLiveStatus() to paint every status dot on initial
# page load, before the websocket takes over for live updates.
@router.get("")
def list_availability():
    return [
        {"id": str(teacher_id), **record}
        for teacher_id, record in store.list_statuses().items()
    ]


# GET /api/availability/{teacher_id}
# Single professor read — used by the Profile page.
@router.get("/{teacher_id}")
def get_availability(teacher_id: int):
    return {"id": str(teacher_id), **store.get_status(teacher_id)}


# PATCH /api/availability/me
# The professor's own "Available in my room" toggle on the Dashboard. Only
# the signed-in teacher can set their own availability — there is no way
# for a student, or one teacher, to set another teacher's status.
@router.patch("/me")
async def set_my_availability(
    payload: AvailabilityUpdate,
    authorization: Optional[str] = Header(default=None),
):
    claims = require_claims(authorization)
    if claims.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can set their own availability.")
    teacher_id = int(claims["sub"])

    record = store.set_status(teacher_id, available=payload.available)
    result = {"id": str(teacher_id), **record}

    await broadcast_status_update(result)
    return result
