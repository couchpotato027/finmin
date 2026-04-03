import React, { useEffect, useState } from 'react';
import { fetchAiSignal, AiSignal } from '../api';
import { CheckCircle2, TrendingUp, Info } from 'lucide-react';

interface SignalPanelProps {
  ticker: string;
  passedSignal?: AiSignal | null;
  scanTimestamp?: string | null;
}

const SignalPanel: React.FC<SignalPanelProps> = ({ ticker, passedSignal, scanTimestamp }) => {
  const [signalData, setSignalData] = useState<AiSignal | null>(null);
  const [signalSource, setSignalSource] = useState<'scanner' | 'fresh' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSignal = async () => {
      // Prioritize scanner signal if available for current ticker
      if (passedSignal && passedSignal.ticker === ticker) {
        setSignalData(passedSignal);
        setSignalSource('scanner');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/signal/${ticker}`);
        const data = await response.json();
        setSignalData(data);
        setSignalSource('fresh');
      } catch (error) {
        console.error("Failed to fetch AI signal:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSignal();
  }, [ticker, passedSignal]);

  if (loading || !signalData) {
    return (
      <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-gray-400 mt-4 text-sm font-medium">Analyzing {ticker}...</p>
      </div>
    );
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_15px_rgba(52,211,153,0.1)]';
      case 'SELL': return 'text-rose-400 bg-rose-400/10 border-rose-400/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]';
      case 'HOLD': return 'text-amber-400 bg-amber-400/10 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
    }
  };

  const getConfidenceText = (conf: number) => {
    if (conf >= 75) return 'HIGH CONVICTION';
    if (conf >= 40) return 'MODERATE';
    return 'SPECULATIVE';
  };

  return (
    <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-lg flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
          AI Signal Intelligence
        </h3>
        {signalSource === 'scanner' ? (
          <div className="flex items-center text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 uppercase tracking-tighter">
            Signal from scanner scan (live)
          </div>
        ) : signalSource === 'fresh' ? (
          <div className="flex items-center text-[9px] font-black text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded border border-gray-500/20 uppercase tracking-tighter">
            Signal fetched on demand
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#1f2937]/30 p-4 rounded-xl border border-[#1f2937]">
          <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mb-2">Dominant Signal</p>
          <div className={`px-3 py-1 rounded-lg border ${getSignalColor(signalData.signal)} font-black text-lg inline-block`}>
            {signalData.signal}
          </div>
        </div>
        
        <div className="bg-[#1f2937]/30 p-4 rounded-xl border border-[#1f2937] text-right">
          <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mb-2">Composite Score</p>
          <div className="flex items-baseline justify-end">
            <span className={`text-3xl font-black ${
              signalData.score > 0 ? 'text-emerald-400' : 
              signalData.score < 0 ? 'text-rose-400' : 'text-white'
            }`}>{signalData.score > 0 ? '+' : ''}{signalData.score}</span>
          </div>
          <p className="text-[9px] font-black tracking-widest text-blue-400 mt-1 uppercase">{getConfidenceText(signalData.confidence)}</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Detection Confidence</span>
          <span className="text-white font-black">{signalData.confidence}%</span>
        </div>
        <div className="w-full bg-[#1f2937] rounded-full h-2 shadow-inner">
          <div 
            className={`h-2 rounded-full transition-all duration-700 ${
              signalData.signal === 'BUY' ? 'bg-emerald-500' : 
              signalData.signal === 'SELL' ? 'bg-rose-500' : 'bg-amber-500'
            }`} 
            style={{ width: `${signalData.confidence}%` }}>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="mb-6 grid grid-cols-3 gap-2">
            <div className="bg-[#0b0f19] p-2 rounded-lg border border-[#1f2937] text-center">
                <p className="text-[8px] text-gray-500 font-black uppercase mb-1">RSI</p>
                <p className={`text-xs font-black ${signalData.rsi < 40 ? 'text-emerald-400' : signalData.rsi > 60 ? 'text-rose-400' : 'text-white'}`}>
                    {signalData.rsi.toFixed(1)}
                </p>
            </div>
            <div className="bg-[#0b0f19] p-2 rounded-lg border border-[#1f2937] text-center">
                <p className="text-[8px] text-gray-500 font-black uppercase mb-1">MACD</p>
                <p className={`text-xs font-black capitalize ${signalData.macd_signal === 'bullish' ? 'text-emerald-400' : signalData.macd_signal === 'bearish' ? 'text-rose-400' : 'text-white'}`}>
                    {signalData.macd_signal}
                </p>
            </div>
            <div className="bg-[#0b0f19] p-2 rounded-lg border border-[#1f2937] text-center">
                <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Volume</p>
                <p className={`text-xs font-black capitalize ${signalData.volume_pulse === 'high' ? 'text-emerald-400' : signalData.volume_pulse === 'low' ? 'text-rose-400' : 'text-white'}`}>
                    {signalData.volume_pulse}
                </p>
            </div>
        </div>

        <h4 className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-4 flex items-center">
            <Info className="w-3.5 h-3.5 mr-2 text-blue-500"/>
            Technical Logic
        </h4>
        <ul className="space-y-3">
          {signalData.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start bg-[#1f2937]/20 p-2 rounded-lg border border-[#1f2937]/30">
              <CheckCircle2 className="w-3.5 h-3.5 mr-3 flex-shrink-0 text-blue-500 mt-0.5" />
              <span className="text-gray-300 text-xs leading-relaxed font-medium">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SignalPanel;
