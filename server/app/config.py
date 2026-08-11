import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent  # server/

PORT = int(os.getenv("PORT", "4000"))

CORS_ORIGIN = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGIN", "http://localhost:5173").split(",")
    if origin.strip()
]

ADMIN_KEY = os.getenv("ADMIN_KEY") or None

# ── Supabase (student/teacher/auth tables) ──────────────────────────────
# Service-role key only — this backend needs to write to student/teacher/
# *_auth tables directly, bypassing RLS. Never expose this key to the
# frontend; the frontend never talks to Supabase directly.
SUPABASE_URL = os.getenv("SUPABASE_URL") or None
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or None

# ── JWT auth ─────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24h


def _load_device_keys() -> dict:
    """Load per-professor device API keys. Falls back to devices.example.json
    in dev so the server boots out of the box; use a real devices.json
    (gitignored) in production with unique secrets per Raspberry Pi."""
    configured = os.getenv("DEVICE_KEYS_FILE")
    configured_path = (ROOT_DIR / configured) if configured else (ROOT_DIR / "devices.json")
    fallback_path = ROOT_DIR / "devices.example.json"
    target = configured_path if configured_path.exists() else fallback_path

    try:
        data = json.loads(target.read_text())
        if target == fallback_path:
            print(
                f"[config] devices.json not found — using {fallback_path.name} placeholder keys. "
                f"Copy it to devices.json and set real per-device secrets before deploying."
            )
        return data
    except Exception as e:  # noqa: BLE001
        print(f"[config] Could not load device keys from {target}: {e}")
        return {}


DEVICE_KEYS: dict = _load_device_keys()
