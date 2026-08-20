from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationCategory, NotificationSeverity


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: Optional[str]
    category: NotificationCategory
    severity: NotificationSeverity
    title: str
    message: str
    is_read: bool
    created_at: datetime
    meta_data: Optional[str] = None


class NotificationSummaryResponse(BaseModel):
    total_unread: int
    total_notifications: int
    unused_agent_alerts: int
    active_agent_alerts: int
    security_alerts: int


class WebhookTestRequest(BaseModel):
    target_url: str
    title: Optional[str] = "Test Webhook Alert"
    message: Optional[str] = "Testing AIMS notification webhook integration."
