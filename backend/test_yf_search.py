import requests
import json

def test_search(query):
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=5&newsCount=0"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    data = res.json()
    quotes = data.get("quotes", [])
    results = []
    for q in quotes:
        if q.get("quoteType") in ("EQUITY", "ETF", "MUTUALFUND", "INDEX", "CURRENCY", "CRYPTOCURRENCY"):
            results.append({
                "symbol": q.get("symbol"),
                "name": q.get("shortname", q.get("longname", q.get("symbol"))),
                "exchange": q.get("exchange", "Unknown")
            })
    print(json.dumps(results, indent=2))

test_search("pay")
