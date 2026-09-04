from datetime import datetime

import yfinance as yf

from app.market_data.base import MarketDataProvider, Quote, ProviderUnavailableError, InvalidSymbolError


class YFinanceProvider(MarketDataProvider):
    """
    Real market data via yfinance. No API key required. Wraps every call so
    that any failure (timeout, empty response, rate limiting, bad symbol)
    surfaces as one of our own exception types rather than leaking a raw
    library error up to the API layer — callers only ever have to handle
    ProviderUnavailableError / InvalidSymbolError.
    """

    SOURCE_NAME = "yfinance"

    def get_quote(self, symbol: str) -> Quote:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price = float(info.get("last_price"))
            previous_close = float(info.get("previous_close"))
            volume = int(info.get("last_volume") or 0)

            if price is None or previous_close is None:
                raise ProviderUnavailableError(f"Incomplete quote data for {symbol}")

            return Quote(
                symbol=symbol,
                price=price,
                previous_close=previous_close,
                volume=volume,
                fetched_at=datetime.utcnow(),
                source=self.SOURCE_NAME,
                is_stale=False,
            )
        except ProviderUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any upstream failure
            raise ProviderUnavailableError(f"yfinance failed for {symbol}: {exc}") from exc

    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=f"{days}d")
            if hist.empty:
                raise ProviderUnavailableError(f"No history for {symbol}")
            return [float(c) for c in hist["Close"].tolist()]
        except ProviderUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderUnavailableError(f"yfinance history failed for {symbol}: {exc}") from exc

    def validate_symbol(self, symbol: str) -> bool:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            return info.get("last_price") is not None
        except Exception:
            return False
