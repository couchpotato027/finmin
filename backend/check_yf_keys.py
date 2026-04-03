import yfinance as yf
t = yf.Ticker("AAPL")
if t.news:
    print(f"Keys: {t.news[0].keys()}")
    print(f"Sample: {t.news[0]}")
