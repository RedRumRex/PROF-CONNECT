"""Tests for server/app/routers/timetable.py: upload-replaces-everything
semantics, per-user isolation (a student's timetable never leaks into a
teacher's, or another user's), and that a bad CSV surfaces as a clean list
of validation issues rather than a generic 500."""
import asyncio
import importlib

import pytest
from fastapi import HTTPException

from conftest import bearer

VALID_CSV = (
    b"day,start_time,end_time,subject,room,instructor\n"
    b"Mon,08:00,08:50,Data Structures,LT-1,Dr. Sharma\n"
    b"Tue,09:00,09:50,Digital Electronics,LT-2,Dr. Iyer\n"
)

VALID_CSV_WITH_TYPES = (
    b"day,start_time,end_time,subject,room,instructor,type\n"
    b"Mon,08:00,08:50,Data Structures,LT-1,Dr. Sharma,lecture\n"
    b"Mon,09:00,09:50,Engineering Math,LT-1,Dr. Verma,tutorial\n"
    b"Mon,10:00,11:40,Data Structures Lab,Lab-2,Dr. Sharma,lab\n"
)


class FakeUploadFile:
    """Stands in for FastAPI's UploadFile — the router only ever calls
    `.filename` and `await .read()` on it, so a real UploadFile (which needs
    a live request) isn't necessary to exercise the router directly."""

    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


def load_timetable_router():
    return importlib.import_module("app.routers.timetable")


def test_upload_then_fetch_roundtrip(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)
    file = FakeUploadFile("mine.csv", VALID_CSV)

    saved = asyncio.run(timetable.upload_timetable(file=file, authorization=bearer(token)))
    assert len(saved) == 2
    assert {e["subject"] for e in saved} == {"Data Structures", "Digital Electronics"}
    # No "type" column in the CSV — every entry defaults to "lecture".
    assert all(e["type"] == "lecture" for e in saved)

    fetched = timetable.get_my_timetable(authorization=bearer(token))
    assert len(fetched) == 2


def test_upload_with_type_column_preserves_each_type(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)
    file = FakeUploadFile("mine.csv", VALID_CSV_WITH_TYPES)

    saved = asyncio.run(timetable.upload_timetable(file=file, authorization=bearer(token)))
    by_subject = {e["subject"]: e["type"] for e in saved}
    assert by_subject == {
        "Data Structures": "lecture",
        "Engineering Math": "tutorial",
        "Data Structures Lab": "lab",
    }

    fetched = timetable.get_my_timetable(authorization=bearer(token))
    assert {e["subject"]: e["type"] for e in fetched} == by_subject


def test_reupload_replaces_not_appends(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("v1.csv", VALID_CSV), authorization=bearer(token)))
    second_csv = b"day,start_time,end_time,subject,room,instructor\nWed,10:00,10:50,Only This One,,\n"
    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("v2.csv", second_csv), authorization=bearer(token)))

    fetched = timetable.get_my_timetable(authorization=bearer(token))
    assert len(fetched) == 1
    assert fetched[0]["subject"] == "Only This One"


def test_invalid_csv_returns_422_with_issue_list(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)
    bad_csv = b"day,start_time,end_time,subject,room,instructor\nSat,08:00,08:50,Weekend Class,,\n"

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(timetable.upload_timetable(file=FakeUploadFile("bad.csv", bad_csv), authorization=bearer(token)))
    assert exc_info.value.status_code == 422
    assert isinstance(exc_info.value.detail, list)
    assert len(exc_info.value.detail) == 1


def test_non_csv_extension_rejected(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(timetable.upload_timetable(file=FakeUploadFile("timetable.xlsx", VALID_CSV), authorization=bearer(token)))
    assert exc_info.value.status_code == 400


def test_students_and_teachers_have_isolated_timetables(fake_db, make_token):
    timetable = load_timetable_router()
    student_token = make_token("student", 101)
    teacher_token = make_token("teacher", 101)  # same numeric id, different role

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("s.csv", VALID_CSV), authorization=bearer(student_token)))

    assert len(timetable.get_my_timetable(authorization=bearer(student_token))) == 2
    assert timetable.get_my_timetable(authorization=bearer(teacher_token)) == []


def test_different_users_have_isolated_timetables(fake_db, make_token):
    timetable = load_timetable_router()
    student_a = make_token("student", 101)
    student_b = make_token("student", 202)

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("a.csv", VALID_CSV), authorization=bearer(student_a)))

    assert len(timetable.get_my_timetable(authorization=bearer(student_a))) == 2
    assert timetable.get_my_timetable(authorization=bearer(student_b)) == []


def test_clear_removes_all_entries(fake_db, make_token):
    timetable = load_timetable_router()
    token = make_token("student", 101)
    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("s.csv", VALID_CSV), authorization=bearer(token)))
    assert len(timetable.get_my_timetable(authorization=bearer(token))) == 2

    timetable.clear_my_timetable(authorization=bearer(token))
    assert timetable.get_my_timetable(authorization=bearer(token)) == []


def test_teacher_timetable_visible_to_a_student(fake_db, make_token):
    timetable = load_timetable_router()
    teacher_token = make_token("teacher", 55)
    student_token = make_token("student", 101)

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("t.csv", VALID_CSV), authorization=bearer(teacher_token)))

    seen = timetable.get_teacher_timetable(55, authorization=bearer(student_token))
    assert len(seen) == 2
    assert {e["subject"] for e in seen} == {"Data Structures", "Digital Electronics"}


def test_teacher_timetable_visible_to_another_teacher(fake_db, make_token):
    timetable = load_timetable_router()
    teacher_token = make_token("teacher", 55)
    other_teacher_token = make_token("teacher", 77)

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("t.csv", VALID_CSV), authorization=bearer(teacher_token)))

    seen = timetable.get_teacher_timetable(55, authorization=bearer(other_teacher_token))
    assert len(seen) == 2


def test_teacher_timetable_empty_when_none_uploaded(fake_db, make_token):
    timetable = load_timetable_router()
    student_token = make_token("student", 101)
    assert timetable.get_teacher_timetable(999, authorization=bearer(student_token)) == []


def test_teacher_timetable_endpoint_never_returns_a_students_entries(fake_db, make_token):
    """A student and a teacher can share the same numeric id — the endpoint
    must filter by owner_role='teacher' too, not just owner_id, or a
    student's private timetable could leak through the public teacher-view
    route."""
    timetable = load_timetable_router()
    student_token = make_token("student", 101)  # same numeric id as below
    other_student_token = make_token("student", 202)

    asyncio.run(timetable.upload_timetable(file=FakeUploadFile("s.csv", VALID_CSV), authorization=bearer(student_token)))

    seen = timetable.get_teacher_timetable(101, authorization=bearer(other_student_token))
    assert seen == []


def test_missing_timetable_table_returns_clean_503(fake_db, make_token):
    timetable = load_timetable_router()
    fake_db.raise_on("timetable_entry", 'relation "timetable_entry" does not exist')
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        timetable.get_my_timetable(authorization=bearer(token))
    assert exc_info.value.status_code == 503
    assert "schema.sql" in exc_info.value.detail
