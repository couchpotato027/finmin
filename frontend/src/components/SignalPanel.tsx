import React, { useEffect, useState } from 'react';
import { fetchAiSignal, AiSignal } from '../api';
import { CheckCircle2, TrendingUp, Info } from 'lucide-react';

interface SignalPanelProps {
  ticker: string;
}

const SignalPanel: React.FC<SignalPanelProps> = ({ ticker }) => {
  const [signalData, setSignalData] = useState<AiSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSignal = async () => {
      setLoading(true);
      try {
        const data = await fetchAiSignal(ticker);
        setSignalData(data);
      } catch (error) {
        console.error("Failed to fetch AI signal:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSignal();
  }, [ticker]);

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
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
    }
  };

  const getConfidenceText = (conf: number) => {
    if (conf >= 80) return 'STRONG';
    if (conf >= 60) return 'MODERATE';
    return 'WEAK';
  };

  return (
    <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-white font-semibold text-lg flex items-center mb-6">
        <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
        AI Signal Intelligence
      </h3>

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Status</p>
          <div className={`px-4 py-1.5 rounded-lg border ${getSignalColor(signalData.signal)} font-bold text-xl inline-block`}>
            {signalData.signal}
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Confidence</p>
          <div className="flex items-baseline justify-end">
            <span className="text-3xl font-bold text-white">{signalData.confidence}</span>
            <span className="text-gray-500 font-semibold text-sm ml-1">/100</span>
          </div>
          <p className="text-[10px] font-bold tracking-widest text-blue-400 mt-1 uppercase">{getConfidenceText(signalData.confidence)}</p>
        </div>
      </div>

      <div className="mb-6">
         <div className="w-full bg-[#1f2937] rounded-full h-1.5 mb-2">
           <div 
             className={`h-1.5 rounded-full ${signalData.signal === 'BUY' ? 'bg-emerald-400' : signalData.signal === 'SELL' ? 'bg-rose-400' : 'bg-blue-400'}`} 
             style={{ width: `${signalData.confidence}%` }}>
           </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-4 flex items-center">
            <Info className="w-4 h-4 mr-2"/>
            Reasoning
        </h4>
        <ul className="space-y-3">
          {signalData.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start">
              <CheckCircle2 className="w-4 h-4 mr-3 flex-shrink-0 text-blue-500 mt-0.5" />
              <span className="text-gray-300 text-sm leading-relaxed">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SignalPanel;
