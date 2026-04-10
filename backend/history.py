import os
import datetime
import logging
from typing import List, Dict, Any

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    """Returns a connection based on environment (Postgres for production, SQLite for local)."""
    if DATABASE_URL:
        import psycopg2
        # CLEANUP: Remove accidental brackets if user kept them in Render settings
        clean_url = DATABASE_URL.strip().replace(":[", ":").replace("]@", "@")
        try:
            conn = psycopg2.connect(clean_url, connect_timeout=10)
            return conn
        except Exception as e:
            logging.error(f"Postgres connection failed: {e}")
            # Fallback to SQLite if Postgres fails
            import sqlite3
            return sqlite3.connect(DB_PATH)
    else:
        import sqlite3
        return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    if DATABASE_URL:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS signals (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL,
                signal TEXT NOT NULL,
                score INTEGER NOT NULL,
                price_at_signal REAL NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                outcome TEXT,
                price_at_outcome REAL,
                pct_change REAL
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                signal TEXT NOT NULL,
                score INTEGER NOT NULL,
                price_at_signal REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                outcome TEXT,
                price_at_outcome REAL,
                pct_change REAL
            )
        ''')
    conn.commit()
    conn.close()

def log_signal(ticker, signal, score, price):
    if signal not in ["BUY", "SELL"]: return
    conn = get_connection()
    cursor = conn.cursor()
    p = "%s" if DATABASE_URL else "?"
    
    # Check for existing open signal in last 24h
    if DATABASE_URL:
        interval_sql = "timestamp > NOW() - INTERVAL '24 hours'"
    else:
        interval_sql = "timestamp > datetime('now', '-24 hours')"
        
    cursor.execute(f"SELECT id FROM signals WHERE ticker = {p} AND outcome IS NULL AND {interval_sql}", (ticker,))
    if cursor.fetchone():
        conn.close()
        return

    utc_now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(f'''
        INSERT INTO signals (ticker, signal, score, price_at_signal, timestamp)
        VALUES ({p}, {p}, {p}, {p}, {p})
    ''', (ticker, signal, score, price, utc_now))
    conn.commit()
    conn.close()

def evaluate_outcomes(force: bool = False):
    import os
    import yfinance as yf
    from datetime import datetime, timezone, timedelta
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, ticker, signal, 
               price_at_signal, timestamp
        FROM signals 
        WHERE outcome IS NULL
    """)
    pending = cursor.fetchall()
    
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=5)
    
    to_evaluate = []
    for row in pending:
        row_id, ticker, signal, price, ts_str = row
        if force:
            to_evaluate.append((row_id, ticker, signal, price))
            continue
        try:
            ts_str = str(ts_str).strip()
            # Try ISO format first
            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except:
                # Try common SQLite/Postgres format
                ts = datetime.strptime(ts_str[:19], '%Y-%m-%d %H:%M:%S')
                ts = ts.replace(tzinfo=timezone.utc)
            
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            
            if ts <= cutoff:
                to_evaluate.append((row_id, ticker, signal, price))
        except Exception as e:
            print(f"Timestamp parse error {ticker}: {e}")
            to_evaluate.append((row_id, ticker, signal, price))
    
    print(f"Found {len(pending)} pending, evaluating {len(to_evaluate)}")
    p = "%s" if DATABASE_URL else "?"
    
    for row_id, ticker, signal, price_at_signal in to_evaluate:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="5d", interval="1d", actions=False)
            hist = hist.dropna(subset=['Close'])
            
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                pct = round((current_price - price_at_signal) / price_at_signal * 100, 2)
                
                if signal == 'BUY':
                    outcome = 'WIN' if current_price > price_at_signal else 'LOSS'
                elif signal == 'SELL':
                    outcome = 'WIN' if current_price < price_at_signal else 'LOSS'
                else: continue
                
                cursor.execute(f'''
                    UPDATE signals SET
                        outcome = {p},
                        price_at_outcome = {p},
                        pct_change = {p}
                    WHERE id = {p}
                ''', (outcome, current_price, pct, row_id))
                print(f"  {ticker}: {outcome} @ {current_price} ({pct}%)")
        except Exception as e:
            print(f"  Error evaluating {ticker}: {e}")
    
    conn.commit()
    conn.close()
    print("Evaluation complete")

def migrate_timestamps_to_utc():
    # This is a legacy helper for local SQLite migration, 
    # but we'll adapt it to be safe for both.
    if DATABASE_URL: return # Postgres handles time zones better natively

    import sqlite3
    conn = sqlite3.connect(DB_PATH) # Hardcoded sqlite because this is a local fix
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM signals WHERE outcome IS NULL")
    pending = cursor.fetchone()[0]
    if pending > 0:
        cursor.execute("UPDATE signals SET timestamp = datetime(timestamp, '-5 hours', '-30 minutes') WHERE outcome IS NULL")
        conn.commit()
    conn.close()

def get_win_rate():
    conn = get_connection()
    cursor = conn.cursor()
    
    # PostgreSQL vs SQLite for '30 days ago'
    if DATABASE_URL:
        cutoff_sql = "NOW() - INTERVAL '30 days'"
    else:
        cutoff_sql = "(datetime('now', '-30 days'))"
        
    # Total signals
    cursor.execute(f"SELECT COUNT(*) FROM signals WHERE timestamp > {cutoff_sql}")
    total_all = cursor.fetchone()[0]
    
    # Total evaluated
    cursor.execute(f"SELECT COUNT(*) FROM signals WHERE outcome IS NOT NULL AND timestamp > {cutoff_sql}")
    total_evaluated = cursor.fetchone()[0]
    
    # Total wins
    cursor.execute(f"SELECT COUNT(*) FROM signals WHERE outcome = 'WIN' AND timestamp > {cutoff_sql}")
    wins = cursor.fetchone()[0]
    
    win_rate = round(wins / total_evaluated * 100) if total_evaluated > 0 else 0
    
    # Avg Gain
    cursor.execute(f"SELECT AVG(pct_change) FROM signals WHERE outcome = 'WIN' AND timestamp > {cutoff_sql}")
    avg_gain = cursor.fetchone()[0] or 0
    
    # Avg Loss
    cursor.execute(f"SELECT AVG(pct_change) FROM signals WHERE outcome = 'LOSS' AND timestamp > {cutoff_sql}")
    avg_loss = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return {
        "win_rate": int(win_rate),
        "total": int(total_all or 0),
        "evaluated": int(total_evaluated or 0),
        "wins": int(wins or 0),
        "avg_gain": round(float(avg_gain), 2),
        "avg_loss": round(float(avg_loss), 2)
    }

def get_recent_signals(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns the most recent signals from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Cross-compatible query
        p = "%s" if DATABASE_URL else "?"
        cursor.execute(f'''
            SELECT ticker, signal, score, price_at_signal, timestamp, outcome, pct_change 
            FROM signals 
            ORDER BY timestamp DESC 
            LIMIT {p}
        ''', (limit,))
        
        columns = [col[0] for col in cursor.description]
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
            
        cursor.close()
        conn.close()
        return results
    except Exception as e:
        logging.error(f"Error fetching signals: {e}")
        return []
