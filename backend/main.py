import yfinance as yf
import pandas as pd
import pandas_ta as ta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import datetime
import requests
app = FastAPI(title="FinMin API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_dateForLightweightCharts(date_val):
    # Lightweight charts needs YYYY-MM-DD or unix timestamp
    return date_val.strftime('%Y-%m-%d')

@app.get("/search")
def search_tickers(q: str = "") -> List[Dict[str, str]]:
    """
    Returns matching stock tickers and company names dynamically using Yahoo Finance search.
    """
    if not q.strip():
        # Default top tickers if empty
        return [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NMS"},
            {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NMS"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NMS"},
            {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange": "NMS"}
        ]
        
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=8&newsCount=0"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers, timeout=5)
        data = res.json()
        quotes = data.get("quotes", [])
        results = []
        for quote in quotes:
            if quote.get("quoteType") in ("EQUITY", "ETF", "MUTUALFUND", "INDEX", "CURRENCY", "CRYPTOCURRENCY"):
                symbol = quote.get("symbol")
                name = quote.get("shortname", quote.get("longname", symbol))
                exch = quote.get("exchange", "Unknown")
                results.append({"symbol": symbol, "name": name, "exchange": exch})
        return results
    except Exception as e:
        print(f"Error fetching search results: {e}")
        return []

@app.get("/stock/{ticker}/price")
def get_price_history(ticker: str, period: str = "1mo") -> Dict[str, Any]:
    """
    Returns historical OHLCV data formatted for TradingView Lightweight Charts,
    along with currency information.
    """
    stock = yf.Ticker(ticker)
    
    # Map timeframe to yfinance period/interval
    if period == "1d":
        yf_period = "1d"
        yf_interval = "5m"
    elif period == "1wk":
        yf_period = "5d"
        yf_interval = "30m"
    elif period == "1mo":
        yf_period = "1mo"
        yf_interval = "1d"
    elif period == "1y":
        yf_period = "1y"
        yf_interval = "1d"
    else:
        yf_period = period
        yf_interval = "1d"
        
    df = stock.history(period=yf_period, interval=yf_interval)
    
    currency = "USD"
    try:
        info = stock.info
        currency = info.get("currency", "USD")
    except Exception:
        pass
        
    if df.empty:
        return {"ticker": ticker.upper(), "currency": currency, "data": []}
        
    formatted_data = []
    # Reset index to access Date or Datetime
    df_reset = df.reset_index()
    date_col = 'Datetime' if 'Datetime' in df_reset.columns else 'Date'
    
    for _, row in df_reset.iterrows():
        val = row[date_col]
        t = val.isoformat()
            
        formatted_data.append({
            "time": t,
            "open": round(row['Open'], 4),
            "high": round(row['High'], 4),
            "low": round(row['Low'], 4),
            "close": round(row['Close'], 4),
            "volume": int(row['Volume'])
        })
        
    return {
        "ticker": ticker.upper(),
        "currency": currency,
        "data": formatted_data
    }

@app.get("/stock/{ticker}/indicators")
def get_technical_indicators(ticker: str, period: str = "1y") -> Dict[str, Any]:
    """
    Calculates and returns RSI, MACD, MA50, MA200.
    """
    stock = yf.Ticker(ticker)
    df = stock.history(period=period)
    
    if df.empty or len(df) < 200:
        return {"error": "Not enough data to calculate all indicators (need 200 days)."}
        
    # Calculate indicators using pandas-ta
    df['rsi'] = ta.rsi(df['Close'], length=14)
    macd = ta.macd(df['Close'], fast=12, slow=26, signal=9)
    df = pd.concat([df, macd], axis=1) # Adds MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
    
    df['ma50'] = ta.sma(df['Close'], length=50)
    df['ma200'] = ta.sma(df['Close'], length=200)
    
    # We only want to return the continuous series for charting
    # Lightweight charts expects [{time, value}, {time, value}] for line series
    df_reset = df.reset_index().dropna(subset=['rsi']) # Drop early NaNs safely
    
    rsi_data = []
    macd_data = []
    ma50_data = []
    ma200_data = []
    
    for _, row in df_reset.iterrows():
        t = format_dateForLightweightCharts(row['Date'])
        
        rsi_data.append({"time": t, "value": round(row['rsi'], 2)})
        
        # MACD: Format as a list of dicts with macd, signal, hist keys
        if pd.notna(row.get('MACD_12_26_9')):
            macd_data.append({
                "time": t, 
                "macd": round(row['MACD_12_26_9'], 3),
                "signal": round(row['MACDs_12_26_9'], 3),
                "hist": round(row['MACDh_12_26_9'], 3)
            })
            
        # MAs
        if pd.notna(row['ma50']):
            ma50_data.append({"time": t, "value": round(row['ma50'], 2)})
        if pd.notna(row['ma200']):
            ma200_data.append({"time": t, "value": round(row['ma200'], 2)})
            
    return {
        "rsi": rsi_data,
        "macd": macd_data,
        "ma50": ma50_data,
        "ma200": ma200_data
    }

@app.get("/stock/{ticker}/signal")
def get_ai_signal(ticker: str) -> Dict[str, Any]:
    """
    Returns a simulated AI trading signal based on the requested ticker.
    In a real app, this would query the ML engine and DB.
    """
    # Simply simulate a dynamic-looking response based on ticker hash or random logic, 
    # but for AAPL we'll hardcode what the user requested.
    if ticker.upper() == "AAPL":
        return {
            "ticker": "AAPL",
            "signal": "BUY",
            "confidence": 87,
            "reasons": [
                "Positive news sentiment detected",
                "MACD bullish crossover",
                "Volume anomaly detected"
            ]
        }
    else:
        # Generic response for other stocks
        return {
            "ticker": ticker.upper(),
            "signal": "HOLD",
            "confidence": 62,
            "reasons": [
                "Sentiment is neutral",
                "Price action is choppy",
                "Awaiting breakout confirmation"
            ]
        }
