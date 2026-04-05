import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    TrendingDown,
    Plus,
    X,
    RefreshCw,
    Trash2,
    Edit2,
    Search,
    Loader2,
    Zap,
    Briefcase,
    DollarSign,
    PieChart,
    ChevronRight,
    ArrowRight,
    AlertTriangle,
    AlertCircle
} from 'lucide-react';
import { fetchAiSignal, fetchSymbolSearch, fetchPrice, ScannerResult } from '../api';

interface Holding {
    ticker: string;
    qty: number;
    buyPrice: number;
    currency: string;
    boughtDate?: string;
}

interface HoldingData extends Holding {
    currentPrice: number | null;
    dayChangePct: number;
    currency: string;
    shortName?: string;
    signal?: string;
    score?: number;
    confidence?: number;
}

const Portfolio: React.FC = () => {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [holdingsData, setHoldingsData] = useState<HoldingData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [usdInrRate, setUsdInrRate] = useState<number>(84.0);
    
    // Form State
    const [newTicker, setNewTicker] = useState('');
    const [newQty, setNewQty] = useState('');
    const [newBuyPrice, setNewBuyPrice] = useState('');
    const [newExchange, setNewExchange] = useState<'NSE' | 'NYSE'>('NSE');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [marketHint, setMarketHint] = useState<{ price: number; currency: string; diff: number; signal?: string; score?: number } | null>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isFetchingHint, setIsFetchingHint] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Edit State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editQty, setEditQty] = useState('');
    const [editBuyPrice, setEditBuyPrice] = useState('');
    
    const navigate = useNavigate();

    const cleanTicker = (ticker: string): string => {
        const t = ticker.trim().toUpperCase();
        const suffix = t.endsWith('.NS') ? '.NS' : t.endsWith('.BO') ? '.BO' : '';
        const base = suffix ? t.replace(suffix, '') : t;
        
        if (base.length > 3 && base.slice(0, base.length / 2) === base.slice(base.length / 2)) {
            return base.slice(0, base.length / 2) + suffix;
        }
        return t;
    };

    useEffect(() => {
        // Fetch exchange rate once on load
        const loadExchangeRate = async () => {
            try {
                const { fetchExchangeRate } = await import('../api');
                const { rate } = await fetchExchangeRate();
                setUsdInrRate(rate);
            } catch (e) {
                console.error("Failed to fetch exchange rate", e);
            }
        };
        loadExchangeRate();

        const raw = localStorage.getItem("finmin_portfolio");
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // Validate and clean each holding (Fix 3: One-time cleanup)
                const clean = (parsed as any[])
                    .filter(h => 
                        h.ticker && 
                        Number(h.qty) > 0 && 
                        Number(h.buyPrice) > 0 &&
                        h.ticker.length < 15 &&  
                        !h.ticker.match(/[^A-Z0-9.\-]/)
                    )
                    .map(h => ({
                        ticker: cleanTicker(h.ticker), 
                        qty: Number(h.qty),
                        buyPrice: Number(h.buyPrice),
                        currency: h.currency || (cleanTicker(h.ticker).endsWith('.NS') ? 'INR' : 'USD'),
                        boughtDate: h.boughtDate
                    }));
                
                if (clean.length !== parsed.length) {
                    console.log(`Cleaned up ${parsed.length - clean.length} invalid holdings`);
                }
                
                setHoldings(clean);
                localStorage.setItem("finmin_portfolio", JSON.stringify(clean));
                fetchCurrentData(clean);
            } catch (e) {
                console.error("Failed to parse portfolio", e);
                localStorage.removeItem("finmin_portfolio");
                setHoldings([]);
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    // Listeners for closing dropdown (Fix 1)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const fetchCurrentData = async (currentHoldings: Holding[]) => {
        if (currentHoldings.length === 0) {
            setHoldingsData([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        setRefreshing(true);
        try {
            const results = await Promise.all(currentHoldings.map(async (h) => {
                try {
                    const [priceData, signalData] = await Promise.all([
                        fetchPrice(h.ticker),
                        fetchAiSignal(h.ticker)
                    ]);
                    
                    return {
                        ...h,
                        currentPrice: priceData.price,
                        dayChangePct: priceData.change_pct,
                        currency: priceData.currency || h.currency || 'USD',
                        shortName: (priceData as any).short_name,
                        signal: (signalData as any).signal,
                        score: (signalData as any).score,
                        confidence: (signalData as any).confidence
                    };
                } catch (e) {
                    console.error(`Error fetching data for ${h.ticker}`, e);
                    return { 
                        ...h, 
                        currentPrice: null, 
                        dayChangePct: 0, 
                        currency: h.currency || (h.ticker.toUpperCase().endsWith('.NS') ? 'INR' : 'USD') 
                    };
                }
            }));

            setHoldingsData(results as HoldingData[]);
            setLastRefreshed(new Date());
        } catch (error) {
            console.error("Failed to refresh portfolio data", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchTickerHint = async (ticker: string) => {
        const buy = parseFloat(newBuyPrice);
        if (!ticker || ticker.length < 2 || isNaN(buy) || buy <= 0) {
            setMarketHint(null);
            return;
        }
        
        let normalized = ticker.trim().toUpperCase();
        if (newExchange === 'NSE' && !normalized.endsWith('.NS') && !normalized.endsWith('.BO')) {
            normalized += '.NS';
        }
        
        setIsFetchingHint(true);
        try {
            const [priceData, signalData] = await Promise.all([
                fetchPrice(normalized),
                fetchAiSignal(normalized)
            ]);

            if (priceData && priceData.price) {
                const diff = ((buy - priceData.price) / priceData.price) * 100;
                setMarketHint({
                    price: priceData.price,
                    currency: priceData.currency || (normalized.endsWith('.NS') ? 'INR' : 'USD'),
                    diff,
                    signal: (signalData as any).signal,
                    score: (signalData as any).score
                });
            }
        } catch (e) {
            console.error("Hint fetch failed", e);
        } finally {
            setIsFetchingHint(false);
        }
    };

    const handleAddHolding = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        let rawTicker = newTicker.trim().toUpperCase();
        
        // NSE Auto-suffix
        if (newExchange === 'NSE' && !rawTicker.endsWith('.NS') && !rawTicker.endsWith('.BO')) {
            rawTicker += '.NS';
        }
        
        const ticker = cleanTicker(rawTicker);
        const qty = parseFloat(newQty);
        const buyPrice = parseFloat(newBuyPrice);
        const boughtDate = newDate;

        if (!ticker || isNaN(qty) || isNaN(buyPrice)) {
            setFormError("Quantity and Buy Price must be numbers");
            return;
        }

        // Fix 2: Validate ticker before adding
        try {
            const priceData = (await fetchPrice(ticker)) as any;
            if (!priceData.price || priceData.error) {
                setFormError(`Ticker '${ticker}' not found — check the symbol`);
                return;
            }
            
            // If valid: add holding
            let currency = priceData.currency || (ticker.endsWith('.NS') ? 'INR' : 'USD');
            const newHolding: Holding = { ticker, qty, buyPrice, currency, boughtDate };
            const updatedHoldings = [...holdings, newHolding];
            
            setHoldings(updatedHoldings);
            localStorage.setItem('finmin_portfolio', JSON.stringify(updatedHoldings));
            
            // Clear form
            setNewTicker('');
            setNewQty('');
            setNewBuyPrice('');
            setMarketHint(null);
            setShowSuggestions(false);
            setFormError(null);
            
            // Refresh data
            fetchCurrentData(updatedHoldings);
        } catch (e) {
            console.error("Validation failed", e);
            setFormError(`Connection error while validating '${ticker}'`);
        }
    };

    const handleRetryPrice = async (ticker: string) => {
        // Find the index in holdingsData to show a temporary "loading" state if desired
        // For now, let's just fetch and update
        try {
            const [priceData, signalData] = await Promise.all([
                fetchPrice(ticker),
                fetchAiSignal(ticker)
            ]);
            
            setHoldingsData(prev => prev.map(h => {
                if (h.ticker === ticker) {
                    return {
                        ...h,
                        currentPrice: priceData.price,
                        dayChangePct: priceData.change_pct,
                        currency: priceData.currency || h.currency || 'USD',
                        shortName: (priceData as any).short_name,
                        signal: (signalData as any).signal,
                        score: (signalData as any).score,
                        confidence: (signalData as any).confidence
                    };
                }
                return h;
            }));
        } catch (e) {
            console.error(`Retry failed for ${ticker}`, e);
        }
    };

    const handleDelete = (index: number) => {
        const updated = holdings.filter((_, i) => i !== index);
        setHoldings(updated);
        localStorage.setItem('finmin_portfolio', JSON.stringify(updated));
        setHoldingsData(holdingsData.filter((_, i) => i !== index));
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditQty(holdings[index].qty.toString());
        setEditBuyPrice(holdings[index].buyPrice.toString());
    };

    const saveEdit = (index: number) => {
        const qty = parseFloat(editQty);
        const buyPrice = parseFloat(editBuyPrice);
        if (isNaN(qty) || isNaN(buyPrice)) return;

        const updated = [...holdings];
        // Explicitly update only necessary fields, preserving or rebuilding the ticker
        const existing = updated[index];
        const ticker = cleanTicker(existing.ticker);
        updated[index] = { 
            ticker, 
            qty, 
            buyPrice, 
            currency: existing.currency 
        };
        
        setHoldings(updated);
        localStorage.setItem('finmin_portfolio', JSON.stringify(updated));
        
        setEditingIndex(null);
        fetchCurrentData(updated);
    };

    // Optimization 8: Debounced search input
    const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const handleSearchChange = (val: string) => {
        setNewTicker(val);
        setFormError(null);
        
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        
        if (val.length >= 2) {
            searchTimerRef.current = setTimeout(async () => {
                setIsSearching(true);
                try {
                    const data = await fetchSymbolSearch(val);
                    const filtered = (data || []).filter(item => {
                        if (newExchange === 'NSE') {
                            return item.symbol?.endsWith('.NS') || 
                                   item.symbol?.endsWith('.BO') ||
                                   ['NSI','NSE','BSE'].some(e => 
                                     item.exchange?.includes(e))
                        } else {
                            return !item.symbol?.endsWith('.NS') && 
                                   !item.symbol?.endsWith('.BO');
                        }
                    });
                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
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

    const stats = useMemo(() => {
        let totalInvested = 0;
        let currentValue = 0;
        
        holdingsData.forEach(h => {
            if (h.currentPrice === null) return; // Skip invalid prices
            
            const multiplier = h.currency === 'USD' ? usdInrRate : 1;
            totalInvested += (h.qty * h.buyPrice) * multiplier;
            currentValue += (h.qty * h.currentPrice) * multiplier;
        });
        
        const totalPnL = currentValue - totalInvested;
        const returnPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
        
        return {
            totalInvested,
            currentValue,
            totalPnL,
            returnPct
        };
    }, [holdingsData, usdInrRate]);

    const getCurrencySymbol = (currency: string = 'INR') => {
        if (currency === 'INR') return '₹';
        if (currency === 'USD') return '$';
        return currency + ' ';
    };

    const getSignalColor = (signal: string = '') => {
        if (!signal) return 'text-gray-400 bg-gray-400/5 border-gray-400/10';
        switch (signal.toUpperCase()) {
            case 'BUY': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'SELL': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
            default: return 'text-gray-400 bg-gray-400/5 border-gray-400/10';
        }
    };

    const clearAll = () => {
        if (window.confirm("Are you sure you want to clear your entire portfolio?")) {
            setHoldings([]);
            setHoldingsData([]);
            localStorage.removeItem('finmin_portfolio');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="flex items-center justify-between px-8 py-4 bg-[#111827]/80 backdrop-blur-md border-b border-[#1f2937] sticky top-0 z-50">
                    <div className="flex items-center space-x-3">
                        <h1 className="text-xl font-bold text-white tracking-tight">Portfolio Manager</h1>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20">Beta</span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        {lastRefreshed && (
                            <span className="text-[10px] text-gray-500 font-mono uppercase">
                                Last sync: {lastRefreshed.toLocaleTimeString()}
                            </span>
                        )}
                        <button 
                            onClick={clearAll}
                            className="text-[10px] font-black text-rose-500/50 hover:text-rose-500 uppercase tracking-widest transition-colors"
                        >
                            CLEAR ALL
                        </button>
                        <button 
                            onClick={() => fetchCurrentData(holdings)}
                            disabled={refreshing}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-[#1f2937] hover:bg-[#374151] rounded-lg transition-colors text-xs font-bold border border-[#1f2937] disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            <span>REFRESH PRICES</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {/* SECTION 1: Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-2">
                        <SummaryCard 
                            label="Total Invested" 
                            value={`₹${(stats.totalInvested || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            icon={<DollarSign className="w-5 h-5 text-blue-400" />}
                        />
                        <SummaryCard 
                            label="Current Value" 
                            value={`₹${(stats.currentValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            icon={<Briefcase className="w-5 h-5 text-indigo-400" />}
                        />
                        <SummaryCard 
                            label="Total P&L" 
                            value={`${(stats.totalPnL || 0) >= 0 ? '+' : ''}₹${Math.abs(stats.totalPnL || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            sub={(stats.totalPnL || 0) >= 0 ? "Profit" : "Loss"}
                            color={(stats.totalPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}
                            icon={(stats.totalPnL || 0) >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
                        />
                        <SummaryCard 
                            label="Overall Return" 
                            value={`${(stats.returnPct || 0) >= 0 ? '+' : ''}${(stats.returnPct || 0).toFixed(2)}%`}
                            color={(stats.returnPct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}
                            icon={<PieChart className={`w-5 h-5 ${(stats.returnPct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />}
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mb-8 ml-1">
                        * Mixed currencies — totals shown in ₹ equivalent using 1 USD = {usdInrRate.toFixed(2)} ₹
                    </p>

                    {/* SECTION 3: Add Holding Form */}
                    <div className="bg-[#111827] p-4 rounded-xl border border-[#1f2937] mb-8 shadow-lg">
                        <form onSubmit={handleAddHolding} className="flex flex-col md:flex-row items-end gap-3">
                            <div className="w-full md:w-32">
                                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 ml-1">Exchange</label>
                                <div className="flex bg-[#0b0f19] border border-[#1f2937] rounded-xl p-1">
                                    <button
                                        type="button"
                                        onClick={() => setNewExchange('NSE')}
                                        className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${newExchange === 'NSE' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        NSE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewExchange('NYSE')}
                                        className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${newExchange === 'NYSE' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        NYSE
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 ml-1">Symbol</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input 
                                        type="text"
                                        placeholder={newExchange === 'NSE' ? "e.g. RELIANCE" : "e.g. AAPL"}
                                        value={newTicker}
                                        onBlur={() => fetchTickerHint(newTicker)}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        className={`w-full bg-[#0b0f19] border ${formError ? 'border-rose-500/50' : 'border-[#1f2937]'} text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 outline-none transition-all font-bold tracking-tight`}
                                    />
                                    {formError && (
                                        <div className="absolute top-full left-1 mt-1 text-[10px] font-bold text-rose-500 animate-in fade-in slide-in-from-top-1 z-10 bg-[#0b0f19] px-1 flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            {formError}
                                        </div>
                                    )}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div 
                                            ref={dropdownRef}
                                            className="absolute top-full left-0 right-0 mt-2 bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl z-[150] overflow-hidden max-h-64 overflow-y-auto"
                                        >
                                            {suggestions.map((s, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        let sym = s.symbol;
                                                        // NSE Auto-suffix on selection
                                                        if (newExchange === 'NSE' && !sym.endsWith('.NS') && !sym.endsWith('.BO')) {
                                                            sym += '.NS';
                                                        }
                                                        setNewTicker(sym);
                                                        setShowSuggestions(false);
                                                        setFormError(null);
                                                        fetchTickerHint(sym);
                                                    }}
                                                    className="w-full px-4 py-3 flex flex-col items-start hover:bg-blue-500/10 border-b border-[#1f2937] last:border-0 transition-colors"
                                                >
                                                    <div className="flex items-center space-x-2 w-full mb-0.5">
                                                        <span className="font-black text-white text-xs">{s.symbol}</span>
                                                        <span className="text-[10px] text-gray-600 font-bold opacity-40">·</span>
                                                        <span className="text-[10px] text-gray-500 font-bold truncate flex-1 text-left">{s.shortname}</span>
                                                        <span className="text-[10px] text-gray-600 font-bold opacity-40">·</span>
                                                        <span className="text-[10px] text-indigo-400/70 font-black uppercase tracking-widest">{s.exchange}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full md:w-28">
                                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 ml-1">Quantity</label>
                                <input 
                                    type="number"
                                    placeholder="0"
                                    value={newQty}
                                    onChange={(e) => setNewQty(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-[#1f2937] text-white text-sm rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none transition-all font-mono"
                                />
                            </div>
                            <div className="w-full md:w-44">
                                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 ml-1">Buy Price</label>
                                <div className="space-y-1">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        placeholder="Price per share"
                                        value={newBuyPrice}
                                        onBlur={() => fetchTickerHint(newTicker)}
                                        onChange={(e) => setNewBuyPrice(e.target.value)}
                                        className="w-full bg-[#0b0f19] border border-[#1f2937] text-white text-sm rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none transition-all font-mono"
                                    />
                                    {marketHint && (
                                        <div className={`text-[10px] font-bold px-1 transition-all animate-in fade-in slide-in-from-top-1 ${(() => {
                                            const sig = marketHint.signal || 'HOLD';
                                            const isAbove = parseFloat(newBuyPrice) > marketHint.price;
                                            if (sig === 'BUY') return isAbove ? 'text-amber-400' : 'text-emerald-400';
                                            if (sig === 'SELL') return 'text-rose-400';
                                            return isAbove ? 'text-amber-400' : 'text-gray-400';
                                        })()}`}>
                                            Mkt: {getCurrencySymbol(marketHint.currency)}{marketHint.price.toLocaleString()} · 
                                            {(() => {
                                                const sig = marketHint.signal || 'HOLD';
                                                const buy = parseFloat(newBuyPrice);
                                                const isAbove = buy > marketHint.price;
                                                
                                                if (sig === 'BUY') {
                                                    return isAbove ? 'Buying above market — but signal is bullish' : 'Good entry — signal is bullish';
                                                }
                                                if (sig === 'HOLD') {
                                                    return isAbove ? 'Buying above market — signal is neutral' : 'Fair entry — signal is neutral';
                                                }
                                                if (sig === 'SELL') {
                                                    return isAbove ? 'Poor entry — buying above market with bearish signal' : 'Caution — signal is bearish despite lower price';
                                                }
                                                return '';
                                            })()}
                                            {marketHint.score !== undefined && (
                                                <span className="text-gray-600 font-medium ml-1">
                                                    (Signal: {marketHint.signal} {marketHint.score})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full md:w-40">
                                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 ml-1">Date Bought</label>
                                <input 
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-[#1f2937] text-white text-xs rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <button 
                                type="submit"
                                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 flex items-center space-x-2 h-[42px]"
                            >
                                <Plus className="w-4 h-4" />
                                <span>ADD</span>
                            </button>
                        </form>
                    </div>

                    {/* SECTION 2: Holdings Table */}
                    <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1f2937]/50 border-b border-[#1f2937]">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500">Asset</th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest text-gray-500">Qty</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">Buy Price</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">Current Price</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">Day Change %</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">P&L</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">Return %</th>
                                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest text-gray-500">Signal</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f2937]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-24 text-center">
                                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                                            <p className="text-gray-500 font-medium">Fetching portfolio performance...</p>
                                        </td>
                                    </tr>
                                ) : holdingsData.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-32 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="p-4 bg-gray-800/50 rounded-full">
                                                    <Briefcase className="w-12 h-12 text-gray-600" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-white font-bold tracking-tight">Your portfolio is empty</p>
                                                    <p className="text-gray-500 text-sm">Add your first holding to start tracking performance.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    holdingsData.map((item, idx) => {
                                        const isPriceNA = item.currentPrice === null;
                                        const pnl = isPriceNA ? 0 : ((item.currentPrice || 0) - (item.buyPrice || 0)) * (item.qty || 0);
                                        const returnPct = (item.buyPrice > 0 && !isPriceNA) ? (((item.currentPrice || 0) - item.buyPrice) / item.buyPrice) * 100 : 0;
                                        const isEditing = editingIndex === idx;
                                        const symbol = getCurrencySymbol(item.currency);

                                        return (
                                            <tr key={idx} className={`hover:bg-white/[0.02] transition-all group ${isPriceNA ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col space-y-1">
                                                        <div 
                                                            className="flex items-center space-x-2 cursor-pointer group/ticker w-fit"
                                                            onClick={() => navigate(`/?ticker=${item.ticker}`)}
                                                        >
                                                            <span className="font-black text-white text-sm group-hover/ticker:text-blue-400 group-hover/ticker:underline transition-all uppercase">{item.ticker}</span>
                                                            {isPriceNA ? (
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                            ) : (
                                                                <ChevronRight className="w-3 h-3 text-gray-700 group-hover/ticker:text-blue-500 transition-colors" />
                                                            )}
                                                        </div>
                                                        {item.shortName && (
                                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight truncate max-w-[120px]">
                                                                {item.shortName}
                                                            </span>
                                                        )}
                                                        {item.boughtDate && (
                                                            <span className="text-[9px] text-gray-600 font-medium italic">
                                                                Bought {new Date(item.boughtDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono text-sm text-gray-300">
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            value={editQty}
                                                            onChange={(e) => setEditQty(e.target.value)}
                                                            className="w-16 bg-[#0b0f19] border border-blue-500/50 text-white rounded p-1 text-center outline-none"
                                                        />
                                                    ) : (item.qty || 0)}
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono text-sm text-gray-300">
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={editBuyPrice}
                                                            onChange={(e) => setEditBuyPrice(e.target.value)}
                                                            className="w-24 bg-[#0b0f19] border border-blue-500/50 text-white rounded p-1 text-right outline-none"
                                                        />
                                                    ) : `${symbol}${(item.buyPrice || 0).toFixed(2)}`}
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono text-sm text-gray-300">
                                                    {isPriceNA ? (
                                                        <div className="flex items-center justify-end space-x-1 uppercase text-amber-500 font-black tracking-widest text-[10px]">
                                                            <span>—</span>
                                                            <button 
                                                                onClick={() => handleRetryPrice(item.ticker)}
                                                                className="p-1 hover:bg-[#1f2937] rounded-md transition-all group/retry active:scale-90"
                                                                title="Retry price fetch"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5 text-blue-500 group-hover/retry:rotate-180 transition-transform duration-500" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white font-black tracking-tighter">
                                                            {symbol}{(item.currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`px-6 py-5 text-right font-mono text-sm font-bold ${
                                                    (item.dayChangePct || 0) > 0 ? 'text-emerald-400' : 
                                                    (item.dayChangePct || 0) < 0 ? 'text-rose-400' : 'text-gray-500'
                                                }`}>
                                                    {isPriceNA ? '—' : `${(item.dayChangePct || 0) > 0 ? '+' : ''}${(item.dayChangePct || 0).toFixed(2)}%`}
                                                </td>
                                                <td className={`px-6 py-5 text-right font-mono text-sm font-bold ${
                                                    pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                }`}>
                                                    {isPriceNA ? '—' : `${pnl >= 0 ? '+' : '-'}${symbol}${Math.abs(pnl).toFixed(2)}`}
                                                </td>
                                                <td className={`px-6 py-5 text-right font-mono text-sm font-bold ${
                                                    returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                }`}>
                                                    {isPriceNA ? '—' : `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest border transition-all flex items-center justify-center space-x-1 mx-auto w-fit ${getSignalColor(item.signal)}`}>
                                                        <span>{item.signal || '—'}</span>
                                                        {item.score !== undefined && (
                                                            <span className="opacity-60 ml-1">
                                                                {item.score >= 0 ? '+' : ''}{item.score}
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={() => saveEdit(idx)} className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors">
                                                                    <RefreshCw className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => setEditingIndex(null)} className="p-1.5 text-gray-500 hover:bg-gray-500/10 rounded-lg transition-colors">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => startEditing(idx)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(idx)} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
        </div>
    );
};

const SummaryCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; color?: string }> = ({ label, value, sub, icon, color }) => (
    <div className="bg-[#111827] p-6 rounded-2xl border border-[#1f2937] shadow-xl hover:border-blue-500/30 transition-all group">
        <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{label}</span>
            <div className="p-2 bg-gray-800/50 rounded-lg group-hover:scale-110 transition-transform">
                {icon}
            </div>
        </div>
        <div className={`text-2xl font-black mb-1 tracking-tight ${color || 'text-white'}`}>
            {value}
        </div>
        {sub && (
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center">
                {sub}
            </div>
        )}
    </div>
);

export default Portfolio;
