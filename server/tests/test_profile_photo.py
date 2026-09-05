"""Tests for server/app/routers/profile_photo.py: content-type/size
validation, that a re-upload replaces the previous photo at the same
storage path instead of leaving orphaned files, that the resulting URL gets
saved onto the right row for the right role, and that a missing bucket or
column surfaces as a clean error rather than a generic 500."""
import asyncio
import importlib

import pytest
from fastapi import HTTPException

from conftest import bearer

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fake-png-data"
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"fake-jpeg-data"


class FakeUploadFile:
    """Stands in for FastAPI's UploadFile — the router only ever calls
    `.filename`, `.content_type`, and `await .read()` on it."""

    def __init__(self, filename: str, content: bytes, content_type: str):
        self.filename = filename
        self.content_type = content_type
        self._content = content

    async def read(self) -> bytes:
        return self._content


def load_profile_photo_router():
    return importlib.import_module("app.routers.profile_photo")


def test_upload_png_succeeds_and_saves_to_student_row(fake_db, make_token):
    fake_db.table("student").insert({"rollno": 101, "name": "Alex"}).execute()
    photo = load_profile_photo_router()
    token = make_token("student", 101)

    result = asyncio.run(photo.upload_profile_photo(
        file=FakeUploadFile("me.png", PNG_BYTES, "image/png"),
        authorization=bearer(token),
    ))

    assert result["avatar_url"].startswith("https://fake.supabase.co/storage/v1/object/public/avatars/student/101")
    row = fake_db.tables["student"][0]
    assert row["avatar_url"] == result["avatar_url"]


def test_upload_jpeg_succeeds_and_saves_to_teacher_row(fake_db, make_token):
    fake_db.table("teacher").insert({"teacher_id": 55, "name": "Dr. Rao"}).execute()
    photo = load_profile_photo_router()
    token = make_token("teacher", 55)

    result = asyncio.run(photo.upload_profile_photo(
        file=FakeUploadFile("me.jpg", JPEG_BYTES, "image/jpeg"),
        authorization=bearer(token),
    ))

    assert "avatars/teacher/55" in result["avatar_url"]
    row = fake_db.tables["teacher"][0]
    assert row["avatar_url"] == result["avatar_url"]


def test_disallowed_content_type_rejected(fake_db, make_token):
    photo = load_profile_photo_router()
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(photo.upload_profile_photo(
            file=FakeUploadFile("me.gif", b"GIF89a", "image/gif"),
            authorization=bearer(token),
        ))
    assert exc_info.value.status_code == 400
    assert "png or .jpg" in exc_info.value.detail.lower()


def test_oversized_photo_rejected(fake_db, make_token):
    photo = load_profile_photo_router()
    token = make_token("student", 101)
    huge = b"x" * (photo.MAX_PHOTO_BYTES + 1)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(photo.upload_profile_photo(
            file=FakeUploadFile("me.png", huge, "image/png"),
            authorization=bearer(token),
        ))
    assert exc_info.value.status_code == 400
    assert "too large" in exc_info.value.detail.lower()


def test_empty_file_rejected(fake_db, make_token):
    photo = load_profile_photo_router()
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(photo.upload_profile_photo(
            file=FakeUploadFile("me.png", b"", "image/png"),
            authorization=bearer(token),
        ))
    assert exc_info.value.status_code == 400


def test_reupload_replaces_in_place_not_alongside(fake_db, make_token):
    """A student changing their photo should overwrite the same storage key
    — never accumulate a second file — and the profile row should end up
    pointing at the new content, not the old one."""
    fake_db.table("student").insert({"rollno": 101, "name": "Alex"}).execute()
    photo = load_profile_photo_router()
    token = make_token("student", 101)

    asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("v1.png", PNG_BYTES, "image/png"), authorization=bearer(token)))
    second = b"\x89PNG\r\n\x1a\n" + b"different-bytes"
    asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("v2.png", second, "image/png"), authorization=bearer(token)))

    bucket_files = fake_db.storage.buckets["avatars"]
    assert list(bucket_files.keys()) == ["student/101"]  # one key, not two
    assert bucket_files["student/101"][0] == second


def test_students_and_teachers_with_same_id_get_different_storage_paths(fake_db, make_token):
    fake_db.table("student").insert({"rollno": 101, "name": "Alex"}).execute()
    fake_db.table("teacher").insert({"teacher_id": 101, "name": "Dr. Rao"}).execute()
    photo = load_profile_photo_router()
    student_token = make_token("student", 101)
    teacher_token = make_token("teacher", 101)

    asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("s.png", PNG_BYTES, "image/png"), authorization=bearer(student_token)))
    asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("t.png", PNG_BYTES, "image/png"), authorization=bearer(teacher_token)))

    assert set(fake_db.storage.buckets["avatars"].keys()) == {"student/101", "teacher/101"}


def test_missing_bucket_returns_clean_503(fake_db, make_token):
    fake_db.storage.raise_on("avatars", "Bucket not found")
    photo = load_profile_photo_router()
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("me.png", PNG_BYTES, "image/png"), authorization=bearer(token)))
    assert exc_info.value.status_code == 503
    assert "avatars" in exc_info.value.detail


def test_missing_avatar_url_column_returns_clean_503(fake_db, make_token):
    fake_db.raise_on("student", 'column "avatar_url" of relation "student" does not exist')
    photo = load_profile_photo_router()
    token = make_token("student", 101)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(photo.upload_profile_photo(file=FakeUploadFile("me.png", PNG_BYTES, "image/png"), authorization=bearer(token)))
    assert exc_info.value.status_code == 503
    assert "avatar_url" in exc_info.value.detail
