"""
Issues and verifies scoped JWT credentials for agents.

Design notes:
- The JWT itself carries agent_id + scopes so the scope-checker middleware
  can authorize requests without a DB round trip on every call.
- We store only a SHA-256 hash of the token in the credentials table, so a
  database compromise doesn't hand out usable bearer tokens.
- Rotation issues a brand-new credential row and marks the previous ACTIVE
  credential ROTATED — old tokens stop working immediately.
- The `commit` parameter on issue_credential / rotate_credential lets callers
  include credential issuance inside their own larger transaction (pass
  commit=False) or treat it as a self-contained operation (commit=True,
  the default for standalone rotations).
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.credential import Credential, CredentialStatus
from app.models.agent import Agent


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_credential(db: Session, agent: Agent, *, commit: bool = True) -> tuple[Credential, str]:
    """
    Create a new JWT for an agent and persist its hash.
    Returns (Credential row, raw JWT).

    If commit=False, the credential is added to the session but the caller
    is responsible for calling db.commit().
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.CREDENTIAL_LIFETIME_DAYS)

    payload = {
        "sub": agent.agent_id,
        "agent_name": agent.agent_name,
        "scopes": agent.scopes_list(),
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    credential = Credential(
        agent_id=agent.agent_id,
        token_hash=_hash_token(token),
        issued_at=now,
        expires_at=expires_at,
        status=CredentialStatus.ACTIVE,
    )
    db.add(credential)

    if commit:
        db.commit()
        db.refresh(credential)

    return credential, token


def rotate_credential(db: Session, agent: Agent, *, commit: bool = True) -> tuple[Credential, str]:
    """
    Invalidate the agent's current active credential(s) and issue a fresh one.
    Old tokens stop working immediately (their DB status is no longer ACTIVE).
    """
    active_creds = (
        db.query(Credential)
        .filter(Credential.agent_id == agent.agent_id, Credential.status == CredentialStatus.ACTIVE)
        .all()
    )
    for c in active_creds:
        c.status = CredentialStatus.ROTATED

    return issue_credential(db, agent, commit=commit)


def decode_token(token: str) -> dict:
    """Raises jose.JWTError on invalid/expired token."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def verify_credential_active(db: Session, agent_id: str, token: str) -> bool:
    """Confirm the presented token's hash matches a currently ACTIVE credential row."""
    token_hash = _hash_token(token)
    cred = (
        db.query(Credential)
        .filter(
            Credential.agent_id == agent_id,
            Credential.token_hash == token_hash,
            Credential.status == CredentialStatus.ACTIVE,
        )
        .first()
    )
    return cred is not None
