from datetime import datetime, timezone
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

    def _fetch_yahoo_chart(self, symbol: str) -> dict:
        clean_sym = symbol.strip().upper()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_sym}"
        try:
            resp = self._client.get(
                url,
                params={"interval": "1d", "range": "1mo"},
                headers=headers,
                timeout=8.0,
            )
            if resp.status_code != 200:
                raise ProviderUnavailableError(f"Yahoo Finance returned status {resp.status_code} for {clean_sym}")
            data = resp.json()
            result = data.get("chart", {}).get("result")
            if not result or not isinstance(result, list) or len(result) == 0:
                raise ProviderUnavailableError(f"No chart data found for {clean_sym}")
            return result[0]
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailableError(f"Yahoo Finance request failed for {clean_sym}: {exc}") from exc

    def get_quote(self, symbol: str) -> Quote:
        # Try Twelve Data first if API key is provided
        if settings.market_data_api_key:
            try:
                data = self._request("quote", symbol)
                price = float(data["close"])
                previous_close = float(data["previous_close"])
                fetched_at = datetime.now(timezone.utc)
                currency = "INR" if (symbol.endswith(".NS") or symbol.endswith(".BO")) else "USD"
                return Quote(
                    symbol=symbol,
                    price=price,
                    previous_close=previous_close,
                    volume=int(float(data.get("volume") or 0)),
                    fetched_at=fetched_at,
                    source=self.SOURCE_NAME,
                    currency=currency,
                )
            except ProviderUnavailableError:
                pass

        # Fallback to Yahoo Finance (supports US + NSE .NS tickers, free and resilient)
        try:
            chart = self._fetch_yahoo_chart(symbol)
            meta = chart.get("meta", {})
            indicators = chart.get("indicators", {}).get("quote", [{}])[0]
            raw_closes = [c for c in indicators.get("close", []) if c is not None]

            price = float(meta.get("regularMarketPrice") or (raw_closes[-1] if raw_closes else 0.0))
            prev_close = float(
                meta.get("chartPreviousClose")
                or meta.get("previousClose")
                or (raw_closes[-2] if len(raw_closes) > 1 else price)
            )
            volume = int(meta.get("regularMarketVolume") or 0)

            if price <= 0:
                raise ProviderUnavailableError(f"Invalid price data for {symbol}")

            currency = "INR" if (symbol.endswith(".NS") or symbol.endswith(".BO")) else "USD"
            return Quote(
                symbol=symbol,
                price=round(price, 2),
                previous_close=round(prev_close, 2),
                volume=volume,
                fetched_at=datetime.now(timezone.utc),
                source="yahoo_finance",
                currency=currency,
            )
        except Exception as exc:
            raise ProviderUnavailableError(f"Market quote unavailable for {symbol}: {exc}") from exc

    def get_recent_history(self, symbol: str, days: int = 10) -> list[float]:
        # Try Twelve Data first if API key is provided
        if settings.market_data_api_key:
            try:
                data = self._request("time_series", symbol, interval="1day", outputsize=days)
                return [float(value["close"]) for value in reversed(data["values"])]
            except ProviderUnavailableError:
                pass

        # Fallback to Yahoo Finance
        try:
            chart = self._fetch_yahoo_chart(symbol)
            indicators = chart.get("indicators", {}).get("quote", [{}])[0]
            raw_closes = [float(c) for c in indicators.get("close", []) if c is not None]
            if not raw_closes:
                raise ProviderUnavailableError(f"No historical closes found for {symbol}")
            return [round(c, 2) for c in raw_closes[-days:]]
        except Exception as exc:
            raise ProviderUnavailableError(f"History unavailable for {symbol}: {exc}") from exc

    def validate_symbol(self, symbol: str) -> bool:
        try:
            self.get_quote(symbol)
            return True
        except ProviderUnavailableError:
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

        # 2. Try Yahoo Finance public search
        queries_to_try = [clean_q]
        if not (clean_q.endswith(".NS") or clean_q.endswith(".BO")):
            queries_to_try.append(f"{clean_q}.NS")

        for q_attempt in queries_to_try:
            if len(results) >= 5:
                break
            try:
                yf_resp = self._client.get(
                    "https://query2.finance.yahoo.com/v1/finance/search",
                    params={"q": q_attempt, "quotesCount": 8, "newsCount": 0},
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
            {"symbol": "TATASTEEL.NS", "name": "Tata Steel Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "ITC.NS", "name": "ITC Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "LT.NS", "name": "Larsen & Toubro Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "WIPRO.NS", "name": "Wipro Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "MARUTI.NS", "name": "Maruti Suzuki India Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "ZOMATO.NS", "name": "Zomato Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "ADANIENT.NS", "name": "Adani Enterprises Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "AXISBANK.NS", "name": "Axis Bank Ltd", "exchange": "NSE", "country": "India", "type": "Common Stock"},
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "NYSE", "country": "United States", "type": "ETF"},
            {"symbol": "QQQ", "name": "Invesco QQQ Trust", "exchange": "NASDAQ", "country": "United States", "type": "ETF"},
        ]

        q_lower = clean_q.lower()
        for item in catalog:
            sym_clean = item["symbol"].split(".")[0].lower()
            if (q_lower in item["symbol"].lower() or q_lower == sym_clean or q_lower in item["name"].lower()) and item["symbol"] not in seen_symbols:
                seen_symbols.add(item["symbol"])
                results.append(item)

        return results[:10]

    def close(self):
        self._client.close()

