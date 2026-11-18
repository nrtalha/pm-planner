"""Create a plan: generate one from a SOW PDF (Claude Code) or reopen a saved plan.json."""
from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from planner.claude_runner import ClaudeCodeError, generate_plan

from ..schemas import OpenPlanRequest, PlanState
from ..state import build_plan_state, restore_plan_state

router = APIRouter(prefix="/api/plans", tags=["plans"])

MAX_PDF_BYTES = 50 * 1024 * 1024


@router.post("/generate", response_model=PlanState)
def generate(
    file: UploadFile = File(..., description="SOW or charter as a PDF"),
    start_date: date = Form(...),
    target_weeks: float = Form(0, ge=0, le=104, description="0 keeps the SOW's own timeline"),
) -> PlanState:
    # Sync endpoint on purpose: FastAPI runs it in a worker thread, so the
    # 30-60 s Claude Code call does not block other requests.
    data = file.file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "The PDF is larger than 50 MB.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a PDF file.")
    try:
        project = generate_plan(data, target_weeks)
    except ClaudeCodeError as err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err)) from err
    return build_plan_state(project, start_date)


@router.post("/open", response_model=PlanState)
def open_plan(request: OpenPlanRequest) -> PlanState:
    """Reopen a plan.json. Saved web-app plans come back exactly as edited; original
    (Streamlit-era) plans are laid out from scratch. Invalid files are rejected with 422."""
    if request.saved is not None:
        return restore_plan_state(request.saved)
    return build_plan_state(request.plan, request.start_date)
