import { UserSession } from "../../lib/core-api";
import { UserPortfolio } from "../types";
import {
  TrendingUp,
  Wallet,
  Lock,
  History,
  HelpCircle,
  BookOpen,
  Settings,
  Bell,
  ArrowRight,
  X,
  ShieldCheck,
  User,
  Home,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portfolio: UserPortfolio;
  session: UserSession | null;
  onOpenRequest: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  portfolio,
  session,
  onOpenRequest,
  mobileOpen,
  onCloseMobile = () => undefined,
}: SidebarProps) {
  const isMobileOpen = Boolean(mobileOpen);
  const primaryNavigation = [
    { id: "landing", label: "Home", icon: Home },
    { id: "markets", label: "Markets", icon: TrendingUp },
    { id: "margin-desk", label: "Margin Desk", icon: Wallet },
    { id: "vaults", label: "Vaults", icon: Lock },
    { id: "activity", label: "Activity", icon: History },
  ];

  return (
    <>
      {isMobileOpen ? (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-[55] bg-black/65 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          type="button"
        />
      ) : null}
      <aside className={`fixed left-0 top-16 bottom-0 z-[60] w-72 flex-col bg-[#0e0e0e] border-r border-[#262626] transition-transform duration-200 md:z-40 md:flex md:w-64 md:translate-x-0 ${
        isMobileOpen ? "flex translate-x-0" : "flex -translate-x-full"
      }`}>
      <div className="md:hidden flex items-center justify-between border-b border-[#262626] px-4 py-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]">Menu</span>
        <button
          aria-label="Close navigation menu"
          className="grid h-9 w-9 place-items-center rounded border border-[#262626] text-[#ccc3d8] hover:border-white/40 hover:text-white"
          onClick={onCloseMobile}
          type="button"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile Header */}
      <div className="p-4 md:p-5 border-b border-[#262626]">
        <button
          onClick={() => {
            onCloseMobile();
            window.location.href = "/me/profile";
          }}
          className="w-full flex items-center gap-3 mb-4 text-left hover:bg-white/5 rounded-lg p-1 -mx-1 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-[#262626] flex-shrink-0 flex items-center justify-center">
            {session?.traderProfile?.avatarUrl || session?.socialAccount?.profileUrl ? (
              <img
                alt="Profile avatar"
                className="w-full h-full object-cover"
                src={session?.traderProfile?.avatarUrl || session?.socialAccount?.profileUrl || ""}
              />
            ) : (
              <User
                size={20}
                className={portfolio.connected ? "text-deep-orange" : "text-[#ccc3d8]"}
              />
            )}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <h3 className="font-mono text-xs font-bold text-white truncate">
              {session?.traderProfile?.handle || (portfolio.connected ? "trader.viction" : "guest")}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="font-mono text-[10px] text-[#ccc3d8] uppercase tracking-widest leading-none">
                {session?.user?.email ? "Verified" : "Profile"}
              </span>
            </div>
          </div>
        </button>

        {/* Create Request button inside profiles panel */}
        <button
          onClick={() => {
            onOpenRequest();
            onCloseMobile();
          }}
          className="w-full bg-deep-orange text-black font-sans font-bold text-xs py-2.5 rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Open Request</span>
          <ArrowRight size={14} />
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
              onClick={() => {
                setActiveTab(nav.id);
                onCloseMobile();
              }}
              className={`flex items-center gap-3.5 px-3 py-3 rounded text-left transition-all cursor-pointer ${
                isSelected
                  ? "bg-deep-orange/10 text-deep-orange border-r-2 border-deep-orange"
                  : "text-[#ccc3d8] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-widest inline font-bold">
                {nav.label}
              </span>
            </button>
          );
        })}

        {/* Hardcoded visual tabs from design */}
        <button
          onClick={() => {
            setActiveTab("activity");
            onCloseMobile();
          }}
          className={`flex items-center gap-3.5 px-3 py-3 rounded text-left transition-all text-[#ccc3d8] hover:text-white hover:bg-white/5 cursor-pointer`}
        >
          <ShieldCheck size={18} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-widest inline font-bold">
            Leaderboard
          </span>
        </button>
      </nav>

      {/* Footer Navigation details */}
      <div className="p-3 md:p-4 border-t border-[#262626] flex flex-col gap-1.5 mt-auto">
        <a
          href="/me/notifications"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <Bell size={16} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-wider inline">
            Notifications
          </span>
        </a>
        <a
          href="/me/settings"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <Settings size={16} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-wider inline">
            Settings
          </span>
        </a>
        <a
          href="/docs"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <BookOpen size={16} className="flex-shrink-0 text-[#ccc3d8]" />
          <span className="font-mono text-[10px] uppercase tracking-wider inline">
            Docs
          </span>
        </a>
        <a
          href="/docs#glossary"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 text-[#ccc3d8] hover:text-white transition-colors"
        >
          <HelpCircle size={16} className="flex-shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-wider inline">
            Support
          </span>
        </a>
      </div>
    </aside>
    </>
  );
}
