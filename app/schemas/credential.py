from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.credential import CredentialStatus


class CredentialRotateRequest(BaseModel):
    agent_id: str


class CredentialRotateResponse(BaseModel):
    agent_id: str
    credential_id: str
    token: str
    expires_at: datetime


class CredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    credential_id: str
    agent_id: str
    issued_at: datetime
    expires_at: datetime
    status: CredentialStatus
