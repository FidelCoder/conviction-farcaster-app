"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";

import { BrowserWalletMarks, GoogleWalletMark } from "./AuthWalletMarks";
import { MobileWalletLauncher } from "./MobileWalletLauncher";
import { ThirdwebWalletBridge, ThirdwebWalletProvider } from "./ThirdwebWalletBridge";
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
import {
  getNoWalletDetectedMessage,
  isMobileWalletEnvironment,
  resolveEvmWalletProvider,
  type EthereumProvider,
} from "../lib/evm-wallet-provider";
import { isThirdwebConfigured } from "../lib/thirdweb-client";
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

type ProfileClaimResponse =
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
type SignInMode = "smart" | "eoa";
type SessionWalletKind = "smart" | "eoa";

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
const VICTION_SUFFIX = ".viction";
const ONBOARDING_AVATARS = [
  { id: "bottts", label: "Signal Bot", style: "bottts" },
  { id: "rings", label: "Orbit Ring", style: "rings" },
  { id: "identicon", label: "Vault Sigil", style: "identicon" },
  { id: "shapes", label: "Market Shape", style: "shapes" },
  { id: "adventurer", label: "Desk Avatar", style: "adventurer-neutral" },
] as const;
type OnboardingAvatarId = (typeof ONBOARDING_AVATARS)[number]["id"];

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
  const socialActivity = useMemo(() => mapTimelineEventsToActivity(timelineEvents, socialFeed), [socialFeed, timelineEvents]);
  const leaderboardItems = useMemo(() => mapLeaderboard(leaderboard), [leaderboard]);
  const [activeTab, setActiveTabState] = useState<TerminalTab>(initialTab);
  const [portfolio, setPortfolio] = useState<UserPortfolio>(emptyPortfolio);
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionWalletKind, setSessionWalletKind] = useState<SessionWalletKind | null>(null);
  const [activeMarket, setActiveMarket] = useState<PredictionMarket>(() =>
    displayMarkets.find((market) => market.id === initialMarketId) ?? displayMarkets[0],
  );
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);
  const [mobileWalletMessage, setMobileWalletMessage] = useState<string | null>(null);
  const [walletBalanceRefreshNonce, setWalletBalanceRefreshNonce] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignInChoiceOpen, setIsSignInChoiceOpen] = useState(false);

  const currentMarket =
    displayMarkets.find((market) => market.id === activeMarket.id) ?? displayMarkets[0];

  useEffect(() => {
    if (!initialMarketId) return;
    const nextMarket = displayMarkets.find((market) => market.id === initialMarketId);
    if (nextMarket) setActiveMarket(nextMarket);
  }, [displayMarkets, initialMarketId]);

  const setActiveTab = useCallback((tab: string) => {
    if (!isTerminalTab(tab)) return;

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

  async function handleConnectWallet(mode?: SignInMode) {
    if (!mode) {
      setIsSignInChoiceOpen(true);
      return;
    }
    if (portfolio.connected) {
      triggerAlert("info", "You are already signed in. Open the account menu to copy or disconnect.");
      return;
    }

    if (mode === "smart") {
      if (isThirdwebConfigured()) {
        window.dispatchEvent(new Event("conviction-thirdweb-smart-connect"));
        return;
      }

      triggerAlert("info", "Smart wallet auth is not configured yet. Use EOA wallet sign-in.");
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
      triggerAlert("success", "EOA wallet signed in and registered with core.");
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
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
    triggerAlert("info", "Session closed.");
  }

  function handleThirdwebSessionReady(nextSession: UserSession) {
    applySession(nextSession);
    setSessionWalletKind("smart");
    setStoredBrowserWalletSession(nextSession);
    setStoredBrowserSessionWalletKind("smart");
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

  function handleThirdwebDisconnectSession() {
    applySession(null);
    setSessionWalletKind(null);
    clearStoredBrowserWalletSession();
  }

  function handleProfileClaimed(nextSession: UserSession) {
    applySession(nextSession);
    setStoredBrowserWalletSession(nextSession);
    triggerAlert("success", "Your .viction identity is active.");
  }

  function handleOpenProfileSettings() {
    window.location.href = "/me/profile";
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
            marketTitle: "[" + outcomeType + "] " + activeMarket.title + (visibility === "PUBLIC" ? " (public)" : ""),
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
        triggerAlert("info", "Preparing smart wallet deposit for " + amount.toFixed(2) + " " + vault.asset + ".");
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
        refreshWalletBalances();
        triggerAlert("success", "Vault deposit confirmed.");
        return transaction;
      }

      const provider = await resolveEvmWalletProvider();

      if (!provider) {
        promptMobileWallet();
        return false;
      }

      triggerAlert("info", "Preparing wallet approval for " + amount.toFixed(2) + " " + vault.asset + ".");
      const currentAccounts = normalizeAccounts(
        await provider.request({ method: "eth_requestAccounts" }),
      );
      const walletAddress = currentAccounts[0];

      if (!walletAddress || walletAddress.toLowerCase() !== portfolio.address.toLowerCase()) {
        triggerAlert("info", "Connected EOA wallet does not match the active Conviction session. Disconnect and sign in with that EOA, or use Smart wallet sign-in.");
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

      const transaction = buildVaultDepositTransaction({
        amount,
        approvalHash,
        depositHash,
        vault,
        vaultId,
      });

      recordVaultDepositTransaction(transaction, vaultId, amount);
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
        window.removeEventListener("conviction-thirdweb-smart-deposit-result", handleResult as EventListener);
        window.removeEventListener("conviction-thirdweb-smart-deposit-error", handleError as EventListener);
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

      window.addEventListener("conviction-thirdweb-smart-deposit-result", handleResult as EventListener);
      window.addEventListener("conviction-thirdweb-smart-deposit-error", handleError as EventListener);
      window.dispatchEvent(new CustomEvent("conviction-thirdweb-smart-deposit", {
        detail: { ...input, requestId },
      }));
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

  function recordVaultDepositTransaction(transaction: VaultDepositTransaction, vaultId: string, amount: number) {
    setPortfolio((current) => ({
      ...current,
      vaultBalances: {
        ...current.vaultBalances,
        [vaultId]: (current.vaultBalances[vaultId] ?? 0) + amount,
      },
      vaultTransactions: [transaction, ...current.vaultTransactions].slice(0, 20),
    }));
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

  function requireActivityWallet() {
    if (portfolio.connected) {
      triggerAlert("info", "Wallet session is active. Wait a moment for the profile session to finish loading.");
      return;
    }

    void handleConnectWallet();
  }

  async function handleCreateActivitySignal(input: { marketId: string; side: "YES" | "NO"; thesis: string }) {
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
        <RequiredVictionOnboarding
          onClaimed={handleProfileClaimed}
          onOpenProfile={handleOpenProfileSettings}
          session={session}
        />
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
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenPortfolio={() => {
          window.location.href = "/me";
        }}
        onOpenSignInMenu={handleOpenSignInMenu}
        portfolio={portfolio}
        session={session}
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
            markets={displayMarkets}
            onCreateSignal={handleCreateActivitySignal}
            onOpenMarket={handleOpenMargin}
            onRequireWallet={requireActivityWallet}
            portfolio={portfolio}
            session={session}
            onTimelineRefresh={() => refreshSocialTimeline(setTimelineEvents, session?.user.id)}
          />
        ) : null}
      </div>

      <StatusBar
        contractStatus="TESTNET"
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
    <div className="viction-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="sign-in-choice-title">
      <div className="viction-onboarding-card sign-in-choice-card">
        <div className="viction-onboarding-heading">
          <span>Sign in</span>
          <h2 id="sign-in-choice-title">Choose how to enter</h2>
          <p>Use Google for a smart wallet or connect the self-custody wallet where you already hold funds.</p>
        </div>
        <div className="sign-in-choice-grid">
          <button className="sign-in-choice-option" onClick={() => onSelect("smart")} type="button">
            <GoogleWalletMark className="sign-in-choice-mark" />
            <span>Google</span>
            <strong>Smart wallet</strong>
            <small>Google sign-in creates or opens your thirdweb smart account for Conviction.</small>
          </button>
          <button className="sign-in-choice-option" onClick={() => onSelect("eoa")} type="button">
            <BrowserWalletMarks className="sign-in-choice-marks" />
            <span>Other wallets</span>
            <strong>Self-custody wallet</strong>
            <small>MetaMask, Coinbase, Trust Wallet, Rabby, Phantom, OKX, and other EOA wallets.</small>
          </button>
        </div>
        <div className="viction-onboarding-actions">
          <button onClick={onClose} type="button">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RequiredVictionOnboarding({
  onClaimed,
  onOpenProfile,
  session,
}: {
  onClaimed: (session: UserSession) => void;
  onOpenProfile: () => void;
  session: UserSession | null;
}) {
  const walletAddress = getSessionWalletAddress(session);
  const existingHandle = session?.traderProfile?.handle ?? "";
  const requiresClaim = Boolean(walletAddress && !isCompleteVictionProfile(existingHandle));
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [avatarId, setAvatarId] = useState<OnboardingAvatarId>("bottts");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message: string }>({
    type: "idle",
    message: "",
  });

  const fullHandle = buildOnboardingHandle(handle);
  const avatarUrl = buildOnboardingAvatarUrl(avatarId, fullHandle);

  useEffect(() => {
    if (!requiresClaim) {
      setStatus({ type: "idle", message: "" });
      return;
    }

    setEmail(session?.user.email ?? "");
    setHandle(suggestHandleFromSession(session));
  }, [requiresClaim, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletAddress) return;

    const cleanHandle = normalizeVictionHandle(handle);

    if (cleanHandle.length < 2) {
      setStatus({ type: "error", message: "Choose a handle with at least 2 characters." });
      return;
    }

    setStatus({ type: "saving", message: "Claiming your .viction identity..." });

    try {
      const profileResponse = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          handle: buildOnboardingHandle(cleanHandle),
          bio: bio.trim() || null,
          avatarUrl,
        }),
      });
      const profileBody = (await profileResponse.json()) as ProfileClaimResponse;

      if (!profileResponse.ok || !profileBody.ok) {
        setStatus({
          type: "error",
          message: profileBody.ok ? "Profile claim failed." : profileBody.error.message,
        });
        return;
      }

      let nextSession = profileBody.data.session;

      if (email.trim()) {
        const emailResponse = await fetch("/api/user-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, email: email.trim() }),
        });
        const emailBody = (await emailResponse.json()) as ProfileClaimResponse;

        if (!emailResponse.ok || !emailBody.ok) {
          setStatus({
            type: "error",
            message: emailBody.ok ? "Email update failed." : emailBody.error.message,
          });
          return;
        }

        nextSession = {
          ...nextSession,
          user: { ...nextSession.user, email: email.trim() },
        };
      }

      onClaimed(nextSession);
    } catch {
      setStatus({ type: "error", message: "Core API did not accept the profile claim." });
    }
  }

  if (!requiresClaim) return null;

  return (
    <div className="viction-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="viction-onboarding-title">
      <form className="viction-onboarding-card" onSubmit={handleSubmit}>
        <div className="viction-onboarding-heading">
          <span>Required setup</span>
          <h2 id="viction-onboarding-title">Claim your .viction identity</h2>
          <p>Pick the name and avatar attached to this signed-in wallet before using Conviction.</p>
        </div>

        <div className="viction-onboarding-preview">
          <img alt="Selected .viction avatar" src={avatarUrl} />
          <div>
            <span>Profile tag</span>
            <strong>{fullHandle}</strong>
            <small>{walletAddress ? formatWalletForOnboarding(walletAddress) : "Signed-in wallet"}</small>
          </div>
        </div>

        <label className="viction-onboarding-field">
          <span>Handle</span>
          <div className="viction-onboarding-handle">
            <input
              autoFocus
              onChange={(event) => setHandle(normalizeVictionHandle(event.target.value))}
              placeholder="sue"
              type="text"
              value={handle}
            />
            <b>.viction</b>
          </div>
        </label>

        <label className="viction-onboarding-field">
          <span>Email</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="viction-onboarding-field">
          <span>Bio</span>
          <textarea
            maxLength={160}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Prediction markets, sports edges, macro theses."
            value={bio}
          />
        </label>

        <div className="viction-onboarding-avatars" aria-label="Choose profile avatar">
          {ONBOARDING_AVATARS.map((avatar) => (
            <button
              aria-pressed={avatar.id === avatarId}
              className={avatar.id === avatarId ? "selected" : ""}
              key={avatar.id}
              onClick={() => setAvatarId(avatar.id)}
              type="button"
            >
              <img alt="" src={buildOnboardingAvatarUrl(avatar.id, fullHandle)} />
              <span>{avatar.label}</span>
            </button>
          ))}
        </div>

        {status.message ? (
          <p className={status.type === "error" ? "viction-onboarding-message error" : "viction-onboarding-message"}>
            {status.message}
          </p>
        ) : null}

        <div className="viction-onboarding-actions">
          <button disabled={status.type === "saving"} type="submit">
            {status.type === "saving" ? "Claiming..." : "Claim identity"}
          </button>
          <button onClick={onOpenProfile} type="button">
            Full profile setup
          </button>
        </div>
      </form>
    </div>
  );
}

function isCompleteVictionProfile(handle: string) {
  const normalized = handle.trim().toLowerCase();

  return normalized.endsWith(VICTION_SUFFIX) && !/^wallet[a-f0-9]{10}\.viction$/i.test(normalized);
}

function normalizeVictionHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.viction$/i, "")
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 32);
}

function buildOnboardingHandle(value: string) {
  const clean = normalizeVictionHandle(value) || "yourname";
  return clean + VICTION_SUFFIX;
}

function buildOnboardingAvatarUrl(avatarId: OnboardingAvatarId, handle: string) {
  const option = ONBOARDING_AVATARS.find((item) => item.id === avatarId) ?? ONBOARDING_AVATARS[0];

  return (
    "https://api.dicebear.com/10.x/" +
    option.style +
    "/svg?seed=" +
    encodeURIComponent(handle + "-" + avatarId) +
    "&backgroundColor=0e0e0e,161616,201f1f&radius=12"
  );
}

function suggestHandleFromSession(session: UserSession | null) {
  const username = session?.socialAccount.username ?? "";
  const displayName = session?.user.displayName ?? "";
  const source = username.includes("...") ? displayName : username || displayName;

  if (!source || source.includes("...") || /^wallet\s+0x/i.test(source) || /^0x/i.test(source)) {
    return "";
  }

  const clean = normalizeVictionHandle(source.replace(/^wallet\s+/i, ""));

  return clean.length >= 2 ? clean : "";
}

function formatWalletForOnboarding(walletAddress: string) {
  return walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
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


function isTerminalTab(value: string | null | undefined): value is TerminalTab {
  return typeof value === "string" && TERMINAL_TABS.includes(value as TerminalTab);
}

function getTerminalTabFromPath(pathname: string) {
  return TERMINAL_PATH_TABS[pathname.replace(/\/$/, "") || "/"];
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

function mapTimelineEventsToActivity(events: SocialTimelineEvent[], fallbackFeed: SocialFeedItem[]): ActivityItem[] {
  if (events.length === 0) {
    return mapSocialFeedToActivity(fallbackFeed);
  }

  return events.map((event) => {
    if (event.type === "REPOST" && event.signal) {
      const signalItem = mapSocialFeedItemToActivity(event.signal);
      return {
        ...signalItem,
        id: event.id,
        eventType: "REPOST",
        kind: "repost",
        actorUserId: event.actor.userId,
        username: getActorUsername(event.actor),
        name: getActorDisplayName(event.actor),
        time: formatRelativeTime(event.createdAt),
        text: getActorDisplayName(event.actor) + " reposted: " + buildSignalFeedText(event.signal),
        topic: "Repost",
      };
    }

    if (event.type === "PUBLIC_TRADE" && event.position) {
      return {
        id: event.id,
        actorUserId: event.actor.userId,
        username: getActorUsername(event.actor),
        name: getActorDisplayName(event.actor),
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
          author: getActorUsername(reply.author),
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

    if (event.type === "FOLLOW" && event.follow) {
      return {
        id: event.id,
        actorUserId: event.actor.userId,
        username: getActorUsername(event.actor),
        name: getActorDisplayName(event.actor),
        time: formatRelativeTime(event.createdAt),
        text: getActorDisplayName(event.follow.follower) + " followed " + getActorDisplayName(event.follow.following) + ".",
        type: "request",
        kind: "follow",
        eventType: "FOLLOW",
        likes: 0,
        commentsCount: 0,
        repeats: 0,
        replies: [],
        topic: "Follow",
        followTarget: {
          userId: event.follow.following.userId,
          username: getActorUsername(event.follow.following),
          displayName: getActorDisplayName(event.follow.following),
        },
      };
    }

    if (event.signal) {
      return {
        ...mapSocialFeedItemToActivity(event.signal),
        eventType: "SIGNAL",
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
      topic: "Activity",
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
    username: getSocialUsername(item),
    name: item.author.displayName ?? item.author.username ?? item.trader?.handle ?? "Conviction trader",
    time: formatRelativeTime(item.signal.createdAt),
    text: buildSignalFeedText(item),
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
      author: reply.author.username ?? reply.author.handle ?? reply.author.displayName ?? "trader",
      text: reply.body,
      time: formatRelativeTime(reply.createdAt),
    })),
    repostedByUser: item.viewer?.bookmarked ?? false,
    topic: item.market?.providerMetadata?.primaryTag ?? item.market?.category ?? "Signal",
  };
}

function parseTimelineEvents(body: unknown): SocialTimelineEvent[] {
  if (!body || typeof body !== "object" || !("ok" in body)) return [];
  const response = body as { ok?: boolean; data?: { events?: unknown } };
  return response.ok && Array.isArray(response.data?.events)
    ? response.data.events as SocialTimelineEvent[]
    : [];
}

async function refreshSocialTimeline(setter: (events: SocialTimelineEvent[]) => void, userId?: string) {
  const params = new URLSearchParams({ limit: "80", scope: "all" });
  if (userId) params.set("userId", userId);

  try {
    const response = await fetch("/api/social/timeline?" + params.toString());
    const body = await response.json() as unknown;
    setter(parseTimelineEvents(body));
  } catch {
    // Keep current feed if refresh fails.
  }
}

function buildPublicTradeText(event: SocialTimelineEvent) {
  const position = event.position;
  if (!position) return "Placed a public trade.";

  const leverage = position.leverageMultiplier ? " at " + position.leverageMultiplier + "x" : "";
  const collateral = position.marginCollateral ? " with " + position.marginCollateral + " collateral" : "";
  return getActorDisplayName(event.actor) + " placed a public " + position.side + " trade" + leverage + collateral + ".";
}

function getActorUsername(actor: { handle?: string | null; username?: string | null; displayName?: string | null; userId: string }) {
  return actor.handle ?? actor.username ?? actor.displayName ?? "user" + actor.userId.slice(-5);
}

function getActorDisplayName(actor: { handle?: string | null; username?: string | null; displayName?: string | null; userId: string }) {
  return actor.handle ?? actor.displayName ?? actor.username ?? "Trader " + actor.userId.slice(-5);
}

function getSocialUsername(item: SocialFeedItem) {
  return (
    item.author.username ??
    item.author.handle ??
    item.trader?.handle ??
    item.author.displayName ??
    "trader"
  );
}

function buildSignalFeedText(item: SocialFeedItem) {
  const side = item.signal.side === "NO" ? "NO" : "YES";
  const conviction = item.signal.convictionLevel ? " / conviction " + item.signal.convictionLevel + "%" : "";

  return side + " call" + conviction + ": " + item.signal.thesis;
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
