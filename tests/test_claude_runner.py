"""Tests for the Claude Code runner, using a fake `claude` script (no real CLI call)."""
import json
import stat
import sys

import pytest

from planner import claude_runner
from planner.claude_runner import ClaudeCodeError, build_prompt, generate_plan

PLAN = {
    "project_summary": "Replatform storefront.",
    "key_risks": ["Data migration"],
    "agreed_timeline_weeks": 6,
    "recommended_sprint_count": 2,
    "phase_tasks": [{"task_name": "Discovery", "phase": "Discovery", "duration_weeks": 1}],
    "sprint_subtasks": [{"sprint_assignment": "Sprint 1", "subtask_name": "PDP design", "priority": "High"}],
}


def _fake_cli(tmp_path, monkeypatch, response: dict):
    """Install a fake `claude` that checks it got the PDF, then prints `response` as JSON."""
    script = tmp_path / "claude"
    script.write_text(
        f"#!{sys.executable}\n"
        "import json, os, sys\n"
        "assert os.path.isfile('sow.pdf'), 'PDF not in working dir'\n"
        "assert '--json-schema' in sys.argv and '--restricted' in sys.argv\n"
        "assert not any(k.startswith('ANTHROPIC_') for k in os.environ), 'API key leaked'\n"
        f"print({json.dumps(json.dumps(response))})\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setattr(claude_runner, "find_claude", lambda: str(script))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "should-be-stripped")


def test_structured_output_becomes_plan(tmp_path, monkeypatch):
    _fake_cli(tmp_path, monkeypatch, {"is_error": False, "structured_output": PLAN, "result": ""})
    plan = generate_plan(b"%PDF-1.4 fake")
    assert plan.phase_tasks[0].task_name == "Discovery"


def test_falls_back_to_json_in_text_reply(tmp_path, monkeypatch):
    text = "```json\n" + json.dumps(PLAN) + "\n```"
    _fake_cli(tmp_path, monkeypatch, {"is_error": False, "structured_output": None, "result": text})
    assert generate_plan(b"%PDF").agreed_timeline_weeks == 6


def test_not_logged_in_gives_login_instructions(tmp_path, monkeypatch):
    _fake_cli(tmp_path, monkeypatch, {"is_error": True, "result": "Not logged in · Please run /login"})
    with pytest.raises(ClaudeCodeError, match="claude auth login"):
        generate_plan(b"%PDF")


def test_invalid_plan_is_reported(tmp_path, monkeypatch):
    _fake_cli(tmp_path, monkeypatch, {"is_error": False, "structured_output": {"project_summary": "x"}})
    with pytest.raises(ClaudeCodeError, match="expected format"):
        generate_plan(b"%PDF")


def test_missing_cli(monkeypatch):
    monkeypatch.setattr(claude_runner, "find_claude", lambda: None)
    with pytest.raises(ClaudeCodeError, match="not found"):
        generate_plan(b"%PDF")


def test_prompt_mentions_forced_timeline():
    assert "exactly within 12 weeks" in build_prompt("sow.pdf", 12)
    assert "contractual timeline" in build_prompt("sow.pdf", 0)
