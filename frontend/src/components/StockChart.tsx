import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, Time, CrosshairMode } from 'lightweight-charts';
import { fetchStockPrice, fetchStockIndicators, OHLCV, Indicators } from '../api';

import { useNavigate } from 'react-router-dom';

interface StockChartProps {
  ticker: string;
  isAdvanced?: boolean;
}

export type ChartType = "Candlestick" | "Line" | "Baseline" | "Mountain" | "Bar";

const StockChart: React.FC<StockChartProps> = ({ ticker, isAdvanced = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("1mo");
  const [chartType, setChartType] = useState<ChartType>("Candlestick");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const loadData = async () => {
      setLoading(true);
      try {
        const response = await fetchStockPrice(ticker, timeframe);
        const pricesData = response.data;
        const indicators = await fetchStockIndicators(ticker);
        
        const currencyMap: Record<string, string> = {
          'USD': '$',
          'INR': '₹',
          'EUR': '€',
          'GBP': '£',
          'JPY': '¥',
          'AUD': 'A$',
          'CAD': 'C$',
        };
        const curSymbol = currencyMap[response.currency?.toUpperCase()] || '$';
        
        setCurrentPrice(response.current_price);
        setCurrencySymbol(curSymbol);

        if (chartRef.current) {
            chartRef.current.remove();
        }

        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#0b0f19' },
            textColor: '#e5e7eb',
            fontSize: 14,
          },
          grid: {
            vertLines: { color: '#1f2937' },
            horzLines: { color: '#1f2937' },
          },
          width: chartContainerRef.current.clientWidth || 300,
          height: isAdvanced ? (chartContainerRef.current.clientHeight || 600) : 400,
          rightPriceScale: {
            borderColor: '#1f2937',
          },
          timeScale: {
            borderColor: '#1f2937',
            timeVisible: true,
            barSpacing: 18,
            rightBarStaysOnScroll: true,
            fixLeftEdge: true,
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              width: 1,
              color: 'rgba(224, 227, 235, 0.4)',
              style: 0,
            },
            horzLine: {
              width: 1,
              color: 'rgba(224, 227, 235, 0.4)',
              style: 0,
            },
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
        });
        chartRef.current = chart;

        let mainSeries: any;
        const commonOptions = {
          priceFormat: {
            type: 'custom' as const,
            formatter: (price: number) => `${curSymbol}${price.toFixed(2)}`,
          },
        };

        if (chartType === "Line") {
          mainSeries = chart.addLineSeries({
             ...commonOptions,
             color: '#3b82f6',
             lineWidth: 3,
          });
        } else if (chartType === "Mountain") {
          mainSeries = chart.addAreaSeries({
             ...commonOptions,
             lineColor: '#3b82f6',
             topColor: 'rgba(59, 130, 246, 0.4)',
             bottomColor: 'rgba(59, 130, 246, 0)',
             lineWidth: 3,
          });
        } else if (chartType === "Baseline") {
          mainSeries = chart.addBaselineSeries({
             ...commonOptions,
             baseValue: { type: 'price' as const, price: pricesData[0]?.close || 0 },
             topLineColor: '#10b981',
             topFillColor1: 'rgba(16, 185, 129, 0.28)',
             topFillColor2: 'rgba(16, 185, 129, 0.05)',
             bottomLineColor: '#ef4444',
             bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
             bottomFillColor2: 'rgba(239, 68, 68, 0.28)',
             lineWidth: 3,
          });
        } else if (chartType === "Bar") {
          mainSeries = chart.addBarSeries({
             ...commonOptions,
             upColor: '#10b981',
             downColor: '#ef4444',
          });
        } else {
          mainSeries = chart.addCandlestickSeries({
            ...commonOptions,
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          });
        }
        
        // Determine if interval is intraday (requires UNIX timestamp) vs daily (requires string YYYY-MM-DD)
        const isIntraday = timeframe === '1d' || timeframe === '1wk' || timeframe === '1mo'; // Added 1mo because now 30m interval
        
        // Build a robust data map for tooltips from the unaltered OHLCV objects
        const robustDataMap = new Map<Time, OHLCV>();

        // Map data appropriately for v4.1.0 
        const mappedData = pricesData.map(p => {
          const dateObj = new Date(p.time as string);
          // If intraday, convert to UNIX seconds. If daily, ISO string sliced to YYYY-MM-DD
          const timeValue = isIntraday ? (dateObj.getTime() / 1000) as Time : dateObj.toISOString().split('T')[0] as Time;
          
          robustDataMap.set(timeValue, p);
          
          if (chartType === "Candlestick" || chartType === "Bar") {
            return {
              time: timeValue,
              open: p.open,
              high: p.high,
              low: p.low,
              close: p.close,
            };
          } else {
            return {
              time: timeValue,
              value: p.close,
            };
          }
        });
        mainSeries.setData(mappedData);

        if (!isIntraday) {
          // Only plot daily indicators on daily charts to avoid massive X-axis zooming bugs
          if (indicators.ma50) {
              const ma50Series = chart.addLineSeries({
                  color: '#3b82f6',
                  lineWidth: 2,
                  title: 'MA 50'
              });
              ma50Series.setData(indicators.ma50.map(i => ({ time: i.time as Time, value: i.value })));
          }

          if (indicators.ma200) {
              const ma200Series = chart.addLineSeries({
                  color: '#f59e0b',
                  lineWidth: 2,
                  title: 'MA 200'
              });
              ma200Series.setData(indicators.ma200.map(i => ({ time: i.time as Time, value: i.value })));
          }
        }

        const volumeSeries = chart.addHistogramSeries({
            color: '#374151',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', 
        });
        
        chart.priceScale('').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });
        
        const volumeData = pricesData.map((p) => {
            const dateObj = new Date(p.time as string);
            const timeValue = isIntraday ? (dateObj.getTime() / 1000) as Time : dateObj.toISOString().split('T')[0] as Time;
            return {
                time: timeValue,
                value: p.volume,
                color: p.close >= p.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' 
            };
        });
        volumeSeries.setData(volumeData);
        
        chart.timeScale().fitContent();

        // Crosshair tooltip functionality
        const formatVolume = (vol: number) => {
            if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
            if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
            if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
            return vol.toString();
        };

        chart.subscribeCrosshairMove((param) => {
            if (!tooltipRef.current || !chartContainerRef.current) return;

            const containerWidth = chartContainerRef.current.clientWidth;
            const containerHeight = chartContainerRef.current.clientHeight;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > containerWidth ||
                param.point.y < 0 ||
                param.point.y > containerHeight
            ) {
                tooltipRef.current.style.display = 'none';
                return;
            }

            const dataSeriesObj = param.seriesData.get(mainSeries) as any;
            const originalCandle = robustDataMap.get(param.time as Time);
            const volData = param.seriesData.get(volumeSeries) as any;
            
            if (originalCandle) {
                tooltipRef.current.style.display = 'block';
                const toolTipWidth = 192;
                const x = param.point.x;
                const containerWidth = chartContainerRef.current.clientWidth;
                
                let left = x + 15;
                if (left + toolTipWidth > containerWidth) {
                    left = x - toolTipWidth - 15;
                }
                
                let dateStr = "";
                let timeStr = "";
                if (typeof param.time === 'string') {
                    const d = new Date(param.time);
                    const parts = d.toDateString().split(" "); // e.g. "Tue Mar 24 2026"
                    dateStr = `${parts[1]} ${parts[2]} ${parts[3]}`;
                } else if (typeof param.time === 'number') {
                    const d = new Date(param.time * 1000);
                    const parts = d.toDateString().split(" ");
                    dateStr = `${parts[1]} ${parts[2]} ${parts[3]}`;
                    const hours = d.getHours().toString().padStart(2, '0');
                    const mins = d.getMinutes().toString().padStart(2, '0');
                    timeStr = `${hours}:${mins}`;
                }
                
                tooltipRef.current.style.left = left + 'px';
                tooltipRef.current.style.top = Math.max(10, param.point.y - 80) + 'px';

                tooltipRef.current.innerHTML = `
                    <div class="text-[11px] font-semibold text-gray-400 mb-2 border-b border-[#1f2937] pb-1 uppercase tracking-wider">
                        <div>Date: ${dateStr}</div>
                        ${timeStr ? `<div>Time: ${timeStr}</div>` : ''}
                    </div>
                    <div class="flex justify-between items-center mb-1"><span class="text-gray-400 text-xs text-left">Open:</span> <span class="font-mono text-white text-[13px] font-medium text-right">${curSymbol}${originalCandle.open.toFixed(2)}</span></div>
                    <div class="flex justify-between items-center mb-1"><span class="text-gray-400 text-xs text-left">High:</span> <span class="font-mono text-[#10b981] text-[13px] font-medium text-right">${curSymbol}${originalCandle.high.toFixed(2)}</span></div>
                    <div class="flex justify-between items-center mb-1"><span class="text-gray-400 text-xs text-left">Low:</span> <span class="font-mono text-[#ef4444] text-[13px] font-medium text-right">${curSymbol}${originalCandle.low.toFixed(2)}</span></div>
                    <div class="flex justify-between items-center mb-2"><span class="text-gray-400 text-xs text-left">Close:</span> <span class="font-mono text-white text-[13px] font-bold text-right">${curSymbol}${originalCandle.close.toFixed(2)}</span></div>
                    <div class="flex justify-between items-center mt-2 border-t border-[#1f2937] pt-2"><span class="text-gray-400 text-xs text-left">Volume:</span> <span class="font-mono text-gray-300 text-[13px] text-right bg-[#1f2937] px-1.5 py-0.5 rounded">${volData ? formatVolume(volData.value) : '0'}</span></div>
                `;
            } else {
                tooltipRef.current.style.display = 'none';
            }
        });

      } catch (error) {
        console.error("Failed to fetch chart data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
      }
    };
  }, [ticker, timeframe, chartType]);

  return (
    <div className={`flex flex-col w-full h-full relative ${isAdvanced ? 'min-h-screen bg-[#0b0f19] p-6' : ''}`}>
      <div className="flex justify-end items-center mb-6">
        <div className="flex space-x-2">
          {/* Chart Type Selector */}
          <select 
            className="bg-[#111827] text-white text-xs border border-[#1f2937] rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
          >
            <option value="Candlestick">Candlestick</option>
            <option value="Line">Line</option>
            <option value="Baseline">Baseline</option>
            <option value="Mountain">Mountain</option>
            <option value="Bar">Bar</option>
          </select>

          {/* Timeframe controls */}
          <div className="flex space-x-1 bg-[#0b0f19] p-1 rounded-lg border border-[#1f2937]">
            {['1d', '1wk', '1mo', '1y'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-[#1f2937] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full h-full relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111827]/80 rounded-xl backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        <div ref={tooltipRef} className="absolute z-20 bg-[#0b0f19]/95 backdrop-blur-md border border-[#1f2937] p-3 rounded-lg shadow-2xl pointer-events-none hidden w-48 transition-opacity"></div>
        <div ref={chartContainerRef} className={`w-full ${isAdvanced ? 'h-full flex-1 min-h-[600px]' : 'h-[400px]'}`} />
      </div>
    </div>
  );
};

export default StockChart;
