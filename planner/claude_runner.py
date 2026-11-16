"""Generate a plan from a SOW PDF using the local Claude Code CLI.

Runs `claude -p` in headless mode, which uses the Claude subscription you are
logged in with (`claude auth login`). No API key is used: ANTHROPIC_* variables
are removed from the child environment so it can't fall back to API billing.

Claude only gets the Read tool, confined to a temp folder holding the PDF.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from .models import ProjectBreakdown

DEFAULT_TIMEOUT_SECONDS = 15 * 60

_CANDIDATE_PATHS = [
    "~/.local/bin/claude",
    "~/.claude/local/claude",
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
]


class ClaudeCodeError(RuntimeError):
    """Raised with a user-facing message when generation fails."""


def find_claude() -> Optional[str]:
    found = shutil.which("claude")
    if found:
        return found
    for candidate in _CANDIDATE_PATHS:
        path = Path(candidate).expanduser()
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    return None


def build_prompt(pdf_name: str, target_weeks: float = 0) -> str:
    if target_weeks > 0:
        timeline = (
            f"Adjust, compress, or expand task durations so the whole project fits exactly within "
            f"{target_weeks:g} weeks, and set agreed_timeline_weeks to {round(target_weeks)}."
        )
    else:
        timeline = "Set agreed_timeline_weeks to the total contractual timeline stated in the SOW, in weeks."

    return f"""You are a Principal Technical Product Manager.

Read the Statement of Work in ./{pdf_name} in full. If it is long, read it in page ranges until you have
read every page. Then break it down into a delivery plan:

1. project_summary: a brief executive summary of scope and goals.
2. key_risks: the main delivery risks, each one specific to this SOW.
3. phase_tasks: high-level, sequential deliverables for a Gantt chart, each with a phase name and a
   duration in weeks.
4. sprint_subtasks: granular, actionable engineering subtasks that deliver those phases, grouped into
   2-week sprints labelled "Sprint 1", "Sprint 2", ... in phase order, each with a priority of
   Urgent, High, Normal or Low.
5. recommended_sprint_count: the number of sprints used.
6. {timeline}

Base everything on the document; do not invent scope it does not mention. Return the result as the
structured output only."""


def _child_env() -> dict:
    """Environment for the CLI: drop API keys and parent Claude Code session variables."""
    keep = {"CLAUDE_CONFIG_DIR"}
    return {
        k: v for k, v in os.environ.items()
        if k in keep or not (k.startswith("ANTHROPIC_") or k.startswith("CLAUDE"))
    }


def _parse_cli_output(stdout: str, stderr: str) -> ProjectBreakdown:
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        detail = (stderr or stdout).strip()[-800:]
        raise ClaudeCodeError(f"Claude Code returned unexpected output:\n{detail}")

    result_text = str(data.get("result") or "")
    if data.get("is_error"):
        if "not logged in" in result_text.lower() or "/login" in result_text:
            raise ClaudeCodeError(
                "Claude Code is not logged in. In a terminal, run `claude auth login` and sign in "
                "with your Claude subscription, then try again."
            )
        raise ClaudeCodeError(f"Claude Code reported an error: {result_text or data.get('subtype')}")

    payload = data.get("structured_output")
    if payload is None:
        # Fallback: the model put the JSON in its text reply.
        text = result_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            raise ClaudeCodeError("Claude Code finished without returning a plan. Try generating again.")

    try:
        return ProjectBreakdown.model_validate(payload)
    except Exception as err:
        raise ClaudeCodeError(f"The generated plan did not match the expected format:\n{err}")


def generate_plan(pdf_bytes: bytes, target_weeks: float = 0, model: Optional[str] = None,
                  timeout: int = DEFAULT_TIMEOUT_SECONDS) -> ProjectBreakdown:
    claude = find_claude()
    if not claude:
        raise ClaudeCodeError(
            "Claude Code CLI not found. Install it (https://docs.claude.com/en/docs/claude-code), "
            "run `claude auth login`, then restart the app."
        )

    with tempfile.TemporaryDirectory(prefix="sow-") as workdir:
        pdf_name = "sow.pdf"
        (Path(workdir) / pdf_name).write_bytes(pdf_bytes)
        cmd = [
            claude, "-p", build_prompt(pdf_name, target_weeks),
            "--output-format", "json",
            "--json-schema", json.dumps(ProjectBreakdown.model_json_schema()),
            "--tools", "Read",
            "--allowedTools", "Read",
            "--restricted",
            "--strict-mcp-config",
            "--no-session-persistence",
        ]
        if model:
            cmd += ["--model", model]
        try:
            proc = subprocess.run(cmd, cwd=workdir, env=_child_env(), capture_output=True,
                                  text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise ClaudeCodeError(f"Claude Code did not finish within {timeout // 60} minutes.")

    return _parse_cli_output(proc.stdout, proc.stderr)
