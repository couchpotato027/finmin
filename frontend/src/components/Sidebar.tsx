import React from 'react';
import { LayoutDashboard, LineChart, PieChart, Settings, Activity, Play } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import Logo from './Logo';

interface SidebarProps {
  onSettingsClick?: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSettingsClick, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Scanner', icon: Activity, path: '/scanner' },
    { name: 'Portfolio', icon: PieChart, path: '/portfolio' },
    { name: 'Analytics', icon: LineChart, path: '/analytics' },
    { name: 'Backtest', icon: Play, path: '/backtest' },
  ];

  return (
    <>
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        h-full flex flex-col
        bg-[#111827] border-r border-[#1f2937]
        transition-transform duration-200
        w-64 shrink-0
        ${mobileOpen 
          ? 'translate-x-0' 
          : '-translate-x-full md:translate-x-0'}
      `}>
      <div className="h-16 flex items-center px-6 border-b border-[#1f2937]">
        <Logo className="h-6 md:h-8 w-auto" />
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
          <Settings className="w-5 h-5 mr-3" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
