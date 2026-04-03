# 🚀 FinMin Deployment Guide

Follow this guide to deploy your FinMin project to the web with optimized performance and persistent data storage.

---

## 1. Backend Deployment (Render)
**Platform:** [Render.com](https://render.com)  
**Cost:** Free Tier (requires [Persistent Disk](https://render.com/docs/disks) for SQLite storage).

### Steps:
1. **Push to GitHub**: Ensure your `backend/` folder (including `requirements.txt` and `render.yaml`) is in a GitHub repository.
2. **Create Web Service**:
   - Log in to Render and click **New +** > **Blueprint**.
   - Connect your GitHub repo.
   - Render will automatically detect the `render.yaml` file I created.
3. **Configure Persistent Disk**:
   - During setup, Render will create a **Persistent Disk** named `finmin-data` (1GB).
   - This ensures your `signals.db` and `cache_data` are **saved** even when the server restarts.
4. **Environment Variables**:
   - Render will set `RENDER: "true"` automatically.
   - Ensure the start command is: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
5. **Copy Your URL**: Once deployed, your backend URL will look like `https://finmin-api.onrender.com`. **Copy this.**

---

## 2. Frontend Deployment (Vercel)
**Platform:** [Vercel.com](https://vercel.com)  
**Cost:** Free.

### Steps:
1. **New Project**: Log in to Vercel and click **Add New** > **Project**.
2. **Import Repo**: Select your FinMin repository.
3. **Configure Build**:
   - **Framework Preset**: Vite.
   - **Root Directory**: `frontend`.
   - **Build Command**: `npm run build`.
   - **Output Directory**: `dist`.
4. **Environment Variables**:
   - Add a new variable:
     - **Key**: `VITE_API_BASE_URL`
     - **Value**: `https://your-backend-url.onrender.com` (The URL you copied from Render).
5. **Deploy**: Click **Deploy**. Vercel will give you a public URL for your app.

---

## 3. Post-Deployment Checklist
- [ ] **Health Check**: Open your Vercel URL. If the charts load, your frontend is connected to the backend.
- [ ] **Latency Test**: The first visit to the Dashboard might take a few seconds as the cache warms up. Close it and re-open; it should load **instantly** (thanks to the new caching layer).
- [ ] **Data Persistence**: Add a stock to your watchlist or clear history. Restart the Render service; the data should still be there.

---

## 🛠️ Troubleshooting
- **CORS Errors**: If you see "CORS" errors in the browser console, ensure you've updated `main.py` to allow your Vercel URL, or set `allow_origins=["*"]` for absolute flexibility.
- **Empty Charts**: This usually means the `yfinance` API is being rate-limited. The new caching we implemented significantly reduces this risk.
- **Slow Startup**: Render's Free tier "sleeps" after 15 minutes of inactivity. The first request after a long break will take ~30 seconds to wake up the server.
