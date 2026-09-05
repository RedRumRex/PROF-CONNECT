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
