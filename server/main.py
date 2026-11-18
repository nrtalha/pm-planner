"""FastAPI app. Run locally only:  uvicorn server.main:app --host 127.0.0.1 --port 8000

The built web app (web/dist, from step 3 onward) is served from "/" when present,
so one process serves both the UI and the API.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routes import exports, plans, schedule

WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(title="SOW & Sprint Architect API", version="1.0.0")
    app.include_router(plans.router)
    app.include_router(schedule.router)
    app.include_router(exports.router)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    if WEB_DIST.is_dir():
        app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
    return app


app = create_app()
