from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import init_db, SessionLocal
from app.routes import agent_routes, auth_routes, review_routes, notification_routes, sandbox_routes
from app.services.review_service import detect_stale_agents, refresh_risk_scores
from app.services.revoke_service import auto_revoke_stale_agents
from app.services.notification_service import generate_governance_notifications

scheduler = BackgroundScheduler()


def _scheduled_governance_sweep():
    """Runs stale detection -> risk refresh -> auto-revoke -> notification sweep, daily."""
    db = SessionLocal()
    try:
        detect_stale_agents(db)
        refresh_risk_scores(db)
        auto_revoke_stale_agents(db)
        generate_governance_notifications(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.add_job(_scheduled_governance_sweep, "interval", hours=24, id="governance_sweep")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Agent Identity Management System (AIMS)",
    description=(
        "PS-2.1 Agent Identity Card — registration, scoped credentials, "
        "enforcement, rotation, stale detection, auto-revoke, notifications, and audit logging "
        "for AI agent identities."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_routes.router)
app.include_router(auth_routes.router)
app.include_router(review_routes.router)
app.include_router(notification_routes.router)
app.include_router(sandbox_routes.router)


@app.get("/")
def root():
    return {
        "service": "Agent Identity Management System",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
