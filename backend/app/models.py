import uuid
from datetime import datetime

from sqlalchemy import Column, String, Numeric, DateTime, UniqueConstraint, JSON, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.database import Base

# Use a plain String for UUID storage so this also works on SQLite in local dev.
# On Postgres/Neon this still stores fine as text; swap to PG_UUID if you
# want native uuid columns once you're fully on Postgres.


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False, index=True)
    symbol = Column(String, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "symbol", name="uq_user_symbol"),
    )


class UserCheckpoint(Base):
    __tablename__ = "user_checkpoints"

    user_id = Column(String, primary_key=True)
    symbol = Column(String, primary_key=True)
    last_seen_price = Column(Numeric, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)


class DetectedChange(Base):
    __tablename__ = "detected_changes"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    previous_price = Column(Numeric, nullable=False)
    current_price = Column(Numeric, nullable=False)
    pct_change = Column(Numeric, nullable=False)
    significance_score = Column(Numeric, nullable=False)
    signals = Column(JSON, nullable=False, default=dict)
    status = Column(String, nullable=False, default="unseen")  # unseen | acknowledged
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_changes_user_status", "user_id", "status"),
    )
