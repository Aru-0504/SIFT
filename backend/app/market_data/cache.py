from datetime import datetime, timedelta
from typing import Optional

from app.market_data.base import MarketDataProvider, Quote, ProviderUnavailableError
from app.config import settings


class CachedFallbackProvider(MarketDataProvider):
    """
    Wraps an underlying live provider with:
      1. A shared, per-symbol TTL cache — every user watching the same symbol
         hits one upstream fetch, not one-per-user. This is the scalability
         answer for "larger watchlists and more users."
      2. A last-known-good fallback — if the live provider fails, we serve
         the most recent successful Quote we have for that symbol, marked
         is_stale=True with a reason. We never fabricate data and never
         silently present old data as fresh.
    """

    def __init__(self, live_provider: MarketDataProvider, ttl_seconds: Optional[int] = None):
        self._live = live_provider
        self._ttl = timedelta(seconds=ttl_seconds or settings.quote_cache_ttl_seconds)
        self._cache: dict[str, Quote] = {}
        self._history_cache: dict[str, tuple[datetime, list[float]]] = {}

    def get_quote(self, symbol: str) -> Quote:
        cached = self._cache.get(symbol)
        fresh_enough = cached and (datetime.utcnow() - cached.fetched_at) < self._ttl

        if fresh_enough:
            return cached

        try:
            quote = self._live.get_quote(symbol)
            self._cache[symbol] = quote
            return quote
        except ProviderUnavailableError:
            if cached is not None:
                # Serve last-known-good, explicitly marked stale. This is the
                # honesty guarantee: the frontend always knows when it's not
                # looking at a fresh number, and how old that number is.
                return Quote(
                    symbol=cached.symbol,
                    price=cached.price,
                    previous_close=cached.previous_close,
                    volume=cached.volume,
                    fetched_at=cached.fetched_at,
                    source=cached.source,
                    is_stale=True,
                    stale_reason="provider_unavailable",
                )
            # No cache at all yet — genuinely nothing we can serve.
            raise

    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        cached = self._history_cache.get(symbol)
        if cached and (datetime.utcnow() - cached[0]) < timedelta(hours=1):
            return cached[1]
        try:
            history = self._live.get_recent_history(symbol, days)
            self._history_cache[symbol] = (datetime.utcnow(), history)
            return history
        except ProviderUnavailableError:
            if cached:
                return cached[1]
            raise

    def validate_symbol(self, symbol: str) -> bool:
        return self._live.validate_symbol(symbol)
