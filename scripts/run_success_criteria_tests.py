"""
End-to-end test matching Phase 6 exactly:

    FinanceBot Read   -> Pass
    FinanceBot Write  -> Denied
    HRBot Write       -> Pass
    AuditBot Admin    -> Pass

Prerequisite: the API must be running (uvicorn app.main:app --reload)
on http://127.0.0.1:8000.

Usage:
    python -m scripts.run_success_criteria_tests
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

BASE_URL = "http://127.0.0.1:8000"


def register(agent_name, purpose, team, scopes):
    r = requests.post(f"{BASE_URL}/agents/register", json={
        "agent_name": agent_name, "purpose": purpose, "owning_team": team, "scopes": scopes,
    })
    r.raise_for_status()
    return r.json()


def call(method, path, token):
    headers = {"Authorization": f"Bearer {token}"}
    return requests.request(method, f"{BASE_URL}{path}", headers=headers)


def check(label, expected_pass, response):
    passed = response.status_code < 300
    status = "PASS" if passed == expected_pass else "FAIL"
    print(f"[{status}] {label} -> HTTP {response.status_code} (expected {'Pass' if expected_pass else 'Denied'})")


def main():
    finance = register("FinanceBot", "Financial Reporting", "Finance", ["read"])
    hr = register("HRBot", "HR Records", "HR", ["read", "write"])
    audit = register("AuditBot", "Internal Audit", "Audit", ["admin"])

    print("\nRegistered:")
    print(" FinanceBot:", finance["agent_id"])
    print(" HRBot:     ", hr["agent_id"])
    print(" AuditBot:  ", audit["agent_id"])
    print()

    check("FinanceBot Read", True, call("GET", "/reports", finance["token"]))
    check("FinanceBot Write", False, call("POST", "/reports", finance["token"]))
    check("HRBot Write", True, call("POST", "/reports", hr["token"]))
    check("AuditBot Admin", True, call("GET", "/admin/settings", audit["token"]))


if __name__ == "__main__":
    main()
