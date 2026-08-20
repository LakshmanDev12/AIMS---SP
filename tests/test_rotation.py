"""
Tests: credential rotation.

Key invariant: after rotation, the OLD token must be rejected and the
NEW token must work — immediately, without waiting for JWT expiry.
"""
import pytest
from tests.conftest import register_agent, auth_header


def test_rotation_invalidates_old_token(client):
    """Old token is rejected immediately after rotation."""
    agent_id, old_token = register_agent(client, "RotateBot", ["read"])

    # Rotate — must present current token
    rot_resp = client.post(
        "/credentials/rotate",
        json={"agent_id": agent_id},
        headers=auth_header(old_token),
    )
    assert rot_resp.status_code == 200
    new_token = rot_resp.json()["token"]

    # Old token must now be rejected
    old_resp = client.get("/reports", headers=auth_header(old_token))
    assert old_resp.status_code == 401

    # New token must work
    new_resp = client.get("/reports", headers=auth_header(new_token))
    assert new_resp.status_code == 200


def test_rotation_returns_new_credential_id(client):
    agent_id, token = register_agent(client, "RotateMeta", ["read"])
    resp = client.post(
        "/credentials/rotate",
        json={"agent_id": agent_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_id"] == agent_id
    assert "credential_id" in data
    assert data["credential_id"].startswith("CRED-")
    assert "token" in data
    assert "expires_at" in data


def test_rotation_without_token_rejected(client):
    """Rotation endpoint now requires a bearer token."""
    agent_id, _ = register_agent(client, "UnauthRotate", ["read"])
    resp = client.post("/credentials/rotate", json={"agent_id": agent_id})
    assert resp.status_code == 403


def test_agent_cannot_rotate_another_agents_credential(client):
    """A non-admin agent may only rotate its own credential."""
    agent_a_id, token_a = register_agent(client, "AgentA", ["read"])
    agent_b_id, token_b = register_agent(client, "AgentB", ["read"])

    # Agent A tries to rotate Agent B's credential
    resp = client.post(
        "/credentials/rotate",
        json={"agent_id": agent_b_id},
        headers=auth_header(token_a),
    )
    assert resp.status_code == 403


def test_admin_can_rotate_any_agents_credential(client):
    """Admin-scoped agent may rotate any agent's credential."""
    agent_id, _ = register_agent(client, "TargetBot", ["read"])
    _, admin_token = register_agent(client, "AdminBot", ["admin"])

    resp = client.post(
        "/credentials/rotate",
        json={"agent_id": agent_id},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200


def test_credential_history_endpoint(client):
    """GET /credentials/{agent_id} returns credential history."""
    agent_id, token = register_agent(client, "HistoryBot", ["read"])
    # Rotate once to create history
    client.post(
        "/credentials/rotate",
        json={"agent_id": agent_id},
        headers=auth_header(token),
    )
    resp = client.get(f"/credentials/{agent_id}")
    assert resp.status_code == 200
    creds = resp.json()
    assert len(creds) == 2  # original + rotated
    statuses = {c["status"] for c in creds}
    assert "rotated" in statuses
    assert "active" in statuses
