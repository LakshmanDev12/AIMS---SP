"""
Tests: agent lifecycle — suspend, reactivate, decommission.
All lifecycle actions require admin scope.
"""
import pytest
from tests.conftest import register_agent, auth_header


@pytest.fixture
def admin_token(client):
    """Register an admin-scoped agent and return its token."""
    _, token = register_agent(client, "AdminOps", ["admin"])
    return token


# ---------------------------------------------------------------------------
# Suspend
# ---------------------------------------------------------------------------

def test_suspend_blocks_api_calls(client, admin_token):
    agent_id, token = register_agent(client, "SuspendMe", ["read"])

    resp = client.post(f"/agents/suspend/{agent_id}", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"

    # Token still valid JWT, but agent is suspended → 403
    api_resp = client.get("/reports", headers=auth_header(token))
    assert api_resp.status_code == 403


def test_suspend_requires_admin(client):
    agent_id, _ = register_agent(client, "SuspendTarget", ["read"])
    _, read_token = register_agent(client, "ReadOnlyCaller", ["read"])

    resp = client.post(f"/agents/suspend/{agent_id}", headers=auth_header(read_token))
    assert resp.status_code == 403


def test_suspend_nonexistent_agent_returns_404(client, admin_token):
    resp = client.post("/agents/suspend/AID-NONEXIST", headers=auth_header(admin_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Reactivate
# ---------------------------------------------------------------------------

def test_reactivate_issues_new_token(client, admin_token):
    agent_id, old_token = register_agent(client, "ReactivateMe", ["read"])

    # Suspend first
    client.post(f"/agents/suspend/{agent_id}", headers=auth_header(admin_token))
    # Old token blocked
    assert client.get("/reports", headers=auth_header(old_token)).status_code == 403

    # Reactivate — get a new token
    react_resp = client.post(f"/agents/reactivate/{agent_id}", headers=auth_header(admin_token))
    assert react_resp.status_code == 200
    new_token = react_resp.json()["token"]

    # New token works
    assert client.get("/reports", headers=auth_header(new_token)).status_code == 200


def test_reactivate_revoked_agent_fails(client, admin_token):
    agent_id, _ = register_agent(client, "RevokedBot", ["read"])
    client.post(f"/agents/decommission/{agent_id}", headers=auth_header(admin_token))

    resp = client.post(f"/agents/reactivate/{agent_id}", headers=auth_header(admin_token))
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Decommission
# ---------------------------------------------------------------------------

def test_decommission_revokes_credentials(client, admin_token):
    agent_id, token = register_agent(client, "DecommissionMe", ["read"])

    resp = client.post(f"/agents/decommission/{agent_id}", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "decommissioned"

    # Token no longer valid
    api_resp = client.get("/reports", headers=auth_header(token))
    assert api_resp.status_code in (401, 403)


def test_decommission_requires_admin(client):
    agent_id, _ = register_agent(client, "DecommTarget", ["read"])
    _, write_token = register_agent(client, "WriteCaller", ["write"])

    resp = client.post(f"/agents/decommission/{agent_id}", headers=auth_header(write_token))
    assert resp.status_code == 403


def test_audit_log_records_lifecycle_events(client, admin_token):
    agent_id, _ = register_agent(client, "AuditTrailBot", ["read"])
    client.post(f"/agents/suspend/{agent_id}", headers=auth_header(admin_token))
    client.post(f"/agents/reactivate/{agent_id}", headers=auth_header(admin_token))

    logs_resp = client.get(f"/audit-logs?agent_id={agent_id}")
    assert logs_resp.status_code == 200
    actions = [l["action"] for l in logs_resp.json()]
    assert "REGISTER" in actions
    assert "SUSPEND" in actions
    assert "REACTIVATE" in actions
