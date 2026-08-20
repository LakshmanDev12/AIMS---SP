import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class NotificationCategory(str, enum.Enum):
    UNUSED_AGENT = "unused_agent"  # Stale, approaching stale, auto-revoked, idle credentials
    ACTIVE_AGENT = "active_agent"  # Active usage, token rotation, high risk score
    SECURITY = "security"          # Scope denial, unauthorized access
    SYSTEM = "system"              # General system governance notifications


class NotificationSeverity(str, enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class Notification(Base):
    """
    Persistent notification model for tracking unused and currently active AI agents.
    Provides governance alerts for admins and dashboard notifications.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String, ForeignKey("agents.agent_id", ondelete="SET NULL"), nullable=True, index=True)

    category = Column(Enum(NotificationCategory), default=NotificationCategory.SYSTEM, nullable=False, index=True)
    severity = Column(Enum(NotificationSeverity), default=NotificationSeverity.INFO, nullable=False, index=True)

    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    meta_data = Column(Text, nullable=True)  # JSON-encoded extra payload if needed

    agent = relationship("Agent", backref="notifications")
