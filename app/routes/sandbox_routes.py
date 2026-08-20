from datetime import datetime, timezone
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.credential import Credential, CredentialStatus
from app.services import token_service, notification_service
from app.services.revoke_service import log_action
from app.models.notification import NotificationCategory, NotificationSeverity

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


class SandboxSimulationRequest(BaseModel):
    agent_id: str
    simulation_type: Literal["valid_read", "unauthorized_admin", "unauthorized_write", "rotate_token", "burst_traffic"]


@router.post("/simulate")
def simulate_agent_action(payload: SandboxSimulationRequest, db: Session = Depends(get_db)):
    """
    Executes a simulated security action on behalf of an agent identity.
    Allows evaluators and admins to test scope enforcement, credential rotation,
    access control, and security alert generation in 1 click.
    """
    agent = db.query(Agent).filter(Agent.agent_id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    scopes = agent.scopes_list()
    active_cred = (
        db.query(Credential)
        .filter(Credential.agent_id == agent.agent_id, Credential.status == CredentialStatus.ACTIVE)
        .first()
    )

    if payload.simulation_type == "valid_read":
        if "read" not in scopes and "admin" not in scopes:
            # Denied
            log_action(db, agent.agent_id, action="SIMULATE_READ", result="DENIED", reason="Missing 'read' scope")
            notification_service.create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.SECURITY,
                severity=NotificationSeverity.CRITICAL,
                title=f"Sandbox Breach Alert: {agent.agent_name}",
                message=f"Simulated read request denied for agent '{agent.agent_name}' (missing scope).",
            )
            return {
                "status_code": 403,
                "result": "DENIED",
                "reason": "Scope 'read' not granted to this agent",
                "agent_id": agent.agent_id,
                "agent_name": agent.agent_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Success
        agent.last_api_call = datetime.now(timezone.utc)
        db.commit()
        log_action(db, agent.agent_id, action="SIMULATE_READ", result="SUCCESS", reason="Scope 'read' verified")
        return {
            "status_code": 200,
            "result": "SUCCESS",
            "reason": "Valid read request executed successfully",
            "agent_id": agent.agent_id,
            "agent_name": agent.agent_name,
            "payload": {"reports_accessed": 5, "status": "active_data_feed"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    elif payload.simulation_type == "unauthorized_admin":
        # Simulate unauthorized admin breach attempt
        log_action(db, agent.agent_id, action="SIMULATE_ADMIN_BREACH", result="DENIED", reason="Missing required scope 'admin'")
        notification_service.create_notification(
            db=db,
            agent_id=agent.agent_id,
            category=NotificationCategory.SECURITY,
            severity=NotificationSeverity.CRITICAL,
            title=f"Security Alert: Unauthorized Admin Access Attempt by {agent.agent_name}",
            message=f"Agent '{agent.agent_name}' ({agent.agent_id}) attempted simulated admin resource breach. Access intercepted and denied.",
        )
        return {
            "status_code": 403,
            "result": "DENIED",
            "reason": "Scope 'admin' required but not granted to this agent identity",
            "agent_id": agent.agent_id,
            "agent_name": agent.agent_name,
            "security_alert_generated": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    elif payload.simulation_type == "unauthorized_write":
        if "write" not in scopes and "admin" not in scopes:
            log_action(db, agent.agent_id, action="SIMULATE_WRITE_BREACH", result="DENIED", reason="Missing required scope 'write'")
            notification_service.create_notification(
                db=db,
                agent_id=agent.agent_id,
                category=NotificationCategory.SECURITY,
                severity=NotificationSeverity.CRITICAL,
                title=f"Security Alert: Write Scope Violation by {agent.agent_name}",
                message=f"Agent '{agent.agent_name}' ({agent.agent_id}) attempted simulated write modification without write scope.",
            )
            return {
                "status_code": 403,
                "result": "DENIED",
                "reason": "Scope 'write' required but not granted",
                "agent_id": agent.agent_id,
                "agent_name": agent.agent_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        
        agent.last_api_call = datetime.now(timezone.utc)
        db.commit()
        log_action(db, agent.agent_id, action="SIMULATE_WRITE", result="SUCCESS", reason="Scope 'write' verified")
        return {
            "status_code": 200,
            "result": "SUCCESS",
            "reason": "Write operation executed successfully",
            "agent_id": agent.agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    elif payload.simulation_type == "rotate_token":
        new_cred, new_token = token_service.rotate_credential(db, agent)
        log_action(db, agent.agent_id, action="SIMULATE_ROTATION", result="SUCCESS", reason="Token rotated via Sandbox")
        notification_service.create_notification(
            db=db,
            agent_id=agent.agent_id,
            category=NotificationCategory.ACTIVE_AGENT,
            severity=NotificationSeverity.INFO,
            title=f"Credential Rotated: {agent.agent_name}",
            message=f"Active credential rotated for agent '{agent.agent_name}'. Previous token immediately invalidated.",
        )
        return {
            "status_code": 200,
            "result": "SUCCESS",
            "reason": "Credential rotated successfully. Old credential set to ROTATED.",
            "agent_id": agent.agent_id,
            "new_credential_id": new_cred.credential_id,
            "new_token_sample": f"{new_token[:15]}...[TRUNCATED]",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    elif payload.simulation_type == "burst_traffic":
        # Simulate burst anomaly detection
        for _ in range(5):
            log_action(db, agent.agent_id, action="SIMULATE_BURST_CALL", result="SUCCESS", reason="High-frequency burst test")
        
        agent.last_api_call = datetime.now(timezone.utc)
        db.commit()
        
        notification_service.create_notification(
            db=db,
            agent_id=agent.agent_id,
            category=NotificationCategory.ACTIVE_AGENT,
            severity=NotificationSeverity.WARNING,
            title=f"Anomaly Warning: Traffic Burst Detected for {agent.agent_name}",
            message=f"Agent '{agent.agent_name}' ({agent.agent_id}) executed 5 rapid requests in Sandbox simulation.",
        )
        return {
            "status_code": 200,
            "result": "SUCCESS",
            "reason": "Burst traffic simulated (5 rapid calls logged). Anomaly warning notification emitted.",
            "agent_id": agent.agent_id,
            "requests_executed": 5,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    raise HTTPException(status_code=400, detail="Invalid simulation type")
