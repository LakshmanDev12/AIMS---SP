"""
Tests: stale-agent detection and auto-revocation.

We manually back-date agent activity timestamps in the DB to simulate
agents that have been idle past the configured thresholds.
"""
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.agent import Agent, AgentStatus
from app.models.credential import Credential, CredentialStatus
from tests.conftest import register_agent, auth_header


def _backdate_agent(db: Session, agent_id: str, days: int):
    """Set last_api_call and creation_date to `days` ago."""
    past = datetime.now(timezone.utc) - timedelta(days=days)
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    agent.last_api_call = past
    agent.creation_date = past
    db.commit()


def test_stale_detection_flags_idle_agent(client, db_session):
    """An agent idle past STALE_THRESHOLD_DAYS should be marked stale."""
    agent_id, _ = register_agent(client, "StaleBot", ["read"])
    _backdate_agent(db_session, agent_id, days=31)  # past default 30-day threshold

    resp = client.post("/reviews/detect-stale")
    assert resp.status_code == 200
    data = resp.json()
    assert agent_id in data["agent_ids"]

    # Confirm DB status updated
    agent = db_session.query(Agent).filter(Agent.agent_id == agent_id).first()
    db_session.refresh(agent)
    assert agent.status == AgentStatus.STALE


def test_recently_active_agent_not_stale(client, db_session):
    """An agent active within the threshold should stay ACTIVE."""
    agent_id, token = register_agent(client, "FreshBot", ["read"])
    # Make an API call to stamp last_api_call
    client.get("/reports", headers=auth_header(token))

    resp = client.post("/reviews/detect-stale")
    assert resp.status_code == 200
    assert agent_id not in resp.json()["agent_ids"]


def test_auto_revoke_revokes_long_stale_agent(client, db_session):
    """An agent idle past AUTO_REVOKE_THRESHOLD_DAYS should be auto-revoked."""
    agent_id, token = register_agent(client, "RevokeMeBot", ["read"])
    _backdate_agent(db_session, agent_id, days=91)  # past default 90-day auto-revoke threshold

    # First mark as stale
    client.post("/reviews/detect-stale")

    # Then auto-revoke
    resp = client.post("/reviews/auto-revoke")
    assert resp.status_code == 200
    assert agent_id in resp.json()["agent_ids"]

    # Token must no longer work
    api_resp = client.get("/reports", headers=auth_header(token))
    assert api_resp.status_code in (401, 403)

    # DB status must be REVOKED
    agent = db_session.query(Agent).filter(Agent.agent_id == agent_id).first()
    db_session.refresh(agent)
    assert agent.status == AgentStatus.REVOKED

    # Credential must be REVOKED
    cred = (
        db_session.query(Credential)
        .filter(Credential.agent_id == agent_id)
        .first()
    )
    db_session.refresh(cred)
    assert cred.status == CredentialStatus.REVOKED


def test_stale_not_yet_auto_revoked_within_window(client, db_session):
    """Agent idle 31 days is stale but NOT auto-revoked (threshold is 90 days)."""
    agent_id, token = register_agent(client, "StaleNotRevoked", ["read"])
    _backdate_agent(db_session, agent_id, days=31)

    client.post("/reviews/detect-stale")
    resp = client.post("/reviews/auto-revoke")
    assert agent_id not in resp.json()["agent_ids"]

    agent = db_session.query(Agent).filter(Agent.agent_id == agent_id).first()
    db_session.refresh(agent)
    assert agent.status == AgentStatus.STALE  # flagged but not revoked


def test_quarterly_report_contains_stale_agents(client, db_session):
    """Stale agents appear in the quarterly report."""
    agent_id, _ = register_agent(client, "QReportBot", ["read"])
    _backdate_agent(db_session, agent_id, days=45)
    client.post("/reviews/detect-stale")

    resp = client.get("/reviews/quarterly")
    assert resp.status_code == 200
    data = resp.json()
    stale_ids = [a["agent_id"] for a in data["stale_agents"]]
    assert agent_id in stale_ids
