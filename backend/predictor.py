# backend/predictor.py
from cache_config import history_cache
import yfinance as yf
from datetime import datetime, timedelta
import asyncio
from typing import Dict, Any

def backtest_single(ticker: str, period: str = "1y"):
    """ Simulates trade logic on historical data to verify signal accuracy. """
    import numpy as np
    import pandas as pd
    from signal_engine import generate_signal
    
    # Run in a thread if called from an async route
    pass

def get_cached_history(ticker: str, period: str = "6mo", interval: str = "1d"):
    """ Shared helper for consistent history caching. """
    import pandas as pd
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

def predict_price(ticker: str, days: int = 5) -> Dict[str, Any]:
    """ USES ML (Linear Regression) to predict future price trends based on historical momentum. """
    try:
        import numpy as np
        import pandas as pd
        
        # Use cached history for speed
        df = get_cached_history(ticker, period="1y", interval="1d")

        if df.empty or len(df) < 30:
            return None

        df = df.copy()

        # Calculate technical features
        # RSI
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = -delta.where(delta < 0, 0).rolling(14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # MACD
        ema12 = df['Close'].ewm(span=12).mean()
        ema26 = df['Close'].ewm(span=26).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']

        # Moving averages
        df['ma5'] = df['Close'].rolling(5).mean()
        df['ma20'] = df['Close'].rolling(20).mean()

        # Volume normalized
        df['vol_norm'] = df['Volume'] / df['Volume'].rolling(20).mean()

        # Price momentum
        df['momentum'] = df['Close'].pct_change(5)

        # Day index
        df['day_idx'] = range(len(df))

        # Drop NaN rows
        df = df.dropna()

        if len(df) < 20:
            return None

        # Features and target
        feature_cols = ['day_idx', 'rsi', 'macd_hist',
                        'vol_norm', 'momentum', 'ma5', 'ma20']

        # Use all but last 5 rows for training
        train_df = df[:-5] if len(df) > 10 else df

        X_train = train_df[feature_cols].values
        y_train = train_df['Close'].values

        # Numpy standard scaling
        mean_x = np.mean(X_train, axis=0)
        std_x = np.std(X_train, axis=0)
        std_x[std_x == 0] = 1.0 # Protect against divide by zero
        X_train_scaled = (X_train - mean_x) / std_x

        # Add bias column (ones) for multivariate linear regression
        X_bias = np.column_stack([np.ones(X_train_scaled.shape[0]), X_train_scaled])

        # Calculate exact weights via Ordinary Least Squares
        w, _, _, _ = np.linalg.lstsq(X_bias, y_train, rcond=None)

        # Calculate R² score on training data
        y_pred_train = np.dot(X_bias, w)
        ss_res = np.sum((y_train - y_pred_train)**2)
        ss_tot = np.sum((y_train - np.mean(y_train))**2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        if r2 > 0.85:
            confidence = "high"
        elif r2 > 0.70:
            confidence = "medium"
        else:
            confidence = "low"

        # Get last known values for feature continuation
        last_row = df.iloc[-1]
        last_idx = int(last_row['day_idx'])
        last_rsi = float(last_row['rsi'])
        last_macd_hist = float(last_row['macd_hist'])
        last_vol_norm = float(last_row['vol_norm'])
        last_momentum = float(last_row['momentum'])
        last_ma5 = float(last_row['ma5'])
        last_ma20 = float(last_row['ma20'])

        # Predict next 5 days
        predictions = []
        base_date = datetime.now()

        # Skip weekends
        def next_trading_day(d, offset):
            d = d + timedelta(days=offset)
            while d.weekday() >= 5:
                d += timedelta(days=1)
            return d

        current_date = base_date
        for i in range(5):
            # Advance to the next trading day from current_date
            current_date = current_date + timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date = current_date + timedelta(days=1)

            # Slight momentum continuation for features
            future_features = np.array([[
                last_idx + i + 1,
                last_rsi + (i * 0.5),           # slight RSI drift
                last_macd_hist * (0.9 ** i),     # MACD decay
                1.0,                             # normal volume
                last_momentum * (0.8 ** i),      # momentum decay
                last_ma5 * (1 + last_momentum * 0.1),
                last_ma20
            ]])

            future_scaled = (future_features - mean_x) / std_x
            future_input = np.column_stack([np.ones(1), future_scaled])
            pred_price = float(np.dot(future_input, w)[0])

            predictions.append({
                "day": i + 1,
                "date": current_date.strftime("%Y-%m-%d"),
                "price": round(pred_price, 2)
            })

        # Support and resistance from last 30 days
        recent = df.tail(30)
        support = round(float(recent['Close'].min()), 2)
        resistance = round(float(recent['Close'].max()), 2)
        current_price = round(float(df['Close'].iloc[-1]), 2)

        # Trend direction
        pred_final = predictions[-1]['price']
        if pred_final > current_price * 1.02:
            trend = "bullish"
        elif pred_final < current_price * 0.98:
            trend = "bearish"
        else:
            trend = "neutral"

        # Last 10 actual prices for chart
        actual_prices = []
        for i, (idx, row) in enumerate(df.tail(10).iterrows()):
            actual_prices.append({
                "day": -(9 - i),
                "date": idx.strftime("%Y-%m-%d"),
                "price": round(float(row['Close']), 2)
            })

        return {
            "ticker": ticker,
            "current_price": current_price,
            "predictions": predictions,
            "actual": actual_prices,
            "trend": trend,
            "confidence": confidence,
            "r2_score": round(r2, 3),
            "support": support,
            "resistance": resistance
        }

    except Exception as e:
        print(f"Prediction error for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        return None
