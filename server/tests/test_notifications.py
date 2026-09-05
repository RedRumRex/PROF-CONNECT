"""Tests the real app/notifications.py — specifically the "best-effort"
guarantee documented in CONTEXT.md's conventions: a notification failing to
write or broadcast must never raise, since it's always called after the
primary action (booking, responding, messaging) has already succeeded.

Unlike test_messages.py / test_appointments.py, this deliberately does NOT
use the `fake_db` fixture's fake app.notifications — it fakes only app.db
and app.sockets so the *real* notifications.py logic runs."""
import sys
import types
import importlib

import pytest


@pytest.fixture
def notifications_module(monkeypatch):
    """Like the `fake_db` fixture in conftest.py, but leaves app.notifications
    alone so the real module gets imported and tested."""
    from conftest import FakeSupabase

    db = FakeSupabase()
    fake_db_module = types.ModuleType("app.db")
    fake_db_module.supabase = db
    fake_db_module.SUPABASE_ERROR = None
    monkeypatch.setitem(sys.modules, "app.db", fake_db_module)

    broadcast_calls = []

    fake_sockets_module = types.ModuleType("app.sockets")

    async def fake_broadcast_notification(role, recipient_id, record):
        broadcast_calls.append((role, recipient_id, record))

    fake_sockets_module.broadcast_notification = fake_broadcast_notification
    monkeypatch.setitem(sys.modules, "app.sockets", fake_sockets_module)

    monkeypatch.delitem(sys.modules, "app.notifications", raising=False)
    notifications = importlib.import_module("app.notifications")
    return notifications, db, broadcast_calls


def test_notify_inserts_and_broadcasts(notifications_module):
    import asyncio

    notifications, db, broadcast_calls = notifications_module
    record = asyncio.run(notifications.notify(
        recipient_role="student",
        recipient_id=101,
        type="message",
        title="New message from Prof. Rao",
        body="Hello!",
        link="/appointment/1",
    ))
    assert record is not None
    assert record["recipient_id"] == 101
    assert db.tables["notification"][0]["title"] == "New message from Prof. Rao"
    assert len(broadcast_calls) == 1
    assert broadcast_calls[0][0] == "student"


def test_notify_swallows_insert_failure(notifications_module):
    """If the `notification` table doesn't exist yet (a fresh Supabase
    project that hasn't run the migration), notify() must return None
    quietly rather than raising and breaking the booking/message it's
    attached to."""
    import asyncio

    notifications, db, broadcast_calls = notifications_module
    db.raise_on("notification", 'relation "notification" does not exist')

    record = asyncio.run(notifications.notify(
        recipient_role="teacher",
        recipient_id=1,
        type="appointment_request",
        title="New appointment request",
    ))
    assert record is None
    assert broadcast_calls == []  # never got far enough to broadcast


def test_notify_swallows_broadcast_failure(notifications_module):
    """The row can be written successfully even if the live Socket.IO push
    fails — notify() should still return the record rather than raising."""
    import asyncio

    notifications, db, broadcast_calls = notifications_module

    async def failing_broadcast(role, recipient_id, record):
        raise RuntimeError("socket boom")

    sys.modules["app.sockets"].broadcast_notification = failing_broadcast

    record = asyncio.run(notifications.notify(
        recipient_role="student",
        recipient_id=101,
        type="message",
        title="Hi",
    ))
    assert record is not None
    assert db.tables["notification"][0]["recipient_id"] == 101
