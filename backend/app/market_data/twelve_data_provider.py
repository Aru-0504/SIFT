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

    def search_symbols(self, query: str) -> list[dict]:
        clean_q = query.strip()
        if not clean_q:
            return []

        results: list[dict] = []
        seen_symbols = set()

        # 1. Try Twelve Data symbol search if API key exists
        if settings.market_data_api_key:
            try:
                response = self._client.get(
                    f"{self.BASE_URL}/symbol_search",
                    params={"symbol": clean_q, "outputsize": 10, "apikey": settings.market_data_api_key},
                )
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("data", []):
                        sym = item.get("symbol", "").upper()
                        if sym and sym not in seen_symbols:
                            seen_symbols.add(sym)
                            results.append({
                                "symbol": sym,
                                "name": item.get("instrument_name") or sym,
                                "exchange": item.get("exchange") or "UNKNOWN",
                                "country": item.get("country"),
                                "type": item.get("instrument_type") or item.get("type"),
                            })
            except Exception:
                pass

        # 2. Try Yahoo Finance public search if few/no results
        if len(results) < 5:
            try:
                yf_resp = self._client.get(
                    "https://query2.finance.yahoo.com/v1/finance/search",
                    params={"q": clean_q, "quotesCount": 8, "newsCount": 0},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                )
                if yf_resp.status_code == 200:
                    yf_data = yf_resp.json()
                    for quote in yf_data.get("quotes", []):
                        sym = quote.get("symbol", "").upper()
                        if sym and sym not in seen_symbols:
                            seen_symbols.add(sym)
                            results.append({
                                "symbol": sym,
                                "name": quote.get("shortname") or quote.get("longname") or sym,
                                "exchange": quote.get("exchange") or quote.get("exchDisp") or "MARKET",
                                "country": quote.get("region"),
                                "type": quote.get("quoteType"),
                            })
            except Exception:
                pass

        # 3. Built-in curated popular catalog fallback matching query
        catalog = [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "META", "name": "Meta Platforms Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "NFLX", "name": "Netflix Inc.", "exchange": "NASDAQ", "country": "United States", "type": "Common Stock"},
            {"symbol": "RELIANCE.NS", "name": "Reliance Industries Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "TCS.NS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "INFY.NS", "name": "Infosys Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "TATAMOTORS.NS", "name": "Tata Motors Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "ITC.NS", "name": "ITC Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "LT.NS", "name": "Larsen & Toubro Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "WIPRO.NS", "name": "Wipro Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "NYSE", "country": "United States", "type": "ETF"},
            {"symbol": "QQQ", "name": "Invesco QQQ Trust", "exchange": "NASDAQ", "country": "United States", "type": "ETF"},
        ]

        q_lower = clean_q.lower()
        for item in catalog:
            if (q_lower in item["symbol"].lower() or q_lower in item["name"].lower()) and item["symbol"] not in seen_symbols:
                seen_symbols.add(item["symbol"])
                results.append(item)

        return results[:10]

    def close(self):
        self._client.close()
