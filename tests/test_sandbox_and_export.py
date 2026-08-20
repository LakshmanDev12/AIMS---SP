"""
Tests: Interactive Security Sandbox and Compliance Export Endpoints.
"""
import pytest
from tests.conftest import register_agent, auth_header


def test_sandbox_simulation_valid_and_unauthorized_scope(client):
    """
    Test sandbox endpoint executing valid and unauthorized scope breaches.
    """
    agent_id, _ = register_agent(client, "SandboxTestBot", ["read"])

    # 1. Valid read simulation -> 200
    resp1 = client.post("/sandbox/simulate", json={"agent_id": agent_id, "simulation_type": "valid_read"})
    assert resp1.status_code == 200
    assert resp1.json()["result"] == "SUCCESS"

    # 2. Unauthorized admin breach simulation -> 403
    resp2 = client.post("/sandbox/simulate", json={"agent_id": agent_id, "simulation_type": "unauthorized_admin"})
    assert resp2.status_code == 200
    assert resp2.json()["result"] == "DENIED"
    assert resp2.json()["security_alert_generated"] is True

    # 3. Token rotation simulation -> 200
    resp3 = client.post("/sandbox/simulate", json={"agent_id": agent_id, "simulation_type": "rotate_token"})
    assert resp3.status_code == 200
    assert "new_credential_id" in resp3.json()


def test_compliance_export_csv_and_json(client):
    """
    Test compliance export endpoints (CSV and JSON).
    """
    register_agent(client, "ExportBot", ["read", "write"])

    # Test CSV export
    csv_resp = client.get("/reviews/export/csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Agent ID,Agent Name" in csv_resp.text

    # Test JSON export
    json_resp = client.get("/reviews/export/json")
    assert json_resp.status_code == 200
    data = json_resp.json()
    assert "compliance_standard" in data
    assert "agents_registry" in data
    assert len(data["agents_registry"]) >= 1
