"""
Auto-revocation of long-idle stale agents, credential revocation,
and the shared audit-logging helper used across the app.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.agent import Agent, AgentStatus
from app.models.credential import Credential, CredentialStatus
from app.models.audit import AuditLog
from app.utils import as_aware


def log_action(db: Session, agent_id: str | None, action: str, result: str, reason: str | None = None) -> None:
    entry = AuditLog(agent_id=agent_id, action=action, result=result, reason=reason)
    db.add(entry)
    db.commit()


def revoke_agent_credentials(db: Session, agent: Agent) -> int:
    """
    Mark every ACTIVE credential for an agent REVOKED.
    Returns count revoked.
    NOTE: Does NOT commit — callers are responsible for committing their
    own transaction after calling this function.
    """
    active_creds = (
        db.query(Credential)
        .filter(Credential.agent_id == agent.agent_id, Credential.status == CredentialStatus.ACTIVE)
        .all()
    )
    for c in active_creds:
        c.status = CredentialStatus.REVOKED
    return len(active_creds)


def auto_revoke_stale_agents(db: Session) -> list[str]:
    """
    Agents that have been STALE for longer than AUTO_REVOKE_THRESHOLD_DAYS
    (measured from their last activity) are automatically revoked:
    status -> REVOKED, all active credentials killed, audit-logged.
    Returns the list of agent_ids that were revoked.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.AUTO_REVOKE_THRESHOLD_DAYS)
    revoked_ids = []

    stale_agents = db.query(Agent).filter(Agent.status == AgentStatus.STALE).all()
    for agent in stale_agents:
        reference_time = agent.last_api_call or agent.creation_date
        if reference_time and as_aware(reference_time) < cutoff:
            agent.status = AgentStatus.REVOKED
            n = revoke_agent_credentials(db, agent)
            db.commit()
            log_action(
                db,
                agent.agent_id,
                action="AUTO_REVOKE",
                result="SUCCESS",
                reason=f"Inactive beyond {settings.AUTO_REVOKE_THRESHOLD_DAYS} days; {n} credential(s) revoked",
            )
            from app.services.notification_service import create_notification
            from app.models.notification import NotificationCategory, NotificationSeverity
            create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.UNUSED_AGENT,
                severity=NotificationSeverity.CRITICAL,
                title=f"Unused Agent Auto-Revoked: {agent.agent_name}",
                message=f"Agent '{agent.agent_name}' ({agent.agent_id}) was auto-revoked due to {settings.AUTO_REVOKE_THRESHOLD_DAYS}+ days inactivity.",
            )
            revoked_ids.append(agent.agent_id)

    return revoked_ids
