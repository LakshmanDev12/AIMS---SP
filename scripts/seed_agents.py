"""
Creates the 3 agents required by Phase 6 success-criteria testing:
  FinanceBot -> read
  HRBot      -> read,write
  AuditBot   -> admin

Run from the project root:
    python -m scripts.seed_agents
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, init_db
from app.models.agent import Agent, AgentStatus
from app.services.token_service import issue_credential

AGENTS = [
    {"agent_name": "FinanceBot", "purpose": "Financial Reporting", "owning_team": "Finance", "scopes": ["read"]},
    {"agent_name": "HRBot", "purpose": "HR Records Management", "owning_team": "HR", "scopes": ["read", "write"]},
    {"agent_name": "AuditBot", "purpose": "Internal Audit", "owning_team": "Audit", "scopes": ["admin"]},
]


def main():
    init_db()
    db = SessionLocal()
    try:
        print(f"{'Agent':<12} {'Agent ID':<20} Token")
        print("-" * 100)
        for spec in AGENTS:
            agent = Agent(
                agent_name=spec["agent_name"],
                purpose=spec["purpose"],
                owning_team=spec["owning_team"],
                approved_scopes=",".join(spec["scopes"]),
                status=AgentStatus.ACTIVE,
            )
            db.add(agent)
            db.commit()
            db.refresh(agent)

            _, token = issue_credential(db, agent)
            print(f"{spec['agent_name']:<12} {agent.agent_id:<20} {token}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
