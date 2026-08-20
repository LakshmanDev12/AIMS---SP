from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.models.agent import Agent, AgentStatus
from app.models.notification import Notification, NotificationCategory, NotificationSeverity
from app.utils import now_utc


def create_notification(
    db: Session,
    title: str,
    message: str,
    category: NotificationCategory = NotificationCategory.SYSTEM,
    severity: NotificationSeverity = NotificationSeverity.INFO,
    agent_id: Optional[str] = None,
    meta_data: Optional[str] = None,
    prevent_recent_duplicate_minutes: int = 60,
) -> Notification:
    """
    Creates and saves a notification. Optionally avoids creating duplicates
    if a matching unread notification for the same agent & title was created recently.
    """
    if prevent_recent_duplicate_minutes > 0 and agent_id:
        cutoff = now_utc() - timedelta(minutes=prevent_recent_duplicate_minutes)
        existing = (
            db.query(Notification)
            .filter(
                Notification.agent_id == agent_id,
                Notification.title == title,
                Notification.is_read == False,
                Notification.created_at >= cutoff,
            )
            .first()
        )
        if existing:
            return existing

    notification = Notification(
        agent_id=agent_id,
        category=category,
        severity=severity,
        title=title,
        message=message,
        is_read=False,
        created_at=now_utc(),
        meta_data=meta_data,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def generate_governance_notifications(db: Session) -> int:
    """
    Sweeps the agent database and generates notifications for both:
    1. Unused AI Agents (Stale, Auto-Revoked, Approaching Stale, Idle High-Privilege)
    2. Currently Active AI Agents (Active Usage, Elevated Risk, Token Rotations)

    Returns the number of new notifications generated.
    """
    now = now_utc()
    created_count = 0
    agents = db.query(Agent).all()

    for agent in agents:
        # Check inactive interval
        last_active = agent.last_api_call or agent.creation_date
        idle_days = (now - last_active.replace(tzinfo=timezone.utc)).days if last_active else 0

        # --- 1. UNUSED AI AGENT NOTIFICATIONS ---
        if agent.status == AgentStatus.STALE:
            note = create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.UNUSED_AGENT,
                severity=NotificationSeverity.WARNING,
                title=f"Unused Agent Alert: {agent.agent_name} is Stale",
                message=(
                    f"AI Agent '{agent.agent_name}' ({agent.agent_id}) owned by team '{agent.owning_team}' "
                    f"has been inactive for {idle_days} days ($\ge {settings.STALE_THRESHOLD_DAYS}$ days threshold). "
                    f"Consider reviewing or revoking its credentials."
                ),
                prevent_recent_duplicate_minutes=720,  # Once every 12 hours
            )
            if note:
                created_count += 1

        elif agent.status == AgentStatus.REVOKED:
            note = create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.UNUSED_AGENT,
                severity=NotificationSeverity.CRITICAL,
                title=f"Unused Agent Auto-Revoked: {agent.agent_name}",
                message=(
                    f"AI Agent '{agent.agent_name}' ({agent.agent_id}) was auto-revoked due to prolonged inactivity "
                    f"({idle_days} days idle). All credentials are disabled."
                ),
                prevent_recent_duplicate_minutes=1440,
            )
            if note:
                created_count += 1

        elif agent.status == AgentStatus.ACTIVE and idle_days >= 20 and idle_days < settings.STALE_THRESHOLD_DAYS:
            note = create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.UNUSED_AGENT,
                severity=NotificationSeverity.INFO,
                title=f"Unused Risk Warning: {agent.agent_name} Approaching Stale",
                message=(
                    f"Active AI Agent '{agent.agent_name}' ({agent.agent_id}) has not made API calls for {idle_days} days. "
                    f"It will be marked STALE in {settings.STALE_THRESHOLD_DAYS - idle_days} days if unused."
                ),
                prevent_recent_duplicate_minutes=720,
            )
            if note:
                created_count += 1

        # --- 2. CURRENTLY ACTIVE AI AGENT NOTIFICATIONS ---
        if agent.status == AgentStatus.ACTIVE:
            if agent.risk_score >= 70:
                note = create_notification(
                    db=db,
                    agent_id=agent.agent_id,
                    category=NotificationCategory.ACTIVE_AGENT,
                    severity=NotificationSeverity.WARNING,
                    title=f"Active Agent Risk Spike: {agent.agent_name}",
                    message=(
                        f"Currently active agent '{agent.agent_name}' ({agent.agent_id}) has a high risk score of "
                        f"{agent.risk_score}/100. Approved scopes: [{agent.approved_scopes}]."
                    ),
                    prevent_recent_duplicate_minutes=720,
                )
                if note:
                    created_count += 1

            if idle_days <= 1:
                # Active agent activity notification (Info pulse)
                note = create_notification(
                    db=db,
                    agent_id=agent.agent_id,
                    category=NotificationCategory.ACTIVE_AGENT,
                    severity=NotificationSeverity.INFO,
                    title=f"Active Agent Traffic: {agent.agent_name}",
                    message=(
                        f"Active agent '{agent.agent_name}' ({agent.agent_id}) recently executed API requests. "
                        f"Current status: ACTIVE, Risk score: {agent.risk_score}."
                    ),
                    prevent_recent_duplicate_minutes=1440,
                )
                if note:
                    created_count += 1

    return created_count


def get_notifications(
    db: Session,
    category: Optional[NotificationCategory] = None,
    severity: Optional[NotificationSeverity] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:
    query = db.query(Notification)

    if category:
        query = query.filter(Notification.category == category)
    if severity:
        query = query.filter(Notification.severity == severity)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    return query.order_by(desc(Notification.created_at)).offset(offset).limit(limit).all()


def get_notification_summary(db: Session) -> dict:
    total_unread = db.query(Notification).filter(Notification.is_read == False).count()
    total_notifications = db.query(Notification).count()
    unused_agent_alerts = db.query(Notification).filter(Notification.category == NotificationCategory.UNUSED_AGENT).count()
    active_agent_alerts = db.query(Notification).filter(Notification.category == NotificationCategory.ACTIVE_AGENT).count()
    security_alerts = db.query(Notification).filter(Notification.category == NotificationCategory.SECURITY).count()

    return {
        "total_unread": total_unread,
        "total_notifications": total_notifications,
        "unused_agent_alerts": unused_agent_alerts,
        "active_agent_alerts": active_agent_alerts,
        "security_alerts": security_alerts,
    }


def mark_as_read(db: Session, notification_id: int) -> Optional[Notification]:
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_as_read(db: Session, category: Optional[NotificationCategory] = None) -> int:
    query = db.query(Notification).filter(Notification.is_read == False)
    if category:
        query = query.filter(Notification.category == category)
    
    updated = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return updated
