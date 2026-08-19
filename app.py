import streamlit as st
import pandas as pd
import plotly.express as px
import tempfile
import os
import math
import re
from datetime import datetime, timedelta, date
from pydantic import BaseModel, Field
from typing import List
from google import genai
from google.genai import types

# ---------------------------------------------------------
# 1. Configuration & Client Initialization
# ---------------------------------------------------------
st.set_page_config(page_title="SOW & Sprint Architect", layout="wide")
st.title("SOW & Sprint Architect - PM Specialized Tool")

client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])

# ---------------------------------------------------------
# 2. Pydantic Output Schema
# ---------------------------------------------------------
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

# ---------------------------------------------------------
# 3. Core Date Logic
# ---------------------------------------------------------
def calculate_business_end_date(start_date: date, duration_weeks: float) -> date:
    days_to_add = round(duration_weeks * 5)
    if days_to_add <= 0: return start_date
    current_date = start_date
    added = 0
    target_add = days_to_add - 1
    while added < target_add:
        current_date += timedelta(days=1)
        if current_date.weekday() != 5 and current_date.weekday() != 6:
            added += 1
    return current_date

def calculate_duration_weeks(start_date: date, end_date: date) -> float:
    if end_date <= start_date: return 0.0
    current_date = start_date
    business_days = 1
    while current_date < end_date:
        current_date += timedelta(days=1)
        if current_date.weekday() != 5 and current_date.weekday() != 6:
            business_days += 1
    return round(business_days / 5.0, 2)

def bootstrap_initial_schedule(df: pd.DataFrame, base_start: date) -> pd.DataFrame:
    if df.empty: return df
    df = df.copy()
    while base_start.weekday() in [5, 6]:
        base_start += timedelta(days=1)
        
    start_dates, end_dates = [], []
    current_cursor = base_start

    for _, row in df.iterrows():
        dur_weeks = float(row["Duration (Weeks)"]) if pd.notnull(row["Duration (Weeks)"]) else 1.0
        task_start = current_cursor
        task_end = calculate_business_end_date(task_start, dur_weeks)
        start_dates.append(task_start)
        end_dates.append(task_end)
        
        next_day = task_end + timedelta(days=1)
        while next_day.weekday() in [5, 6]: next_day += timedelta(days=1)
        current_cursor = next_day

    df["Start Date"] = start_dates
    df["End Date"] = end_dates
    df["Order"] = range(1, len(df) + 1)
    cols = ["Order"] + [c for c in df.columns if c != "Order"]
    return df[cols]

# ---------------------------------------------------------
# 4. Sidebar Inputs & Navigation
# ---------------------------------------------------------
with st.sidebar:
    st.header("Project Inputs")
    uploaded_file = st.file_uploader("Upload SOW / Charter (PDF)", type=["pdf"])
    start_date = st.date_input("Project Start Date", datetime.today())
    
    st.divider()
    st.markdown("**Timeline Control**")
    target_timeline = st.number_input(
        "Force Target Timeline (Weeks)", 
        min_value=0.0, value=0.0, step=1.0,
        help="Leave at 0 to use the SOW's timeline. Enter a number to force compression or expansion."
    )
    generate_btn = st.button("Generate Plan", type="primary")

    # --- Quick Navigation Menu  ---
    if "project_data" in st.session_state:
        st.divider()
        st.header("Quick Navigation")
        st.markdown(
            """
            * [Project Summary](#project-summary)
            * [Critical Insights and Risks](#critical-insights-and-risks)
            * [Phase Schedule](#phase-schedule)
            * [Gantt Chart](#gantt-chart)
            * [Proposed Sprint Distribution](#proposed-sprint-distribution)
            """
        )

# ---------------------------------------------------------
# 5. Ingestion Pipeline
# ---------------------------------------------------------
if generate_btn and uploaded_file:
    with st.spinner("Intelligently mapping Phase and Sprint structures..."):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(uploaded_file.getvalue())
            tmp_path = tmp.name

        try:
            uploaded_pdf = client.files.upload(file=tmp_path)
            
            timeline_instruction = "Extract the total agreed timeline in WEEKS from the document."
            if target_timeline > 0:
                timeline_instruction = f"Strictly adjust, compress, or expand the task durations so the total project fits exactly within a {target_timeline}-week window. Set 'agreed_timeline_weeks' to {target_timeline}."

            prompt = f"""
            You are a Principal Technical Product Manager.
            Read this SOW. {timeline_instruction}
            
            1. Extract a brief executive summary of the project scope.
            2. Extract high-level, sequential deliverables for the Phase Schedule (estimate durations in weeks).
            3. Break down those high-level deliverables into granular, actionable engineering subtasks for the Sprint Board (e.g. 'PDP Design', 'API Integration').
            4. Group the subtasks into logical 2-week Sprints (Sprint 1, Sprint 2, etc.) and assign priorities.
            """

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[uploaded_pdf, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ProjectBreakdown,
                    temperature=0.1
                )
            )

            project_data = response.parsed
            st.session_state["project_data"] = project_data
            
            raw_tasks = []
            for task in project_data.phase_tasks:
                raw_tasks.append({
                    "Task Name": task.task_name,
                    "Phase": task.phase,
                    "Duration (Weeks)": task.duration_weeks
                })
            initial_df = pd.DataFrame(raw_tasks)
            st.session_state["tasks_df"] = bootstrap_initial_schedule(initial_df, start_date)

            safe_start = start_date if isinstance(start_date, date) else date.today()
            sprint_tasks = []
            max_sprint_generated = 0
            
            for sub in project_data.sprint_subtasks:
                match = re.search(r'\d+', sub.sprint_assignment)
                sprint_num = int(match.group()) if match else 1
                max_sprint_generated = max(max_sprint_generated, sprint_num)
                
                s_start = calculate_business_end_date(safe_start, (sprint_num - 1) * 2) if sprint_num > 1 else safe_start
                s_end = calculate_business_end_date(s_start, 2)

                sprint_tasks.append({
                    "Sprint": f"Sprint {sprint_num}",
                    "Name": sub.subtask_name,
                    "Status": "To-Do",
                    "Start date": s_start,
                    "Due date": s_end,
                    "Priority": sub.priority
                })
            
            st.session_state["sprint_df"] = pd.DataFrame(sprint_tasks)
            
            st.session_state["visible_sprints"] = [f"Sprint {i}" for i in range(1, max_sprint_generated + 1)]
            st.session_state["visible_sprints"].append("Backlog")

        except Exception as api_error:
            st.error(f"API Timeout or Error: {api_error}")
        finally:
            os.remove(tmp_path)

# ---------------------------------------------------------
# 6. Project Summary & Editable Phase Schedule
# ---------------------------------------------------------
if "tasks_df" in st.session_state:
    st.subheader("Project Summary")
    st.write(st.session_state["project_data"].project_summary)

    st.divider()
    st.subheader("Critical Insights and Risks")
    for risk in st.session_state["project_data"].key_risks:
        st.warning(risk)

    st.divider()
    st.subheader("Phase Schedule")
    st.caption("High Level - Change the 'Order' number to rearrange tasks. This controls the Gantt chart.")

    if "Order" not in st.session_state["tasks_df"].columns:
        st.session_state["tasks_df"].insert(0, "Order", range(1, len(st.session_state["tasks_df"]) + 1))

    old_df = st.session_state["tasks_df"].copy().sort_values(by="Order").reset_index(drop=True)

    edited_df = st.data_editor(
        old_df,
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "Order": st.column_config.NumberColumn("Order", min_value=1, step=1, width="small"),
            "Phase": st.column_config.TextColumn("Phase"),
            "Duration (Weeks)": st.column_config.NumberColumn("Duration (Weeks)", min_value=0.1, max_value=50.0, step=0.5),
            "Start Date": st.column_config.DateColumn("Start Date", format="YYYY-MM-DD"),
            "End Date": st.column_config.DateColumn("End Date", format="YYYY-MM-DD")
        }
    )

    changes_detected = False
    
    if edited_df["Order"].isnull().any():
        max_order = edited_df["Order"].max()
        if pd.isna(max_order): max_order = 0
        for idx in edited_df[edited_df["Order"].isnull()].index:
            max_order += 1
            edited_df.at[idx, "Order"] = max_order
        changes_detected = True

    for idx in edited_df.index:
        start_d = edited_df.loc[idx, "Start Date"]
        dur = edited_df.loc[idx, "Duration (Weeks)"]
        end_d = edited_df.loc[idx, "End Date"]

        if pd.notnull(start_d) and pd.notnull(dur):
            calc_end = calculate_business_end_date(pd.to_datetime(start_d).date(), float(dur))
            if idx not in old_df.index or pd.isnull(end_d):
                if end_d != calc_end:
                    edited_df.at[idx, "End Date"] = calc_end
                    changes_detected = True
            else:
                old_row = old_df.loc[idx]
                if old_row["Start Date"] != start_d or old_row["Duration (Weeks)"] != dur:
                    if end_d != calc_end:
                        edited_df.at[idx, "End Date"] = calc_end
                        changes_detected = True
                elif old_row["End Date"] != end_d:
                    calc_dur = calculate_duration_weeks(pd.to_datetime(start_d).date(), pd.to_datetime(end_d).date())
                    if dur != calc_dur:
                        edited_df.at[idx, "Duration (Weeks)"] = calc_dur
                        changes_detected = True

    if not edited_df["Order"].equals(old_df["Order"]):
        changes_detected = True

    if changes_detected:
        st.session_state["tasks_df"] = edited_df.sort_values(by="Order").reset_index(drop=True)
        st.rerun()

    # ---------------------------------------------------------
    # 7. Timeline Checks & Gantt Chart
    # ---------------------------------------------------------
    agreed_weeks = st.session_state["project_data"].agreed_timeline_weeks
    safe_start = start_date if isinstance(start_date, date) else date.today()
    deadline_date = calculate_business_end_date(safe_start, agreed_weeks)

    st.divider()
    valid_end_dates = pd.to_datetime(edited_df["End Date"]).dropna()
    if not valid_end_dates.empty:
        max_end_date = valid_end_dates.max().date()
        if max_end_date > deadline_date:
            st.error(f"🚨 **Deadline Breach:** Tasks extend to {max_end_date.strftime('%B %d, %Y')}.")
        else:
            st.success(f"✅ **Timeline on Track:** Deliverables complete within the {agreed_weeks}-week boundary.")

    st.subheader("Gantt Chart")
    st.caption("Phase Schedule Visualization")
    
    chart_df = edited_df.copy()
    chart_df = chart_df.dropna(subset=["Start Date", "Duration (Weeks)"])
    chart_df["Phase"] = chart_df["Phase"].fillna("Uncategorized")
    chart_df["Task Name"] = chart_df["Task Name"].fillna("New Task")
    chart_df = chart_df.sort_values(by="Order", ascending=True)

    visual_end_dates = []
    for _, row in chart_df.iterrows():
        s_date = pd.to_datetime(row["Start Date"])
        v_end = s_date + timedelta(days=float(row["Duration (Weeks)"]) * 7)
        visual_end_dates.append(v_end)

    chart_df["Start Date"] = pd.to_datetime(chart_df["Start Date"])
    chart_df["Visual End Date"] = visual_end_dates

    if not chart_df.empty:
        fig = px.timeline(
            chart_df,
            x_start="Start Date", x_end="Visual End Date", 
            y="Task Name", color="Phase", hover_data=["Duration (Weeks)"] 
        )
        min_date = min(chart_df["Start Date"].min().date(), safe_start)
        max_date = max(chart_df["Visual End Date"].max().date(), deadline_date)
        num_weeks = max(1, ((max_date - min_date).days // 7) + 2) 
        
        custom_tickvals = [(min_date + timedelta(days=7*i)).strftime("%Y-%m-%d") for i in range(num_weeks)]
        custom_ticktext = [f"Week {i+1}" for i in range(num_weeks)]

        fig.update_layout(
            xaxis=dict(side="top", tickmode="array", tickvals=custom_tickvals, ticktext=custom_ticktext, showgrid=True, gridcolor='rgba(200, 200, 200, 0.4)', gridwidth=1),
            yaxis=dict(showgrid=False, title="Tasks"),
            height=550, showlegend=True
        )
        fig.add_vline(x=deadline_date.strftime("%Y-%m-%d"), line_width=3, line_dash="dash", line_color="#e74c3c", annotation_text="Deadline", annotation_position="top right")
        fig.update_yaxes(autorange="reversed", categoryorder="array", categoryarray=chart_df["Task Name"].tolist())
        st.plotly_chart(fig, use_container_width=True)

    # ---------------------------------------------------------
    # 8. Proposed Sprint Distribution (Explicit Add/Delete)
    # ---------------------------------------------------------
    st.divider()
    
    col_header, col_btn = st.columns([8, 2])
    with col_header:
        st.subheader("Proposed Sprint Distribution")
    with col_btn:
        if st.button("➕ Add Sprint", use_container_width=True):
            if "visible_sprints" in st.session_state:
                max_s = 0
                for s in st.session_state["visible_sprints"]:
                    match = re.search(r'\d+', s)
                    if match: max_s = max(max_s, int(match.group()))
                
                new_sprint = f"Sprint {max_s + 1}"
                
                if "Backlog" in st.session_state["visible_sprints"]:
                    st.session_state["visible_sprints"].insert(-1, new_sprint)
                else:
                    st.session_state["visible_sprints"].append(new_sprint)
                st.rerun()

    if "sprint_df" in st.session_state:
        master_sprint_df = st.session_state["sprint_df"]
        
        if "visible_sprints" not in st.session_state:
            active_sprints = master_sprint_df["Sprint"].dropna().unique().tolist()
            max_s = 0
            for s in active_sprints:
                match = re.search(r'\d+', s)
                if match: max_s = max(max_s, int(match.group()))
            st.session_state["visible_sprints"] = [f"Sprint {i}" for i in range(1, max_s + 1)]
            if "Backlog" not in st.session_state["visible_sprints"]:
                st.session_state["visible_sprints"].append("Backlog")

        updated_dfs = []
        
        for sprint in st.session_state["visible_sprints"]:
            
            with st.expander(f"🟣 {sprint.upper()}", expanded=True):
                c1, c2 = st.columns([9, 1])
                with c2:
                    if st.button("🗑️ Delete", key=f"del_{sprint}", help=f"Delete {sprint} and all its tasks"):
                        st.session_state["visible_sprints"].remove(sprint)
                        st.session_state["sprint_df"] = master_sprint_df[master_sprint_df["Sprint"] != sprint]
                        st.rerun()

                sprint_data = master_sprint_df[master_sprint_df["Sprint"] == sprint].copy()
                sprint_data = sprint_data.drop(columns=["Sprint"], errors="ignore")
                
                sprint_data = sprint_data.reset_index(drop=True)
                sprint_data.index = sprint_data.index + 1
                
                edited_sprint = st.data_editor(
                    sprint_data,
                    key=f"editor_{sprint}",
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Name": st.column_config.TextColumn("Name", required=True, width="large"),
                        "Status": st.column_config.SelectboxColumn("Status", options=["To-Do", "In Progress", "In QA", "Blocked", "Complete", "Closed"], width="small"),
                        "Start date": st.column_config.DateColumn("Start date", format="YYYY-MM-DD", width="small"),
                        "Due date": st.column_config.DateColumn("Due date", format="YYYY-MM-DD", width="small"),
                        "Priority": st.column_config.SelectboxColumn("Priority", options=["Urgent", "High", "Normal", "Low"], width="small")
                    }
                )
                
                edited_sprint.insert(0, "Sprint", sprint)
                updated_dfs.append(edited_sprint)
                
        st.session_state["sprint_df"] = pd.concat(updated_dfs, ignore_index=True)

    # ---------------------------------------------------------
    # 9. Export Options
    # ---------------------------------------------------------
    col1, col2 = st.columns(2)
    with col1:
        st.download_button("Download Phase Schedule (CSV)", data=edited_df.to_csv(index=False).encode('utf-8'), file_name="phase_schedule.csv", mime="text/csv")
    with col2:
        if "sprint_df" in st.session_state:
            export_df = st.session_state["sprint_df"].drop(columns=["Sprint"], errors="ignore")
            st.download_button("Download Sprint Board (CSV)", data=export_df.to_csv(index=False).encode('utf-8'), file_name="sprint_distribution.csv", mime="text/csv")
