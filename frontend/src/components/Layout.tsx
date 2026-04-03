import React, { useState } from 'react';
import Sidebar from './Sidebar';
import SettingsPanel from './SettingsPanel';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-screen w-full bg-[#0b0f19] text-gray-200 font-sans flex overflow-hidden">
      <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default Layout;
