# ProfConnect Status API (FastAPI)

The cloud bridge between the ProfConnect frontend and the Raspberry Pi
units mounted on professors' office doors. A Pi pushes availability
changes here; the website reads them (initial load) and subscribes to
live updates (websocket) so the status dot updates in real time.

```
Raspberry Pi (door unit)  ──POST /api/professors/:id/status──▶  this API  ──Socket.IO──▶  Frontend (Explore/Profile)
                            ◀──GET /api/professors/:id/status──          ◀──GET /api/professors──
```

Built with FastAPI + python-socketio (mounted on the same ASGI app/port),
so the frontend's existing `socket.io-client` integration needs no changes.

> Note: an earlier Node/Express version of this API lived in `server/src/`.
> It has been replaced by this Python implementation — those `.js` files
> are now inert stubs and `server/src/`, `server/package.json` can be
> deleted whenever convenient.

## Setup

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
cp devices.example.json devices.json   # then replace each placeholder key

python run.py
```

Server starts on `http://localhost:4000` by default (interactive API docs
at `http://localhost:4000/docs`).

## Endpoint contract

| Method | Path                              | Auth               | Purpose                                             |
|--------|-----------------------------------|---------------------|------------------------------------------------------|
| GET    | `/api/health`                     | none                | Liveness check                                       |
| GET    | `/api/professors`                 | none                | List all professors with current status (bulk read)  |
| GET    | `/api/professors/{id}/status`     | none                | Read one professor's current status                  |
| GET    | `/api/professors/{id}/history`    | none                | Last 25 status changes (debugging)                   |
| POST   | `/api/professors/{id}/status`     | `x-api-key` header  | Push a new status — called by the Pi or the web app   |

Valid `id` values are the professor slugs already used across the frontend
(`aris-thorne`, `elena-vance`, `julian-kross`, `marcus-wei`,
`sarah-jenkins`, `arthur-dent`) — see `app/store.py`.

Valid `status` values: `available`, `busy`, `away` (matches the colors
already defined in `ProfCard.jsx` / `Explore.jsx` / `Profile.jsx`).

FastAPI validates the request body with Pydantic, so a malformed body
(missing `status`, invalid enum value, or a `note` over 280 chars) returns
`422 Unprocessable Entity` with a field-level error, rather than a custom
`400` message.

### Pushing a status update (what the Raspberry Pi does)

```bash
curl -X POST http://localhost:4000/api/professors/aris-thorne/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: <that professor's key from devices.json>" \
  -H "x-device-id: pi-aris-thorne" \
  -d '{"status": "available", "note": "In office, drop by"}'
```

The server validates the key against `devices.json`, updates the in-memory
record, and broadcasts a `status:update` event over Socket.IO to every
connected browser tab and door unit — no polling needed on the frontend.

### Reading current status (what the frontend does on load)

```bash
curl http://localhost:4000/api/professors
```

### Live updates (what the frontend does after load)

The frontend connects with `socket.io-client` and listens for
`status:update` events (see `src/api/professorStatus.js` and
`src/hooks/useLiveStatus.js`) — unchanged from before, since python-socketio
speaks the same protocol. No extra auth is required to *receive* updates —
only to *push* them.

## Auth model

Each professor's Raspberry Pi is issued its own API key in
`devices.json` (gitignored — copy from `devices.example.json`). This
means a compromised or misconfigured device can only ever overwrite its
own professor's status, never another's.

An optional `ADMIN_KEY` (`.env`) can update any professor's status — use
this for a future "toggle availability from the web dashboard" feature
for professors who are away from their office but still want to update
their status.

## Swapping in a real database

Everything data-related lives in `app/store.py`. It's in-memory today
(resets on restart) — swap it for Supabase/Postgres (already a frontend
dependency, `@supabase/supabase-js`) or any other store by reimplementing
`list_professors`, `get_status`, `set_status`, and `get_history` with the
same signatures.

## Deploying

Run this as a small always-on ASGI process (uvicorn/gunicorn behind
nginx, or a platform like Fly.io/Render/Railway) with HTTPS in front of
it, since the Raspberry Pi will be posting over the public internet from
campus wifi. A typical production start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

(Keep `--workers 1` unless you move the in-memory store to a shared
database — multiple workers would each have their own copy of the status
map.)

Point:
- The frontend's `VITE_API_URL` (see root `.env.example`) at the deployed URL.
- Each Pi's `pi-client/.env` `API_BASE_URL` at the same URL.

## Raspberry Pi reference client

See `../pi-client/status_client.py` for a working example of the device
side of this integration (reading a physical control via GPIO, pushing
status, and polling for remote changes to keep the door display in sync).

## Testing

```bash
cd server
pip install -r requirements-dev.txt
pytest
```

Tests live in `tests/` and cover the real router/auth/notification logic
(`app/routers/messages.py`, `app/routers/appointments.py`,
`app/routers/timetable.py`, `app/routers/profile_photo.py`, `app/auth_utils.py`,
`app/notifications.py`, `app/availability_store.py`, `app/timetable_parser.py`)
without touching Supabase or the network: `tests/conftest.py`'s `fake_db` fixture
injects an in-memory stand-in as `app.db.supabase` *before* a router module is
imported, so `from ..db import supabase` binds to the fake instead of `db.py`'s
real `create_client(...)` + live connectivity probe (its `.storage` is a small
fake too, for `profile_photo.py`'s upload flow). This is the same
sys.modules-substitution approach used for ad hoc verification earlier in
this project (see `CONTEXT.md`), formalized into fixtures.

No suite yet covers the frontend (`src/`) or the Socket.IO layer
(`sockets.py`) — the parts most likely to silently break (ownership checks,
unread counts, best-effort notifications, availability persistence,
timetable CSV validation, profile-photo replace-in-place semantics, and the
public-teacher-timetable/private-student-timetable
visibility split) is what's tested for now.
