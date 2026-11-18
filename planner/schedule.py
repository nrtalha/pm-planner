"""Scheduling rules: phase sequencing, sprint windows, deadline checks."""
import re
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd

from .dates import (
    add_business_days,
    calculate_business_end_date,
    calculate_duration_weeks,
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


# ---------------------------------------------------------------- row-based API
# The web app sends phases as a list of dicts with a stable "id":
#   {"id", "order", "task_name", "phase", "duration_weeks", "start_date", "end_date"}
# These functions apply the same rules as the Streamlit phase table.

def reconcile_phase_rows(previous: List[Dict[str, Any]],
                         edited: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep start / duration / end consistent after an edit, then sort by order.

    - A row without an order goes to the end (max order + 1).
    - A new row, or a row without an end date, gets its end calculated.
    - Changing start or duration recalculates the end.
    - Changing only the end recalculates the duration.
    """
    before = {row["id"]: row for row in previous}
    rows = [dict(row) for row in edited]

    max_order = max((r["order"] for r in rows if r.get("order") is not None), default=0)
    for row in rows:
        if row.get("order") is None:
            max_order += 1
            row["order"] = max_order

    for row in rows:
        start, duration, end = row.get("start_date"), row.get("duration_weeks"), row.get("end_date")
        if start is None or duration is None:
            continue
        calc_end = calculate_business_end_date(start, float(duration))
        old = before.get(row["id"])
        if old is None or end is None:
            row["end_date"] = calc_end
        elif old.get("start_date") != start or old.get("duration_weeks") != duration:
            row["end_date"] = calc_end
        elif old.get("end_date") != end:
            row["duration_weeks"] = calculate_duration_weeks(start, end)

    return sorted(rows, key=lambda r: r["order"])  # stable: equal orders keep their position


def schedule_status(base_start: date, agreed_weeks: float,
                    end_dates: Iterable[Optional[date]]) -> Dict[str, Any]:
    """Deadline check shown above the Gantt chart.

    buffer_days: calendar days between the last phase end and the deadline
    (negative means the plan overruns). None when no phase has an end date.
    """
    deadline = deadline_date(base_start, agreed_weeks)
    ends = [d for d in end_dates if d is not None]
    latest = max(ends) if ends else None
    return {
        "deadline": deadline,
        "latest_end": latest,
        "on_track": latest is None or latest <= deadline,
        "buffer_days": None if latest is None else (deadline - latest).days,
    }