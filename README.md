# SOW Architect

Turn a Statement of Work into a delivery plan you can edit and hand off: phases on a Gantt chart, two-week sprints with tasks, the risks worth raising, and export files for Excel, PowerPoint, ClickUp and Jira.

Claude reads the SOW using **your Claude subscription** through the Claude Code CLI. There are no API keys, and everything runs on your machine.

---

## Quick start

```bash
./start.sh
```

That's it once setup is done (below). The script builds the web app if needed, starts it on **http://127.0.0.1:8000** and opens your browser. Press **Ctrl+C** to stop.

| Option | What it does |
|---|---|
| `./start.sh --no-open` | Start without opening a browser |
| `./start.sh --rebuild` | Rebuild the web app even if it looks up to date |
| `PORT=8010 ./start.sh` | Use another port |

---

## Setup (once)

**Requirements:** macOS or Linux, Python 3.12, Node.js 20.19+ or 22.12+ with pnpm, and the Claude Code CLI.

```bash
# 1. Python environment
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Web app dependencies
cd web && pnpm install --frozen-lockfile && cd ..

# 3. Sign the Claude Code CLI in to your Claude subscription (opens a browser)
claude auth login
```

`./start.sh` checks all of this and tells you exactly what's missing.

> **Signing in matters.** The desktop Claude app and the `claude` command keep separate sign-ins. If **New plan** reports "Claude Code is not logged in", run `claude auth login` in a terminal.

---

## Using the app

| Section | What you can do |
|---|---|
| **New plan** | Upload a SOW (PDF), set the start date and, optionally, a target number of weeks to compress or expand the plan. Claude usually takes under a minute. |
| **Overview** | Planned finish against the deadline, schedule buffer, workload, the project summary and the risks Claude found. |
| **Timeline** | Edit the phase table: order, names, durations, start and end dates; add and delete phases. Dates skip weekends: changing a duration or start moves the end date, and changing the end updates the duration. The Gantt chart and the deadline check update as you edit. Changing the project start date moves the deadline. |
| **Sprints** | One card per sprint plus the backlog: progress, priorities and dates. Edit tasks (name, status, dates, priority), add and delete tasks and sprints. |
| **Exports** | Download any of the files below, built from the plan as it is on screen. |

### Exports

| File | Contents |
|---|---|
| `plan.json` | **Your saved work:** the plan plus every edit. Reopen it with **Open plan.json**. |
| `phase_schedule.csv` | Order, task, phase, duration and dates for each phase |
| `sprint_distribution.csv` | Every task with status, dates and priority, ready for ClickUp or Jira import |
| `gantt_grid.xlsx` | Colour-coded week grid, one row per phase |
| `editable_gantt.pptx` | One 16:9 slide made of native, editable PowerPoint shapes |
| `Project_Phase_Schedule.png` | The Gantt chart at 3× resolution |

### Saving your work

The app keeps the plan in your browser tab only. Download **plan.json** from **Exports** to save it; until you do, the browser warns you before you close or reload the tab. A `plan.json` from the older Streamlit version still opens; you choose its start date and it is laid out fresh.

---

## How it works

```
web/      React + TypeScript + Tailwind + shadcn/ui     the interface (built into web/dist)
server/   FastAPI on 127.0.0.1                          serves the app and the API below
planner/  Python                                        date rules, scheduling, exports, Claude runner
```

- **Generating a plan:** the API runs `claude -p` with your PDF in a temporary folder that only the Read tool can access, and asks for structured output matching `planner/models.py`. API-key environment variables are removed for that call, so it always uses your subscription.
- **All date maths lives in `planner/`:** business days, sequencing, sprint windows and the deadline check. The web app sends every schedule edit to `POST /api/schedule` instead of re-implementing the rules.
- **Exports** are produced by `planner/exporters.py`. The PNG is rendered in the browser by plotly.js from the same Plotly figure, so no server-side Chrome is needed.

API reference: start the app and open **http://127.0.0.1:8000/docs**.

---

## Development

```bash
# API with auto-reload
.venv/bin/uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload

# Web app with hot reload on http://127.0.0.1:5173 (proxies /api to :8000)
cd web && pnpm dev
```

### Checks

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q                 # Python: scheduling, exports, API

cd web
pnpm typecheck && pnpm lint && pnpm test      # TypeScript, oxlint, Vitest
pnpm build
```

### Notes

- Python and web dependencies are pinned (`requirements.txt`, `web/pnpm-lock.yaml`). pnpm runs in strict mode with a minimum release age, so a brand-new package version won't install until it has been public for a while.
- The server only listens on 127.0.0.1 and stores nothing. Plans live in the browser tab and in the `plan.json` files you download.
- SOWs are confidential client documents. They go only to Claude, through your own Claude Code sign-in.

---

## Legacy Streamlit app

`app.py` is the previous Streamlit interface. It still runs (`.venv/bin/streamlit run app.py`) but is no longer developed, and it can't open `plan.json` files saved by the new app. It will be removed once the new app has fully replaced it.
