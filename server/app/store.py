# In-memory availability store, seeded with the same professor IDs used by
# the frontend (src/pages/Explore.jsx / Profile.jsx). Swap this module out
# for a real database (e.g. Supabase/Postgres, which is already a frontend
# dependency) once you need persistence across restarts / multiple workers.
from datetime import datetime, timezone
from typing import Optional

VALID_STATUSES = ["available", "busy", "away"]

PROFESSORS = [
    {"id": "aris-thorne", "name": "Dr. Aris Thorne", "department": "Department of Neural Engineering"},
    {"id": "elena-vance", "name": "Dr. Elena Vance", "department": "Theoretical Physics & Data Science"},
    {"id": "julian-kross", "name": "Prof. Julian Kross", "department": "Ethics & Autonomous Systems"},
    {"id": "marcus-wei", "name": "Dr. Marcus Wei", "department": "Cyber-Physical Security"},
    {"id": "sarah-jenkins", "name": "Dr. Sarah Jenkins", "department": "Genomic Computing"},
    {"id": "arthur-dent", "name": "Prof. Arthur Dent", "department": "Astronomy & Computational Logic"},
]

HISTORY_LIMIT = 25

_meta = {p["id"]: p for p in PROFESSORS}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_statuses: dict[str, dict] = {
    p["id"]: {"status": "away", "note": None, "source": "seed", "deviceId": None, "updatedAt": _now()}
    for p in PROFESSORS
}
_history: dict[str, list[dict]] = {p["id"]: [] for p in PROFESSORS}


def list_professors() -> list[dict]:
    return [{**_meta[pid], **rec} for pid, rec in _statuses.items()]


def professor_exists(professor_id: str) -> bool:
    return professor_id in _statuses


def get_status(professor_id: str) -> Optional[dict]:
    if professor_id not in _statuses:
        return None
    return {"id": professor_id, **_meta[professor_id], **_statuses[professor_id]}


def set_status(
    professor_id: str,
    *,
    status: str,
    note: Optional[str],
    source: str,
    device_id: Optional[str],
) -> Optional[dict]:
    if professor_id not in _statuses:
        return None

    record = {
        "status": status,
        "note": note,
        "source": source,  # 'pi-device' | 'web-app'
        "deviceId": device_id,
        "updatedAt": _now(),
    }
    _statuses[professor_id] = record

    hist = _history[professor_id]
    hist.insert(0, record)
    del hist[HISTORY_LIMIT:]

    return {"id": professor_id, **_meta[professor_id], **record}


def get_history(professor_id: str) -> Optional[list[dict]]:
    if professor_id not in _statuses:
        return None
    return _history[professor_id]
