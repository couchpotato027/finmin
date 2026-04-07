import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    TrendingUp, 
    TrendingDown, 
    Zap, 
    Activity, 
    Clock, 
    ArrowUpRight, 
    ChevronRight,
    BarChart2,
    Calendar,
    Target,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { 
    fetchWinRate, 
    fetchSignalHistory, 
    triggerEvaluation, 
    WinRateData, 
    SignalHistory 
} from '../api';

const Analytics: React.FC = () => {
    const [stats, setStats] = useState<WinRateData | null>(null);
    const [history, setHistory] = useState<SignalHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const navigate = useNavigate();

    const loadData = async () => {
        try {
            const [wData, hData] = await Promise.all([
                fetchWinRate(),
                fetchSignalHistory()
            ]);
            setStats(wData);
            setHistory(hData);
            setLastUpdated(new Date());
        } catch (e) {
            console.error("Failed to load analytics data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleEvaluate = async () => {
        setEvaluating(true);
        try {
            await triggerEvaluation();
            await loadData();
        } catch (e) {
            console.error("Evaluation failed", e);
        } finally {
            setEvaluating(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getDaysAgo = (timestamp: string) => {
        const now = new Date();
        const signalDate = new Date(timestamp + "Z"); // SQLite timestamp is UTC
        const diffTime = Math.abs(now.getTime() - signalDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        return `${diffDays}d ago`;
    };

    const getWinRateColor = (rate: number) => {
        if (rate >= 60) return 'text-emerald-400';
        if (rate >= 40) return 'text-amber-400';
        return 'text-rose-400';
    };

    if (loading) {
        return (
            <div className="h-screen w-full bg-[#0b0f19] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    const isEmpty = history.length === 0;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="flex items-center justify-between px-8 py-4 bg-[#111827]/80 backdrop-blur-md border-b border-[#1f2937] sticky top-0 z-50">
                    <div className="flex items-center space-x-3">
                        <h1 className="text-xl font-bold text-white tracking-tight">Signal Analytics</h1>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20">Performance</span>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="text-right mr-2">
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Last Updated</p>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase">{lastUpdated.toLocaleTimeString()}</p>
                        </div>
                        <button 
                            onClick={handleEvaluate}
                            disabled={evaluating}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                evaluating 
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 cursor-not-allowed' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white border-transparent shadow-lg shadow-blue-500/20 active:scale-95'
                            }`}
                        >
                            {evaluating ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Evaluating...</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-3 h-3 fill-white" />
                                    <span>Evaluate Now</span>
                                </>
                            )}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {isEmpty ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-700">
                            <div className="p-6 bg-blue-500/5 rounded-full border border-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.05)]">
                                <BarChart2 className="w-16 h-16 text-blue-500/40" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-white tracking-tight">No signals tracked yet</h3>
                                <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
                                    Run a scan to start tracking BUY and SELL signals. Win rate and performance data appears after evaluation (5-day window).
                                </p>
                            </div>
                            <button 
                                onClick={() => navigate('/scanner')}
                                className="flex items-center space-x-2 px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                            >
                                <span>Go to Scanner</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* SECTION 1: Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <AnalyticsCard 
                                    label="Total Signals" 
                                    value={stats?.total ?? 0} 
                                    sub="Last 30 days"
                                    icon={<Activity className="w-5 h-5 text-blue-400" />}
                                />
                                <AnalyticsCard 
                                    label="Win Rate %" 
                                    value={stats ? `${stats.win_rate}%` : '—'} 
                                    sub={stats ? (stats.evaluated > 0 ? `${stats.wins} Wins / ${stats.evaluated} Eval` : `${stats.wins} Wins / ${stats.total} Pending`) : 'Gathering data'}
                                    icon={<Target className={`w-5 h-5 ${stats ? getWinRateColor(stats.win_rate) : 'text-gray-500'}`} />}
                                    color={stats ? getWinRateColor(stats.win_rate) : ''}
                                />
                                <AnalyticsCard 
                                    label="Avg Gain on WIN" 
                                    value={stats?.avg_gain ? `+${stats.avg_gain}%` : '—'} 
                                    sub="Successful trades"
                                    icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                                    color="text-emerald-400"
                                />
                                <AnalyticsCard 
                                    label="Avg Loss on LOSS" 
                                    value={stats?.avg_loss ? `${stats.avg_loss}%` : '—'} 
                                    sub="Failed signals"
                                    icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
                                    color="text-rose-400"
                                />
                            </div>

                            {/* SECTION 2: Signal History Table */}
                            <div className="bg-[#111827] rounded-2xl border border-[#1f2937] overflow-hidden shadow-2xl">
                                <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Signal History</h3>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Last 50 Entries</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#1f2937]/30">
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500">Ticker</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-center">Signal</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Entry Price</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-center">Date</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-center">Outcome</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Price Now</th>
                                                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 text-right">P&L %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1f2937]">
                                            {history.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => navigate(`/?ticker=${item.ticker}`)}>
                                                    <td className="px-6 py-4">
                                                        <div 
                                                            className="flex items-center space-x-2 cursor-pointer group/ticker w-fit"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/?ticker=${item.ticker}`);
                                                            }}
                                                        >
                                                            <span className="font-black text-white text-sm group-hover/ticker:text-blue-400 group-hover/ticker:underline transition-all uppercase underline-offset-4 decoration-blue-500/50">
                                                                {item.ticker}
                                                            </span>
                                                            <ChevronRight className="w-3 h-3 text-gray-700 group-hover/ticker:text-blue-500 transition-colors" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest border ${
                                                            item.signal === 'BUY' 
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                        }`}>
                                                            {item.signal}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-sm text-gray-300">
                                                        {item.price_at_signal.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs text-gray-400 font-medium">{new Date(item.timestamp + "Z").toLocaleDateString()}</span>
                                                            <div className="mt-1 flex flex-col items-center">
                                                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">{getDaysAgo(item.timestamp)}</span>
                                                                <span className="text-[9px] text-gray-500 font-medium italic mt-0.5">
                                                                    {item.outcome ? (
                                                                        "Evaluated"
                                                                    ) : (
                                                                        `Evaluates in ${Math.max(0, 5 - Math.floor(Math.abs(new Date().getTime() - new Date(item.timestamp + "Z").getTime()) / (1000 * 60 * 60 * 24)))} days`
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {item.outcome ? (
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                                                                item.outcome === 'WIN'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20'
                                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            }`}>
                                                                {item.outcome}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border bg-gray-500/5 text-gray-500 border-gray-500/10">
                                                                PENDING
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-sm text-gray-300">
                                                        {item.price_at_outcome ? item.price_at_outcome.toFixed(2) : '—'}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-mono text-sm font-bold ${
                                                        !item.pct_change ? 'text-gray-500' : 
                                                        item.pct_change > 0 ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}>
                                                        {item.pct_change ? `${item.pct_change > 0 ? '+' : ''}${item.pct_change}%` : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
        </div>
    );
};

const AnalyticsCard: React.FC<{ label: string; value: string | number; sub: string; icon: React.ReactNode; color?: string }> = ({ label, value, sub, icon, color }) => (
    <div className="bg-[#111827] p-6 rounded-2xl border border-[#1f2937] shadow-xl hover:border-blue-500/30 transition-all group">
        <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{label}</span>
            <div className="p-2 bg-gray-800/50 rounded-lg group-hover:scale-110 transition-transform">
                {icon}
            </div>
        </div>
        <div className={`text-3xl font-black mb-1 tracking-tight ${color || 'text-white'}`}>
            {value}
        </div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {sub}
        </div>
    </div>
);

export default Analytics;
