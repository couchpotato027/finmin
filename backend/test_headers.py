import requests
import feedparser

def test_rss_with_headers(url):
    print(f"Testing {url} with headers...")
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        print(f"  Status: {resp.status_code}")
        # feedparser.parse can take the raw content string
        feed = feedparser.parse(resp.content)
        print(f"  Entries: {len(feed.entries)}")
        if feed.entries:
            print(f"  First: {feed.entries[0].get('title')}")
    except Exception as e:
        print(f"  Error: {e}")

ticker = "AAPL"
yahoo_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}"
test_rss_with_headers(yahoo_url)

et_url = "https://economictimes.indiatimes.com/markets/rss.cms"
test_rss_with_headers(et_url)
