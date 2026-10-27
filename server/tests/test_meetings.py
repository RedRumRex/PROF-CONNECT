import copy
import pytest
from fastapi import HTTPException

from app.routers import meetings


class Result:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table):
        self.db = db
        self.table_name = table
        self.operation = "select"
        self.filters = {}
        self.payload = None
        self.limit_count = None

    def select(self, _columns):
        self.operation = "select"
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = copy.deepcopy(payload)
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = copy.deepcopy(payload)
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self.operation == "insert":
            row = copy.deepcopy(self.payload)
            rows.append(row)
            return Result([copy.deepcopy(row)])
        matching = [row for row in rows if all(row.get(k) == v for k, v in self.filters.items())]
        if self.operation == "update":
            for row in matching:
                row.update(self.payload)
            return Result(copy.deepcopy(matching))
        if self.limit_count is not None:
            matching = matching[:self.limit_count]
        return Result(copy.deepcopy(matching))


class FakeSupabase:
    def __init__(self):
        self.tables = {
            "appointment": [{
                "appointment_id": 7, "student_id": 1001, "teacher_id": 501,
                "status": True,
            }],
            "student": [{"rollno": 1001, "name": "Student Example"}],
            "teacher": [{"teacher_id": 501, "name": "Professor Example"}],
            "meeting": [],
        }

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeSupabase()
    monkeypatch.setattr(meetings, "supabase", db)
    monkeypatch.setattr(meetings, "SUPABASE_ERROR", None)
    monkeypatch.setattr(
        meetings, "require_claims",
        lambda authorization: {
            "sub": "501" if authorization == "Bearer teacher" else ("999" if authorization == "Bearer stranger" else "1001"),
            "role": "teacher" if authorization == "Bearer teacher" else ("student" if authorization in ("Bearer student", "Bearer stranger") else "student"),
        },
    )
    meetings.rooms.clear()
    meetings.tickets.clear()
    meetings.join_attempts.clear()
    return db


def test_only_accepted_appointment_members_can_create_meetings(fake_db):
    result = meetings.create_or_get_appointment_meeting(7, "Bearer student")
    assert result["appointment_id"] == 7
    assert result["status"] == "available"

    with pytest.raises(HTTPException) as exc:
        meetings.create_or_get_appointment_meeting(7, "Bearer stranger")
    assert exc.value.status_code == 403


def test_pending_appointment_cannot_create_meeting(fake_db):
    fake_db.tables["appointment"][0]["status"] = None
    with pytest.raises(HTTPException) as exc:
        meetings.create_or_get_appointment_meeting(7, "Bearer student")
    assert exc.value.status_code == 403


def test_invitation_token_is_hashed_and_revocable(fake_db, monkeypatch):
    meeting = meetings.create_or_get_appointment_meeting(7, "Bearer student")
    invite = meetings.create_invite(meeting["meeting_id"], meetings.InviteRequest(), "Bearer teacher")
    assert invite["invite_enabled"] is True
    assert invite["invite_token"]
    row = fake_db.tables["meeting"][0]
    assert row["invite_token_hash"] != invite["invite_token"]
    assert meetings._hash(invite["invite_token"]) == row["invite_token_hash"]

    meetings.revoke_invite(row["meeting_id"], "Bearer teacher")
    assert fake_db.tables["meeting"][0]["invite_enabled"] is False
    assert fake_db.tables["meeting"][0]["invite_token_hash"] is None


def test_invitation_passcode_hash_round_trip():
    saved = meetings._passcode_hash("correct horse battery")
    assert saved != "correct horse battery"
    assert meetings._passcode_matches("correct horse battery", saved)
    assert not meetings._passcode_matches("wrong", saved)


def test_appointment_membership_is_role_scoped():
    appointment = {"student_id": 1001, "teacher_id": 501}
    assert meetings._is_appointment_member({"sub": "1001", "role": "student"}, appointment)
    assert meetings._is_appointment_member({"sub": "501", "role": "teacher"}, appointment)
    assert not meetings._is_appointment_member({"sub": "999", "role": "student"}, appointment)
    assert not meetings._is_appointment_member({"sub": "1001", "role": "teacher"}, appointment)



def test_invitation_link_can_issue_a_short_lived_join_ticket(fake_db):
    meeting = meetings.create_or_get_appointment_meeting(7, "Bearer student")
    invite = meetings.create_invite(meeting["meeting_id"], meetings.InviteRequest(), "Bearer teacher")
    joined = meetings.join_meeting(
        meeting["meeting_id"],
        meetings.JoinRequest(name="Guest", invite_token=invite["invite_token"]),
        None,
        None,
    )
    assert joined["token"]
    assert joined["host"] is False
    assert meetings._hash(joined["token"]) in meetings.tickets


def test_invalid_invitation_cannot_join(fake_db):
    meeting = meetings.create_or_get_appointment_meeting(7, "Bearer student")
    meetings.create_invite(meeting["meeting_id"], meetings.InviteRequest(), "Bearer teacher")
    with pytest.raises(HTTPException) as exc:
        meetings.join_meeting(
            meeting["meeting_id"],
            meetings.JoinRequest(name="Guest", invite_token="not-the-token"),
            None,
            None,
        )
    assert exc.value.status_code == 403


# ── ICE servers: no third-party STUN/TURN ────────────────────────────────

def _no_ice_config(monkeypatch):
    for name in ("STUN_URLS", "TURN_URLS"):
        monkeypatch.setattr(meetings, name, [])
    for name in ("TURN_SECRET", "TURN_USERNAME", "TURN_PASSWORD"):
        monkeypatch.setattr(meetings, name, "")


def test_no_ice_servers_by_default_and_never_google(monkeypatch):
    _no_ice_config(monkeypatch)
    assert meetings._ice_servers("peer") == []
    assert "google" not in repr(meetings._ice_servers("peer")).lower()


def test_self_hosted_stun_and_timed_turn_credentials(monkeypatch):
    _no_ice_config(monkeypatch)
    monkeypatch.setattr(meetings, "STUN_URLS", ["stun:turn.example.com:3478"])
    monkeypatch.setattr(meetings, "TURN_URLS", ["turn:turn.example.com:3478?transport=udp"])
    monkeypatch.setattr(meetings, "TURN_SECRET", "s3cret")
    servers = meetings._ice_servers("peer-1")
    assert servers[0] == {"urls": ["stun:turn.example.com:3478"]}
    turn = servers[1]
    assert turn["urls"] == ["turn:turn.example.com:3478?transport=udp"]
    assert turn["username"].endswith(":peer-1")
    assert turn["credential"] and turn["credential"] != "s3cret"


def test_fixed_turn_credentials_mode(monkeypatch):
    _no_ice_config(monkeypatch)
    monkeypatch.setattr(meetings, "TURN_URLS", ["turn:relay.example.com:3478"])
    monkeypatch.setattr(meetings, "TURN_USERNAME", "u")
    monkeypatch.setattr(meetings, "TURN_PASSWORD", "p")
    assert meetings._ice_servers("x") == [
        {"urls": ["turn:relay.example.com:3478"], "username": "u", "credential": "p"}
    ]


# ── Restarting an ended meeting ──────────────────────────────────────────

def test_host_can_restart_an_ended_meeting_but_students_cannot(fake_db):
    created = meetings.create_or_get_appointment_meeting(7, "Bearer student")
    fake_db.tables["meeting"][0].update(
        status="ended", ended_at="2026-01-01T00:00:00Z",
        invite_enabled=True, invite_token_hash="h", passcode_hash="x:y",
    )

    with pytest.raises(HTTPException) as exc:
        meetings.create_or_get_appointment_meeting(7, "Bearer student")
    assert exc.value.status_code == 410
    assert fake_db.tables["meeting"][0]["status"] == "ended"

    again = meetings.create_or_get_appointment_meeting(7, "Bearer teacher")
    assert again["meeting_id"] == created["meeting_id"]
    assert again["status"] == "available"
    assert again["invite_enabled"] is False
    row = fake_db.tables["meeting"][0]
    assert row["status"] == "available" and row["ended_at"] is None
    assert row["invite_token_hash"] is None and row["passcode_hash"] == ""

    # Once restarted, the student can get back in.
    assert meetings.create_or_get_appointment_meeting(7, "Bearer student")["status"] == "available"
