"""
Tests: scope enforcement — the four-layer require_scope() dependency.

Mirrors the Phase 6 success criteria exactly, plus edge-case auth failures.
"""
import pytest
from tests.conftest import register_agent, auth_header


# ---------------------------------------------------------------------------
# Phase 6 success-criteria cases
# ---------------------------------------------------------------------------

def test_finance_bot_can_read(client):
    """FinanceBot (read) → GET /reports → 200."""
    _, token = register_agent(client, "FinanceBot", ["read"])
    resp = client.get("/reports", headers=auth_header(token))
    assert resp.status_code == 200


def test_finance_bot_denied_write(client):
    """FinanceBot (read) → POST /reports → 403."""
    _, token = register_agent(client, "FinanceBot", ["read"])
    resp = client.post("/reports", headers=auth_header(token))
    assert resp.status_code == 403


def test_hr_bot_can_write(client):
    """HRBot (read, write) → POST /reports → 200."""
    _, token = register_agent(client, "HRBot", ["read", "write"])
    resp = client.post("/reports", headers=auth_header(token))
    assert resp.status_code == 200


def test_audit_bot_can_admin(client):
    """AuditBot (admin) → GET /admin/settings → 200."""
    _, token = register_agent(client, "AuditBot", ["admin"])
    resp = client.get("/admin/settings", headers=auth_header(token))
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Auth failure cases
# ---------------------------------------------------------------------------

def test_no_token_returns_403(client):
    resp = client.get("/reports")
    assert resp.status_code == 403


def test_invalid_token_returns_401(client):
    resp = client.get("/reports", headers={"Authorization": "Bearer not.a.real.token"})
    assert resp.status_code == 401


def test_write_scope_cannot_access_admin(client):
    _, token = register_agent(client, "WriterBot", ["write"])
    resp = client.get("/admin/settings", headers=auth_header(token))
    assert resp.status_code == 403


def test_admin_scope_can_read_and_write_and_admin(client):
    """Admin agents have all privilege levels."""
    _, token = register_agent(client, "SuperBot", ["admin"])
    assert client.get("/reports", headers=auth_header(token)).status_code == 200
    assert client.post("/reports", headers=auth_header(token)).status_code == 200
    # Admin scope only grants /admin — read/write are separate scopes
    # (SuperBot doesn't have read/write explicitly — but admin is its own scope)
    # Adjust expectation: admin scope only satisfies "admin" guard
    assert client.get("/admin/settings", headers=auth_header(token)).status_code == 200
