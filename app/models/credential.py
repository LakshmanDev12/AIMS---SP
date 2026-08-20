import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class CredentialStatus(str, enum.Enum):
    ACTIVE = "active"
    ROTATED = "rotated"
    REVOKED = "revoked"
    EXPIRED = "expired"


def generate_credential_id() -> str:
    return f"CRED-{uuid.uuid4().hex[:10].upper()}"


class Credential(Base):
    """
    A scoped credential (JWT) issued to an Agent.
    We never store the raw token — only its hash — so a DB leak
    can't be used to impersonate an agent.
    """
    __tablename__ = "credentials"

    credential_id = Column(String, primary_key=True, default=generate_credential_id)
    agent_id = Column(String, ForeignKey("agents.agent_id"), nullable=False, index=True)

    token_hash = Column(String, nullable=False)
    issued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    status = Column(Enum(CredentialStatus), default=CredentialStatus.ACTIVE, nullable=False, index=True)

    agent = relationship("Agent", back_populates="credentials")
