import React, { useState } from 'react';
import Sidebar from './Sidebar';
import SettingsPanel from './SettingsPanel';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full bg-[#0b0f19] text-gray-200 font-sans flex overflow-hidden">
      <Sidebar 
        onSettingsClick={() => setSettingsOpen(true)} 
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <button 
          className="md:hidden fixed top-3 left-3 z-[60] 
                     bg-[#111827] p-2 rounded-lg 
                     border border-[#1f2937]"
          onClick={() => setSidebarOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        {children}
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default Layout;
