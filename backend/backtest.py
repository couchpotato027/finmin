from yf_session import get_yf_session
# backend/backtest.py
"""FinMin Backtesting Engine

Provides:
- backtest_single(ticker, period="1y") – backtest a single ticker.
- backtest_universe(tickers, period="1y") – run backtests for a list of tickers and aggregate results.

All calculations are vectorised with pandas where possible. Trade simulation is performed
state‑fully but efficiently.
"""

import datetime as dt
from typing import List, Dict, Any

import numpy as np
import pandas as pd
import yfinance as yf

# ---------------------------------------------------------------------------
# Helper: Indicator calculations (vectorised)
# ---------------------------------------------------------------------------

def _calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add RSI, MACD, histogram, MA50, MA200 to the OHLCV DataFrame.
    Expected columns: ['Open', 'High', 'Low', 'Close', 'Volume']
    Returns the original DataFrame with new columns.
    """
    close = df["Close"]

    # RSI (14)
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14, min_periods=14).mean()
    loss = -delta.where(delta < 0, 0).rolling(14, min_periods=14).mean()
    rs = gain / loss
    df["RSI"] = 100 - (100 / (1 + rs))

    # MACD (12,26,9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    df["MACD_Line"] = macd_line
    df["MACD_Signal"] = signal_line
    df["MACD_Hist"] = macd_line - signal_line

    # Moving averages
    df["MA50"] = close.rolling(50, min_periods=50).mean()
    df["MA200"] = close.rolling(200, min_periods=200).mean()

    return df

# ---------------------------------------------------------------------------
# Helper: Signal scoring
# ---------------------------------------------------------------------------

def _generate_signal_score(df: pd.DataFrame) -> pd.DataFrame:
    """Compute daily score and BUY/SELL signals according to the rule set.
    Adds columns: ['Score', 'Signal'] where Signal is 'BUY', 'SELL' or None.
    """
    df = df.copy()
    score = pd.Series(0, index=df.index, dtype=float)

    # RSI contributions
    rsi = df["RSI"]
    score += np.where(rsi < 35, 25, 0)
    score += np.where((rsi >= 35) & (rsi < 40), 15, 0)
    score += np.where(rsi > 65, -15, 0)
    score += np.where(rsi > 70, -25, 0)

    # MACD crossovers (look at last 2 bars)
    bullish_cross = df["MACD_Line"] > df["MACD_Signal"]
    bearish_cross = df["MACD_Line"] < df["MACD_Signal"]

    # MACD histogram trend over 3 bars
    hist = df["MACD_Hist"]
    inc3 = ((hist.shift(2) < hist.shift(1)) & (hist.shift(1) < hist)).to_numpy()
    dec3 = ((hist.shift(2) > hist.shift(1)) & (hist.shift(1) > hist)).to_numpy()

    # Price vs MA50/MA200
    price = df["Close"].to_numpy().flatten()
    ma50 = df["MA50"].to_numpy().flatten()
    ma200 = df["MA200"].to_numpy().flatten()

    rsi = df["RSI"].to_numpy().flatten()

    score = np.zeros(len(df))
    score += np.where(rsi < 35, 25, np.where(rsi < 40, 15, 0))
    score += np.where(rsi > 70, -25, np.where(rsi > 65, -15, 0))
    score += np.where(bullish_cross.to_numpy().flatten(), 40, 0)
    score += np.where(bearish_cross.to_numpy().flatten(), -40, 0)
    score += np.where(inc3, 20, 0)
    score += np.where(dec3, -20, 0)
    score += np.where((price > ma50) & (ma50 > ma200), 25, 0)
    score += np.where((price < ma50) & (ma50 < ma200), -25, 0)

    df["Score"] = score
    df["Signal"] = np.where(score >= 30, "BUY", np.where(score <= -30, "SELL", "HOLD"))
    return df

# ---------------------------------------------------------------------------
# Trade simulation
# ---------------------------------------------------------------------------

def _simulate_trades(df: pd.DataFrame, initial_capital: float = 100_000) -> Dict[str, Any]:
    """Simulate trades based on generated signals.
    Returns a dict with equity curve, trade list and performance metrics.
    """
    capital = initial_capital
    equity_curve = []
    trades = []
    open_positions: List[Dict[str, Any]] = []  # each position dict stores entry info

    # Helper to close a position
    def close_position(pos, exit_price, exit_date, exit_score):
        nonlocal capital
        shares = pos["shares"]
        entry_price = pos["entry_price"]
        entry_capital = pos["allocated"]
        pnl = shares * (exit_price - entry_price)
        capital += entry_capital + pnl  # return allocated capital + profit/loss
        ret_pct = (exit_price - entry_price) / entry_price * 100
        outcome = "WIN" if ret_pct > 0 else "LOSS"
        trades.append({
            "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
            "exit_date": exit_date.strftime("%Y-%m-%d"),
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "return_pct": round(ret_pct, 2),
            "outcome": outcome,
            "signal_score": pos["signal_score"]
        })

    for idx, row in df.iterrows():
        date = idx
        price = row["Close"]
        signal = row["Signal"]
        score = row["Score"]

        # First, check existing positions for forced exit after 5 days
        for pos in open_positions[:]:
            holding_days = (date - pos["entry_date"]).days
            if holding_days >= 5:
                close_position(pos, price, date, score)
                open_positions.remove(pos)

        # Process SELL signal – close any position for this ticker (only one ticker in single backtest)
        if signal == "SELL":
            for pos in open_positions[:]:
                close_position(pos, price, date, score)
                open_positions.remove(pos)

        # Process BUY signal – open new position if capacity allows
        if signal == "BUY" and len(open_positions) < 5:
            allocation = capital * 0.20  # 20% of current capital
            if allocation > 0:
                shares = allocation / price
                pos = {
                    "entry_date": date,
                    "entry_price": price,
                    "allocated": allocation,
                    "shares": shares,
                    "signal_score": score
                }
                capital -= allocation  # lock capital
                open_positions.append(pos)

        # Record equity for the day (capital + market value of open positions)
        market_value = sum(p["shares"] * price for p in open_positions)
        total_equity = capital + market_value
        equity_curve.append({"date": date.strftime("%Y-%m-%d"), "value": round(total_equity, 2)})

    # Close any remaining open positions at last price
    last_date = df.index[-1]
    last_price = df.iloc[-1]["Close"]
    for pos in open_positions:
        close_position(pos, last_price, last_date, df.iloc[-1]["Score"])

    # -----------------------------------------------------------------------
    # Performance metrics
    # -----------------------------------------------------------------------
    equity_series = pd.Series([pt["value"] for pt in equity_curve], index=pd.to_datetime([pt["date"] for pt in equity_curve]))
    total_return_pct = (equity_series.iloc[-1] - initial_capital) / initial_capital * 100
    total_trades = len(trades)
    wins = [t for t in trades if t["outcome"] == "WIN"]
    win_rate = (len(wins) / total_trades * 100) if total_trades > 0 else 0.0
    # Max drawdown
    running_max = equity_series.cummax()
    drawdown = (equity_series - running_max) / running_max * 100
    max_drawdown = drawdown.min()
    # Sharpe ratio (annualised, 252 trading days)
    daily_returns = equity_series.pct_change().dropna()
    risk_free_daily = (1 + 0.06) ** (1 / 252) - 1
    excess_daily = daily_returns - risk_free_daily
    sharpe_ratio = (excess_daily.mean() / excess_daily.std()) * np.sqrt(252) if excess_daily.std() != 0 else 0.0
    # Avg gain / loss
    avg_gain = np.mean([t["return_pct"] for t in wins]) if wins else 0.0
    losses = [t for t in trades if t["outcome"] == "LOSS"]
    avg_loss = np.mean([t["return_pct"] for t in losses]) if losses else 0.0
    best_trade = max([t["return_pct"] for t in trades]) if trades else 0.0
    worst_trade = min([t["return_pct"] for t in trades]) if trades else 0.0

    return {
        "equity_curve": equity_curve,
        "trades": trades,
        "final_capital": round(equity_series.iloc[-1], 2),
        "total_return_pct": round(total_return_pct, 2),
        "total_trades": total_trades,
        "win_rate": round(win_rate, 2),
        "max_drawdown": round(max_drawdown, 2),
        "sharpe_ratio": round(sharpe_ratio, 2),
        "avg_gain": round(avg_gain, 2),
        "avg_loss": round(avg_loss, 2),
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2)
    }

# ---------------------------------------------------------------------------
# Public API – single ticker backtest
# ---------------------------------------------------------------------------

def backtest_single(ticker: str, period: str = "1y", initial_capital: float = 100_000) -> Dict[str, Any]:
    """Run a back‑test for a single ticker.
    Returns a dictionary matching the specification in the request.
    """
    # 1. Fetch data with browser session to avoid blocks on Railway
    session = get_yf_session()
    data = yf.download(ticker, period=period, interval="1d", progress=False, session=session)
    if data.empty:
        raise ValueError(f"No data returned for ticker {ticker}. Verify if the symbol is correct.")
    
    # Handle MultiIndex columns if present (common in recent yfinance versions)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data = data.rename(columns={"Open": "Open", "High": "High", "Low": "Low", "Close": "Close", "Volume": "Volume"})
    data.index = pd.to_datetime(data.index).normalize()

    # 2. Indicators
    data = _calculate_indicators(data)

    # 3. Signal scoring
    data = _generate_signal_score(data)

    # 4. Trade simulation & metrics
    sim = _simulate_trades(data, initial_capital=initial_capital)

    # Assemble final result
    result = {
        "ticker": ticker,
        "period": period,
        "initial_capital": initial_capital,
        "final_capital": sim["final_capital"],
        "total_return_pct": sim["total_return_pct"],
        "total_trades": sim["total_trades"],
        "win_rate": sim["win_rate"],
        "max_drawdown": sim["max_drawdown"],
        "sharpe_ratio": sim["sharpe_ratio"],
        "avg_gain": sim["avg_gain"],
        "avg_loss": sim["avg_loss"],
        "best_trade": sim["best_trade"],
        "worst_trade": sim["worst_trade"],
        "equity_curve": sim["equity_curve"],
        "trades": sim["trades"]
    }
    return result

# ---------------------------------------------------------------------------
# Multi‑ticker backtest
# ---------------------------------------------------------------------------

def backtest_universe(tickers: List[str], period: str = "1y", initial_capital: float = 100_000) -> Dict[str, Any]:
    """Run backtests for a list of tickers and aggregate the results.
    Returns aggregate stats and a per‑ticker breakdown.
    """
    per_ticker = {}
    equity_frames = []
    for tk in tickers:
        res = backtest_single(tk, period=period, initial_capital=initial_capital)
        per_ticker[tk] = res
        # Build equity DataFrame for averaging
        df_eq = pd.DataFrame(res["equity_curve"]).set_index("date")["value"]
        df_eq.index = pd.to_datetime(df_eq.index)
        equity_frames.append(df_eq)

    # Align dates and compute average equity curve
    all_eq = pd.concat(equity_frames, axis=1)
    avg_eq = all_eq.mean(axis=1)
    avg_curve = [{"date": d.strftime("%Y-%m-%d"), "value": round(v, 2)} for d, v in avg_eq.iteritems()]

    # Compute aggregate metrics on the averaged equity curve
    equity_series = avg_eq
    total_return_pct = (equity_series.iloc[-1] - initial_capital) / initial_capital * 100
    daily_returns = equity_series.pct_change().dropna()
    risk_free_daily = (1 + 0.06) ** (1 / 252) - 1
    excess_daily = daily_returns - risk_free_daily
    sharpe_ratio = (excess_daily.mean() / excess_daily.std()) * np.sqrt(252) if excess_daily.std() != 0 else 0.0
    running_max = equity_series.cummax()
    drawdown = (equity_series - running_max) / running_max * 100
    max_drawdown = drawdown.min()

    # Aggregate trade stats
    all_trades = []
    for res in per_ticker.values():
        all_trades.extend(res["trades"])
    total_trades = len(all_trades)
    wins = [t for t in all_trades if t["outcome"] == "WIN"]
    win_rate = (len(wins) / total_trades * 100) if total_trades > 0 else 0.0
    avg_gain = np.mean([t["return_pct"] for t in wins]) if wins else 0.0
    losses = [t for t in all_trades if t["outcome"] == "LOSS"]
    avg_loss = np.mean([t["return_pct"] for t in losses]) if losses else 0.0
    best_trade = max([t["return_pct"] for t in all_trades]) if all_trades else 0.0
    worst_trade = min([t["return_pct"] for t in all_trades]) if all_trades else 0.0

    aggregate = {
        "ticker": "UNIVERSE",
        "period": period,
        "initial_capital": initial_capital,
        "final_capital": round(equity_series.iloc[-1], 2),
        "total_return_pct": round(total_return_pct, 2),
        "total_trades": total_trades,
        "win_rate": round(win_rate, 2),
        "max_drawdown": round(max_drawdown, 2),
        "sharpe_ratio": round(sharpe_ratio, 2),
        "avg_gain": round(avg_gain, 2),
        "avg_loss": round(avg_loss, 2),
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        "equity_curve": avg_curve,
        "trades": all_trades
    }

    return {"aggregate": aggregate, "per_ticker": per_ticker}

# ---------------------------------------------------------------------------
# Simple CLI test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ticker = "TCS.NS"
    result = backtest_single(ticker)
    print(f"Backtest result for {ticker}:")
    print(f"Return: {result['total_return_pct']}%")
    print(f"Win rate: {result['win_rate']}%")
    print(f"Sharpe: {result['sharpe_ratio']}")
    # Optionally, print first few equity points
    print("Equity curve (first 5 days):")
    for pt in result['equity_curve'][:5]:
        print(pt)
