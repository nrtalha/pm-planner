from datetime import date
from types import SimpleNamespace

import pandas as pd

from planner.schedule import (
    bootstrap_initial_schedule,
    build_sprint_rows,
    deadline_date,
    initial_visible_sprints,
    latest_end_date,
    next_sprint_label,
    parse_sprint_number,
    sprint_window,
)

MON = date(2026, 1, 5)
SAT = date(2026, 1, 3)


def _phases():
    return pd.DataFrame([
        {"Task Name": "Discovery", "Phase": "Discovery", "Duration (Weeks)": 1},
        {"Task Name": "Build", "Phase": "Development", "Duration (Weeks)": 2},
        {"Task Name": "UAT", "Phase": "QA", "Duration (Weeks)": None},  # defaults to 1 week
    ])


def test_parse_sprint_number():
    assert parse_sprint_number("Sprint 3") == 3
    assert parse_sprint_number("Backlog") == 1
    assert parse_sprint_number("Backlog", default=0) == 0


def test_phases_run_back_to_back():
    df = bootstrap_initial_schedule(_phases(), MON)
    assert list(df.columns)[0] == "Order"
    assert list(df["Order"]) == [1, 2, 3]
    assert list(df["Start Date"]) == [MON, date(2026, 1, 12), date(2026, 1, 26)]
    assert list(df["End Date"]) == [date(2026, 1, 9), date(2026, 1, 23), date(2026, 1, 30)]


def test_weekend_start_rolls_to_monday():
    df = bootstrap_initial_schedule(_phases(), SAT)
    assert df["Start Date"].iloc[0] == MON


def test_empty_schedule():
    assert bootstrap_initial_schedule(pd.DataFrame(), MON).empty


def test_sprints_do_not_overlap():
    s1 = sprint_window(MON, 1)
    s2 = sprint_window(MON, 2)
    s3 = sprint_window(MON, 3)
    assert s1 == (MON, date(2026, 1, 16))
    assert s2 == (date(2026, 1, 19), date(2026, 1, 30))
    assert s3[0] == date(2026, 2, 2)
    assert s1[1] < s2[0] and s2[1] < s3[0]


def test_build_sprint_rows():
    subs = [
        SimpleNamespace(sprint_assignment="Sprint 1", subtask_name="PDP design", priority="High"),
        SimpleNamespace(sprint_assignment="Sprint 3", subtask_name="API integration", priority="Normal"),
    ]
    df, max_sprint = build_sprint_rows(subs, MON)
    assert max_sprint == 3
    assert list(df["Sprint"]) == ["Sprint 1", "Sprint 3"]
    assert (df["Status"] == "To-Do").all()
    assert df["Start date"].iloc[1] == date(2026, 2, 2)


def test_visible_sprints_helpers():
    vis = initial_visible_sprints(2)
    assert vis == ["Sprint 1", "Sprint 2", "Backlog"]
    assert next_sprint_label(vis) == "Sprint 3"
    assert next_sprint_label(["Backlog"]) == "Sprint 1"


def test_deadline_and_latest_end():
    assert deadline_date(MON, 4) == date(2026, 1, 30)
    assert deadline_date(SAT, 1) == date(2026, 1, 9)
    df = bootstrap_initial_schedule(_phases(), MON)
    assert latest_end_date(df) == date(2026, 1, 30)