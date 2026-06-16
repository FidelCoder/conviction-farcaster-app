import { UserPortfolio } from '../types';
import { Bell, Settings, Wallet, Layers } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portfolio: UserPortfolio;
  onConnectWallet: () => void;
}

export default function Header({ activeTab, setActiveTab, portfolio, onConnectWallet }: HeaderProps) {
  const tabs = [
    { id: 'markets', label: 'Markets' },
    { id: 'margin-desk', label: 'Margin Desk' },
    { id: 'vaults', label: 'Vaults' },
    { id: 'activity', label: 'Activity' }
  ];

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-10 h-16 bg-[#161616]/80 backdrop-blur-md border-b border-[#262626]">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <button 
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <div className="w-7 h-7 bg-electric-purple rounded flex items-center justify-center transition-transform group-hover:scale-105">
            <Layers size={16} className="text-white" />
          </div>
          <span className="text-lg font-sans font-bold text-[#e5e2e1] tracking-tight">
            Conviction Markets
          </span>
        </button>

        {/* Desktop Tabs */}
        <nav className="hidden md:flex gap-6 ml-8 h-full">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-1 hover:text-white transition-colors duration-200 h-16 flex items-center text-sm font-medium ${
                  isTabActive
                    ? 'text-deep-orange font-semibold border-b-2 border-deep-orange opacity-100'
                    : 'text-[#ccc3d8]/80 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 relative cursor-pointer">
          <Bell size={18} />
          {portfolio.connected && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-deep-orange animate-pulse" />
          )}
        </button>

        {/* Settings */}
        <button className="text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 cursor-pointer">
          <Settings size={18} />
        </button>

        {/* Wallet Connector */}
        <button
          onClick={onConnectWallet}
          className={`px-4 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-2 border cursor-pointer ${
            portfolio.connected
              ? 'bg-[#1c1b1b] border-deep-orange text-deep-orange shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:border-white hover:text-white'
              : 'bg-deep-orange border-deep-orange text-black hover:bg-white hover:border-white hover:text-black font-semibold'
          }`}
        >
          <Wallet size={14} />
          {portfolio.connected && portfolio.address
            ? `${portfolio.address.slice(0, 6)}...${portfolio.address.slice(-4)}`
            : 'CONNECT WALLET'}
        </button>
      </div>
    </header>
  );
}
