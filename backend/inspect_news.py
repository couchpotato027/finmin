import yfinance as yf
import json
t = yf.Ticker("AAPL")
if t.news:
    print(json.dumps(t.news[0], indent=2))
