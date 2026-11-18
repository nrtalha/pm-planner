"""Export files, built by the same planner functions the Streamlit app uses."""
from fastapi import APIRouter, HTTPException, Response, status

from planner.exporters import (
    excel_gantt,
    gantt_figure_json,
    phase_schedule_csv,
    pptx_gantt,
    prepare_chart_df,
    sprint_board_csv,
    week_axis,
)
from planner.schedule import deadline_date

from ..schemas import ExportKind, ExportRequest, PlanFile, SavedSchedule
from ..state import phase_frame, sprint_frame

router = APIRouter(prefix="/api/exports", tags=["exports"])

FILES: dict[str, tuple[str, str]] = {
    "phase-csv": ("phase_schedule.csv", "text/csv"),
    "sprint-csv": ("sprint_distribution.csv", "text/csv"),
    "xlsx": ("gantt_grid.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "pptx": ("editable_gantt.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    "plan-json": ("plan.json", "application/json"),
}


def _chart_inputs(req: ExportRequest):
    chart_df = prepare_chart_df(phase_frame(req.phases))
    if chart_df.empty:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Add at least one phase with a start date and duration to export the Gantt chart.")
    deadline = deadline_date(req.start_date, req.project.agreed_timeline_weeks)
    min_date, num_weeks = week_axis(chart_df, req.start_date, deadline)
    return chart_df, min_date, num_weeks, deadline


def _build(kind: str, req: ExportRequest) -> bytes:
    if kind == "phase-csv":
        return phase_schedule_csv(phase_frame(req.phases))
    if kind == "sprint-csv":
        return sprint_board_csv(sprint_frame(req.tasks))
    if kind == "plan-json":
        saved = PlanFile(
            name=req.name, plan=req.project,
            schedule=SavedSchedule(start_date=req.start_date, phases=req.phases,
                                   sprints=req.sprints, tasks=req.tasks),
        )
        return saved.model_dump_json(indent=2).encode("utf-8")
    chart_df, min_date, num_weeks, _ = _chart_inputs(req)
    if kind == "xlsx":
        return excel_gantt(chart_df, min_date, num_weeks).getvalue()
    return pptx_gantt(chart_df, min_date, num_weeks).getvalue()


@router.post("/gantt-figure")
def gantt_figure(request: ExportRequest) -> Response:
    """Plotly figure JSON; the web app turns it into Project_Phase_Schedule.png (3x)."""
    chart_df, min_date, num_weeks, deadline = _chart_inputs(request)
    return Response(content=gantt_figure_json(chart_df, min_date, num_weeks, deadline),
                    media_type="application/json")


@router.post("/{kind}")
def export(kind: ExportKind, request: ExportRequest) -> Response:
    filename, media_type = FILES[kind]
    return Response(
        content=_build(kind, request),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
