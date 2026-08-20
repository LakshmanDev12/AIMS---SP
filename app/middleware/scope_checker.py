from datetime import datetime, timezone
import json
import urllib.request

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.notification import NotificationCategory, NotificationSeverity
from app.services.token_service import decode_token, verify_credential_active
from app.services.revoke_service import log_action
from app.services.notification_service import create_notification

bearer_scheme = HTTPBearer(auto_error=True)

# Simple cache for JWKS to avoid roundtrips on every request
_jwks_cache = None

def get_auth0_jwks(domain: str) -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    url = f"https://{domain}/.well-known/jwks.json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FastAPI-OIDC-Client"})
        with urllib.request.urlopen(req, timeout=5) as response:
            _jwks_cache = json.loads(response.read().decode("utf-8"))
        return _jwks_cache
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to fetch JWKS from OIDC provider: {str(e)}"
        )


def require_scope(required_scope: str | None = None):
    def dependency(
        creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
        db: Session = Depends(get_db),
    ) -> Agent:
        token = creds.credentials

        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg")
        except Exception:
            log_action(db, None, action="ACCESS_ATTEMPT", result="DENIED", reason="Invalid token format")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")

        payload = None
        is_auth0 = False

        if settings.AUTH0_ENABLED and alg == "RS256":
            # Auth0 / Okta OIDC verification path
            try:
                kid = unverified_header.get("kid")
                jwks = get_auth0_jwks(settings.AUTH0_DOMAIN)
                rsa_key = {}
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        rsa_key = {
                            "kty": key["kty"],
                            "kid": key["kid"],
                            "use": key["use"],
                            "n": key["n"],
                            "e": key["e"]
                        }
                        break
                if not rsa_key:
                    raise JWTError("Public key not found in JWKS")
                
                issuer = settings.AUTH0_ISSUER or f"https://{settings.AUTH0_DOMAIN}/"
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=["RS256"],
                    audience=settings.AUTH0_API_AUDIENCE,
                    issuer=issuer
                )
                is_auth0 = True
            except JWTError as e:
                log_action(db, None, action="ACCESS_ATTEMPT", result="DENIED", reason=f"OIDC validation failed: {str(e)}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"OIDC token invalid: {str(e)}")
        else:
            # Internal HS256 validation path
            try:
                payload = decode_token(token)
            except JWTError:
                log_action(db, None, action="ACCESS_ATTEMPT", result="DENIED", reason="Invalid or expired token")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        agent_id = payload.get("sub")
        
        # Robust scope extraction for various OIDC claims
        scopes = payload.get("scopes", [])
        if not isinstance(scopes, list):
            scopes = []
        if "permissions" in payload:
            perms = payload.get("permissions", [])
            if isinstance(perms, list):
                scopes.extend(perms)
        if "scope" in payload:
            scope_str = payload.get("scope", "")
            if isinstance(scope_str, str):
                scopes.extend(scope_str.split(" "))

        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        if agent is None:
            log_action(db, agent_id, action="ACCESS_ATTEMPT", result="DENIED", reason="Unknown agent")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown agent")

        # Bypass local credential table check for OIDC tokens
        if not is_auth0:
            if not verify_credential_active(db, agent_id, token):
                log_action(db, agent_id, action="ACCESS_ATTEMPT", result="DENIED", reason="Credential not active (rotated/revoked)")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credential is no longer active")

        if agent.status != AgentStatus.ACTIVE:
            log_action(db, agent_id, action="ACCESS_ATTEMPT", result="DENIED", reason=f"Agent status is {agent.status.value}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Agent is {agent.status.value}, not active")

        if required_scope is not None and required_scope not in scopes and "admin" not in scopes:
            log_action(
                db, agent_id, action="ACCESS_ATTEMPT", result="DENIED",
                reason=f"Missing required scope '{required_scope}' (has {scopes})",
            )
            create_notification(
                db=db,
                agent_id=agent_id,
                category=NotificationCategory.SECURITY,
                severity=NotificationSeverity.CRITICAL,
                title=f"Security Alert: Scope Denial for {agent.agent_name}",
                message=f"Agent '{agent.agent_name}' ({agent_id}) attempted unauthorized access requiring scope '{required_scope}'. Access denied.",
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Scope '{required_scope}' not granted to this agent")

        # Success — stamp activity and log
        agent.last_api_call = datetime.now(timezone.utc)
        db.commit()
        scope_desc = f"Scope '{required_scope}' granted" if required_scope else "Valid credential verified"
        log_action(db, agent_id, action="ACCESS_ATTEMPT", result="SUCCESS", reason=scope_desc)

        return agent

    return dependency


