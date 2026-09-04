from app.market_data.cache import CachedFallbackProvider
from app.market_data.demo_provider import DemoMarketDataProvider
from app.market_data.twelve_data_provider import TwelveDataProvider
from app.config import settings

# Single shared instance so the in-memory cache is actually shared across
# all requests/users within this process. If you scale to multiple backend
# processes, this cache should move to Redis — noted as a deliberate,
# stated trade-off rather than something we built and didn't need yet.
if settings.market_data_mode == "demo":
	provider = DemoMarketDataProvider()
elif settings.market_data_mode == "twelve_data":
	provider = TwelveDataProvider()
else:
	raise ValueError("MARKET_DATA_MODE must be 'demo' or 'twelve_data'")
market_data_provider = CachedFallbackProvider(live_provider=provider)
