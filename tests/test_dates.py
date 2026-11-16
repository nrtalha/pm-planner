from datetime import date

from planner.dates import (
    add_business_days,
    calculate_business_end_date,
    calculate_duration_weeks,
    next_business_day,
    roll_to_business_day,
)

MON = date(2026, 1, 5)   # Monday
FRI = date(2026, 1, 9)
SAT = date(2026, 1, 10)


def test_roll_to_business_day():
    assert roll_to_business_day(MON) == MON
    assert roll_to_business_day(SAT) == date(2026, 1, 12)


def test_next_business_day_skips_weekend():
    assert next_business_day(FRI) == date(2026, 1, 12)


def test_add_business_days():
    assert add_business_days(MON, 0) == MON
    assert add_business_days(MON, 4) == FRI
    assert add_business_days(MON, 5) == date(2026, 1, 12)


def test_one_week_task_ends_friday():
    assert calculate_business_end_date(MON, 1) == FRI


def test_two_week_task_ends_second_friday():
    assert calculate_business_end_date(MON, 2) == date(2026, 1, 16)


def test_zero_duration_returns_start():
    assert calculate_business_end_date(MON, 0) == MON


def test_half_week():
    # 2.5 days rounds to 2 (Python banker's rounding) -> Mon..Tue
    assert calculate_business_end_date(MON, 0.5) == date(2026, 1, 6)


def test_duration_round_trip():
    for weeks in (1, 2, 3.4, 6):
        end = calculate_business_end_date(MON, weeks)
        assert calculate_duration_weeks(MON, end) == round(round(weeks * 5) / 5, 2)


def test_duration_of_inverted_range_is_zero():
    assert calculate_duration_weeks(FRI, MON) == 0.0