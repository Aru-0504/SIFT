from datetime import datetime, timedelta, timezone
import httpx

_cached_rate: float = 83.85
_last_fetched: datetime | None = None
_CACHE_TTL = timedelta(minutes=15)


def get_usd_inr_rate() -> float:
    """Returns the live USD to INR exchange rate, cached for 15 minutes with resilient fallback."""
    global _cached_rate, _last_fetched
    now = datetime.now(timezone.utc)

    if _last_fetched and (now - _last_fetched) < _CACHE_TTL:
        return _cached_rate

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        with httpx.Client(timeout=6.0) as client:
            resp = client.get(
                "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X",
                params={"interval": "1d", "range": "1d"},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                result = data.get("chart", {}).get("result")
                if result and len(result) > 0:
                    meta = result[0].get("meta", {})
                    price = float(meta.get("regularMarketPrice") or 0.0)
                    if price > 0:
                        _cached_rate = round(price, 4)
                        _last_fetched = now
                        return _cached_rate
    except Exception:
        # Silently keep last good rate or default
        pass

    return _cached_rate


def get_forex_summary() -> dict:
    rate = get_usd_inr_rate()
    last_dt = _last_fetched or datetime.now(timezone.utc)
    return {
        "base": "USD",
        "quote": "INR",
        "rate": rate,
        "last_updated": last_dt.isoformat().replace("+00:00", "Z"),
    }

