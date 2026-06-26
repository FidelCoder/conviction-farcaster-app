"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { MobileWalletLauncher } from "./MobileWalletLauncher";
import { RequiredVictionOnboarding } from "./RequiredVictionOnboarding";
import { ThirdwebWalletBridge, ThirdwebWalletProvider } from "./ThirdwebWalletBridge";
import {
  clearStoredBrowserWalletSession,
  getSessionWalletAddress,
  getStoredBrowserSessionWalletKind,
  getStoredBrowserWalletSession,
  setStoredBrowserSessionWalletKind,
  setStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type { ExecutionCapabilities, UserSession } from "../lib/core-api";
import { fetchWalletBalanceSnapshot, applyWalletBalanceSnapshot } from "../lib/client-wallet-balances";
import {
  getNoWalletDetectedMessage,
  isMobileWalletEnvironment,
  resolveEvmWalletProvider,
} from "../lib/evm-wallet-provider";
import { isThirdwebConfigured } from "../lib/thirdweb-client";
import Header from "../zip-ui/components/Header";
import Sidebar from "../zip-ui/components/Sidebar";
import StatusBar from "../zip-ui/components/StatusBar";
import type { UserPortfolio } from "../zip-ui/types";

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type TerminalShellProps = {
  activeTab: string;
  children: ReactNode;
  execution: ExecutionCapabilities;
  marketCount: number;
  onSessionChange?: (session: UserSession | null) => void;
  sessionOverride?: UserSession | null;
};

const emptyPortfolio: UserPortfolio = {
  connected: false,
  address: null,
  usdcBalance: 0,
  wethBalance: 0,
  vaultBalances: {},
  vaultLockedBalances: {},
  vaultTotalBalances: {},
  walletBalances: {},
  vaultTransactions: [],
  walletBalancesStatus: "idle",
  activeRequestsCount: 0,
  activePositions: [],
};

type AlertMessage = { type: "success" | "info"; text: string } | null;
type SignInMode = "smart" | "eoa";
type SessionWalletKind = "smart" | "eoa";

export function TerminalShell({
  activeTab,
  children,
  execution,
  marketCount,
  onSessionChange,
  sessionOverride,
}: TerminalShellProps) {
  const [portfolio, setPortfolio] = useState<UserPortfolio>(emptyPortfolio);
  const [session, setSession] = useState<UserSession | null>(null);
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);
  const [mobileWalletMessage, setMobileWalletMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessionWalletKind, setSessionWalletKind] = useState<SessionWalletKind | null>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);

  const applySession = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    setPortfolio((current) => {
      if (!nextSession) {
        return emptyPortfolio;
      }

      const nextAddress = getSessionWalletAddress(nextSession) ?? current.address;
      const isSameWallet = current.address?.toLowerCase() === nextAddress?.toLowerCase();

      return {
        ...current,
        connected: true,
        address: nextAddress,
        vaultBalances: isSameWallet ? current.vaultBalances : {},
        vaultLockedBalances: isSameWallet ? current.vaultLockedBalances : {},
        vaultTotalBalances: isSameWallet ? current.vaultTotalBalances : {},
        walletBalances: isSameWallet ? current.walletBalances : {},
        vaultTransactions: isSameWallet ? current.vaultTransactions : [],
        walletBalancesMessage: nextAddress ? "Reading wallet token balances..." : undefined,
        walletBalancesStatus: nextAddress ? "loading" : "idle",
      };
    });
  }, []);

  useEffect(() => {
    const storedSession = getStoredBrowserWalletSession();

    if (storedSession) {
      applySession(storedSession);
      setSessionWalletKind(getStoredBrowserSessionWalletKind() ?? "eoa");
      onSessionChange?.(storedSession);
    }
  }, [applySession, onSessionChange]);

  useEffect(() => {
    if (sessionOverride === undefined) return;

    applySession(sessionOverride);
  }, [applySession, sessionOverride]);

  useEffect(() => {
    if (!portfolio.connected || !portfolio.address) return;

    let isCurrent = true;
    const walletAddress = portfolio.address;

    setPortfolio((current) =>
      current.address?.toLowerCase() === walletAddress.toLowerCase()
        ? {
            ...current,
            walletBalancesMessage: "Reading wallet token balances...",
            walletBalancesStatus: "loading",
          }
        : current,
    );

    void fetchWalletBalanceSnapshot(walletAddress)
      .then((snapshot) => {
        if (!isCurrent) return;

        setPortfolio((current) => {
          if (current.address?.toLowerCase() !== walletAddress.toLowerCase()) {
            return current;
          }

          return applyWalletBalanceSnapshot(current, snapshot);
        });
      })
      .catch(() => {
        if (!isCurrent) return;

        setPortfolio((current) =>
          current.address?.toLowerCase() === walletAddress.toLowerCase()
            ? {
                ...current,
                walletBalancesMessage: "Unable to read wallet token balances.",
                walletBalancesStatus: "error",
              }
            : current,
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [portfolio.address, portfolio.connected, walletBalanceRefreshNonce]);

  function triggerAlert(type: "success" | "info", text: string) {
    setAlertMessage({ type, text });
    window.setTimeout(() => setAlertMessage(null), 4500);
  }

  function promptMobileWallet(message = getNoWalletDetectedMessage()) {
    if (isMobileWalletEnvironment()) {
      setMobileWalletMessage(message);
      return;
    }

    triggerAlert("info", message);
  }

  async function handleConnectWallet(mode?: SignInMode) {
    if (portfolio.connected) {
      triggerAlert("info", "Wallet already connected. Open the wallet menu to copy or disconnect.");
      return;
    }

    if (mode === "smart") {
      if (isThirdwebConfigured()) {
        window.dispatchEvent(new Event("conviction-thirdweb-smart-connect"));
        return;
      }

      triggerAlert("info", "Smart wallet auth is not configured yet. Use Other wallets for now.");
      return;
    }

    window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));
    const provider = await resolveEvmWalletProvider();

    if (!provider) {
      promptMobileWallet();
      return;
    }

    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];

      if (!address) {
        triggerAlert("info", "Wallet did not return an account.");
        return;
      }

      const response = await fetch("/api/browser-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const body = (await response.json()) as BrowserSessionResponse;

      if (!response.ok || !body.ok) {
        triggerAlert("info", body.ok ? "Wallet session failed." : body.error.message);
        return;
      }

      applySession(body.data.session);
      setSessionWalletKind("eoa");
      setStoredBrowserWalletSession(body.data.session);
      setStoredBrowserSessionWalletKind("eoa");
      onSessionChange?.(body.data.session);
      triggerAlert("success", "Wallet connected and registered with core.");
      setWalletBalanceRefreshNonce((current) => current + 1);
    } catch {
      triggerAlert("info", "Wallet connection was cancelled or failed.");
    }
  }

  function handleDisconnectWallet() {
    window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    onSessionChange?.(null);
    triggerAlert("info", "Wallet session closed.");
  }

  const handleSmartWalletActive = useCallback((address: string) => {
    setSessionWalletKind((current) => {
      const activeAddress = portfolio.address?.toLowerCase();

      if (activeAddress && activeAddress === address.toLowerCase()) {
        setStoredBrowserSessionWalletKind("smart");
        return "smart";
      }

      return current;
    });
  }, [portfolio.address]);

  function handleThirdwebSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("smart");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("smart");
    onSessionChange?.(nextSession);
    setWalletBalanceRefreshNonce((current) => current + 1);
  }

  function handleThirdwebDisconnectSession() {
    if (sessionWalletKind !== "smart") return;

    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    onSessionChange?.(null);
  }

  function handleProfileClaimed(nextSession: UserSession) {
    applySession(nextSession);
    setStoredBrowserWalletSession(nextSession);
    onSessionChange?.(nextSession);
    triggerAlert("success", "Your .viction identity is active.");
  }

  return (
    <ThirdwebWalletProvider>
      <div className="min-h-screen bg-background-base text-on-surface font-sans selection:bg-deep-orange selection:text-black">
        <ThirdwebWalletBridge
          activeAddress={portfolio.address}
          onDisconnectSession={handleThirdwebDisconnectSession}
          onSessionReady={handleThirdwebSessionReady}
          onSmartWalletActive={handleSmartWalletActive}
          onStatus={triggerAlert}
        />
      <RequiredVictionOnboarding
        onClaimed={handleProfileClaimed}
        session={session}
      />
      <Header
        activeTab={activeTab}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenPortfolio={() => {
          window.location.href = "/me";
        }}
        portfolio={portfolio}
        session={session}
        setActiveTab={navigateFromTab}
      />
      <Sidebar
        activeTab={activeTab}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenRequest={() => {
          window.location.href = "/margin-desk";
        }}
        portfolio={portfolio}
        session={session}
        setActiveTab={navigateFromTab}
      />

      {children}

      <StatusBar
        contractStatus="TESTNET"
        executionMode={execution.marginExecutionEnabled ? "Live" : "Request"}
        marketCount={marketCount}
      />

      <MobileWalletLauncher
        message={mobileWalletMessage ?? undefined}
        onClose={() => setMobileWalletMessage(null)}
        open={Boolean(mobileWalletMessage)}
      />

      {alertMessage ? (
        <div className="terminal-alert">
          <div
            className={
              "terminal-alert-strip " +
              (alertMessage.type === "success" ? "terminal-alert-success" : "")
            }
          />
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/70 mb-1">
              {alertMessage.type === "success" ? "Confirmed" : "Notice"}
            </p>
            <p className="text-sm text-white leading-relaxed">{alertMessage.text}</p>
          </div>
        </div>
      ) : null}
      </div>
    </ThirdwebWalletProvider>
  );
}

function navigateFromTab(tab: string) {
  const hrefByTab: Record<string, string> = {
    activity: "/activity",
    landing: "/",
    markets: "/markets",
    portfolio: "/me",
    "margin-desk": "/margin-desk",
    vaults: "/vaults",
  };

  window.location.href = hrefByTab[tab] ?? "/";
}
