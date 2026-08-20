"""
Example protected resources used to prove scope enforcement works
(this is what Phase 6 success-criteria testing hits), plus an optional
Auth0 OIDC verification endpoint (bonus feature).
"""
from fastapi import APIRouter, Depends

from app.middleware.scope_checker import require_scope
from app.models.agent import Agent
from app.config import settings

router = APIRouter(tags=["protected-resources"])


@router.get("/reports")
def get_reports(agent: Agent = Depends(require_scope("read"))):
    """Any agent with 'read' scope can view reports."""
    return {"message": f"Reports data for {agent.agent_name}", "agent_id": agent.agent_id}


@router.post("/reports")
def write_report(agent: Agent = Depends(require_scope("write"))):
    """Requires 'write' scope — e.g. HRBot passes, FinanceBot (read-only) is denied."""
    return {"message": f"Report written by {agent.agent_name}", "agent_id": agent.agent_id}


@router.get("/admin/settings")
def admin_settings(agent: Agent = Depends(require_scope("admin"))):
    """Requires 'admin' scope — e.g. AuditBot."""
    return {"message": f"Admin console accessed by {agent.agent_name}", "agent_id": agent.agent_id}


# --- Auth0 OIDC integration (bonus) -----------------------------------------
# Disabled by default (AUTH0_ENABLED=false in .env). When enabled, this
# verifies an Auth0-issued access token against Auth0's JWKS instead of our
# own JWT signing — useful when AIMS sits behind an org-wide Auth0 tenant.

@router.get("/auth0/status")
def auth0_status():
    return {
        "auth0_enabled": settings.AUTH0_ENABLED,
        "auth0_domain": settings.AUTH0_DOMAIN or None,
        "note": (
            "Set AUTH0_ENABLED=true and fill AUTH0_DOMAIN / AUTH0_API_AUDIENCE "
            "in .env to activate Auth0 token verification for external/human "
            "administrators. Agent-to-agent credentials continue to use "
            "internally-issued scoped JWTs."
        ),
    }
