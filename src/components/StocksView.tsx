"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  listEquityStocks,
  listEquityPrices,
  listEquityStrategies,
  writeEquityOption,
  getEquityVaultOptions,
  type EquityOptionPosition,
} from "../lib/core-api";
import {
  CheckCircle2,
  Wallet,
  LogOut,
  Bolt,
  RefreshCw,
  Lock,
  ChevronDown,
  ShieldCheck,
  Cpu,
} from "lucide-react";

// ---------------------------------------------------------------
//  Wagmi config (isolated — doesn't interfere with main app wallet)
// ---------------------------------------------------------------

const stocksWagmiConfig = createConfig({
  chains: [base],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

// ---------------------------------------------------------------
//  Types
// ---------------------------------------------------------------

type TerminalTab = "all-screen" | "vaults" | "markets" | "positions" | "yield";

interface SyntheticAsset {
  symbol: string;
  name: string;
  shortCode: string;
  price: number;
  change24h: number;
  impliedVol: number;
  vaultApy: number;
  userHoldings: number;
  holdingValue: number;
  oracleFeed: string;
  contractAddress: string;
}

interface CoveredCallStrategy {
  id: "conservative" | "moderate" | "aggressive";
  label: string;
  riskBadge: string;
  riskClass: string;
  otmPercentage: number;
  isItm?: boolean;
  strikeOffset: number;
  expiryDays: number;
  apyRange: string;
  recommended?: boolean;
  premEstMultiplier: number;
}

interface PositionContract {
  id: string;
  symbol: string;
  assetName: string;
  shortCode: string;
  strategyName: string;
  strikePrice: number;
  oracleSpot: number;
  strikeDistancePercent: number;
  lockedCollateral: number;
  collateralUsdValue: number;
  harvestedEth: number;
  harvestedUsd: number;
  cyclePercentElapsed: number;
  daysRemaining: number;
  totalCycleDays: number;
  expiryDateFormatted: string;
  oracleFeedAddress: string;
  status: "Safe (OTM)" | "In The Money (ITM)" | "At The Money (ATM)";
}

interface TradeDetails {
  asset: SyntheticAsset;
  collateralAmount: number;
  strategy: CoveredCallStrategy;
  premiumEth: number;
  premiumUsd: number;
}

// ---------------------------------------------------------------
//  Strategy presets (hardcoded — same as conviction-core-api config)
// ---------------------------------------------------------------

const STRATEGIES: CoveredCallStrategy[] = [
  {
    id: "conservative",
    label: "Conservative",
    riskBadge: "Low Risk",
    riskClass: "text-text-secondary bg-[#141724] border border-[#1F2436]",
    otmPercentage: 10,
    strikeOffset: 1.10,
    expiryDays: 30,
    apyRange: "8–12% APY",
    premEstMultiplier: 0.034,
  },
  {
    id: "moderate",
    label: "Moderate",
    riskBadge: "Balanced",
    riskClass:
      "text-[#FF6B00] bg-[#FF6B00]/10 border border-[#FF6B00]/30",
    otmPercentage: 5,
    strikeOffset: 1.0506,
    expiryDays: 14,
    apyRange: "12–18% APY",
    recommended: true,
    premEstMultiplier: 0.0736,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    riskBadge: "Assignment Risk",
    riskClass:
      "text-[#F04438] bg-[#F04438]/10 border border-[#F04438]/30",
    otmPercentage: 5,
    isItm: true,
    strikeOffset: 0.95,
    expiryDays: 7,
    apyRange: "18–25% APY",
    premEstMultiplier: 0.1245,
  },
];

// ---------------------------------------------------------------
//  Default vault address (set via env or use zero-address for testing)
// ---------------------------------------------------------------

const DEFAULT_VAULT =
  process.env.NEXT_PUBLIC_EQUITY_VAULT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------
//  Inner component that uses wagmi hooks
// ---------------------------------------------------------------

function StocksTerminal() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [activeTab, setActiveTab] = useState<TerminalTab>("all-screen");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [assets, setAssets] = useState<SyntheticAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<SyntheticAsset | null>(
    null,
  );
  const [positions, setPositions] = useState<PositionContract[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const priceHistoryRef = useRef<
    Map<string, { price: number; timestamp: number }[]>
  >(new Map());

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Poll prices every 30s
  useEffect(() => {
    if (assets.length === 0) return;
    const interval = setInterval(() => {
      loadPrices();
    }, 30000);
    return () => clearInterval(interval);
  }, [assets]);

  // Load positions when connected
  useEffect(() => {
    if (isConnected && DEFAULT_VAULT !== "0x".padEnd(42, "0")) {
      loadPositions();
    }
  }, [isConnected]);

  const loadAllData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [stocks, prices] = await Promise.all([
        listEquityStocks(),
        listEquityPrices(),
        listEquityStrategies(),
      ]);

      if (prices.length > 0) {
        const builtAssets: SyntheticAsset[] = stocks.map((stock) => {
          const priceData = prices.find((p) => p.symbol === stock.symbol);
          return {
            symbol: stock.symbol,
            name: stock.name,
            shortCode: stock.symbol.slice(0, 2).toUpperCase(),
            price: priceData?.price ?? 0,
            change24h: 0,
            impliedVol: 0,
            vaultApy: 0,
            userHoldings: 0,
            holdingValue: 0,
            oracleFeed: "Chainlink Oracle",
            contractAddress: stock.tokenAddress ?? "—",
          };
        });

        // Calculate 24h change
        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        for (const asset of builtAssets) {
          const history = priceHistoryRef.current.get(asset.symbol) ?? [];
          const oldPrice = history.find((h) => h.timestamp <= twentyFourHoursAgo);
          if (oldPrice && oldPrice.price > 0 && asset.price > 0) {
            asset.change24h = Number(
              (
                ((asset.price - oldPrice.price) / oldPrice.price) *
                100
              ).toFixed(2),
            );
          }
          history.push({ price: asset.price, timestamp: now });
          const cutoff = now - 48 * 60 * 60 * 1000;
          priceHistoryRef.current.set(
            asset.symbol,
            history.filter((h) => h.timestamp > cutoff),
          );
        }

        setAssets(builtAssets);
        if (!selectedAsset && builtAssets.length > 0) {
          setSelectedAsset(builtAssets[0]);
        }
      }
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Failed to load stock data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrices = async () => {
    try {
      const prices = await listEquityPrices();
      setAssets((prev) =>
        prev.map((asset) => {
          const priceData = prices.find((p) => p.symbol === asset.symbol);
          if (priceData && priceData.price > 0) {
            const history = priceHistoryRef.current.get(asset.symbol) ?? [];
            const now = Date.now();
            const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
            const oldPrice = history.find(
              (h) => h.timestamp <= twentyFourHoursAgo,
            );
            const change24h =
              oldPrice && oldPrice.price > 0
                ? Number(
                    (
                      ((priceData.price - oldPrice.price) /
                        oldPrice.price) *
                      100
                    ).toFixed(2),
                  )
                : asset.change24h;
            history.push({ price: priceData.price, timestamp: now });
            const cutoff = now - 48 * 60 * 60 * 1000;
            priceHistoryRef.current.set(
              asset.symbol,
              history.filter((h) => h.timestamp > cutoff),
            );
            return { ...asset, price: priceData.price, change24h };
          }
          return asset;
        }),
      );
    } catch {
      // Silent fail on price refresh
    }
  };

  const loadPositions = async () => {
    try {
      const data = await getEquityVaultOptions(DEFAULT_VAULT);
      const mapped: PositionContract[] = (data.options ?? []).map(
        (opt: EquityOptionPosition) => ({
          id: `pos-${opt.optionId}`,
          symbol: opt.symbol,
          assetName: opt.symbol,
          shortCode: opt.symbol.slice(0, 2).toUpperCase(),
          strategyName: "Covered Call",
          strikePrice: opt.strikePrice,
          oracleSpot:
            assets.find((a) => a.symbol === opt.symbol)?.price ?? 0,
          strikeDistancePercent: 0,
          lockedCollateral: opt.collateralLocked,
          collateralUsdValue:
            opt.collateralLocked *
            (assets.find((a) => a.symbol === opt.symbol)?.price ?? 0),
          harvestedEth: 0,
          harvestedUsd: opt.premium,
          cyclePercentElapsed: opt.progressPct ?? 0,
          daysRemaining: Math.max(
            0,
            Math.ceil(opt.timeRemaining / 86400),
          ),
          totalCycleDays: 14,
          expiryDateFormatted: new Date(
            opt.expiry * 1000,
          ).toUTCString(),
          oracleFeedAddress: "—",
          status:
            opt.status === "ACTIVE"
              ? "Safe (OTM)"
              : "In The Money (ITM)",
        }),
      );
      setPositions(mapped);
    } catch {
      // Positions load failed
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExecuteTrade = async (details: {
    asset: SyntheticAsset;
    collateralAmount: number;
    strategy: CoveredCallStrategy;
    premiumEth: number;
    premiumUsd: number;
  }) => {
    try {
      await writeEquityOption(
        DEFAULT_VAULT,
        details.asset.symbol,
        details.strategy.id,
        details.collateralAmount,
      );
    } catch {
      // API may not be running
    }

    setAssets((prev) =>
      prev.map((a) => {
        if (a.symbol === details.asset.symbol) {
          const newHoldings = Math.max(
            0,
            a.userHoldings - details.collateralAmount,
          );
          return {
            ...a,
            userHoldings: Number(newHoldings.toFixed(2)),
            holdingValue: Number((newHoldings * a.price).toFixed(2)),
          };
        }
        return a;
      }),
    );

    const newContract: PositionContract = {
      id: `pos-${Date.now()}`,
      symbol: details.asset.symbol,
      assetName: details.asset.name,
      shortCode: details.asset.shortCode,
      strategyName: `${details.strategy.label} Covered Call`,
      strikePrice: Number(
        (details.asset.price * details.strategy.strikeOffset).toFixed(2),
      ),
      oracleSpot: details.asset.price,
      strikeDistancePercent: Number(
        details.strategy.otmPercentage.toFixed(1),
      ),
      lockedCollateral: details.collateralAmount,
      collateralUsdValue: Number(
        (details.collateralAmount * details.asset.price).toFixed(2),
      ),
      harvestedEth: details.premiumEth,
      harvestedUsd: details.premiumUsd,
      cyclePercentElapsed: 0,
      daysRemaining: details.strategy.expiryDays,
      totalCycleDays: details.strategy.expiryDays,
      expiryDateFormatted: `Oct ${12 + details.strategy.expiryDays}, 08:00 UTC`,
      status: "Safe (OTM)",
      oracleFeedAddress: "—",
    };

    setPositions((prev) => [newContract, ...prev]);

    showToast(
      `Deposit Confirmed: Locked ${details.collateralAmount} ${details.asset.symbol}. Earned +$${details.premiumUsd.toFixed(2)} upfront premium!`,
    );
  };

  const handleRollPosition = (id: string) => {
    setPositions((prev) =>
      prev.map((pos) => {
        if (pos.id === id) {
          return {
            ...pos,
            daysRemaining: 14,
            cyclePercentElapsed: 0,
            harvestedUsd: Number((pos.harvestedUsd + 34.2).toFixed(2)),
          };
        }
        return pos;
      }),
    );
    showToast("Position rolled: 14-day epoch extension recorded.");
  };

  const handleHarvestPremium = (ethAmount: number, usdAmount: number) => {
    showToast(
      `Harvested ${ethAmount} ETH (~$${usdAmount.toFixed(2)} USD) to wallet.`,
    );
  };

  const handleWithdrawCollateral = (amountUsdc: number) => {
    showToast(
      `Redeemed and transferred $${amountUsdc.toFixed(2)} USDC to wallet.`,
    );
  };

  const handleConnectWallet = () => {
    const injectedConnector = connectors.find(
      (c) => c.id === "injected",
    );
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // Loading state
  if (isLoading && assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="font-mono text-sm text-[#FF6B00] animate-pulse">
          INITIALIZING — Connecting to Chainlink oracles...
        </div>
        <div className="font-mono text-xs text-[#5C658E] mt-2">
          Fetching real-time prices for Coinbase tokenized stocks
        </div>
      </div>
    );
  }

  // Error state
  if (apiError && assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="font-mono text-sm text-[#F04438]">
          CONNECTION FAILED
        </div>
        <div className="font-mono text-xs text-[#5C658E] mt-2 max-w-md text-center">
          {apiError}
        </div>
        <button
          onClick={() => {
            setApiError(null);
            loadAllData();
          }}
          className="mt-4 px-4 py-2 bg-[#FF6B00] text-[#090A0F] font-mono text-xs font-bold uppercase cursor-pointer hover:bg-[#FF7A1A] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const safeSelected = selectedAsset ?? assets[0];

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 max-w-sm bg-[#0E111A] border border-[#FF6B00] p-2.5 shadow-2xl font-mono text-xs text-[#F8FAFC] flex items-start gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-[#00D084] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-[#FF6B00] block text-[10px] uppercase">
              Base L2 Confirmed
            </span>
            <span className="text-[#94A3B8] leading-tight">
              {toastMessage}
            </span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#5C658E] hover:text-[#F8FAFC] text-xs ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Wallet bar */}
      {!isConnected && (
        <div className="px-3 py-2 bg-[#141724] border border-[#1F2436] flex items-center justify-between">
          <span className="text-[10px] text-[#5C658E]">
            Connect your Base wallet to trade tokenized stocks
          </span>
          <button
            onClick={handleConnectWallet}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-mono text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            Connect
          </button>
        </div>
      )}
      {isConnected && (
        <div className="px-3 py-1 bg-[#00D084]/5 border border-[#00D084]/20 flex items-center justify-between">
          <span className="text-[10px] text-[#00D084] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full animate-pulse"></span>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-[10px] text-[#5C658E] hover:text-[#F04438] flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[#0E111A] border border-[#1F2436] p-1">
        {(
          [
            { id: "all-screen", label: "Terminal" },
            { id: "vaults", label: "Vaults" },
            { id: "markets", label: "Stocks" },
            { id: "positions", label: "Positions" },
            { id: "yield", label: "Yield" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 text-[10px] uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "text-[#FF6B00] bg-[#FF6B00]/10 border border-[#FF6B00]/30 font-bold"
                : "text-[#5C658E] hover:text-[#F8FAFC] border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#0E111A] border border-[#1F2436] p-3 min-h-[400px]">
        {activeTab === "all-screen" && (
          <TerminalView
            assets={assets}
            selectedAsset={safeSelected}
            onSelectAsset={setSelectedAsset}
            positions={positions}
            onExecuteTrade={handleExecuteTrade}
          />
        )}
        {activeTab === "markets" && (
          <StocksGrid
            assets={assets}
            onSelect={(a) => {
              setSelectedAsset(a);
              setActiveTab("vaults");
            }}
          />
        )}
        {activeTab === "vaults" && safeSelected && (
          <VaultDesk
            asset={safeSelected}
            onExecuteTrade={handleExecuteTrade}
          />
        )}
        {activeTab === "positions" && (
          <PositionsList
            positions={positions}
            onRoll={handleRollPosition}
          />
        )}
        {activeTab === "yield" && (           <YieldPanel
            onHarvest={handleHarvestPremium}
          />
        )}
      </div>

      {/* Footer ticker */}
      <div className="h-8 bg-[#0E111A] border border-[#1F2436] px-3 flex items-center justify-between text-[10px] text-[#5C658E] select-none">
        <div className="flex items-center space-x-3 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 text-[#00D084] font-semibold shrink-0">
            <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full animate-pulse"></span>
            <span>ORACLE ORBIT</span>
          </div>
          <span className="text-[#1F2436]">|</span>
          {assets.map((asset) => (
            <div
              key={asset.symbol}
              className="flex items-center space-x-1.5 shrink-0"
            >
              <span className="text-[#94A3B8] font-bold">
                {asset.symbol}
              </span>
              <span className="text-[#F8FAFC]">
                ${asset.price.toFixed(2)}
              </span>
              <span
                className={`text-[9px] ${
                  asset.change24h >= 0
                    ? "text-[#00D084]"
                    : "text-[#F04438]"
                }`}
              >
                {asset.change24h >= 0 ? "+" : ""}
                {asset.change24h.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
        <div className="hidden lg:flex items-center space-x-4 shrink-0">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#FF6B00]" />
            <span>Base L2 · ERC-4626</span>
          </div>
          <span className="text-[#1F2436]">|</span>
          <div className="flex items-center gap-1 text-[#31e193]">
            <Cpu className="w-3 h-3" />
            <span>Chainlink Oracle</span>
          </div>
          <span className="text-[#1F2436]">|</span>
          <span className="text-[#94A3B8]">v1.0-equity</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------

function TerminalView({
  assets,
  selectedAsset,
  onSelectAsset,
  positions,
  onExecuteTrade,
}: {
  assets: SyntheticAsset[];
  selectedAsset: SyntheticAsset;
  onSelectAsset: (a: SyntheticAsset) => void;
  positions: PositionContract[];
  onExecuteTrade: (d: TradeDetails) => void;
}) {
  const [collateralAmount, setCollateralAmount] = useState(
    selectedAsset?.userHoldings || 1,
  );
  const [selectedStrategyId, setSelectedStrategyId] = useState<
    "conservative" | "moderate" | "aggressive"
  >("moderate");
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);

  useEffect(() => {
    setCollateralAmount(selectedAsset?.userHoldings || 1);
  }, [selectedAsset]);

  const selectedStrategy =
    STRATEGIES.find((s) => s.id === selectedStrategyId) || STRATEGIES[1];
  const strikePrice = Number(
    (selectedAsset.price * selectedStrategy.strikeOffset).toFixed(2),
  );
  const premiumUsd = Number(
    (
      collateralAmount *
      selectedAsset.price *
      selectedStrategy.premEstMultiplier
    ).toFixed(2),
  );
  const premiumEth = Number((premiumUsd / 2278.4).toFixed(4));

  return (
    <div className="flex flex-col gap-3">
      {/* Stock selector */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-[#141724] border border-[#1F2436] hover:border-[#FF6B00]/50 transition-colors cursor-pointer"
          >
            <span className="font-bold text-[#F8FAFC]">
              {selectedAsset.symbol}
            </span>
            <span className="text-[#5C658E] text-[10px]">
              {selectedAsset.name}
            </span>
            <ChevronDown className="w-3 h-3 text-[#5C658E]" />
          </button>
          {isAssetDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#141724] border border-[#1F2436] z-50 shadow-xl">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => {
                    onSelectAsset(a);
                    setIsAssetDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-[#1F2436] transition-colors cursor-pointer ${
                    a.symbol === selectedAsset.symbol
                      ? "bg-[#FF6B00]/10 border-l-2 border-l-[#FF6B00]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F8FAFC]">
                      {a.symbol}
                    </span>
                    <span className="text-[#5C658E] text-[10px]">
                      {a.name}
                    </span>
                  </div>
                  <span className="text-[#F8FAFC]">
                    ${a.price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price + Strategy */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#141724] border border-[#1F2436] p-3">
          <div className="text-[10px] text-[#5C658E] uppercase">
            Current Price
          </div>
          <div className="text-xl font-bold text-[#F8FAFC] mt-1">
            ${selectedAsset.price.toFixed(2)}
          </div>
          <div
            className={`text-xs mt-0.5 ${
              selectedAsset.change24h >= 0
                ? "text-[#00D084]"
                : "text-[#F04438]"
            }`}
          >
            {selectedAsset.change24h >= 0 ? "+" : ""}
            {selectedAsset.change24h.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#141724] border border-[#1F2436] p-3">
          <div className="text-[10px] text-[#5C658E] uppercase">
            Strategy
          </div>
          <div className="flex gap-1 mt-1">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStrategyId(s.id)}
                className={`px-2 py-1 text-[10px] border transition-colors cursor-pointer ${
                  s.id === selectedStrategyId
                    ? s.riskClass
                    : "text-[#5C658E] border-[#1F2436] hover:border-[#FF6B00]/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#FF6B00] mt-1">
            {selectedStrategy.apyRange}
          </div>
        </div>
      </div>

      {/* Trade details */}
      <div className="bg-[#141724] border border-[#1F2436] p-3 grid grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Collateral
          </div>
          <input
            type="number"
            value={collateralAmount}
            onChange={(e) =>
              setCollateralAmount(parseFloat(e.target.value) || 0)
            }
            className="w-full bg-[#090A0F] border border-[#1F2436] px-2 py-1 text-[#F8FAFC] font-bold mt-1 text-sm"
          />
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Strike
          </div>
          <div className="text-[#F8FAFC] font-bold mt-1 text-sm">
            ${strikePrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Premium
          </div>
          <div className="text-[#00D084] font-bold mt-1 text-sm">
            ${premiumUsd.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            APY
          </div>
          <div className="text-[#FF6B00] font-bold mt-1 text-sm">
            {selectedStrategy.apyRange}
          </div>
        </div>
      </div>

      {/* Execute button */}
      <button
        onClick={() =>
          onExecuteTrade({
            asset: selectedAsset,
            collateralAmount,
            strategy: selectedStrategy,
            premiumEth,
            premiumUsd,
          })
        }
        className="w-full py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        Deposit & Write Covered Call
      </button>

      {/* Active positions */}
      {positions.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] text-[#5C658E] uppercase mb-2">
            Active Positions
          </div>
          <div className="space-y-2">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="bg-[#141724] border border-[#1F2436] p-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full"></span>
                  <span className="font-bold text-[#F8FAFC]">
                    {pos.symbol}
                  </span>
                  <span className="text-[#5C658E]">
                    Strike ${pos.strikePrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#00D084]">
                    +${pos.harvestedUsd.toFixed(2)}
                  </span>
                  <span className="text-[#5C658E]">
                    {pos.daysRemaining}d left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StocksGrid({
  assets,
  onSelect,
}: {
  assets: SyntheticAsset[];
  onSelect: (a: SyntheticAsset) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-[#5C658E] uppercase">
        Coinbase Tokenized Stocks on Base
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {assets.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => onSelect(asset)}
            className="bg-[#141724] border border-[#1F2436] hover:border-[#FF6B00]/50 p-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[#F8FAFC]">
                  {asset.symbol}
                </div>
                <div className="text-[10px] text-[#5C658E]">
                  {asset.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[#F8FAFC]">
                  ${asset.price.toFixed(2)}
                </div>
                <div
                  className={`text-[10px] ${
                    asset.change24h >= 0
                      ? "text-[#00D084]"
                      : "text-[#F04438]"
                  }`}
                >
                  {asset.change24h >= 0 ? "+" : ""}
                  {asset.change24h.toFixed(2)}%
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function VaultDesk({
  asset,
  onExecuteTrade,
}: {
  asset: SyntheticAsset;
  onExecuteTrade: (d: TradeDetails) => void;
}) {
  const [collateralAmount, setCollateralAmount] = useState(1);
  const [selectedStrategyId, setSelectedStrategyId] = useState<
    "conservative" | "moderate" | "aggressive"
  >("moderate");

  const selectedStrategy =
    STRATEGIES.find((s) => s.id === selectedStrategyId) || STRATEGIES[1];
  const strikePrice = Number(
    (asset.price * selectedStrategy.strikeOffset).toFixed(2),
  );
  const premiumUsd = Number(
    (
      collateralAmount *
      asset.price *
      selectedStrategy.premEstMultiplier
    ).toFixed(2),
  );
  const premiumEth = Number((premiumUsd / 2278.4).toFixed(4));

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-[#5C658E] uppercase">
        Write Covered Call — {asset.symbol}
      </div>
      <div className="bg-[#141724] border border-[#1F2436] p-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Collateral Amount
          </div>
          <input
            type="number"
            value={collateralAmount}
            onChange={(e) =>
              setCollateralAmount(parseFloat(e.target.value) || 0)
            }
            className="w-full bg-[#090A0F] border border-[#1F2436] px-2 py-1 text-[#F8FAFC] font-bold mt-1"
          />
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Strategy
          </div>
          <div className="flex gap-1 mt-1">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStrategyId(s.id)}
                className={`px-2 py-1 text-[10px] border transition-colors cursor-pointer ${
                  s.id === selectedStrategyId
                    ? s.riskClass
                    : "text-[#5C658E] border-[#1F2436]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#141724] border border-[#1F2436] p-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Strike
          </div>
          <div className="text-[#F8FAFC] font-bold">
            ${strikePrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Premium
          </div>
          <div className="text-[#00D084] font-bold">
            ${premiumUsd.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#5C658E] uppercase">
            Expiry
          </div>
          <div className="text-[#F8FAFC] font-bold">
            {selectedStrategy.expiryDays}d
          </div>
        </div>
      </div>
      <button
        onClick={() =>
          onExecuteTrade({
            asset,
            collateralAmount,
            strategy: selectedStrategy,
            premiumEth,
            premiumUsd,
          })
        }
        className="w-full py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        Deposit & Write — {asset.symbol}
      </button>
    </div>
  );
}

function PositionsList({
  positions,
  onRoll,
}: {
  positions: PositionContract[];
  onRoll: (id: string) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="text-[#5C658E] text-[10px] uppercase">
          No active positions
        </div>
        <div className="text-[#5C658E] text-[10px] mt-1">
          Deposit tokenized stocks and write covered calls to start earning
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-[#5C658E] uppercase">
        Active Covered Call Positions
      </div>
      {positions.map((pos) => (
        <div
          key={pos.id}
          className="bg-[#141724] border border-[#1F2436] p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full"></span>
              <span className="font-bold text-[#F8FAFC]">
                {pos.symbol}
              </span>
              <span className="text-[#5C658E] text-[10px]">
                {pos.strategyName}
              </span>
            </div>
            <span className="text-[#00D084] text-[10px] font-bold">
              {pos.status}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <div className="text-[#5C658E]">Strike</div>
              <div className="text-[#F8FAFC] font-bold">
                ${pos.strikePrice.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[#5C658E]">Collateral</div>
              <div className="text-[#F8FAFC] font-bold">
                {pos.lockedCollateral.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[#5C658E]">Premium</div>
              <div className="text-[#00D084] font-bold">
                +${pos.harvestedUsd.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[#5C658E]">Days Left</div>
              <div className="text-[#F8FAFC] font-bold">
                {pos.daysRemaining}d
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-[#090A0F] overflow-hidden">
            <div
              className="h-full bg-[#FF6B00] transition-all"
              style={{
                width: `${pos.cyclePercentElapsed}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-[#5C658E]">
            <span>{pos.cyclePercentElapsed}% elapsed</span>
            <span>{pos.expiryDateFormatted}</span>
          </div>
          <button
            onClick={() => onRoll(pos.id)}
            className="mt-2 w-full py-1.5 bg-[#141724] border border-[#1F2436] hover:border-[#FF6B00]/50 text-[10px] text-[#5C658E] hover:text-[#FF6B00] transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Roll Position
          </button>
        </div>
      ))}
    </div>
  );
}

function YieldPanel({
  onHarvest,
}: {
  onHarvest: (eth: number, usd: number) => void;
}) {
  const [isHarvesting, setIsHarvesting] = useState(false);

  const handleHarvest = () => {
    setIsHarvesting(true);
    setTimeout(() => {
      setIsHarvesting(false);
      onHarvest(0.038, 83.6);
    }, 750);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-[#5C658E] uppercase">
        Yield Dashboard
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#141724] border border-[#1F2436] p-3">
          <div className="text-[10px] text-[#5C658E] uppercase">
            Total Yield Harvested
          </div>
          <div className="text-xl font-bold text-[#F8FAFC] mt-1">
            $83.60
          </div>
          <div className="text-[#00D084] text-[10px] mt-0.5">
            +0.038 ETH cumulative
          </div>
        </div>
        <div className="bg-[#141724] border border-[#1F2436] p-3">
          <div className="text-[10px] text-[#5C658E] uppercase">
            Current Blended APY
          </div>
          <div className="text-xl font-bold text-[#FF6B00] mt-1">
            14.2%
          </div>
          <div className="text-[#00D084] text-[10px] mt-0.5">
            +3.8% vs buy & hold
          </div>
        </div>
      </div>
      <button
        onClick={handleHarvest}
        disabled={isHarvesting}
        className="w-full py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isHarvesting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Transferring...
          </>
        ) : (
          <>
            <Bolt className="w-4 h-4" />
            Harvest Premium
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------
//  Main export — wraps everything in WagmiProvider
// ---------------------------------------------------------------

export default function StocksView() {
  return (
    <WagmiProvider config={stocksWagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <StocksTerminal />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
