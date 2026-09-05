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
│  ├─ Profile.jsx                  — public view of a single professor (by teacher_id) — hero + read-only timetable (see "Timetable" below)
│  ├─ StudentProfile.jsx           — the signed-in user's own profile (both roles) — hero + add/change photo + click-to-enlarge
│  ├─ Appointment.jsx              — book a session with a professor + chat thread
│  ├─ Appointments.jsx             — role-aware list of pending/upcoming/past appointments
│  ├─ Messages.jsx                 — full conversation list + chat, real data (see "Messaging" below)
│  ├─ Timetable.jsx                — "My Timetable" page — upload/clear controls + the shared grid, for either role's own schedule
│  └─ Settings.jsx
├─ components/                     — Navbar (incl. notification bell), Sidebar, BottomNav, Background, TimetableGrid (shared Mon–Fri grid, used by Timetable.jsx and Profile.jsx), ImageLightbox (shared enlarge-on-click viewer)
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
├─ availability_store.py   — persisted "is this teacher in their room" store (teacher.available columns)
├─ timetable_parser.py     — parses/validates an uploaded timetable CSV (college hours, lunch break, overlaps)
├─ store.py                — legacy in-memory store for the old Raspberry-Pi-door-unit demo (see below)
└─ routers/
   ├─ auth.py               /api/auth        — signup, login, GET /me
   ├─ teachers.py            /api/teachers    — public professor directory + single-teacher lookup
   ├─ appointments.py        /api/appointments — request/list/accept/decline sessions
   ├─ messages.py            /api/messages    — per (student, teacher) chat thread + conversation list
   ├─ availability.py        /api/availability — the real "available in room" toggle
   ├─ notifications.py       /api/notifications — list / mark-read / mark-all-read
   ├─ timetable.py            /api/timetable   — upload/fetch/clear a personal weekly timetable
   ├─ profile_photo.py        /api/profile     — upload/replace a profile photo (Supabase Storage)
   └─ professors.py          /api/professors   — legacy door-unit demo, see below
```

## Data model (Supabase / Postgres)

Defined in `db/schema.sql`. The first block (`student`, `teacher`, `appointment`, `student_auth`, `teacher_auth`) is the original schema and isn't idempotent — re-running it drops and recreates `student`. The `message` and `notification` blocks, and the `teacher.available`/`teacher.available_updated_at` columns, were added later and are written with `create table if not exists` / `alter table ... add column if not exists`, specifically so they can be run standalone against a database that already has the earlier tables populated.

| Table | Purpose |
|---|---|
| `student` | `rollno` (PK), name, phone, branch, email, year, `avatar_url` |
| `teacher` | `teacher_id` (PK), name, room_number, department, designation, h_index, `avatar_url` |
| `student_auth` / `teacher_auth` | 1:1 with `student`/`teacher`, holds `password_hash`; `teacher_auth` also holds the login email (teacher has no email column of its own) |
| `appointment` | A session request. `status` is a nullable boolean: `NULL` = pending, `true` = accepted, `false` = declined |
| `message` | One row per chat message. One thread per `(student_id, teacher_id)` pair; `sender_role` says which side sent it |
| `notification` | One row per notification. `recipient_role` + `recipient_id` together identify who it's for (no single FK, since it points at either `student` or `teacher` depending on role) |
| `timetable_entry` | One row per class in a signed-in user's personal weekly timetable. `owner_role` + `owner_id` together identify whose it is, same pattern as `notification`. `class_type` (`lecture`/`tutorial`/`lab`, default `lecture`) is what the grid color-codes by |

**If you're setting this up fresh:** run the whole file top to bottom. **If `student`/`teacher`/`appointment`/`*_auth` already exist in your project:** only run the `message`, `notification`, teacher-availability, `timetable_entry`, and profile-photo blocks at the bottom — re-running the earlier blocks will fail (or, in `student`'s case, wipe the table).

## Features

### Accounts and roles
Sign-up/login is role-specific (student vs. teacher), backed by `student_auth`/`teacher_auth`. Passwords are hashed with `bcrypt`; a successful login returns a JWT that the frontend stores in `localStorage` (`src/lib/auth.js`) alongside a lightweight cached profile snapshot.

### Professor directory
`Home.jsx` fetches the real `teacher` table (`GET /api/teachers`) and renders it as a filterable, sortable grid (department chips, availability filter, H-index sort) — this used to be a separate `/explore` page with hardcoded professors; it's now a section of the Home page, and `Profile.jsx` shows a single professor by `teacher_id`.

### Appointments
A student requests a session (`POST /api/appointments`) against a real `appointment` row with `status = NULL`. The professor sees it on their Dashboard and accepts or declines (`PATCH /api/appointments/{id}/respond`) — only then does the student see it as booked. `Appointments.jsx` gives both roles a combined pending/upcoming/past view.

### Messaging
Real, persisted per-(student, teacher) chat threads (`message` table), not scripted placeholder text. Students chat from the booking page (`Appointment.jsx`); teachers get a "Message" action + chat modal on each appointment request in the Dashboard. `Messages.jsx` is a third real surface onto the same threads — a full conversation list for either role, derived from the `message` table (a conversation can exist before any appointment is ever booked) with unread counts sourced from message-type `notification` rows and live updates over the same `notification:new` socket channel.

### Live availability ("Available in Room")
A professor-only toggle on the Dashboard that flips their real-time status between "Available in Room" and "Not in Room." This is pushed instantly to every connected browser over the `status` Socket.IO room and read by `useLiveStatus()`, which every professor card / profile page already consumes. It's backed by `availability_store.py`, which reads/writes the `teacher.available` / `teacher.available_updated_at` columns — separate from, and a full replacement for, the older `store.py` demo described below. (Previously an in-memory map that reset to "away" on every backend restart; now persisted.)

### Notifications
A student booking a session, a teacher accepting/declining, or either side sending a message all create a `notification` row and push it live over a private `notify:{role}:{id}` Socket.IO room (`notifications.py`, `sockets.py`). The bell in `Navbar.jsx` shows an unread badge, a dropdown list, click-to-navigate, and mark-(all)-read — visible on every page, for both roles. Notification creation is deliberately best-effort: if it fails for any reason (including the `notification` table not existing yet), the booking/response/message action it's attached to still succeeds.

### Timetable
Either role can upload their own personal weekly class schedule as a CSV via the "Upload Timetable" button on `Timetable.jsx` (`/timetable`), which renders it as a Monday–Friday, 8:00 AM–5:10 PM grid with the 1:00–1:50 PM lunch break blocked out. The CSV format (one row per class):

```
day,start_time,end_time,subject,room,instructor,type
Mon,08:00,08:50,Data Structures,LT-1,Dr. Sharma,lecture
Mon,09:00,09:50,Engineering Mathematics,LT-1,Dr. Verma,tutorial
Mon,10:00,11:40,Data Structures Lab,Lab-2,Dr. Sharma,lab
```

`day` is `Mon`/`Tue`/`Wed`/`Thu`/`Fri` (case-insensitive, full names like `Monday` also accepted); `start_time`/`end_time` are 24-hour `HH:MM`; `room`, `instructor`, and `type` are all optional. `type` is one of `lecture`/`tutorial`/`lab` (case-insensitive) — it's what the grid colors by (every lecture is one color, every tutorial another, every lab a third, regardless of subject), and a blank value or a file with no `type` column at all defaults every row to `lecture`. `server/app/timetable_parser.py` validates every row — weekend days, times outside college hours, times overlapping the lunch break, an unrecognized `type` value, and overlapping classes on the same day are all rejected, with every problem reported at once (by line number) rather than one at a time. A successful upload (`POST /api/timetable/upload`) replaces the user's entire timetable with what's in the file — a re-upload is meant to supersede the last one, not append to it.

**Visibility differs by role.** A student's timetable is private — visible only to that student via `GET /api/timetable/me`. A professor's timetable is public to anyone signed in: `GET /api/timetable/teacher/{teacher_id}` lets any student or teacher view it, and `Profile.jsx` (a professor's public profile page) renders it read-only below the hero section using the same grid component (`src/components/TimetableGrid.jsx`, factored out of `Timetable.jsx` so the two views can't visually drift apart). There is deliberately no equivalent "view another student's timetable" endpoint.

### Profile photo
Either role can add (or replace) a headshot from their own profile page (`StudentProfile.jsx`, `/profile`, which serves as "my profile" for both students and teachers): a small camera badge on the avatar opens a file picker restricted to `.png`/`.jpg`/`.jpeg`; `POST /api/profile/photo` (`server/app/routers/profile_photo.py`) uploads it to a Supabase Storage bucket called `avatars`, always at the same path for that user (`{role}/{owner_id}`) so a re-upload ("Change Photo") overwrites the old file in place rather than leaving it behind, and saves the resulting public URL to that user's `avatar_url` column. A `?v=<timestamp>` cache-buster is appended to the stored URL so a replaced photo shows up immediately rather than serving a stale cached copy of the old one. A user with no uploaded photo still sees a generated placeholder avatar (`src/lib/profile.js`) — `avatar_url` being `null` is the normal "hasn't uploaded one yet" state, not an error.

Clicking any profile photo — your own on `StudentProfile.jsx`, or a professor's on their public `Profile.jsx` page — enlarges it full-screen (`src/components/ImageLightbox.jsx`, a shared component so both pages behave identically); click the backdrop, the close button, or press Escape to dismiss it.

**Setup:** this needs both a Storage bucket and two new columns — see the "profile photo" block at the bottom of `db/schema.sql` (bucket creation, `file_size_limit`, `allowed_mime_types`, and the `avatar_url` columns), or run directly:

```sql
alter table public.student add column if not exists avatar_url text;
alter table public.teacher add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

The bucket is `public = true`, meaning uploaded photos are served over a plain HTTPS URL with no auth needed to *view* — uploads still require a valid JWT (enforced in `profile_photo.py`), since the backend talks to Storage with the service-role key, which bypasses bucket policies entirely regardless of the `public` flag.

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
| GET | `/api/timetable/me` | any | My own timetable |
| POST | `/api/timetable/upload` | any | Upload a CSV, replacing my entire timetable |
| DELETE | `/api/timetable/me` | any | Clear my timetable |
| GET | `/api/timetable/teacher/{teacher_id}` | any | Read-only view of a professor's timetable (any signed-in student or teacher) |
| POST | `/api/profile/photo` | any | Upload/replace my profile photo (.png/.jpg/.jpeg) |

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

- **`store.py` (the legacy Raspberry Pi door-unit demo) is still in-memory** — by design, it mirrors live device state rather than persisted data. See "Legacy: Raspberry Pi door-unit bridge" above; nothing in the real UI reads from it.
- **`message`, `notification` tables and the `teacher.available`/`teacher.available_updated_at` columns need a one-time manual migration** on any Supabase project that already had the original tables — see the "Data model" section above and the corresponding blocks at the bottom of `db/schema.sql`.
- **`src/pages/Explore.jsx` is dead code** — superseded by the Explore section inside `Home.jsx`, left in place but unrouted.
- **No automated tests cover the frontend (`src/`) or the Socket.IO layer (`sockets.py`)** — see `server/README.md`'s "Testing" section for what the backend suite (`server/tests/`) covers today (auth, messaging/conversations, appointments, notifications, availability persistence) and how to run it.
- Very new Python versions (3.14+) have been observed to hit `[SSL: UNEXPECTED_EOF_WHILE_READING]` errors connecting to Supabase due to an OpenSSL 3.x/httpx compatibility gap — upgrading `supabase`/`httpx`/`httpcore`, or running the backend on Python 3.11/3.12, resolves it.
