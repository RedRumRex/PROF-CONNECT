"""Unit tests for app/timetable_parser.py — pure parsing/validation logic,
no Supabase/network involved. Covers the exact rules documented in
README.md's "Timetable" section: Mon-Fri only, 08:00-17:10, no overlap with
the 13:00-13:50 lunch break, no overlapping classes on the same day."""
import pytest

from app.timetable_parser import parse_timetable_csv, TimetableParseError, REQUIRED_COLUMNS, COLUMNS_WITH_TYPE

HEADER = ",".join(REQUIRED_COLUMNS)
HEADER_WITH_TYPE = ",".join(COLUMNS_WITH_TYPE)


def csv_bytes_with_type(*rows: str) -> bytes:
    return (HEADER_WITH_TYPE + "\n" + "\n".join(rows)).encode("utf-8")


def csv_bytes(*rows: str) -> bytes:
    return (HEADER + "\n" + "\n".join(rows)).encode("utf-8")


def test_valid_file_parses_correctly():
    data = csv_bytes(
        "Mon,08:00,08:50,Data Structures,LT-1,Dr. Sharma",
        "Mon,09:00,09:50,Digital Electronics,LT-2,Dr. Iyer",
        "Tue,14:00,15:40,Signals & Systems,,",
    )
    entries = parse_timetable_csv(data)
    assert len(entries) == 3
    assert entries[0]["day"] == "Mon"
    assert entries[0]["subject"] == "Data Structures"
    assert entries[0]["room"] == "LT-1"
    assert entries[2]["room"] is None  # blank optional fields become None
    assert entries[2]["instructor"] is None


@pytest.mark.parametrize("day_raw", ["mon", "MON", "Monday", "monday"])
def test_day_names_are_case_and_form_insensitive(day_raw):
    data = csv_bytes(f"{day_raw},08:00,08:50,Data Structures,,")
    entries = parse_timetable_csv(data)
    assert entries[0]["day"] == "Mon"


def test_weekend_day_rejected():
    data = csv_bytes("Sat,09:00,09:50,Extra Class,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "Mon/Tue/Wed/Thu/Fri" in exc_info.value.errors[0]


def test_ambiguous_two_letter_day_rejected():
    # "Th" alone is ambiguous between Tue and Thu — must be rejected rather
    # than guessed at.
    data = csv_bytes("Th,09:00,09:50,Ambiguous,,")
    with pytest.raises(TimetableParseError):
        parse_timetable_csv(data)


def test_bad_time_format_rejected():
    data = csv_bytes("Mon,9am,10am,Bad Times,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert any("HH:MM" in e for e in exc_info.value.errors)


def test_start_after_end_rejected():
    data = csv_bytes("Mon,10:00,09:00,Backwards,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "before end_time" in exc_info.value.errors[0]


@pytest.mark.parametrize("start,end", [("07:30", "08:30"), ("17:00", "17:30")])
def test_outside_college_hours_rejected(start, end):
    data = csv_bytes(f"Mon,{start},{end},Too Early Or Late,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "college hours" in exc_info.value.errors[0]


@pytest.mark.parametrize("start,end", [
    ("12:30", "13:30"),  # starts before lunch, ends during
    ("13:00", "13:50"),  # exactly the lunch slot
    ("13:20", "14:20"),  # starts during lunch, ends after
    ("12:00", "14:00"),  # spans straight through lunch
])
def test_lunch_break_overlap_rejected(start, end):
    data = csv_bytes(f"Mon,{start},{end},Lunch Clash,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "lunch break" in exc_info.value.errors[0]


def test_back_to_back_around_lunch_is_fine():
    # 12:10-13:00 and 13:50-14:40 both touch the lunch boundary but don't
    # overlap it — must be accepted.
    data = csv_bytes(
        "Mon,12:10,13:00,Before Lunch,,",
        "Mon,13:50,14:40,After Lunch,,",
    )
    entries = parse_timetable_csv(data)
    assert len(entries) == 2


def test_overlapping_classes_same_day_rejected():
    data = csv_bytes(
        "Mon,09:00,10:00,First Class,,",
        "Mon,09:30,10:30,Overlapping Class,,",
    )
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "overlaps another class" in exc_info.value.errors[0]


def test_same_time_different_days_is_fine():
    data = csv_bytes(
        "Mon,09:00,10:00,Recurring Class,,",
        "Wed,09:00,10:00,Recurring Class,,",
        "Fri,09:00,10:00,Recurring Class,,",
    )
    entries = parse_timetable_csv(data)
    assert len(entries) == 3


def test_missing_subject_rejected():
    data = csv_bytes("Mon,09:00,10:00,,,")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "subject is required" in exc_info.value.errors[0]


def test_wrong_header_rejected():
    bad = b"weekday,from,to,course,location,teacher\nMon,08:00,08:50,X,,"
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(bad)
    assert "header row" in exc_info.value.errors[0]


def test_empty_file_rejected():
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(b"")
    assert "empty" in exc_info.value.errors[0]


def test_header_only_no_rows_rejected():
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv((HEADER + "\n").encode("utf-8"))
    assert "no valid class rows" in exc_info.value.errors[0]


def test_blank_lines_are_skipped_not_treated_as_errors():
    data = (HEADER + "\nMon,08:00,08:50,Data Structures,,\n\n\n").encode("utf-8")
    entries = parse_timetable_csv(data)
    assert len(entries) == 1


def test_multiple_errors_all_collected_not_just_first():
    data = csv_bytes(
        "Sat,08:00,08:50,Weekend,,",
        "Mon,25:00,09:50,Bad Time,,",
        "Mon,10:00,09:00,Backwards,,",
    )
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    # One error per bad row (the 25:00 row only has its start_time flagged,
    # since end_time 09:50 alone is valid) — confirms parsing keeps going
    # after each bad row instead of stopping at the first problem.
    assert len(exc_info.value.errors) == 3


def test_missing_type_column_defaults_every_row_to_lecture():
    data = csv_bytes("Mon,08:00,08:50,Data Structures,,")
    entries = parse_timetable_csv(data)
    assert entries[0]["type"] == "lecture"


@pytest.mark.parametrize("type_raw,expected", [
    ("lecture", "lecture"), ("Lecture", "lecture"), ("LECTURE", "lecture"),
    ("tutorial", "tutorial"), ("Tutorial", "tutorial"),
    ("lab", "lab"), ("Lab", "lab"), ("LAB", "lab"),
    ("", "lecture"),  # blank type column defaults to lecture too
])
def test_type_column_recognized_case_insensitively(type_raw, expected):
    data = csv_bytes_with_type(f"Mon,08:00,08:50,Data Structures,,,{type_raw}")
    entries = parse_timetable_csv(data)
    assert entries[0]["type"] == expected


def test_invalid_type_value_rejected():
    data = csv_bytes_with_type("Mon,08:00,08:50,Data Structures,,,workshop")
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "lecture/tutorial/lab" in exc_info.value.errors[0]


def test_mixed_types_in_one_file():
    data = csv_bytes_with_type(
        "Mon,08:00,08:50,Data Structures,,,lecture",
        "Mon,09:00,09:50,Engineering Math,,,tutorial",
        "Mon,10:00,11:40,Data Structures Lab,,,lab",
    )
    entries = parse_timetable_csv(data)
    assert [e["type"] for e in entries] == ["lecture", "tutorial", "lab"]


def test_oversized_file_rejected():
    huge_row = "Mon,08:00,08:50," + ("x" * 250_000) + ",,"
    data = csv_bytes(huge_row)
    with pytest.raises(TimetableParseError) as exc_info:
        parse_timetable_csv(data)
    assert "too large" in exc_info.value.errors[0]
