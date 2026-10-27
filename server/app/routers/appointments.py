from datetime import date as date_type, time as time_type
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims
from ..notifications import notify

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
async def create_appointment(payload: AppointmentCreate, authorization: Optional[str] = Header(default=None)):
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

    # A student can book as many sessions with a professor as they like, but
    # only one live (pending or accepted) request per exact date + time slot.
    # A declined request frees its slot up again.
    date_iso = payload.appointment_date.isoformat()
    time_iso = payload.appointment_time.isoformat()
    same_slot = (
        supabase.table("appointment")
        .select("appointment_id,appointment_time,status")
        .eq("student_id", student_id)
        .eq("teacher_id", payload.teacher_id)
        .eq("appointment_date", date_iso)
        .execute()
        .data
    )
    for existing in same_slot:
        # Supabase returns time as "HH:MM:SS"; compare on HH:MM:SS so
        # "11:00" and "11:00:00" count as the same slot.
        existing_time = str(existing.get("appointment_time") or "")
        if existing_time[:5] == time_iso[:5] and existing.get("status") is not False:
            raise HTTPException(
                status_code=409,
                detail="You already have a request for this professor at that date and time.",
            )

    row = {
        "student_id": student_id,
        "teacher_id": payload.teacher_id,
        "appointment_date": date_iso,
        "appointment_time": time_iso,
        "status": None,
    }
    inserted = supabase.table("appointment").insert(row).execute().data
    result = inserted[0] if inserted else row
    result["status_label"] = _status_label(result.get("status"))

    # Best-effort — a notification hiccup should never fail the booking.
    try:
        student_rows = supabase.table("student").select("name").eq("rollno", student_id).execute().data
        student_name = student_rows[0]["name"] if student_rows else "A student"
        await notify(
            recipient_role="teacher",
            recipient_id=payload.teacher_id,
            type="appointment_request",
            title="New appointment request",
            body=f"{student_name} requested a session on {payload.appointment_date} at {payload.appointment_time}.",
            link="/appointments",
        )
    except Exception:  # noqa: BLE001
        pass

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
async def respond_to_appointment(
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

    # Meetings are created on demand by the in-app meeting API (routers/
    # meetings.py) the first time either participant opens an accepted
    # appointment, so accepting only needs to record the decision.
    update_data: dict = {"status": payload.status}

    updated = (
        supabase.table("appointment")
        .update(update_data)
        .eq("appointment_id", appointment_id)
        .execute()
        .data
    )
    result = updated[0] if updated else {**rows[0], **update_data}
    result["status_label"] = _status_label(result.get("status"))

    # Best-effort — a notification hiccup should never fail the response.
    try:
        teacher_rows = supabase.table("teacher").select("name").eq("teacher_id", teacher_id).execute().data
        teacher_name = teacher_rows[0]["name"] if teacher_rows else "The professor"
        action = "accepted" if payload.status else "declined"
        if payload.status:
            notif_body = (
                f"{teacher_name} accepted your session on {result.get('appointment_date')} "
                f"at {result.get('appointment_time')}. Your meeting room is ready — go to Appointments to join."
            )
        else:
            notif_body = (
                f"{teacher_name} declined your request for {result.get('appointment_date')} "
                f"at {result.get('appointment_time')}."
            )
        await notify(
            recipient_role="student",
            recipient_id=result["student_id"],
            type=f"appointment_{action}",
            title=f"Appointment {action}",
            body=notif_body,
            link="/appointments",
        )
    except Exception:  # noqa: BLE001
        pass

    return result


# ── Delete ───────────────────────────────────────────────────────────────
# Removes an appointment entry outright. Either side of the booking can do
# it — the student who requested it or the teacher it was addressed to —
# and it disappears for both, which also frees the slot up again.

@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int, authorization: Optional[str] = Header(default=None)):
    _require_db()
    claims = require_claims(authorization)
    role = claims.get("role")
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=403, detail="Unknown role.")
    subject = int(claims["sub"])

    rows = supabase.table("appointment").select("*").eq("appointment_id", appointment_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    owner_col = "student_id" if role == "student" else "teacher_id"
    if rows[0][owner_col] != subject:
        raise HTTPException(status_code=403, detail="This appointment does not belong to you.")

    supabase.table("appointment").delete().eq("appointment_id", appointment_id).execute()
    return {"ok": True}
