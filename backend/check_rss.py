import feedparser
import requests
import time

def check_feed(url):
    print(f"Checking {url}...")
    try:
        # Feedparser 
        feed = feedparser.parse(url)
        print(f"  Entries found: {len(feed.entries)}")
        if feed.entries:
            print(f"  First entry title: {feed.entries[0].get('title')}")
    except Exception as e:
        print(f"  Error: {e}")

# Yahoo Finance RSS
ticker = "AAPL"
yahoo_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
check_feed(yahoo_url)

# IT MARKETS RSS
et_url = "https://economictimes.indiatimes.com/markets/rss.cms"
check_feed(et_url)

# Moneycontrol RSS
mc_url = "https://www.moneycontrol.com/rss/MCtopnews.xml"
check_feed(mc_url)
