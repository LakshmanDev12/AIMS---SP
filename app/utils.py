"""
Shared utility helpers used across multiple service modules.
"""
from datetime import datetime, timezone


def as_aware(dt: datetime) -> datetime:
    """
    Return a timezone-aware datetime.
    SQLite stores and returns naive datetimes — treat them as UTC.
    PostgreSQL returns tz-aware ones which pass through unchanged.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def now_utc() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)
