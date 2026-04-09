import React, { useState, useMemo, useEffect } from "react"
import { fetchBacktest, BacktestResult, fetchSymbolSearch } from "../api"
import { 
  Play, 
  TrendingUp, 
  ClipboardList, 
  Search, 
  Info, 
  TrendingDown, 
  Loader2, 
  Calendar, 
  Zap, 
  Activity, 
  AlertCircle 
} from "lucide-react"

const PERIODS = ["3mo", "6mo", "1y", "2y"]

export default function Backtest() {
  const [ticker, setTicker] = useState("TCS.NS")
  const [period, setPeriod] = useState("1y")
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"chart" | "trades">("chart")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg, setShowSugg] = useState(false)

  const handleTickerChange = async (val: string) => {
    const upperVal = val.toUpperCase()
    setTicker(upperVal)
    if (upperVal.length >= 2) {
      try {
        const data = await fetchSymbolSearch(upperVal)
        setSuggestions(data.slice(0, 6))
        setShowSugg(true)
      } catch {
        setShowSugg(false)
      }
    } else {
      setShowSugg(false)
    }
  }

  const runBacktest = async () => {
    if (!ticker) return
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const data = await fetchBacktest(ticker, period)
      if (data && data.error) setError(data.error)
      else if (data) setResult(data)
      else throw new Error("No data received")
    } catch (err) {
      console.error("Backtest error:", err)
      setError("Failed to connect to backend. This could be a CORS issue or a timeout.")
    }
    setLoading(false)
  }

  const equitySVG = useMemo(() => {
    if (!result?.equity_curve?.length) return null
    const points = result.equity_curve
    const values = points.map(p => p.value)
    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    const range = maxV - minV || 1
    const W = 800, H = 200, PAD = 10

    const x = (i: number) => 
      PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const y = (v: number) => 
      H - PAD - ((v - minV) / range) * (H - PAD * 2)

    const pathD = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
    ).join(' ')

    const areaD = pathD + 
      ` L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`

    const isPositive = result.total_return_pct >= 0
    const color = isPositive ? '#10b981' : '#f43f5e'
    const baseline = y(result.initial_capital)

    const tradeMarkers = result.trades.slice(0, 30).map(trade => {
      const idx = points.findIndex(p => p.date === trade.entry_date)
      if (idx < 0) return null
      return {
        x: x(idx), y: y(points[idx].value),
        outcome: trade.outcome, pct: trade.return_pct
      }
    }).filter(Boolean)

    return { pathD, areaD, color, baseline, W, H, PAD,
             tradeMarkers, minV, maxV, points, x, y }
  }, [result])

  const c = (n: number, decimals = 2) => 
    n >= 0 ? `+${n.toFixed(decimals)}` : n.toFixed(decimals)

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#111827]/80 backdrop-blur-md border-b border-[#1f2937] sticky top-0 z-50">
        <div className="flex items-center space-x-2 md:space-x-3">
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Backtesting Engine</h2>
          <span className="px-1.5 md:px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest border border-blue-500/20">Simulation</span>
        </div>

        <div className="flex items-center space-x-4">
           <div className="text-right mr-2 hidden sm:block">
              <p className="text-[9px] md:text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Strategy Mode</p>
              <p className="text-[9px] md:text-[10px] font-bold text-blue-400/80 uppercase">FinMin Vectorized v2.1</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-4 md:p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 md:gap-6">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-end gap-4 md:gap-6">
              <div className="w-full md:w-64 relative">
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 ml-1">Symbol Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={ticker}
                    onChange={e => handleTickerChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setShowSugg(false)
                        runBacktest()
                      }
                      if (e.key === 'Escape') setShowSugg(false)
                    }}
                    placeholder="e.g. RELIANCE.NS"
                    className="w-full bg-[#0b0f19] border border-[#1f2937] text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 outline-none transition-all font-bold"
                  />
                </div>
                {showSugg && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {suggestions.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                          setTicker(s.symbol)
                          setShowSugg(false)
                        }}
                        className="w-full px-4 py-3 flex flex-col items-start hover:bg-blue-500/10 border-b border-[#1f2937] last:border-0 transition-colors group"
                      >
                        <div className="flex items-center space-x-2 w-full">
                          <span className="font-black text-white text-xs group-hover:text-blue-400">{s.symbol}</span>
                          <span className="text-[10px] text-gray-600 font-bold opacity-40">·</span>
                          <span className="text-[10px] text-gray-500 font-bold truncate flex-1 text-left">{s.shortname || s.longname}</span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest">{s.exchange}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full md:auto">
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 ml-1">Time Horizon</label>
                <div className="flex bg-[#0b0f19] border border-[#1f2937] rounded-xl p-1">
                  {PERIODS.map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        period === p 
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={runBacktest}
                disabled={loading}
                className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg ${
                  loading 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent shadow shadow-emerald-500/20 active:scale-95'
                } h-[42px]`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Backtest</span>
                  </>
                )}
              </button>
            </div>

            <div className="hidden lg:flex items-center text-gray-500 text-[10px] font-bold uppercase tracking-widest italic opacity-50">
              <Info className="w-3 h-3 mr-2" />
              Validating buy/sell signals on historical k-lines
            </div>
          </div>
        </div>

        {error && (
           <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-xs font-bold flex items-center mb-6 animate-in slide-in-from-top-2 duration-300">
             <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" /> {error}
           </div>
        )}

        {loading && !result && (
          <div className="h-64 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse"></div>
              <Loader2 className="animate-spin h-12 w-12 text-blue-500 relative" />
            </div>
            <div className="text-center">
              <p className="text-gray-400 font-medium tracking-wide mb-1">Synthesizing {ticker} history...</p>
              <p className="text-blue-400/60 text-[9px] font-black uppercase tracking-[0.2em]">Executing vectorized signal evaluation</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetricCard 
                label="Total Return" 
                value={`${c(result.total_return_pct)}%`}
                sub="Portfolio Growth"
                color={result.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                icon={result.total_return_pct >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
              />
              <MetricCard 
                label="Win Rate" 
                value={`${result.win_rate.toFixed(1)}%`}
                sub={`${result.wins} Wins / ${result.losses} Losses`}
                color={result.win_rate >= 50 ? 'text-emerald-400' : 'text-amber-400'}
                icon={<Zap className={`w-4 h-4 ${result.win_rate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`} />}
              />
              <MetricCard 
                label="Max Drawdown" 
                value={`${result.max_drawdown.toFixed(2)}%`}
                sub="Peak to Trough"
                color="text-rose-400"
                icon={<Activity className="w-4 h-4 text-rose-400" />}
              />
              <MetricCard 
                label="Sharpe Ratio" 
                value={result.sharpe_ratio.toFixed(2)}
                sub="Risk-Adj. Performance"
                color={result.sharpe_ratio >= 1 ? 'text-emerald-400' : result.sharpe_ratio >= 0 ? 'text-blue-400' : 'text-rose-400'}
                icon={<Info className="w-4 h-4 text-blue-400" />}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-12 px-1">
              <MiniStats label="Avg Gain" value={`+${result.avg_gain.toFixed(2)}%`} color="text-emerald-400/80" />
              <MiniStats label="Avg Loss" value={`${result.avg_loss.toFixed(2)}%`} color="text-rose-400/80" />
              <MiniStats label="Best Trade" value={`+${result.best_trade.toFixed(2)}%`} color="text-emerald-400" />
              <MiniStats label="Total Trades" value={result.total_trades} color="text-white" />
            </div>

            <div className="bg-[#111827] rounded-2xl border border-[#1f2937] overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
              <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between bg-[#1f2937]/30">
                <div className="flex items-center space-x-1">
                  {(['chart', 'trades'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab 
                        ? 'bg-[#1f2937] text-white shadow-inner border border-[#374151]' 
                        : 'text-gray-500 hover:text-gray-300'
                      } flex items-center space-x-2`}
                    >
                      {tab === 'chart' ? <TrendingUp className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />}
                      <span>{tab === 'chart' ? 'Equity Curve' : 'Trade Log'}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                  {result.ticker} · {result.period} Historical Performance
                </div>
              </div>

              <div className="p-8 flex-1">
                {activeTab === 'chart' && equitySVG && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <h4 className="text-white font-bold text-lg leading-tight">Portfolio Trajectory</h4>
                        <p className="text-gray-500 text-xs mt-1">Starting with ₹{result.initial_capital.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Final Capital</p>
                        <p className={`text-xl font-black ${result.final_capital >= result.initial_capital ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{Math.round(result.final_capital).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#0b0f19] rounded-xl border border-[#1f2937]/50 p-4 relative overflow-hidden group">
                      <svg width="100%" height="280" viewBox={`0 0 ${equitySVG.W} ${equitySVG.H}`} preserveAspectRatio="none" className="block">
                        <defs>
                          <linearGradient id="eq-grad-main" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={equitySVG.color} stopOpacity="0.2"/>
                            <stop offset="100%" stopColor={equitySVG.color} stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <line 
                          x1={equitySVG.PAD} y1={equitySVG.baseline} 
                          x2={equitySVG.W - equitySVG.PAD} y2={equitySVG.baseline} 
                          stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="5 5" 
                        />
                        <path d={equitySVG.areaD} fill="url(#eq-grad-main)"/>
                        <path 
                          d={equitySVG.pathD} fill="none" stroke={equitySVG.color} 
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                        />
                        {equitySVG.tradeMarkers.map((m, i) => m && (
                          <circle key={i}
                            cx={m.x} cy={m.y} r="3.5"
                            fill={m.outcome === 'WIN' ? '#10b981' : '#f43f5e'}
                            stroke="#0b0f19" strokeWidth="1"
                          />
                        ))}
                      </svg>

                      <div className="flex justify-between mt-4 px-2">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{result.equity_curve[0]?.date}</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{result.equity_curve[result.equity_curve.length-1]?.date}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'trades' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1f2937]">
                          {['Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'P&L %', 'Outcome'].map(h => (
                              <th key={h} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2937]">
                        {result.trades.map((trade, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-4 py-4 text-xs font-medium text-gray-300">{trade.entry_date}</td>
                            <td className="px-4 py-4 text-xs font-medium text-gray-400">{trade.exit_date}</td>
                            <td className="px-4 py-4 text-xs font-mono text-gray-300">₹{trade.entry_price.toLocaleString()}</td>
                            <td className="px-4 py-4 text-xs font-mono text-gray-300">₹{trade.exit_price.toLocaleString()}</td>
                            <td className={`px-4 py-4 text-xs font-black font-mono ${trade.return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {c(trade.return_pct)}%
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5`}>
                                {trade.outcome}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="p-8 bg-blue-500/5 rounded-full border border-blue-500/10 text-center">
              <Zap className="w-20 h-20 text-blue-500/30 mx-auto" strokeWidth={1} />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold text-white tracking-tight">Strategy Validation System</h3>
              <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
                Enter any symbol to run a vectorized simulation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#111827] p-6 rounded-2xl border border-[#1f2937] shadow-xl hover:border-blue-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{label}</span>
        <div className="p-2 bg-gray-800/50 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-black mb-1 tracking-tight ${color}`}>
        {value}
      </div>
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        {sub}
      </div>
    </div>
  )
}

function MiniStats({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest mb-1">{label}</span>
      <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
  )
}
