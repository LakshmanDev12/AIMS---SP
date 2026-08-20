import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


def generate_log_id() -> str:
    return f"LOG-{uuid.uuid4().hex[:10].upper()}"


class AuditLog(Base):
    """
    Immutable trail of everything that happens to an agent identity:
    registration, credential issuance/rotation, access attempts (allow/deny),
    suspension, revocation, decommissioning.
    """
    __tablename__ = "audit_logs"

    log_id = Column(String, primary_key=True, default=generate_log_id)
    agent_id = Column(String, ForeignKey("agents.agent_id"), nullable=True, index=True)

    action = Column(String, nullable=False)      # e.g. "REGISTER", "ACCESS_ATTEMPT", "ROTATE", "REVOKE"
    result = Column(String, nullable=False)       # "SUCCESS" | "DENIED" | "ERROR"
    reason = Column(String, nullable=True)

    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    agent = relationship("Agent", back_populates="audit_logs")
