from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .. import store
from ..config import ADMIN_KEY, DEVICE_KEYS
from ..sockets import broadcast_status_update

router = APIRouter(tags=["professors"])


class StatusUpdate(BaseModel):
    status: Literal["available", "busy", "away"]
    note: Optional[str] = Field(default=None, max_length=280)


def _authorize(professor_id: str, x_api_key: Optional[str]) -> str:
    """Returns the auth source ('pi-device' | 'web-app') or raises 401/403.

    A request is authorized if it presents either the device key assigned
    to that specific professor's Raspberry Pi, or the ADMIN_KEY, used by
    the professor's own logged-in web session to override status manually.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing x-api-key header")

    device_key = DEVICE_KEYS.get(professor_id)
    is_device = bool(device_key) and x_api_key == device_key
    is_admin = bool(ADMIN_KEY) and x_api_key == ADMIN_KEY

    if not (is_device or is_admin):
        raise HTTPException(status_code=403, detail="Invalid API key for this professor/device")

    return "pi-device" if is_device else "web-app"


# GET /api/professors
# Bulk read — used by the Explore / Dashboard pages to paint every status
# dot on initial page load, before the websocket takes over for live updates.
@router.get("")
async def list_professors():
    return store.list_professors()


# GET /api/professors/{id}/status
# Single professor read — used by the Raspberry Pi to poll its own status
# on boot/reconnect, and by the Profile page.
@router.get("/{professor_id}/status")
async def get_status(professor_id: str):
    record = store.get_status(professor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Unknown professor id")
    return record


# GET /api/professors/{id}/history
# Recent status changes — handy for debugging a Pi's connectivity/behavior.
@router.get("/{professor_id}/history")
async def get_history(professor_id: str):
    if not store.professor_exists(professor_id):
        raise HTTPException(status_code=404, detail="Unknown professor id")
    return store.get_history(professor_id)


# POST /api/professors/{id}/status
# The core bridge endpoint. The door-mounted Raspberry Pi calls this
# whenever its physical control (button / switch / knob) changes, sending
# its device API key in the `x-api-key` header. The professor's web app can
# also call it (with ADMIN_KEY) to override remotely.
@router.post("/{professor_id}/status")
async def post_status(
    professor_id: str,
    body: StatusUpdate,
    x_api_key: Optional[str] = Header(default=None),
    x_device_id: Optional[str] = Header(default=None),
):
    source = _authorize(professor_id, x_api_key)

    if not store.professor_exists(professor_id):
        raise HTTPException(status_code=404, detail="Unknown professor id")

    record = store.set_status(
        professor_id,
        status=body.status,
        note=body.note,
        source=source,
        device_id=x_device_id,
    )

    await broadcast_status_update(record)
    return record
