import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, Time, ColorType } from 'lightweight-charts';
import { fetchStockIndicators } from '../api';

interface RSIChartProps {
  ticker: string;
}

const RSIChart: React.FC<RSIChartProps> = ({ ticker }) => {
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
            visible: false, // Hide time scale to save space in the panel
          },
        });
        chartRef.current = chart;

        const rsiSeries = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => price.toFixed(1),
          },
          autoscaleInfoProvider: () => ({
            priceRange: {
               minValue: 0,
               maxValue: 100,
            },
          }),
        });

        // Add 70/30 horizontal lines
        rsiSeries.createPriceLine({
            price: 70,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Overbought',
        });

        rsiSeries.createPriceLine({
            price: 30,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Oversold',
        });

        // Use appropriate margins
        chart.priceScale('right').applyOptions({
            autoScale: true,
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        });

        if (!indicators || !indicators.rsi || !Array.isArray(indicators.rsi)) {
          console.warn("Invalid RSI data:", indicators);
          return;
        }

        const rsiData = indicators.rsi.map((item: any) => ({
          time: item.time as Time,
          value: item.value,
        }));
        
        rsiSeries.setData(rsiData);
        chart.timeScale().fitContent();

      } catch (error) {
        console.error("Failed to fetch RSI data:", error);
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

export default RSIChart;
