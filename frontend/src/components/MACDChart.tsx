import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, Time, ColorType } from 'lightweight-charts';
import { fetchStockIndicators, MACDData } from '../api';

interface MACDChartProps {
  ticker: string;
}

const MACDChart: React.FC<MACDChartProps> = ({ ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);

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
        const indicators = await fetchStockIndicators(ticker);
        console.log(`[MACDChart] Fetched indicators for ${ticker}:`, indicators);
        
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(chartContainerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: '#111827' },
            textColor: '#9ca3af',
          },
          grid: {
            vertLines: { color: '#1f2937' },
            horzLines: { color: '#1f2937' },
          },
          width: chartContainerRef.current.clientWidth,
          height: 180,
          rightPriceScale: {
            borderColor: '#1f2937',
            visible: true,
          },
          timeScale: {
            borderColor: '#1f2937',
            timeVisible: true,
            visible: true,
          },
        });
        chartRef.current = chart;

        const macdLineSeries = chart.addLineSeries({
          color: '#3b82f6',
          lineWidth: 2,
          title: 'MACD',
        });

        const signalLineSeries = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          title: 'Signal',
        });

        const histogramSeries = chart.addHistogramSeries({
          color: '#374151',
          priceFormat: {
            type: 'volume',
          },
        });

        let macdData: any[] = [];
        let signalData: any[] = [];
        let histData: any[] = [];

        // Support both old object format and new array format
        if (Array.isArray(indicators.macd)) {
          macdData = indicators.macd
            .filter((item: any) => item.macd !== null)
            .map((item: any) => ({
              time: item.time as Time,
              value: item.macd,
            }));

          signalData = indicators.macd
            .filter((item: any) => item.signal !== null)
            .map((item: any) => ({
              time: item.time as Time,
              value: item.signal,
            }));

          histData = indicators.macd
            .filter((item: any) => item.hist !== null)
            .map((item: any) => ({
              time: item.time as Time,
              value: item.hist,
              color: item.hist >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            }));
        } else if (indicators.macd && (indicators.macd as any).macdLine) {
          // Old format fallback
          const oldMacd = indicators.macd as any;
          macdData = oldMacd.macdLine.map((i: any) => ({ time: i.time as Time, value: i.value }));
          signalData = oldMacd.signalLine.map((i: any) => ({ time: i.time as Time, value: i.value }));
          histData = oldMacd.histogram.map((i: any) => ({ 
              time: i.time as Time, 
              value: i.value,
              color: i.value >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
          }));
        }

        macdLineSeries.setData(macdData);
        signalLineSeries.setData(signalData);
        histogramSeries.setData(histData);
        
        // Dynamic auto-scale for MACD
        const allValues = [
            ...macdData.map(d => d.value),
            ...signalData.map(d => d.value),
            ...histData.map(d => d.value)
        ].filter(v => v !== null && !isNaN(v));
        
        if (allValues.length > 0) {
            const maxVal = Math.max(...allValues);
            const minVal = Math.min(...allValues);
            const range = maxVal - minVal;
            const margin = range * 0.15; // 15% margin
            
            macdLineSeries.applyOptions({
                autoscaleInfoProvider: () => ({
                    priceRange: {
                        minValue: minVal - margin,
                        maxValue: maxVal + margin,
                    },
                }),
            });
            
            chart.priceScale('right').applyOptions({
                autoScale: true,
            });
        }
        
        chart.timeScale().fitContent();

      } catch (error) {
        console.error("Failed to fetch MACD data:", error);
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
  }, [ticker]);

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111827]/50 backdrop-blur-sm rounded-xl">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-[180px]" />
    </div>
  );
};

export default MACDChart;
