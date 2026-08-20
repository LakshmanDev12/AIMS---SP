import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class AgentStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    STALE = "stale"
    REVOKED = "revoked"
    DECOMMISSIONED = "decommissioned"


def generate_agent_id() -> str:
    return f"AID-{uuid.uuid4().hex[:8].upper()}"


class Agent(Base):
    """
    The Agent Identity Card — the core record described in PS-2.1.
    Represents a single non-human (AI agent) identity in the system.
    """
    __tablename__ = "agents"

    agent_id = Column(String, primary_key=True, default=generate_agent_id)
    agent_name = Column(String, nullable=False, index=True)
    purpose = Column(String, nullable=True)
    owning_team = Column(String, nullable=True, index=True)

    # Comma-separated scope list, e.g. "read,write"
    approved_scopes = Column(String, nullable=False, default="")

    status = Column(Enum(AgentStatus), default=AgentStatus.ACTIVE, nullable=False, index=True)

    creation_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expiry_date = Column(DateTime, nullable=True)
    last_api_call = Column(DateTime, nullable=True)

    # Simple 0-100 risk score, recalculated by the risk scoring service
    risk_score = Column(Integer, default=0)

    credentials = relationship("Credential", back_populates="agent", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="agent", cascade="all, delete-orphan")

    def scopes_list(self) -> list[str]:
        return [s.strip() for s in (self.approved_scopes or "").split(",") if s.strip()]
