from datetime import date as date_type, time as time_type
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims

router = APIRouter(tags=["appointments"])


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _status_label(status) -> str:
    # status is a nullable boolean column: NULL = pending, true = accepted,
    # false = declined by the teacher.
    if status is True:
        return "accepted"
    if status is False:
        return "declined"
    return "pending"


class AppointmentCreate(BaseModel):
    teacher_id: int
    appointment_date: date_type
    appointment_time: time_type


class AppointmentRespond(BaseModel):
    status: bool  # true = accept, false = decline


# ── Create (student) ────────────────────────────────────────────────────
# The student's session-request flow (Appointment.jsx) posts here instead
# of faking a "Booked!" state locally — the teacher needs to see and act
# on this before it's a real booking.

@router.post("", status_code=201)
def create_appointment(payload: AppointmentCreate, authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    if claims.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can request appointments.")
    student_id = int(claims["sub"])

    teacher_rows = (
        supabase.table("teacher").select("teacher_id").eq("teacher_id", payload.teacher_id).execute().data
    )
    if not teacher_rows:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    row = {
        "student_id": student_id,
        "teacher_id": payload.teacher_id,
        "appointment_date": payload.appointment_date.isoformat(),
        "appointment_time": payload.appointment_time.isoformat(),
        "status": None,
    }
    inserted = supabase.table("appointment").insert(row).execute().data
    result = inserted[0] if inserted else row
    result["status_label"] = _status_label(result.get("status"))
    return result


# ── List: student's own requests ────────────────────────────────────────
# Lets the student page reflect the real status (pending/accepted/declined)
# of a request they already sent, instead of only ever showing "Booked!".

@router.get("/student")
def list_my_requests(authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    if claims.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can view their own appointment requests.")
    student_id = int(claims["sub"])

    rows = (
        supabase.table("appointment")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    teacher_ids = sorted({r["teacher_id"] for r in rows})
    teachers_by_id = {}
    if teacher_ids:
        t_rows = (
            supabase.table("teacher")
            .select("teacher_id,name,department,designation")
            .in_("teacher_id", teacher_ids)
            .execute()
            .data
        )
        teachers_by_id = {t["teacher_id"]: t for t in t_rows}

    out = []
    for r in rows:
        t = teachers_by_id.get(r["teacher_id"], {})
        out.append({
            **r,
            "status_label": _status_label(r.get("status")),
            "teacher_name": t.get("name"),
            "teacher_department": t.get("department"),
            "teacher_designation": t.get("designation"),
        })
    return out


# ── List: requests directed at a teacher ────────────────────────────────
# Backs the Dashboard "Appointment Requests" section.

@router.get("/teacher")
def list_requests_for_teacher(authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    if claims.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can view their appointment requests.")
    teacher_id = int(claims["sub"])

    rows = (
        supabase.table("appointment")
        .select("*")
        .eq("teacher_id", teacher_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    student_ids = sorted({r["student_id"] for r in rows})
    students_by_id = {}
    if student_ids:
        s_rows = (
            supabase.table("student")
            .select("rollno,name,branch,year")
            .in_("rollno", student_ids)
            .execute()
            .data
        )
        students_by_id = {s["rollno"]: s for s in s_rows}

    out = []
    for r in rows:
        s = students_by_id.get(r["student_id"], {})
        out.append({
            **r,
            "status_label": _status_label(r.get("status")),
            "student_name": s.get("name"),
            "student_branch": s.get("branch"),
            "student_year": s.get("year"),
        })
    return out


# ── Respond (teacher) ────────────────────────────────────────────────────

@router.patch("/{appointment_id}/respond")
def respond_to_appointment(
    appointment_id: int,
    payload: AppointmentRespond,
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    claims = require_claims(authorization)
    if claims.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can respond to appointment requests.")
    teacher_id = int(claims["sub"])

    rows = supabase.table("appointment").select("*").eq("appointment_id", appointment_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment request not found.")
    if rows[0]["teacher_id"] != teacher_id:
        raise HTTPException(status_code=403, detail="This appointment request does not belong to you.")

    updated = (
        supabase.table("appointment")
        .update({"status": payload.status})
        .eq("appointment_id", appointment_id)
        .execute()
        .data
    )
    result = updated[0] if updated else rows[0]
    result["status_label"] = _status_label(result.get("status"))
    return result
