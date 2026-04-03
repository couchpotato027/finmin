import pandas as pd
import pandas_ta as ta
import yfinance as yf
from cache_config import info_cache, history_cache

SECTOR_INDICES = {
  "Financial Services": "^NSEBANK",
  "Banking": "^NSEBANK", 
  "Insurance": "^NSEBANK",
  "Technology": "^CNXIT",
  "IT": "^CNXIT",
  "Pharma": "^CNXPHARMA",
  "Energy": "^CNXENERGY",
  "Auto": "^CNXAUTO",
  "FMCG": "^CNXFMCG",
}

def get_sector_info(ticker: str) -> dict:
    """ Fetches and caches sector/industry info using persistent disk cache. """
    cache_key = f"info_{ticker.upper()}"
    if cache_key in info_cache:
        info = info_cache[cache_key]
        return {"sector": info.get('sector', 'Other'), "industry": info.get('industry', '')}
    
    try:
        t = yf.Ticker(ticker)
        info = t.info
        info_cache.set(cache_key, info, expire=604800) # 7 days
        return {"sector": info.get('sector', 'Other'), "industry": info.get('industry', '')}
    except:
        return {"sector": "Other", "industry": ""}

def get_sector(ticker: str) -> str:
    """ Convenient wrapper for just the sector string. """
    return get_sector_info(ticker)["sector"]

def get_cached_history(ticker: str, period: str = "2d", interval: str = "1d"):
    """ Shared helper for simple 2D history fetching with caching. """
    cache_key = f"hist_{ticker.upper()}_{period}_{interval}"
    if cache_key in history_cache:
        return history_cache[cache_key]
    
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval)
        if not df.empty:
            history_cache[cache_key] = df
        return df
    except:
        return pd.DataFrame()

def get_sector_momentum(ticker: str) -> float:
  try:
    info = get_sector_info(ticker)
    sector = info.get('sector', '')
    
    index_ticker = None
    for key in SECTOR_INDICES:
      if key.lower() in sector.lower():
        index_ticker = SECTOR_INDICES[key]
        break
    
    if not index_ticker:
      return 0.0
    
    hist = get_cached_history(index_ticker)
    if len(hist) >= 2:
      prev = float(hist['Close'].iloc[-2])
      curr = float(hist['Close'].iloc[-1])
      return round((curr - prev) / prev * 100, 2)
  except:
    pass
  return 0.0

def get_market_breadth() -> float:
  try:
    hist = get_cached_history("^NSEI")
    if len(hist) >= 2:
      prev = float(hist['Close'].iloc[-2])
      curr = float(hist['Close'].iloc[-1])
      return round((curr - prev) / prev * 100, 2)
  except:
    pass
  return 0.0

def generate_signal(df: pd.DataFrame, ticker: str = ""):
    """
    Analyzes historical price data to generate a weighted composite trading signal.
    Score: -100 to +100
    Weights: RSI(25), MACD(40), Volume(20), Trend(15)
    """
    if df.empty or len(df) < 50:  # Need more data for MA50/200
        return {
            "ticker": ticker,
            "price": round(float(df['Close'].iloc[-1]), 2) if not df.empty else 0.0,
            "signal": "HOLD",
            "score": 0,
            "confidence": 0,
            "reasons": ["Insufficient data for analysis (need 50+ points)"],
            "rsi": 50.0,
            "macd_signal": "neutral",
            "volume_pulse": "normal",
            "volume_ratio": 1.0,
            "change_pct": 0.0
        }

    # 1. Indicators Calculation
    df['RSI'] = ta.rsi(df['Close'], length=14)
    macd = ta.macd(df['Close'], fast=12, slow=26, signal=9)
    df = pd.concat([df, macd], axis=1)
    
    df['MA50'] = ta.sma(df['Close'], length=50)
    df['MA200'] = ta.sma(df['Close'], length=200 if len(df) >= 200 else 50) # Fallback
    
    # Volume Median (20-bar window for spike filtering)
    avg_volume = df['Volume'].rolling(20, min_periods=1).median().iloc[-1]
    
    # Latest Data
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]
    prev3 = df.iloc[-4]
    
    rsi = latest.get('RSI', 50)
    
    macd_line = latest.get('MACD_12_26_9', 0)
    macd_signal_line = latest.get('MACDs_12_26_9', 0)
    macd_hist = latest.get('MACDh_12_26_9', 0)
    
    prev_macd = prev.get('MACD_12_26_9', 0)
    prev_signal = prev.get('MACDs_12_26_9', 0)
    prev_hist = prev.get('MACDh_12_26_9', 0)
    prev2_hist = prev2.get('MACDh_12_26_9', 0)
    prev3_hist = prev3.get('MACDh_12_26_9', 0)
    
    vol = latest.get('Volume', 0)
    
    close = latest.get('Close', 0)
    ma50 = latest.get('MA50', close)
    ma200 = latest.get('MA200', ma50)
    
    # Calculate % Today
    prev_close = df['Close'].iloc[-2]
    current = df['Close'].iloc[-1]
    change_pct = round(((current - prev_close) / prev_close) * 100, 2)
    
    score = 0
    reasons = []

    # --- 1. RSI Component (Weight 25) ---
    rsi_comp = 0
    if rsi < 35:
        rsi_comp = 25
        reasons.append(f"Strong RSI oversold ({int(rsi)})")
    elif rsi < 40:
        rsi_comp = 15
        reasons.append(f"Moderate RSI oversold ({int(rsi)})")
    elif rsi > 70:
        rsi_comp = -25
        reasons.append(f"Strong RSI overbought ({int(rsi)})")
    elif rsi > 65:
        rsi_comp = -15
        reasons.append(f"Moderate RSI overbought ({int(rsi)})")
    score += rsi_comp

    # --- 2. MACD Component (Weight 40) ---
    macd_comp = 0
    
    # Strict 2-bar crossover detection
    fresh_bullish_cross = prev_macd <= prev_signal and macd_line > macd_signal_line
    fresh_bearish_cross = prev_macd >= prev_signal and macd_line < macd_signal_line

    if fresh_bullish_cross:
        macd_comp = 40
        reasons.append("Fresh bullish MACD crossover")
    elif fresh_bearish_cross:
        macd_comp = -40
        reasons.append("Fresh bearish MACD crossover")
    else:
        # If no fresh crossover, check histogram trend (last 3 bars)
        if macd_hist > prev_hist > prev2_hist:
            macd_comp = 20
            reasons.append("Bullish MACD histogram pulse")
        elif macd_hist < prev_hist < prev2_hist:
            macd_comp = -20
            reasons.append("Bearish MACD histogram pulse")
    
    score += macd_comp

    # --- 2a. RSI/MACD Divergence Bonus ---
    if rsi < 38 and abs(macd_hist) < abs(prev_hist):
        score += 20
        reasons.append("Bearish momentum fading with oversold RSI")
    elif rsi > 62 and abs(macd_hist) < abs(prev_hist):
        score -= 20
        reasons.append("Bullish momentum fading with overbought RSI")

    # --- 3. Volume Component (Weight 20) ---
    vol_comp = 0
    is_nse = ticker.upper().endswith(".NS")
    
    if is_nse:
        volume_pulse = "n/a"
        vol_ratio = None
    else:
        vol_ratio = vol / avg_volume if avg_volume > 0 else 1.0
        if vol_ratio > 1.5:
            if close > prev['Close']:
                vol_comp = 20
                reasons.append("High volume breakout")
            else:
                vol_comp = -20
                reasons.append("High volume breakdown")
        
        volume_pulse = "normal"
        if vol_ratio > 1.5: volume_pulse = "high"
        elif vol_ratio < 0.6: volume_pulse = "low"

    if not is_nse:
        score += vol_comp

    # --- 4. Trend Component (Weight 15) ---
    trend_comp = 0
    if close > ma50 > ma200:
        trend_comp = 15
        reasons.append("Strong bullish trend alignment")
    elif close < ma50 < ma200:
        trend_comp = -15
        reasons.append("Strong bearish trend alignment")
    score += trend_comp

    # --- 5. Market Breadth & Sector Momentum Filters ---
    market_change = get_market_breadth()
    if market_change < -1.5:
        score -= 10
        reasons.append(f"Broad market weakness ({market_change}%)")
    elif market_change > 1.0:
        score += 5
        reasons.append("Broad market strength")

    sector_momentum = get_sector_momentum(ticker)
    if sector_momentum < -2.0:
        score -= 15
        reasons.append(f"Sector under pressure ({sector_momentum}%)")
    elif sector_momentum > 1.0:
        score += 10
        reasons.append(f"Sector momentum positive ({sector_momentum}%)")

    # Final score normalization (cap at -100 to 100)
    score = max(-100, min(100, score))
    
    # Final signal determination
    # score >= 30 BUY, score <= -30 SELL, else HOLD
    final_signal = "HOLD"
    if score >= 30:
        final_signal = "BUY"
    elif score <= -30:
        final_signal = "SELL"
    
    confidence = min(100, abs(score))

    # MACD Summary State
    macd_summary = "neutral"
    if fresh_bullish_cross:
        macd_summary = "bullish crossover"
    elif fresh_bearish_cross:
        macd_summary = "bearish crossover"
    elif macd_hist > 0:
        macd_summary = "bullish" if macd_hist > prev_hist else "weakening bullish"
    elif macd_hist < 0:
        macd_summary = "bearish" if macd_hist < prev_hist else "weakening bearish"

    # Fetch sector and industry info (cached)
    ticker_info = get_sector_info(ticker)

    return {
        "ticker": ticker,
        "price": round(float(close), 2),
        "signal": final_signal,
        "score": int(score),
        "confidence": int(confidence),
        "reasons": reasons if reasons else ["Neutral market conditions"],
        "rsi": round(float(rsi), 2),
        "macd_signal": macd_summary,
        "volume_pulse": volume_pulse,
        "volume_ratio": round(float(vol_ratio), 2) if vol_ratio is not None else None,
        "change_pct": change_pct,
        "sector": ticker_info.get("sector"),
        "industry": ticker_info.get("industry")
    }
