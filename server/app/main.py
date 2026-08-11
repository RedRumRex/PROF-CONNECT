from datetime import datetime, timezone

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGIN
from .routers.professors import router as professors_router
from .routers.auth import router as auth_router
from .routers.teachers import router as teachers_router
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

# Mount Socket.IO alongside the REST routes on the same ASGI app/port.
# socketio_path="socket.io" matches the socket.io-client default of
# connecting to "<origin>/socket.io/".
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
