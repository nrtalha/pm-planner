"""Request and response models for the API (the web app's data contract)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from planner.models import ProjectBreakdown

STATUSES = ("To-Do", "In Progress", "In QA", "Blocked", "Complete", "Closed")
Status = Literal["To-Do", "In Progress", "In QA", "Blocked", "Complete", "Closed"]
ExportKind = Literal["phase-csv", "sprint-csv", "xlsx", "pptx", "plan-json"]


class PhaseRow(BaseModel):
    """One row of the editable phase schedule. Optional fields may be blank while editing."""
    id: str = Field(min_length=1, max_length=64)
    order: int | None = Field(default=None, ge=1)
    task_name: str | None = Field(default=None, max_length=300)
    phase: str | None = Field(default=None, max_length=120)
    duration_weeks: float | None = Field(default=None, ge=0.1, le=50)
    start_date: date | None = None
    end_date: date | None = None


class SprintTask(BaseModel):
    """One row of a sprint table. `sprint` is the sprint label, e.g. "Sprint 2" or "Backlog"."""
    id: str = Field(min_length=1, max_length=64)
    sprint: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=300)
    status: Status = "To-Do"
    start_date: date | None = None
    due_date: date | None = None
    priority: str | None = Field(default=None, max_length=20)


class ScheduleStatus(BaseModel):
    deadline: date
    latest_end: date | None
    on_track: bool
    buffer_days: int | None


class PlanState(BaseModel):
    """Everything the web app shows. The browser holds it; the API never stores it."""
    project: ProjectBreakdown
    start_date: date
    phases: list[PhaseRow]
    sprints: list[str]
    tasks: list[SprintTask]
    status: ScheduleStatus


PLAN_FILE_FORMAT = "sow-architect/plan"
PLAN_FILE_VERSION = 2


class SavedSchedule(BaseModel):
    """The edited schedule, exactly as the web app holds it."""
    start_date: date
    phases: list[PhaseRow]
    sprints: list[str]
    tasks: list[SprintTask]


class PlanFile(BaseModel):
    """plan.json written by the web app: Claude's plan plus every edit made since.

    Files from the Streamlit app (a bare ProjectBreakdown) still open; see OpenPlanRequest.
    """
    format: Literal["sow-architect/plan"] = PLAN_FILE_FORMAT
    version: Literal[2] = PLAN_FILE_VERSION
    name: str | None = Field(default=None, max_length=200)
    plan: ProjectBreakdown
    schedule: SavedSchedule


class OpenPlanRequest(BaseModel):
    """Send `saved` for a plan.json from the web app, or `plan` + `start_date` for an original one."""
    saved: PlanFile | None = None
    plan: ProjectBreakdown | None = None
    start_date: date | None = None

    @model_validator(mode="after")
    def one_kind_of_file(self) -> "OpenPlanRequest":
        if (self.saved is None) == (self.plan is None):
            raise ValueError("Send either a saved plan file or an original plan, not both or neither.")
        if self.plan is not None and self.start_date is None:
            raise ValueError("A start date is needed to lay out an original plan.")
        return self


class ScheduleRequest(BaseModel):
    start_date: date
    agreed_weeks: float = Field(ge=0, le=520)
    previous: list[PhaseRow]
    edited: list[PhaseRow]


class ScheduleResponse(BaseModel):
    phases: list[PhaseRow]
    status: ScheduleStatus


class ExportRequest(BaseModel):
    project: ProjectBreakdown
    start_date: date
    phases: list[PhaseRow]
    tasks: list[SprintTask]
    # Used only by the plan.json export, so it can restore empty sprints and the plan name.
    sprints: list[str] = Field(default_factory=list)
    name: str | None = Field(default=None, max_length=200)
