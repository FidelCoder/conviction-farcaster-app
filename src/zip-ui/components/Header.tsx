import { useEffect, useRef, useState } from "react";

import { UserPortfolio } from "../types";
import { Bell, Check, Copy, LogOut, Menu, Settings, Wallet, Layers } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portfolio: UserPortfolio;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
  onOpenMenu?: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  portfolio,
  onConnectWallet,
  onDisconnectWallet,
  onOpenMenu,
}: HeaderProps) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const walletLabel = portfolio.connected && portfolio.address
    ? `${portfolio.address.slice(0, 6)}...${portfolio.address.slice(-4)}`
    : "CONNECT WALLET";
  const tabs = [
    { id: "markets", label: "Markets" },
    { id: "margin-desk", label: "Margin Desk" },
    { id: "vaults", label: "Vaults" },
    { id: "activity", label: "Activity" },
  ];

  useEffect(() => {
    if (!walletMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!walletMenuRef.current?.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setWalletMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [walletMenuOpen]);

  async function copyWalletAddress() {
    if (!portfolio.address) return;

    try {
      await navigator.clipboard.writeText(portfolio.address);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("idle");
    }
  }

  function handleWalletButtonClick() {
    if (!portfolio.connected) {
      onConnectWallet();
      return;
    }

    setWalletMenuOpen((open) => !open);
  }

  function handleDisconnectWallet() {
    setWalletMenuOpen(false);
    onDisconnectWallet?.();
  }

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center gap-3 px-3 sm:px-5 md:px-10 h-16 bg-[#161616]/80 backdrop-blur-md border-b border-[#262626]">
      <div className="flex items-center gap-3 md:gap-6 min-w-0">
        {onOpenMenu ? (
          <button
            aria-label="Open navigation menu"
            className="md:hidden w-10 h-10 rounded border border-[#262626] bg-[#0e0e0e] text-[#ccc3d8] hover:border-deep-orange hover:text-white flex items-center justify-center transition-colors"
            onClick={onOpenMenu}
            type="button"
          >
            <Menu size={18} />
          </button>
        ) : null}

        {/* Logo */}
        <button
          onClick={() => setActiveTab("landing")}
          className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
        >
          <div className="w-7 h-7 bg-electric-purple rounded flex items-center justify-center transition-transform group-hover:scale-105">
            <Layers size={16} className="text-white" />
          </div>
          <span className="hidden sm:block text-lg font-sans font-bold text-[#e5e2e1] tracking-tight truncate">
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
                    ? "text-deep-orange font-semibold border-b-2 border-deep-orange opacity-100"
                    : "text-[#ccc3d8]/80 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 flex-shrink-0">
        {/* Notifications → My Activity */}
        <button
          className="text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 relative cursor-pointer"
          onClick={() => {
            window.location.href = "/me/notifications";
          }}
          title="Notifications"
        >
          <Bell size={18} />
          {portfolio.connected && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-deep-orange animate-pulse" />
          )}
        </button>

        {/* Settings → Profile */}
        <button
          className="text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 cursor-pointer"
          onClick={() => {
            window.location.href = "/me/settings";
          }}
          title="Settings"
        >
          <Settings size={18} />
        </button>

        {/* Wallet Connector */}
        <div className="relative" ref={walletMenuRef}>
          <button
            aria-expanded={portfolio.connected ? walletMenuOpen : undefined}
            aria-haspopup={portfolio.connected ? "menu" : undefined}
            onClick={handleWalletButtonClick}
            className={`px-2.5 sm:px-4 py-1.5 rounded text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-2 border cursor-pointer max-w-[10rem] sm:max-w-none ${
              portfolio.connected
                ? "bg-[#1c1b1b] border-deep-orange text-deep-orange shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:border-white hover:text-white"
                : "bg-deep-orange border-deep-orange text-black hover:bg-white hover:border-white hover:text-black font-semibold"
            }`}
            type="button"
          >
            <Wallet size={14} />
            <span className="truncate">{walletLabel}</span>
          </button>

          {portfolio.connected && portfolio.address && walletMenuOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+0.6rem)] z-[70] w-64 overflow-hidden rounded border border-[#262626] bg-[#101010] shadow-2xl shadow-black/50"
              role="menu"
            >
              <div className="border-b border-[#262626] px-3 py-3">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">Connected wallet</p>
                <p className="mt-1 truncate font-mono text-xs font-bold text-white">{portfolio.address}</p>
              </div>
              <button
                className="flex w-full items-center gap-2 px-3 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => void copyWalletAddress()}
                role="menuitem"
                type="button"
              >
                {copyState === "copied" ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
                {copyState === "copied" ? "Copied" : "Copy address"}
              </button>
              <button
                className="flex w-full items-center gap-2 border-t border-[#262626] px-3 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange transition-colors hover:bg-deep-orange hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!onDisconnectWallet}
                onClick={handleDisconnectWallet}
                role="menuitem"
                type="button"
              >
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
