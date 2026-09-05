"""Tests for server/app/availability_store.py — now backed by
teacher.available / teacher.available_updated_at instead of an in-memory
dict (see db/schema.sql's "teacher availability persistence" block), so a
professor's status survives a backend restart."""
import importlib

import pytest
from fastapi import HTTPException

from conftest import bearer


def load_store():
    return importlib.import_module("app.availability_store")


def _seed_teachers(fake_db):
    fake_db.tables["teacher"] = [
        {"teacher_id": 1, "name": "Prof. Rao", "available": False, "available_updated_at": None},
        {"teacher_id": 2, "name": "Prof. Iyer", "available": True, "available_updated_at": "2026-01-01T09:00:00+00:00"},
    ]


def test_get_status_defaults_to_away_for_unknown_teacher(fake_db):
    store = load_store()
    fake_db.tables["teacher"] = []
    assert store.get_status(999) == {"status": "away", "note": None, "updatedAt": None}


def test_get_status_reflects_persisted_column(fake_db):
    store = load_store()
    _seed_teachers(fake_db)
    assert store.get_status(2)["status"] == "available"
    assert store.get_status(2)["updatedAt"] == "2026-01-01T09:00:00+00:00"
    assert store.get_status(1)["status"] == "away"


def test_list_statuses_includes_every_teacher_even_untoggled(fake_db):
    """Unlike the old in-memory dict (which only had an entry once a
    professor toggled at least once), a fresh DB row already defaults
    `available` to false — so every teacher shows up as "away" rather than
    being silently absent from the map."""
    store = load_store()
    _seed_teachers(fake_db)
    statuses = store.list_statuses()
    assert statuses[1]["status"] == "away"
    assert statuses[2]["status"] == "available"


def test_set_status_persists_and_survives_reimport(fake_db):
    """The whole point of this change: toggling availability must be
    visible from a *fresh* read of the store, not just an in-process cache —
    simulated here by re-importing the module against the same fake table."""
    store = load_store()
    _seed_teachers(fake_db)

    record = store.set_status(1, available=True)
    assert record["status"] == "available"
    assert record["updatedAt"] is not None

    # Re-import (a fresh module instance, like a restarted process would
    # see) reading from the same underlying table.
    import sys
    del sys.modules["app.availability_store"]
    store_after_restart = importlib.import_module("app.availability_store")
    assert store_after_restart.get_status(1)["status"] == "available"


def test_set_status_unknown_teacher_404s(fake_db):
    store = load_store()
    fake_db.tables["teacher"] = []
    with pytest.raises(HTTPException) as exc_info:
        store.set_status(999, available=True)
    assert exc_info.value.status_code == 404


def test_availability_router_only_teacher_can_set_own_status(fake_db, make_token):
    availability = importlib.import_module("app.routers.availability")
    _seed_teachers(fake_db)

    student_token = make_token("student", 101)
    payload = availability.AvailabilityUpdate(available=True)
    with pytest.raises(HTTPException) as exc_info:
        import asyncio
        asyncio.run(availability.set_my_availability(payload, authorization=bearer(student_token)))
    assert exc_info.value.status_code == 403
