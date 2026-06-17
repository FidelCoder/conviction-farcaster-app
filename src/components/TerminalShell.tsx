"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  clearStoredBrowserWalletSession,
  getSessionWalletAddress,
  getStoredBrowserWalletSession,
  setStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type { ExecutionCapabilities, UserSession } from "../lib/core-api";
import Header from "../zip-ui/components/Header";
import Sidebar from "../zip-ui/components/Sidebar";
import StatusBar from "../zip-ui/components/StatusBar";
import type { UserPortfolio } from "../zip-ui/types";

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

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
  activeRequestsCount: 0,
  activePositions: [],
};

type AlertMessage = { type: "success" | "info"; text: string } | null;

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

  const applySession = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    setPortfolio((current) =>
      nextSession
        ? {
            ...current,
            connected: true,
            address: getSessionWalletAddress(nextSession) ?? current.address,
          }
        : emptyPortfolio,
    );
  }, []);

  useEffect(() => {
    const storedSession = getStoredBrowserWalletSession();

    if (storedSession) {
      applySession(storedSession);
      onSessionChange?.(storedSession);
    }
  }, [applySession, onSessionChange]);

  useEffect(() => {
    if (sessionOverride === undefined) return;

    applySession(sessionOverride);
  }, [applySession, sessionOverride]);

  function triggerAlert(type: "success" | "info", text: string) {
    setAlertMessage({ type, text });
    window.setTimeout(() => setAlertMessage(null), 4500);
  }

  async function handleConnectWallet() {
    if (portfolio.connected) {
      applySession(null);
      clearStoredBrowserWalletSession();
      onSessionChange?.(null);
      triggerAlert("info", "Wallet session closed.");
      return;
    }

    const provider = getEthereumProvider();

    if (!provider) {
      triggerAlert("info", "No EVM browser wallet detected.");
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
      setStoredBrowserWalletSession(body.data.session);
      onSessionChange?.(body.data.session);
      triggerAlert("success", "Wallet connected and registered with core.");
    } catch {
      triggerAlert("info", "Wallet connection was cancelled or failed.");
    }
  }

  return (
    <div className="min-h-screen bg-background-base text-on-surface font-sans selection:bg-deep-orange selection:text-black">
      <Header
        activeTab={activeTab}
        onConnectWallet={handleConnectWallet}
        portfolio={portfolio}
        setActiveTab={navigateFromTab}
      />
      <Sidebar
        activeTab={activeTab}
        onOpenRequest={() => {
          window.location.href = "/#margin-desk";
        }}
        portfolio={portfolio}
        session={session}
        setActiveTab={navigateFromTab}
      />

      {children}

      <StatusBar
        contractStatus={execution.contractLayer?.status ?? "Configured"}
        executionMode={execution.marginExecutionEnabled ? "Live" : "Request"}
        marketCount={marketCount}
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
  );
}

function navigateFromTab(tab: string) {
  const hrefByTab: Record<string, string> = {
    activity: "/#activity",
    landing: "/",
    markets: "/#markets",
    "margin-desk": "/#margin-desk",
    vaults: "/#vaults",
  };

  window.location.href = hrefByTab[tab] ?? "/";
}

function getEthereumProvider() {
  if (typeof window === "undefined") return null;

  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}
