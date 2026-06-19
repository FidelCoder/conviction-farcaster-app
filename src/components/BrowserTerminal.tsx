"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";

import { MobileWalletLauncher } from "./MobileWalletLauncher";
import {
  clearStoredBrowserWalletSession,
  getSessionWalletAddress,
  getStoredBrowserWalletSession,
  setStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type {
  ContractTransaction,
  ExecutionCapabilities,
  LeaderboardEntry,
  Market,
  PreparedContractTransaction,
  SocialFeedItem,
  UserSession,
} from "../lib/core-api";
import { getMarketDiscoveryProfile, getRegionLabel, getTopicLabel } from "../lib/market-discovery";
import { getMarketDisplayCase, getMarketPrice } from "../lib/market-display";
import {
  getNoWalletDetectedMessage,
  isMobileWalletEnvironment,
  resolveEvmWalletProvider,
  type EthereumProvider,
} from "../lib/evm-wallet-provider";
import { resolveVaultCollateral } from "../lib/vault-token-config";
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
  VaultDepositTransaction,
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
type DepositResult = VaultDepositTransaction | false;

type VaultPrepareResponse =
  | { ok: true; data: PreparedContractTransaction }
  | { ok: false; error: { code: string; message: string } };

type ContractTransactionResponse =
  | { ok: true; data: { transaction: ContractTransaction } }
  | { ok: false; error: { code: string; message: string } };

const TERMINAL_TABS = ["landing", "markets", "margin-desk", "vaults", "activity"] as const;
const TERMINAL_TAB_STORAGE_KEY = "conviction-active-terminal-tab";

const emptyPortfolio: UserPortfolio = {
  connected: false,
  address: null,
  usdcBalance: 0,
  wethBalance: 0,
  vaultBalances: {},
  walletBalances: {},
  vaultTransactions: [],
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
  const [activeTab, setActiveTabState] = useState("landing");
  const [portfolio, setPortfolio] = useState<UserPortfolio>(emptyPortfolio);
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeMarket, setActiveMarket] = useState<PredictionMarket>(displayMarkets[0]);
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);
  const [mobileWalletMessage, setMobileWalletMessage] = useState<string | null>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentMarket =
    displayMarkets.find((market) => market.id === activeMarket.id) ?? displayMarkets[0];

  const setActiveTab = useCallback((tab: string) => {
    if (!isTerminalTab(tab)) return;

    setActiveTabState(tab);

    if (typeof window === "undefined") return;

    window.localStorage.setItem(TERMINAL_TAB_STORAGE_KEY, tab);

    const nextUrl = tab === "landing" ? window.location.pathname : window.location.pathname + "#" + tab;
    window.history.replaceState(null, "", nextUrl);
  }, []);

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
    }
  }, [applySession]);

  useEffect(() => {
    const tabFromHash = window.location.hash.replace("#", "");
    const storedTab = window.localStorage.getItem(TERMINAL_TAB_STORAGE_KEY);
    const nextTab = isTerminalTab(tabFromHash)
      ? tabFromHash
      : isTerminalTab(storedTab)
        ? storedTab
        : "landing";

    setActiveTab(nextTab);
  }, [setActiveTab]);

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
      .then(({ depositedBalances, walletBalances }) => {
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
            vaultBalances: mergeReadyVaultBalances(current.vaultBalances, depositedBalances),
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

  function promptMobileWallet(message = getNoWalletDetectedMessage()) {
    if (isMobileWalletEnvironment()) {
      setMobileWalletMessage(message);
      return;
    }

    triggerAlert("info", message);
  }

  async function handleConnectWallet() {
    if (portfolio.connected) {
      applySession(null);
      clearStoredBrowserWalletSession();
      triggerAlert("info", "Wallet session closed.");
      return;
    }

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

      const provider = await resolveEvmWalletProvider();

      if (!provider) {
        promptMobileWallet("Margin request recorded. Open this page in a wallet browser to submit the onchain call.");
        return;
      }

      const vault = vaults.find((item) => item.id === vaultId);

      if (!vault?.chainId) {
        triggerAlert("info", "Margin request recorded, but the selected vault is missing a chain id.");
        return;
      }

      const accounts = normalizeAccounts(await provider.request({ method: "eth_requestAccounts" }));
      const walletAddress = accounts[0];

      if (!walletAddress || walletAddress.toLowerCase() !== portfolio.address.toLowerCase()) {
        triggerAlert("info", "Margin request recorded, but your wallet does not match the active Conviction session.");
        return;
      }

      await ensureWalletChain(provider, vault.chainId);
      triggerAlert("info", "Preparing onchain margin request from core.");
      const prepared = await prepareTerminalMarginIntent(body.data.position.id);
      triggerAlert("info", "Confirm the margin request in your wallet.");
      const marginHash = normalizeTransactionHash(
        await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              data: encodePreparedContractCall(prepared),
              from: walletAddress,
              to: prepared.contractCall.contractAddress,
            },
          ],
        }),
      );

      if (!marginHash) {
        triggerAlert("info", "Wallet did not return a margin transaction hash.");
        return;
      }

      await recordTerminalContractTransaction(prepared.transaction.id, {
        status: "SUBMITTED",
        transactionHash: marginHash,
      });
      triggerAlert("success", "Margin transaction submitted. Waiting for chain confirmation.");
      const receipt = await waitForTransactionReceipt(provider, marginHash);
      const confirmedStatus = receipt?.status === "0x1" ? "CONFIRMED" : receipt ? "FAILED" : "SUBMITTED";
      await recordTerminalContractTransaction(prepared.transaction.id, {
        responsePayload: receipt,
        status: confirmedStatus,
        transactionHash: marginHash,
      });

      if (confirmedStatus === "FAILED") {
        triggerAlert("info", "Margin transaction failed onchain. Prepare and submit again.");
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
            vaultName: vault.name,
            leverage,
            marginAmount: marginAmt,
            estimatedPosition: estPosition,
            liquidationPrice: liqPrice,
            timestamp: confirmedStatus === "CONFIRMED" ? "confirmed now" : "submitted now",
            chainId: vault.chainId,
            transactionHash: marginHash,
          },
        ],
      }));
      triggerAlert(
        "success",
        confirmedStatus === "CONFIRMED"
          ? "Margin request confirmed onchain. Execution can now settle through the vault rail."
          : "Margin transaction submitted. Keep this page open or check activity for confirmation.",
      );
    } catch (error) {
      triggerAlert("info", getWalletErrorMessage(error));
    }
  }

  async function handleDeposit(vaultId: string, amount: number): Promise<DepositResult> {
    if (!portfolio.connected || !portfolio.address) {
      triggerAlert("info", "Connect an EVM wallet before depositing into a vault.");
      return false;
    }

    const vault = vaults.find((item) => item.id === vaultId);

    if (!vault?.chainId || !vault.collateralTokenAddress) {
      triggerAlert("info", "Selected vault is missing chain or collateral token metadata.");
      return false;
    }

    if (!vault.tvl || vault.tvl === "Not deployed") {
      triggerAlert("info", "Selected vault is not deployed yet.");
      return false;
    }

    const provider = await resolveEvmWalletProvider();

    if (!provider) {
      promptMobileWallet();
      return false;
    }

    const vaultAddress = getVaultAddress(execution, vault);

    if (!vaultAddress) {
      triggerAlert("info", "Selected vault contract address is unavailable.");
      return false;
    }

    try {
      triggerAlert("info", "Preparing wallet approval for " + amount.toFixed(2) + " " + vault.asset + ".");
      const currentAccounts = normalizeAccounts(
        await provider.request({ method: "eth_requestAccounts" }),
      );
      const walletAddress = currentAccounts[0];

      if (!walletAddress || walletAddress.toLowerCase() !== portfolio.address.toLowerCase()) {
        triggerAlert("info", "Connected wallet does not match the active Conviction session.");
        return false;
      }

      await ensureWalletChain(provider, vault.chainId);

      const amountUnits = parseUnits(String(amount), vault.collateralTokenDecimals ?? 6);
      const currentAllowance = await readCollateralAllowance({
        owner: walletAddress,
        provider,
        spender: vaultAddress,
        tokenAddress: vault.collateralTokenAddress,
      });
      let approvalHash: string | null = null;

      if (currentAllowance < amountUnits) {
        triggerAlert("info", "Approve vault access once, then submit the deposit.");
        approvalHash = normalizeTransactionHash(
          await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "approve",
                  args: [vaultAddress as `0x${string}`, amountUnits],
                }),
                from: walletAddress,
                to: vault.collateralTokenAddress,
              },
            ],
          }),
        );

        if (!approvalHash) {
          triggerAlert("info", "Wallet did not return an approval transaction hash.");
          return false;
        }

        triggerAlert("success", "Approval submitted. Waiting for confirmation before deposit.");
        const approvalReceipt = await waitForTransactionReceipt(provider, approvalHash);

        if (approvalReceipt?.status && approvalReceipt.status !== "0x1") {
          triggerAlert("info", "Approval transaction failed onchain.");
          return false;
        }
      }

      triggerAlert("info", "Submit the vault deposit in your wallet.");
      const depositHash = normalizeTransactionHash(
        await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              data: encodeFunctionData({
                abi: parseAbi(["function deposit(address collateralToken, uint256 amount)"]),
                functionName: "deposit",
                args: [vault.collateralTokenAddress as `0x${string}`, amountUnits],
              }),
              from: walletAddress,
              to: vaultAddress,
            },
          ],
        }),
      );

      if (!depositHash) {
        triggerAlert("info", "Wallet did not return a deposit transaction hash.");
        return false;
      }

      triggerAlert("success", "Deposit submitted. Waiting for chain confirmation.");
      const depositReceipt = await waitForTransactionReceipt(provider, depositHash);

      if (depositReceipt?.status && depositReceipt.status !== "0x1") {
        triggerAlert("info", "Vault deposit failed onchain.");
        return false;
      }

      const transaction: VaultDepositTransaction = {
        id: depositHash,
        amount,
        approvalHash,
        asset: vault.asset,
        chainId: vault.chainId,
        chainName: vault.chainName,
        depositHash,
        status: "confirmed" as const,
        timestamp: new Date().toISOString(),
        vaultId,
        vaultName: vault.name,
      };

      setPortfolio((current) => ({
        ...current,
        vaultBalances: {
          ...current.vaultBalances,
          [vaultId]: (current.vaultBalances[vaultId] ?? 0) + amount,
        },
        vaultTransactions: [transaction, ...current.vaultTransactions].slice(0, 20),
      }));
      refreshWalletBalances();
      triggerAlert("success", "Vault deposit confirmed.");
      return transaction;
    } catch (error) {
      triggerAlert("info", getWalletErrorMessage(error));
      return false;
    }
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
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        portfolio={portfolio}
        setActiveTab={setActiveTab}
      />
      <Sidebar
        activeTab={activeTab}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
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
          <MarketsView
            markets={displayMarkets}
            onOpenMargin={handleOpenMargin}
            onRequireWallet={() => {
              void handleConnectWallet();
            }}
            walletConnected={portfolio.connected}
          />
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
        contractStatus="TESTNET(TESTNET_VAULTS_CONNECTED_INTENT_ONLY)"
        executionMode={execution.marginExecutionEnabled ? "Live" : "Request"}
        marketCount={markets.length}
      />

      <MobileWalletLauncher
        message={mobileWalletMessage ?? undefined}
        onClose={() => setMobileWalletMessage(null)}
        open={Boolean(mobileWalletMessage)}
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
  liquidityLabel: "Liquidity depth unavailable",
  currentOdds: 0,
  convictionIndex: "N/A",
  convictionValue: 0,
  category: "Core Sync",
  description: "Sync real markets from core before opening margin.",
  discoveryRegion: "Global",
  discoveryTopic: "World",
  source: "Conviction Core",
};


function isTerminalTab(value: string | null | undefined): value is (typeof TERMINAL_TABS)[number] {
  return typeof value === "string" && TERMINAL_TABS.includes(value as (typeof TERMINAL_TABS)[number]);
}

function mapMarketToPredictionMarket(market: Market): PredictionMarket {
  const price = getMarketPrice(market);
  const numericPrice = price ? Number(price) : Number.NaN;
  const displayCase = getMarketDisplayCase(market);
  const score = displayCase.boardFitScore;
  const discovery = getMarketDiscoveryProfile(market);
  const region = discovery.regions[0] ?? "GLOBAL";
  const primaryTag = market.providerMetadata?.primaryTag?.trim();

  return {
    id: market.id,
    title: market.title,
    status: market.status === "ACTIVE" ? "LIVE" : "HALTED",
    vol24h: formatMarketCurrency(market.volume24hr ?? market.providerMetadata?.volume24hr),
    liquidity: getMarketLiquidityValue(market),
    liquidityLabel: getMarketLiquidityLabel(market),
    currentOdds: Number.isFinite(numericPrice) ? numericPrice * 100 : 0,
    convictionIndex: score >= 80 ? "High" : score >= 55 ? "Moderate" : score > 0 ? "Low" : "N/A",
    convictionValue: Math.max(0, Math.min(score, 100)),
    category: market.category ?? primaryTag ?? "General",
    description: market.description ?? "Market description unavailable.",
    bestAsk: market.bestAsk,
    bestBid: market.bestBid,
    discoveryRegion: getRegionLabel(region),
    discoveryTopic: primaryTag || getTopicLabel(discovery.topic),
    externalUrl: market.externalUrl,
    lastTradePrice: market.lastTradePrice,
    noTokenId: market.noTokenId,
    orderMinSize: market.orderMinSize,
    resolutionDate: market.resolutionDate,
    source: market.source,
    syncedAt: market.syncedAt,
    yesTokenId: market.yesTokenId,
  };
}

function getMarketLiquidityValue(market: Market) {
  const liquidity = market.liquidity ?? market.providerMetadata?.liquidity;

  if (liquidity) {
    return formatMarketCurrency(liquidity);
  }

  if (market.orderMinSize) {
    return market.orderMinSize + " min order";
  }

  return "Pending";
}

function getMarketLiquidityLabel(market: Market) {
  if (market.liquidity ?? market.providerMetadata?.liquidity) {
    return "Liquidity depth from the synced provider event snapshot.";
  }

  if (market.orderMinSize) {
    return "Minimum order size from the synced market feed.";
  }

  return "Liquidity depth is not included in the current core snapshot.";
}

function formatMarketCurrency(value: string | number | null | undefined) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "--";
  }

  if (numericValue >= 1_000_000) return "$" + (numericValue / 1_000_000).toFixed(1) + "M";
  if (numericValue >= 1_000) return "$" + (numericValue / 1_000).toFixed(1) + "K";

  return "$" + numericValue.toFixed(0);
}

function mapExecutionToVaults(execution: ExecutionCapabilities): Vault[] {
  const chains = execution.chains.filter((chain) => chain.walletFlowEnabled || chain.vaultAddress);

  return chains.map((chain, index) => {
    const collateral = resolveVaultCollateral({
      chainId: chain.chainId,
      chainName: chain.chainName,
      tokenAddress: chain.collateralTokenAddress,
      tokenDecimals: chain.collateralTokenDecimals,
      tokenSymbol: chain.collateralTokenSymbol,
    });
    const collateralSymbol = collateral.tokenSymbol ?? chain.collateralTokenSymbol ?? "USDC";

    return {
      id: "chain-" + chain.chainId,
      name: chain.chainName + " " + collateralSymbol + " Vault",
      riskTag: chain.network === "mainnet" ? "Low Risk" : "High Risk",
      apy: 0,
      apyType: chain.marginExecutionEnabled ? "Variable Yield" : "Base Yield",
      tvl: chain.vaultAddress ? "Configured" : "Not deployed",
      utilization: 0,
      healthRatio: 0,
      maxLeverage: execution.maxPendingMarginLeverage ?? 10,
      asset: collateralSymbol === "WETH" ? "WETH" : "USDC",
      accentColor: index % 2 === 0 ? "orange" : "purple",
      userDeposited: 0,
      chainId: chain.chainId,
      chainName: collateral.chainName,
      collateralTokenAddress: collateral.tokenAddress,
      collateralTokenDecimals: collateral.tokenDecimals,
    };
  });
}

function mapMarketsToTape(markets: Market[]): MarketTapeItem[] {
  return markets.slice(0, 18).map((market) => {
    const price = getMarketPrice(market);
    const numericPrice = price ? Number(price) : Number.NaN;

    return {
      id: market.id,
      market: getTapeMarketLabel(market),
      price: Number.isFinite(numericPrice) ? numericPrice : 0,
      size: market.orderMinSize ?? "--",
      isPositive: Number.isFinite(numericPrice) ? numericPrice >= 0.5 : true,
    };
  });
}

function getTapeMarketLabel(market: Market) {
  const cleanTitle = market.title
    .replace(/^will\s+/i, "")
    .replace(/\?$/, "")
    .trim();
  const label = cleanTitle || market.category || "Market";

  return label.length > 24 ? label.slice(0, 23).trimEnd() + "..." : label;
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

function mergeReadyVaultBalances(
  currentBalances: Record<string, number>,
  depositedBalances: Record<string, { amount: number; status: string }>,
) {
  return Object.entries(depositedBalances).reduce(
    (balances, [vaultId, balance]) => {
      if (balance.status === "ready") {
        balances[vaultId] = balance.amount;
      }

      return balances;
    },
    { ...currentBalances },
  );
}


async function prepareTerminalMarginIntent(positionId: string) {
  const response = await fetch("/api/contracts/margin-intents/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxSlippageBps: 100, positionId }),
  });
  const body = (await response.json()) as VaultPrepareResponse;

  if (!response.ok || !body.ok) {
    throw new Error(body.ok ? "Margin request was not prepared." : body.error.message);
  }

  return body.data;
}

async function recordTerminalContractTransaction(
  transactionId: string,
  input: {
    responsePayload?: unknown;
    status?: ContractTransaction["status"];
    transactionHash?: string;
  },
) {
  const response = await fetch("/api/contracts/transactions/" + transactionId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as ContractTransactionResponse;

  if (!response.ok || !body.ok) {
    throw new Error(body.ok ? "Transaction status was not recorded." : body.error.message);
  }

  return body.data.transaction;
}

function encodePreparedContractCall(prepared: PreparedContractTransaction) {
  const args = prepared.contractCall.namedArgs;
  const abi = parseAbi(prepared.contractCall.abi);

  if (prepared.contractCall.functionName === "createMarginIntent") {
    return encodeFunctionData({
      abi,
      functionName: "createMarginIntent",
      args: [
        args.collateralToken as `0x${string}`,
        args.marketId as `0x${string}`,
        Number(args.side),
        BigInt(String(args.collateralAmount)),
        BigInt(String(args.leverageBps)),
        BigInt(String(args.maxSlippageBps)),
        BigInt(String(args.deadline)),
        args.offchainPositionId as `0x${string}`,
      ],
    });
  }

  throw new Error("Unsupported prepared contract call.");
}

function getVaultAddress(execution: ExecutionCapabilities, vault: Vault) {
  if (!vault.chainId) return null;

  return execution.chains.find((chain) => chain.chainId === vault.chainId)?.vaultAddress ?? null;
}


async function readCollateralAllowance(input: {
  owner: string;
  provider: EthereumProvider;
  spender: string;
  tokenAddress: string;
}) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [input.owner as `0x${string}`, input.spender as `0x${string}`],
  });
  const rawAllowance = await input.provider.request({
    method: "eth_call",
    params: [{ data, to: input.tokenAddress }, "latest"],
  });

  if (typeof rawAllowance !== "string") return BigInt(0);

  try {
    return BigInt(rawAllowance);
  } catch {
    return BigInt(0);
  }
}

async function ensureWalletChain(provider: EthereumProvider, chainId: number) {
  const currentChain = normalizeChainId(await provider.request({ method: "eth_chainId" }));

  if (currentChain === chainId) {
    return;
  }

  const chainConfig = getWalletChainConfig(chainId);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + chainId.toString(16) }],
    });
  } catch (error) {
    if (!isUnknownChainError(error) || !chainConfig) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [chainConfig],
    });
  }
}

function getWalletChainConfig(chainId: number) {
  const configs: Record<
    number,
    {
      blockExplorerUrls: string[];
      chainId: string;
      chainName: string;
      nativeCurrency: { decimals: number; name: string; symbol: string };
      rpcUrls: string[];
    }
  > = {
    84532: {
      blockExplorerUrls: ["https://sepolia.basescan.org"],
      chainId: "0x14a34",
      chainName: "Base Sepolia",
      nativeCurrency: { decimals: 18, name: "Sepolia Ether", symbol: "ETH" },
      rpcUrls: ["https://sepolia.base.org"],
    },
    11155111: {
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
      chainId: "0xaa36a7",
      chainName: "Ethereum Sepolia",
      nativeCurrency: { decimals: 18, name: "Sepolia Ether", symbol: "ETH" },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    },
    421614: {
      blockExplorerUrls: ["https://sepolia.arbiscan.io"],
      chainId: "0x66eee",
      chainName: "Arbitrum Sepolia",
      nativeCurrency: { decimals: 18, name: "Arbitrum Sepolia Ether", symbol: "ETH" },
      rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
  };

  return configs[chainId] ?? null;
}

function isUnknownChainError(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 4902;
}

async function waitForTransactionReceipt(provider: EthereumProvider, transactionHash: string) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });

    if (isTransactionReceipt(receipt)) {
      return receipt;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2500));
  }

  return null;
}

function isTransactionReceipt(value: unknown): value is { status?: string } {
  return typeof value === "object" && value !== null && "transactionHash" in value;
}

function normalizeAccounts(value: unknown) {
  return Array.isArray(value)
    ? value.filter((account): account is string => typeof account === "string")
    : [];
}

function normalizeChainId(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  return value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
}

function normalizeTransactionHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
}

function getWalletErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");

    if (message) {
      return message;
    }
  }

  return "Wallet transaction was not submitted.";
}
