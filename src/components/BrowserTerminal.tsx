"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clearStoredBrowserWalletSession,
  getSessionWalletAddress,
  getStoredBrowserWalletSession,
  setStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type {
  ExecutionCapabilities,
  LeaderboardEntry,
  Market,
  SocialFeedItem,
  UserSession,
} from "../lib/core-api";
import { getMarketDisplayCase, getMarketPrice } from "../lib/market-display";
import { readVaultWalletBalances } from "../lib/wallet-balances";
import ActivityView from "../zip-ui/components/ActivityView";
import Header from "../zip-ui/components/Header";
import LandingView from "../zip-ui/components/LandingView";
import MarginDeskView from "../zip-ui/components/MarginDeskView";
import MarketsView from "../zip-ui/components/MarketsView";
import Sidebar from "../zip-ui/components/Sidebar";
import StatusBar from "../zip-ui/components/StatusBar";
import VaultsView from "../zip-ui/components/VaultsView";
import type {
  ActivityItem,
  GlobalRiskParameter,
  LeaderboardItem,
  MarketTapeItem,
  PredictionMarket,
  UserPortfolio,
  Vault,
} from "../zip-ui/types";

type BrowserTerminalProps = {
  execution: ExecutionCapabilities;
  leaderboard: LeaderboardEntry[];
  markets: Market[];
  socialFeed: SocialFeedItem[];
};

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type MarginIntentResponse =
  | {
      ok: true;
      data: {
        position: { id: string; status: string; marketId: string; side: "YES" | "NO" };
        executionAttempt?: { status: string; failureMessage?: string | null };
      };
    }
  | { ok: false; error: { code: string; message: string } };

type AlertMessage = { type: "success" | "info"; text: string } | null;

const emptyPortfolio: UserPortfolio = {
  connected: false,
  address: null,
  usdcBalance: 0,
  wethBalance: 0,
  vaultBalances: {},
  walletBalances: {},
  walletBalancesStatus: "idle",
  activeRequestsCount: 0,
  activePositions: [],
};

export function BrowserTerminal({
  execution,
  leaderboard,
  markets,
  socialFeed,
}: BrowserTerminalProps) {
  const predictionMarkets = useMemo(() => markets.map(mapMarketToPredictionMarket), [markets]);
  const displayMarkets = predictionMarkets.length > 0 ? predictionMarkets : [emptyPredictionMarket];
  const vaults = useMemo(() => mapExecutionToVaults(execution), [execution]);
  const riskParameters = useMemo(() => mapExecutionToRiskParameters(execution), [execution]);
  const tape = useMemo(() => mapMarketsToTape(markets), [markets]);
  const socialActivity = useMemo(() => mapSocialFeedToActivity(socialFeed), [socialFeed]);
  const leaderboardItems = useMemo(() => mapLeaderboard(leaderboard), [leaderboard]);
  const [activeTab, setActiveTab] = useState("landing");
  const [portfolio, setPortfolio] = useState<UserPortfolio>(emptyPortfolio);
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeMarket, setActiveMarket] = useState<PredictionMarket>(displayMarkets[0]);
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);

  const currentMarket =
    displayMarkets.find((market) => market.id === activeMarket.id) ?? displayMarkets[0];

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
        walletBalances: isSameWallet ? current.walletBalances : {},
        walletBalancesMessage: nextAddress ? "Reading wallet token balances..." : undefined,
        walletBalancesStatus: nextAddress ? "loading" : "idle",
      };
    });
  }, []);

  useEffect(() => {
    const storedSession = getStoredBrowserWalletSession();

    if (storedSession) {
      applySession(storedSession);
    }
  }, [applySession]);

  useEffect(() => {
    const tabFromHash = window.location.hash.replace("#", "");

    if (["markets", "margin-desk", "vaults", "activity"].includes(tabFromHash)) {
      setActiveTab(tabFromHash);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

    void readVaultWalletBalances({ address: walletAddress, execution, vaults })
      .then((walletBalances) => {
        if (!isCurrent) return;

        const primaryUsdcBalance = Object.values(walletBalances).find(
          (balance) => balance.status === "ready" && balance.symbol === "USDC",
        );
        const primaryWethBalance = Object.values(walletBalances).find(
          (balance) => balance.status === "ready" && balance.symbol === "WETH",
        );

        setPortfolio((current) => {
          if (current.address?.toLowerCase() !== walletAddress.toLowerCase()) {
            return current;
          }

          return {
            ...current,
            usdcBalance: primaryUsdcBalance?.amount ?? current.usdcBalance,
            wethBalance: primaryWethBalance?.amount ?? current.wethBalance,
            walletBalances,
            walletBalancesMessage: "Wallet token balances updated.",
            walletBalancesStatus: "ready",
          };
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
  }, [execution, portfolio.address, portfolio.connected, vaults, walletBalanceRefreshNonce]);

  const refreshWalletBalances = useCallback(() => {
    setWalletBalanceRefreshNonce((current) => current + 1);
  }, []);

  function triggerAlert(type: "success" | "info", text: string) {
    setAlertMessage({ type, text });
    window.setTimeout(() => setAlertMessage(null), 4500);
  }

  async function handleConnectWallet() {
    if (portfolio.connected) {
      applySession(null);
      clearStoredBrowserWalletSession();
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
      triggerAlert("success", "Wallet connected and registered with core.");
    } catch {
      triggerAlert("info", "Wallet connection was cancelled or failed.");
    }
  }

  function handleOpenMargin(market: PredictionMarket) {
    setActiveMarket(market);
    setActiveTab("margin-desk");
  }

  async function handleRequestMargin(
    vaultId: string,
    marginAmt: number,
    leverage: number,
    estPosition: number,
    liqPrice: number,
    outcomeType: "YES" | "NO" = "YES",
  ) {
    if (!portfolio.connected || !portfolio.address || !session) {
      triggerAlert("info", "Connect an EVM wallet before requesting margin.");
      return;
    }

    const chainId = Number(vaultId.replace("chain-", ""));

    if (!Number.isFinite(chainId)) {
      triggerAlert("info", "Selected vault is missing a supported chain id.");
      return;
    }

    try {
      const response = await fetch("/api/margin-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          marketId: activeMarket.id,
          side: outcomeType,
          quantity: String(marginAmt * leverage),
          marginCollateral: String(marginAmt),
          leverageMultiplier: String(leverage),
          chainId,
          walletAddress: portfolio.address,
        }),
      });
      const body = (await response.json()) as MarginIntentResponse;

      if (!response.ok || !body.ok) {
        triggerAlert("info", body.ok ? "Margin request failed." : body.error.message);
        return;
      }

      setPortfolio((current) => ({
        ...current,
        activeRequestsCount: current.activeRequestsCount + 1,
        activePositions: [
          ...current.activePositions,
          {
            id: body.data.position.id,
            marketTitle: "[" + outcomeType + "] " + activeMarket.title,
            vaultName: vaults.find((vault) => vault.id === vaultId)?.name ?? "Vault",
            leverage,
            marginAmount: marginAmt,
            estimatedPosition: estPosition,
            liquidationPrice: liqPrice,
            timestamp: "recorded now",
          },
        ],
      }));
      triggerAlert(
        "success",
        "Core recorded the margin intent. Execution remains pending until wallet contract calls are submitted.",
      );
    } catch {
      triggerAlert("info", "Core API did not accept the margin request.");
    }
  }

  function handleDeposit() {
    triggerAlert(
      "info",
      "Vault deposits need a dedicated signer flow before they can be submitted from this deck.",
    );
  }

  function handleWithdraw() {
    triggerAlert("info", "Vault withdrawals are not enabled in core yet.");
  }

  function handleCreateVault() {
    triggerAlert(
      "info",
      "Custom vault deployment requires governance and contract deployment support first.",
    );
  }

  function handleModifyRisk() {
    triggerAlert("info", "Risk voting is display-only until governance contracts are connected.");
  }

  function handlePostActivity() {
    triggerAlert(
      "info",
      "Standalone social broadcasts need a core API route before posting is enabled.",
    );
  }

  function handleLikeActivity() {
    triggerAlert(
      "info",
      "Connect a core social session from a signal page to react to real posts.",
    );
  }

  return (
    <div className="min-h-screen bg-background-base text-on-surface font-sans selection:bg-deep-orange selection:text-black">
      <Header
        activeTab={activeTab}
        onConnectWallet={handleConnectWallet}
        portfolio={portfolio}
        setActiveTab={setActiveTab}
      />
      <Sidebar
        activeTab={activeTab}
        onOpenRequest={() => setActiveTab("margin-desk")}
        portfolio={portfolio}
        session={session}
        setActiveTab={setActiveTab}
      />

      <div className="pt-16">
        {activeTab === "landing" ? (
          <LandingView
            activeMarket={currentMarket}
            marketCount={markets.length}
            maxLeverage={getMaxLeverage(vaults)}
            onExploreVaults={() => setActiveTab("vaults")}
            onLaunchTerminal={() => setActiveTab("markets")}
            socialCount={socialFeed.length}
            walletConnected={portfolio.connected}
          />
        ) : null}

        {activeTab === "markets" ? (
          <MarketsView markets={displayMarkets} onOpenMargin={handleOpenMargin} />
        ) : null}

        {activeTab === "margin-desk" ? (
          <MarginDeskView
            activeMarket={currentMarket}
            markets={displayMarkets}
            onRequestMargin={handleRequestMargin}
            portfolio={portfolio}
            setActiveMarket={setActiveMarket}
            tape={tape}
            vaults={vaults}
          />
        ) : null}

        {activeTab === "vaults" ? (
          <VaultsView
            onCreateVault={handleCreateVault}
            onDeposit={handleDeposit}
            onModifyRisk={handleModifyRisk}
            onRefreshWalletBalances={refreshWalletBalances}
            onWithdraw={handleWithdraw}
            portfolio={portfolio}
            riskParameters={riskParameters}
            vaults={vaults}
          />
        ) : null}

        {activeTab === "activity" ? (
          <ActivityView
            activity={socialActivity}
            leaderboard={leaderboardItems}
            onLikeActivity={handleLikeActivity}
            onPostActivity={handlePostActivity}
            portfolio={portfolio}
          />
        ) : null}
      </div>

      <StatusBar
        contractStatus={execution.contractLayer?.status ?? "Configured"}
        executionMode={execution.marginExecutionEnabled ? "Live" : "Request"}
        marketCount={markets.length}
      />

      {alertMessage ? (
        <div className="fixed top-20 right-6 z-[60] max-w-sm bg-[#161616] border border-[#262626] rounded-lg shadow-2xl overflow-hidden animate-scale-up">
          <div
            className={
              "h-1 " + (alertMessage.type === "success" ? "bg-[#10B981]" : "bg-deep-orange")
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

const emptyPredictionMarket: PredictionMarket = {
  id: "empty-market-state",
  title: "No synced markets yet",
  status: "HALTED",
  vol24h: "--",
  liquidity: "--",
  currentOdds: 0,
  convictionIndex: "N/A",
  convictionValue: 0,
  category: "Core Sync",
  description: "Sync real provider markets from core before opening margin.",
};

function mapMarketToPredictionMarket(market: Market): PredictionMarket {
  const price = getMarketPrice(market);
  const numericPrice = price ? Number(price) : Number.NaN;
  const displayCase = getMarketDisplayCase(market);
  const score = displayCase.boardFitScore;

  return {
    id: market.id,
    title: market.title,
    status: market.status === "ACTIVE" ? "LIVE" : "HALTED",
    vol24h: "--",
    liquidity: market.orderMinSize ? market.orderMinSize + " min" : "--",
    currentOdds: Number.isFinite(numericPrice) ? numericPrice * 100 : 0,
    convictionIndex: score >= 80 ? "High" : score >= 55 ? "Moderate" : score > 0 ? "Low" : "N/A",
    convictionValue: Math.max(0, Math.min(score, 100)),
    category: market.category ?? market.source,
    description: market.description ?? "Provider description unavailable.",
  };
}

function mapExecutionToVaults(execution: ExecutionCapabilities): Vault[] {
  const chains = execution.chains.filter((chain) => chain.walletFlowEnabled || chain.vaultAddress);

  return chains.map((chain, index) => ({
    id: "chain-" + chain.chainId,
    name: chain.chainName + " " + (chain.collateralTokenSymbol ?? "Collateral") + " Vault",
    riskTag: chain.network === "mainnet" ? "Low Risk" : "High Risk",
    apy: 0,
    apyType: chain.marginExecutionEnabled ? "Variable Yield" : "Base Yield",
    tvl: chain.vaultAddress ? "Configured" : "Not deployed",
    utilization: 0,
    healthRatio: 0,
    maxLeverage: execution.maxPendingMarginLeverage ?? 10,
    asset: chain.collateralTokenSymbol === "WETH" ? "WETH" : "USDC",
    accentColor: index % 2 === 0 ? "orange" : "purple",
    userDeposited: 0,
    chainId: chain.chainId,
    chainName: chain.chainName,
    collateralTokenAddress: chain.collateralTokenAddress,
    collateralTokenDecimals: chain.collateralTokenDecimals,
  }));
}

function mapMarketsToTape(markets: Market[]): MarketTapeItem[] {
  return markets.slice(0, 18).map((market) => {
    const price = getMarketPrice(market);
    const numericPrice = price ? Number(price) : Number.NaN;

    return {
      market: (market.category ?? market.title).slice(0, 18).toUpperCase(),
      price: Number.isFinite(numericPrice) ? numericPrice : 0,
      size: market.orderMinSize ?? "--",
      isPositive: Number.isFinite(numericPrice) ? numericPrice >= 0.5 : true,
    };
  });
}

function mapSocialFeedToActivity(feed: SocialFeedItem[]): ActivityItem[] {
  return feed.map((item) => ({
    id: item.signal.id,
    username: item.author.username ?? item.author.handle ?? item.author.displayName ?? "trader",
    name: item.author.displayName ?? item.author.username ?? "Conviction trader",
    time: formatRelativeTime(item.signal.createdAt),
    text: item.signal.thesis + "\n\n" + (item.market?.title ?? "Market unavailable"),
    type: "request",
    likes: item.counts.reactions,
    commentsCount: item.counts.replies,
    repeats: item.counts.bookmarks,
    likedByUser: item.viewer?.reacted ?? false,
  }));
}

function mapLeaderboard(leaderboard: LeaderboardEntry[]): LeaderboardItem[] {
  return leaderboard.map((entry) => ({
    rank: entry.rank,
    name: entry.handle,
    pnl: Number(entry.realizedPnl ?? 0),
    letter: entry.handle.slice(0, 1).toUpperCase(),
  }));
}

function mapExecutionToRiskParameters(execution: ExecutionCapabilities): GlobalRiskParameter[] {
  return [
    {
      parameter: "Margin Intent Recording",
      currentValue: execution.marginIntentsEnabled ? "Enabled" : "Disabled",
      proposed: "-",
      status: execution.marginIntentsEnabled ? "Active" : "Pending Vote",
    },
    {
      parameter: "Maximum Pending Leverage",
      currentValue: (execution.maxPendingMarginLeverage ?? 1) + "x",
      proposed: "-",
      status: "Active",
    },
    {
      parameter: "Vault Contract Layer",
      currentValue: execution.contractLayer?.status ?? "Configured",
      proposed: "-",
      status: execution.contractLayer?.vaultAddress ? "Active" : "Pending Vote",
    },
    {
      parameter: "Execution Adapters",
      currentValue: execution.marginExecutionEnabled ? "Live" : "Pending",
      proposed: "Adapter rollout",
      status: execution.marginExecutionEnabled ? "Active" : "Pending Vote",
    },
  ];
}

function getMaxLeverage(vaults: Vault[]) {
  return vaults.reduce((max, vault) => Math.max(max, vault.maxLeverage), 1);
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "recently";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return minutes + "m ago";
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return hours + "h ago";
  }

  return Math.floor(hours / 24) + "d ago";
}

function getEthereumProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    (
      window as Window & {
        ethereum?: { request: (input: { method: string; params?: unknown[] }) => Promise<unknown> };
      }
    ).ethereum ?? null
  );
}
