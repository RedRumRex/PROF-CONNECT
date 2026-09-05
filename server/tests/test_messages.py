"""Tests for server/app/routers/messages.py: the per-(student,teacher)
thread, and the derived conversations list / unread tracking added to power
the real Messages.jsx page (see CONTEXT.md's outstanding items)."""
import asyncio
import importlib

import pytest
from fastapi import HTTPException

from conftest import bearer


def load_messages_router():
    return importlib.import_module("app.routers.messages")


def test_thread_participant_can_read(fake_db, make_token):
    messages = load_messages_router()
    fake_db.tables["message"] = [
        {"message_id": 1, "student_id": 101, "teacher_id": 1, "sender_role": "student", "body": "hi", "created_at": "2026-01-01T10:00:00+00:00"},
    ]
    token = make_token("student", 101)
    rows = messages.get_thread(student_id=101, teacher_id=1, authorization=bearer(token))
    assert len(rows) == 1
    assert rows[0]["body"] == "hi"


def test_thread_rejects_non_participant(fake_db, make_token):
    messages = load_messages_router()
    fake_db.tables["message"] = []
    # A different student (202) trying to read 101's thread with teacher 1.
    token = make_token("student", 202)
    with pytest.raises(HTTPException) as exc_info:
        messages.get_thread(student_id=101, teacher_id=1, authorization=bearer(token))
    assert exc_info.value.status_code == 403


def test_send_message_empty_body_rejected(fake_db, make_token):
    messages = load_messages_router()
    token = make_token("student", 101)
    payload = messages.MessageCreate(student_id=101, teacher_id=1, body="   ")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(messages.send_message(payload, authorization=bearer(token)))
    assert exc_info.value.status_code == 400


def _seed_directory(fake_db):
    fake_db.tables["teacher"] = [
        {"teacher_id": 1, "name": "Prof. Rao", "department": "CSE", "designation": "Professor"},
    ]
    fake_db.tables["student"] = [
        {"rollno": 101, "name": "Aman", "branch": "COE", "year": 3},
    ]


def test_conversations_derived_from_messages_not_appointments(fake_db, make_token):
    """A conversation can exist without ever becoming a booking — the
    booking page lets a student message a professor before requesting a
    session — so /conversations must be driven by the message table, not
    the appointment table (which stays empty in this test)."""
    messages = load_messages_router()
    _seed_directory(fake_db)
    student_token = make_token("student", 101)
    teacher_token = make_token("teacher", 1)

    payload = messages.MessageCreate(student_id=101, teacher_id=1, body="Hello professor!")
    asyncio.run(messages.send_message(payload, authorization=bearer(student_token)))

    convos = messages.list_conversations(authorization=bearer(student_token))
    assert len(convos) == 1
    assert convos[0]["id"] == 1
    assert convos[0]["name"] == "Prof. Rao"
    assert convos[0]["department"] == "CSE"
    assert convos[0]["last_message"]["body"] == "Hello professor!"

    convos_t = messages.list_conversations(authorization=bearer(teacher_token))
    assert len(convos_t) == 1
    assert convos_t[0]["id"] == 101
    assert convos_t[0]["department"] == "COE"
    assert convos_t[0]["designation"] == "Year 3"


def test_unread_count_and_mark_read(fake_db, make_token):
    messages = load_messages_router()
    _seed_directory(fake_db)
    student_token = make_token("student", 101)
    teacher_token = make_token("teacher", 1)

    # Teacher sends two messages to the student — student should see 2 unread.
    for body in ["First", "Second"]:
        payload = messages.MessageCreate(student_id=101, teacher_id=1, body=body)
        asyncio.run(messages.send_message(payload, authorization=bearer(teacher_token)))

    convos = messages.list_conversations(authorization=bearer(student_token))
    assert convos[0]["unread"] == 2
    assert convos[0]["last_message"]["body"] == "Second"

    messages.mark_conversation_read(1, authorization=bearer(student_token))
    convos = messages.list_conversations(authorization=bearer(student_token))
    assert convos[0]["unread"] == 0

    # The teacher's own copy of the thread is unaffected by the student
    # marking their side read.
    convos_t = messages.list_conversations(authorization=bearer(teacher_token))
    assert convos_t[0]["unread"] == 0  # teacher sent these, nothing to read


def test_conversations_isolated_per_user(fake_db, make_token):
    """An unrelated teacher must never see another teacher's conversations."""
    messages = load_messages_router()
    _seed_directory(fake_db)
    fake_db.tables["teacher"].append({"teacher_id": 2, "name": "Prof. Iyer", "department": "ECE", "designation": "Professor"})

    student_token = make_token("student", 101)
    payload = messages.MessageCreate(student_id=101, teacher_id=1, body="Hi")
    asyncio.run(messages.send_message(payload, authorization=bearer(student_token)))

    other_teacher_token = make_token("teacher", 2)
    assert messages.list_conversations(authorization=bearer(other_teacher_token)) == []


def test_missing_message_table_returns_clean_503(fake_db, make_token):
    """An unhandled exception here would bypass Starlette's CORS middleware
    and show up in the browser as an opaque 'Load failed' — messages.py's
    _run_query exists specifically to translate this into a real error."""
    messages = load_messages_router()
    fake_db.raise_on("message", 'relation "message" does not exist')
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        messages.get_thread(student_id=101, teacher_id=1, authorization=bearer(token))
    assert exc_info.value.status_code == 503
    assert "schema.sql" in exc_info.value.detail
