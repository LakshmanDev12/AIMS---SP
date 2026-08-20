from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import NotificationCategory, NotificationSeverity
from app.schemas.notification import (
    NotificationOut,
    NotificationSummaryResponse,
    WebhookTestRequest,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    category: Optional[NotificationCategory] = Query(None, description="Filter by category (unused_agent, active_agent, security, system)"),
    severity: Optional[NotificationSeverity] = Query(None, description="Filter by severity (critical, warning, info)"),
    is_read: Optional[bool] = Query(None, description="Filter by read/unread status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    List governance notifications for unused AI agents, active AI agents, and security alerts.
    """
    return notification_service.get_notifications(
        db,
        category=category,
        severity=severity,
        is_read=is_read,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", response_model=NotificationSummaryResponse)
def get_notification_summary(db: Session = Depends(get_db)):
    """
    Get summary metrics of unread notifications and category counts.
    """
    return notification_service.get_notification_summary(db)


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """
    Mark a specific notification as read.
    """
    note = notification_service.mark_as_read(db, notification_id)
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    return note


@router.put("/read-all")
def mark_all_notifications_read(
    category: Optional[NotificationCategory] = Query(None, description="Optional category filter to mark read"),
    db: Session = Depends(get_db),
):
    """
    Mark all unread notifications (or all in a given category) as read.
    """
    count = notification_service.mark_all_as_read(db, category=category)
    return {"updated_count": count}


@router.post("/trigger-sweep")
def trigger_alert_sweep(db: Session = Depends(get_db)):
    """
    Manually trigger an immediate governance alert sweep for unused and active AI agents.
    Useful for demonstration and live evaluation.
    """
    count = notification_service.generate_governance_notifications(db)
    summary = notification_service.get_notification_summary(db)
    return {
        "new_notifications_generated": count,
        "summary": summary,
    }


@router.post("/test-webhook")
def test_webhook_dispatch(payload: WebhookTestRequest):
    """
    Simulate dispatching a notification alert to an external webhook URL (e.g. Slack/Teams/Email).
    """
    return {
        "status": "success",
        "target_url": payload.target_url,
        "dispatched_title": payload.title,
        "dispatched_message": payload.message,
        "delivered": True,
    }
