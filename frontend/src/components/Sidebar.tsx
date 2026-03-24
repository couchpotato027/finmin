import React from 'react';
import { LayoutDashboard, Activity, Briefcase, FileText, FastForward, Settings } from 'lucide-react';

const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#111827] border-r border-[#1f2937] flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-[#1f2937]">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white mr-3 shadow-lg shadow-blue-500/20">
          F
        </div>
        <span className="text-xl font-bold tracking-tight text-white">FinMin</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        <a href="#" className="flex items-center px-4 py-3 bg-blue-500/10 rounded-lg text-blue-400 font-medium border-l-2 border-blue-500 transition-colors">
          <LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1f2937]/50 rounded-lg transition-colors">
          <Activity className="w-5 h-5 mr-3" /> Signals
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1f2937]/50 rounded-lg transition-colors">
          <Briefcase className="w-5 h-5 mr-3" /> Portfolio Simulator
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1f2937]/50 rounded-lg transition-colors">
          <FileText className="w-5 h-5 mr-3" /> News Sentiment
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1f2937]/50 rounded-lg transition-colors">
          <FastForward className="w-5 h-5 mr-3" /> Backtesting
        </a>
      </nav>
      
      <div className="p-4 border-t border-[#1f2937]">
        <a href="#" className="flex items-center px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#1f2937]/50">
          <Settings className="w-5 h-5 mr-3" /> Settings
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
