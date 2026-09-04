from app.market_data.cache import CachedFallbackProvider
from app.market_data.twelve_data_provider import TwelveDataProvider
from app.config import settings

# Single shared instance so the in-memory cache is actually shared across
# all requests/users within this process. If you scale to multiple backend
# processes, this cache should move to Redis — noted as a deliberate,
# stated trade-off rather than something we built and didn't need yet.
market_data_provider = CachedFallbackProvider(live_provider=TwelveDataProvider())
