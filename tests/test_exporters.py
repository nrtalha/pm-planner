import io
import zipfile
from datetime import date

import pandas as pd

from planner.exporters import (
    build_gantt_figure,
    excel_gantt,
    phase_schedule_csv,
    pptx_gantt,
    prepare_chart_df,
    sprint_board_csv,
    week_axis,
)
from planner.schedule import bootstrap_initial_schedule, deadline_date

MON = date(2026, 1, 5)


def _chart():
    phases = pd.DataFrame([
        {"Task Name": "Discovery", "Phase": "Discovery", "Duration (Weeks)": 1},
        {"Task Name": "Build", "Phase": "Development", "Duration (Weeks)": 2.5},
    ])
    df = bootstrap_initial_schedule(phases, MON)
    chart = prepare_chart_df(df)
    deadline = deadline_date(MON, 6)
    min_date, num_weeks = week_axis(chart, MON, deadline)
    return df, chart, deadline, min_date, num_weeks


def test_prepare_chart_df_columns():
    _, chart, *_ = _chart()
    assert {"Visual End Date", "Real End Date"} <= set(chart.columns)
    assert chart["Real End Date"].iloc[0] == "2026-01-09"


def test_week_axis_covers_deadline():
    _, _, deadline, min_date, num_weeks = _chart()
    assert min_date == MON
    assert (deadline - min_date).days // 7 < num_weeks


def test_gantt_figure_builds():
    _, chart, deadline, min_date, num_weeks = _chart()
    fig = build_gantt_figure(chart, min_date, num_weeks, deadline)
    assert len(fig.data) == 2  # one trace per phase


def test_csv_exports():
    df, *_ = _chart()
    assert phase_schedule_csv(df).startswith(b"Order,")
    sprints = pd.DataFrame([{"Sprint": "Sprint 1", "Name": "x", "Status": "To-Do"}])
    assert sprint_board_csv(sprints).startswith(b"Name,")


def test_excel_is_valid_xlsx():
    _, chart, _, min_date, num_weeks = _chart()
    data = excel_gantt(chart, min_date, num_weeks).getvalue()
    assert "xl/workbook.xml" in zipfile.ZipFile(io.BytesIO(data)).namelist()


def test_pptx_has_one_slide():
    from pptx import Presentation
    _, chart, _, min_date, num_weeks = _chart()
    prs = Presentation(pptx_gantt(chart, min_date, num_weeks))
    assert len(prs.slides) == 1