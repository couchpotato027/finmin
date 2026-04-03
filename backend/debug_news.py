from news import get_news
import json

# Test with a US ticker (fallback to Yahoo)
aapl_news = get_news("AAPL")
print("\n=== AAPL NEWS ===")
print(json.dumps(aapl_news["summary"], indent=2))
if aapl_news["articles"]:
    print(f"First article title: {aapl_news['articles'][0]['title']}")
else:
    print("No articles found for AAPL via Yahoo RSS.")

# Test with an Indian ticker
rel_news = get_news("RELIANCE.NS")
print("\n=== RELIANCE.NS NEWS ===")
print(json.dumps(rel_news["summary"], indent=2))
if rel_news["articles"]:
    print(f"First article title: {rel_news['articles'][0]['title']}")
else:
    print("No articles found for RELIANCE.NS. Checking search terms...")
    import yfinance as yf
    try:
        info = yf.Ticker("RELIANCE.NS").info
        name = info.get('shortName', "N/A")
        print(f"Short Name: {name}")
        search_terms = name.split()[:2]
        print(f"Search Terms: {search_terms}")
    except:
        print("Failed to get info for RELIANCE.NS")
