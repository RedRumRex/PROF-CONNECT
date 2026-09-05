# "Add/Change Profile Photo" — either role can upload a headshot, which
# replaces any previous one (same storage path every time, so there's never
# an orphaned old file sitting in the bucket). See README.md's "Profile
# photo" section for the exact Supabase Storage bucket + column setup this
# depends on.
import time
from typing import Optional

from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from ..db import supabase, SUPABASE_ERROR
from ..auth_utils import require_claims

router = APIRouter(tags=["profile-photo"])

BUCKET = "avatars"

# Keyed by the exact Content-Type the browser sends — deliberately narrow
# (just the two formats asked for) rather than accepting any "image/*".
ALLOWED_CONTENT_TYPES = ("image/png", "image/jpeg")

# Mirrors the `file_size_limit` set on the bucket itself (see README.md) —
# checked here too so a too-large upload gets a clear message instead of
# whatever raw error Supabase Storage happens to return.
MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _require_db():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail=SUPABASE_ERROR or "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY on the server.",
        )


def _identity(authorization: Optional[str]):
    claims = require_claims(authorization)
    role = claims.get("role")
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=403, detail="Unknown role.")
    return role, int(claims["sub"])


def _table_and_key(role: str):
    return ("student", "rollno") if role == "student" else ("teacher", "teacher_id")


def _public_url(path: str) -> str:
    result = supabase.storage.from_(BUCKET).get_public_url(path)
    # supabase-py has returned either a bare string or a {"publicUrl": ...}
    # dict across versions — handle both rather than pinning to one.
    if isinstance(result, dict):
        result = result.get("publicUrl") or result.get("public_url") or ""
    return result


# POST /api/profile/photo — upload (or replace) the signed-in user's profile
# photo. Always written to the same storage path for this user, so a
# re-upload ("Change Photo") overwrites in place instead of leaving the old
# file behind. A `?v=<timestamp>` cache-buster is appended to the stored URL
# so a replaced photo shows up immediately instead of serving a cached copy
# of the old one.
@router.post("/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    _require_db()
    role, owner_id = _identity(authorization)

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a .png or .jpg/.jpeg image.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image is too large — please keep it under {MAX_PHOTO_BYTES // (1024 * 1024)}MB.",
        )

    path = f"{role}/{owner_id}"

    try:
        supabase.storage.from_(BUCKET).upload(
            path, raw, {"content-type": content_type, "upsert": "true"},
        )
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "bucket not found" in msg.lower():
            raise HTTPException(
                status_code=503,
                detail=(
                    "The 'avatars' storage bucket hasn't been created in Supabase yet. "
                    "Run the storage bucket SQL from README.md's 'Profile photo' section "
                    "in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Could not upload photo: {msg}")

    avatar_url = f"{_public_url(path)}?v={int(time.time())}"

    table, key = _table_and_key(role)
    try:
        supabase.table(table).update({"avatar_url": avatar_url}).eq(key, owner_id).execute()
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "does not exist" in msg and "avatar_url" in msg:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"The 'avatar_url' column hasn't been added to '{table}' yet. "
                    "Run the profile-photo `alter table` statements from README.md's "
                    "'Profile photo' section in the Supabase SQL editor, then try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Photo was uploaded but could not be saved to your profile: {msg}")

    return {"avatar_url": avatar_url}
