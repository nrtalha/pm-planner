# pm-planner
An AI-powered dashboard for Technical Project Managers. Upload PDF SOWs to automatically generate business-day phase schedules, dynamic Gantt charts, and granular, ClickUp-style engineering sprint boards using the Gemini API.

# 🏗️ SOW & Sprint Architect - PM Specialized Tool

A specialized, AI-powered dashboard built for Technical Project Managers. This tool ingests raw PDF Statements of Work (SOWs) and uses Google's Gemini API to automatically architect structured project phases, business-day schedules, and granular engineering sprint boards.

## What It Does

The SOW & Sprint Architect eliminates the manual overhead of breaking down massive project charters. By uploading an SOW, the app:
1. **Extracts Core Context:** Automatically pulls executive summaries, key project risks, and the contractual timeline.
2. **Builds Phase Schedules:** Maps out high-level deliverables and their estimated durations in weeks.
3. **Generates Granular Sprints:** Breaks phases down into actionable engineering subtasks (e.g., "PDP Design", "API Integration") and intelligently distributes them across 2-week sprint cycles.
4. **Visualizes Timelines:** Renders a dynamic, drag-and-drop Gantt chart to track phase progression against hard deadlines.

## How It Works

* **AI Engine:** Utilizes Google's `gemini-3.6-flash` model with strict Pydantic JSON schemas to guarantee the output is formatted precisely for data tables.
* **Smart Date Logic:** Features a custom business-day calculation engine. Tasks automatically skip weekends, and adjustments to a task's duration or start date seamlessly cascade to recalculate its end date.
* **Interactive UI:** Built entirely in Streamlit. It features multi-level expandable sprint accordions (ClickUp-style), manual sprint creation/deletion, and automated Gantt chart sorting.
* **Data Portability:** Full support for exporting the Phase Schedule and Sprint Distribution to CSV for integration into Jira, ClickUp, or Asana.

---

## 🛠️ Installation Guide

Follow these steps to set up the tool on your local machine.

### Prerequisites
* Python 3.8 or higher installed on your system.
* A valid Google Gemini API Key.

### 1. Clone the Repository
bash
git clone [https://github.com/nrtalha/pm-planner.git](https://github.com/yourusername/pm-planner.git)
cd pm-planner

###2. Set Up a Virtual Environment
It is highly recommended to use a virtual environment to manage dependencies.

For Mac/Linux:

python3 -m venv .venv
source .venv/bin/activate
