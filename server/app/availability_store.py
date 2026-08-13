# In-memory "is this professor in their room right now" toggle, keyed by the
# real numeric teacher_id from the `teacher` table (Supabase). This is
# distinct from the legacy Raspberry-Pi-door-unit store in store.py — that
# one is keyed by fake seed slugs ("aris-thorne", etc.) left over from
# before the app had real DB-backed teachers, and nothing in the UI reads
# from it anymore. This module is what the teacher's own "Available in
# Room" toggle on the Dashboard actually writes to, and what every other
# signed-in user (via useLiveStatus) sees reflected on the Explore grid and
# each professor's Profile page.
#
# Swap this out for a real DB column (e.g. a `teacher.available` boolean)
# if you need the status to survive a server restart — same tradeoff as
# store.py.
from datetime import datetime, timezone
from typing import Optional

_statuses: dict[int, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_status(teacher_id: int) -> dict:
    return _statuses.get(teacher_id) or {"status": "away", "note": None, "updatedAt": None}


def list_statuses() -> dict[int, dict]:
    return dict(_statuses)


def set_status(teacher_id: int, *, available: bool, note: Optional[str] = None) -> dict:
    record = {
        "status": "available" if available else "away",
        "note": note,
        "updatedAt": _now(),
    }
    _statuses[teacher_id] = record
    return record
