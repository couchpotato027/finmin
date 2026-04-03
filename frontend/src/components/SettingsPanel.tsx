import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Database, Layout, Shield, Info, Monitor, Check, ChevronDown, Bell, Globe, Activity } from 'lucide-react';
import { clearSignalsHistory } from '../api';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // SCANNER DEFAULTS
  const [defaultUniverse, setDefaultUniverse] = useState(() => localStorage.getItem('finmin_default_universe') || 'nifty50');
  const [buyThreshold, setBuyThreshold] = useState(() => Number(localStorage.getItem('finmin_buy_threshold')) || 30);
  const [sellThreshold, setSellThreshold] = useState(() => Number(localStorage.getItem('finmin_sell_threshold')) || -30);

  // DASHBOARD DEFAULTS
  const [defaultTimeframe, setDefaultTimeframe] = useState(() => localStorage.getItem('finmin_default_timeframe') || '1mo');
  const [defaultChartType, setDefaultChartType] = useState(() => localStorage.getItem('finmin_default_chart_type') || 'Candlestick');
  const [showForecast, setShowForecast] = useState(() => localStorage.getItem('finmin_show_forecast') !== 'false');
  const [showNews, setShowNews] = useState(() => localStorage.getItem('finmin_show_news') !== 'false');

  // DISPLAY
  const [currencyMode, setCurrencyMode] = useState(() => localStorage.getItem('finmin_currency_mode') || 'Auto-detect');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('finmin_compact_mode') === 'true');

  // Counts for Data Section
  const [signalCount, setSignalCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);

  useEffect(() => {
    // Load counts
    const watchlist = JSON.parse(localStorage.getItem('finmin_watchlist') || '[]');
    setWatchlistCount(watchlist.length);
    
    const portfolio = JSON.parse(localStorage.getItem('finmin_portfolio') || '[]');
    setPortfolioCount(portfolio.length);

    const fetchSignalCount = async () => {
      try {
        const { fetchSignalHistory } = await import('../api');
        const history = await fetchSignalHistory();
        setSignalCount(history.length);
      } catch (e) {
        console.error("Failed to fetch signal count", e);
      }
    };
    fetchSignalCount();
  }, [isOpen]);

  useEffect(() => {
    // Sync to localStorage
    localStorage.setItem('finmin_default_universe', defaultUniverse);
    localStorage.setItem('finmin_buy_threshold', buyThreshold.toString());
    localStorage.setItem('finmin_sell_threshold', sellThreshold.toString());
    localStorage.setItem('finmin_default_timeframe', defaultTimeframe);
    localStorage.setItem('finmin_default_chart_type', defaultChartType);
    localStorage.setItem('finmin_show_forecast', showForecast.toString());
    localStorage.setItem('finmin_show_news', showNews.toString());
    localStorage.setItem('finmin_currency_mode', currencyMode);
    localStorage.setItem('finmin_compact_mode', compactMode.toString());

    // Apply compact mode
    if (compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
  }, [defaultUniverse, buyThreshold, sellThreshold, defaultTimeframe, defaultChartType, showForecast, showNews, currencyMode, compactMode]);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleClearSignals = async () => {
    if (window.confirm("Are you sure you want to clear your entire signal history? This action cannot be undone.")) {
      try {
        await clearSignalsHistory();
        setSignalCount(0);
        alert("Signal history cleared successfully.");
      } catch (e) {
        alert("Failed to clear signal history.");
      }
    }
  };

  const handleClearWatchlist = () => {
    if (window.confirm("Clear all items from your watchlist?")) {
      localStorage.removeItem('finmin_watchlist');
      setWatchlistCount(0);
    }
  };

  const handleClearPortfolio = () => {
    if (window.confirm("Delete your entire portfolio data?")) {
      localStorage.removeItem('finmin_portfolio');
      setPortfolioCount(0);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-[380px] bg-[#131722] border-l border-white/10 z-[101] shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-white font-bold tracking-tight">Settings</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
            
            {/* 1. SCANNER DEFAULTS */}
            <section>
              <h3 className="section-header">Scanner Defaults</h3>
              <div className="space-y-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Default Universe</span>
                    <span className="setting-sublabel">Preferred scanning group</span>
                  </div>
                  <select 
                    value={defaultUniverse}
                    onChange={(e) => setDefaultUniverse(e.target.value)}
                    className="bg-[#1c2130] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="nifty50">Nifty 50</option>
                    <option value="nifty_next50">Nifty Next 50</option>
                    <option value="nifty_midcap100">Nifty Midcap</option>
                    <option value="us_large_cap">US Large Cap</option>
                  </select>
                </div>

                <div className="setting-row flex-col items-start space-y-3">
                  <div className="w-full flex justify-between">
                    <div className="flex flex-col">
                      <span className="setting-label">BUY Signal Threshold</span>
                      <span className="setting-sublabel">BUY when score ≥ {buyThreshold}</span>
                    </div>
                    <span className="text-emerald-400 font-black">{buyThreshold}</span>
                  </div>
                  <input 
                    type="range" min="20" max="50" step="1"
                    value={buyThreshold}
                    onChange={(e) => setBuyThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-[#1c2130] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="setting-row flex-col items-start space-y-3">
                  <div className="w-full flex justify-between">
                    <div className="flex flex-col">
                      <span className="setting-label">SELL Signal Threshold</span>
                      <span className="setting-sublabel">SELL when score ≤ {sellThreshold}</span>
                    </div>
                    <span className="text-rose-400 font-black">{sellThreshold}</span>
                  </div>
                  <input 
                    type="range" min="-50" max="-20" step="1"
                    value={sellThreshold}
                    onChange={(e) => setSellThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-[#1c2130] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* 2. DASHBOARD DEFAULTS */}
            <section>
              <h3 className="section-header">Dashboard Defaults</h3>
              <div className="space-y-4">
                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Default Timeframe</span>
                    <span className="setting-sublabel">Initial chart period</span>
                  </div>
                  <div className="flex bg-[#1c2130] rounded-lg p-0.5 border border-white/5">
                    {['1D', '1WK', '1MO', '1Y'].map(tf => (
                      <button 
                        key={tf}
                        onClick={() => setDefaultTimeframe(tf.toLowerCase())}
                        className={`px-2 py-1 text-[10px] font-black rounded ${defaultTimeframe === tf.toLowerCase() ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Default Chart Type</span>
                    <span className="setting-sublabel">Preferred visualization</span>
                  </div>
                  <select 
                    value={defaultChartType}
                    onChange={(e) => setDefaultChartType(e.target.value)}
                    className="bg-[#1c2130] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Candlestick">Candlestick</option>
                    <option value="Line">Line</option>
                    <option value="Area">Area</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Show ML Forecast</span>
                    <span className="setting-sublabel">Enable predictor panel</span>
                  </div>
                  <Toggle active={showForecast} onClick={() => setShowForecast(!showForecast)} />
                </div>

                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Show News Feed</span>
                    <span className="setting-sublabel">Enable news panel</span>
                  </div>
                  <Toggle active={showNews} onClick={() => setShowNews(!showNews)} />
                </div>
              </div>
            </section>

            {/* 3. DISPLAY */}
            <section>
              <h3 className="section-header">Display</h3>
              <div className="space-y-4">
                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Currency Display</span>
                  </div>
                  <div className="flex bg-[#1c2130] rounded-lg p-0.5 border border-white/5">
                    {['Auto-detect', 'Always ₹', 'Always $'].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setCurrencyMode(mode)}
                        className={`px-2 py-1 text-[10px] font-black rounded whitespace-nowrap ${currencyMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Compact Mode</span>
                    <span className="setting-sublabel">Reduces density for more data</span>
                  </div>
                  <Toggle active={compactMode} onClick={() => setCompactMode(!compactMode)} />
                </div>
              </div>
            </section>

            {/* 4. DATA & PRIVACY */}
            <section>
              <h3 className="section-header">Data & Privacy</h3>
              <div className="space-y-4">
                <div className="data-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Signal History</span>
                    <span className="setting-sublabel">{signalCount} signals tracked</span>
                  </div>
                  <button onClick={handleClearSignals} className="clear-btn">Clear</button>
                </div>

                <div className="data-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Watchlist</span>
                    <span className="setting-sublabel">{watchlistCount} stocks saved</span>
                  </div>
                  <button onClick={handleClearWatchlist} className="clear-btn">Clear</button>
                </div>

                <div className="data-row">
                  <div className="flex flex-col">
                    <span className="setting-label">Portfolio</span>
                    <span className="setting-sublabel">{portfolioCount} holdings saved</span>
                  </div>
                  <button onClick={handleClearPortfolio} className="clear-btn">Clear</button>
                </div>
              </div>
            </section>

            {/* 5. ABOUT */}
            <section className="bg-white/5 rounded-xl p-4 border border-white/5">
              <h3 className="section-header mb-4">About</h3>
              <div className="space-y-3">
                <AboutRow label="Version" value="FinMin v2.0" icon={<Activity size={12} />} />
                <AboutRow label="Signal Engine" value="Multi-factor · RSI + MACD + Volume + Trend + News" icon={<Database size={12} />} />
                <AboutRow label="Data Source" value="Yahoo Finance via yfinance" icon={<Globe size={12} />} />
                <AboutRow label="Built with" value="FastAPI · React · TailwindCSS" icon={<Monitor size={12} />} />
              </div>
            </section>
          </div>
        </div>
      </div>

      <style>{`
        .section-header {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.3);
          margin-bottom: 12px;
          font-weight: 800;
        }
        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.04);
        }
        .setting-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: -0.01em;
        }
        .setting-sublabel {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-weight: 500;
        }
        .clear-btn {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #f43f5e;
          padding: 4px 10px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 6px;
          transition: all 0.2s;
        }
        .clear-btn:hover {
          background: #f43f5e;
          color: white;
        }
        .compact-mode table td {
          padding-top: 1rem !important;
          padding-bottom: 1rem !important;
          font-size: 0.75rem !important;
        }
        .compact-mode table th {
          padding-top: 0.75rem !important;
          padding-bottom: 0.75rem !important;
          font-size: 10px !important;
        }
      `}</style>
    </>
  );
};

const Toggle: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-9 h-5 rounded-full p-1 transition-colors duration-200 focus:outline-none ${active ? 'bg-blue-600' : 'bg-gray-700'}`}
  >
    <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

const AboutRow: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-start space-x-3">
    <div className="mt-0.5 text-blue-500 opacity-60">{icon}</div>
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</span>
      <span className="text-xs text-gray-300 font-medium leading-relaxed">{value}</span>
    </div>
  </div>
);

export default SettingsPanel;
