from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.credential import Credential, CredentialStatus
from app.schemas.agent import (
    AgentRegisterRequest,
    AgentRegisterResponse,
    AgentOut,
    AgentActionResponse,
)
from app.schemas.credential import CredentialRotateRequest, CredentialRotateResponse, CredentialOut
from app.services.token_service import issue_credential, rotate_credential
from app.services.revoke_service import log_action, revoke_agent_credentials
from app.middleware.scope_checker import require_scope

router = APIRouter(tags=["agents"])


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/agents/register", response_model=AgentRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_agent(payload: AgentRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new agent and issue its first scoped JWT credential.
    Everything happens in a single atomic transaction — either the full
    record + credential is created, or nothing is.
    """
    agent = Agent(
        agent_name=payload.agent_name,
        purpose=payload.purpose,
        owning_team=payload.owning_team,
        approved_scopes=",".join(payload.scopes),
        status=AgentStatus.ACTIVE,
        creation_date=datetime.now(timezone.utc),
    )
    db.add(agent)
    db.flush()  # get agent_id without committing

    credential, token = issue_credential(db, agent, commit=False)
    agent.expiry_date = credential.expires_at

    db.commit()
    db.refresh(agent)
    db.refresh(credential)

    log_action(db, agent.agent_id, action="REGISTER", result="SUCCESS", reason=f"Scopes: {payload.scopes}")

    return AgentRegisterResponse(agent_id=agent.agent_id, token=token, expires_at=credential.expires_at)


# ---------------------------------------------------------------------------
# Identity records
# ---------------------------------------------------------------------------

@router.get("/agents", response_model=list[AgentOut])
def list_agents(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
):
    return db.query(Agent).order_by(Agent.creation_date.desc()).offset(skip).limit(limit).all()


@router.get("/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ---------------------------------------------------------------------------
# Credential management
# ---------------------------------------------------------------------------

@router.get("/credentials/{agent_id}", response_model=list[CredentialOut])
def list_credentials(agent_id: str, db: Session = Depends(get_db)):
    """List all credentials (current and historical) for an agent."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return (
        db.query(Credential)
        .filter(Credential.agent_id == agent_id)
        .order_by(Credential.issued_at.desc())
        .all()
    )


@router.post("/credentials/rotate", response_model=CredentialRotateResponse)
def rotate(
    payload: CredentialRotateRequest,
    db: Session = Depends(get_db),
    calling_agent: Agent = Depends(require_scope()),
):
    """
    Rotate the credential for the agent identified in the payload.
    The caller must present their own valid bearer token (any scope).
    An agent can only rotate its own credential (enforced below).
    An admin-scoped agent may rotate any agent's credential.
    """
    agent_id = payload.agent_id

    # Non-admin agents may only rotate their own credential
    if "admin" not in calling_agent.scopes_list() and calling_agent.agent_id != agent_id:
        log_action(db, calling_agent.agent_id, action="ROTATE", result="DENIED",
                   reason=f"Tried to rotate credential for another agent: {agent_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Agents may only rotate their own credentials unless they have admin scope.")

    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.status not in (AgentStatus.ACTIVE, AgentStatus.STALE):
        raise HTTPException(status_code=400, detail=f"Cannot rotate credentials for a {agent.status.value} agent")

    credential, token = rotate_credential(db, agent)
    agent.expiry_date = credential.expires_at
    db.commit()

    log_action(db, agent.agent_id, action="ROTATE", result="SUCCESS")

    return CredentialRotateResponse(
        agent_id=agent.agent_id,
        credential_id=credential.credential_id,
        token=token,
        expires_at=credential.expires_at,
    )


# ---------------------------------------------------------------------------
# Lifecycle management (all require admin scope)
# ---------------------------------------------------------------------------

@router.post("/agents/suspend/{agent_id}", response_model=AgentActionResponse)
def suspend_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    _admin: Agent = Depends(require_scope("admin")),
):
    """Suspend an agent. Requires admin scope."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.status in (AgentStatus.REVOKED, AgentStatus.DECOMMISSIONED):
        raise HTTPException(status_code=400, detail=f"Cannot suspend a {agent.status.value} agent")

    agent.status = AgentStatus.SUSPENDED
    db.commit()
    log_action(db, agent_id, action="SUSPEND", result="SUCCESS")

    return AgentActionResponse(agent_id=agent_id, status=agent.status, message="Agent suspended")


@router.post("/agents/reactivate/{agent_id}", response_model=AgentRegisterResponse)
def reactivate_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    _admin: Agent = Depends(require_scope("admin")),
):
    """
    Reactivate a suspended or stale agent.
    Automatically issues a fresh credential since old ones may be rotated/revoked.
    Requires admin scope.
    """
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.status in (AgentStatus.REVOKED, AgentStatus.DECOMMISSIONED):
        raise HTTPException(status_code=400, detail=f"Cannot reactivate a {agent.status.value} agent")

    agent.status = AgentStatus.ACTIVE
    agent.last_api_call = datetime.now(timezone.utc)
    db.flush()

    credential, token = issue_credential(db, agent, commit=False)
    agent.expiry_date = credential.expires_at
    db.commit()
    db.refresh(credential)

    log_action(db, agent_id, action="REACTIVATE", result="SUCCESS", reason="New credential issued")

    return AgentRegisterResponse(agent_id=agent_id, token=token, expires_at=credential.expires_at)


@router.post("/agents/decommission/{agent_id}", response_model=AgentActionResponse)
def decommission_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    _admin: Agent = Depends(require_scope("admin")),
):
    """Decommission an agent and revoke all its active credentials. Requires admin scope."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    n = revoke_agent_credentials(db, agent)
    agent.status = AgentStatus.DECOMMISSIONED
    db.commit()
    log_action(db, agent_id, action="DECOMMISSION", result="SUCCESS", reason=f"{n} credential(s) revoked")

    return AgentActionResponse(agent_id=agent_id, status=agent.status, message="Agent decommissioned")
