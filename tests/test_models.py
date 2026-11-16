import json

import pytest
from pydantic import ValidationError

from planner.models import load_plan

VALID = {
    "project_summary": "Replatform storefront.",
    "key_risks": ["Data migration"],
    "agreed_timeline_weeks": 6,
    "recommended_sprint_count": 3,
    "phase_tasks": [{"task_name": "Discovery", "phase": "Discovery", "duration_weeks": 1}],
    "sprint_subtasks": [{"sprint_assignment": "Sprint 1", "subtask_name": "PDP design", "priority": "High"}],
}


def test_valid_plan_loads():
    plan = load_plan(json.dumps(VALID))
    assert plan.phase_tasks[0].task_name == "Discovery"


def test_missing_field_is_rejected():
    bad = dict(VALID)
    del bad["phase_tasks"]
    with pytest.raises(ValidationError):
        load_plan(json.dumps(bad))