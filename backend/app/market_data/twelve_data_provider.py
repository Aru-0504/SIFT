from datetime import datetime
import httpx

from app.config import settings
from app.market_data.base import MarketDataProvider, Quote, ProviderUnavailableError


class TwelveDataProvider(MarketDataProvider):
    """Market quotes and daily history from Twelve Data with pooled HTTP connections."""

    BASE_URL = "https://api.twelvedata.com"
    SOURCE_NAME = "twelve_data"

    def __init__(self, client: httpx.Client | None = None):
        self._client = client or httpx.Client(
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            timeout=10.0,
        )

    def _provider_symbol(self, symbol: str) -> str:
        return f"{symbol[:-3]}:NSE" if symbol.endswith(".NS") else symbol

    def _request(self, endpoint: str, symbol: str, **params) -> dict:
        if not settings.market_data_api_key:
            raise ProviderUnavailableError("Twelve Data API key is not configured")
        try:
            response = self._client.get(
                f"{self.BASE_URL}/{endpoint}",
                params={"symbol": self._provider_symbol(symbol), "apikey": settings.market_data_api_key, **params},
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailableError(f"Twelve Data request failed for {symbol}: {exc}") from exc

        if data.get("status") == "error" or ("code" in data and "values" not in data):
            message = data.get("message", f"No data returned for {symbol}")
            if data.get("code") in {400, 401, 403, 404}:
                raise ProviderUnavailableError(f"Twelve Data rejected {symbol}: {message}")
            raise ProviderUnavailableError(f"Twelve Data unavailable for {symbol}: {message}")
        return data

    def get_quote(self, symbol: str) -> Quote:
        data = self._request("quote", symbol)
        try:
            price = float(data["close"])
            previous_close = float(data["previous_close"])
            fetched_at = datetime.utcnow()
            return Quote(
                symbol=symbol,
                price=price,
                previous_close=previous_close,
                volume=int(float(data.get("volume") or 0)),
                fetched_at=fetched_at,
                source=self.SOURCE_NAME,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ProviderUnavailableError(f"Incomplete Twelve Data quote for {symbol}") from exc

    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        data = self._request("time_series", symbol, interval="1day", outputsize=days)
        try:
            return [float(value["close"]) for value in reversed(data["values"])]
        except (KeyError, TypeError, ValueError) as exc:
            raise ProviderUnavailableError(f"Incomplete Twelve Data history for {symbol}") from exc

    def validate_symbol(self, symbol: str) -> bool:
        try:
            self.get_quote(symbol)
            return True
        except ProviderUnavailableError:
            # Validation and quote retrieval share one provider call. A failed
            # live feed should surface as unavailable rather than invalid.
            return False

    def close(self):
        self._client.close()
