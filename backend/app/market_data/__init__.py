from app.market_data.cache import CachedFallbackProvider
from app.market_data.twelve_data_provider import TwelveDataProvider

# Single shared instance with caching and fallback
market_data_provider = CachedFallbackProvider(live_provider=TwelveDataProvider())
