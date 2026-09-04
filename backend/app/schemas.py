from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class AddSymbolRequest(BaseModel):
    symbol: str

    @field_validator("symbol")
    @classmethod
    def normalize(cls, v: str) -> str:
        v = v.strip().strip("'\"").strip().upper()
        if not v:
            raise ValueError("symbol must not be empty")
        return v


class ChangeInfo(BaseModel):
    pct_change: float
    threshold_used: float
    significance: str  # "normal" | "notable" | "high"
    signals: list[str]


class WatchlistItemResponse(BaseModel):
    symbol: str
    price: float
    previous_close: float
    is_stale: bool
    stale_reason: Optional[str] = None
    source: str
    fetched_at: datetime
    change_since_last_seen: Optional[ChangeInfo] = None


class WatchlistResponse(BaseModel):
    items: list[WatchlistItemResponse]
    unseen_change_count: int


class AckRequest(BaseModel):
    symbols: Optional[list[str]] = None  # None = acknowledge everything


class ChangeHistoryEntry(BaseModel):
    symbol: str
    pct_change: float
    significance_score: float
    signals: dict
    status: str
    created_at: datetime


class ErrorResponse(BaseModel):
    detail: str
