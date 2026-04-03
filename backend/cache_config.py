import os
from diskcache import Cache
from cachetools import TTLCache

# Persistent disk cache for static info (sector, names) - lasts 7 days
cache_dir = os.path.join(os.getcwd(), "cache_data")
if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)

info_cache = Cache(cache_dir)

# Short-term memory cache for price history (10 minutes)
# maxsize 200 to accommodate more tickers in memory
history_cache = TTLCache(maxsize=200, ttl=600)
