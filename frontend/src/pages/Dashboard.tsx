import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import StockChart from '../components/StockChart';
import RSIChart from '../components/RSIChart';
import MACDChart from '../components/MACDChart';
import SignalPanel from '../components/SignalPanel';
import NewsFeed from '../components/NewsFeed';
import TopBar from '../components/TopBar';

const Dashboard: React.FC = () => {
  const [ticker, setTicker] = useState('AAPL');

  return (
    <div className="h-screen w-full bg-[#0b0f19] text-gray-200 font-sans flex overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <TopBar ticker={ticker} setTicker={setTicker} />

        {/* Dashboard Body */}
        <div className="flex-1 overflow-auto p-8">
          <div className="flex items-baseline space-x-4 mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">{ticker}</h1>
            <span className="text-gray-400 text-lg font-medium">Market Analysis Quantitative Dashboard</span>
          </div>
          
          {/* Main Grid structure as per requirements: grid-cols-[3fr_1fr] */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6 max-w-full pb-8">
            
            {/* Left Column: Charts and Indicators */}
            <div className="flex flex-col space-y-6">
              {/* Main Chart Card */}
              <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col relative z-0">
                <div className="w-full flex-1 min-h-[400px]">
                   <StockChart ticker={ticker} />
                </div>
              </div>

              {/* Indicator Panel Placholders for RSI and MACD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col h-64 relative overflow-hidden">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 tracking-wider uppercase">Relative Strength Index (14)</h3>
                    <div className="flex-1 w-full">
                       <RSIChart ticker={ticker} />
                    </div>
                 </div>
                 <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-lg flex flex-col h-64 relative overflow-hidden">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 tracking-wider uppercase">MACD (12, 26, 9)</h3>
                    <div className="flex-1 w-full">
                       <MACDChart ticker={ticker} />
                    </div>
                 </div>
              </div>
            </div>

            {/* Right Column: AI Signals & News Feed */}
            <div className="flex flex-col space-y-6 h-full">
              <div className="h-[380px] shrink-0">
                <SignalPanel ticker={ticker} />
              </div>
              
              <div className="flex-1 min-h-[300px]">
                <NewsFeed ticker={ticker} />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
