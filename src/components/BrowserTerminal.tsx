"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";

import {
  BrowserWalletMarks,
  GoogleWalletMark,
  ThirdwebMark,
  TonWalletMark,
} from "./AuthWalletMarks";
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
import type {
  ContractTransaction,
  ExecutionCapabilities,
  LeaderboardEntry,
  Market,
  PreparedContractTransaction,
  SocialFeedItem,
  SocialTimelineEvent,
  UserSession,
} from "../lib/core-api";
import { getMarketDiscoveryProfile, getRegionLabel, getTopicLabel } from "../lib/market-discovery";
import { getMarketDisplayCase, getMarketPrice } from "../lib/market-display";
import { trackProductEvent, useProductAnalytics } from "../lib/product-analytics";
import {
  getNoWalletDetectedMessage,
  isMobileWalletEnvironment,
  resolveEvmWalletProvider,
  type EthereumProvider,
} from "../lib/evm-wallet-provider";
import {
  fetchWalletBalanceSnapshot,
  applyWalletBalanceSnapshot,
} from "../lib/client-wallet-balances";
import { mapExecutionToVaults } from "../lib/execution-vaults";
import { isThirdwebConfigured } from "../lib/thirdweb-client";
import {
  PolymarketWalletUnavailableError,
  signInWithPolymarketWallet,
} from "../lib/polymarket-browser-auth";
import { sendPolymarketWalletCall } from "../lib/polymarket-execution-wallet";
import ActivityView from "../zip-ui/components/ActivityView";
import Header from "../zip-ui/components/Header";
import LandingView from "../zip-ui/components/LandingView";
import MarginDeskView from "../zip-ui/components/MarginDeskView";
import MarketsView from "../zip-ui/components/MarketsView";
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

export type TerminalTab = "landing" | "markets" | "margin-desk" | "vaults" | "activity";

type BrowserTerminalProps = {
  execution: ExecutionCapabilities;
  initialMarketId?: string;
  initialTab?: TerminalTab;
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

type ExecutionSettlementResponse =
  | {
      ok: true;
      data: {
        executionAttempt: ExecutionSettlementAttempt;
      };
    }
  | { ok: false; error: { code: string; message: string } };

type ExecutionSettlementAttempt = {
  status: string;
  failureMessage?: string | null;
  chainTransactionHash?: string | null;
};

type AlertMessage = { type: "success" | "info"; text: string } | null;
type DepositResult = VaultDepositTransaction | false;
type SignInMode = "smart" | "eoa" | "ton" | "polymarket";
type SessionWalletKind = "smart" | "eoa" | "ton" | "polymarket";

type SmartVaultTransactionResult = {
  approvalHash: string | null;
  depositHash: string;
  requestId: string;
};

type SmartVaultTransactionFailure = { message: string; requestId: string };

type VaultPrepareResponse =
  | { ok: true; data: PreparedContractTransaction }
  | { ok: false; error: { code: string; message: string } };

type ContractTransactionResponse =
  | { ok: true; data: { transaction: ContractTransaction } }
  | { ok: false; error: { code: string; message: string } };

type ActivitySignalResponse =
  | { ok: true; data: { signal: { id: string; createdAt: string } } }
  | { ok: false; error: { code: string; message: string } };

type ActivityPostResponse =
  | { ok: true; data: { post: { id: string; createdAt: string } } }
  | { ok: false; error: { code: string; message: string } };

const TERMINAL_TABS: TerminalTab[] = ["landing", "markets", "margin-desk", "vaults", "activity"];
const TERMINAL_TAB_PATHS: Record<TerminalTab, string> = {
  activity: "/activity",
  landing: "/",
  markets: "/markets",
  "margin-desk": "/margin-desk",
  vaults: "/vaults",
};
const TERMINAL_PATH_TABS: Record<string, TerminalTab> = {
  "/": "landing",
  "/activity": "activity",
  "/markets": "markets",
  "/margin": "margin-desk",
  "/margin-desk": "margin-desk",
  "/vaults": "vaults",
};
const TERMINAL_TAB_STORAGE_KEY = "conviction-active-terminal-tab";
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const emptyPortfolio: UserPortfolio = {
  connected: false,
  address: null,
  usdcBalance: 0,
  wethBalance: 0,
  vaultBalances: {},
  vaultLockedBalances: {},
  vaultTotalBalances: {},
  walletBalances: {},
  vaultMetrics: {},
  vaultTransactions: [],
  walletBalancesStatus: "idle",
  activeRequestsCount: 0,
  activePositions: [],
};

export function BrowserTerminal({
  execution,
  initialMarketId,
  initialTab = "landing",
  leaderboard,
  markets,
  socialFeed,
}: BrowserTerminalProps) {
  const predictionMarkets = useMemo(() => markets.map(mapMarketToPredictionMarket), [markets]);
  const displayMarkets = useMemo(
    () => (predictionMarkets.length > 0 ? predictionMarkets : [emptyPredictionMarket]),
    [predictionMarkets],
  );
  const vaults = useMemo(() => mapExecutionToVaults(execution), [execution]);
  const riskParameters = useMemo(() => mapExecutionToRiskParameters(execution), [execution]);
  const tape = useMemo(() => mapMarketsToTape(markets), [markets]);
  const [timelineEvents, setTimelineEvents] = useState<SocialTimelineEvent[]>([]);
  const socialActivity = useMemo(
    () => mapTimelineEventsToActivity(timelineEvents, socialFeed),
    [socialFeed, timelineEvents],
  );
  const leaderboardItems = useMemo(() => mapLeaderboard(leaderboard), [leaderboard]);
  const [activeTab, setActiveTabState] = useState<TerminalTab>(initialTab);
  const [portfolio, setPortfolio] = useState<UserPortfolio>(emptyPortfolio);
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionWalletKind, setSessionWalletKind] = useState<SessionWalletKind | null>(null);
  const [activeMarket, setActiveMarket] = useState<PredictionMarket>(
    () => displayMarkets.find((market) => market.id === initialMarketId) ?? displayMarkets[0],
  );
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);
  const [mobileWalletMessage, setMobileWalletMessage] = useState<string | null>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);
  const [isSignInChoiceOpen, setIsSignInChoiceOpen] = useState(false);
  useProductAnalytics({ area: activeTab, session });
  const isLandingTab = activeTab === "landing";

  const currentMarket =
    displayMarkets.find((market) => market.id === activeMarket.id) ?? displayMarkets[0];

  useEffect(() => {
    if (!initialMarketId) return;
    const nextMarket = displayMarkets.find((market) => market.id === initialMarketId);
    if (nextMarket) setActiveMarket(nextMarket);
  }, [displayMarkets, initialMarketId]);

  const setActiveTab = useCallback((tab: string) => {
    if (!isTerminalTab(tab)) {
      const route = getNonTerminalRoute(tab);
      if (route && typeof window !== "undefined") {
        window.location.href = route;
      }
      return;
    }

    setActiveTabState(tab);

    if (typeof window === "undefined") return;

    window.localStorage.setItem(TERMINAL_TAB_STORAGE_KEY, tab);

    const nextUrl = TERMINAL_TAB_PATHS[tab];
    if (window.location.pathname !== nextUrl || window.location.hash) {
      window.history.pushState(null, "", nextUrl);
    }
  }, []);

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
        vaultMetrics: isSameWallet ? current.vaultMetrics : {},
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
    }
  }, [applySession]);

  useEffect(() => {
    function resolveTabFromLocation() {
      const tabFromHash = window.location.hash.replace("#", "");

      if (isTerminalTab(tabFromHash)) {
        window.history.replaceState(null, "", TERMINAL_TAB_PATHS[tabFromHash]);
        return tabFromHash;
      }

      return getTerminalTabFromPath(window.location.pathname) ?? initialTab;
    }

    function syncActiveTabFromUrl() {
      const nextTab = resolveTabFromLocation();
      setActiveTabState(nextTab);
      window.localStorage.setItem(TERMINAL_TAB_STORAGE_KEY, nextTab);
    }

    syncActiveTabFromUrl();
    window.addEventListener("popstate", syncActiveTabFromUrl);

    return () => window.removeEventListener("popstate", syncActiveTabFromUrl);
  }, [initialTab]);

  useEffect(() => {
    let isCurrent = true;
    const params = new URLSearchParams({ limit: "80", scope: session ? "all" : "all" });
    if (session?.user.id) params.set("userId", session.user.id);

    fetch("/api/social/timeline?" + params.toString())
      .then((response) => response.json())
      .then((body: unknown) => {
        if (!isCurrent) return;
        const events = parseTimelineEvents(body);
        setTimelineEvents(events);
      })
      .catch(() => {
        if (isCurrent) setTimelineEvents([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [session]);

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

  async function handleConnectWallet(mode?: SignInMode) {
    if (!mode) {
      setIsSignInChoiceOpen(true);
      return;
    }
    if (portfolio.connected) {
      triggerAlert(
        "info",
        "You are already signed in. Open the account menu to copy or disconnect.",
      );
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

    if (mode === "polymarket") {
      window.dispatchEvent(new Event("conviction-ton-disconnect"));
      window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));

      try {
        const authentication = await signInWithPolymarketWallet();

        applySession(authentication.session);
        setSessionWalletKind("polymarket");
        setStoredBrowserWalletSession(authentication.session);
        setStoredBrowserSessionWalletKind("polymarket");
        void trackProductEvent({
          area: activeTab,
          label: "polymarket",
          session: authentication.session,
          type: "AUTH_CONNECT",
        });
        refreshWalletBalances();
        triggerAlert("success", "Signed in with your Polymarket owner wallet.");
      } catch (error) {
        if (error instanceof PolymarketWalletUnavailableError) {
          promptMobileWallet(
            "Open Conviction Markets inside the wallet that controls your Polymarket account, then try again.",
          );
          return;
        }

        triggerAlert(
          "info",
          error instanceof Error ? error.message : "Polymarket sign-in was cancelled or failed.",
        );
      }

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
      void trackProductEvent({
        area: activeTab,
        label: "eoa",
        session: body.data.session,
        type: "AUTH_CONNECT",
      });
      triggerAlert("success", "EVM wallet signed in and registered with core.");
    } catch {
      triggerAlert("info", "Wallet connection was cancelled or failed.");
    }
  }

  function handleOpenSignInMenu() {
    if (portfolio.connected) return;
    setIsSignInChoiceOpen(true);
  }

  function handleDisconnectWallet() {
    window.dispatchEvent(new Event("conviction-thirdweb-disconnect"));
    window.dispatchEvent(new Event("conviction-ton-disconnect"));
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    void trackProductEvent({
      area: activeTab,
      label: sessionWalletKind ?? "wallet",
      session,
      type: "AUTH_DISCONNECT",
    });
    triggerAlert("info", "Session closed.");
  }

  function handleThirdwebSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("smart");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("smart");
    void trackProductEvent({
      area: activeTab,
      label: "smart",
      session: nextSession,
      type: "AUTH_CONNECT",
    });
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

  function handleThirdwebDisconnectSession() {
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
  }

  function handleTonSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("ton");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("ton");
    void trackProductEvent({
      area: activeTab,
      label: "ton",
      session: nextSession,
      type: "AUTH_CONNECT",
    });
    triggerAlert("success", "TON wallet signed in and registered with core.");
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
  }

  function handleProfileClaimed(nextSession: UserSession) {
    applySession(nextSession);
    setStoredBrowserWalletSession(nextSession);
    void trackProductEvent({
      area: activeTab,
      label: nextSession.traderProfile?.handle ?? "profile",
      session: nextSession,
      type: "PROFILE_CLAIM",
    });
    triggerAlert("success", "Your .viction identity is active.");
  }

  function handleOpenMargin(market: PredictionMarket) {
    setActiveMarket(market);
    void trackProductEvent({
      area: "markets",
      label: market.title,
      metadata: { marketId: market.id },
      session,
      type: "MARKET_OPEN_MARGIN",
    });
    setActiveTab("margin-desk");
  }

  async function handleRequestMargin(
    vaultId: string,
    marginAmt: number,
    leverage: number,
    estPosition: number,
    liqPrice: number,
    outcomeType: "YES" | "NO" = "YES",
    visibility: "PUBLIC" | "PRIVATE" = "PRIVATE",
  ) {
    if (!portfolio.connected || !portfolio.address || !session) {
      triggerAlert("info", "Sign in with an EVM account before requesting margin.");
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
          visibility,
        }),
      });
      const body = (await response.json()) as MarginIntentResponse;

      if (!response.ok || !body.ok) {
        triggerAlert("info", body.ok ? "Margin request failed." : body.error.message);
        return;
      }

      void trackProductEvent({
        area: "margin-desk",
        label: outcomeType,
        metadata: { chainId, leverage, marketId: activeMarket.id, visibility },
        session,
        type: "MARGIN_REQUEST",
        value: marginAmt,
      });

      const provider = await resolveEvmWalletProvider();

      if (!provider) {
        promptMobileWallet(
          "Margin request recorded. Open this page in a wallet browser to submit the onchain call.",
        );
        return;
      }

      const vault = vaults.find((item) => item.id === vaultId);

      if (!vault?.chainId) {
        triggerAlert(
          "info",
          "Margin request recorded, but the selected vault is missing a chain id.",
        );
        return;
      }

      const accounts = normalizeAccounts(await provider.request({ method: "eth_requestAccounts" }));
      const walletAddress = accounts[0];

      if (!walletAddress || walletAddress.toLowerCase() !== portfolio.address.toLowerCase()) {
        triggerAlert(
          "info",
          "Margin request recorded, but your wallet does not match the active Conviction session.",
        );
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
      const confirmedStatus =
        receipt?.status === "0x1" ? "CONFIRMED" : receipt ? "FAILED" : "SUBMITTED";
      await recordTerminalContractTransaction(prepared.transaction.id, {
        responsePayload: receipt,
        status: confirmedStatus,
        transactionHash: marginHash,
      });

      if (confirmedStatus === "FAILED") {
        triggerAlert("info", "Margin transaction failed onchain. Prepare and submit again.");
        return;
      }

      let settlementAttempt: ExecutionSettlementAttempt | null = null;

      if (confirmedStatus === "CONFIRMED") {
        settlementAttempt = await settleTerminalExecution(body.data.position.id);
      }

      setPortfolio((current) => ({
        ...current,
        activeRequestsCount: current.activeRequestsCount + 1,
        activePositions: [
          ...current.activePositions,
          {
            id: body.data.position.id,
            marketTitle:
              "[" +
              outcomeType +
              "] " +
              activeMarket.title +
              (visibility === "PUBLIC" ? " (public)" : ""),
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
        settlementAttempt?.status === "CONFIRMED" ? "success" : "info",
        getMarginSettlementMessage(confirmedStatus, settlementAttempt),
      );
    } catch (error) {
      triggerAlert("info", getWalletErrorMessage(error));
    }
  }

  async function handleDeposit(vaultId: string, amount: number): Promise<DepositResult> {
    if (!portfolio.connected || !portfolio.address) {
      triggerAlert("info", "Sign in with an EVM account before depositing into a vault.");
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

    const vaultAddress = getVaultAddress(execution, vault);

    if (!vaultAddress) {
      triggerAlert("info", "Selected vault contract address is unavailable.");
      return false;
    }

    try {
      const amountUnits = parseUnits(String(amount), vault.collateralTokenDecimals ?? 6);

      if (sessionWalletKind === "smart") {
        triggerAlert(
          "info",
          "Preparing smart wallet deposit for " + amount.toFixed(2) + " " + vault.asset + ".",
        );
        const smartResult = await submitSmartWalletDeposit({
          amountUnits: amountUnits.toString(),
          chainId: vault.chainId,
          collateralTokenAddress: vault.collateralTokenAddress,
          vaultAddress,
        });

        if (!smartResult) return false;

        const transaction = buildVaultDepositTransaction({
          amount,
          approvalHash: smartResult.approvalHash,
          depositHash: smartResult.depositHash,
          vault,
          vaultId,
        });

        recordVaultDepositTransaction(transaction, vaultId, amount);
        void trackProductEvent({
          area: "vaults",
          label: vault.name,
          metadata: { chainId: vault.chainId, vaultId },
          session,
          type: "VAULT_DEPOSIT",
          value: amount,
        });
        refreshWalletBalances();
        triggerAlert("success", "Vault deposit confirmed.");
        return transaction;
      }

      const provider = await resolveEvmWalletProvider();

      if (!provider) {
        promptMobileWallet();
        return false;
      }

      triggerAlert(
        "info",
        "Preparing wallet approval for " + amount.toFixed(2) + " " + vault.asset + ".",
      );
      const currentAccounts = normalizeAccounts(
        await provider.request({ method: "eth_requestAccounts" }),
      );
      const walletAddress = currentAccounts[0];

      if (!walletAddress || walletAddress.toLowerCase() !== portfolio.address.toLowerCase()) {
        triggerAlert(
          "info",
          "Connected EOA wallet does not match the active Conviction session. Disconnect and sign in with that EOA, or use Smart wallet sign-in.",
        );
        return false;
      }

      await ensureWalletChain(provider, vault.chainId);
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
              data:
                vault.chainId === 137
                  ? encodeFunctionData({
                      abi: parseAbi([
                        "function deposit(uint256 assets,address receiver) returns (uint256)",
                      ]),
                      functionName: "deposit",
                      args: [amountUnits, walletAddress as `0x${string}`],
                    })
                  : encodeFunctionData({
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

      const transaction = buildVaultDepositTransaction({
        amount,
        approvalHash,
        depositHash,
        vault,
        vaultId,
      });

      recordVaultDepositTransaction(transaction, vaultId, amount);
      void trackProductEvent({
        area: "vaults",
        label: vault.name,
        metadata: { chainId: vault.chainId, vaultId },
        session,
        type: "VAULT_DEPOSIT",
        value: amount,
      });
      refreshWalletBalances();
      triggerAlert("success", "Vault deposit confirmed.");
      return transaction;
    } catch (error) {
      triggerAlert("info", getWalletErrorMessage(error));
      return false;
    }
  }

  function submitSmartWalletDeposit(input: {
    amountUnits: string;
    chainId: number;
    collateralTokenAddress: string;
    vaultAddress: string;
  }) {
    const requestId = "smart-deposit-" + Date.now() + "-" + Math.random().toString(16).slice(2);

    return new Promise<SmartVaultTransactionResult | null>((resolve) => {
      const cleanup = () => {
        window.removeEventListener(
          "conviction-thirdweb-smart-deposit-result",
          handleResult as EventListener,
        );
        window.removeEventListener(
          "conviction-thirdweb-smart-deposit-error",
          handleError as EventListener,
        );
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        triggerAlert("info", "Smart wallet deposit timed out before confirmation.");
        resolve(null);
      }, 180000);

      const handleResult = (event: CustomEvent<SmartVaultTransactionResult>) => {
        if (event.detail.requestId !== requestId) return;
        window.clearTimeout(timeout);
        cleanup();
        resolve(event.detail);
      };

      const handleError = (event: CustomEvent<SmartVaultTransactionFailure>) => {
        if (event.detail.requestId !== requestId) return;
        window.clearTimeout(timeout);
        cleanup();
        triggerAlert("info", event.detail.message);
        resolve(null);
      };

      window.addEventListener(
        "conviction-thirdweb-smart-deposit-result",
        handleResult as EventListener,
      );
      window.addEventListener(
        "conviction-thirdweb-smart-deposit-error",
        handleError as EventListener,
      );
      window.dispatchEvent(
        new CustomEvent("conviction-thirdweb-smart-deposit", {
          detail: { ...input, requestId },
        }),
      );
    });
  }

  function buildVaultDepositTransaction(input: {
    amount: number;
    approvalHash: string | null;
    depositHash: string;
    vault: Vault;
    vaultId: string;
  }): VaultDepositTransaction {
    return {
      id: input.depositHash,
      amount: input.amount,
      approvalHash: input.approvalHash,
      asset: input.vault.asset,
      chainId: input.vault.chainId,
      chainName: input.vault.chainName,
      depositHash: input.depositHash,
      status: "confirmed" as const,
      timestamp: new Date().toISOString(),
      vaultId: input.vaultId,
      vaultName: input.vault.name,
    };
  }

  function recordVaultDepositTransaction(
    transaction: VaultDepositTransaction,
    vaultId: string,
    amount: number,
  ) {
    setPortfolio((current) => ({
      ...current,
      vaultBalances: {
        ...current.vaultBalances,
        [vaultId]: (current.vaultBalances[vaultId] ?? 0) + amount,
      },
      vaultTotalBalances: {
        ...current.vaultTotalBalances,
        [vaultId]:
          (current.vaultTotalBalances[vaultId] ?? current.vaultBalances[vaultId] ?? 0) + amount,
      },
      vaultTransactions: [transaction, ...current.vaultTransactions].slice(0, 20),
    }));
  }

  async function handleWithdraw(vaultId: string, amount: number) {
    const vault = vaults.find((item) => item.id === vaultId);
    if (!session || !portfolio.address || !vault?.chainId) {
      triggerAlert("info", "Sign in before withdrawing vault liquidity.");
      return false;
    }
    if (vault.chainId !== 137) {
      triggerAlert("info", "Legacy testnet vault withdrawals are not enabled.");
      return false;
    }
    try {
      const response = await fetch("/api/vault-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: portfolio.address, amount: normalizeAssetAmount(amount) }),
      });
      const body = (await response.json()) as
        | {
            ok: true;
            data: {
              mode: "IMMEDIATE" | "QUEUED";
              call: { chainId: number; to: string; value: string; data: string };
            };
          }
        | { ok: false; error: { message: string } };
      if (!response.ok || !body.ok)
        throw new Error(body.ok ? "Withdrawal preparation failed." : body.error.message);
      triggerAlert(
        "info",
        body.data.mode === "QUEUED"
          ? "Confirm the redemption queue request."
          : "Confirm the vault withdrawal.",
      );
      const hash = await sendPolymarketWalletCall(portfolio.address, body.data.call);
      if (!hash) throw new Error("Wallet did not submit the withdrawal transaction.");
      const transaction: VaultDepositTransaction = {
        id: hash,
        amount,
        asset: vault.asset,
        chainId: 137,
        chainName: "Polygon",
        depositHash: hash,
        status: "confirmed",
        timestamp: new Date().toISOString(),
        vaultId,
        vaultName: vault.name,
        type: body.data.mode === "QUEUED" ? "REDEMPTION_REQUEST" : "WITHDRAWAL",
      };
      setPortfolio((current) => ({
        ...current,
        vaultTransactions: [transaction, ...current.vaultTransactions].slice(0, 20),
      }));
      refreshWalletBalances();
      triggerAlert(
        "success",
        body.data.mode === "QUEUED"
          ? "Redemption entered the onchain withdrawal queue."
          : "Vault withdrawal confirmed.",
      );
      return true;
    } catch (error) {
      triggerAlert("info", getWalletErrorMessage(error));
      return false;
    }
  }

  function normalizeAssetAmount(amount: number) {
    return amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }

  async function handleCreateActivityPost(input: {
    body: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
  }) {
    if (!portfolio.connected) {
      void handleConnectWallet();
      return null;
    }

    if (!session) {
      triggerAlert("info", "Wallet session is still loading. Try again in a moment.");
      return null;
    }

    try {
      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorUserId: session.user.id,
          body: input.body,
          mediaUrl: input.mediaUrl ?? null,
          mediaType: input.mediaType ?? null,
        }),
      });
      const body = (await response.json()) as ActivityPostResponse;

      if (!response.ok || !body.ok) {
        triggerAlert("info", body.ok ? "Pulse post failed." : body.error.message);
        return null;
      }

      void trackProductEvent({
        area: "activity",
        label: input.mediaType ?? "text",
        session,
        type: "PULSE_POST",
      });
      triggerAlert("success", "Pulse post published.");
      return body.data.post;
    } catch {
      triggerAlert("info", "Pulse post could not reach core.");
      return null;
    }
  }

  function requireActivityWallet() {
    if (portfolio.connected) {
      triggerAlert(
        "info",
        "Wallet session is active. Wait a moment for the profile session to finish loading.",
      );
      return;
    }

    void handleConnectWallet();
  }

  async function handleCreateActivitySignal(input: {
    marketId: string;
    side: "YES" | "NO";
    thesis: string;
  }) {
    if (!portfolio.connected) {
      void handleConnectWallet();
      return null;
    }

    if (!session) {
      triggerAlert("info", "Wallet session is still loading. Try again in a moment.");
      return null;
    }

    const traderProfile = session.traderProfile;

    if (!traderProfile) {
      triggerAlert("info", "Finish your .viction profile before publishing a market signal.");
      return null;
    }

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traderProfileId: traderProfile.id,
          marketId: input.marketId,
          side: input.side,
          thesis: input.thesis,
          convictionLevel: 70,
          source: "WEB",
        }),
      });
      const body = (await response.json()) as ActivitySignalResponse;

      if (!response.ok || !body.ok) {
        triggerAlert("info", body.ok ? "Signal creation failed." : body.error.message);
        return null;
      }

      void trackProductEvent({
        area: "activity",
        label: input.side,
        metadata: { marketId: input.marketId },
        session,
        type: "PULSE_SIGNAL",
      });
      triggerAlert("success", "Signal published to Market Pulse.");
      return { id: body.data.signal.id, createdAt: body.data.signal.createdAt };
    } catch {
      triggerAlert("info", "Core API did not accept the signal.");
      return null;
    }
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
        <SignInChoiceDialog
          onClose={() => setIsSignInChoiceOpen(false)}
          onSelect={(mode) => {
            setIsSignInChoiceOpen(false);
            void handleConnectWallet(mode);
          }}
          open={isSignInChoiceOpen && !portfolio.connected}
        />
        <Header
          activeTab={activeTab}
          onConnectWallet={handleConnectWallet}
          onDisconnectWallet={handleDisconnectWallet}
          onOpenPortfolio={() => {
            window.location.href = "/me";
          }}
          onOpenSignInMenu={handleOpenSignInMenu}
          portfolio={portfolio}
          session={session}
          setActiveTab={setActiveTab}
        />
        <div className="pt-24 lg:pt-16">
          {activeTab === "landing" ? (
            <LandingView
              activeMarket={currentMarket}
              marketCount={markets.length}
              maxLeverage={getMaxLeverage(vaults)}
              onExploreVaults={() => setActiveTab("vaults")}
              onLaunchTerminal={() => setActiveTab("markets")}
              onOpenPulse={() => setActiveTab("activity")}
              socialCount={socialFeed.length}
              socialPreview={getLandingSocialPreview(socialFeed)}
              vaultCount={vaults.length}
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
              execution={execution}
              markets={displayMarkets}
              onRequestMargin={handleRequestMargin}
              onStatus={triggerAlert}
              portfolio={portfolio}
              session={session}
              setActiveMarket={setActiveMarket}
              tape={tape}
              vaults={vaults}
            />
          ) : null}

          {activeTab === "vaults" ? (
            <VaultsView
              onDeposit={handleDeposit}
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
              markets={displayMarkets}
              onCreateSignal={handleCreateActivitySignal}
              onCreatePost={handleCreateActivityPost}
              onOpenMarket={handleOpenMargin}
              onRequireWallet={requireActivityWallet}
              portfolio={portfolio}
              session={session}
              onTimelineRefresh={() => refreshSocialTimeline(setTimelineEvents, session?.user.id)}
            />
          ) : null}
        </div>

        {isLandingTab ? null : (
          <StatusBar
            contractStatus="TESTNET"
            executionMode={execution.marginExecutionEnabled ? "Live" : "Request"}
            marketCount={markets.length}
          />
        )}

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
    </ThirdwebWalletProvider>
  );
}

function SignInChoiceDialog({
  onClose,
  onSelect,
  open,
}: {
  onClose: () => void;
  onSelect: (mode: SignInMode) => void;
  open: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="viction-onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-choice-title"
    >
      <div className="viction-onboarding-card sign-in-choice-card">
        <div className="viction-onboarding-heading">
          <span>Sign in</span>
          <h2 id="sign-in-choice-title">Choose how to enter</h2>
          <p>Enter with Google smart wallet, TON, or another self-custody wallet.</p>
        </div>
        <div className="sign-in-choice-grid">
          <button
            className="sign-in-choice-option sign-in-choice-option-primary"
            onClick={() => onSelect("smart")}
            type="button"
          >
            <GoogleWalletMark className="sign-in-choice-mark" />
            <span>Google</span>
            <strong>Smart wallet</strong>
            <ThirdwebMark />
          </button>
          <button className="sign-in-choice-option" onClick={() => onSelect("ton")} type="button">
            <TonWalletMark className="sign-in-choice-mark" />
            <span>TON</span>
            <strong>TON wallet</strong>
            <small>Tonkeeper, Telegram Wallet, MyTonWallet, and other TON Connect wallets.</small>
          </button>
          <button className="sign-in-choice-option" onClick={() => onSelect("eoa")} type="button">
            <BrowserWalletMarks className="sign-in-choice-marks" />
            <span>EVM wallets</span>
            <strong>Self-custody wallet</strong>
            <small>
              MetaMask, Coinbase, Trust Wallet, Rabby, Phantom, OKX, and other EOA wallets.
            </small>
          </button>
        </div>
        <div className="viction-onboarding-actions">
          <button onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
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
  imageUrl: null,
  source: "Conviction Core",
};

function isTerminalTab(value: string | null | undefined): value is TerminalTab {
  return typeof value === "string" && TERMINAL_TABS.includes(value as TerminalTab);
}

function getTerminalTabFromPath(pathname: string) {
  return TERMINAL_PATH_TABS[pathname.replace(/\/$/, "") || "/"];
}

function getNonTerminalRoute(tab: string) {
  const routes: Record<string, string> = {
    docs: "/docs",
    leaderboard: "/leaderboard",
    notifications: "/me/notifications",
    portfolio: "/me",
    profile: "/me/profile",
    settings: "/me/settings",
    support: "/support",
  };

  return routes[tab] ?? null;
}

function getLandingSocialPreview(feed: SocialFeedItem[]) {
  const item = feed.find((entry) => entry.signal.status === "PUBLISHED") ?? feed[0];

  if (!item) return null;

  const handle = item.trader?.handle ?? item.author.handle;

  return {
    author: handle
      ? "@" + (handle.endsWith(".viction") ? handle : handle + ".viction")
      : "@conviction",
    convictionLevel: item.signal.convictionLevel,
    marketTitle: item.market?.title ?? "Market discussion",
    side: item.signal.side,
    thesis: item.signal.thesis,
    time: formatRelativeTime(item.signal.createdAt),
  };
}

function mapMarketToPredictionMarket(market: Market): PredictionMarket {
  const price = getMarketPrice(market);
  const numericPrice = price ? Number(price) : Number.NaN;
  const displayCase = getMarketDisplayCase(market);
  const score = displayCase.boardFitScore;
  const discovery = getMarketDiscoveryProfile(market);
  const region = discovery.regions[0] ?? "GLOBAL";
  const primaryTag = market.providerMetadata?.primaryTag?.trim();
  const metadataTopic = market.providerMetadata?.discoveryTopics?.find(
    (topic) => topic.trim().length > 0,
  );

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
    discoveryRegion: market.providerMetadata?.discoveryRegion || getRegionLabel(region),
    discoveryTopic: primaryTag || metadataTopic || getTopicLabel(discovery.topic),
    externalUrl: market.externalUrl,
    imageUrl: market.providerMetadata?.imageUrl ?? market.providerMetadata?.iconUrl ?? null,
    lastTradePrice: market.lastTradePrice,
    liquidityValue: parseMarketMetric(market.liquidity ?? market.providerMetadata?.liquidity),
    oneDayPriceChange: parseMarketMetric(market.providerMetadata?.oneDayPriceChange),
    totalVolumeValue: parseMarketMetric(market.providerMetadata?.totalVolume),
    volume24hValue: parseMarketMetric(market.volume24hr ?? market.providerMetadata?.volume24hr),
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

function parseMarketMetric(value: string | number | null | undefined) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
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

function mapTimelineEventsToActivity(
  events: SocialTimelineEvent[],
  fallbackFeed: SocialFeedItem[],
): ActivityItem[] {
  if (events.length === 0) {
    return mapSocialFeedToActivity(fallbackFeed);
  }

  return events
    .filter((event) => event.type !== "FOLLOW")
    .map((event) => {
      if (event.type === "REPOST" && event.signal) {
        const signalItem = mapSocialFeedItemToActivity(event.signal);
        return {
          ...signalItem,
          id: event.id,
          eventType: "REPOST",
          kind: "repost",
          actorUserId: event.actor.userId,
          traderProfileId: event.signal.trader?.id,
          username: getActorUsername(event.actor),
          name: getActorDisplayName(event.actor),
          time: formatRelativeTime(event.createdAt),
          text: getActorDisplayName(event.actor) + " reposted this market take.",
          topic: "Repost",
          signalSide: event.signal.signal.side,
          convictionLevel: event.signal.signal.convictionLevel,
        };
      }

      if (event.type === "PUBLIC_TRADE" && event.position) {
        return {
          id: event.id,
          actorUserId: event.actor.userId,
          traderProfileId:
            event.position.trader.traderProfileId ?? event.actor.traderProfileId ?? undefined,
          username: getActorUsername(event.actor),
          name: getActorDisplayName(event.actor),
          avatarUrl: event.position.trader.avatarUrl ?? event.actor.avatarUrl ?? undefined,
          time: formatRelativeTime(event.createdAt),
          text: buildPublicTradeText(event),
          type: "request",
          kind: "trade",
          eventType: "PUBLIC_TRADE",
          likes: 0,
          commentsCount: event.position.replies.length,
          repeats: 0,
          marketId: event.position.market?.id,
          marketPrice: formatSocialMarketPrice(event.position.market),
          marketTitle: event.position.market?.title ?? "Market unavailable",
          replies: event.position.replies.map((reply) => ({
            id: reply.id,
            author: getReplyDisplayName(reply.author),
            text: reply.body,
            time: formatRelativeTime(reply.createdAt),
          })),
          topic: "Public trade",
          position: {
            id: event.position.id,
            side: event.position.side,
            quantity: event.position.quantity,
            executionMode: event.position.executionMode,
            leverageMultiplier: event.position.leverageMultiplier,
            marginCollateral: event.position.marginCollateral,
            status: event.position.status,
          },
        };
      }

      if (event.signal) {
        return {
          ...mapSocialFeedItemToActivity(event.signal),
          eventType: "SIGNAL",
        };
      }

      if (event.type === "POST" && event.post) {
        return {
          id: event.post.id,
          postId: event.post.id,
          actorUserId: event.actor.userId,
          traderProfileId:
            event.post.author.traderProfileId ?? event.actor.traderProfileId ?? undefined,
          username: getActorUsername(event.actor),
          name: getActorDisplayName(event.actor),
          avatarUrl:
            event.post.author.avatarUrl ??
            event.actor.avatarUrl ??
            event.post.author.profileUrl ??
            event.actor.profileUrl ??
            undefined,
          time: formatRelativeTime(event.createdAt),
          text: event.post.body,
          type: "request",
          kind: "post",
          eventType: "POST",
          likes: event.post.counts.reactions,
          commentsCount: event.post.counts.replies,
          repeats: event.post.counts.bookmarks,
          likedByUser: event.post.viewer?.reacted ?? false,
          repostedByUser: event.post.viewer?.bookmarked ?? false,
          replies: (event.post.recentReplies ?? []).map((reply) => ({
            id: reply.id,
            author: getReplyDisplayName(reply.author),
            text: reply.body,
            time: formatRelativeTime(reply.createdAt),
          })),
          topic: "Pulse",
        };
      }

      return {
        id: event.id,
        actorUserId: event.actor.userId,
        username: getActorUsername(event.actor),
        name: getActorDisplayName(event.actor),
        time: formatRelativeTime(event.createdAt),
        text: "New market activity.",
        type: "request",
        kind: "post",
        likes: 0,
        commentsCount: 0,
        repeats: 0,
        replies: [],
        topic: "Pulse",
      };
    });
}

function mapSocialFeedToActivity(feed: SocialFeedItem[]): ActivityItem[] {
  return feed.map(mapSocialFeedItemToActivity);
}

function mapSocialFeedItemToActivity(item: SocialFeedItem): ActivityItem {
  return {
    id: item.signal.id,
    signalId: item.signal.id,
    actorUserId: item.author.userId,
    traderProfileId: item.trader?.id ?? item.author.traderProfileId ?? undefined,
    username: getSocialUsername(item),
    name: getSocialDisplayName(item),
    avatarUrl:
      item.trader?.avatarUrl ?? item.author.avatarUrl ?? item.author.profileUrl ?? undefined,
    time: formatRelativeTime(item.signal.createdAt),
    text: item.signal.thesis,
    type: "request",
    kind: "signal",
    likes: item.counts.reactions,
    commentsCount: item.counts.replies,
    repeats: item.counts.bookmarks,
    likedByUser: item.viewer?.reacted ?? false,
    marketId: item.market?.id,
    marketPrice: formatSocialMarketPrice(item.market),
    marketTitle: item.market?.title ?? "Market unavailable",
    replies: item.recentReplies.map((reply) => ({
      id: reply.id,
      author: getReplyDisplayName(reply.author),
      text: reply.body,
      time: formatRelativeTime(reply.createdAt),
    })),
    repostedByUser: item.viewer?.bookmarked ?? false,
    topic: item.market?.providerMetadata?.primaryTag ?? item.market?.category ?? "Signal",
    signalSide: item.signal.side,
    convictionLevel: item.signal.convictionLevel,
  };
}

function parseTimelineEvents(body: unknown): SocialTimelineEvent[] {
  if (!body || typeof body !== "object" || !("ok" in body)) return [];
  const response = body as { ok?: boolean; data?: { events?: unknown } };
  return response.ok && Array.isArray(response.data?.events)
    ? (response.data.events as SocialTimelineEvent[])
    : [];
}

async function refreshSocialTimeline(
  setter: (events: SocialTimelineEvent[]) => void,
  userId?: string,
) {
  const params = new URLSearchParams({ limit: "80", scope: "all" });
  if (userId) params.set("userId", userId);

  try {
    const response = await fetch("/api/social/timeline?" + params.toString());
    const body = (await response.json()) as unknown;
    setter(parseTimelineEvents(body));
  } catch {
    // Keep current feed if refresh fails.
  }
}

function buildPublicTradeText(event: SocialTimelineEvent) {
  const position = event.position;
  if (!position) return "Placed a public trade.";

  const leverage = position.leverageMultiplier ? " at " + position.leverageMultiplier + "x" : "";
  const collateral = position.marginCollateral
    ? " with " + position.marginCollateral + " collateral"
    : "";
  return (
    getActorDisplayName(event.actor) +
    " placed a public " +
    position.side +
    " trade" +
    leverage +
    collateral +
    "."
  );
}

function getActorUsername(actor: {
  handle?: string | null;
  username?: string | null;
  displayName?: string | null;
  userId: string;
}) {
  return normalizeVictionIdentity(
    actor.handle ?? actor.username ?? actor.displayName,
    actor.userId,
  );
}

function getActorDisplayName(actor: {
  handle?: string | null;
  username?: string | null;
  displayName?: string | null;
  userId: string;
}) {
  return normalizeVictionIdentity(
    actor.handle ?? actor.displayName ?? actor.username,
    actor.userId,
  );
}

function getReplyDisplayName(actor: {
  handle?: string | null;
  username?: string | null;
  displayName?: string | null;
  userId: string;
}) {
  return normalizeVictionIdentity(
    actor.handle ?? actor.username ?? actor.displayName,
    actor.userId,
  );
}

function getSocialUsername(item: SocialFeedItem) {
  return normalizeVictionIdentity(
    item.trader?.handle ?? item.author.handle ?? item.author.username ?? item.author.displayName,
    item.author.userId,
  );
}

function getSocialDisplayName(item: SocialFeedItem) {
  return normalizeVictionIdentity(
    item.trader?.handle ?? item.author.handle ?? item.author.displayName ?? item.author.username,
    item.author.userId,
  );
}

function normalizeVictionIdentity(value: string | null | undefined, fallbackSeed: string) {
  const clean = (value ?? "").trim().replace(/^@/, "");
  if (clean && !/^0x[a-f0-9]{8,}/i.test(clean) && !clean.includes("...")) {
    return clean.endsWith(".viction") ? clean : clean + ".viction";
  }

  return "trader" + fallbackSeed.slice(-5).toLowerCase() + ".viction";
}

function formatSocialMarketPrice(market: Market | null) {
  if (!market) return undefined;

  const price = getMarketPrice(market);
  const numericPrice = price ? Number(price) : Number.NaN;

  if (Number.isFinite(numericPrice)) {
    return "YES " + (numericPrice * 100).toFixed(1) + "%";
  }

  return undefined;
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
      parameter: "Trader Leverage Limit",
      currentValue: (execution.maxPendingMarginLeverage ?? 10) + "x",
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
  return vaults.reduce((max, vault) => Math.max(max, vault.maxLeverage), 10);
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

async function settleTerminalExecution(positionId: string) {
  const response = await fetch("/api/execution/positions/" + positionId + "/settle", {
    method: "POST",
  });
  const body = (await response.json()) as ExecutionSettlementResponse;

  if (!response.ok || !body.ok) {
    throw new Error(body.ok ? "Execution settlement failed." : body.error.message);
  }

  return body.data.executionAttempt;
}

function getMarginSettlementMessage(
  confirmedStatus: ContractTransaction["status"],
  attempt: ExecutionSettlementAttempt | null,
) {
  if (attempt?.status === "CONFIRMED") {
    const hash = attempt.chainTransactionHash
      ? " Adapter tx: " + formatCompactHash(attempt.chainTransactionHash) + "."
      : "";

    return "Margin fill confirmed through the vault adapter." + hash;
  }

  if (attempt?.failureMessage) {
    return attempt.failureMessage;
  }

  if (attempt?.status) {
    return "Margin request confirmed. Adapter settlement status: " + attempt.status + ".";
  }

  return confirmedStatus === "CONFIRMED"
    ? "Margin request confirmed onchain. Adapter settlement is pending."
    : "Margin transaction submitted. Keep this page open or check portfolio for confirmation.";
}

function formatCompactHash(value: string) {
  return value.length > 14 ? value.slice(0, 6) + "..." + value.slice(-4) : value;
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
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 4902
  );
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
