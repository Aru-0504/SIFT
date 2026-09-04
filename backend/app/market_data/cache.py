import json
from datetime import datetime, timedelta
from typing import Optional

from app.market_data.base import MarketDataProvider, Quote, ProviderUnavailableError
from app.config import settings


class CachedFallbackProvider(MarketDataProvider):
    """
    Wraps an underlying live provider with:
      1. A shared, per-symbol TTL cache (in-memory or Redis) — every user watching
         the same symbol hits one upstream fetch, not one-per-user.
      2. A last-known-good fallback — if the live provider fails, we serve
         the most recent successful Quote we have for that symbol, marked
         is_stale=True with a reason. We never fabricate data and never
         silently present old data as fresh.
    """

    def __init__(self, live_provider: MarketDataProvider, ttl_seconds: Optional[int] = None):
        self._live = live_provider
        self._ttl_seconds = ttl_seconds or settings.quote_cache_ttl_seconds
        self._ttl = timedelta(seconds=self._ttl_seconds)
        self._cache: dict[str, Quote] = {}
        self._history_cache: dict[str, tuple[datetime, list[float]]] = {}
        self._redis_client = None

        if getattr(settings, "redis_url", None):
            try:
                import importlib
                redis_mod = importlib.import_module("redis")
                self._redis_client = redis_mod.from_url(settings.redis_url, decode_responses=True)
            except Exception:
                self._redis_client = None

    def _get_from_redis(self, symbol: str) -> Optional[Quote]:
        if not self._redis_client:
            return None
        try:
            raw = self._redis_client.get(f"sift:quote:{symbol}")
            if raw:
                data = json.loads(raw)
                return Quote(
                    symbol=data["symbol"],
                    price=float(data["price"]),
                    previous_close=float(data["previous_close"]),
                    volume=int(data["volume"]),
                    fetched_at=datetime.fromisoformat(data["fetched_at"]),
                    source=data["source"],
                    is_stale=bool(data.get("is_stale", False)),
                    stale_reason=data.get("stale_reason"),
                )
        except Exception:
            pass
        return None

    def _save_to_redis(self, quote: Quote, ttl_seconds: int):
        if not self._redis_client:
            return
        try:
            payload = {
                "symbol": quote.symbol,
                "price": quote.price,
                "previous_close": quote.previous_close,
                "volume": quote.volume,
                "fetched_at": quote.fetched_at.isoformat(),
                "source": quote.source,
                "is_stale": quote.is_stale,
                "stale_reason": quote.stale_reason,
            }
            self._redis_client.setex(f"sift:quote:{quote.symbol}", ttl_seconds, json.dumps(payload))
            self._redis_client.set(f"sift:last_known:{quote.symbol}", json.dumps(payload))
        except Exception:
            pass

    def get_quote(self, symbol: str) -> Quote:
        # Check Redis if available
        redis_quote = self._get_from_redis(symbol)
        if redis_quote and (datetime.utcnow() - redis_quote.fetched_at) < self._ttl:
            return redis_quote

        # Check in-memory
        cached = self._cache.get(symbol)
        fresh_enough = cached and (datetime.utcnow() - cached.fetched_at) < self._ttl
        if fresh_enough:
            return cached

        try:
            quote = self._live.get_quote(symbol)
            self._cache[symbol] = quote
            self._save_to_redis(quote, self._ttl_seconds)
            return quote
        except ProviderUnavailableError:
            fallback = cached or redis_quote
            if fallback is not None:
                # Serve last-known-good, explicitly marked stale.
                return Quote(
                    symbol=fallback.symbol,
                    price=fallback.price,
                    previous_close=fallback.previous_close,
                    volume=fallback.volume,
                    fetched_at=fallback.fetched_at,
                    source=fallback.source,
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
