# FinMin

Welcome to the **FinMin** repository! This is a complete, AI-augmented quantitative stock analysis and market scanning platform. 

This document is written so that **anyone**, even without prior quantitative finance or advanced programming knowledge, can understand exactly what this system does, how the parts fit together, and how data moves through the application.

---

## 🎯 What is FinMin?
FinMin is an automated stock market analysis tool. Instead of manually looking at charts all day to decide if a stock is a good "Buy" or "Sell", FinMin rapidly scans thousands of data points for you in the background. It analyzes price momentum, trading volume, and highly mathematical indicators (like RSI and MACD) to alert you to high-probability trade setups before the rest of the market reacts.

It acts as your personalized, AI-driven stock screener and portfolio tracking assistant.

---

## 🏗️ System Architecture

FinMin is split into two primary pieces that talk to each other: the **Frontend** (what you see) and the **Backend** (the brain doing the heavy lifting).

### 1. The Frontend (React/Vite)
- **Role:** Handles the User Interface (UI), dynamic charts, smooth animations, and interactivity.
- **Tech Stack:** React (TypeScript), Tailwind CSS (for modern UI styling), Vite (for ultra-fast web compiling), and lightweight chart libraries (like TradingView Lightweight Charts).
- **Hosting Location:** Hosted on **Vercel**, which delivers the website rapidly to users globally.

### 2. The Backend (FastAPI / Server)
- **Role:** Acts as the data crunching engine. The frontend asks the backend questions (e.g., "Scan the Nifty 50 stocks and give me the best trades"), and the backend does the actual math, talks to external data providers, and sends the answers back.
- **Tech Stack:** Python, FastAPI (for extremely fast request handling), Pandas & Pandas-TA (for mathematical data modeling and formulas).
- **Database:** Uses **SQLite** (or PostgreSQL via Supabase) to permanently remember your stock signals and backtest their historical win rates.
- **Hosting Location:** Hosted on **Render.com** (or Railway), handling persistent long-running background tasks.

---

## ⚙️ How data flows (The Data Pipeline)

How exactly does FinMin decide a stock is a "Buy"? It follows a strict data pipeline built into the backend:

### Step 1: Data Ingestion (`yfinance`)
When you request a scan, the backend connects to an external stock data provider (Yahoo Finance via the `yfinance` library). It downloads the last 3 to 12 months of daily price information (Open, High, Low, Close prices, and Volume) for the requested stocks. 
*Note: We heavily cache this data using memory rules so we don't bombard the provider and slow down the app.*

### Step 2: Technical Processing (`pandas-ta`)
Once we have the raw price data, we feed it into our mathematical engine. We calculate several key "Indicators":
- **RSI (Relative Strength Index):** Tells us if a stock is overbought (too expensive too fast) or oversold (price crashed artificially fast).
- **MACD (Moving Average Convergence Divergence):** Measures changes in trend momentum to see if buyers or sellers are taking control.
- **Moving Averages (50-Day, 200-Day):** Measures the long-term baseline smooth trend.

### Step 3: Central Signal Engine (`signal_engine.py`)
This is the heart of FinMin. It takes the output from Step 2 and generates a **Weighted Score** from `-100` to `+100`.
- **RSI Score:** Accounts for 25% of the total rating.
- **MACD Score:** Accounts for 40% (since detecting trend reversals early is critical).
- **Volume Ratio:** Accounts for 20% (sudden spikes in trading volume indicate big institutional money).
- **Overall Trend:** Accounts for 15%.

If the final combined mathematics result in a score **>= 30**, it flags as a **BUY**. If it drops **<= -30**, it flags as a **SELL**. Everything else is a **HOLD**.

### Step 4: Outcome Evaluation & Win Rate Logging (`history.py`)
FinMin keeps itself honest. Every time it issues a BUY or SELL signal, it securely logs that signal into a Database. 
Every 24 hours, a background process runs an **Evaluation Engine**. It looks at signals that were issued exactly 5 days ago and checks what happened to the stock price. 
- If the stock price went *up* after a BUY signal, it marks it as a **WIN**.
- If it went *down*, it marks it as a **LOSS**.
It then calculates a "Win Rate Accuracy" percentage that is displayed transparently on your dashboard.

---

## 📁 Codebase Structure

If you're looking around the files, here's what everything does:

```text
finmin/
├── frontend/                   # 🎨 The React visually-driven web app
│   ├── src/
│   │   ├── components/         # Reusable UI pieces (TopBar, Sidebar, formatting)
│   │   ├── pages/              # The main screens (Dashboard, Scanner, Portfolio, Analytics)
│   │   └── api.ts              # Contains logic for talking to the Backend securely
│   └── package.json            # Node.js frontend dependencies (React, Tailwind, Axios)
│
├── backend/                    # 🧠 The Python analytics engine
│   ├── main.py                 # The central FastAPI server and API endpoints (/api/scan)
│   ├── signal_engine.py        # The advanced multi-factor mathematical scoring model
│   ├── history.py              # Connects to the Database to evaluate past WIN/LOSS traits
│   ├── news.py                 # (Optional) Fetches market sentiment and news RSS feeds
│   ├── requirements.txt        # Python dependencies (pandas, fastAPI, yfinance etc.)
│   └── Procfile                # Tells cloud hosting providers how to start the server
│
└── deployment_guide.md         # A cheat sheet for pushing this project to live URLs
```

---

## 🚀 Getting Started Locally

Want to run everything on your own laptop? Follow these simple steps.

### 1. Start the Backend
You need Python installed. Open your terminal:
```bash
cd backend
python3 -m venv venv           # Create a virtual environment
source venv/bin/activate       # Activate it (on Windows: venv\\Scripts\\activate)
pip install -r requirements.txt # Install the math engine & server tools
uvicorn main:app --reload      # Start the backend server on port 8000
```
*Your backend is now running at `http://localhost:8000`!*

### 2. Start the Frontend
Open a **new** terminal window (keep the backend running in the first one). You need Node.js installed.
```bash
cd frontend
npm install                    # Install UI dependencies
npm run dev                    # Start the interactive react server
```
*Your frontend is now running! Look at your terminal for the `localhost:5173` link to see the app.*

---

**That's it!** FinMin represents a bridge between beautiful, responsive web design and complex financial data analytics. Look around the code, tweak the indicator weights in `signal_engine.py`, and have fun experimenting with algorithmic models!
