import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { UserSession } from "../../lib/core-api";
import {
  BrowserWalletMarks,
  PolymarketWalletMark,
  GoogleWalletMark,
  ThirdwebMark,
  TonWalletMark,
} from "../../components/AuthWalletMarks";
import type { PortfolioWalletBalance, UserPortfolio } from "../types";
import {
  Bell,
  BookOpen,
  Briefcase,
  ChevronDown,
  Check,
  Copy,
  HelpCircle,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portfolio: UserPortfolio;
  onConnectWallet: (mode?: "smart" | "eoa" | "ton" | "polymarket") => void;
  onOpenSignInMenu?: () => void;
  onDisconnectWallet?: () => void;
  onOpenPortfolio?: () => void;
  session?: UserSession | null;
}

export default function Header({
  activeTab,
  setActiveTab,
  portfolio,
  onConnectWallet,
  onDisconnectWallet,
  onOpenSignInMenu,
  onOpenPortfolio,
  session,
}: HeaderProps) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const walletBalances = getReadyWalletBalances(portfolio);
  const walletLabel = portfolio.connected
    ? getWalletButtonLabel(portfolio, walletBalances)
    : "SIGN IN";
  const accountLabel =
    session?.traderProfile?.handle ?? (portfolio.connected ? "Conviction wallet" : "Guest");
  const tabs = [
    { id: "markets", label: "Markets", href: "/markets" },
    { id: "activity", label: "Pulse", href: "/activity" },
    { id: "vaults", label: "Vaults", href: "/vaults" },
    { id: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
  ];
  const mobileTabs = tabs;

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
    if (!portfolio.connected && onOpenSignInMenu) {
      onOpenSignInMenu();
      return;
    }

    if (!portfolio.connected) {
      setWalletMenuOpen(true);
      return;
    }

    handleOpenPortfolio();
  }

  function handleWalletMenuButtonClick() {
    setWalletMenuOpen((open) => !open);
  }

  function handleNavTab(tab: { id: string; href: string }) {
    const localTabs = new Set(["landing", "markets", "vaults", "activity"]);

    if (localTabs.has(tab.id)) {
      setActiveTab(tab.id);
      return;
    }

    window.location.href = tab.href;
  }

  function handleSignInMode(mode: "smart" | "eoa" | "ton" | "polymarket") {
    setWalletMenuOpen(false);
    onConnectWallet(mode);
  }

  function handleOpenPortfolio() {
    setWalletMenuOpen(false);
    if (onOpenPortfolio) {
      onOpenPortfolio();
      return;
    }

    window.location.href = "/me";
  }

  function handleDisconnectWallet() {
    setWalletMenuOpen(false);
    onDisconnectWallet?.();
  }

  return (
    <header className="fixed top-0 z-50 flex w-full flex-col border-b border-[#262626] bg-[#161616]/90 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between gap-2 px-2 sm:px-5 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-5">
          {/* Logo */}
          <button
            onClick={() => setActiveTab("landing")}
            className="flex min-w-0 flex-1 cursor-pointer items-center text-left group lg:flex-none"
            type="button"
          >
            <Image
              alt="Conviction Markets"
              className="h-7 w-auto max-w-[8.5rem] object-contain sm:h-9 sm:max-w-[13rem] xl:max-w-[15.5rem]"
              height={120}
              priority
              src="/logo/conviction-markets-header.png"
              width={620}
            />
          </button>

          {/* Desktop Tabs */}
          <nav className="hidden lg:flex min-w-0 flex-1 items-center justify-center gap-1 h-full">
            {tabs.map((tab) => {
              const isTabActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavTab(tab)}
                  className={`relative px-2 xl:px-3 hover:text-white transition-colors duration-200 h-16 flex items-center whitespace-nowrap text-xs xl:text-sm font-medium ${
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

        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-1 border-r border-[#262626] pr-2">
            <a
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#ccc3d8] transition-colors hover:bg-white/5 hover:text-white"
              href="/docs"
              title="Docs"
            >
              <BookOpen size={17} />
            </a>
            <a
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#ccc3d8] transition-colors hover:bg-white/5 hover:text-white"
              href="/support"
              title="Support"
            >
              <HelpCircle size={17} />
            </a>
          </div>
          {portfolio.connected ? (
            <>
              <button
                className="hidden min-[390px]:inline-flex text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 relative cursor-pointer"
                onClick={() => {
                  window.location.href = "/me/notifications";
                }}
                title="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-deep-orange animate-pulse" />
              </button>

              <button
                className="hidden sm:inline-flex text-[#ccc3d8] hover:text-[#d2bbff] p-2 rounded-full hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                onClick={() => {
                  window.location.href = "/me/settings";
                }}
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </>
          ) : null}

          {/* Account connector */}
          <div className="relative" ref={walletMenuRef}>
            <div className="flex items-center gap-1">
              <button
                onClick={handleWalletButtonClick}
                className={`px-2 sm:px-4 py-1.5 rounded text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border cursor-pointer max-w-[8.75rem] sm:max-w-[13rem] ${
                  portfolio.connected
                    ? "bg-[#1c1b1b] border-deep-orange text-deep-orange shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:border-white hover:text-white"
                    : "bg-deep-orange border-deep-orange text-black hover:bg-white hover:border-white hover:text-black font-semibold"
                }`}
                title={portfolio.connected ? "Open portfolio" : "Sign in"}
                type="button"
              >
                <Wallet size={14} />
                <span className="truncate">{walletLabel}</span>
              </button>
              {portfolio.connected ? (
                <button
                  aria-expanded={walletMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account options"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#262626] bg-[#0a0a0a] text-[#ccc3d8] transition-colors hover:border-deep-orange hover:text-white"
                  onClick={handleWalletMenuButtonClick}
                  title="Account options"
                  type="button"
                >
                  <ChevronDown size={14} />
                </button>
              ) : null}
            </div>

            {walletMenuOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+0.6rem)] z-[70] w-72 overflow-hidden rounded border border-[#262626] bg-[#101010] shadow-2xl shadow-black/50"
                role="menu"
              >
                {portfolio.connected && portfolio.address ? (
                  <>
                    <div className="border-b border-[#262626] px-3 py-3">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                        Signed-in account
                      </p>
                      <p className="mt-1 truncate font-mono text-sm font-bold text-white">
                        {accountLabel}
                      </p>
                      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-[#262626] bg-black/35 px-3 py-2">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                          Wallet balance
                        </span>
                        <strong className="font-mono text-xs text-[#10B981]">{walletLabel}</strong>
                      </div>
                      <div className="mt-2 flex min-w-0 items-center gap-2 rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-[#ccc3d8]">
                        <Wallet size={13} className="flex-shrink-0 text-deep-orange" />
                        <span className="truncate font-mono text-[11px] font-bold text-white">
                          Address hidden in app
                        </span>
                      </div>
                    </div>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:bg-white/5 hover:text-white"
                      onClick={handleOpenPortfolio}
                      role="menuitem"
                      type="button"
                    >
                      <Briefcase size={14} />
                      Check portfolio
                    </button>
                    <button
                      className="flex w-full items-center gap-2 border-t border-[#262626] px-3 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:bg-white/5 hover:text-white"
                      onClick={() => void copyWalletAddress()}
                      role="menuitem"
                      type="button"
                    >
                      {copyState === "copied" ? (
                        <Check size={14} className="text-[#10B981]" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copyState === "copied" ? "Copied" : "Copy address"}
                    </button>
                    {walletBalances.length > 0 ? (
                      <div className="border-t border-[#262626] px-3 py-3">
                        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                          Supported chain balances
                        </p>
                        <div className="mt-2 grid gap-1.5">
                          {walletBalances.slice(0, 4).map((balance) => (
                            <div
                              key={balanceKey(balance)}
                              className="flex items-center justify-between gap-3 font-mono text-[10px]"
                            >
                              <span className="truncate text-[#ccc3d8]">{balance.chainName}</span>
                              <strong className="text-white">
                                {formatTokenAmount(balance.amount, balance.symbol)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                  </>
                ) : (
                  <>
                    <div className="border-b border-[#262626] px-3 py-3">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                        Choose sign-in method
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#ccc3d8]/80">
                        Enter with Polymarket, Google smart wallet, TON, or another wallet.
                      </p>
                    </div>
                    <button
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5"
                      onClick={() => handleSignInMode("polymarket")}
                      role="menuitem"
                      type="button"
                    >
                      <PolymarketWalletMark className="h-9 w-9" />
                      <span>
                        <strong className="block font-mono text-[10px] uppercase tracking-widest text-white">
                          Polymarket
                        </strong>
                        <small className="mt-1 block text-xs leading-relaxed text-[#ccc3d8]/75">
                          Restore a linked account with its owner wallet
                        </small>
                      </span>
                    </button>
                    <button
                      className="flex w-full items-center gap-3 border-t border-[#262626] px-3 py-3 text-left transition-colors hover:bg-white/5"
                      onClick={() => handleSignInMode("smart")}
                      role="menuitem"
                      type="button"
                    >
                      <GoogleWalletMark className="h-9 w-9" />
                      <span>
                        <strong className="block font-mono text-[10px] uppercase tracking-widest text-white">
                          Google
                        </strong>
                        <small className="mt-1 block text-xs leading-relaxed text-[#ccc3d8]/75">
                          Smart wallet
                        </small>
                        <ThirdwebMark className="mt-2" />
                      </span>
                    </button>
                    <button
                      className="flex w-full items-center gap-3 border-t border-[#262626] px-3 py-3 text-left transition-colors hover:bg-white/5"
                      onClick={() => handleSignInMode("ton")}
                      role="menuitem"
                      type="button"
                    >
                      <TonWalletMark className="h-9 w-9" />
                      <span>
                        <strong className="block font-mono text-[10px] uppercase tracking-widest text-white">
                          TON wallet
                        </strong>
                        <small className="mt-1 block text-xs leading-relaxed text-[#ccc3d8]/75">
                          Tonkeeper, Telegram Wallet, MyTonWallet, and more
                        </small>
                      </span>
                    </button>
                    <button
                      className="flex w-full items-center gap-3 border-t border-[#262626] px-3 py-3 text-left transition-colors hover:bg-white/5"
                      onClick={() => handleSignInMode("eoa")}
                      role="menuitem"
                      type="button"
                    >
                      <BrowserWalletMarks className="scale-90 origin-left" />
                      <span>
                        <strong className="block font-mono text-[10px] uppercase tracking-widest text-white">
                          EVM wallets
                        </strong>
                        <small className="mt-1 block text-xs leading-relaxed text-[#ccc3d8]/75">
                          MetaMask, Coinbase, Trust Wallet, and more
                        </small>
                      </span>
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        aria-label="Primary mobile navigation"
        className="flex w-full gap-2 overflow-x-auto border-t border-[#262626] bg-[#0e0e0e]/95 px-2 py-2 scrollbar-hide lg:hidden"
      >
        {mobileTabs.map((tab) => {
          const isTabActive = activeTab === tab.id;
          return (
            <button
              className={`min-h-10 shrink-0 rounded border px-3.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isTabActive
                  ? "border-deep-orange bg-deep-orange text-black"
                  : "border-[#262626] bg-background-base text-[#ccc3d8] hover:border-deep-orange/70 hover:text-white"
              }`}
              key={tab.id}
              onClick={() => handleNavTab(tab)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function getReadyWalletBalances(portfolio: UserPortfolio) {
  const uniqueBalances = new Map<string, PortfolioWalletBalance>();

  for (const balance of Object.values(portfolio.walletBalances)) {
    if (balance.status !== "ready") continue;
    const key = balanceKey(balance);
    if (!uniqueBalances.has(key)) uniqueBalances.set(key, balance);
  }

  return [...uniqueBalances.values()].sort((left, right) => {
    if (left.symbol !== right.symbol) return left.symbol.localeCompare(right.symbol);
    return left.chainName.localeCompare(right.chainName);
  });
}

function getWalletButtonLabel(portfolio: UserPortfolio, balances: PortfolioWalletBalance[]) {
  if (portfolio.walletBalancesStatus === "loading") return "SYNCING";

  const totals = balances.reduce<Record<string, number>>((nextTotals, balance) => {
    nextTotals[balance.symbol] = (nextTotals[balance.symbol] ?? 0) + balance.amount;
    return nextTotals;
  }, {});

  if (totals.USDC !== undefined) return formatTokenAmount(totals.USDC, "USDC");
  if (totals.WETH !== undefined) return formatTokenAmount(totals.WETH, "WETH");
  if (portfolio.usdcBalance > 0) return formatTokenAmount(portfolio.usdcBalance, "USDC");
  if (portfolio.wethBalance > 0) return formatTokenAmount(portfolio.wethBalance, "WETH");
  if (portfolio.address && !portfolio.address.startsWith("0x")) return "TON ACTIVE";

  return "0.00 USDC";
}

function formatTokenAmount(amount: number, symbol: string) {
  const decimals = symbol === "WETH" ? 4 : 2;
  const formatted = amount.toLocaleString("en", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: amount > 0 && amount < 1 ? Math.min(decimals, 4) : 2,
  });

  return formatted + " " + symbol;
}

function balanceKey(balance: PortfolioWalletBalance) {
  return [balance.chainId, balance.tokenAddress, balance.symbol].join(":").toLowerCase();
}
