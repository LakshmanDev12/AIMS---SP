"""
Tests: agent registration endpoint.
"""
import pytest
from tests.conftest import register_agent


def test_register_returns_201_with_token(client):
    resp = client.post("/agents/register", json={
        "agent_name": "TestBot",
        "purpose": "Testing",
        "owning_team": "QA",
        "scopes": ["read"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "agent_id" in data
    assert "token" in data
    assert data["agent_id"].startswith("AID-")
    assert len(data["token"]) > 20


def test_register_agent_appears_in_list(client):
    agent_id, _ = register_agent(client, "ListBot", ["read"])
    resp = client.get("/agents")
    assert resp.status_code == 200
    ids = [a["agent_id"] for a in resp.json()]
    assert agent_id in ids


def test_register_agent_retrievable_by_id(client):
    agent_id, _ = register_agent(client, "GetBot", ["write"])
    resp = client.get(f"/agents/{agent_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_id"] == agent_id
    assert data["agent_name"] == "GetBot"
    assert data["status"] == "active"
    # approved_scopes is now a list
    assert data["approved_scopes"] == ["write"]


def test_register_invalid_scope_returns_422(client):
    resp = client.post("/agents/register", json={
        "agent_name": "BadBot",
        "scopes": ["superuser"],
    })
    assert resp.status_code == 422


def test_register_empty_scopes_returns_422(client):
    resp = client.post("/agents/register", json={
        "agent_name": "EmptyBot",
        "scopes": [],
    })
    assert resp.status_code == 422


def test_register_missing_name_returns_422(client):
    resp = client.post("/agents/register", json={"scopes": ["read"]})
    assert resp.status_code == 422


def test_register_duplicate_name_is_allowed(client):
    """Agent names are not unique — they're identified by agent_id."""
    _, _ = register_agent(client, "DupBot", ["read"])
    resp = client.post("/agents/register", json={
        "agent_name": "DupBot",
        "scopes": ["write"],
    })
    assert resp.status_code == 201


def test_agents_list_pagination(client):
    for i in range(5):
        register_agent(client, f"PaginateBot{i}", ["read"])
    resp_all = client.get("/agents?skip=0&limit=3")
    assert resp_all.status_code == 200
    assert len(resp_all.json()) == 3

    resp_page2 = client.get("/agents?skip=3&limit=3")
    assert resp_page2.status_code == 200
    assert len(resp_page2.json()) == 2
