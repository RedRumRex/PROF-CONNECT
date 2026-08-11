#!/usr/bin/env python3
"""
ProfConnect door unit — Raspberry Pi reference client.

This is the piece of software that runs on the Raspberry Pi mounted on a
professor's door. It does two jobs:

  1. PUSH  — when the physical control on the door unit changes (a 3-way
     switch, three buttons, or a rotary knob wired to GPIO pins), it POSTs
     the new status to the cloud API so the website updates instantly.

  2. PULL  — it also polls the API every REFRESH_SECONDS so that if the
     professor changes their status remotely from the website (e.g. they're
     stuck in traffic and mark themselves "away" from their phone), the
     physical door display stays in sync.

Hardware I/O (GPIO button reads, e-ink/OLED rendering) is intentionally kept
behind two small functions — read_physical_switch() and render_display() —
so you can drop in whatever display/buttons your build uses without
touching the networking logic.

Setup on the Pi:
    pip install requests python-socketio[client]
    cp .env.example .env      # fill in DEVICE_ID / API_KEY / API_BASE_URL
    python3 status_client.py

Run as a systemd service so it starts on boot and restarts on crash/reboot.
"""

import json
import os
import time
import logging
from pathlib import Path

import requests

try:
    import RPi.GPIO as GPIO  # noqa: N814  (only present on real hardware)
    ON_PI = True
except ImportError:
    ON_PI = False

# ── Config ──────────────────────────────────────────────────────────────
def load_env(path=".env"):
    env = dict(os.environ)
    p = Path(path)
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env

ENV = load_env()

API_BASE_URL = ENV.get("API_BASE_URL", "http://localhost:4000")
DEVICE_ID = ENV.get("DEVICE_ID", "aris-thorne")       # must match a professor id in the store
API_KEY = ENV.get("API_KEY", "CHANGE-ME")              # this device's per-professor key
REFRESH_SECONDS = int(ENV.get("REFRESH_SECONDS", "20"))
REQUEST_TIMEOUT = 5

STATUS_URL = f"{API_BASE_URL}/api/professors/{DEVICE_ID}/status"
HEADERS = {"x-api-key": API_KEY, "x-device-id": f"pi-{DEVICE_ID}", "Content-Type": "application/json"}

VALID_STATUSES = ("available", "busy", "away")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("profconnect-door-unit")

# ── Hardware stubs — replace with real GPIO / display code ───────────────
BUTTON_PINS = {"available": 17, "busy": 27, "away": 22}  # BCM numbering, example wiring

def setup_hardware():
    if not ON_PI:
        log.warning("RPi.GPIO not available — running in simulation mode (keyboard input).")
        return
    GPIO.setmode(GPIO.BCM)
    for pin in BUTTON_PINS.values():
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

def read_physical_switch():
    """Return the status the physical control is currently set to, or None
    if unchanged. Replace this with real GPIO edge-detection logic."""
    if not ON_PI:
        return None  # simulation mode below drives changes manually
    for status, pin in BUTTON_PINS.items():
        if GPIO.input(pin) == GPIO.LOW:  # pressed (active low w/ pull-up)
            return status
    return None

def render_display(status: str, note: str | None = None):
    """Update the door-mounted display (e-ink / OLED / LED ring / etc.)."""
    log.info(f"[DISPLAY] Now showing: {status.upper()}{f' — {note}' if note else ''}")

# ── Networking ─────────────────────────────────────────────────────────
def push_status(status: str, note: str | None = None) -> bool:
    if status not in VALID_STATUSES:
        log.error(f"Refusing to push invalid status: {status}")
        return False
    try:
        resp = requests.post(
            STATUS_URL,
            headers=HEADERS,
            data=json.dumps({"status": status, "note": note}),
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            log.info(f"Pushed status → {status}")
            return True
        log.error(f"Push failed ({resp.status_code}): {resp.text}")
        return False
    except requests.RequestException as e:
        log.error(f"Push error: {e}")
        return False

def pull_status():
    try:
        resp = requests.get(STATUS_URL, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            return resp.json()
        log.error(f"Pull failed ({resp.status_code}): {resp.text}")
    except requests.RequestException as e:
        log.error(f"Pull error: {e}")
    return None

# ── Main loop ─────────────────────────────────────────────────────────
def main():
    setup_hardware()
    last_known_status = None
    last_pull = 0.0

    log.info(f"ProfConnect door unit starting — device_id={DEVICE_ID}, api={API_BASE_URL}")

    while True:
        # 1) Physical control changed → push immediately.
        new_status = read_physical_switch()
        if new_status and new_status != last_known_status:
            if push_status(new_status):
                last_known_status = new_status
                render_display(new_status)

        # 2) Periodically pull, in case status changed remotely (web app).
        now = time.time()
        if now - last_pull >= REFRESH_SECONDS:
            last_pull = now
            record = pull_status()
            if record and record.get("status") != last_known_status:
                last_known_status = record["status"]
                render_display(record["status"], record.get("note"))

        time.sleep(0.5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    finally:
        if ON_PI:
            GPIO.cleanup()
