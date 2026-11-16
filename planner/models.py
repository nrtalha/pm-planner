"""The plan.json contract. Claude Code writes it; the app and scripts read it.

Step 2 extends this schema (phase ids, SOW references, dependencies, assumptions...).
"""
from typing import List

from pydantic import BaseModel, Field


class PhaseTaskItem(BaseModel):
    task_name: str = Field(description="High-level deliverable title for the Gantt Chart")
    phase: str = Field(description="Phase or category, e.g., 'Discovery', 'Development'")
    duration_weeks: float = Field(description="Estimated duration strictly in WEEKS (e.g., 1.5, 2.0, 0.5)")


class SprintSubtaskItem(BaseModel):
    sprint_assignment: str = Field(description="Which sprint this belongs to, e.g., 'Sprint 1', 'Sprint 2'")
    subtask_name: str = Field(description="Granular engineering subtask (e.g., 'PDP design', 'Migration of Points')")
    priority: str = Field(description="Priority: 'Urgent', 'High', 'Normal', or 'Low'")


class ProjectBreakdown(BaseModel):
    project_summary: str = Field(description="A brief, executive summary of the project scope and goals extracted from the SOW")
    key_risks: List[str]
    agreed_timeline_weeks: int = Field(description="Total contractual timeline extracted from the SOW in weeks")
    recommended_sprint_count: int = Field(description="Recommended number of sprints to complete this project")
    phase_tasks: List[PhaseTaskItem]
    sprint_subtasks: List[SprintSubtaskItem]


def load_plan(raw_json: str) -> ProjectBreakdown:
    """Parse and validate plan.json text. Raises pydantic.ValidationError on bad input."""
    return ProjectBreakdown.model_validate_json(raw_json)