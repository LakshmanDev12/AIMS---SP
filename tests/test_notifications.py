"""
Tests: Governance Notification & Alerting Module for Unused and Currently Active AI Agents.
"""
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.agent import Agent, AgentStatus
from app.models.notification import Notification, NotificationCategory, NotificationSeverity
from tests.conftest import register_agent, auth_header
from tests.test_stale_and_revoke import _backdate_agent


def test_notification_sweep_for_unused_and_active_agents(client, db_session):
    """
    Test manual sweep endpoint creates alerts for both unused (stale) and active agents.
    """
    # 1. Register an active agent
    active_id, _ = register_agent(client, "ActiveNotiBot", ["read", "write"])

    # 2. Register an unused/stale agent
    stale_id, _ = register_agent(client, "StaleNotiBot", ["admin"])
    _backdate_agent(db_session, stale_id, days=35)
    client.post("/reviews/detect-stale")

    # 3. Trigger notification alert sweep
    resp = client.post("/notifications/trigger-sweep")
    assert resp.status_code == 200
    data = resp.json()
    assert data["new_notifications_generated"] >= 1

    # 4. Query notifications
    get_resp = client.get("/notifications")
    assert get_resp.status_code == 200
    notifications = get_resp.json()
    assert len(notifications) > 0

    categories = [n["category"] for n in notifications]
    assert "unused_agent" in categories or "active_agent" in categories


def test_scope_denial_generates_security_notification(client, db_session):
    """
    Attempting an unauthorized admin action without scope generates a SECURITY alert.
    """
    agent_id, token = register_agent(client, "LowScopeBot", ["read"])

    # Attempt admin endpoint with read token -> 403
    resp = client.get("/admin/settings", headers=auth_header(token))
    assert resp.status_code == 403

    # Verify notification created
    get_resp = client.get("/notifications?category=security")
    assert get_resp.status_code == 200
    security_notes = get_resp.json()
    assert len(security_notes) >= 1
    assert security_notes[0]["agent_id"] == agent_id
    assert security_notes[0]["severity"] == "critical"


def test_notification_summary_and_mark_read(client, db_session):
    """
    Test summary metrics, marking single notification read, and marking all read.
    """
    agent_id, _ = register_agent(client, "SummaryNotiBot", ["read"])
    _backdate_agent(db_session, agent_id, days=40)
    client.post("/reviews/detect-stale")
    client.post("/notifications/trigger-sweep")

    # Get summary
    sum_resp = client.get("/notifications/summary")
    assert sum_resp.status_code == 200
    summary = sum_resp.json()
    assert summary["total_unread"] >= 1

    # Fetch list
    list_resp = client.get("/notifications?is_read=false")
    notes = list_resp.json()
    first_id = notes[0]["id"]

    # Mark single read
    read_resp = client.put(f"/notifications/{first_id}/read")
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # Mark all read
    all_resp = client.put("/notifications/read-all")
    assert all_resp.status_code == 200
    assert "updated_count" in all_resp.json()

    # Re-verify summary
    sum_resp2 = client.get("/notifications/summary")
    assert sum_resp2.json()["total_unread"] == 0


def test_webhook_test_endpoint(client):
    """
    Test external webhook dispatcher simulation endpoint.
    """
    payload = {
        "target_url": "https://hooks.slack.com/services/TEST/WEBHOOK/123",
        "title": "Unused AI Agent Warning",
        "message": "FinanceBot has been inactive for 45 days."
    }
    resp = client.post("/notifications/test-webhook", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["delivered"] is True
