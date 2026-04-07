import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    TrendingDown,
    Activity,
    ChevronUp,
    ChevronDown,
    RefreshCw,
    ArrowUp,
    ArrowDown,
    Minus,
    Zap,
    Star,
    Plus,
    X,
    Loader2,
    LayoutGrid,
    AlertCircle,
    Download
} from 'lucide-react';
import { fetchMarketScan, ScannerResult, fetchUniverseScan, fetchAiSignal, fetchSymbolSearch, fetchWinRate, WinRateData } from '../api';

type SortConfig = {
    key: keyof ScannerResult;
    direction: 'asc' | 'desc';
} | null;

const SECTOR_COLORS: Record<string, string> = {
  "Financial Services": "#3B82F6",
  "Banking": "#3B82F6", 
  "Technology": "#8B5CF6",
  "Information Technology": "#8B5CF6",
  "Healthcare": "#10B981",
  "Pharma": "#10B981",
  "Energy": "#F59E0B",
  "Consumer Staples": "#EC4899",
  "FMCG": "#EC4899",
  "Automobile": "#F97316",
  "Auto": "#F97316",
  "Industrials": "#6B7280",
  "Materials": "#84CC16",
  "Metal": "#84CC16",
  "Realty": "#14B8A6",
  "Media": "#A855F7",
  "Other": "#6B7280",
}

const getSectorColor = (sector: string) => {
  for (const key of Object.keys(SECTOR_COLORS)) {
    if (sector?.toLowerCase().includes(key.toLowerCase())) {
      return SECTOR_COLORS[key]
    }
  }
  return SECTOR_COLORS["Other"]
}

// Global cache variables so scanning isn't lost on unmount
let cachedScannerResults: Record<string, ScannerResult[]> = {};
let cachedWinRate: WinRateData | null = null;

const MarketScanner: React.FC = () => {
    const navigate = useNavigate();
    const [universe, setUniverse] = useState(() => localStorage.getItem('finmin_default_universe') || 'nifty50');
    const [results, setResults] = useState<ScannerResult[]>(() => {
        const u = localStorage.getItem('finmin_default_universe') || 'nifty50';
        return cachedScannerResults[u] || [];
    });
    const [loading, setLoading] = useState(() => {
        const u = localStorage.getItem('finmin_default_universe') || 'nifty50';
        return !cachedScannerResults[u];
    });
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'score', direction: 'desc' });
    const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'WATCHLIST'>('ALL');
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingTicker, setIsAddingTicker] = useState(false);
    const [newTickerInput, setNewTickerInput] = useState('');
    const [scanProgress, setScanProgress] = useState(0);
    const [totalStocks, setTotalStocks] = useState(0);
    const [errorToast, setErrorToast] = useState<string | null>(null);
    
    // New Search Architecture State
    const [customTickers, setCustomTickers] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [winRate, setWinRate] = useState<WinRateData | null>(cachedWinRate);

    const [collapsedSectors, setCollapsedSectors] = 
      useState<Set<string>>(() => {
        const saved = localStorage.getItem('finmin_collapsed_sectors')
        return saved ? new Set(JSON.parse(saved)) : new Set()
      })

    const [groupBySector, setGroupBySector] = 
      useState<boolean>(() => {
        return localStorage.getItem('finmin_group_by_sector') === 'true'
      })
    
    

    const loadScan = async (targetUniverse: string = universe) => {
        setLoading(true);
        try {
            if (targetUniverse === 'watchlist') {
                const savedWatchlist = JSON.parse(localStorage.getItem('finmin_watchlist') || '[]');
                if (savedWatchlist.length === 0) {
                    setResults([]);
                    setLoading(false);
                    return;
                }
                setTotalStocks(savedWatchlist.length);
                const watchlistResults: ScannerResult[] = [];
                for (let i = 0; i < savedWatchlist.length; i++) {
                    try {
                        const signal = await fetchAiSignal(savedWatchlist[i]);
                        watchlistResults.push(signal as ScannerResult);
                    } catch (e) { console.error(e); }
                }
                setResults(watchlistResults);
                cachedScannerResults[targetUniverse] = watchlistResults;
            } else if (targetUniverse === 'custom') {
                const savedCustom = JSON.parse(localStorage.getItem('finmin_custom_tickers') || '[]');
                if (savedCustom.length === 0) {
                    setResults([]);
                    setLoading(false);
                    return;
                }
                const data = await fetchUniverseScan(undefined, savedCustom);
                setResults(data);
                cachedScannerResults[targetUniverse] = data;
            } else {
                const data = await fetchUniverseScan(targetUniverse);
                setResults(data);
                cachedScannerResults[targetUniverse] = data;
            }
        } catch (error) {
            console.error("Failed to fetch scanner results:", error);
        } finally {
            setLoading(false);
            // Also refresh win rate stats
            const stats = await fetchWinRate();
            setWinRate(stats);
            cachedWinRate = stats;
        }
    };

    useEffect(() => {
        const API = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';
        fetch(`${API}/api/health`).catch(() => {});
    }, []);

    useEffect(() => {
        if (!loading) {
            setScanProgress(100);
            return;
        }
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 90) return prev;
                return prev + (90 - prev) * 0.1;
            });
        }, 500);
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        const savedWatchlist = localStorage.getItem('finmin_watchlist');
        if (savedWatchlist) {
            setWatchlist(JSON.parse(savedWatchlist));
        }
        
        const savedCustom = localStorage.getItem('finmin_custom_tickers');
        if (savedCustom) {
            setCustomTickers(JSON.parse(savedCustom));
        }

        const currentUniverse = localStorage.getItem('finmin_default_universe') || 'nifty50';
        if (!cachedScannerResults[currentUniverse]) {
            loadScan(currentUniverse);
        }
    }, []);

    const handleUniverseChange = (newUniv: string) => {
        setUniverse(newUniv);
        loadScan(newUniv);
    };

    const handleAddTicker = async (tickerInput: string) => {
        const tickerToAdd = tickerInput.trim().toUpperCase();
        if (!tickerToAdd) return;
        
        setIsAddingTicker(false);
        setNewTickerInput('');
        setShowSuggestions(false);

        try {
            const signal: any = await fetchAiSignal(tickerToAdd);
            
            if (signal.error) {
                setErrorToast(`Ticker '${tickerToAdd}' not found — check the symbol and try again`);
                setTimeout(() => setErrorToast(null), 4000);
                return;
            }

            // Sync with custom list if in Custom mode or adding via search
            if (universe === 'custom' || !isAddingTicker) {
                setCustomTickers(prev => {
                    const newList = [tickerToAdd, ...prev.filter(t => t !== tickerToAdd)];
                    localStorage.setItem('finmin_custom_tickers', JSON.stringify(newList));
                    return newList;
                });
            }

            // Append result to current session
            setResults(prev => {
                const filtered = prev.filter(r => r.ticker !== tickerToAdd);
                return [signal as ScannerResult, ...filtered];
            });
        } catch (error) {
            setErrorToast(`Ticker '${tickerToAdd}' not found — check the symbol and try again`);
            setTimeout(() => setErrorToast(null), 4000);
        } finally {
            // Also refresh win rate stats
            const stats = await fetchWinRate();
            setWinRate(stats);
        }
    };

    const removeTickerFromCustom = (e: React.MouseEvent, ticker: string) => {
        e.stopPropagation();
        setCustomTickers(prev => {
            const newList = prev.filter(t => t !== ticker);
            localStorage.setItem('finmin_custom_tickers', JSON.stringify(newList));
            return newList;
        });
        setResults(prev => prev.filter(r => r.ticker !== ticker));
    };

    // Optimization 8: Debounced search input
    const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        
        if (universe === 'custom' && val.length >= 2) {
            searchTimerRef.current = setTimeout(async () => {
                setIsSearching(true);
                try {
                    const data = await fetchSymbolSearch(val);
                    setSuggestions(data || []);
                    setShowSuggestions(true);
                } catch (e) {
                    console.error("Search failed", e);
                } finally {
                    setIsSearching(false);
                }
            }, 300);
        } else {
            setShowSuggestions(false);
        }
    };

    const toggleWatchlist = (e: React.MouseEvent, ticker: string) => {
        e.stopPropagation();
        const newWatchlist = watchlist.includes(ticker)
            ? watchlist.filter(t => t !== ticker)
            : [...watchlist, ticker];
        setWatchlist(newWatchlist);
        localStorage.setItem('finmin_watchlist', JSON.stringify(newWatchlist));
    };

    const handleSort = (key: keyof ScannerResult) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const toggleSector = (sector: string) => {
        setCollapsedSectors(prev => {
            const next = new Set(prev)
            if (next.has(sector)) next.delete(sector)
            else next.add(sector)
            localStorage.setItem('finmin_collapsed_sectors', JSON.stringify([...next]))
            return next
        })
    }

    const toggleGroupBySector = () => {
        setGroupBySector(prev => {
            localStorage.setItem('finmin_group_by_sector', String(!prev))
            return !prev
        })
    }

    const sortedAndFilteredResults = useMemo(() => {
        let filtered = [...results];
        
        // Apply Search
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.ticker.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply Filter
        if (filter === 'WATCHLIST') {
            filtered = filtered.filter(item => watchlist.includes(item.ticker));
        } else if (filter !== 'ALL') {
            filtered = filtered.filter(item => item.signal === filter);
        }

        // Apply Sort
        if (sortConfig) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [results, sortConfig, filter, searchTerm, watchlist]);

    const groupedData = useMemo(() => {
        if (!groupBySector) return null
        
        const groups: Record<string, typeof sortedAndFilteredResults> = {}
        
        sortedAndFilteredResults.forEach(stock => {
            const sector = stock.sector || 'Other'
            if (!groups[sector]) groups[sector] = []
            groups[sector].push(stock)
        })
        
        // Sort sectors by number of BUY signals desc
        return Object.entries(groups).sort((a, b) => {
            const aBuys = a[1].filter(s => s.signal === 'BUY').length
            const bBuys = b[1].filter(s => s.signal === 'BUY').length
            return bBuys - aBuys
        })
    }, [sortedAndFilteredResults, groupBySector])

    const getSignalColor = (signal: string, score: number = 0) => {
        if (signal.toUpperCase() === 'HOLD') {
            if (score > 15) return 'text-emerald-400/70 bg-emerald-400/5 border-emerald-400/10 shadow-none';
            if (score < -15) return 'text-amber-400/70 bg-amber-400/5 border-amber-400/10 shadow-none';
            return 'text-gray-400 bg-gray-400/5 border-gray-400/10 shadow-none';
        }
        
        switch (signal.toUpperCase()) {
            case 'BUY': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.05)]';
            case 'SELL': return 'text-rose-400 bg-rose-400/10 border-rose-400/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]';
            default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        }
    };

    const getMacdIcon = (state: string) => {
        if (state.includes('bullish')) return <ArrowUpRight className={`w-4 h-4 ${state.includes('crossover') ? 'text-emerald-400' : 'text-emerald-400/60'}`} />;
        if (state.includes('bearish')) return <ArrowDownRight className={`w-4 h-4 ${state.includes('crossover') ? 'text-rose-400' : 'text-rose-400/60'}`} />;
        if (state.includes('weakening')) return <Activity className="w-4 h-4 text-amber-400" />;
        return <Minus className="w-4 h-4 text-gray-500" />;
    };

    const getVolumePulseDisplay = (pulse: string, ratio: number | null) => {
        if (pulse === 'n/a') return <span className="text-gray-500 text-xs">—</span>;
        if (pulse === 'high' && ratio !== null) return (
            <div className="inline-flex items-center text-emerald-400 font-bold space-x-1">
                <TrendingUp size={12} />
                <span className="text-[10px] uppercase tracking-wider">High</span>
                <span className="text-[10px] opacity-60 font-mono">({ratio.toFixed(1)}x)</span>
            </div>
        );
        if (pulse === 'low' && ratio !== null) return (
            <div className="inline-flex items-center text-rose-400 font-bold space-x-1">
                <TrendingDown size={12} />
                <span className="text-[10px] uppercase tracking-wider">Low</span>
                <span className="text-[10px] opacity-60 font-mono">({ratio.toFixed(1)}x)</span>
            </div>
        );
        return <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest opacity-40">Normal</span>;
    };

    const exportToCSV = () => {
        const headers = [
            'Ticker', 'Price', '% Today', 'RSI (14)', 
            'MACD', 'Volume Pulse', 'Score', 'Signal', 
            'Confidence', 'Sector'
        ]

        const rows = sortedAndFilteredResults.map(stock => [
            stock.ticker,
            stock.price,
            stock.change_pct ? `${stock.change_pct}%` : '—',
            stock.rsi,
            stock.macd_signal,
            stock.volume_pulse || '—',
            stock.score,
            stock.signal,
            stock.confidence ? `${stock.confidence}%` : '—',
            stock.sector || '—'
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => 
                row.map(cell => 
                    typeof cell === 'string' && cell.includes(',') 
                        ? `"${cell}"` 
                        : cell
                ).join(',')
            )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        
        const date = new Date().toISOString().split('T')[0]
        const currentUniv = universe || 'scan'
        link.setAttribute('href', url)
        link.setAttribute('download', `finmin_${currentUniv}_${date}.csv`)
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const renderSortArrow = (column: keyof ScannerResult) => {
        if (!sortConfig || sortConfig.key !== column) return null;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 inline" /> : <ArrowDown size={14} className="ml-1 inline" />;
    };

    const renderRow = (item: ScannerResult) => {
        if (!item || !item.ticker) return null;
        return (
            <tr 
                key={item.ticker} 
                onClick={() => navigate(`/?ticker=${item.ticker}`, { 
                    state: { signal: item, scanTimestamp: new Date().toISOString() } 
                })}
                className="hover:bg-white/[0.03] cursor-pointer transition-all group border-l-2 border-transparent hover:border-blue-500"
            >
                <td className="px-6 py-5">
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={(e) => toggleWatchlist(e, item.ticker)}
                            className="focus:outline-none transition-transform active:scale-125 p-1 hover:bg-white/5 rounded-md"
                        >
                            <Star 
                                className={`w-4 h-4 ${
                                    watchlist.includes(item.ticker) 
                                    ? 'fill-amber-400 text-amber-400' 
                                    : 'text-gray-600 hover:text-gray-400'
                                }`} 
                            />
                        </button>
                        
                        {universe === 'custom' && (
                            <button 
                                onClick={(e) => removeTickerFromCustom(e, item.ticker)}
                                className="p-1 text-gray-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-all"
                                title="Remove from custom list"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </td>
                <td className="px-6 py-5">
                    <div className="flex items-center space-x-3">
                        <div className="font-black text-white text-sm group-hover:text-blue-400 transition-colors">
                            {item.ticker}
                        </div>
                        {item.ticker.endsWith('.NS') ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase tracking-widest border border-blue-500/20">NSE</span>
                        ) : (
                            <span className="px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-500/20">NYSE/NASDAQ</span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-5 text-right font-mono text-sm text-gray-300">
                    {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`px-6 py-5 text-right font-mono text-sm font-bold ${
                    item.change_pct > 0 ? 'text-emerald-400' : 
                    item.change_pct < 0 ? 'text-rose-400' : 
                    'text-gray-500'
                }`}>
                    {item.change_pct > 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                </td>
                <td className="px-6 py-5 text-center">
                    <span className={`text-sm font-bold font-mono ${
                        item.rsi < 40 ? 'text-emerald-400' : 
                        item.rsi > 60 ? 'text-rose-400' : 
                        'text-gray-400'
                    }`}>
                        {item.rsi.toFixed(1)}
                    </span>
                </td>
                <td className="px-6 py-5">
                    <div className="flex items-center justify-center space-x-2">
                        {getMacdIcon(item.macd_signal)}
                        <span className={`text-[10px] uppercase font-black ${
                            item.macd_signal.includes('crossover') ? (item.macd_signal.includes('bullish') ? 'text-emerald-400' : 'text-rose-400') :
                            item.macd_signal.includes('weakening') ? 'text-amber-400' :
                            item.macd_signal === 'bullish' ? 'text-emerald-400/60' :
                            item.macd_signal === 'bearish' ? 'text-rose-400/60' :
                            'text-gray-500'
                        }`}>
                            {item.macd_signal}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-5 text-center">
                    {getVolumePulseDisplay(item.volume_pulse, item.volume_ratio)}
                </td>
                <td className="px-6 py-5">
                    <div className="flex items-center space-x-3">
                        <div className="w-[64px] h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${
                                    item.score > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ 
                                    width: `${Math.max(2, (Math.abs(item.score) / 100) * 64)}px`
                                }}
                            />
                        </div>
                        <span className={`text-xs font-black font-mono w-8 ${
                            item.score > 0 ? 'text-emerald-400' : 
                            item.score < 0 ? 'text-rose-400' : 'text-gray-500'
                        }`}>
                            {item.score > 0 ? '+' : ''}{item.score}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-5 text-right">
                    <div className={`inline-flex items-center px-4 py-2 rounded-xl border ${getSignalColor(item.signal, item.score)} shadow-lg transition-all`}>
                        <span className="text-xs font-black tracking-tighter mr-2 uppercase">{item.signal}</span>
                        <span className="text-xs font-black opacity-90">
                            {item.score === 0 ? '—' : `${item.confidence}%`}
                        </span>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <header className="h-16 flex items-center justify-between px-8 bg-[#0b0f19]/50 backdrop-blur-sm border-b border-[#1f2937] z-10">
                    {/* Error Toast */}
                    {errorToast && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-lg shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 z-[100] border border-rose-500/20 flex items-center gap-2">
                            <AlertCircle size={14} />
                            {errorToast}
                        </div>
                    )}
                    <div className="flex items-center space-x-3">
                        <h1 className="text-xl font-bold text-white tracking-tight">Market Scanner</h1>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20">Alpha v2.0</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <select 
                            value={universe}
                            onChange={(e) => handleUniverseChange(e.target.value)}
                            className="bg-[#1f2937] border border-[#374151] text-white text-[10px] font-black uppercase tracking-widest rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 px-3 outline-none cursor-pointer"
                        >
                            <option value="nifty50">Nifty 50</option>
                            <option value="nifty_next50">Nifty Next 50</option>
                            <option value="us_largecap">US Large Cap</option>
                            <option value="watchlist">Watchlist Universe</option>
                            <option value="custom">Custom Scan List</option>
                        </select>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-[#1f2937] hover:bg-[#374151] rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest border border-[#374151] text-gray-400 hover:text-white"
                        >
                            <Download size={14} />
                            <span>Export CSV</span>
                        </button>
                        <button 
                            onClick={() => loadScan()}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-[#1f2937] hover:bg-[#374151] rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest border border-[#374151]"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span>Refresh Scan</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                        <div className="flex-1 min-w-[300px]">
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Technical Opportunity Radar</h2>
                            <div className="flex flex-wrap items-center gap-4">
                                <p className="text-gray-400 max-w-2xl text-[13px] leading-relaxed">
                                    Advanced multi-factor scanning using weighted scoring: RSI (25%), MACD (40%), Volume (20%), Trend (15%). 
                                </p>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className={`px-3 py-1 border rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                                        !winRate || winRate.win_rate > 60 ? 'border-emerald-500/30 text-emerald-400' : 
                                        winRate.win_rate > 40 ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400'
                                    }`}>
                                        <Zap className="w-3 h-3" />
                                        <span>Accuracy: {winRate ? `${winRate.win_rate}%` : '—%'}</span>
                                    </div>
                                    <div className="px-3 py-1 border border-[#1f2937] text-gray-400 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                                        <Activity className="w-3 h-3 text-gray-500" />
                                        <span>{winRate ? winRate.total : 0} signals · 30d</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div className="flex items-center bg-[#111827] p-1 rounded-xl border border-[#1f2937] shadow-lg shrink-0">
                                {[
                                    { id: 'ALL', label: 'All' },
                                    { id: 'WATCHLIST', label: 'Watchlist', color: 'text-amber-400' },
                                    { id: 'BUY', label: 'BUY Only', color: 'text-emerald-400' },
                                    { id: 'SELL', label: 'SELL Only', color: 'text-rose-400' }
                                ].map((btn) => (
                                    <button
                                        key={btn.id}
                                        onClick={() => setFilter(btn.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            filter === btn.id 
                                            ? 'bg-[#1f2937] text-white shadow-inner' 
                                            : `text-gray-500 hover:text-gray-300`
                                        } ${filter === btn.id && btn.color ? btn.color : ''}`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={toggleGroupBySector}
                                className={`px-4 py-1.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                    groupBySector 
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                    : 'border-[#1f2937] bg-transparent text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <LayoutGrid size={12} />
                                <span>Sectors</span>
                            </button>

                            <div className="flex items-center space-x-2">
                                <div className="relative group/search">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input 
                                        type="text"
                                        placeholder={universe === 'custom' ? "Search & add any ticker..." : "Filter results..."}
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && searchTerm) {
                                                handleAddTicker(searchTerm);
                                                setSearchTerm('');
                                            } else if (e.key === 'Escape') {
                                                setShowSuggestions(false);
                                            }
                                        }}
                                        className="bg-[#111827] border border-[#1f2937] text-white text-xs rounded-xl pl-9 pr-4 py-2 w-64 focus:border-blue-500 outline-none transition-all"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => {setSearchTerm(''); setShowSuggestions(false);}} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-3 h-3 text-gray-500 hover:text-white" />
                                        </button>
                                    )}

                                    {/* Autocomplete Dropdown */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div 
                                            className="absolute top-full left-0 right-0 mt-2 bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                                            onMouseLeave={() => setShowSuggestions(false)}
                                        >
                                            <div className="p-2 border-b border-[#1f2937] flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Suggestions</span>
                                                {isSearching && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                                            </div>
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                {suggestions.map((s, idx) => (
                                                    <button
                                                        key={`${s.symbol}-${idx}`}
                                                        onClick={() => {
                                                            handleAddTicker(s.symbol);
                                                            setSearchTerm('');
                                                            setShowSuggestions(false);
                                                        }}
                                                        className="w-full px-4 py-3 flex flex-col items-start hover:bg-blue-500/10 border-b border-[#1f2937] last:border-0 transition-colors group"
                                                    >
                                                        <div className="flex items-center space-x-2 w-full">
                                                            <span className="font-black text-white text-sm group-hover:text-blue-400 transition-colors">
                                                                {s.symbol}
                                                            </span>
                                                            <span className="px-1 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-500/20">
                                                                {s.exchange}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 truncate w-full text-left mt-0.5">
                                                            {s.shortname}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {isAddingTicker ? (
                                    <form onSubmit={(e) => {e.preventDefault(); handleAddTicker(newTickerInput);}} className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <input 
                                            autoFocus
                                            type="text"
                                            placeholder="Ticker (e.g. RELIANCE.NS)"
                                            value={newTickerInput}
                                            onChange={(e) => setNewTickerInput(e.target.value)}
                                            className="bg-[#111827] border border-blue-500/50 text-white text-xs rounded-xl px-4 py-2 w-48 outline-none shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                        />
                                        <button type="submit" className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={() => setIsAddingTicker(false)} className="p-2 bg-[#1f2937] text-gray-400 rounded-xl">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </form>
                                ) : (
                                    <button 
                                        onClick={() => setIsAddingTicker(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="min-w-[800px] w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1f2937]/50 border-b border-[#1f2937]">
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-gray-500 w-12"></th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('ticker')}>
                                        <div className="flex items-center">TICKER {renderSortArrow('ticker')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('price')}>
                                        <div className="flex items-center justify-end">PRICE {renderSortArrow('price')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('change_pct')}>
                                        <div className="flex items-center justify-end">% TODAY {renderSortArrow('change_pct')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('rsi')}>
                                        <div className="flex items-center justify-center">RSI (14) {renderSortArrow('rsi')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('macd_signal')}>
                                        <div className="flex items-center justify-center">MACD {renderSortArrow('macd_signal')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('volume_ratio')}>
                                        <div className="flex items-center justify-center">VOLUME PULSE {renderSortArrow('volume_ratio')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-gray-500 cursor-pointer group" onClick={() => handleSort('score')}>
                                        <div className="flex items-center justify-center">SCORE {renderSortArrow('score')}</div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-[0.2em] text-gray-500">MASTER SIGNAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f2937]">
                                {loading && sortedAndFilteredResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center py-12 gap-4">
                                                <div className="text-sm text-gray-400">
                                                    Scanning {universe === 'custom' ? 'custom list' : universe}...
                                                </div>
                                                <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                        style={{ width: `${scanProgress}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    This may take 10-15 seconds on first load
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : universe === 'custom' && results.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-32 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-700">
                                                <div className="p-4 bg-blue-500/5 rounded-full border border-blue-500/10">
                                                    <Search className="w-12 h-12 text-blue-500/40" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-bold text-white tracking-tight">Your Custom Radar is Empty</h3>
                                                    <p className="text-gray-500 max-w-xs mx-auto text-sm">
                                                        Search and add any tickers (e.g. "RELIANCE.NS" or "AAPL") to start your custom scan.
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()}
                                                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
                                                >
                                                    Start Searching
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filter === 'WATCHLIST' && sortedAndFilteredResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <Star className="w-12 h-12 text-[#1f2937]" />
                                                <p className="text-gray-500 font-medium tracking-wide">No stocks in watchlist. Click ☆ on any row to add.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    groupBySector && groupedData ? (
                                        groupedData.map(([sector, stocks]) => {
                                            const isCollapsed = collapsedSectors.has(sector)
                                            const buys = stocks.filter(s => s.signal==='BUY').length
                                            const sells = stocks.filter(s => s.signal==='SELL').length
                                            const color = getSectorColor(sector)

                                            return (
                                                <React.Fragment key={sector}>
                                                    <tr
                                                        onClick={() => toggleSector(sector)}
                                                        className="cursor-pointer group transition-all"
                                                        style={{
                                                            borderTop: `2px solid ${color}22`,
                                                            borderBottom: `1px solid ${color}22`,
                                                        }}
                                                    >
                                                        <td colSpan={9} className="px-6 py-3" style={{ background: `${color}08` }}>
                                                            <div className="flex items-center gap-3">
                                                                <span style={{ width: '3px', height: '16px', background: color, borderRadius: '2px' }} />
                                                                <span style={{ fontSize: '12px', fontWeight: 900, color: color, letterSpacing: '0.04em' }} className="uppercase">
                                                                    {sector}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 font-bold tracking-widest">{stocks.length} STOCKS</span>
                                                                <div className="flex items-center gap-2 ml-auto">
                                                                    {buys > 0 && (
                                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                            {buys} BUY
                                                                        </span>
                                                                    )}
                                                                    {sells > 0 && (
                                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                                            {sells} SELL
                                                                        </span>
                                                                    )}
                                                                    {isCollapsed ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {!isCollapsed && stocks.map(item => renderRow(item))}
                                                </React.Fragment>
                                            )
                                        })
                                    ) : (
                                        sortedAndFilteredResults.map(item => renderRow(item))
                                    )
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
        </div>
    );
};

export default MarketScanner;
