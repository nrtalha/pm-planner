"""Chart and file exports. Pure functions: data in, figure / bytes out (no Streamlit)."""
import io
import math
from datetime import date, timedelta
from typing import Tuple

import pandas as pd
import plotly.express as px

PHASE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

GANTT_CHART_CONFIG = {
    "displayModeBar": True,
    "displaylogo": False,
    "toImageButtonOptions": {"format": "png", "filename": "Project_Phase_Schedule", "scale": 3},
}


# ---------------------------------------------------------------- chart data
def prepare_chart_df(phase_df: pd.DataFrame) -> pd.DataFrame:
    """Clean the phase table for charting/exports.

    Adds 'Visual End Date' (start + calendar weeks, so bars snap to week gridlines)
    and 'Real End Date' (the business-day end date, as a string, for hover/labels).
    """
    df = phase_df.dropna(subset=["Start Date", "End Date", "Duration (Weeks)"]).copy()
    df["Phase"] = df["Phase"].fillna("Uncategorized")
    df["Task Name"] = df["Task Name"].fillna("New Task")
    df = df.sort_values(by="Order", ascending=True)

    df["Start Date"] = pd.to_datetime(df["Start Date"])
    df["Visual End Date"] = [
        s + timedelta(days=float(d) * 7) for s, d in zip(df["Start Date"], df["Duration (Weeks)"])
    ]
    df["Real End Date"] = pd.to_datetime(df["End Date"]).dt.strftime("%Y-%m-%d")
    return df


def week_axis(chart_df: pd.DataFrame, project_start: date, deadline: date) -> Tuple[date, int]:
    """(first date on the axis, number of week columns) shared by chart, Excel and PPTX."""
    min_date = min(chart_df["Start Date"].min().date(), project_start)
    max_date = max(chart_df["Visual End Date"].max().date(), deadline)
    num_weeks = max(1, ((max_date - min_date).days // 7) + 2)
    return min_date, num_weeks


def phase_color_map(chart_df: pd.DataFrame) -> dict:
    return {p: PHASE_COLORS[i % len(PHASE_COLORS)] for i, p in enumerate(chart_df["Phase"].unique())}


# ---------------------------------------------------------------- plotly
def build_gantt_figure(chart_df: pd.DataFrame, min_date: date, num_weeks: int, deadline: date):
    fig = px.timeline(
        chart_df,
        x_start="Start Date", x_end="Visual End Date",
        y="Task Name", color="Phase",
        hover_data={"Duration (Weeks)": True, "Real End Date": True, "Visual End Date": False},
    )
    tickvals = [(min_date + timedelta(days=7 * i)).strftime("%Y-%m-%d") for i in range(num_weeks)]
    ticktext = [f"Week {i + 1}" for i in range(num_weeks)]
    fig.update_layout(
        xaxis=dict(side="top", tickmode="array", tickvals=tickvals, ticktext=ticktext,
                   showgrid=True, gridcolor="rgba(200, 200, 200, 0.4)", gridwidth=1),
        yaxis=dict(showgrid=False, title="Tasks"),
        height=max(300, len(chart_df) * 45 + 150),
        showlegend=True,
    )
    fig.add_vline(x=deadline.strftime("%Y-%m-%d"), line_width=3, line_dash="dash",
                  line_color="#e74c3c", annotation_text="Deadline", annotation_position="top right")
    fig.update_yaxes(autorange="reversed", categoryorder="array",
                     categoryarray=chart_df["Task Name"].tolist())
    return fig


# ---------------------------------------------------------------- CSV
def phase_schedule_csv(phase_df: pd.DataFrame) -> bytes:
    return phase_df.to_csv(index=False).encode("utf-8")


def sprint_board_csv(sprint_df: pd.DataFrame) -> bytes:
    return sprint_df.drop(columns=["Sprint"], errors="ignore").to_csv(index=False).encode("utf-8")


# ---------------------------------------------------------------- Excel
def excel_gantt(chart_df: pd.DataFrame, min_date: date, num_weeks: int) -> io.BytesIO:
    """Week-grid Gantt: one row per task, one coloured cell per week it spans."""
    out = io.BytesIO()
    with pd.ExcelWriter(out, engine="xlsxwriter") as writer:
        wb = writer.book
        ws = wb.add_worksheet("Gantt Grid")
        header_fmt = wb.add_format({"bold": True, "bg_color": "#111827", "font_color": "white",
                                    "border": 1, "align": "center"})
        task_fmt = wb.add_format({"border": 1, "text_wrap": True})
        empty_fmt = wb.add_format({"border": 1})
        fill_fmts = {p: wb.add_format({"bg_color": c, "border": 1})
                     for p, c in phase_color_map(chart_df).items()}

        for col, (title, width) in enumerate([("Task Name", 35), ("Phase", 20), ("Start", 12), ("End", 12)]):
            ws.write(0, col, title, header_fmt)
            ws.set_column(col, col, width)
        for w in range(num_weeks):
            ws.write(0, 4 + w, f"W{w + 1}", header_fmt)
            ws.set_column(4 + w, 4 + w, 4)

        for r, (_, row) in enumerate(chart_df.iterrows(), start=1):
            ws.write(r, 0, row["Task Name"], task_fmt)
            ws.write(r, 1, row["Phase"], task_fmt)
            ws.write(r, 2, row["Start Date"].strftime("%Y-%m-%d"), task_fmt)
            ws.write(r, 3, row["Real End Date"], task_fmt)

            span = max(1, int(math.ceil(float(row["Duration (Weeks)"]))))
            offset = max(0, (row["Start Date"].date() - min_date).days // 7)
            fill = fill_fmts[row["Phase"]]
            for w in range(num_weeks):
                ws.write(r, 4 + w, "", fill if offset <= w < offset + span else empty_fmt)
    out.seek(0)
    return out


# ---------------------------------------------------------------- PowerPoint
def pptx_gantt(chart_df: pd.DataFrame, min_date: date, num_weeks: int) -> io.BytesIO:
    """One 16:9 slide with native, editable shapes (bars, gridlines, labels)."""
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.util import Inches, Pt

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank

    margin_left, margin_top = Inches(1.5), Inches(1.5)
    week_spacing = Inches(10) / num_weeks
    row_height, bar_height = Inches(0.8), Inches(0.25)
    bar_rgb = RGBColor(23, 89, 89)   # #175959
    text_rgb = RGBColor(80, 80, 80)
    grid_height = int(len(chart_df) * row_height + Inches(0.5))

    for w in range(num_weeks + 1):
        x = int(margin_left + w * week_spacing)
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, margin_top, Pt(1), grid_height)
        line.fill.solid()
        line.fill.fore_color.rgb = bar_rgb
        line.line.fill.background()
        if w < num_weeks:
            tb = slide.shapes.add_textbox(x - Inches(0.5), margin_top - Inches(0.5), Inches(1), Inches(0.4))
            p = tb.text_frame.paragraphs[0]
            p.text = f"WEEK {w + 1}"
            p.font.size = Pt(10)
            p.font.color.rgb = text_rgb

    for i, (_, row) in enumerate(chart_df.iterrows()):
        offset_weeks = max(0, (row["Start Date"].date() - min_date).days / 7)
        left = int(margin_left + offset_weeks * week_spacing)
        top = int(margin_top + i * row_height + Inches(0.2))
        width = int(float(row["Duration (Weeks)"]) * week_spacing)

        bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, bar_height)
        bar.fill.solid()
        bar.fill.fore_color.rgb = bar_rgb
        bar.line.fill.background()

        label = slide.shapes.add_textbox(left, top + bar_height, max(width, Inches(2)), Inches(0.4))
        label.text_frame.word_wrap = True
        p = label.text_frame.paragraphs[0]
        p.text = str(row["Task Name"])
        p.font.size = Pt(9)
        p.font.color.rgb = text_rgb

    out = io.BytesIO()
    prs.save(out)
    out.seek(0)
    return out