"""Recalculate the phase schedule after an edit. All date rules live in planner/."""
from fastapi import APIRouter

from planner.schedule import reconcile_phase_rows

from ..schemas import PhaseRow, ScheduleRequest, ScheduleResponse
from ..state import status_for

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.post("", response_model=ScheduleResponse)
def reconcile(request: ScheduleRequest) -> ScheduleResponse:
    rows = reconcile_phase_rows(
        [p.model_dump() for p in request.previous],
        [p.model_dump() for p in request.edited],
    )
    phases = [PhaseRow(**row) for row in rows]
    return ScheduleResponse(phases=phases, status=status_for(request.start_date, request.agreed_weeks, phases))
