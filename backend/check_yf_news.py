import yfinance as yf
t = yf.Ticker("AAPL")
print(f"Ticker: {t.ticker}")
print(f"News count: {len(t.news)}")
for n in t.news[:3]:
    print(f"- {n['title']}")
