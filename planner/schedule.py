"""Scheduling rules: phase sequencing, sprint windows, deadline checks."""
import re
from datetime import date
from typing import Iterable, List, Optional, Tuple

import pandas as pd

from .dates import (
    add_business_days,
    calculate_business_end_date,
    next_business_day,
    roll_to_business_day,
)

SPRINT_LENGTH_WEEKS = 2
DEFAULT_STATUS = "To-Do"


def parse_sprint_number(label: str, default: int = 1) -> int:
    """'Sprint 3' -> 3. Returns default when no number is present."""
    match = re.search(r"\d+", str(label))
    return int(match.group()) if match else default


def bootstrap_initial_schedule(df: pd.DataFrame, base_start: date) -> pd.DataFrame:
    """Lay phase tasks end-to-end from base_start, adding Order / Start Date / End Date."""
    if df.empty:
        return df
    df = df.copy()
    cursor = roll_to_business_day(base_start)
    start_dates, end_dates = [], []

    for _, row in df.iterrows():
        dur = row["Duration (Weeks)"]
        dur_weeks = float(dur) if pd.notnull(dur) else 1.0
        task_end = calculate_business_end_date(cursor, dur_weeks)
        start_dates.append(cursor)
        end_dates.append(task_end)
        cursor = next_business_day(task_end)

    df["Start Date"] = start_dates
    df["End Date"] = end_dates
    df["Order"] = range(1, len(df) + 1)
    return df[["Order"] + [c for c in df.columns if c != "Order"]]


def sprint_window(base_start: date, sprint_num: int,
                  length_weeks: int = SPRINT_LENGTH_WEEKS) -> Tuple[date, date]:
    """(start, inclusive end) of sprint N. Sprints are back-to-back with no overlap."""
    first_day = roll_to_business_day(base_start)
    offset_days = (max(1, sprint_num) - 1) * length_weeks * 5
    s_start = add_business_days(first_day, offset_days)
    return s_start, calculate_business_end_date(s_start, length_weeks)


def build_sprint_rows(subtasks: Iterable, base_start: date) -> Tuple[pd.DataFrame, int]:
    """Turn LLM sprint subtasks into sprint-board rows. Returns (df, highest sprint number)."""
    rows = []
    max_sprint = 0
    for sub in subtasks:
        n = parse_sprint_number(sub.sprint_assignment)
        max_sprint = max(max_sprint, n)
        s_start, s_end = sprint_window(base_start, n)
        rows.append({
            "Sprint": f"Sprint {n}",
            "Name": sub.subtask_name,
            "Status": DEFAULT_STATUS,
            "Start date": s_start,
            "Due date": s_end,
            "Priority": sub.priority,
        })
    return pd.DataFrame(rows), max_sprint


def initial_visible_sprints(max_sprint: int) -> List[str]:
    return [f"Sprint {i}" for i in range(1, max_sprint + 1)] + ["Backlog"]


def next_sprint_label(visible: Iterable[str]) -> str:
    highest = max((parse_sprint_number(s, 0) for s in visible), default=0)
    return f"Sprint {highest + 1}"


def deadline_date(base_start: date, agreed_weeks: float) -> date:
    return calculate_business_end_date(roll_to_business_day(base_start), agreed_weeks)


def latest_end_date(df: pd.DataFrame) -> Optional[date]:
    ends = pd.to_datetime(df["End Date"]).dropna()
    return None if ends.empty else ends.max().date()