# 🏗️ SOW & Sprint Architect - PM Specialized Tool

The SOW & Sprint Architect is a specialized, Streamlit-based utility designed to automate the heavy lifting of technical project planning. By leveraging Google's Gemini LLM, it instantly parses raw Statements of Work (SOWs) and translates them into structured phase schedules, interactive Gantt charts, and manageable 2-week engineering sprints, complete with business-day date math and CSV export capabilities.

##  What It Does

The SOW & Sprint Architect eliminates the manual overhead of breaking down massive project charters. By uploading an SOW, the app:
1. **Extracts Core Context:** Automatically pulls executive summaries, key project risks, and the contractual timeline.
2. **Builds Phase Schedules:** Maps out high-level deliverables and their estimated durations in weeks.
3. **Generates Granular Sprints:** Breaks phases down into actionable engineering subtasks (e.g., "PDP Design", "API Integration") and intelligently distributes them across 2-week sprint cycles.
4. **Visualizes Timelines:** Renders a dynamic, drag-and-drop Gantt chart to track phase progression against hard deadlines.

##  How It Works

* **AI Engine:** Utilizes Google's gemini-3.6-flash model with strict Pydantic JSON schemas to guarantee the output is formatted precisely for data tables.
* **Smart Date Logic:** Features a custom business-day calculation engine. Tasks automatically skip weekends, and adjustments to a task's duration or start date seamlessly cascade to recalculate its end date.
* **Interactive UI:** Built entirely in Streamlit. It features multi-level expandable sprint accordions (ClickUp-style), manual sprint creation/deletion, and automated Gantt chart sorting.
* **Data Portability:** Full support for exporting the Phase Schedule and Sprint Distribution to CSV for integration into Jira, ClickUp, or Asana.

---

##  Installation Guide

Follow these steps to set up the tool on your local machine.

### Prerequisites
* Python 3.8 or higher installed on your system.
* A valid Google Gemini API Key.

### 1. Clone the Repository
    git clone https://github.com/nrtalha/pm-planner.git
    cd pm-planner

### 2. Set Up a Virtual Environment
It is highly recommended to use a virtual environment to manage dependencies.

**For Mac/Linux:**
    python3 -m venv .venv
    source .venv/bin/activate

**For Windows (Command Prompt / PowerShell):**
    python -m venv .venv
    .venv\Scripts\activate

### 3. Install Dependencies
With your virtual environment active, install the required Python packages:
    
    pip install -r requirements.txt

### 4. Configure API Secrets
Streamlit requires your Gemini API key to be stored in a specific hidden folder. 

1. Inside the root directory of the project, create a folder named `.streamlit`.
2. Inside that folder, create a file named `secrets.toml`.
3. Add your API key to the file exactly like this:
    
    GEMINI_API_KEY = "your_actual_api_key_here"


---

##  How to Use the App

1. **Start the Server:** Ensure your virtual environment is active, then run:
    
    streamlit run app.py
    
2. **Upload an SOW:** In the left sidebar, upload your Project Charter or Statement of Work as a PDF.
3. **Set Constraints (Optional):** Define the official Project Start Date. If you need to force the AI to compress or expand the timeline, enter a specific number in the "Force Target Timeline" input.
4. **Generate:** Click **Generate Plan**. The AI will parse the document and build your dashboard.
5. **Refine:** 
   * Edit the "Phase Schedule" table to change task orders or durations (the Gantt chart will update automatically).
   * Expand the "Proposed Sprint Distribution" to manually assign statuses, change priorities, or add/delete entire sprints.
6. **Export:** Use the buttons at the bottom of the page to download your finalized plans as CSVs.

##  Tech Stack
* **Frontend/Framework:** [Streamlit](https://streamlit.io/)
* **AI/LLM:** Google GenAI SDK (gemini-3.6-flash)
* **Data Processing:** Pandas, Pydantic
* **Visualization:** Plotly Express
