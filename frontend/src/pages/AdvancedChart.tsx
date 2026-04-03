import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import StockChart from '../components/StockChart';
import { ArrowLeft } from 'lucide-react';

const AdvancedChart: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTicker = searchParams.get('ticker') || 'AAPL';
  const [ticker, setTicker] = useState(initialTicker);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col font-sans selection:bg-blue-500/30">
      <TopBar ticker={ticker} setTicker={setTicker} />
      
      <div className="flex-1 w-full p-2 lg:p-6 flex flex-col">
        <div className="mb-4 flex items-center justify-between">
           <button 
             onClick={() => navigate('/')}
             className="flex items-center text-sm text-gray-400 hover:text-white transition-colors bg-[#111827] px-3 py-1.5 rounded-lg border border-[#1f2937]"
           >
             <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
           </button>
           <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
             Advanced Pro Chart: {ticker}
           </div>
        </div>
        
        <div className="flex-1 bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden shadow-2xl flex flex-col w-full h-full min-h-[700px]">
          <StockChart ticker={ticker} isAdvanced={true} />
        </div>
      </div>
    </div>
  );
};

export default AdvancedChart;
