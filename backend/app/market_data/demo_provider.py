from datetime import datetime
import math

from app.market_data.base import MarketDataProvider, Quote


class DemoMarketDataProvider(MarketDataProvider):
    """Deterministic quotes for local demos when a live feed is unavailable."""

    QUOTES = {
        "RELIANCE.NS": (2940.00, 2895.00),
        "TCS.NS": (4210.00, 4188.00),
        "HDFCBANK.NS": (1765.00, 1752.00),
        "AAPL": (229.50, 227.80),
        "NVDA": (142.20, 139.60),
    }

    def get_quote(self, symbol: str) -> Quote:
        base_price, previous_close = self.QUOTES[symbol]
        # A deterministic oscillation makes demo polling visibly live and
        # produces a reviewable movement on the next 45-second poll.
        phase = datetime.utcnow().timestamp() / 45
        price = base_price * (1 + 0.02 * math.sin(phase))
        return Quote(
            symbol=symbol,
            price=price,
            previous_close=previous_close,
            volume=0,
            fetched_at=datetime.utcnow(),
            source="demo",
            is_stale=False,
            stale_reason=None,
        )

    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        price, _ = self.QUOTES[symbol]
        return [price * factor for factor in (0.985, 0.99, 1.005, 0.995, 1.0)]

    def validate_symbol(self, symbol: str) -> bool:
        return symbol in self.QUOTES
