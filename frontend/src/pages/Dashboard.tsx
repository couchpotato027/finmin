import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import StockChart from '../components/StockChart';
import RSIChart from '../components/RSIChart';
import MACDChart from '../components/MACDChart';
import SignalPanel from '../components/SignalPanel';
import NewsFeed from '../components/NewsFeed';
import ForecastPanel from '../components/ForecastPanel';
import TopBar from '../components/TopBar';
import { Bell, ArrowUp, ArrowDown, X, AlertCircle } from 'lucide-react';

interface PriceAlert {
  id: string
  ticker: string
  targetPrice: number
  condition: 'above' | 'below'
  createdAt: string
  triggered: boolean
}

const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [ticker, setTicker] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ticker')?.toUpperCase() || 'AAPL';
  });
  
  const [priceInfo, setPriceInfo] = useState<any>(null);
  const scannerSignal = location.state?.signal;
  const scanTimestamp = location.state?.scanTimestamp;

  const [showForecast] = useState(() => localStorage.getItem('finmin_show_forecast') !== 'false');
  const [showNews] = useState(() => localStorage.getItem('finmin_show_news') !== 'false');

  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem('finmin_alerts')
    return saved ? JSON.parse(saved) : []
  })
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertPrice, setAlertPrice] = useState('')
  const [alertCondition, setAlertCondition] = 
    useState<'above' | 'below'>('above')
  const [alertTriggered, setAlertTriggered] = 
    useState<PriceAlert | null>(null)

  const fetchPriceData = async () => {
    try {
      const { fetchPrice } = await import('../api');
      const data = await fetchPrice(ticker);
      setPriceInfo(data);
    } catch (err) {
      console.error("Failed to fetch price", err);
    }
  };

  useEffect(() => {
    fetchPriceData();
    const interval = setInterval(fetchPriceData, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, [ticker]);

  // Save alerts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('finmin_alerts', 
      JSON.stringify(alerts))
  }, [alerts])

  // Check alerts every 30 seconds against live price
  useEffect(() => {
    const currentPrice = priceInfo?.price;
    if (!currentPrice || alerts.length === 0) return
    
    const checkAlerts = () => {
      setAlerts(prev => prev.map(alert => {
        if (alert.triggered) return alert
        if (alert.ticker !== ticker) return alert
        
        const triggered = 
          (alert.condition === 'above' && 
           currentPrice >= alert.targetPrice) ||
          (alert.condition === 'below' && 
           currentPrice <= alert.targetPrice)
        
        if (triggered) {
          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification(`FinMin Alert — ${alert.ticker}`, {
              body: `Price is ${alert.condition} ${currency}${alert.targetPrice}. Current: ${currency}${currentPrice}`,
              icon: '/favicon.ico'
            })
          }
          setAlertTriggered(alert)
          return { ...alert, triggered: true }
        }
        return alert
      }))
    }
    
    checkAlerts()
  }, [priceInfo?.price, alerts, ticker]);

  const addAlert = () => {
    if (!alertPrice || isNaN(Number(alertPrice))) return
    
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      ticker,
      targetPrice: Number(alertPrice),
      condition: alertCondition,
      createdAt: new Date().toISOString(),
      triggered: false
    }
    
    setAlerts(prev => [...prev, newAlert])
    setAlertPrice('')
    setShowAlertModal(false)
  }

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const activeAlerts = alerts.filter(
    a => a.ticker === ticker && !a.triggered)
  const triggeredAlerts = alerts.filter(
    a => a.ticker === ticker && a.triggered)

  const getMarketStatusDetails = () => {
    const now = new Date();
    const isIndian = ticker.endsWith('.NS') || ticker.endsWith('.BO');
    
    if (isIndian) {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + istOffset);
      const istDay = istDate.getUTCDay();
      const istHours = istDate.getUTCHours();
      const istMins = istDate.getUTCMinutes();
      const istTime = istHours * 100 + istMins;
      
      const isOpen = istDay !== 0 && istDay !== 6 && istTime >= 915 && istTime < 1530;
      return { label: isOpen ? "NSE OPEN" : "NSE CLOSED", pulse: isOpen };
    } else {
      const isDST = now >= new Date("2026-03-08") && now <= new Date("2026-11-01");
      const estOffset = (isDST ? -4 : -5) * 60 * 60 * 1000;
      const estDate = new Date(now.getTime() + estOffset);
      const estDay = estDate.getUTCDay();
      const estHours = estDate.getUTCHours();
      const estMins = estDate.getUTCMinutes();
      const estTime = estHours * 100 + estMins;
      
      const isOpen = estDay !== 0 && estDay !== 6 && estTime >= 930 && estTime < 1600;
      return { label: isOpen ? "NYSE OPEN" : "NYSE CLOSED", pulse: isOpen };
    }
  };

  const marketStatus = getMarketStatusDetails();
  const changeAmount = priceInfo ? priceInfo.price - priceInfo.prev_close : 0;
  const isPositive = (priceInfo?.change_pct || 0) >= 0;
  const currency = (typeof ticker === 'string' && (ticker.endsWith('.NS') || ticker.endsWith('.BO'))) ? '₹' : '$';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <TopBar ticker={ticker} setTicker={setTicker} />

        {/* Dashboard Body */}
        <div className="flex-1 overflow-auto p-3 pt-14 md:pt-4 md:p-8">
          <div className="flex flex-col mb-4 md:mb-8 pl-12 md:pl-0">
            <div className="flex flex-wrap items-baseline gap-2 md:gap-3 mb-1">
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white uppercase">{ticker}</h1>
              {priceInfo?.short_name && (
                <span className="text-gray-400 text-[10px] md:text-sm font-bold tracking-widest uppercase opacity-50 truncate max-w-[120px] md:max-w-xs">{priceInfo.short_name}</span>
              )}
              <button
                onClick={() => setShowAlertModal(true)}
                style={{
                  background: activeAlerts.length > 0 
                    ? 'rgba(234,179,8,0.15)' 
                    : 'transparent',
                  border: `1px solid ${activeAlerts.length > 0 
                    ? 'rgba(234,179,8,0.4)' 
                    : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: activeAlerts.length > 0 
                    ? '#EAB308' 
                    : 'rgba(255,255,255,0.4)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                <Bell size={13} fill={activeAlerts.length > 0 ? 'currentColor' : 'none'} />
                {activeAlerts.length > 0 
                  ? `${activeAlerts.length} alert${activeAlerts.length > 1 ? 's' : ''}` 
                  : 'Set alert'}
              </button>
            </div>
            
            {priceInfo && typeof priceInfo.price === 'number' ? (
              <div className="flex items-center space-x-4 mt-1 animate-in fade-in slide-in-from-left-2 duration-700">
                <div className="flex items-center space-x-2">
                    <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${marketStatus.pulse ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-gray-500'} mt-0.5 md:mt-1`} />
                    <span className="text-xl md:text-3xl font-black text-white tracking-tighter">
                    {currency}{priceInfo.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <div className={`flex items-center space-x-1 font-bold text-[10px] md:text-sm h-fit mt-0.5 md:mt-1 px-2 py-0.5 rounded-full ${isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                  <span>{isPositive ? '+' : ''}{changeAmount.toFixed(2)}</span>
                  <span className="opacity-50">({isPositive ? '+' : ''}{priceInfo.change_pct.toFixed(2)}%)</span>
                </div>
              </div>
            ) : (
                <div className="h-10 w-64 bg-gray-800/20 animate-pulse rounded-lg mt-1" />
            )}
          </div>
          
          {/* Main Grid structure as per requirements: grid-cols-[3fr_1fr] */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6 max-w-full pb-8">
            
            {/* Left Column: Charts and Indicators */}
            <div className="flex flex-col space-y-6">
              {/* Main Chart Card */}
              <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col relative z-0">
                <div className="w-full flex-1 min-h-[400px]">
                   <StockChart ticker={ticker} />
                </div>
              </div>

              {/* Indicator Panel Placholders for RSI and MACD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col h-48 md:h-64 relative overflow-hidden">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 tracking-wider uppercase">Relative Strength Index (14)</h3>
                    <div className="flex-1 w-full">
                       <RSIChart ticker={ticker} />
                    </div>
                 </div>
                 <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col h-48 md:h-64 relative overflow-hidden">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 tracking-wider uppercase">MACD (12, 26, 9)</h3>
                    <div className="flex-1 w-full">
                       <MACDChart ticker={ticker} />
                    </div>
                 </div>
              </div>
            </div>
            
            {/* Right Column: AI Signals & News Feed */}
            <div className="flex flex-col space-y-6 h-full" style={{ minWidth: 0 }}>
              <div className="h-[380px] shrink-0">
                <SignalPanel 
                  ticker={ticker} 
                  passedSignal={scannerSignal} 
                  scanTimestamp={scanTimestamp}
                />
              </div>

              {showForecast && <ForecastPanel ticker={ticker} />}
              
              {showNews && (
                <div className="flex-1 min-h-[300px]">
                  <NewsFeed ticker={ticker} />
                </div>
              )}
            </div>

          </div>
        </div>
        
        {showAlertModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowAlertModal(false)}
          >
            <div style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '16px',
              padding: '24px',
              width: '90vw',
              maxWidth: '340px',
              zIndex: 101,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-white">Set Alert</h3>
                <button onClick={() => setShowAlertModal(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '24px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {ticker} · Current: {currency}{priceInfo?.price}
              </div>

              {/* Condition toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px'
              }}>
                {(['above', 'below'] as const).map(cond => (
                  <button
                    key={cond}
                    onClick={() => setAlertCondition(cond)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: `1px solid ${alertCondition === cond 
                        ? 'rgba(34,197,94,0.3)' 
                        : 'rgba(255,255,255,0.05)'}`,
                      background: alertCondition === cond 
                        ? 'rgba(34,197,94,0.1)' 
                        : 'rgba(255,255,255,0.02)',
                      color: alertCondition === cond 
                        ? '#10b981' 
                        : 'rgba(255,255,255,0.3)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {cond === 'above' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {cond}
                  </button>
                ))}
              </div>

              {/* Price input */}
              <div className="relative mb-6">
                <input
                  type="number"
                  value={alertPrice}
                  onChange={e => setAlertPrice(e.target.value)}
                  placeholder={`Target price (${currency})`}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addAlert()}
                  className="w-full bg-[#0b0f19] border border-[#1f2937] text-white text-sm rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all font-bold placeholder-gray-600"
                />
              </div>

              {/* Active alerts for this ticker */}
              {activeAlerts.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 800
                  }}>
                    Active Alerts
                  </div>
                  <div className="space-y-2">
                    {activeAlerts.map(alert => (
                      <div key={alert.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.8)'
                      }}>
                        <span className="flex items-center gap-2 font-mono font-bold">
                          {alert.condition === 'above' ? <ArrowUp size={10} className="text-emerald-500" /> : <ArrowDown size={10} className="text-rose-500" />} 
                          {currency}{alert.targetPrice.toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeAlert(alert.id)}
                          className="text-gray-600 hover:text-white transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add button */}
              <button
                onClick={addAlert}
                disabled={!alertPrice}
                className={`w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  alertPrice 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Create Alert
              </button>
            </div>
          </div>
        )}

        {/* Triggered alert toast */}
        {alertTriggered && (
          <div className="fixed bottom-8 right-8 z-[200] animate-in slide-in-from-right-10 duration-500">
            <div className="bg-[#111827] border border-emerald-500/30 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-emerald-500/10 flex items-center space-x-4 min-w-[320px]">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                 <Bell className="w-5 h-5 text-emerald-500" fill="currentColor" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Price Alert Triggered</p>
                <p className="text-sm font-bold">
                  {alertTriggered.ticker} is {alertTriggered.condition} {currency}{alertTriggered.targetPrice}
                </p>
              </div>
              <button
                onClick={() => setAlertTriggered(null)}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
