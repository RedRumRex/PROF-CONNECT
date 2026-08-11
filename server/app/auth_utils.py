"""Password hashing, JWT issuance, and password-strength validation shared
by the auth router."""
import re
import datetime

import bcrypt
import jwt

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
