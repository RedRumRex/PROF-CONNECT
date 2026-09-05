from datetime import datetime, timezone

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGIN
from .routers.professors import router as professors_router
from .routers.auth import router as auth_router
from .routers.teachers import router as teachers_router
from .routers.appointments import router as appointments_router
from .routers.messages import router as messages_router
from .routers.availability import router as availability_router
from .routers.notifications import router as notifications_router
from .routers.timetable import router as timetable_router
from .routers.profile_photo import router as profile_photo_router
from .sockets import sio

fastapi_app = FastAPI(title="ProfConnect Status API")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGIN,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.get("/api/health")
async def health():
    return {
        "ok": True,
        "service": "profconnect-status-api",
        "time": datetime.now(timezone.utc).isoformat(),
    }


fastapi_app.include_router(professors_router, prefix="/api/professors")
fastapi_app.include_router(auth_router, prefix="/api/auth")
fastapi_app.include_router(teachers_router, prefix="/api/teachers")
fastapi_app.include_router(appointments_router, prefix="/api/appointments")
fastapi_app.include_router(messages_router, prefix="/api/messages")
fastapi_app.include_router(availability_router, prefix="/api/availability")
fastapi_app.include_router(notifications_router, prefix="/api/notifications")
fastapi_app.include_router(timetable_router, prefix="/api/timetable")
fastapi_app.include_router(profile_photo_router, prefix="/api/profile")

# Mount Socket.IO alongside the REST routes on the same ASGI app/port.
# socketio_path="socket.io" matches the socket.io-client default of
# connecting to "<origin>/socket.io/".
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
