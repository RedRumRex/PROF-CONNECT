# Parses and validates the CSV a student or teacher uploads for their
# personal weekly timetable (see "Uploading a timetable" in README.md for
# the exact column spec this enforces). Pure functions, no Supabase/network
# — kept separate from routers/timetable.py so it's trivially unit-testable
# and so the college-hours/lunch-break rules live in exactly one place.
#
# Deliberately collects *every* row's errors before raising, rather than
# stopping at the first one — a student fixing their CSV one round-trip at
# a time over a slow connection is a worse experience than seeing every
# problem at once.
import csv
import io
from datetime import datetime, time

VALID_DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri")

# College hours — see README.md's "Timetable" section for where these are
# also duplicated on the frontend (Timetable.jsx) for the grid layout.
COLLEGE_START = time(8, 0)
COLLEGE_END = time(17, 10)
LUNCH_START = time(13, 0)
LUNCH_END = time(13, 50)

REQUIRED_COLUMNS = ["day", "start_time", "end_time", "subject", "room", "instructor"]
# The "type" column is optional for backwards compatibility with timetables
# uploaded before it existed — a file without it is treated as all lectures.
COLUMNS_WITH_TYPE = REQUIRED_COLUMNS + ["type"]

# The three kinds of class the grid color-codes by (see TimetableGrid.jsx) —
# color is keyed off this, never off the subject, so "Data Structures" and
# "Data Structures Lab" render as two different colors regardless of name.
VALID_TYPES = ("lecture", "tutorial", "lab")
DEFAULT_TYPE = "lecture"

MAX_FILE_BYTES = 200_000  # a class list has no business being bigger than this


class TimetableParseError(Exception):
    """Raised with `errors`: a list of human-readable, line-numbered
    problem descriptions — never just one, so the caller can show the
    student everything wrong with their file in one pass."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def _fmt(t: time) -> str:
    return t.strftime("%H:%M")


def _parse_time(raw: str, field: str, line_no: int, errors: list[str]) -> time | None:
    raw = (raw or "").strip()
    try:
        return datetime.strptime(raw, "%H:%M").time()
    except ValueError:
        errors.append(f"Line {line_no}: {field} '{raw}' is not a valid 24-hour HH:MM time (e.g. 09:00, 14:30).")
        return None


def _normalize_day(raw: str) -> str:
    """Accepts 'Mon', 'mon', 'MON', 'Monday', 'monday', etc. Returns the
    3-letter canonical form, or '' if it doesn't map to a valid day."""
    raw = (raw or "").strip()
    if not raw:
        return ""
    candidate = raw[:1].upper() + raw[1:3].lower()
    return candidate if candidate in VALID_DAYS else ""


def parse_timetable_csv(raw_bytes: bytes) -> list[dict]:
    """Returns a list of {day, start_time, end_time, subject, room,
    instructor, type} dicts (start_time/end_time as `time` objects), sorted
    implicitly by file order. Raises TimetableParseError on any problem —
    a bad row, a missing/wrong header, an empty file, or a file with no
    valid rows at all."""
    if len(raw_bytes) > MAX_FILE_BYTES:
        raise TimetableParseError([
            f"File is too large ({len(raw_bytes) // 1000}KB) — a class list should be well under "
            f"{MAX_FILE_BYTES // 1000}KB. Make sure it's a plain CSV, not something else saved with a .csv name."
        ])

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise TimetableParseError(["Could not read the file as UTF-8 text. Save it as a plain .csv file (not .xlsx) and try again."])

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise TimetableParseError(["The file is empty."])

    header = [h.strip() for h in reader.fieldnames]
    has_type_column = header == COLUMNS_WITH_TYPE
    if header != REQUIRED_COLUMNS and not has_type_column:
        raise TimetableParseError([
            "The header row must be exactly: " + ",".join(REQUIRED_COLUMNS) +
            " — optionally with a trailing 'type' column (lecture/tutorial/lab): " +
            ",".join(COLUMNS_WITH_TYPE) +
            f" (found: {','.join(header) or '(blank)'})"
        ])

    errors: list[str] = []
    rows_by_day: dict[str, list[dict]] = {d: [] for d in VALID_DAYS}
    parsed: list[dict] = []

    for line_no, raw_row in enumerate(reader, start=2):  # header is line 1
        if all(not (v or "").strip() for v in raw_row.values()):
            continue  # skip fully blank rows (trailing newline, etc.)

        day_raw = raw_row.get("day") or ""
        day = _normalize_day(day_raw)
        subject = (raw_row.get("subject") or "").strip()
        room = (raw_row.get("room") or "").strip() or None
        instructor = (raw_row.get("instructor") or "").strip() or None

        if not day:
            errors.append(f"Line {line_no}: day '{day_raw.strip()}' must be one of Mon/Tue/Wed/Thu/Fri (no weekend classes).")
            continue

        start = _parse_time(raw_row.get("start_time"), "start_time", line_no, errors)
        end = _parse_time(raw_row.get("end_time"), "end_time", line_no, errors)
        if start is None or end is None:
            continue

        if not subject:
            errors.append(f"Line {line_no}: subject is required.")
            continue

        type_raw = (raw_row.get("type") or "").strip() if has_type_column else ""
        class_type = type_raw.lower() or DEFAULT_TYPE
        if class_type not in VALID_TYPES:
            errors.append(f"Line {line_no}: type '{type_raw}' must be one of lecture/tutorial/lab (leave blank for lecture).")
            continue

        if start >= end:
            errors.append(f"Line {line_no}: start_time ({_fmt(start)}) must be before end_time ({_fmt(end)}).")
            continue

        if start < COLLEGE_START or end > COLLEGE_END:
            errors.append(
                f"Line {line_no}: {day} {_fmt(start)}–{_fmt(end)} falls outside college hours "
                f"({_fmt(COLLEGE_START)}–{_fmt(COLLEGE_END)})."
            )
            continue

        if start < LUNCH_END and end > LUNCH_START:
            errors.append(
                f"Line {line_no}: {day} {_fmt(start)}–{_fmt(end)} overlaps the lunch break "
                f"({_fmt(LUNCH_START)}–{_fmt(LUNCH_END)}) — no classes run then."
            )
            continue

        overlap = next(
            (e for e in rows_by_day[day] if start < e["end_time"] and end > e["start_time"]),
            None,
        )
        if overlap is not None:
            errors.append(
                f"Line {line_no}: {day} {_fmt(start)}–{_fmt(end)} overlaps another class on the same day "
                f"({overlap['subject']}, {_fmt(overlap['start_time'])}–{_fmt(overlap['end_time'])})."
            )
            continue

        entry = {
            "day": day,
            "start_time": start,
            "end_time": end,
            "subject": subject,
            "room": room,
            "instructor": instructor,
            "type": class_type,
        }
        rows_by_day[day].append(entry)
        parsed.append(entry)

    if errors:
        raise TimetableParseError(errors)

    if not parsed:
        raise TimetableParseError(["The file has no valid class rows."])

    return parsed
