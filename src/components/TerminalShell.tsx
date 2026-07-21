"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { MobileWalletLauncher } from "./MobileWalletLauncher";
import { RequiredVictionOnboarding } from "./RequiredVictionOnboarding";
import { ThirdwebWalletBridge, ThirdwebWalletProvider } from "./ThirdwebWalletBridge";
import { TonWalletBridge } from "./TonWalletBridge";
import {
  clearStoredBrowserWalletSession,
  getSessionWalletAddress,
  getStoredBrowserSessionWalletKind,
  getStoredBrowserWalletSession,
  setStoredBrowserSessionWalletKind,
  setStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type { ExecutionCapabilities, UserSession } from "../lib/core-api";
import {
  fetchWalletBalanceSnapshot,
  applyWalletBalanceSnapshot,
} from "../lib/client-wallet-balances";
import {
  getNoWalletDetectedMessage,
  isMobileWalletEnvironment,
  resolveEvmWalletProvider,
} from "../lib/evm-wallet-provider";
import { isThirdwebConfigured } from "../lib/thirdweb-client";
import { trackProductEvent, useProductAnalytics } from "../lib/product-analytics";
import Header from "../zip-ui/components/Header";
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
  vaultMetrics: {},
  vaultTotalBalances: {},
  walletBalances: {},
  vaultTransactions: [],
  walletBalancesStatus: "idle",
  activeRequestsCount: 0,
  activePositions: [],
};

type AlertMessage = { type: "success" | "info"; text: string } | null;
type SignInMode = "smart" | "eoa" | "ton";
type SessionWalletKind = "smart" | "eoa" | "ton";
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

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
  const [sessionWalletKind, setSessionWalletKind] = useState<SessionWalletKind | null>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);
  useProductAnalytics({ area: activeTab, session });

  const applySession = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    setPortfolio((current) => {
      if (!nextSession) {
        return emptyPortfolio;
      }

      const nextAddress = getSessionWalletAddress(nextSession) ?? current.address;
      const isSameWallet = current.address?.toLowerCase() === nextAddress?.toLowerCase();
      const canReadTokenBalances = Boolean(nextAddress && evmAddressPattern.test(nextAddress));

      return {
        ...current,
        connected: true,
        address: nextAddress,
        vaultBalances: isSameWallet ? current.vaultBalances : {},
        vaultLockedBalances: isSameWallet ? current.vaultLockedBalances : {},
        vaultTotalBalances: isSameWallet ? current.vaultTotalBalances : {},
        walletBalances: isSameWallet ? current.walletBalances : {},
        vaultTransactions: isSameWallet ? current.vaultTransactions : [],
        walletBalancesMessage: canReadTokenBalances
          ? "Reading wallet token balances..."
          : undefined,
        walletBalancesStatus: canReadTokenBalances ? "loading" : "idle",
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
    if (!portfolio.connected || !portfolio.address || !evmAddressPattern.test(portfolio.address))
      return;

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
        window.dispatchEvent(new Event("conviction-ton-disconnect"));
        window.dispatchEvent(new Event("conviction-thirdweb-smart-connect"));
        return;
      }

      triggerAlert(
        "info",
        "Smart wallet auth is not configured yet. Use EVM wallet sign-in or TON wallet.",
      );
      return;
    }

    if (mode === "ton") {
      window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));
      window.dispatchEvent(new Event("conviction-ton-connect"));
      return;
    }

    window.dispatchEvent(new Event("conviction-ton-disconnect"));
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
        body: JSON.stringify({
          walletAddress: address,
          authProvider: "EVM_EOA",
          source: "WEB_APP",
        }),
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
      void trackProductEvent({
        area: activeTab,
        label: "eoa",
        session: body.data.session,
        type: "AUTH_CONNECT",
      });
      triggerAlert("success", "EVM wallet signed in and registered with core.");
      setWalletBalanceRefreshNonce((current) => current + 1);
    } catch {
      triggerAlert("info", "Wallet connection was cancelled or failed.");
    }
  }

  function handleDisconnectWallet() {
    window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));
    window.dispatchEvent(new Event("conviction-ton-disconnect"));
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    onSessionChange?.(null);
    void trackProductEvent({
      area: activeTab,
      label: sessionWalletKind ?? "wallet",
      session,
      type: "AUTH_DISCONNECT",
    });
    triggerAlert("info", "Wallet session closed.");
  }

  const handleSmartWalletActive = useCallback(
    (address: string) => {
      setSessionWalletKind((current) => {
        const activeAddress = portfolio.address?.toLowerCase();

        if (activeAddress && activeAddress === address.toLowerCase()) {
          setStoredBrowserSessionWalletKind("smart");
          return "smart";
        }

        return current;
      });
    },
    [portfolio.address],
  );

  function handleThirdwebSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("smart");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("smart");
    onSessionChange?.(nextSession);
    void trackProductEvent({
      area: activeTab,
      label: "smart",
      session: nextSession,
      type: "AUTH_CONNECT",
    });
    setWalletBalanceRefreshNonce((current) => current + 1);
  }

  function handleThirdwebDisconnectSession() {
    if (sessionWalletKind !== "smart") return;

    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    onSessionChange?.(null);
  }

  function handleTonSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("ton");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("ton");
    onSessionChange?.(nextSession);
    void trackProductEvent({
      area: activeTab,
      label: "ton",
      session: nextSession,
      type: "AUTH_CONNECT",
    });
  }

  const handleTonWalletActive = useCallback(
    (address: string) => {
      setSessionWalletKind((current) => {
        const activeAddress = portfolio.address;

        if (activeAddress && activeAddress === address) {
          setStoredBrowserSessionWalletKind("ton");
          return "ton";
        }

        return current;
      });
    },
    [portfolio.address],
  );

  function handleTonDisconnectSession() {
    if (sessionWalletKind !== "ton") return;

    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    onSessionChange?.(null);
  }

  function handleProfileClaimed(nextSession: UserSession) {
    applySession(nextSession);
    setStoredBrowserWalletSession(nextSession);
    onSessionChange?.(nextSession);
    void trackProductEvent({
      area: activeTab,
      label: nextSession.traderProfile?.handle ?? "profile",
      session: nextSession,
      type: "PROFILE_CLAIM",
    });
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
        <TonWalletBridge
          activeAddress={portfolio.address}
          onDisconnectSession={handleTonDisconnectSession}
          onSessionReady={handleTonSessionReady}
          onStatus={triggerAlert}
          onTonWalletActive={handleTonWalletActive}
        />
        <RequiredVictionOnboarding onClaimed={handleProfileClaimed} session={session} />
        <Header
          activeTab={activeTab}
          onConnectWallet={handleConnectWallet}
          onDisconnectWallet={handleDisconnectWallet}
          onOpenPortfolio={() => {
            window.location.href = "/me";
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
