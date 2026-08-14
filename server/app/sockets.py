# Real-time fan-out: whenever a Raspberry Pi (or the professor's own
# dashboard) pushes a status change, every connected browser tab and every
# other door unit gets a `status:update` event immediately — no polling.
#
# Uses python-socketio so the existing frontend `socket.io-client`
# integration (src/api/professorStatus.js) needs no changes.
import socketio

from .config import CORS_ORIGIN
from .auth_utils import decode_access_token

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGIN)


@sio.event
async def connect(sid, environ):  # noqa: ARG001
    await sio.enter_room(sid, "status")


async def broadcast_status_update(payload: dict) -> None:
    await sio.emit("status:update", payload, room="status")


# ── Per-user notification rooms ─────────────────────────────────────────
# A browser tab joins its own private room right after connecting (and on
# every reconnect) by sending its JWT — see subscribeToNotifications() in
# src/api/notifications.js. This lets the server push a notification to
# exactly the one student or teacher it's for, instead of broadcasting to
# every connected tab like the "status" room above does.
@sio.event
async def subscribe_notifications(sid, data):
    token = (data or {}).get("token")
    if not token:
        return
    try:
        claims = decode_access_token(token)
    except Exception:  # noqa: BLE001
        return
    role = claims.get("role")
    subject = claims.get("sub")
    if not (role and subject):
        return

    # Leave any notify:* room this socket previously joined before joining
    # the new one. Without this, a browser tab that logs out and back in as
    # a different user (without a full page reload — the socket connection
    # itself stays open) would remain subscribed to the old user's room
    # forever, so it'd also receive that old user's notifications — e.g. a
    # teacher who'd earlier tested as a student on the same tab would keep
    # seeing that student's notifications, including their own outgoing
    # message once they switched back to the teacher account.
    for room in list(sio.rooms(sid)):
        if room != sid and room.startswith("notify:"):
            await sio.leave_room(sid, room)

    await sio.enter_room(sid, f"notify:{role}:{subject}")


async def broadcast_notification(recipient_role: str, recipient_id, payload: dict) -> None:
    await sio.emit("notification:new", payload, room=f"notify:{recipient_role}:{recipient_id}")
