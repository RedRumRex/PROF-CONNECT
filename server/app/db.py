"""Supabase client for the student/teacher/*_auth tables.

Separate from the in-memory `store.py` (professor door-status), which stays
in-memory since it mirrors live Raspberry Pi state, not persisted data.

On startup this actively probes the connection (one cheap query) so we can
tell you, specifically, whether SUPABASE_URL or SUPABASE_SERVICE_KEY is the
one that's wrong — instead of a generic "not configured" message.
"""
import re

from supabase import create_client, Client

from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Human-readable reason auth is unavailable, or None if everything's fine.
# Every /api/auth/* 503 response includes this, so the error you see in the
# browser/Postman tells you exactly which of the two values to fix.
SUPABASE_ERROR: str | None = None


def _looks_like_supabase_url(url: str) -> bool:
    return bool(re.match(r"^https://[a-zA-Z0-9-]+\.supabase\.co/?$", url.strip()))


def _connection_error_reason(url: str, raw_error: str) -> str:
    lowered = raw_error.lower()

    # DNS / connection-level failures -> almost always a wrong/malformed URL.
    dns_markers = (
        "nodename nor servname", "name or service not known", "failed to resolve",
        "getaddrinfo failed", "temporary failure in name resolution",
        "connecterror", "connection refused", "econnrefused",
    )
    if any(m in lowered for m in dns_markers):
        return (
            f"Could not reach SUPABASE_URL ('{url}'). This points to the URL being "
            "wrong — copy the exact Project URL from Supabase: Project Settings -> "
            f"API -> Project URL. (raw error: {raw_error})"
        )

    # Auth-level rejections -> almost always a wrong/wrong-type key.
    key_markers = (
        "invalid api key", "no api key found", "unauthorized", "401",
        "jwt", "invalid jwt", "invalid_token", "invalid signature",
    )
    if any(m in lowered for m in key_markers):
        return (
            "SUPABASE_URL connected fine, but SUPABASE_SERVICE_KEY was rejected. "
            "Copy the service_role key (or the newer 'secret' key, sb_secret_...) "
            "from Project Settings -> API -> Project API keys — NOT the "
            f"anon/publishable key. (raw error: {raw_error})"
        )

    return f"Unexpected error connecting to Supabase: {raw_error}"


def _connect() -> tuple[Client | None, str | None]:
    if not SUPABASE_URL and not SUPABASE_SERVICE_KEY:
        return None, (
            "SUPABASE_URL and SUPABASE_SERVICE_KEY are both empty in server/.env. "
            "See server/.env.example."
        )
    if not SUPABASE_URL:
        return None, "SUPABASE_URL is empty in server/.env."
    if not SUPABASE_SERVICE_KEY:
        return None, "SUPABASE_SERVICE_KEY is empty in server/.env."

    if not _looks_like_supabase_url(SUPABASE_URL):
        return None, (
            f"SUPABASE_URL looks malformed: '{SUPABASE_URL}'. It should look like "
            "https://xxxxxxxx.supabase.co with no trailing path (Project Settings "
            "-> API -> Project URL)."
        )

    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:  # noqa: BLE001
        return None, f"Failed to construct Supabase client: {e}"

    # Exercise the connection + key with one cheap request so we can tell a
    # bad URL apart from a bad key, instead of only finding out on first use.
    try:
        client.table("student").select("rollno").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        raw = str(e)
        if "does not exist" in raw.lower() and "student" in raw.lower():
            # Connection + key are both fine — the `student` table just
            # hasn't been created yet (see db/schema.sql). Not a config
            # error, so let auth endpoints proceed normally.
            return client, None
        return None, _connection_error_reason(SUPABASE_URL, raw)

    return client, None


supabase, SUPABASE_ERROR = _connect()

if SUPABASE_ERROR:
    print(f"[db] {SUPABASE_ERROR}")
    print("[db] Every /api/auth/* endpoint will return 503 with this exact message until it's fixed.")
else:
    print("[db] Connected to Supabase successfully.")
