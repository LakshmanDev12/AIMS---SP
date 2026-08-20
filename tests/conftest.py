"""
Shared fixtures for the AIMS test suite.

Approach: Set DATABASE_URL to an in-memory SQLite instance via environment
variable BEFORE the app modules are imported. This ensures the app's own
engine, SessionLocal, and Base.metadata all point to the test database.
"""
import os

# Must be set before any app imports so app.config / app.database pick it up
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DEBUG"] = "true"

import pytest
from fastapi.testclient import TestClient

# Now safe to import app modules — they'll use the in-memory URL
from app.database import Base, engine, SessionLocal, get_db
from app.main import app


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """
    Create all tables on the in-memory engine before each test,
    then drop them after to guarantee test isolation.
    """
    from app.models import agent, credential, audit  # noqa: F401 — register models
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(setup_db):
    """Yield a DB session bound to the in-memory test engine."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(setup_db):
    """
    FastAPI TestClient.
    The app already uses the in-memory engine (set via env var above),
    so no dependency override is needed.
    """
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def register_agent(client: TestClient, name: str, scopes: list[str], **kwargs) -> tuple[str, str]:
    """Register an agent and return (agent_id, token)."""
    payload = {
        "agent_name": name,
        "purpose": kwargs.get("purpose", f"{name} test agent"),
        "owning_team": kwargs.get("owning_team", "TestTeam"),
        "scopes": scopes,
    }
    resp = client.post("/agents/register", json=payload)
    assert resp.status_code == 201, f"Registration failed ({resp.status_code}): {resp.text}"
    data = resp.json()
    return data["agent_id"], data["token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
