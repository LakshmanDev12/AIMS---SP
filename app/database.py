"""
SQLAlchemy engine, session factory, and declarative base.

Works transparently for both SQLite (dev) and PostgreSQL (prod) —
only DATABASE_URL in .env needs to change.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

connect_args = {}
engine_kwargs = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # Needed for SQLite when accessed from multiple threads (FastAPI + scheduler)
    connect_args = {"check_same_thread": False}
    engine_kwargs["connect_args"] = connect_args
    if ":memory:" in settings.DATABASE_URL:
        from sqlalchemy.pool import StaticPool
        engine_kwargs["poolclass"] = StaticPool

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call once at startup (idempotent)."""
    # Import models so they're registered on Base.metadata before create_all
    from app.models import agent, credential, audit  # noqa: F401
    Base.metadata.create_all(bind=engine)
