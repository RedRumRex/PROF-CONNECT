from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import supabase, SUPABASE_ERROR

router = APIRouter(tags=["teachers"])


class TeacherPublic(BaseModel):
    teacher_id: int
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    room_number: Optional[str] = None
    h_index: Optional[int] = None


# GET /api/teachers
# Public directory of every teacher on file — backs the professor grid
# merged into the Home page. No auth required; only non-sensitive columns
# are selected (no email, no *_auth table).
@router.get("", response_model=list[TeacherPublic])
def list_teachers():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )

    rows = (
        supabase.table("teacher")
        .select("teacher_id,name,department,designation,room_number,h_index")
        .order("name")
        .execute()
        .data
    )
    return rows


# GET /api/teachers/{teacher_id}
# Single teacher lookup — backs the "Full Profile" / booking pages reached
# from the Explore grid. Public, same non-sensitive column set as the list.
@router.get("/{teacher_id}", response_model=TeacherPublic)
def get_teacher(teacher_id: int):
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )

    rows = (
        supabase.table("teacher")
        .select("teacher_id,name,department,designation,room_number,h_index")
        .eq("teacher_id", teacher_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    return rows[0]
