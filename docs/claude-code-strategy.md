# Strategy: Generating SOW Plans with Claude Code

## 1. What this project does today

`app.py` is a single-file Streamlit app ("SOW & Sprint Architect"):

| Step | Implementation |
|---|---|
| Input | SOW/charter PDF, project start date, optional "force timeline (weeks)" |
| Extraction | PyPDF2 flattens the PDF to plain text |
| Generation | One Groq call (`qwen/qwen3.8-27b`, `max_tokens=900`) asked to return JSON matching the `ProjectBreakdown` Pydantic schema |
| Output data | `project_summary`, `key_risks[]`, `agreed_timeline_weeks`, `recommended_sprint_count`, `phase_tasks[]` (name, phase, duration_weeks), `sprint_subtasks[]` (sprint, name, priority) |
| Deterministic logic | Business-day date math, sequential phase scheduling, 2-week sprint dates, deadline-breach check |
| UI | Editable phase table → Plotly Gantt with deadline line; per-sprint editable tables with add/delete |
| Exports | Phase CSV, Sprint CSV (ClickUp/Jira import), Excel week-grid Gantt, editable PPTX Gantt |

The LLM is only responsible for **reading the SOW and producing the structured plan**. Everything else
(dates, charts, files) is deterministic Python. That split is what makes a Claude Code replacement clean.

## 2. Issues found while reviewing (fix regardless of direction)

**Security — urgent**
- `.streamlit/secrets.toml` is tracked in git despite `.gitignore` (it was committed before the ignore rule).
  The current HEAD contains a real `GROQ_API_KEY`, and `origin/main` has a commit titled
  "Update GEMINI_API_KEY in secrets.toml". **Rotate both keys now**, then `git rm --cached .streamlit/secrets.toml`.
  Scrubbing history (e.g. `git filter-repo`) only matters after rotation, if the repo is or was public.
- `.venv/` is also tracked (~9,500 files). `git rm -r --cached .venv`.

**Correctness**
- `max_tokens=900` is far too small for this schema on any real SOW — output gets truncated and
  `model_validate_json` fails. This is likely the main source of "it doesn't work" runs.
- `requirements.txt` lists `google-genai` but the code imports `groq` and `PyPDF2` (neither listed). README still describes Gemini.
- Sprint dates overlap: sprint *n* starts on the *last day* of sprint *n-1* (`calculate_business_end_date` returns an inclusive end date and is reused as a start).
- Sprints are generated independently of phases — no link between a subtask and the phase/deliverable it serves, so the sprint board can contradict the Gantt.
- PyPDF2 text extraction loses tables, which is often where SOW milestones/payment schedules live.
- `model_validate_json` is called twice; schema is computed twice; `math` imported twice.

## 3. The Claude Code approach

**Principle:** Claude Code does the *reasoning* (read SOW, decompose, estimate, justify). Python scripts do the
*arithmetic and rendering* (dates, Gantt, CSV/XLSX/PPTX). A JSON plan file is the contract between them and the
single source of truth the UI (later) reads and edits.

```
SOW.pdf ──► Claude Code (skill: /sow-plan) ──► plans/<project>/plan.json ──► scripts/render.py ──► CSV / XLSX / PPTX / Gantt HTML
                    ▲        │                        │
                    │        └── validate (schema) ◄──┘   (errors fed back to Claude until clean)
                    └── conversational refinement: "compress to 10 weeks", "move QA earlier", "add a hypercare phase"
                                                         └──► optional: push sprints/tasks to ClickUp via MCP
```

### Why this is better than the current Groq call
- **Native PDF reading** — Claude reads the PDF directly (layout, tables, headings), no PyPDF2 flattening.
- **No output cap / no truncation** — the plan is written to a file, not squeezed into 900 tokens.
- **Self-correcting** — the skill runs the validator and fixes its own schema/date errors before finishing.
- **Iterative** — refinements are conversation turns against `plan.json`, not a full regenerate.
- **Traceable** — each deliverable cites the SOW section it came from; assumptions are listed explicitly.
- **No API keys in the repo** — runs on the user's Claude Code login.
- **ClickUp push** — a ClickUp connector is available in this environment, so sprints can become real tasks instead of a CSV import.

### Proposed layout
```
.claude/skills/sow-plan/SKILL.md     # the workflow + PM rubric Claude follows
schema/plan.schema.json              # contract (generated from Pydantic models)
planner/
  models.py                          # Pydantic models (extended schema, below)
  dates.py                           # business-day math (moved out of app.py, bug fixed, unit-tested)
  schedule.py                        # phase sequencing, sprint dating, deadline check
  exporters.py                       # CSV / XLSX / PPTX / Plotly HTML (moved out of app.py)
scripts/
  validate.py  plan.json             # schema + sanity checks, non-zero exit on problems
  render.py    plan.json --out DIR   # computes dates, writes all exports
plans/<project>/                     # sow.pdf, plan.json, out/  (gitignored if client-confidential)
app.py                               # later: becomes a viewer/editor over plan.json (no LLM call)
```

### Extended plan schema (vs. today)
Keep everything that exists, and add what makes the output trustworthy and linkable:
- `phases[]`: `id`, `name`, `deliverables[]`, `duration_weeks`, `depends_on[]`, **`sow_refs[]`** (section/page)
- `subtasks[]`: `id`, `name`, **`phase_id`**, `sprint`, `priority`, `estimate_days`, `acceptance_criteria`
- `assumptions[]`, `open_questions[]` (things the SOW leaves ambiguous — ask the client)
- `risks[]` as objects: `risk`, `impact`, `mitigation`
- `timeline`: `contract_weeks` (as found in SOW), `target_weeks` (if forced), `start_date`
- `milestones[]` (payment / sign-off gates found in the SOW)

The LLM never writes dates; `render.py` derives them from `start_date` + durations + dependencies.

### Skill outline (`/sow-plan <pdf> [--start YYYY-MM-DD] [--weeks N]`)
1. Read the PDF in full. Extract scope, deliverables, milestones, contract timeline, out-of-scope items.
2. Draft phases with SOW citations; draft subtasks linked to phases; size and assign to 2-week sprints respecting phase order.
3. If `--weeks` is given, compress/expand and record what was cut or parallelized as assumptions.
4. Write `plan.json`, run `scripts/validate.py`, fix until clean.
5. Run `scripts/render.py`; summarize: timeline vs. contract, top risks, open questions, links to outputs.
6. Offer: refine, or push to ClickUp (confirm list/space first).

## 4. Rollout plan

| # | Step | Done when |
|---|---|---|
| 0 | **Hygiene**: rotate keys, untrack secrets + `.venv`, fix `requirements.txt` | Clean `git ls-files`, app still runs |
| 1 | Extract `dates.py` / `schedule.py` / `exporters.py` from `app.py`; add pytest for date math (incl. sprint-overlap fix) | `app.py` imports the modules; tests pass |
| 2 | Define extended Pydantic models + emit `plan.schema.json`; write `validate.py` | Validator accepts a hand-written sample plan |
| 3 | Write `render.py` producing the same 4 exports + standalone Gantt HTML | Output matches today's app for the same data |
| 4 | Write the `/sow-plan` skill; run it on 2–3 real SOWs and compare against the Groq output | Side-by-side review: coverage, citations, sane durations |
| 5 | Optional: ClickUp push (sprints → lists, subtasks → tasks with priority/dates) | One test project created in a sandbox list |
| 6 | **UI/UX phase (later)**: `app.py` becomes a viewer/editor of `plan.json` — or a published interactive artifact | See section 5 |

Steps 1 and 2 are independent and can run in parallel; 3 needs both; 4 needs 3.

## 5. Notes for the later UI/UX phase
Removing the LLM call from the UI simplifies it a lot. Things to address then:
- Load / save `plan.json` (and a plan picker) instead of upload-and-generate on every visit.
- Linked views: clicking a phase in the Gantt filters its sprint subtasks (possible once `phase_id` exists).
- Show SOW citations, assumptions and open questions next to each phase.
- Sprint board as a real board (columns by status) rather than stacked editable tables; capacity per sprint.
- Dependencies and milestones drawn on the Gantt; "today" line; deadline-breach highlighted on the offending bars.
- Undo / dirty-state indicator — today every edit silently reruns the page.
