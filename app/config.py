"""
Central application configuration.
Reads from environment variables / .env file via pydantic-settings.
"""
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "sqlite:///./aims.db"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"

    # Lifecycle policy thresholds
    STALE_THRESHOLD_DAYS: int = 30
    AUTO_REVOKE_THRESHOLD_DAYS: int = 90
    CREDENTIAL_LIFETIME_DAYS: int = 90

    # CORS — comma-separated origins allowed to call the API
    # In dev: http://localhost:5173 (Vite) + http://localhost:3000
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # Auth0 OIDC (bonus / optional)
    AUTH0_DOMAIN: str = ""
    AUTH0_API_AUDIENCE: str = ""
    AUTH0_ISSUER: str = ""
    AUTH0_ENABLED: bool = False

    # Debug mode — set True in local dev only; NEVER in production
    DEBUG: bool = True

    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()

# --------------------------------------------------------------------------
# Startup guard — refuse to launch with the insecure default secret key
# unless explicitly in debug/dev mode.
# --------------------------------------------------------------------------
_DEFAULT_KEY = "dev-secret-change-me"
if not settings.DEBUG and settings.JWT_SECRET_KEY == _DEFAULT_KEY:
    print(
        "FATAL: JWT_SECRET_KEY is still the default placeholder value. "
        "Set a strong random secret in your .env (or environment) and "
        "set DEBUG=false only in production.",
        file=sys.stderr,
    )
    sys.exit(1)
