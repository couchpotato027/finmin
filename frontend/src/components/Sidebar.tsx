import React from 'react';
import { LayoutDashboard, LineChart, PieChart, Settings, Activity, Play } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

interface SidebarProps {
  onSettingsClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSettingsClick }) => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Scanner', icon: Activity, path: '/scanner' },
    { name: 'Portfolio', icon: PieChart, path: '/portfolio' },
    { name: 'Analytics', icon: LineChart, path: '/analytics' },
    { name: 'Backtest', icon: Play, path: '/backtest' },
  ];

  return (
    <aside className="w-64 bg-[#111827] border-r border-[#1f2937] flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-[#1f2937]">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3 font-bold text-white shadow-lg shadow-blue-500/20">F</div>
        <span className="text-xl font-bold tracking-tight text-white">FinMin</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-600/10 text-blue-500'
                : 'text-gray-400 hover:bg-[#1f2937]/50 hover:text-gray-200'
            }`}
          >
            <item.icon className={`h-5 w-5 ${location.pathname === item.path ? 'text-blue-500' : 'text-gray-400'}`} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t border-[#1f2937]">
        <button 
          onClick={onSettingsClick}
          className="w-full flex items-center px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#1f2937]/50"
        >
          <Settings className="w-5 h-5 mr-3" /> Settings
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
