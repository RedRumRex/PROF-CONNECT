"""Appointment-linked meeting API and WebRTC signaling.

Room membership is authorized through ProfConnect JWTs or an enabled invitation.
WebSocket tickets are short-lived and consumed once; client-supplied roles are
never trusted. Signaling room state is process-local, so deploy one backend
worker unless the room registry is moved to a shared pub/sub service.
"""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from ..auth_utils import require_claims
from ..config import CORS_ORIGIN
from ..db import SUPABASE_ERROR, supabase

router = APIRouter(tags=["meetings"])
MAX_PARTICIPANTS = max(2, min(12, int(os.getenv("MEETING_MAX_PARTICIPANTS", "4"))))
TICKET_TTL_SECONDS = 60
# No third-party STUN/TURN is used by default. Point these at your own coturn
# server (it answers STUN and relays TURN on the same host); see
# deploy/coturn/README.md. With none configured, calls only connect when both
# people can reach each other directly (same network / same machine).
STUN_URLS = [s.strip() for s in os.getenv("MEETING_STUN_URLS", "").split(",") if s.strip()]
TURN_URLS = [s.strip() for s in os.getenv("MEETING_TURN_URLS", "").split(",") if s.strip()]
TURN_SECRET = os.getenv("MEETING_TURN_SECRET", "")
TURN_USERNAME = os.getenv("MEETING_TURN_USERNAME", "")
TURN_PASSWORD = os.getenv("MEETING_TURN_PASSWORD", "")

# In-memory signalling state. Persistent meeting metadata remains in Supabase.
rooms: dict[str, dict[str, dict]] = defaultdict(dict)
tickets: dict[str, dict] = {}
join_attempts = defaultdict(deque)


def _rate_limit(key: str, maximum: int = 45, window_seconds: int = 300):
    now = time.monotonic()
    events = join_attempts[key]
    while events and events[0] < now - window_seconds:
        events.popleft()
    if len(events) >= maximum:
        raise HTTPException(status_code=429, detail="Too many join attempts. Please wait a few minutes and try again.")
    events.append(now)


class InviteRequest(BaseModel):
    passcode: str = Field(default="", max_length=64)


class JoinRequest(BaseModel):
    name: str = Field(default="Guest", min_length=1, max_length=60)
    passcode: str = Field(default="", max_length=64)
    invite_token: str = Field(default="", max_length=256)


def _require_db():
    if supabase is None:
        raise HTTPException(status_code=503, detail=SUPABASE_ERROR or "Database is not configured.")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _passcode_hash(value: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode("utf-8"), bytes.fromhex(salt), 210_000).hex()
    return f"{salt}:{digest}"


def _passcode_matches(value: str, saved: str) -> bool:
    if not saved or ":" not in saved:
        return False
    salt, _ = saved.split(":", 1)
    return hmac.compare_digest(_passcode_hash(value, salt), saved)


def _claims_or_none(authorization: Optional[str]) -> Optional[dict]:
    if not authorization:
        return None
    try:
        return require_claims(authorization)
    except HTTPException as exc:
        if exc.status_code == 401:
            return None
        raise


def _appointment(appointment_id: int) -> dict:
    rows = (
        supabase.table("appointment").select("*")
        .eq("appointment_id", appointment_id).limit(1).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    row = rows[0]
    if row.get("status") is not True:
        raise HTTPException(status_code=403, detail="Meetings are available only for accepted appointments.")
    return row


def _is_appointment_member(claims: dict, appointment: dict) -> bool:
    try:
        subject = int(claims.get("sub", ""))
    except (TypeError, ValueError):
        return False
    role = claims.get("role")
    return (
        role == "student" and subject == int(appointment["student_id"])
    ) or (
        role == "teacher" and subject == int(appointment["teacher_id"])
    )


def _meeting(meeting_id: str) -> dict:
    rows = (
        supabase.table("meeting").select("*")
        .eq("meeting_id", meeting_id).limit(1).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    row = rows[0]
    if row.get("status") == "ended":
        raise HTTPException(status_code=410, detail="This meeting has ended.")
    appointment = _appointment(int(row["appointment_id"]))
    return {**row, "_appointment": appointment}


def _participant_name(claims: dict) -> str:
    role = claims.get("role")
    try:
        subject = int(claims.get("sub", ""))
    except (TypeError, ValueError):
        return "Participant"
    table, key = ("student", "rollno") if role == "student" else ("teacher", "teacher_id")
    rows = supabase.table(table).select("name").eq(key, subject).limit(1).execute().data
    return (rows[0].get("name") if rows else None) or ("Student" if role == "student" else "Professor")


def _ice_servers(peer_id: str) -> list[dict]:
    servers: list[dict] = []
    if STUN_URLS:
        servers.append({"urls": STUN_URLS})
    if TURN_URLS and TURN_SECRET:
        username = f"{int(time.time()) + 86400}:{peer_id}"
        credential = base64.b64encode(
            hmac.new(TURN_SECRET.encode(), username.encode(), hashlib.sha1).digest()
        ).decode()
        servers.append({"urls": TURN_URLS, "username": username, "credential": credential})
    elif TURN_URLS and TURN_USERNAME and TURN_PASSWORD:
        servers.append({"urls": TURN_URLS, "username": TURN_USERNAME, "credential": TURN_PASSWORD})
    return servers


def _public_person(person: dict) -> dict:
    return {key: person.get(key) for key in ("id", "name", "host", "mic", "camera", "hand", "sharing")}


async def _emit(person: dict, payload: dict):
    try:
        async with person["send_lock"]:
            await asyncio.wait_for(person["ws"].send_json(payload), timeout=5)
    except (RuntimeError, WebSocketDisconnect, asyncio.TimeoutError, OSError):
        pass


async def _broadcast(meeting_id: str, payload: dict, exclude: Optional[str] = None):
    await asyncio.gather(*(
        _emit(person, payload)
        for peer_id, person in list(rooms.get(meeting_id, {}).items())
        if peer_id != exclude
    ))


def _origin_allowed(origin: Optional[str], host: Optional[str]) -> bool:
    if not origin:
        return True  # CLI/test clients; browser origins are checked below.
    normalized = origin.rstrip("/")
    if CORS_ORIGIN and normalized in {item.rstrip("/") for item in CORS_ORIGIN}:
        return True
    # Same-origin deployments need not duplicate the frontend URL in config.
    from urllib.parse import urlparse
    parsed = urlparse(origin)
    return bool(host and parsed.netloc == host and parsed.scheme in ("http", "https"))


@router.post("/appointments/{appointment_id}", status_code=201)
def create_or_get_appointment_meeting(
    appointment_id: int, authorization: Optional[str] = Header(default=None)
):
    _require_db()
    claims = require_claims(authorization)
    appointment = _appointment(appointment_id)
    if not _is_appointment_member(claims, appointment):
        raise HTTPException(status_code=403, detail="You are not a participant in this appointment.")
    existing = (
        supabase.table("meeting").select("*")
        .eq("appointment_id", appointment_id).limit(1).execute().data
    )
    if existing:
        row = existing[0]
        if row.get("status") == "ended":
            # Only the appointment's professor can start the meeting again; a
            # student cannot reopen a meeting the professor ended.
            is_host = (
                claims.get("role") == "teacher"
                and int(claims.get("sub", -1)) == int(row["host_teacher_id"])
            )
            if not is_host:
                raise HTTPException(
                    status_code=410,
                    detail="This meeting has ended. Ask your professor to start it again.",
                )
            reopened = {
                "status": "available",
                "ended_at": None,
                # Old guest links die with the old session.
                "invite_enabled": False,
                "invite_token_hash": None,
                "passcode_hash": "",
            }
            supabase.table("meeting").update(reopened).eq("meeting_id", row["meeting_id"]).execute()
            row = {**row, **reopened}
    else:
        payload = {
            "meeting_id": secrets.token_urlsafe(18),
            "appointment_id": appointment_id,
            "host_teacher_id": appointment["teacher_id"],
            "created_by_role": claims["role"],
            "created_by_id": int(claims["sub"]),
            "status": "available",
            "invite_enabled": False,
        }
        try:
            inserted = supabase.table("meeting").insert(payload).execute().data
            row = inserted[0] if inserted else payload
        except Exception:
            # Handles simultaneous clicks where the unique appointment constraint wins.
            existing = (
                supabase.table("meeting").select("*")
                .eq("appointment_id", appointment_id).limit(1).execute().data
            )
            if not existing:
                raise
            row = existing[0]
    return {
        "meeting_id": row["meeting_id"],
        "appointment_id": row["appointment_id"],
        "status": row.get("status", "available"),
        "invite_enabled": bool(row.get("invite_enabled", False)),
    }


@router.get("/appointments/{appointment_id}")
def get_appointment_meeting(appointment_id: int, authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    appointment = _appointment(appointment_id)
    if not _is_appointment_member(claims, appointment):
        raise HTTPException(status_code=403, detail="You are not a participant in this appointment.")
    rows = (
        supabase.table("meeting").select("*")
        .eq("appointment_id", appointment_id).limit(1).execute().data
    )
    if not rows:
        return {"meeting": None}
    row = rows[0]
    return {"meeting_id": row["meeting_id"], "status": row["status"], "invite_enabled": row["invite_enabled"]}


@router.post("/{meeting_id}/invites")
def create_invite(
    meeting_id: str,
    body: InviteRequest,
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    claims = require_claims(authorization)
    row = _meeting(meeting_id)
    if claims.get("role") != "teacher" or int(claims.get("sub", -1)) != int(row["host_teacher_id"]):
        raise HTTPException(status_code=403, detail="Only the appointment's professor can manage invitations.")
    token = secrets.token_urlsafe(32)
    pass_hash = _passcode_hash(body.passcode) if body.passcode else ""
    supabase.table("meeting").update({
        "invite_token_hash": _hash(token),
        "invite_enabled": True,
        "passcode_hash": pass_hash,
    }).eq("meeting_id", meeting_id).execute()
    return {"invite_token": token, "meeting_id": meeting_id, "invite_enabled": True}


@router.delete("/{meeting_id}/invites")
def revoke_invite(meeting_id: str, authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    row = _meeting(meeting_id)
    if claims.get("role") != "teacher" or int(claims.get("sub", -1)) != int(row["host_teacher_id"]):
        raise HTTPException(status_code=403, detail="Only the appointment's professor can manage invitations.")
    supabase.table("meeting").update({
        "invite_token_hash": None,
        "invite_enabled": False,
        "passcode_hash": "",
    }).eq("meeting_id", meeting_id).execute()
    return {"ok": True, "invite_enabled": False}


@router.post("/{meeting_id}/join")
def join_meeting(
    meeting_id: str,
    body: JoinRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    client_host = request.client.host if request and request.client else "unknown"
    _rate_limit(client_host)
    row = _meeting(meeting_id)
    appointment = row["_appointment"]
    claims = _claims_or_none(authorization)
    authenticated_member = bool(claims and _is_appointment_member(claims, appointment))
    is_invited = bool(
        row.get("invite_enabled")
        and row.get("invite_token_hash")
        and body.invite_token
        and hmac.compare_digest(_hash(body.invite_token), row["invite_token_hash"])
    )
    if not authenticated_member and not is_invited:
        raise HTTPException(status_code=403, detail="Sign in as an appointment participant or use a valid invitation link.")
    if is_invited and not authenticated_member and row.get("passcode_hash"):
        if not _passcode_matches(body.passcode, row["passcode_hash"]):
            raise HTTPException(status_code=403, detail="Incorrect invitation passcode.")
    if len(rooms.get(meeting_id, {})) >= MAX_PARTICIPANTS:
        raise HTTPException(status_code=409, detail=f"This meeting is full (limit: {MAX_PARTICIPANTS}).")
    peer_id = secrets.token_urlsafe(12)
    ticket = secrets.token_urlsafe(32)
    host = bool(
        authenticated_member and claims.get("role") == "teacher"
        and int(claims.get("sub", -1)) == int(row["host_teacher_id"])
    )
    name = _participant_name(claims) if authenticated_member else body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Please enter your name.")
    tickets[_hash(ticket)] = {
        "meeting_id": meeting_id, "id": peer_id, "name": name,
        "host": host, "expires": time.time() + TICKET_TTL_SECONDS,
    }
    return {
        "token": ticket, "id": peer_id, "host": host,
        "title": f"ProfConnect appointment #{row['appointment_id']}",
        "iceServers": _ice_servers(peer_id),
    }


@router.websocket("/{meeting_id}/signal")
async def meeting_signal(ws: WebSocket, meeting_id: str):
    if not _origin_allowed(ws.headers.get("origin"), ws.headers.get("host")):
        await ws.close(code=1008)
        return
    await ws.accept()
    person = None
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=10)
        if len(raw) > 1024:
            await ws.close(code=1009)
            return
        auth = json.loads(raw)
        token = auth.get("token") if isinstance(auth, dict) else None
        ticket = tickets.pop(_hash(token), None) if isinstance(token, str) else None
        if not ticket or ticket["meeting_id"] != meeting_id or ticket["expires"] < time.time():
            await ws.send_json({"type": "error", "detail": "Join ticket is invalid or expired. Please rejoin."})
            await ws.close(code=1008)
            return
        # Re-check persisted lifecycle/access after ticket issuance so a ticket
        # minted just before revocation/end cannot open a stale room.
        try:
            _meeting(meeting_id)
        except HTTPException:
            await ws.send_json({"type": "error", "detail": "This meeting is no longer available. Please request a new invitation."})
            await ws.close(code=1008)
            return
        person = {
            **ticket, "ws": ws, "send_lock": asyncio.Lock(),
            "mic": False, "camera": False, "hand": False, "sharing": False,
        }
        current = rooms[meeting_id]
        if len(current) >= MAX_PARTICIPANTS:
            await ws.send_json({"type": "error", "detail": "This meeting is full."})
            await ws.close(code=1008)
            return
        current[person["id"]] = person
        await ws.send_json({
            "type": "welcome", "locked": False,
            "participants": [_public_person(p) for p in current.values() if p["id"] != person["id"]],
        })
        await _broadcast(meeting_id, {"type": "joined", "participant": _public_person(person)}, exclude=person["id"])
        while True:
            raw = await ws.receive_text()
            if len(raw) > 40_000:
                await ws.close(code=1009)
                break
            message = json.loads(raw)
            if not isinstance(message, dict):
                continue
            kind = message.get("type")
            if kind == "ping":
                await ws.send_json({"type": "pong"})
            elif kind in ("offer", "answer", "ice"):
                target = current.get(str(message.get("to", "")))
                if target:
                    forwarded = {"type": kind, "from": person["id"]}
                    if kind in ("offer", "answer"):
                        sdp = message.get("sdp", "")
                        if isinstance(sdp, str) and len(sdp) <= 32_000:
                            forwarded["sdp"] = sdp
                        else:
                            continue
                    else:
                        candidate = message.get("candidate")
                        if not isinstance(candidate, dict):
                            continue
                        forwarded["candidate"] = candidate
                    await _emit(target, forwarded)
            elif kind == "chat":
                text = message.get("text", "")
                if isinstance(text, str) and text.strip():
                    await _broadcast(meeting_id, {
                        "type": "chat", "id": person["id"], "name": person["name"],
                        "text": text.strip()[:2000], "created_at": time.time(),
                    })
            elif kind == "state":
                for key in ("mic", "camera", "hand", "sharing"):
                    if key in message:
                        person[key] = bool(message[key])
                await _broadcast(meeting_id, {"type": "state", "from": person["id"], "state": {
                    key: person[key] for key in ("mic", "camera", "hand", "sharing")
                }}, exclude=person["id"])
            elif kind == "lock":
                if not person["host"]:
                    await _emit(person, {"type": "error", "detail": "Only the host can lock the meeting."})
                else:
                    await _broadcast(meeting_id, {"type": "locked", "locked": bool(message.get("locked"))})
            elif kind == "end":
                if not person["host"]:
                    await _emit(person, {"type": "error", "detail": "Only the host can end the meeting."})
                else:
                    supabase.table("meeting").update({
                        "status": "ended",
                        "ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        # Guest invitations stop working once the session ends.
                        "invite_enabled": False,
                        "invite_token_hash": None,
                        "passcode_hash": "",
                    }).eq("meeting_id", meeting_id).execute()
                    await _broadcast(meeting_id, {"type": "ended"})
                    for peer in list(current.values()):
                        try:
                            await peer["ws"].close(code=1000, reason="Meeting ended")
                        except (RuntimeError, OSError):
                            pass
                    break
    except (WebSocketDisconnect, asyncio.TimeoutError, json.JSONDecodeError, RuntimeError):
        pass
    finally:
        if person:
            current = rooms.get(meeting_id, {})
            current.pop(person["id"], None)
            if current:
                await _broadcast(meeting_id, {"type": "left", "id": person["id"]})
            else:
                rooms.pop(meeting_id, None)
