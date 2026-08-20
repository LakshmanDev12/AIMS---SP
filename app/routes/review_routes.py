import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AuditLog
from app.models.agent import Agent
from app.services.review_service import (
    detect_stale_agents,
    build_quarterly_report,
    refresh_risk_scores,
)
from app.services.revoke_service import auto_revoke_stale_agents

router = APIRouter(tags=["governance"])


@router.get("/reviews/quarterly")
def quarterly_review(db: Session = Depends(get_db)):
    """
    Quarterly Review Report: agent status breakdown, stale agents,
    agents overdue for credential rotation, and top-risk agents.
    Reads already-stored risk scores — does NOT recalculate on every request.
    """
    return build_quarterly_report(db)


@router.post("/reviews/detect-stale")
def run_stale_detection(db: Session = Depends(get_db)):
    """Manually trigger stale-agent detection (also runs automatically on a schedule)."""
    newly_stale = detect_stale_agents(db)
    return {"newly_stale_count": len(newly_stale), "agent_ids": [a.agent_id for a in newly_stale]}


@router.post("/reviews/auto-revoke")
def run_auto_revoke(db: Session = Depends(get_db)):
    """Manually trigger auto-revocation of long-idle stale agents."""
    revoked = auto_revoke_stale_agents(db)
    return {"revoked_count": len(revoked), "agent_ids": revoked}


@router.get("/reviews/export/csv")
def export_compliance_csv(db: Session = Depends(get_db)):
    """
    Export full AI Agent Identity & Governance audit report in CSV format
    (SOC 2 / NIST AI RMF compliance export).
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Agent ID",
        "Agent Name",
        "Owning Team",
        "Purpose",
        "Status",
        "Approved Scopes",
        "Risk Score (0-100)",
        "Creation Date",
        "Last API Call",
    ])

    agents = db.query(Agent).all()
    for a in agents:
        writer.writerow([
            a.agent_id,
            a.agent_name,
            a.owning_team or "N/A",
            a.purpose or "N/A",
            a.status.value,
            a.approved_scopes,
            a.risk_score,
            a.creation_date.isoformat() if a.creation_date else "",
            a.last_api_call.isoformat() if a.last_api_call else "Never",
        ])

    csv_content = output.getvalue()
    filename = f"aims_governance_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reviews/export/json")
def export_compliance_json(db: Session = Depends(get_db)):
    """
    Export structured JSON compliance package for external SIEM / Audit software.
    """
    refresh_risk_scores(db)
    report = build_quarterly_report(db)
    agents = db.query(Agent).all()

    report["agents_registry"] = [
        {
            "agent_id": a.agent_id,
            "agent_name": a.agent_name,
            "owning_team": a.owning_team,
            "purpose": a.purpose,
            "status": a.status.value,
            "approved_scopes": a.scopes_list(),
            "risk_score": a.risk_score,
            "creation_date": a.creation_date.isoformat() if a.creation_date else None,
            "last_api_call": a.last_api_call.isoformat() if a.last_api_call else None,
        }
        for a in agents
    ]
    report["export_timestamp"] = datetime.now(timezone.utc).isoformat()
    report["compliance_standard"] = "SOC 2 Type II & NIST AI RMF Governance Attestation"
    return report


@router.get("/audit-logs")
def get_audit_logs(
    agent_id: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if agent_id:
        query = query.filter(AuditLog.agent_id == agent_id)
    logs = query.limit(limit).all()
    return [
        {
            "log_id": entry.log_id,
            "agent_id": entry.agent_id,
            "action": entry.action,
            "result": entry.result,
            "reason": entry.reason,
            "timestamp": entry.timestamp,
        }
        for entry in logs
    ]


@router.get("/dashboard")
def governance_dashboard(db: Session = Depends(get_db)):
    """
    Governance Dashboard — single endpoint the React frontend polls.
    Refreshes risk scores once, then builds the full report.
    """
    refresh_risk_scores(db)  # one refresh, used by build_quarterly_report below
    report = build_quarterly_report(db)
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20).all()
    report["recent_activity"] = [
        {
            "log_id": entry.log_id,
            "agent_id": entry.agent_id,
            "action": entry.action,
            "result": entry.result,
            "reason": entry.reason,
            "timestamp": entry.timestamp,
        }
        for entry in recent_logs
    ]
    return report
