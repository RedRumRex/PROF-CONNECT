# ProfConnect

ProfConnect connects students and professors at Thapar Institute of Engineering and Technology. Students browse a directory of professors, view live profiles, book appointment sessions, message professors directly, and get notified as things happen. Professors manage incoming appointment requests, toggle whether they're actually in their office right now, and message back — all from one dashboard.

This README describes the system as it exists today: a React/Vite single-page frontend talking to a FastAPI backend, backed by Supabase Postgres, with Socket.IO for anything that needs to update live (availability status, notifications) without a page refresh.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS |
| Backend | FastAPI (Python), Uvicorn |
| Real-time | python-socketio, mounted on the same ASGI app as the REST API (`socket.io-client` on the frontend) |
| Database | Supabase (managed Postgres), accessed via `supabase-py` with the service-role key |
| Auth | Custom JWT (PyJWT, HS256) issued by the backend; passwords hashed with `bcrypt` |

## Architecture at a glance

```
┌─────────────────────┐        REST (JWT bearer)        ┌──────────────────────┐        ┌──────────────┐
│  React SPA (Vite)   │ ───────────────────────────────▶ │  FastAPI backend     │ ─────▶ │   Supabase   │
│  src/pages/*.jsx    │ ◀─────────────────────────────── │  server/app/         │ ◀───── │   Postgres   │
└─────────┬───────────┘                                  └──────────┬───────────┘        └──────────────┘
          │                                                          │
          │              Socket.IO (same host/port)                 │
          └──────────────────────────────────────────────────────────┘
             "status" room   → live availability dots (broadcast to everyone)
             "notify:{role}:{id}" rooms → per-user notification push
```

Both the REST API and the WebSocket server are mounted on a single ASGI app (`server/app/main.py`), so there's only one backend process to run. The frontend never talks to Supabase directly — every read/write goes through the FastAPI backend, which holds the Supabase **service-role** key.

Every signed-in request carries a JWT in the `Authorization: Bearer <token>` header. The token's payload is `{ sub: <id>, role: "student" | "teacher" }` — `sub` is the student's `rollno` or the teacher's `teacher_id` depending on `role`. Almost every backend endpoint derives "who is calling" from this token rather than trusting anything the client sends in the request body, which is what makes ownership checks possible (e.g. a teacher can only respond to appointments addressed to them, only mark their own notifications read, etc.).

## Frontend structure

```
src/
├─ pages/
│  ├─ Login.jsx, SignUp.jsx        — auth
│  ├─ Home.jsx                     — student landing page + merged "Explore" professor directory
│  ├─ Dashboard.jsx                — teacher landing page (requests, availability toggle, chat)
│  ├─ Profile.jsx                  — public view of a single professor (by teacher_id)
│  ├─ StudentProfile.jsx           — the signed-in student's own profile
│  ├─ Appointment.jsx              — book a session with a professor + chat thread
│  ├─ Appointments.jsx             — role-aware list of pending/upcoming/past appointments
│  ├─ Messages.jsx                 — standalone messages page (currently static/mock UI)
│  └─ Settings.jsx
├─ components/                     — Navbar (incl. notification bell), Sidebar, BottomNav, Background
├─ api/                            — one thin fetch-wrapper module per backend router
├─ hooks/                          — useLiveStatus, useNotifications (Socket.IO-backed)
└─ lib/                            — auth.js (localStorage session), profile.js (DB row → view-model mappers)
```

Routing (`src/App.jsx`) is a flat `react-router-dom` v6 route table; there's no route guarding at the router level — each page checks `getToken()`/`getProfile()` from `src/lib/auth.js` itself and redirects to `/login` if there's no session.

`src/pages/Explore.jsx` is an orphaned leftover from before the directory was merged into `Home.jsx` — it's unused and unrouted, safe to delete.

## Backend structure

```
server/app/
├─ main.py                — FastAPI app, CORS, router mounting, Socket.IO ASGI wrapping
├─ config.py               — env var loading (.env)
├─ db.py                   — Supabase client construction + startup connectivity probe
├─ auth_utils.py           — password hashing, JWT issue/verify, require_claims() used by every protected route
├─ sockets.py              — Socket.IO server: "status" broadcast room + per-user "notify:*" rooms
├─ notifications.py        — best-effort notification creation + live push (called from other routers)
├─ availability_store.py   — in-memory "is this teacher in their room" store, keyed by real teacher_id
├─ store.py                — legacy in-memory store for the old Raspberry-Pi-door-unit demo (see below)
└─ routers/
   ├─ auth.py               /api/auth        — signup, login, GET /me
   ├─ teachers.py            /api/teachers    — public professor directory + single-teacher lookup
   ├─ appointments.py        /api/appointments — request/list/accept/decline sessions
   ├─ messages.py            /api/messages    — per (student, teacher) chat thread
   ├─ availability.py        /api/availability — the real "available in room" toggle
   ├─ notifications.py       /api/notifications — list / mark-read / mark-all-read
   └─ professors.py          /api/professors   — legacy door-unit demo, see below
```

## Data model (Supabase / Postgres)

Defined in `db/schema.sql`. The first block (`student`, `teacher`, `appointment`, `student_auth`, `teacher_auth`) is the original schema and isn't idempotent — re-running it drops and recreates `student`. The `message` and `notification` blocks were added later and are written with `create table if not exists`, specifically so they can be run standalone against a database that already has the earlier tables populated.

| Table | Purpose |
|---|---|
| `student` | `rollno` (PK), name, phone, branch, email, year |
| `teacher` | `teacher_id` (PK), name, room_number, department, designation, h_index |
| `student_auth` / `teacher_auth` | 1:1 with `student`/`teacher`, holds `password_hash`; `teacher_auth` also holds the login email (teacher has no email column of its own) |
| `appointment` | A session request. `status` is a nullable boolean: `NULL` = pending, `true` = accepted, `false` = declined |
| `message` | One row per chat message. One thread per `(student_id, teacher_id)` pair; `sender_role` says which side sent it |
| `notification` | One row per notification. `recipient_role` + `recipient_id` together identify who it's for (no single FK, since it points at either `student` or `teacher` depending on role) |

**If you're setting this up fresh:** run the whole file top to bottom. **If `student`/`teacher`/`appointment`/`*_auth` already exist in your project:** only run the `message` and `notification` blocks at the bottom — re-running the earlier blocks will fail (or, in `student`'s case, wipe the table).

## Features

### Accounts and roles
Sign-up/login is role-specific (student vs. teacher), backed by `student_auth`/`teacher_auth`. Passwords are hashed with `bcrypt`; a successful login returns a JWT that the frontend stores in `localStorage` (`src/lib/auth.js`) alongside a lightweight cached profile snapshot.

### Professor directory
`Home.jsx` fetches the real `teacher` table (`GET /api/teachers`) and renders it as a filterable, sortable grid (department chips, availability filter, H-index sort) — this used to be a separate `/explore` page with hardcoded professors; it's now a section of the Home page, and `Profile.jsx` shows a single professor by `teacher_id`.

### Appointments
A student requests a session (`POST /api/appointments`) against a real `appointment` row with `status = NULL`. The professor sees it on their Dashboard and accepts or declines (`PATCH /api/appointments/{id}/respond`) — only then does the student see it as booked. `Appointments.jsx` gives both roles a combined pending/upcoming/past view.

### Messaging
Real, persisted per-(student, teacher) chat threads (`message` table), not scripted placeholder text. Students chat from the booking page (`Appointment.jsx`); teachers get a "Message" action + chat modal on each appointment request in the Dashboard.

### Live availability ("Available in Room")
A professor-only toggle on the Dashboard that flips their real-time status between "Available in Room" and "Not in Room." This is pushed instantly to every connected browser over the `status` Socket.IO room and read by `useLiveStatus()`, which every professor card / profile page already consumes. It's backed by `availability_store.py`, an in-memory map keyed by the real `teacher_id` — separate from, and a full replacement for, the older `store.py` demo described below.

### Notifications
A student booking a session, a teacher accepting/declining, or either side sending a message all create a `notification` row and push it live over a private `notify:{role}:{id}` Socket.IO room (`notifications.py`, `sockets.py`). The bell in `Navbar.jsx` shows an unread badge, a dropdown list, click-to-navigate, and mark-(all)-read — visible on every page, for both roles. Notification creation is deliberately best-effort: if it fails for any reason (including the `notification` table not existing yet), the booking/response/message action it's attached to still succeeds.

### Legacy: Raspberry Pi door-unit bridge
`store.py` + `routers/professors.py` + `GET/POST /api/professors/...` are a leftover from an earlier version of the product concept, where a physical Raspberry Pi mounted on each professor's door would push availability over an API key. It's keyed by fake seed professor slugs (`aris-thorne`, `elena-vance`, ...) that don't correspond to any real `teacher_id`, and nothing in the current UI reads from it. It's harmless to leave in place (see `server/README.md` for its original design) but the "Available in Room" feature above is what actually powers the app today.

## API summary

All protected routes expect `Authorization: Bearer <jwt>`. `role` below is what the route enforces via the token's claims, not a request parameter.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create a student or teacher account |
| POST | `/api/auth/login` | — | Log in, returns JWT + profile |
| GET | `/api/auth/me` | any | Refresh the cached profile |
| GET | `/api/teachers` | — | Public professor directory |
| GET | `/api/teachers/{id}` | — | Single professor lookup |
| POST | `/api/appointments` | student | Request a session |
| GET | `/api/appointments/student` | student | My own requests |
| GET | `/api/appointments/teacher` | teacher | Requests addressed to me |
| PATCH | `/api/appointments/{id}/respond` | teacher | Accept/decline a request |
| GET | `/api/messages/thread` | participant | Read a (student, teacher) thread |
| POST | `/api/messages` | participant | Send a message |
| GET | `/api/availability` | — | Bulk availability map (all teachers) |
| GET | `/api/availability/{teacher_id}` | — | One teacher's availability |
| PATCH | `/api/availability/me` | teacher | Toggle my own availability |
| GET | `/api/notifications` | any | My notifications |
| PATCH | `/api/notifications/{id}/read` | any | Mark one read |
| PATCH | `/api/notifications/read-all` | any | Mark all read |

Interactive docs are available at `http://localhost:4000/docs` while the backend is running.

## Environment variables

Root `.env.example` (frontend, consumed by Vite):

```
VITE_API_URL=http://localhost:4000
```

`server/.env.example` (backend):

```
PORT=4000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=change-this-jwt-secret
JWT_EXPIRE_MINUTES=1440
```

(`server/.env.example` also has `DEVICE_KEYS_FILE` / `ADMIN_KEY`, which only matter for the legacy Raspberry Pi bridge described above.)

## Running locally

**Frontend:**

```bash
npm install
cp .env.example .env
npm run dev
```

**Backend:**

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then fill in SUPABASE_URL / SUPABASE_SERVICE_KEY / JWT_SECRET
python run.py
```

The backend logs `[db] Connected to Supabase successfully.` on startup if everything's configured correctly, or a specific, actionable error (bad URL vs. bad key vs. missing table) if not — see `server/app/db.py`.

## Known limitations

- **`availability_store.py` and `store.py` are in-memory** — a teacher's "Available in Room" status resets to "away" on backend restart. Swap in a real `teacher.available` column if you need it to persist.
- **`message` and `notification` tables need a one-time manual migration** on any Supabase project that already had the original tables — see the "Data model" section above.
- **`Messages.jsx` is still a standalone page with static/mock conversation data** — it predates the real per-(student, teacher) messaging system and hasn't been wired to it yet. Real messaging today lives on `Appointment.jsx` (student side) and the Dashboard chat modal (teacher side).
- **`src/pages/Explore.jsx` is dead code** — superseded by the Explore section inside `Home.jsx`, left in place but unrouted.
- Very new Python versions (3.14+) have been observed to hit `[SSL: UNEXPECTED_EOF_WHILE_READING]` errors connecting to Supabase due to an OpenSSL 3.x/httpx compatibility gap — upgrading `supabase`/`httpx`/`httpcore`, or running the backend on Python 3.11/3.12, resolves it.
