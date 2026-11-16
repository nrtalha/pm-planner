"""Business-day date math.

Weekends (Saturday/Sunday) are skipped. Public holidays are not modeled.
One "week" of work = 5 business days. End dates are inclusive.
"""
from datetime import date, timedelta

BUSINESS_DAYS_PER_WEEK = 5


def is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def roll_to_business_day(d: date) -> date:
    """Return d if it is a weekday, otherwise the following Monday."""
    while is_weekend(d):
        d += timedelta(days=1)
    return d


def next_business_day(d: date) -> date:
    """The first weekday strictly after d."""
    return roll_to_business_day(d + timedelta(days=1))


def add_business_days(d: date, n: int) -> date:
    """Move forward n business days from d (d itself is not counted)."""
    for _ in range(max(0, int(n))):
        d = next_business_day(d)
    return d


def calculate_business_end_date(start_date: date, duration_weeks: float) -> date:
    """Inclusive end date of a task that starts on start_date and lasts duration_weeks."""
    days = round(duration_weeks * BUSINESS_DAYS_PER_WEEK)
    if days <= 0:
        return start_date
    return add_business_days(start_date, days - 1)


def calculate_duration_weeks(start_date: date, end_date: date) -> float:
    """Inverse of calculate_business_end_date: inclusive business days / 5, rounded to 2 dp."""
    if end_date <= start_date:
        return 0.0
    current = start_date
    business_days = 1
    while current < end_date:
        current += timedelta(days=1)
        if not is_weekend(current):
            business_days += 1
    return round(business_days / BUSINESS_DAYS_PER_WEEK, 2)