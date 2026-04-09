import yfinance as yf
import os
import time
from functools import wraps
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from yf_session import get_yf_session
yf.set_tz_cache_location("/tmp/yfinance_cache")
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import json
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import datetime
import requests
from signal_engine import generate_signal, generate_signal_fast
from history import init_db, log_signal, evaluate_outcomes, get_win_rate, get_recent_signals, migrate_timestamps_to_utc
from fastapi import BackgroundTasks
from news import get_news
from cache_config import info_cache, history_cache
from predictor import predict_price
from backtest import backtest_single, backtest_universe

# --- Optimization 1: In-memory TTL cache decorator ---
_cache: Dict[str, Any] = {}

def ttl_cache(seconds: int):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{args}:{kwargs}"
            now = time.time()
            if key in _cache:
                result, ts = _cache[key]
                if now - ts < seconds:
                    return result
            result = func(*args, **kwargs)
            _cache[key] = (result, now)
            return result
        return wrapper
    return decorator

# Thread pool for parallel async execution
executor = ThreadPoolExecutor(max_workers=10)

# Stocks to preload on startup for instant first-load
PRELOAD_TICKERS = [
    "HDFCBANK.NS", "TCS.NS", "RELIANCE.NS",
    "INFY.NS", "ICICIBANK.NS", "AAPL", "TSLA"
]

load_dotenv()

from contextlib import asynccontextmanager
import asyncio

async def run_evaluation_periodically():
    while True:
        try:
            from history import evaluate_outcomes
            evaluate_outcomes()
            print("Signal outcomes evaluated")
        except Exception as e:
            print(f"Evaluation error: {e}")
        await asyncio.sleep(3600)  # run every hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (Always fast)
    try:
        init_db()
        migrate_timestamps_to_utc()
    except Exception as e:
        print(f"DATABASE INITIALIZATION FAILED: {e}")
    
    eval_task = asyncio.create_task(run_evaluation_periodically())
    
    # Optimization 4: Preload popular stocks in background
    async def preload():
        await asyncio.sleep(5)
        loop = asyncio.get_event_loop()
        for ticker in PRELOAD_TICKERS:
            try:
                await loop.run_in_executor(executor, lambda t=ticker: get_cached_history(t, "1mo", "30m"))
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Preload {ticker}: {e}")
        print(f"Preloaded {len(PRELOAD_TICKERS)} tickers")
    
    asyncio.create_task(preload())
    
    print(f"Server started successfully (Environment: {'Render' if os.getenv('RENDER') else 'Local'})")
    yield
    eval_task.cancel()

app = FastAPI(title="FinMin API", lifespan=lifespan)


# Optimization 6: Timestamped health endpoint for Railway keepalive
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "timestamp": time.time(),
        "environment": "Render" if os.getenv("RENDER") else "Local",
        "database": "postgresql" if os.getenv("DATABASE_URL") else "sqlite"
    }


print("\n" + "="*50)
print("FINMIN API BOOTING UP - VERSION v2.1 (CORS FIX)")
print("="*50 + "\n")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optimization 3: GZip compression for all responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.api_route("/api/evaluate", methods=["GET", "POST"])
def trigger_evaluation(force: bool = False):
    from history import evaluate_outcomes, get_win_rate
    evaluate_outcomes(force=force)
    return get_win_rate()

@app.delete("/api/signals/clear")
def clear_signals():
    from history import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM signals")
    conn.commit()
    conn.close()
    return {"success": True, "message": "Signal history cleared"}

@ttl_cache(seconds=3600)
def _fetch_prediction(ticker: str) -> dict:
    result = predict_price(ticker)
    if not result:
        return {"error": "Prediction failed", "ticker": ticker}
    return result

@app.get("/api/predict/{ticker}")
def get_prediction(ticker: str, response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600"
    return _fetch_prediction(ticker)

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


def get_cached_info(ticker: str):
    """
    Fetch and cache ticker metadata (info) which is slow and static.
    Lasts 7 days.
    """
    cache_key = f"info_{ticker.upper()}"
    if cache_key in info_cache:
        return info_cache[cache_key]
    
    try:
        stock = yf.Ticker(ticker)
        # Fetching only essential fields to minimize yfinance overhead
        info = stock.info
        info_cache.set(cache_key, info, expire=604800) # 7 days
        return info
    except Exception as e:
        print(f"Error fetching info for {ticker}: {e}")
        return {}

def get_cached_history(ticker: str, period: str, interval: str):
    """
    Fetch and cache history using memory TTL cache for repeated 10-minute requests.
    """
    cache_key = f"hist_{ticker.upper()}_{period}_{interval}"
    if cache_key in history_cache:
        return history_cache[cache_key]
    
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        if not df.empty:
            history_cache[cache_key] = df
        return df
    except Exception as e:
        import pandas as pd
        print(f"Error fetching history for {ticker}: {e}")
        return pd.DataFrame()

@app.get("/stock/{ticker}/price")
async def get_price_history(ticker: str, period: str = "1mo") -> Dict[str, Any]:
    """
    Returns historical OHLCV data with caching and async execution.
    """
    # Map timeframe to yfinance period/interval
    if period == "1d":
        yf_period, yf_interval = "1d", "1m"
    elif period == "1wk":
        yf_period, yf_interval = "5d", "5m"
    elif period == "1mo":
        yf_period, yf_interval = "1mo", "30m"
    elif period == "1y":
        yf_period, yf_interval = "1y", "1d"
    else:
        yf_period, yf_interval = period, "1d"
        
    # Run yfinance in a separate thread to avoid blocking the event loop
    df = await asyncio.to_thread(get_cached_history, ticker, yf_period, yf_interval)
    info = await asyncio.to_thread(get_cached_info, ticker)
    
    currency = info.get("currency", "USD")
    current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
    
    if df.empty:
        return {"ticker": ticker.upper(), "currency": currency, "current_price": current_price, "data": []}
        
    formatted_data = []
    df_reset = df.reset_index()
    date_col = 'Datetime' if 'Datetime' in df_reset.columns else 'Date'
    
    for _, row in df_reset.iterrows():
        t = row[date_col].isoformat()
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
        "current_price": current_price,
        "data": formatted_data
    }

@app.get("/stock/{ticker}/indicators")
async def get_technical_indicators(ticker: str, period: str = "1y") -> Dict[str, Any]:
    """
    Calculates RSI, MACD, etc. with async/cached execution.
    """
    df = await asyncio.to_thread(get_cached_history, ticker, period, "1d")
    
    import pandas as pd
    import pandas_ta as ta
    
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

@ttl_cache(seconds=30)
def _fetch_price(ticker: str) -> dict:
    """Cached price fetch using three strategies."""
    try:
        t = yf.Ticker(ticker)
        price = None
        prev_close = None
        
        try:
            fast = t.fast_info
            price = fast.last_price or fast.regular_market_price
            prev_close = fast.regular_market_previous_close
        except:
            price = None
            prev_close = None
            
        if price is None or prev_close is None:
            try:
                info = t.info
                price = price or info.get("currentPrice") or info.get("regularMarketPrice")
                prev_close = prev_close or info.get("previousClose")
            except:
                pass
                
        if price is None or prev_close is None:
            hist = t.history(period="5d")
            if not hist.empty:
                price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Close'].iloc[-2]) if len(hist) >= 2 else price
        
        if price is None:
            return {"error": "Price not found", "ticker": ticker, "price": None, "change_pct": 0}
            
        currency = "INR" if ticker.endswith(".NS") or ticker.endswith(".BO") else "USD"
        try:
            currency = t.info.get("currency", currency)
        except:
            pass
            
        change_pct = round((price - prev_close) / prev_close * 100, 2) if prev_close else 0.0
        short_name = ticker.upper()
        try:
            info = t.info
            short_name = info.get("shortName") or info.get("longName") or short_name
        except:
            pass
            
        return {
            "price": round(float(price), 2) if price is not None else None,
            "prev_close": round(float(prev_close), 2) if prev_close else None,
            "change_pct": change_pct,
            "currency": currency,
            "short_name": short_name
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker, "price": None, "change_pct": 0, "currency": "USD"}

@app.get("/api/price/{ticker}")
def get_price(ticker: str, response: Response):
    response.headers["Cache-Control"] = "public, max-age=30"
    return _fetch_price(ticker)

@app.get("/api/exchangerate")
def get_exchange_rate():
    try:
        t = yf.Ticker("USDINR=X")
        df = t.history(period="1d")
        if not df.empty:
            rate = df['Close'].iloc[-1]
            return {"rate": round(float(rate), 2), 
                    "base": "USD", "target": "INR"}
        return {"rate": 84.0, "base": "USD", "target": "INR"}
    except:
        return {"rate": 84.0, "base": "USD", "target": "INR"}

@app.get("/api/news/{ticker}")
def get_news_endpoint(ticker: str, response: Response):
    response.headers["Cache-Control"] = "public, max-age=1800"
    return get_news(ticker)

@ttl_cache(seconds=300)
def _fetch_signal(ticker: str) -> dict:
    """Cached signal generation."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="3mo", interval="1d")
        
        if df.empty:
            return {"error": "Ticker not found", "ticker": ticker}
            
        if df.index.name == 'Date' or 'Date' not in df.columns:
            df = df.reset_index()
            
        result = generate_signal(df, ticker=ticker)
        
        try:
            news_data = get_news(ticker, limit=5)
            n_score = news_data["summary"]["score"]
            n_sentiment = news_data["summary"]["overall"]
            
            result["news_sentiment"] = n_sentiment
            result["news_score"] = n_score
            
            if n_score > 0.2:
                result["score"] += 10
                result["reasons"].append("Positive news sentiment")
            elif n_score < -0.2:
                result["score"] -= 10
                result["reasons"].append("Negative news sentiment")
        except Exception as e:
            print(f"News integration error for {ticker}: {e}")

        result["ticker"] = ticker.upper()
        log_signal(result["ticker"], result["signal"], result["score"], result["price"])
        
        return result
    except Exception as e:
        return {"error": str(e), "ticker": ticker}

@app.get("/api/signal/{ticker}")
def get_ai_signal(ticker: str, response: Response) -> Dict[str, Any]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return _fetch_signal(ticker)

class ScanRequest(BaseModel):
    universe: Optional[str] = None  # nifty50, nifty_next50, etc.
    tickers: Optional[List[str]] = None # Custom list of tickers to scan

def load_universes():
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(current_dir, "universes.json")
        with open(path, "r") as f:
            data = json.load(f)
            return data
    except Exception as e:
        print(f"Error loading universes: {e}")
        return {}

async def scan_ticker(ticker: str, semaphore: asyncio.Semaphore) -> Optional[Dict[str, Any]]:
    async with semaphore:
        try:
            # Use cached history helper which uses get_cached_history internally
            df = await asyncio.to_thread(get_cached_history, ticker, "3mo", "1d")
            
            if df.empty:
                print(f"No data for {ticker}")
                return None
            
            # Reset index if necessary for signal engine
            df_reset = df.reset_index()

            # Ensure 'Date' or 'Datetime' column matches signal engine expectations
            result = generate_signal(df_reset, ticker=ticker)
            if result:
                # Log BUY/SELL signals
                if result.get("signal") in ["BUY", "SELL"]:
                    log_signal(
                        ticker=ticker.upper(),
                        signal=result["signal"],
                        score=result["score"],
                        price=result["price"]
                    )
                print(f"Scanned {ticker} successfully. Signal: {result.get('signal')}")
            return result
        except Exception as e:
            print(f"Error scanning {ticker}: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

_executor = ThreadPoolExecutor(max_workers=15)

@app.post("/api/scan")
async def perform_scan(request: ScanRequest) -> List[Dict[str, Any]]:
    universe = request.universe or "nifty50"
    custom_tickers = request.tickers or []
    
    if custom_tickers:
        tickers = custom_tickers
    else:
        try:
            with open("universes.json") as f:
                universes = json.load(f)
            tickers = universes.get(universe, universes.get("nifty50", []))
        except Exception as e:
            print(f"Universe load error: {e}")
            tickers = ["HDFCBANK.NS", "TCS.NS", "RELIANCE.NS", "INFY.NS"]
            
    loop = asyncio.get_event_loop()
    semaphore = asyncio.Semaphore(15)
    
    async def fetch_one(ticker):
        async with semaphore:
            try:
                return await asyncio.wait_for(
                    loop.run_in_executor(
                        _executor,
                        generate_signal_fast,
                        ticker
                    ),
                    timeout=20.0
                )
            except asyncio.TimeoutError:
                print(f"Timeout: {ticker}")
                return None
            except Exception as e:
                print(f"Error: {ticker}: {e}")
                return None
    
    tasks = [fetch_one(t) for t in tickers]
    results = await asyncio.gather(*tasks)
    
    valid = [r for r in results if r and isinstance(r, dict) and 'ticker' in r]
    
    valid.sort(key=lambda x: x.get('score', 0), reverse=True)
    
    # Log signals to history
    for r in valid:
        if r.get('signal') in ['BUY', 'SELL']:
            try:
                log_signal(
                    ticker=r['ticker'],
                    signal=r['signal'],
                    score=r.get('score', 0),
                    price=r.get('price', 0)
                )
            except Exception as e:
                print(f"Log error: {e}")
    
    return valid

@app.get("/api/search")
def search_tickers(q: str):
    """
    Search for ticker symbols using yfinance.
    Returns: list of {symbol, shortname, exchange}
    """
    if not q or len(q) < 2:
        return []
    
    try:
        search = yf.Search(q, max_results=8)
        results = []
        for quote in search.quotes:
            results.append({
                "symbol": quote.get("symbol"),
                "shortname": quote.get("shortname", quote.get("longname", "")),
                "exchange": quote.get("exchange")
            })
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []

@app.get("/api/history")
def get_signal_history():
    return get_recent_signals()

@app.get("/api/winrate")
def get_accuracy_stats():
    return get_win_rate()

@app.get("/market-scan")
def market_scan() -> List[Dict[str, Any]]:
    """
    Scans a pre-defined list of popular stocks for trading opportunities 
    using the centralized signal engine.
    """
    import pandas as pd
    tickers = [
        "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "NFLX", 
        "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS", "PAYTM.NS"
    ]
    results = []
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="3mo", interval="1d")
            
            if df.empty or len(df) < 30:
                continue
                
            info = stock.info
            current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
            
            analysis = generate_signal(df, ticker=ticker)
            
            results.append({
                "ticker": ticker,
                "price": round(current_price, 2),
                "rsi": analysis["rsi"],
                "macd_signal": analysis["macd_signal"],
                "volume_pulse": analysis["volume_pulse"],
                "volume_ratio": analysis["volume_ratio"],
                "signal": analysis["signal"],
                "score": analysis["score"],
                "confidence": analysis["confidence"],
                "reasons": analysis["reasons"],
                "sector": analysis.get("sector")
            })
            
        except Exception as e:
            print(f"Error scanning {ticker}: {e}")
            
    return results

@app.get("/api/v2/backtest")
def run_backtest_v2(ticker: str, period: str = "1y"):
    print(f"\n>>> [BACKTEST V2] Request for {ticker} ({period})")
    try:
        # ticker like TCS.NS works fine as a query param
        result = backtest_single(ticker, period)
        if not result:
            return {"error": "Backtest failed", "ticker": ticker}
        return result
    except Exception as e:
        print(f"!!! Error in backtest v2: {str(e)} !!!")
        return {"error": str(e), "ticker": ticker}

@app.get("/api/backtest/{ticker}")
def run_backtest_v1(ticker: str, period: str = "1y"):
    return run_backtest_v2(ticker, period)

@app.post("/api/backtest/universe")
def run_universe_backtest(tickers: list[str], period: str = "1y"):
    try:
        result = backtest_universe(tickers, period)
        return result
    except Exception as e:
        return {"error": str(e)}
