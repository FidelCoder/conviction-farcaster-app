import { UserPortfolio } from '../types';
import { 
  TrendingUp, 
  Wallet, 
  Lock, 
  History, 
  HelpCircle, 
  BookOpen,
  ArrowRight,
  ShieldCheck,
  User,
  Plus,
  Home
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portfolio: UserPortfolio;
  onOpenRequest: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, portfolio, onOpenRequest }: SidebarProps) {
  const primaryNavigation = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'markets', label: 'Markets', icon: TrendingUp },
    { id: 'margin-desk', label: 'Margin Desk', icon: Wallet },
    { id: 'vaults', label: 'Vaults', icon: Lock },
    { id: 'activity', label: 'Activity', icon: History }
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 z-40 flex flex-col bg-[#0e0e0e] border-r border-[#262626] transition-all duration-300 w-20 md:w-64">
      {/* Profiler Header (Hidden on Mobile) */}
      <div className="p-4 md:p-5 border-b border-[#262626] hidden md:block">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-[#262626] flex-shrink-0 flex items-center justify-center">
            <User size={20} className={portfolio.connected ? "text-deep-orange" : "text-[#ccc3d8]"} />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-mono text-xs font-bold text-white truncate">
              {portfolio.connected ? 'Margin Trader' : 'Terminal Guest'}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="font-mono text-[10px] text-[#ccc3d8] uppercase tracking-widest leading-none">
                {portfolio.connected ? 'Terminal Active' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Create Request button inside profiles panel */}
        <button 
          onClick={onOpenRequest}
          className="w-full bg-deep-orange text-black font-sans font-bold text-xs py-2.5 rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Open Request</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Mobile-only request indicator / button */}
      <div className="p-3 border-b border-[#262626] md:hidden flex justify-center">
        <button 
          onClick={onOpenRequest}
          className="p-2.5 bg-deep-orange text-black rounded-full hover:opacity-90 transition-opacity cursor-pointer"
          title="Open request"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Primary Tab Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2.5">
        {primaryNavigation.map((nav) => {
          const Icon = nav.icon;
          const isSelected = activeTab === nav.id;

          return (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id)}
              className={`flex items-center gap-3.5 px-3 py-3 rounded text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-deep-orange/10 text-deep-orange border-r-2 border-deep-orange'
                  : 'text-[#ccc3d8] hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-widest hidden md:inline font-bold">
                {nav.label}
              </span>
            </button>
          );
        })}

        {/* Hardcoded visual tabs from design */}
        <button
          onClick={() => {
            setActiveTab('activity');
            // Auto scroll to leaderboard after mounting can be handled or implied
          }}
          className={`flex items-center gap-3.5 px-3 py-3 rounded text-left transition-all text-[#ccc3d8] hover:text-white hover:bg-white/5 cursor-pointer`}
        >
          <ShieldCheck size={18} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-widest hidden md:inline font-bold">
            Leaderboard
          </span>
        </button>
      </nav>

      {/* Footer Navigation details */}
      <div className="p-3 md:p-4 border-t border-[#262626] flex flex-col gap-1.5 mt-auto">
        <a 
          href="#help" 
          onClick={(e) => { e.preventDefault(); alert('Support desk is not connected yet.'); }}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <HelpCircle size={16} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-wider hidden md:inline">Support</span>
        </a>
        <a 
          href="#docs" 
          onClick={(e) => { e.preventDefault(); alert('Docs route is not connected yet.'); }}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <BookOpen size={16} className="flex-shrink-0 text-[#ccc3d8]" />
          <span className="font-mono text-[10px] uppercase tracking-wider hidden md:inline">Docs</span>
        </a>
      </div>
    </aside>
  );
}
