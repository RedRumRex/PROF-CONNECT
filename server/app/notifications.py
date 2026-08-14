# Best-effort notification creation + live push. Called from
# routers/appointments.py (new request / accept / decline) and
# routers/messages.py (new message) right after the primary action already
# succeeded. Deliberately swallows every exception in here — a notification
# failure (e.g. the `notification` table not existing yet in a
# freshly-migrated Supabase project, same situation the `message` table was
# in) must never break booking a session, responding to a request, or
# sending a message.
from typing import Optional

from .db import supabase
from .sockets import broadcast_notification


def _insert(row: dict) -> Optional[dict]:
    if supabase is None:
        return None
    try:
        inserted = supabase.table("notification").insert(row).execute().data
        return inserted[0] if inserted else row
    except Exception:  # noqa: BLE001
        return None


async def notify(
    *,
    recipient_role: str,
    recipient_id: int,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> Optional[dict]:
    row = {
        "recipient_role": recipient_role,
        "recipient_id": recipient_id,
        "type": type,
        "title": title,
        "body": body,
        "link": link,
        "read": False,
    }
    record = _insert(row)
    if record is None:
        return None
    try:
        await broadcast_notification(recipient_role, recipient_id, record)
    except Exception:  # noqa: BLE001
        pass
    return record
