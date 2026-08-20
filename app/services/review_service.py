"""
Governance logic: stale-agent detection, quarterly review reporting,
and a lightweight risk score used by the governance dashboard.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.agent import Agent, AgentStatus
from app.models.credential import Credential, CredentialStatus
from app.utils import as_aware


from app.services.notification_service import create_notification
from app.models.notification import NotificationCategory, NotificationSeverity


def detect_stale_agents(db: Session) -> list[Agent]:
    """
    Mark ACTIVE agents whose last_api_call is older than STALE_THRESHOLD_DAYS
    (or who have never made a call and whose creation_date is past that window)
    as STALE. Returns the list of agents just flagged.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.STALE_THRESHOLD_DAYS)
    newly_stale = []

    candidates = db.query(Agent).filter(Agent.status == AgentStatus.ACTIVE).all()
    for agent in candidates:
        reference_time = agent.last_api_call or agent.creation_date
        if reference_time and as_aware(reference_time) < cutoff:
            agent.status = AgentStatus.STALE
            newly_stale.append(agent)
            create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.UNUSED_AGENT,
                severity=NotificationSeverity.WARNING,
                title=f"Unused Agent Flagged Stale: {agent.agent_name}",
                message=f"Agent '{agent.agent_name}' ({agent.agent_id}) was inactive beyond {settings.STALE_THRESHOLD_DAYS} days and marked STALE.",
            )

    if newly_stale:
        db.commit()
    return newly_stale


def compute_risk_score(agent: Agent) -> int:
    """
    Simple, explainable 0-100 risk score. Higher = riskier.

    Breakdown:
      - Scope breadth : admin=40, write=20, read=5
      - Status        : stale=+30, suspended=+10, revoked/decommissioned=+0
      - Idle time     : +2 per 10 days idle, capped at +20
      - Never used    : +10 if last_api_call is None
    """
    score = 0
    scopes = agent.scopes_list()

    if "admin" in scopes:
        score += 40
    elif "write" in scopes:
        score += 20
    else:
        score += 5

    if agent.status == AgentStatus.STALE:
        score += 30
    elif agent.status == AgentStatus.SUSPENDED:
        score += 10
    # REVOKED / DECOMMISSIONED agents are already neutralized — no extra penalty

    now = datetime.now(timezone.utc)
    if agent.last_api_call:
        idle_days = (now - as_aware(agent.last_api_call)).days
        score += min(idle_days // 10, 20)
    else:
        score += 10  # never used yet

    return max(0, min(100, score))


def refresh_risk_scores(db: Session) -> None:
    """Recalculate and persist risk scores for all agents."""
    agents = db.query(Agent).all()
    for agent in agents:
        agent.risk_score = compute_risk_score(agent)
    db.commit()


def build_quarterly_report(db: Session) -> dict:
    """
    Aggregate governance report: per-status counts, stale agents, agents with
    no credential rotation in the review period, and top risk agents.

    NOTE: Does NOT call refresh_risk_scores internally — callers decide when
    to refresh. This keeps GET /reviews/quarterly cheap (read-only).
    """
    agents = db.query(Agent).all()
    by_status: dict[str, int] = {}
    for agent in agents:
        by_status[agent.status.value] = by_status.get(agent.status.value, 0) + 1

    stale_agents = [a for a in agents if a.status == AgentStatus.STALE]

    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    never_rotated = []
    for agent in agents:
        creds = (
            db.query(Credential)
            .filter(Credential.agent_id == agent.agent_id)
            .order_by(Credential.issued_at.asc())
            .all()
        )
        if len(creds) <= 1 and agent.creation_date and as_aware(agent.creation_date) < ninety_days_ago:
            never_rotated.append(agent)

    top_risk = sorted(agents, key=lambda a: a.risk_score, reverse=True)[:10]

    risk_distribution = {
        "low": sum(1 for a in agents if a.risk_score <= 25),
        "guarded": sum(1 for a in agents if 26 <= a.risk_score <= 50),
        "moderate": sum(1 for a in agents if 51 <= a.risk_score <= 75),
        "critical": sum(1 for a in agents if a.risk_score >= 76),
    }
    avg_risk = round(sum(a.risk_score for a in agents) / len(agents)) if agents else 15
    governance_health = max(0, min(100, 100 - avg_risk)) if agents else 100

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_agents": len(agents),
        "by_status": by_status,
        "governance_health": governance_health,
        "risk_distribution": risk_distribution,
        "stale_agents": [
            {"agent_id": a.agent_id, "agent_name": a.agent_name, "risk_score": a.risk_score}
            for a in stale_agents
        ],
        "agents_without_rotation_90d": [
            {"agent_id": a.agent_id, "agent_name": a.agent_name}
            for a in never_rotated
        ],
        "top_risk_agents": [
            {
                "agent_id": a.agent_id,
                "agent_name": a.agent_name,
                "risk_score": a.risk_score,
                "status": a.status.value,
                "owning_team": a.owning_team,
            }
            for a in top_risk
        ],
    }
