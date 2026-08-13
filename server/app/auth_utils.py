"""Password hashing, JWT issuance, and password-strength validation shared
by the auth/appointments routers."""
import re
import datetime
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException

from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, AttributeError):
        return False


def create_access_token(subject: str, role: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError (ExpiredSignatureError, InvalidTokenError, ...)
    on failure — callers should catch and turn into a 401."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def require_claims(authorization: Optional[str]) -> dict:
    """Parses + validates the `Authorization: Bearer <token>` header. Raises
    401 on anything wrong (missing header, expired token, bad signature).
    Shared by every router that needs to know who's making the request
    (auth's /me, appointments' create/list/respond)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid session token. Please log in again.")


# Minimum 8 chars, at least one lowercase, one uppercase, one digit.
_PASSWORD_RULES = (
    (lambda p: len(p) >= 8, "Password must be at least 8 characters long."),
    (lambda p: re.search(r"[a-z]", p) is not None, "Password must include a lowercase letter."),
    (lambda p: re.search(r"[A-Z]", p) is not None, "Password must include an uppercase letter."),
    (lambda p: re.search(r"[0-9]", p) is not None, "Password must include a number."),
)


def validate_password_strength(password: str) -> str | None:
    """Returns an error message string if the password is too weak, else None."""
    if not password:
        return "Password is required."
    for check, message in _PASSWORD_RULES:
        if not check(password):
            return message
    return None
