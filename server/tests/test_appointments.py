"""Tests for server/app/routers/appointments.py: status-label mapping and
the ownership check that stops a teacher from responding to another
teacher's appointment requests (JWT claims, not the request body, are the
source of truth for identity — see CONTEXT.md's conventions section)."""
import asyncio
import importlib

import pytest
from fastapi import HTTPException

from conftest import bearer


def load_appointments_router():
    return importlib.import_module("app.routers.appointments")


def test_status_label_mapping(fake_db):
    appointments = load_appointments_router()
    assert appointments._status_label(None) == "pending"
    assert appointments._status_label(True) == "accepted"
    assert appointments._status_label(False) == "declined"


def test_only_students_can_create_appointments(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    teacher_token = make_token("teacher", 1)
    payload = appointments.AppointmentCreate(teacher_id=1, appointment_date="2026-09-10", appointment_time="10:00:00")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(appointments.create_appointment(payload, authorization=bearer(teacher_token)))
    assert exc_info.value.status_code == 403


def test_create_appointment_starts_pending(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    student_token = make_token("student", 101)
    payload = appointments.AppointmentCreate(teacher_id=1, appointment_date="2026-09-10", appointment_time="10:00:00")
    result = asyncio.run(appointments.create_appointment(payload, authorization=bearer(student_token)))
    assert result["status_label"] == "pending"
    assert result["student_id"] == 101
    assert result["teacher_id"] == 1


def test_teacher_cannot_respond_to_another_teachers_request(fake_db, make_token):
    """The core ownership rule: identity comes from the JWT, and an
    appointment can only be responded to by the teacher_id it's addressed
    to — never whichever teacher happens to call the endpoint."""
    appointments = load_appointments_router()
    fake_db.tables["appointment"] = [
        {"appointment_id": 1, "student_id": 101, "teacher_id": 1, "appointment_date": "2026-09-10", "appointment_time": "10:00:00", "status": None},
    ]
    other_teacher_token = make_token("teacher", 2)  # not teacher_id 1
    respond = appointments.AppointmentRespond(status=True)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(appointments.respond_to_appointment(1, respond, authorization=bearer(other_teacher_token)))
    assert exc_info.value.status_code == 403


def test_owning_teacher_can_accept_request(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["appointment"] = [
        {"appointment_id": 1, "student_id": 101, "teacher_id": 1, "appointment_date": "2026-09-10", "appointment_time": "10:00:00", "status": None},
    ]
    fake_db.tables["teacher"] = [{"teacher_id": 1, "name": "Prof. Rao"}]
    owning_teacher_token = make_token("teacher", 1)
    respond = appointments.AppointmentRespond(status=True)
    result = asyncio.run(appointments.respond_to_appointment(1, respond, authorization=bearer(owning_teacher_token)))
    assert result["status_label"] == "accepted"

    # Best-effort notification: even though it's faked here, the important
    # invariant is that a notification failure never reaches the caller —
    # covered directly (with a *raising* fake) in test_notifications.py.


def test_respond_to_nonexistent_appointment_404s(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["appointment"] = []
    token = make_token("teacher", 1)
    respond = appointments.AppointmentRespond(status=True)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(appointments.respond_to_appointment(999, respond, authorization=bearer(token)))
    assert exc_info.value.status_code == 404


# ── Multiple bookings with one professor ────────────────────────────────

def _book(appointments, token, *, teacher_id=1, date="2026-09-10", time="10:00:00"):
    payload = appointments.AppointmentCreate(teacher_id=teacher_id, appointment_date=date, appointment_time=time)
    return asyncio.run(appointments.create_appointment(payload, authorization=bearer(token)))


def test_student_can_book_multiple_different_slots_with_same_teacher(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    token = make_token("student", 101)

    first = _book(appointments, token, date="2026-09-10", time="10:00:00")
    second = _book(appointments, token, date="2026-09-10", time="14:00:00")  # same day, other slot
    third = _book(appointments, token, date="2026-09-11", time="10:00:00")  # same slot, other day
    assert len({first["appointment_id"], second["appointment_id"], third["appointment_id"]}) == 3


def test_same_exact_slot_is_rejected_while_pending(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    token = make_token("student", 101)

    _book(appointments, token)
    with pytest.raises(HTTPException) as exc_info:
        _book(appointments, token)
    assert exc_info.value.status_code == 409


def test_same_exact_slot_is_rejected_once_accepted(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    token = make_token("student", 101)

    booked = _book(appointments, token)
    respond = appointments.AppointmentRespond(status=True)
    asyncio.run(appointments.respond_to_appointment(
        booked["appointment_id"], respond, authorization=bearer(make_token("teacher", 1)),
    ))
    with pytest.raises(HTTPException) as exc_info:
        _book(appointments, token)
    assert exc_info.value.status_code == 409


def test_declined_slot_can_be_requested_again(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    token = make_token("student", 101)

    booked = _book(appointments, token)
    respond = appointments.AppointmentRespond(status=False)
    asyncio.run(appointments.respond_to_appointment(
        booked["appointment_id"], respond, authorization=bearer(make_token("teacher", 1)),
    ))
    again = _book(appointments, token)
    assert again["status_label"] == "pending"


def test_same_slot_with_a_different_teacher_is_fine(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}, {"teacher_id": 2}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    token = make_token("student", 101)

    _book(appointments, token, teacher_id=1)
    other = _book(appointments, token, teacher_id=2)
    assert other["teacher_id"] == 2


# ── Delete ───────────────────────────────────────────────────────────────

def _seed_appt(fake_db):
    fake_db.tables["appointment"] = [
        {"appointment_id": 1, "student_id": 101, "teacher_id": 1, "appointment_date": "2026-09-10", "appointment_time": "10:00:00", "status": None},
        {"appointment_id": 2, "student_id": 102, "teacher_id": 2, "appointment_date": "2026-09-10", "appointment_time": "10:00:00", "status": True},
    ]


def test_student_can_delete_own_appointment(fake_db, make_token):
    appointments = load_appointments_router()
    _seed_appt(fake_db)
    out = appointments.delete_appointment(1, authorization=bearer(make_token("student", 101)))
    assert out == {"ok": True}
    assert [r["appointment_id"] for r in fake_db.tables["appointment"]] == [2]


def test_teacher_can_delete_request_addressed_to_them(fake_db, make_token):
    appointments = load_appointments_router()
    _seed_appt(fake_db)
    appointments.delete_appointment(2, authorization=bearer(make_token("teacher", 2)))
    assert [r["appointment_id"] for r in fake_db.tables["appointment"]] == [1]


def test_cannot_delete_someone_elses_appointment(fake_db, make_token):
    appointments = load_appointments_router()
    _seed_appt(fake_db)
    for role, sub in (("student", 102), ("teacher", 2)):
        with pytest.raises(HTTPException) as exc_info:
            appointments.delete_appointment(1, authorization=bearer(make_token(role, sub)))
        assert exc_info.value.status_code == 403
    assert len(fake_db.tables["appointment"]) == 2


def test_delete_missing_appointment_is_404(fake_db, make_token):
    appointments = load_appointments_router()
    _seed_appt(fake_db)
    with pytest.raises(HTTPException) as exc_info:
        appointments.delete_appointment(99, authorization=bearer(make_token("student", 101)))
    assert exc_info.value.status_code == 404


def test_deleting_frees_the_slot_for_rebooking(fake_db, make_token):
    appointments = load_appointments_router()
    fake_db.tables["teacher"] = [{"teacher_id": 1}]
    fake_db.tables["student"] = [{"rollno": 101, "name": "Aman"}]
    _seed_appt(fake_db)
    appointments.delete_appointment(1, authorization=bearer(make_token("student", 101)))
    payload = appointments.AppointmentCreate(teacher_id=1, appointment_date="2026-09-10", appointment_time="10:00:00")
    out = asyncio.run(appointments.create_appointment(payload, authorization=bearer(make_token("student", 101))))
    assert out["status_label"] == "pending"
