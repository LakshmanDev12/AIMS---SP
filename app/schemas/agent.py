from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.agent import AgentStatus

VALID_SCOPES = {"read", "write", "admin"}


class AgentRegisterRequest(BaseModel):
    agent_name: str
    purpose: Optional[str] = None
    owning_team: Optional[str] = None
    scopes: list[str]

    @field_validator("scopes")
    @classmethod
    def validate_scopes(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one scope must be requested")
        bad = set(v) - VALID_SCOPES
        if bad:
            raise ValueError(f"Unknown scope(s): {sorted(bad)}. Valid scopes: {sorted(VALID_SCOPES)}")
        return v


class AgentRegisterResponse(BaseModel):
    agent_id: str
    token: str
    expires_at: datetime


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agent_id: str
    agent_name: str
    purpose: Optional[str]
    owning_team: Optional[str]
    # Stored as "read,write" in DB; exposed as ["read", "write"] in the API
    approved_scopes: list[str]
    status: AgentStatus
    creation_date: datetime
    expiry_date: Optional[datetime]
    last_api_call: Optional[datetime]
    risk_score: int

    @model_validator(mode="before")
    @classmethod
    def split_scopes(cls, data: object) -> object:
        """
        Convert the comma-separated approved_scopes string from the ORM model
        into a list before Pydantic validates the fields.
        """
        # Works both when data is an ORM object and when it's a plain dict
        if hasattr(data, "approved_scopes"):
            raw = data.approved_scopes or ""
            # Avoid mutating the ORM object — return a dict copy
            return {
                "agent_id": data.agent_id,
                "agent_name": data.agent_name,
                "purpose": data.purpose,
                "owning_team": data.owning_team,
                "approved_scopes": [s.strip() for s in raw.split(",") if s.strip()],
                "status": data.status,
                "creation_date": data.creation_date,
                "expiry_date": data.expiry_date,
                "last_api_call": data.last_api_call,
                "risk_score": data.risk_score,
            }
        if isinstance(data, dict) and isinstance(data.get("approved_scopes"), str):
            raw = data["approved_scopes"]
            data = dict(data)
            data["approved_scopes"] = [s.strip() for s in raw.split(",") if s.strip()]
        return data


class AgentActionResponse(BaseModel):
    agent_id: str
    status: AgentStatus
    message: str
