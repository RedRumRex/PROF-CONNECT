# Real-time fan-out: whenever a Raspberry Pi (or the professor's own
# dashboard) pushes a status change, every connected browser tab and every
# other door unit gets a `status:update` event immediately — no polling.
#
# Uses python-socketio so the existing frontend `socket.io-client`
# integration (src/api/professorStatus.js) needs no changes.
import socketio

from .config import CORS_ORIGIN

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGIN)


@sio.event
async def connect(sid, environ):  # noqa: ARG001
    await sio.enter_room(sid, "status")


async def broadcast_status_update(payload: dict) -> None:
    await sio.emit("status:update", payload, room="status")
