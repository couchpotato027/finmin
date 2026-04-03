import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { fetchPrediction, PredictionData, PredictionPoint } from '../api';

interface ForecastPanelProps {
    ticker: string;
}

const ForecastPanel: React.FC<ForecastPanelProps> = ({ ticker }) => {
    const [data, setData] = useState<PredictionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        setData(null);

        fetchPrediction(ticker)
            .then((res) => {
                if (cancelled) return;
                if (res.error) {
                    setError(true);
                } else {
                    setData(res);
                }
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [ticker]);

    const currency = ticker.endsWith('.NS') || ticker.endsWith('.BO') ? '₹' : '$';

    // --- SVG Mini Chart ---
    const renderChart = () => {
        if (!data) return null;

        const actual = data.actual;
        const predicted = data.predictions;

        // Combine all prices to calculate min/max for normalization
        const allPrices = [
            ...actual.map(p => p.price),
            ...predicted.map(p => p.price),
        ];
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const priceRange = maxPrice - minPrice || 1;

        const chartW = 300;
        const chartH = 110;
        const padY = 10;
        const totalPoints = actual.length + predicted.length;

        const xStep = chartW / (totalPoints - 1);

        const toY = (price: number) => {
            const normalized = (price - minPrice) / priceRange;
            return chartH - padY - normalized * (chartH - padY * 2);
        };

        // Build actual path
        const actualPoints = actual.map((p, i) => ({
            x: i * xStep,
            y: toY(p.price),
        }));
        const actualPath = actualPoints
            .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
            .join(' ');

        // Build predicted path (starting from last actual point)
        const lastActual = actualPoints[actualPoints.length - 1];
        const predPoints = predicted.map((p, i) => ({
            x: (actual.length + i) * xStep,
            y: toY(p.price),
        }));
        const predPathPoints = [lastActual, ...predPoints];
        const predPath = predPathPoints
            .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
            .join(' ');

        const trendColor = data.trend === 'bullish' ? '#22c55e' : data.trend === 'bearish' ? '#ef4444' : '#888780';

        return (
            <div className="flex flex-col items-center">
                <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    width="100%"
                    height="120"
                    preserveAspectRatio="none"
                    className="mt-2"
                >
                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75].map((frac) => {
                        const y = chartH - padY - frac * (chartH - padY * 2);
                        return (
                            <line
                                key={frac}
                                x1="0" y1={y} x2={chartW} y2={y}
                                stroke="#1f2937" strokeWidth="0.5"
                            />
                        );
                    })}

                    {/* Actual price line */}
                    <path
                        d={actualPath}
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Predicted price line (dashed) */}
                    <path
                        d={predPath}
                        stroke={trendColor}
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray="4 2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Junction dot */}
                    <circle
                        cx={lastActual.x}
                        cy={lastActual.y}
                        r="3"
                        fill={trendColor}
                    />

                    {/* End dot */}
                    <circle
                        cx={predPoints[predPoints.length - 1].x}
                        cy={predPoints[predPoints.length - 1].y}
                        r="2"
                        fill={trendColor}
                        opacity="0.5"
                    />
                </svg>

                {/* Legend */}
                <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-3 h-0.5 bg-[#9ca3af]" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Actual</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                        <div className="flex space-x-0.5">
                            <div className="w-1 h-0.5" style={{ backgroundColor: trendColor }} />
                            <div className="w-1 h-0.5" style={{ backgroundColor: trendColor }} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Predicted</span>
                    </div>
                </div>
            </div>
        );
    };

    // --- Confidence Badge ---
    const confidenceBadge = (conf: string) => {
        const styles: Record<string, string> = {
            high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[conf] || styles.low}`}>
                {conf}
            </span>
        );
    };

    // --- Trend Badge ---
    const trendBadge = (trend: string) => {
        if (trend === 'bullish') {
            return (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" /><span>Bullish</span>
                </span>
            );
        }
        if (trend === 'bearish') {
            return (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-rose-500/10 text-rose-400 border-rose-500/20">
                    <TrendingDown className="w-3 h-3" /><span>Bearish</span>
                </span>
            );
        }
        return (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-gray-500/10 text-gray-400 border-gray-500/20">
                <ArrowRight className="w-3 h-3" /><span>Neutral</span>
            </span>
        );
    };

    // --- Loading Skeleton ---
    if (loading) {
        return (
            <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-5 shadow-lg animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-28 bg-gray-700/50 rounded" />
                    <div className="flex space-x-2">
                        <div className="h-4 w-14 bg-gray-700/50 rounded-full" />
                        <div className="h-4 w-16 bg-gray-700/50 rounded-full" />
                    </div>
                </div>
                <div className="h-[120px] bg-gray-800/30 rounded-lg mb-4" />
                <div className="grid grid-cols-3 gap-2">
                    <div className="h-12 bg-gray-700/30 rounded-lg" />
                    <div className="h-12 bg-gray-700/30 rounded-lg" />
                    <div className="h-12 bg-gray-700/30 rounded-lg" />
                </div>
            </div>
        );
    }

    // --- Error State ---
    if (error || !data) {
        return (
            <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400">5-Day Forecast</h3>
                </div>
                <div className="text-center py-6">
                    <p className="text-gray-500 text-xs font-medium">Insufficient data for reliable forecast</p>
                </div>
            </div>
        );
    }

    const target = data.predictions[data.predictions.length - 1]?.price;

    return (
        <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-5 shadow-lg transition-all">
            {/* Header */}
            <div
                className="flex items-center justify-between cursor-pointer select-none group"
                onClick={() => setCollapsed(!collapsed)}
            >
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 group-hover:text-gray-300 transition-colors">
                    5-Day Forecast
                </h3>
                <div className="flex items-center space-x-2">
                    {confidenceBadge(data.confidence)}
                    {trendBadge(data.trend)}
                    <button className="p-0.5 rounded hover:bg-gray-700/50 transition-colors">
                        {collapsed ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                        )}
                    </button>
                </div>
            </div>

            {/* Collapsible Body */}
            {!collapsed && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300">
                    {/* Mini Chart */}
                    <div className="bg-[#0b0f19]/50 rounded-lg px-3 py-2 border border-[#1f2937]/50">
                        {renderChart()}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg px-3 py-2 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Support</p>
                            <p className="text-xs font-black text-rose-400">{currency}{data.support.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Target</p>
                            <p className="text-xs font-black text-emerald-400">{currency}{target?.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Resistance</p>
                            <p className="text-xs font-black text-amber-400">{currency}{data.resistance.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[10px] text-gray-600 text-center mt-3 italic">
                        ML forecast · not financial advice
                    </p>
                </div>
            )}
        </div>
    );
};

export default ForecastPanel;
