"""Conversions between API rows and the DataFrames the planner package works with."""
import uuid
from datetime import date

import pandas as pd

from planner.models import ProjectBreakdown
from planner.schedule import (
    bootstrap_initial_schedule,
    build_sprint_rows,
    initial_visible_sprints,
    schedule_status,
)

from .schemas import PhaseRow, PlanFile, PlanState, ScheduleStatus, SprintTask

# Column names the exporters (and the CSV headers users already rely on) expect.
PHASE_COLUMNS = ["Order", "Task Name", "Phase", "Duration (Weeks)", "Start Date", "End Date"]
SPRINT_COLUMNS = ["Sprint", "Name", "Status", "Start date", "Due date", "Priority"]


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def status_for(start: date, agreed_weeks: float, phases: list[PhaseRow]) -> ScheduleStatus:
    return ScheduleStatus(**schedule_status(start, agreed_weeks, (p.end_date for p in phases)))


def build_plan_state(project: ProjectBreakdown, start: date) -> PlanState:
    """Lay out a freshly generated or reopened plan, exactly as the Streamlit app does."""
    phase_df = pd.DataFrame(
        [{"Task Name": t.task_name, "Phase": t.phase, "Duration (Weeks)": t.duration_weeks}
         for t in project.phase_tasks],
        columns=["Task Name", "Phase", "Duration (Weeks)"],
    )
    phases: list[PhaseRow] = []
    if not phase_df.empty:
        for row in bootstrap_initial_schedule(phase_df, start).to_dict("records"):
            phases.append(PhaseRow(
                id=new_id(), order=int(row["Order"]), task_name=row["Task Name"], phase=row["Phase"],
                duration_weeks=float(row["Duration (Weeks)"]),
                start_date=row["Start Date"], end_date=row["End Date"],
            ))

    sprint_df, max_sprint = build_sprint_rows(project.sprint_subtasks, start)
    tasks = [
        SprintTask(id=new_id(), sprint=r["Sprint"], name=r["Name"], status=r["Status"],
                   start_date=r["Start date"], due_date=r["Due date"], priority=r["Priority"])
        for r in sprint_df.to_dict("records")
    ]
    return PlanState(
        project=project, start_date=start, phases=phases,
        sprints=initial_visible_sprints(max_sprint), tasks=tasks,
        status=status_for(start, project.agreed_timeline_weeks, phases),
    )


def restore_plan_state(saved: PlanFile) -> PlanState:
    """Reopen a plan.json from the web app exactly as it was saved; only the deadline check is recomputed."""
    schedule = saved.schedule
    return PlanState(
        project=saved.plan, start_date=schedule.start_date, phases=schedule.phases,
        sprints=schedule.sprints, tasks=schedule.tasks,
        status=status_for(schedule.start_date, saved.plan.agreed_timeline_weeks, schedule.phases),
    )


def phase_frame(phases: list[PhaseRow]) -> pd.DataFrame:
    return pd.DataFrame(
        [[p.order, p.task_name, p.phase, p.duration_weeks, p.start_date, p.end_date] for p in phases],
        columns=PHASE_COLUMNS,
    )


def sprint_frame(tasks: list[SprintTask]) -> pd.DataFrame:
    return pd.DataFrame(
        [[t.sprint, t.name, t.status, t.start_date, t.due_date, t.priority] for t in tasks],
        columns=SPRINT_COLUMNS,
    )
