from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


class ProviderUnavailableError(Exception):
    """Raised when a provider cannot return live data (timeout, error, rate limit)."""
    pass


class InvalidSymbolError(Exception):
    """Raised when a symbol does not exist / cannot be resolved."""
    pass


@dataclass
class Quote:
    symbol: str
    price: float
    previous_close: float
    volume: int
    fetched_at: datetime
    source: str
    is_stale: bool = False
    stale_reason: Optional[str] = None


class MarketDataProvider(ABC):
    """
    Every concrete provider (real API, cache-backed fallback, mock) implements
    this interface. Services never talk to a concrete provider directly —
    only to this contract. This is what lets SIFT swap or stack data sources
    without touching business logic (checkpoint diffing, significance scoring).
    """

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        ...

    @abstractmethod
    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        """Recent daily closes, oldest first. Used for volatility-relative significance."""
        ...

    @abstractmethod
    def validate_symbol(self, symbol: str) -> bool:
        ...

    @abstractmethod
    def search_symbols(self, query: str) -> list[dict]:
        """Search for matching ticker symbols and company names."""
        ...
