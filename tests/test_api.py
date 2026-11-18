"""API tests. Exports are checked against the planner functions the Streamlit app calls."""
import io
import json
import zipfile
from datetime import date

from fastapi.testclient import TestClient

from planner.claude_runner import ClaudeCodeError
from planner.exporters import excel_gantt, phase_schedule_csv, pptx_gantt, prepare_chart_df, sprint_board_csv, week_axis
from planner.models import load_plan
from planner.schedule import deadline_date
from server.main import app
from server.routes import plans as plans_route
from server.state import phase_frame, sprint_frame

client = TestClient(app)

PLAN = {
    "project_summary": "Replatform storefront.",
    "key_risks": ["Data migration"],
    "agreed_timeline_weeks": 4,
    "recommended_sprint_count": 2,
    "phase_tasks": [
        {"task_name": "Discovery", "phase": "Discovery", "duration_weeks": 1},
        {"task_name": "Build", "phase": "Development", "duration_weeks": 2},
    ],
    "sprint_subtasks": [
        {"sprint_assignment": "Sprint 1", "subtask_name": "PDP design", "priority": "High"},
        {"sprint_assignment": "Sprint 2", "subtask_name": "API integration", "priority": "Normal"},
    ],
}
START = "2026-01-05"  # Monday


def open_plan() -> dict:
    res = client.post("/api/plans/open", json={"plan": PLAN, "start_date": START})
    assert res.status_code == 200, res.text
    return res.json()


def export_body(state: dict) -> dict:
    return {k: state[k] for k in ("project", "start_date", "phases", "tasks", "sprints", "name") if k in state}


# ---------------------------------------------------------------- plans
def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_open_plan_lays_out_phases_and_sprints():
    state = open_plan()
    assert [p["order"] for p in state["phases"]] == [1, 2]
    assert [(p["start_date"], p["end_date"]) for p in state["phases"]] == [
        ("2026-01-05", "2026-01-09"), ("2026-01-12", "2026-01-23")]
    assert state["sprints"] == ["Sprint 1", "Sprint 2", "Backlog"]
    assert [t["status"] for t in state["tasks"]] == ["To-Do", "To-Do"]
    assert state["tasks"][1]["start_date"] == "2026-01-19"
    assert state["status"] == {"deadline": "2026-01-30", "latest_end": "2026-01-23",
                               "on_track": True, "buffer_days": 7}
    assert len({p["id"] for p in state["phases"]} | {t["id"] for t in state["tasks"]}) == 4


def test_open_plan_rejects_invalid_plan():
    bad = dict(PLAN)
    del bad["phase_tasks"]
    assert client.post("/api/plans/open", json={"plan": bad, "start_date": START}).status_code == 422


def test_generate_uses_claude_runner(monkeypatch):
    seen = {}

    def fake_generate(data, weeks):
        seen.update(data=data, weeks=weeks)
        return load_plan(json.dumps(PLAN))

    monkeypatch.setattr(plans_route, "generate_plan", fake_generate)
    res = client.post("/api/plans/generate", data={"start_date": START, "target_weeks": "12"},
                      files={"file": ("sow.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert res.status_code == 200, res.text
    assert seen == {"data": b"%PDF-1.4 test", "weeks": 12.0}
    assert len(res.json()["phases"]) == 2


def test_generate_rejects_non_pdf():
    res = client.post("/api/plans/generate", data={"start_date": START},
                      files={"file": ("notes.txt", b"hello", "text/plain")})
    assert res.status_code == 415


def test_generate_rejects_oversized_pdf(monkeypatch):
    monkeypatch.setattr(plans_route, "MAX_PDF_BYTES", 10)
    res = client.post("/api/plans/generate", data={"start_date": START},
                      files={"file": ("sow.pdf", b"%PDF-" + b"x" * 20, "application/pdf")})
    assert res.status_code == 413


def test_generate_reports_claude_errors(monkeypatch):
    def failing(data, weeks):
        raise ClaudeCodeError("Claude Code is not logged in.")

    monkeypatch.setattr(plans_route, "generate_plan", failing)
    res = client.post("/api/plans/generate", data={"start_date": START},
                      files={"file": ("sow.pdf", b"%PDF-1.4", "application/pdf")})
    assert res.status_code == 502
    assert res.json()["detail"] == "Claude Code is not logged in."


# ---------------------------------------------------------------- schedule
def reconcile(state: dict, edited: list[dict]) -> dict:
    res = client.post("/api/schedule", json={
        "start_date": START, "agreed_weeks": 4, "previous": state["phases"], "edited": edited})
    assert res.status_code == 200, res.text
    return res.json()


def test_duration_change_moves_end_date():
    state = open_plan()
    edited = [dict(p) for p in state["phases"]]
    edited[1]["duration_weeks"] = 3
    out = reconcile(state, edited)
    assert out["phases"][1]["end_date"] == "2026-01-30"
    assert out["status"]["on_track"] is True and out["status"]["buffer_days"] == 0


def test_end_date_change_moves_duration_and_flags_breach():
    state = open_plan()
    edited = [dict(p) for p in state["phases"]]
    edited[1]["end_date"] = "2026-02-06"
    out = reconcile(state, edited)
    assert out["phases"][1]["duration_weeks"] == 4.0
    assert out["status"] == {"deadline": "2026-01-30", "latest_end": "2026-02-06",
                             "on_track": False, "buffer_days": -7}


def test_new_row_gets_next_order_and_end_date():
    state = open_plan()
    edited = state["phases"] + [{"id": "new1", "task_name": "Launch", "phase": "Launch",
                                 "duration_weeks": 1, "start_date": "2026-01-26"}]
    out = reconcile(state, edited)
    assert out["phases"][2]["order"] == 3
    assert out["phases"][2]["end_date"] == "2026-01-30"


def test_reorder_sorts_rows():
    state = open_plan()
    edited = [dict(p) for p in state["phases"]]
    edited[0]["order"], edited[1]["order"] = 2, 1
    out = reconcile(state, edited)
    assert [p["task_name"] for p in out["phases"]] == ["Build", "Discovery"]


# ---------------------------------------------------------------- exports
def _expected_frames(state: dict):
    from server.schemas import PhaseRow, SprintTask
    phases = [PhaseRow(**p) for p in state["phases"]]
    tasks = [SprintTask(**t) for t in state["tasks"]]
    phase_df = phase_frame(phases)
    chart_df = prepare_chart_df(phase_df)
    deadline = deadline_date(date(2026, 1, 5), PLAN["agreed_timeline_weeks"])
    min_date, num_weeks = week_axis(chart_df, date(2026, 1, 5), deadline)
    return phase_df, sprint_frame(tasks), chart_df, min_date, num_weeks


def _zip_parts(data: bytes, skip=("docProps/",)) -> dict:
    """Office files embed timestamps in docProps; compare everything else."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {n: z.read(n) for n in z.namelist() if not n.startswith(skip)}


def post_export(kind: str, state: dict):
    return client.post(f"/api/exports/{kind}", json=export_body(state))


def test_csv_exports_match_planner_output():
    state = open_plan()
    phase_df, sprint_df, *_ = _expected_frames(state)
    res = post_export("phase-csv", state)
    assert res.content == phase_schedule_csv(phase_df)
    assert res.headers["content-disposition"] == 'attachment; filename="phase_schedule.csv"'
    assert res.content.decode().splitlines()[0] == "Order,Task Name,Phase,Duration (Weeks),Start Date,End Date"
    res = post_export("sprint-csv", state)
    assert res.content == sprint_board_csv(sprint_df)
    assert res.content.decode().splitlines()[0] == "Name,Status,Start date,Due date,Priority"


def test_excel_and_pptx_match_planner_output():
    state = open_plan()
    _, _, chart_df, min_date, num_weeks = _expected_frames(state)
    xlsx = post_export("xlsx", state)
    assert xlsx.status_code == 200
    assert _zip_parts(xlsx.content) == _zip_parts(excel_gantt(chart_df, min_date, num_weeks).getvalue())
    pptx = post_export("pptx", state)
    assert pptx.status_code == 200
    assert _zip_parts(pptx.content) == _zip_parts(pptx_gantt(chart_df, min_date, num_weeks).getvalue())


def edited_state() -> dict:
    """An opened plan with edits: a renamed phase, a completed task and an extra empty sprint."""
    state = open_plan()
    state["phases"][1]["task_name"] = "Build (edited)"
    state["tasks"][0]["status"] = "Complete"
    state["sprints"] = ["Sprint 1", "Sprint 2", "Sprint 3", "Backlog"]
    return state


def test_plan_json_export_saves_edits():
    state = edited_state()
    res = post_export("plan-json", {**state, "name": "Northwind SOW"})
    assert res.headers["content-disposition"] == 'attachment; filename="plan.json"'
    saved = res.json()
    assert (saved["format"], saved["version"], saved["name"]) == ("sow-architect/plan", 2, "Northwind SOW")
    assert load_plan(json.dumps(saved["plan"])).model_dump() == load_plan(json.dumps(PLAN)).model_dump()
    assert saved["schedule"]["start_date"] == START
    assert saved["schedule"]["phases"] == state["phases"]
    assert saved["schedule"]["tasks"] == state["tasks"]
    assert saved["schedule"]["sprints"] == state["sprints"]


def test_saved_plan_reopens_exactly_as_edited():
    state = edited_state()
    saved = post_export("plan-json", {**state, "name": "Northwind SOW"}).json()
    res = client.post("/api/plans/open", json={"saved": saved})
    assert res.status_code == 200, res.text
    reopened = res.json()
    for key in ("start_date", "phases", "tasks", "sprints"):
        assert reopened[key] == state[key]
    assert reopened["status"] == state["status"]


def test_saved_plan_status_is_recomputed_not_trusted():
    saved = post_export("plan-json", open_plan()).json()
    saved["schedule"]["phases"][1]["end_date"] = "2026-02-06"  # past the 30 Jan deadline
    reopened = client.post("/api/plans/open", json={"saved": saved}).json()
    assert reopened["status"]["on_track"] is False
    assert reopened["status"]["buffer_days"] == -7


def test_open_rejects_ambiguous_or_incomplete_requests():
    saved = post_export("plan-json", open_plan()).json()
    assert client.post("/api/plans/open", json={}).status_code == 422
    assert client.post("/api/plans/open", json={"saved": saved, "plan": PLAN, "start_date": START}).status_code == 422
    assert client.post("/api/plans/open", json={"plan": PLAN}).status_code == 422
    bad = dict(saved, format="something-else")
    assert client.post("/api/plans/open", json={"saved": bad}).status_code == 422


def test_chart_export_needs_a_dated_phase():
    state = open_plan()
    state["phases"] = []
    assert post_export("xlsx", state).status_code == 409


def test_unknown_export_kind_is_rejected():
    assert post_export("docx", open_plan()).status_code == 422


def test_gantt_figure_for_png_export():
    res = post_export("gantt-figure", open_plan())
    assert res.status_code == 200
    fig = res.json()
    assert [t["name"] for t in fig["data"]] == ["Discovery", "Development"]
    assert [t["marker"]["color"] for t in fig["data"]] == ["#3B82F6", "#10B981"]  # Excel palette
    assert fig["layout"]["shapes"][0]["line"]["dash"] == "dash"  # deadline line
    assert fig["layout"]["xaxis"]["ticktext"][0] == "Week 1"
