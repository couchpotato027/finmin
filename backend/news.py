import feedparser
import requests
import os
import urllib.parse
from textblob import TextBlob
from datetime import datetime, timezone
import time
from dotenv import load_dotenv
import yfinance as yf

# Load env in case it's called standalone for testing
load_dotenv()
NEWSAPI_KEY = os.getenv("NEWS_API_KEY", "")

TICKER_SEARCH_OVERRIDE = {
  "BSE.NS": "BSE Limited stock share price",
  "SUZLON.NS": "Suzlon Energy stock",
  "IRCTC.NS": "IRCTC Indian Railway Catering stock",
  "NAUKRI.NS": "Info Edge Naukri stock",
  "IDEA.NS": "Vodafone Idea stock",
  "YESBANK.NS": "YES Bank stock share",
  "PNB.NS": "Punjab National Bank stock",
  "UNIONBANK.NS": "Union Bank India stock",
  "IOC.NS": "Indian Oil Corporation stock",
  "ONGC.NS": "ONGC Oil Natural Gas stock",
  "NHPC.NS": "NHPC Limited hydropower stock",
  "NTPC.NS": "NTPC Limited power stock",
  "SAIL.NS": "SAIL Steel Authority India stock",
  "NMDC.NS": "NMDC Limited mining stock",
}

def time_ago(pub_timestamp):
    try:
        if not pub_timestamp:
            return "recent"
        diff = time.time() - float(pub_timestamp)
        if diff < 0:
            return "just now"
        if diff < 3600:
            mins = int(diff / 60)
            return f"{mins}m ago" if mins > 0 else "just now"
        if diff < 86400:
            hrs = int(diff / 3600)
            return f"{hrs}h ago"
        days = int(diff / 86400)
        return f"{days}d ago"
    except:
        return "recent"

def analyze_sentiment(text):
    blob = TextBlob(text)
    score = blob.sentiment.polarity
    
    positive_words = ["beat","surge","rally","profit","growth",
        "upgrade","record","strong","buy","outperform","dividend",
        "expansion","gains","rises","jumps","soars","bullish"]
    negative_words = ["miss","fall","crash","loss","cut",
        "downgrade","weak","sell","underperform","debt","fraud",
        "probe","decline","slump","drops","falls","bearish",
        "concern","risk","warning"]
    
    text_lower = text.lower()
    for w in positive_words:
        if w in text_lower: score += 0.08
    for w in negative_words:
        if w in text_lower: score -= 0.08
    
    score = max(-1, min(1, score))
    if score > 0.1: sentiment = "positive"
    elif score < -0.1: sentiment = "negative"
    else: sentiment = "neutral"
    return sentiment, round(score, 3)

def get_company_keywords(ticker: str, 
                          short_name: str = "") -> list:
    base = (ticker.replace('.NS','')
                  .replace('.BO','')
                  .replace('.BSE','')
                  .lower())
    keywords = [base]
    
    skip_words = ['the','ltd','limited','inc','corp',
                  'co','and','of','india','indian',
                  'national','new']
    
    if short_name:
      keywords.append(short_name.lower())
      words = short_name.lower().split()
      meaningful = [w for w in words 
                    if w not in skip_words 
                    and len(w) > 2]
      if meaningful:
        keywords.extend(meaningful[:3])
    
    return list(set(keywords))

def is_relevant(title: str, 
                keywords: list) -> bool:
    t = title.lower()
    
    # Must mention at least one keyword
    if not any(kw in t for kw in keywords):
        return False
    
    # Reject roundup articles (3+ companies listed)
    roundup_signals = [
        t.count(', ') >= 3,
        t.count(' and ') >= 2,
        any(phrase in t for phrase in [
            'most traded', 'top gainers', 'top losers',
            'stocks to watch', 'stocks in focus',
            'buzzing stocks', 'active stocks',
            'among the', 'these stocks',
            'multibagger stocks', 'penny stocks'
        ])
    ]
    if any(roundup_signals):
        return False
    
    return True

def get_news(ticker: str, limit: int = 8):
    # FIX 1 — Ticker Resolution
    t_obj = None
    if ticker in TICKER_SEARCH_OVERRIDE:
        try:
            from yfinance import Search
            s = Search(TICKER_SEARCH_OVERRIDE[ticker], max_results=1)
            if s.quotes:
                alt = s.quotes[0].get('symbol', ticker)
                t_obj = yf.Ticker(alt)
        except:
            pass
    
    if not t_obj:
        t_obj = yf.Ticker(ticker)

    try:
        raw_news = t_obj.news
    except:
        raw_news = []

    # Get company short name for better keyword matching
    short_name = ""
    try:
        short_name = t_obj.info.get('shortName', '')
    except:
        pass
  
    keywords = get_company_keywords(ticker, short_name)
  
    # Build all articles first without filtering
    all_articles = []
    for item in raw_news:
        # Support both new yfinance (item['content']) and old formats
        content = item.get('content', item)
        
        title = content.get('title', '')
        if not title:
            continue
            
        publisher = content.get('provider', {}).get('displayName', 'Yahoo Finance') if isinstance(content.get('provider'), dict) else content.get('publisher', 'Yahoo Finance')
        
        # Handle URL source
        url = content.get('canonicalUrl', {}).get('url', '') if isinstance(content.get('canonicalUrl'), dict) else content.get('link', '')
        
        # Handle publication time (ISO string or timestamp)
        pub_time = 0
        raw_pub = content.get('pubDate', content.get('providerPublishTime', 0))
        if isinstance(raw_pub, str):
            try:
                # ISO format '2026-03-30T09:20:25Z'
                pub_time = datetime.fromisoformat(raw_pub.replace('Z', '+00:00')).timestamp()
            except:
                pub_time = time.time()
        else:
            pub_time = raw_pub
            
        sentiment, score = analyze_sentiment(title)
        
        all_articles.append({
            "title": title,
            "source": publisher,
            "url": url,
            "pub_timestamp": pub_time,
            "time_ago": time_ago(pub_time),
            "sentiment": sentiment,
            "sentiment_score": score
        })
  
    # Apply relevance filter
    relevant = [a for a in all_articles if is_relevant(a['title'], keywords)]
  
    # If filter removed too many, fall back to all articles
    articles = relevant if len(relevant) >= 2 else all_articles

    # FIX 3 — Progressive date fallback
    now = time.time()
    
    # Sort by newest first
    articles.sort(key=lambda x: x.get('pub_timestamp', 0), reverse=True)
    
    # Progressive date filter
    cutoffs_days = [30, 90, 180, 365]
    final_articles = articles  # default: all
    
    for days in cutoffs_days:
        cutoff = now - (days * 24 * 60 * 60)
        filtered = [a for a in articles if a.get('pub_timestamp', 0) > cutoff]
        if len(filtered) >= 3:
            final_articles = filtered
            break
    
    # Apply limit
    final_articles = final_articles[:limit]
    
    # Remove pub_timestamp before returning
    for a in final_articles:
        a.pop('pub_timestamp', None)
  
    articles = final_articles

    # Calculate summary stats
    scores = [a['sentiment_score'] for a in articles]
    avg = sum(scores)/len(scores) if scores else 0
    positive = len([s for s in scores if s > 0.1])
    negative = len([s for s in scores if s < -0.1])
    neutral = len(scores) - positive - negative
    
    overall = ("positive" if avg > 0.1 else "negative" if avg < -0.1 else "neutral")
    
    return {
        "articles": articles,
        "summary": {
            "overall": overall,
            "score": round(avg, 3),
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "total": len(articles)
        }
    }
