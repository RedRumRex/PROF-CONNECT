"""Shared test infrastructure.

The routers under test do `from ..db import supabase` and
`from ..notifications import notify` at import time. `app/db.py` actively
connects to Supabase on import (see its module-level `supabase, SUPABASE_ERROR
= _connect()`), so importing a router module unmodified would make a real
network call using whatever's in server/.env — slow, network-dependent, and
liable to touch a real project's data.

Instead, every test that needs a router injects a fake `app.db` (and, unless
it's specifically testing notification delivery, a fake `app.notifications`)
into `sys.modules` *before* importing the router, via the `fake_db` fixture
below. Python's import system finds `app.db` already present in
`sys.modules` and never executes the real file. This is the same
sys.modules-substitution pattern already used for ad hoc verification on
this project (see CONTEXT.md's "Environment quirks" section) — formalized
here as a fixture so it's reusable across test files.

`app.auth_utils` and `app.config` are real (imported unmodified) since
they're pure — no network, no Supabase — so JWT/password tests exercise the
actual production code.
"""
import sys
import types
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1]  # .../server
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """Minimal stand-in for a supabase-py table query builder — just enough
    of select/eq/in_/order/update/insert/execute for the real router code to
    run against unmodified."""

    def __init__(self, table_rows, table_name, error=None):
        self._all = table_rows
        self._table = table_name
        self._error = error
        self._filters = []
        self._order_col = None
        self._order_desc = False
        self._in_col = None
        self._in_vals = None
        self._update_payload = None
        self._insert_result = None
        self._delete = False

    def select(self, cols="*"):
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def in_(self, col, vals):
        self._in_col, self._in_vals = col, list(vals)
        return self

    def order(self, col, desc=False):
        self._order_col, self._order_desc = col, desc
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def delete(self):
        self._delete = True
        return self

    def insert(self, rows):
        if self._error:
            raise RuntimeError(self._error)
        # Real supabase-py's insert() accepts either a single row (dict) or
        # a bulk list of rows — routers use both, so this mirrors that.
        is_bulk = isinstance(rows, list)
        row_list = rows if is_bulk else [rows]
        pk = {"message": "message_id", "notification": "notification_id", "appointment": "appointment_id", "timetable_entry": "entry_id"}.get(self._table, "id")
        inserted = []
        for row in row_list:
            row = dict(row)
            row.setdefault(pk, len(self._all) + 1)
            row.setdefault("created_at", "2026-01-01T00:00:00+00:00")
            self._all.append(row)
            inserted.append(row)
        self._insert_result = inserted
        return self

    def _matches(self, row):
        for col, val in self._filters:
            if row.get(col) != val:
                return False
        if self._in_col is not None and row.get(self._in_col) not in self._in_vals:
            return False
        return True

    def execute(self):
        if self._error:
            raise RuntimeError(self._error)
        if self._insert_result is not None:
            return FakeResult(self._insert_result)
        matched = [r for r in self._all if self._matches(r)]
        if self._delete:
            for r in matched:
                self._all.remove(r)
            return FakeResult(matched)
        if self._update_payload is not None:
            for r in matched:
                r.update(self._update_payload)
            return FakeResult(matched)
        if self._order_col:
            matched = sorted(matched, key=lambda r: r.get(self._order_col) or "", reverse=self._order_desc)
        return FakeResult(matched)


class FakeStorageBucket:
    """Minimal stand-in for a supabase-py Storage bucket handle — just
    enough of upload()/get_public_url() for profile_photo.py to run against
    unmodified. `_files` is a plain {path: (bytes, content_type)} dict on
    the parent FakeStorage, shared by reference so a test can inspect what
    actually got "uploaded"."""

    def __init__(self, files: dict, name: str, error: str | None = None):
        self._files = files
        self._name = name
        self._error = error

    def upload(self, path: str, data: bytes, options: dict | None = None):
        if self._error:
            raise RuntimeError(self._error)
        content_type = (options or {}).get("content-type")
        self._files[path] = (data, content_type)
        return {"path": path}

    def get_public_url(self, path: str) -> str:
        # Real Supabase Storage would serve this over HTTPS from the
        # project's own domain — the exact host never matters to the
        # router code, which only appends a cache-busting query string.
        return f"https://fake.supabase.co/storage/v1/object/public/{self._name}/{path}"


class FakeStorage:
    """In-memory stand-in for `supabase-py`'s `.storage` — enough of
    `.from_(bucket)` for profile_photo.py's upload flow. `.raise_on(bucket,
    msg)` mirrors FakeSupabase.raise_on, for exercising the "bucket not
    found" error-translation path."""

    def __init__(self):
        self.buckets: dict[str, dict[str, tuple]] = {}
        self._errors: dict[str, str] = {}

    def raise_on(self, bucket_name: str, message: str) -> None:
        self._errors[bucket_name] = message

    def from_(self, name: str) -> FakeStorageBucket:
        self.buckets.setdefault(name, {})
        return FakeStorageBucket(self.buckets[name], name, error=self._errors.get(name))


class FakeSupabase:
    """In-memory stand-in for the supabase-py client. `.tables` is a plain
    {table_name: [row, ...]} dict, shared by reference with the test, so
    assertions can seed/inspect it directly. `.raise_on(table, msg)` makes
    the *next and all further* queries against that table raise, to exercise
    the routers' `_run_query` error-translation paths. `.storage` is a
    FakeStorage instance for routers (profile_photo.py) that upload files
    rather than only reading/writing table rows."""

    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self._errors: dict[str, str] = {}
        self.storage = FakeStorage()

    def raise_on(self, table_name: str, message: str) -> None:
        self._errors[table_name] = message

    def table(self, name):
        self.tables.setdefault(name, [])
        return FakeQuery(self.tables[name], name, error=self._errors.get(name))


@pytest.fixture
def fake_db(monkeypatch):
    """Use for testing a router's own logic. Fakes both app.db and
    app.notifications (so a test doesn't need a real event loop / socketio
    server just to send a message or book an appointment) and forces any
    already-imported app.routers.* module to be re-imported fresh, since
    `from ..db import supabase` binds the name at import time — a router
    imported before this fixture ran would still be holding the *previous*
    test's fake (or the real, network-touching one)."""
    db = FakeSupabase()

    fake_db_module = types.ModuleType("app.db")
    fake_db_module.supabase = db
    fake_db_module.SUPABASE_ERROR = None

    fake_notifications_module = types.ModuleType("app.notifications")

    async def fake_notify(**kwargs):
        row = {
            "recipient_role": kwargs["recipient_role"],
            "recipient_id": kwargs["recipient_id"],
            "type": kwargs["type"],
            "title": kwargs["title"],
            "body": kwargs.get("body"),
            "link": kwargs.get("link"),
            "read": False,
        }
        return db.table("notification").insert(row).execute().data[0]

    fake_notifications_module.notify = fake_notify

    monkeypatch.setitem(sys.modules, "app.db", fake_db_module)
    monkeypatch.setitem(sys.modules, "app.notifications", fake_notifications_module)

    # Force a fresh import of every other app.* module on each use of this
    # fixture (auth_utils/config included — they're cheap to re-import).
    # Without this, a module imported by an *earlier* test that did
    # `from ..db import supabase` (binding the name at import time, not a
    # live reference to app.db) would keep pointing at that earlier test's
    # fake_db instance forever, since Python caches modules in sys.modules
    # by name — e.g. app.availability_store, imported once, would silently
    # keep serving stale data to every later test.
    for mod_name in list(sys.modules):
        if mod_name == "app" or mod_name.startswith("app."):
            if mod_name not in ("app.db", "app.notifications"):
                monkeypatch.delitem(sys.modules, mod_name, raising=False)

    return db


@pytest.fixture
def make_token():
    """Returns a function that issues a real JWT for a given (role, subject)
    using the actual app.auth_utils.create_access_token — so tests exercise
    real token creation/verification, not a stand-in."""
    from app.auth_utils import create_access_token

    def _make(role: str, subject) -> str:
        return create_access_token(subject=str(subject), role=role)

    return _make


def bearer(token: str) -> str:
    return f"Bearer {token}"
