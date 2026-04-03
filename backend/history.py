import sqlite3
import datetime
import yfinance as yf
import logging

DB_PATH = "finmin_signals.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
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
    logging.info("Database initialized")

def log_signal(ticker, signal, score, price):
    if signal not in ["BUY", "SELL"]:
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check for existing open signal for this ticker in the last 24 hours
    cursor.execute("""
        SELECT id FROM signals 
        WHERE ticker = ? AND outcome IS NULL 
        AND timestamp > datetime('now', '-24 hours')
    """, (ticker,))
    if cursor.fetchone():
        conn.close()
        return

    utc_now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute('''
        INSERT INTO signals (ticker, signal, score, price_at_signal, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (ticker, signal, score, price, utc_now))
    
    conn.commit()
    conn.close()
    logging.info(f"Logged {signal} signal for {ticker} at {utc_now} UTC")

def evaluate_outcomes():
    logging.info("Evaluating pending signals older than 5 days...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Finds signals where outcome IS NULL and timestamp <= datetime('now', '-5 days')
    cursor.execute("""
        SELECT id, ticker, signal, price_at_signal 
        FROM signals 
        WHERE outcome IS NULL 
        AND timestamp <= datetime('now', '-5 days')
    """)
    pending = cursor.fetchall()
    
    for row_id, ticker, signal, price_at_signal in pending:
        try:
            # 2. Fetches current price using yfinance for each
            t = yf.Ticker(ticker)
            # Use period="5d" to get at least 5 days of data
            hist = t.history(period="5d", interval="1d")
            
            if not hist.empty:
                # Use the most recent closing price as the outcome price
                current_price = float(hist['Close'].iloc[-1])
                
                # 3. Calculates pct_change from price_at_signal
                pct = round((current_price - price_at_signal) / price_at_signal * 100, 2)
                
                # 4. Sets outcome = 'WIN' or 'LOSS'
                if signal == 'BUY':
                    outcome = 'WIN' if current_price > price_at_signal else 'LOSS'
                elif signal == 'SELL':
                    outcome = 'WIN' if current_price < price_at_signal else 'LOSS'
                else:
                    continue # Should not happen

                # 5. Updates price_at_outcome and pct_change in DB
                cursor.execute('''
                    UPDATE signals SET 
                        outcome = ?,
                        price_at_outcome = ?,
                        pct_change = ?
                    WHERE id = ?
                ''', (outcome, current_price, pct, row_id))
                logging.info(f"Evaluated {ticker}: {outcome} ({pct}%)")
            
        except Exception as e:
            logging.error(f"Error evaluating {ticker}: {e}")
            
    conn.commit()
    conn.close()

def migrate_timestamps_to_utc():
    logging.info("Checking for timestamp migration to UTC...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if migration already done (finding signals where outcome IS NULL)
    cursor.execute("SELECT COUNT(*) FROM signals WHERE outcome IS NULL")
    pending = cursor.fetchone()[0]
    
    if pending > 0:
        # Subtract 5.5 hours (5h 30m) from all NULL outcome signals (assumed IST)
        cursor.execute("""
            UPDATE signals 
            SET timestamp = datetime(timestamp, '-5 hours', '-30 minutes')
            WHERE outcome IS NULL
        """)
        conn.commit()
        logging.info(f"Migrated {pending} timestamps to UTC")
    
    conn.close()


def get_win_rate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    thirty_days_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
    
    # Total signals (including pending) in last 30 days
    cursor.execute("SELECT COUNT(*) FROM signals WHERE timestamp > ?", (thirty_days_ago,))
    total_all = cursor.fetchone()[0]
    
    # Total evaluated signals in last 30 days
    cursor.execute("SELECT COUNT(*) FROM signals WHERE outcome IS NOT NULL AND timestamp > ?", (thirty_days_ago,))
    total_evaluated = cursor.fetchone()[0]
    
    # Total wins in last 30 days
    cursor.execute("SELECT COUNT(*) FROM signals WHERE outcome = 'WIN' AND timestamp > ?", (thirty_days_ago,))
    wins = cursor.fetchone()[0]
    
    win_rate = round(wins / total_evaluated * 100) if total_evaluated > 0 else 0
    
    # Avg Gain on WINs
    cursor.execute("SELECT AVG(pct_change) FROM signals WHERE outcome = 'WIN' AND timestamp > ?", (thirty_days_ago,))
    avg_gain = cursor.fetchone()[0] or 0
    
    # Avg Loss on LOSSes
    cursor.execute("SELECT AVG(pct_change) FROM signals WHERE outcome = 'LOSS' AND timestamp > ?", (thirty_days_ago,))
    avg_loss = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return {
        "win_rate": int(win_rate),
        "total": total_all,
        "evaluated": total_evaluated,
        "wins": wins,
        "avg_gain": round(avg_gain, 2),
        "avg_loss": round(avg_loss, 2)
    }

def get_recent_signals(limit=50):
    conn = sqlite3.connect(DB_PATH)
    # Return as list of dicts for easy API usage
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
