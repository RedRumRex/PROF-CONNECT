"""Unit tests for app/auth_utils.py — password hashing, JWT issue/verify,
and password-strength validation. Runs against the real module (no
Supabase/network involved), so these exercise actual production code."""
import time

import jwt
import pytest
from fastapi import HTTPException

from app.auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    require_claims,
    validate_password_strength,
)


# ── Password hashing ──────────────────────────────────────────────────────

def test_hash_password_roundtrip():
    hashed = hash_password("Str0ngPass!")
    assert hashed != "Str0ngPass!"
    assert verify_password("Str0ngPass!", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("Str0ngPass!")
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_handles_garbage_hash_without_raising():
    # A malformed/corrupt hash (e.g. a row from a different auth scheme)
    # must fail closed, not raise and 500 the login endpoint.
    assert verify_password("anything", "not-a-real-bcrypt-hash") is False


# ── Password strength ──────────────────────────────────────────────────────

@pytest.mark.parametrize("password", [
    "short1A",       # too short
    "alllowercase1", # no uppercase
    "ALLUPPERCASE1", # no lowercase
    "NoDigitsHere",  # no digit
    "",              # empty
])
def test_weak_passwords_rejected(password):
    assert validate_password_strength(password) is not None


def test_strong_password_accepted():
    assert validate_password_strength("GoodPass1") is None


# ── JWT issue / verify ──────────────────────────────────────────────────────

def test_create_and_decode_access_token_roundtrip():
    token = create_access_token(subject="101", role="student")
    claims = decode_access_token(token)
    assert claims["sub"] == "101"
    assert claims["role"] == "student"


def test_decode_access_token_rejects_tampered_token():
    token = create_access_token(subject="101", role="student")
    # Flip a character in the middle of the payload segment rather than the
    # very last character of the signature: base64's 6-bits-per-character
    # packing means some substitutions of the last char or two can decode
    # to the same bytes (32-byte HMAC digest doesn't divide evenly into
    # 3-byte base64 groups), so tampering the very end is not guaranteed to
    # actually change anything.
    mid = len(token) // 2
    tampered = token[:mid] + ("A" if token[mid] != "A" else "B") + token[mid + 1:]
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tampered)


def test_decode_access_token_rejects_expired_token(monkeypatch):
    # JWT_EXPIRE_MINUTES is read once at import time in config.py, so rather
    # than reconfigure it, encode an already-expired token directly with the
    # same secret/algorithm create_access_token uses.
    from app import auth_utils
    import datetime

    now = datetime.datetime.now(datetime.timezone.utc)
    expired_payload = {
        "sub": "101",
        "role": "student",
        "iat": now - datetime.timedelta(minutes=10),
        "exp": now - datetime.timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, auth_utils.JWT_SECRET, algorithm=auth_utils.JWT_ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


# ── require_claims (Authorization header parsing) ───────────────────────────

def test_require_claims_missing_header_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        require_claims(None)
    assert exc_info.value.status_code == 401


def test_require_claims_malformed_header_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        require_claims("NotBearer sometoken")
    assert exc_info.value.status_code == 401


def test_require_claims_valid_bearer_token_returns_claims():
    token = create_access_token(subject="7", role="teacher")
    claims = require_claims(f"Bearer {token}")
    assert claims["sub"] == "7"
    assert claims["role"] == "teacher"


def test_require_claims_expired_token_raises_401_not_500():
    from app import auth_utils
    import datetime

    now = datetime.datetime.now(datetime.timezone.utc)
    expired_payload = {
        "sub": "7",
        "role": "teacher",
        "iat": now - datetime.timedelta(minutes=10),
        "exp": now - datetime.timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, auth_utils.JWT_SECRET, algorithm=auth_utils.JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        require_claims(f"Bearer {expired_token}")
    assert exc_info.value.status_code == 401
