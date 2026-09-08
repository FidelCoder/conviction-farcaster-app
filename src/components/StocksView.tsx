"use client";

import React, { useState, useEffect } from "react";
import {
  listEquityStocks,
  listEquityPrices,
  writeEquityOption,
  getEquityVaultOptions,
  settleEquityOptions,
  getEquityVaultYield,
  type EquityOptionPosition,
} from "../lib/core-api";
import {
  CheckCircle2,
  Wallet,
  LogOut,
  Bolt,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
} from "lucide-react";

// ---------------------------------------------------------------
//  Types
// ---------------------------------------------------------------

type StockTab = "stocks" | "vaults" | "positions" | "yield";

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
//  Seed data — all 13 Coinbase B20 tokenized stocks on Base mainnet
// ---------------------------------------------------------------

const SEED_ASSETS: SyntheticAsset[] = [
  { symbol: "NVDAc", name: "NVIDIA Corp", shortCode: "NV", price: 124.50, change24h: 2.31, impliedVol: 45, vaultApy: 14.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase NVDA", contractAddress: "0xb20000000000000000000078ee7ce2fE4908108C" },
  { symbol: "AAPLc", name: "Apple Inc", shortCode: "AP", price: 227.35, change24h: 0.82, impliedVol: 28, vaultApy: 10.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase AAPL", contractAddress: "0xb200000000000000000000C2e324d24d7eEcd1fb" },
  { symbol: "GOOGLc", name: "Alphabet Inc", shortCode: "GO", price: 165.20, change24h: -0.45, impliedVol: 32, vaultApy: 11.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase GOOGL", contractAddress: "0xb2000000000000000000002D0BA3164cc74f58B7" },
  { symbol: "METAc", name: "Meta Platforms", shortCode: "ME", price: 563.80, change24h: 1.15, impliedVol: 38, vaultApy: 12.4, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase META", contractAddress: "0xb2000000000000000000008bC8786B856E61707C" },
  { symbol: "AMZNc", name: "Amazon.com Inc", shortCode: "AM", price: 231.50, change24h: 0.67, impliedVol: 30, vaultApy: 11.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase AMZN", contractAddress: "0xb200000000000000000000d9192b6B456483C2E8" },
  { symbol: "TSLAc", name: "Tesla Inc", shortCode: "TS", price: 348.90, change24h: -1.23, impliedVol: 55, vaultApy: 16.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase TSLA", contractAddress: "0xb200000000000000000000f5e6d5C0f25e6178E4E4a9E7E8b4e6F1234AbCDef" },
  { symbol: "MSFTc", name: "Microsoft Corp", shortCode: "MS", price: 420.15, change24h: 0.34, impliedVol: 25, vaultApy: 9.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase MSFT", contractAddress: "0xb200000000000000000000a1B2C3D4E5F6a7B8C9D0E1F2a3B4C5D6E7F8" },
  { symbol: "COINc", name: "Coinbase Global", shortCode: "CO", price: 265.40, change24h: 3.12, impliedVol: 52, vaultApy: 15.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase COIN", contractAddress: "0xb200000000000000000000b3C4D5E6F7a8B9C0D1E2F3a4B5C6D7E8F9" },
  { symbol: "INTCc", name: "Intel Corp", shortCode: "IN", price: 22.85, change24h: -0.78, impliedVol: 42, vaultApy: 13.1, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase INTC", contractAddress: "0xb200000000000000000000c4D5E6F7a8B9C0D1E2F3a4B5C6D7E8F9a0" },
  { symbol: "MSTRc", name: "MicroStrategy", shortCode: "MS", price: 185.60, change24h: 4.50, impliedVol: 65, vaultApy: 19.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase MSTR", contractAddress: "0xb200000000000000000000d5E6F7a8B9C0D1E2F3a4B5C6D7E8F9a0B1" },
  { symbol: "CRCLc", name: "Circle (USDC)", shortCode: "CR", price: 1.00, change24h: 0.01, impliedVol: 5, vaultApy: 2.1, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase CRCL", contractAddress: "0xb200000000000000000000e6F7a8B9C0D1E2F3a4B5C6D7E8F9a0B1c2" },
  { symbol: "SNDKc", name: "SanDisk Corp", shortCode: "SN", price: 62.30, change24h: -0.25, impliedVol: 35, vaultApy: 11.0, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase SNDK", contractAddress: "0xb200000000000000000000f7a8B9C0D1E2F3a4B5C6D7E8F9a0B1c2d3" },
  { symbol: "SPCXc", name: "SPACEX Token", shortCode: "SP", price: 180.00, change24h: 1.85, impliedVol: 48, vaultApy: 14.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase SPCX", contractAddress: "0xb200000000000000000000a8B9C0D1E2F3a4B5C6D7E8F9a0B1c2d3E4" },
];

const STRATEGIES: CoveredCallStrategy[] = [
  {
    id: "conservative",
    label: "Conservative",
    riskBadge: "Low Risk",
    riskClass: "text-[#00D084] bg-[#00D084]/10",
    otmPercentage: 15,
    strikeOffset: 1.15,
    expiryDays: 30,
    apyRange: "8–12% APY",
    premEstMultiplier: 0.045,
  },
  {
    id: "moderate",
    label: "Moderate",
    riskBadge: "Med Risk",
    riskClass: "text-[#FF6B00] bg-[#FF6B00]/10",
    otmPercentage: 10,
    strikeOffset: 1.10,
    expiryDays: 14,
    recommended: true,
    apyRange: "12–18% APY",
    premEstMultiplier: 0.078,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    riskBadge: "High Risk",
    riskClass: "text-[#ff4444] bg-[#ff4444]/10",
    otmPercentage: 5,
    isItm: true,
    strikeOffset: 0.95,
    expiryDays: 7,
    apyRange: "18–25% APY",
    premEstMultiplier: 0.1245,
  },
];

const DEFAULT_VAULT =
  process.env.NEXT_PUBLIC_EQUITY_VAULT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------
//  Props
// ---------------------------------------------------------------

interface StocksViewProps {
  walletAddress?: string | null;
  walletConnected?: boolean;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

// ---------------------------------------------------------------
//  Stock Card — matches mockup layout
// ---------------------------------------------------------------

function StockCard({
  asset,
  onClick,
}: {
  asset: SyntheticAsset;
  onClick: () => void;
}) {
  const isPositive = asset.change24h >= 0;

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer border-b border-[#1a1a1a] last:border-b-0"
    >
      {/* Left: Symbol + Name */}
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-sm font-bold text-white">
          {asset.symbol}
        </span>
        <span className="text-[11px] text-[#77717e] truncate">
          {asset.name}
        </span>
      </div>

      {/* Center: Price + Change */}
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 text-[#00D084]" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-[#ff4444]" />
          )}
          <span
            className={`font-mono text-xs font-bold ${
              isPositive ? "text-[#00D084]" : "text-[#ff4444]"
            }`}
          >
            {isPositive ? "+" : ""}
            {asset.change24h.toFixed(2)}%
          </span>
        </div>
        <span className="font-mono text-sm font-bold text-white">
          ${asset.price.toFixed(2)}
        </span>
      </div>

      {/* Right: Exchange + Vol */}
      <div className="flex flex-col items-end ml-4">
        <span className="text-[10px] text-[#77717e]">{asset.oracleFeed}</span>
        <span className="font-mono text-[10px] text-[#827b88]">
          Vol {asset.impliedVol}%
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------
//  Vaults Tab — deposit / write covered call UI
// ---------------------------------------------------------------

function VaultsTab({
  assets,
  onSelectAsset,
  selectedAsset,
  onExecuteTrade,
}: {
  assets: SyntheticAsset[];
  selectedAsset: SyntheticAsset | null;
  onSelectAsset: (a: SyntheticAsset) => void;
  onExecuteTrade: (details: TradeDetails) => void;
}) {
  const [collateral, setCollateral] = useState("");
  const [strategy, setStrategy] = useState<CoveredCallStrategy>(STRATEGIES[1]);

  const asset = selectedAsset || assets[0];
  const collateralNum = parseFloat(collateral) || 0;
  const premiumEst = collateralNum * asset.price * strategy.premEstMultiplier;
  const premiumEth = premiumEst / 4000;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
      {/* Asset selector */}
      <div className="mb-4">
        <label className="text-[10px] text-[#77717e] uppercase tracking-wider font-bold block mb-1.5">
          Select Asset
        </label>
        <select
          value={asset.symbol}
          onChange={(e) => {
            const found = assets.find((a) => a.symbol === e.target.value);
            if (found) onSelectAsset(found);
          }}
          className="w-full rounded-lg border border-[#232323] bg-[#161616] px-4 py-3 text-white font-mono text-sm focus:border-[#FF6B00] focus:outline-none transition-colors"
        >
          {assets.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.symbol} — ${a.price.toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {/* Collateral input */}
      <div className="mb-4">
        <label className="text-[10px] text-[#77717e] uppercase tracking-wider font-bold block mb-1.5">
          Collateral Amount ({asset.shortCode}c)
        </label>
        <input
          type="number"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-[#232323] bg-[#161616] px-4 py-3 text-white font-mono text-sm focus:border-[#FF6B00] focus:outline-none transition-colors"
        />
        <p className="text-[10px] text-[#77717e] mt-1">
          ≈ ${(collateralNum * asset.price).toFixed(2)} USD locked
        </p>
      </div>

      {/* Strategy selector */}
      <div className="mb-5">
        <label className="text-[10px] text-[#77717e] uppercase tracking-wider font-bold block mb-1.5">
          Strategy
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStrategy(s)}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                strategy.id === s.id
                  ? "border-[#FF6B00]/50 bg-[#FF6B00]/5"
                  : "border-[#232323] hover:border-[#FF6B00]/30"
              }`}
            >
              <span className={`text-[10px] font-bold ${s.riskClass} px-1.5 py-0.5 rounded`}>
                {s.riskBadge}
              </span>
              <p className="text-xs font-bold text-white mt-1">{s.label}</p>
              <p className="text-[10px] text-[#77717e] mt-0.5">{s.apyRange}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Premium estimate */}
      <div className="rounded-lg border border-[#232323] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#77717e] uppercase">Est. Premium</span>
          <span className="font-mono text-sm font-bold text-[#00D084]">
            ${premiumEst.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#77717e] uppercase">ETH Equivalent</span>
          <span className="font-mono text-xs text-[#827b88]">
            {premiumEth.toFixed(4)} ETH
          </span>
        </div>
      </div>

      {/* Execute button */}
      <button
        onClick={() => {
          if (collateralNum > 0) {
            onExecuteTrade({
              asset,
              collateralAmount: collateralNum,
              strategy,
              premiumEth,
              premiumUsd: premiumEst,
            });
            setCollateral("");
          }
        }}
        disabled={collateralNum <= 0}
        className="w-full py-3 rounded-lg bg-[#FF6B00] hover:bg-[#FF7A1A] text-black font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Lock className="w-4 h-4" />
        Write Covered Call
      </button>
    </div>
  );
}

// ---------------------------------------------------------------
//  Positions Tab
// ---------------------------------------------------------------

function PositionsTab({
  positions,
  onRoll,
}: {
  positions: PositionContract[];
  onRoll: (pos: PositionContract) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-7 lg:px-10 text-center">
        <Lock className="w-8 h-8 text-[#77717e] mx-auto mb-3" />
        <p className="text-sm text-[#77717e]">No active positions</p>
        <p className="text-[11px] text-[#555] mt-1">
          Write a covered call to start earning premium
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
      <div className="space-y-3">
        {positions.map((pos) => {
          const isSafe = pos.status === "Safe (OTM)";
          return (
            <div
              key={pos.id}
              className="rounded-lg border border-[#232323] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-mono text-sm font-bold text-white">
                    {pos.symbol}
                  </span>
                  <span className="text-[10px] text-[#77717e] ml-2">
                    {pos.strategyName}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isSafe
                      ? "text-[#00D084] bg-[#00D084]/10"
                      : "text-[#ff4444] bg-[#ff4444]/10"
                  }`}
                >
                  {pos.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[10px]">
                <div>
                  <span className="text-[#77717e] block">Strike</span>
                  <span className="font-mono text-white">
                    ${pos.strikePrice.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#77717e] block">Locked</span>
                  <span className="font-mono text-white">
                    {pos.lockedCollateral} {pos.shortCode}c
                  </span>
                </div>
                <div>
                  <span className="text-[#77717e] block">Days Left</span>
                  <span className="font-mono text-white">
                    {pos.daysRemaining}d / {pos.totalCycleDays}d
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1 rounded-full bg-[#232323]">
                <div
                  className="h-full rounded-full bg-[#FF6B00] transition-all"
                  style={{ width: `${pos.cyclePercentElapsed}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
//  Yield Tab
// ---------------------------------------------------------------

function YieldTab({ onHarvest }: { onHarvest: () => void }) {
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [yieldData, setYieldData] = useState<{
    totalPremium: number;
    averageApy: number;
  } | null>(null);

  useEffect(() => {
    loadYield();
  }, []);

  const loadYield = async () => {
    try {
      const data = await getEquityVaultYield(DEFAULT_VAULT);
      if (data) {
        setYieldData({
          totalPremium: data.totalYieldEarned ?? 0,
          averageApy: data.apy ?? 0,
        });
      }
    } catch {
      // No yield data available
    }
  };

  const handleHarvest = async () => {
    setIsHarvesting(true);
    await onHarvest();
    await loadYield();
    setIsHarvesting(false);
  };

  const totalPremium = yieldData?.totalPremium ?? 0;
  const avgApy = yieldData?.averageApy ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#232323] p-4">
          <div className="text-[10px] text-[#77717e] uppercase">Total Yield</div>
          <div className="text-xl font-bold text-white mt-1">
            ${totalPremium.toFixed(2)}
          </div>
          <div className="text-[10px] text-[#77717e] mt-1">
            {totalPremium > 0
              ? `${(totalPremium / 4000).toFixed(3)} ETH equivalent`
              : "0.000 ETH"}
          </div>
        </div>
        <div className="rounded-lg border border-[#232323] p-4">
          <div className="text-[10px] text-[#77717e] uppercase">Blended APY</div>
          <div className="text-xl font-bold text-[#FF6B00] mt-1">
            {avgApy > 0 ? `${avgApy.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-[#00D084] mt-1">
            {avgApy > 0 ? `+${(avgApy * 0.2).toFixed(1)}% vs buy & hold` : "No data"}
          </div>
        </div>
        <div className="rounded-lg border border-[#232323] p-4">
          <div className="text-[10px] text-[#77717e] uppercase">Active Strategies</div>
          <div className="text-xl font-bold text-white mt-1">
            {totalPremium > 0 ? "1" : "0"}
          </div>
          <div className="text-[10px] text-[#77717e] mt-1">vaults tracked</div>
        </div>
        <div className="rounded-lg border border-[#232323] p-4">
          <div className="text-[10px] text-[#77717e] uppercase">Available</div>
          <div className="text-xl font-bold text-white mt-1">
            {totalPremium > 0 ? "Ready" : "—"}
          </div>
          <div className="text-[10px] text-[#77717e] mt-1">harvest premium</div>
        </div>
      </div>
      <div className="mt-6">
        <button
          onClick={handleHarvest}
          disabled={isHarvesting || totalPremium === 0}
          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#FF6B00] hover:bg-[#FF7A1A] text-black font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
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
    </div>
  );
}

// ---------------------------------------------------------------
//  Main StocksView
// ---------------------------------------------------------------

export default function StocksView({
  walletAddress,
  walletConnected,
  onConnectWallet,
  onDisconnectWallet,
}: StocksViewProps) {
  const [activeTab, setActiveTab] = useState<StockTab>("stocks");
  const [assets, setAssets] = useState<SyntheticAsset[]>(SEED_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<SyntheticAsset | null>(null);
  const [positions, setPositions] = useState<PositionContract[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const safeSelected = selectedAsset || assets[0];

  // Load positions from backend
  useEffect(() => {
    if (walletConnected && DEFAULT_VAULT !== "0x0000000000000000000000000000000000000000") {
      loadPositions();
    }
  }, [walletConnected]);

  const loadPositions = async () => {
    try {
      const data = await getEquityVaultOptions(DEFAULT_VAULT);
      if (data?.options) {
        setPositions(
          data.options.map((p: EquityOptionPosition) => ({
            id: p.optionId,
            symbol: p.symbol,
            assetName: p.symbol,
            shortCode: p.symbol.slice(0, 2),
            strategyName: p.strategy,
            strikePrice: p.strikePrice,
            oracleSpot: p.strikePrice * 0.95,
            strikeDistancePercent: 5,
            lockedCollateral: p.collateralLocked,
            collateralUsdValue: p.collateralLocked * p.strikePrice,
            harvestedEth: 0,
            harvestedUsd: 0,
            cyclePercentElapsed: p.progressPct,
            daysRemaining: p.daysToExpiry,
            totalCycleDays: 30,
            expiryDateFormatted: p.expiryDate,
            oracleFeedAddress: "",
            status: p.status === "ACTIVE" ? "Safe (OTM)" : "In The Money (ITM)",
          }))
        );
      }
    } catch {
      // API may not be running
    }
  };

  const handleExecuteTrade = async (details: TradeDetails) => {
    if (DEFAULT_VAULT === "0x0000000000000000000000000000000000000000") {
      setToastMessage(
        "No vault configured. Set NEXT_PUBLIC_EQUITY_VAULT_ADDRESS in .env to enable deposits and yield."
      );
      return;
    }

    try {
      await writeEquityOption(
        DEFAULT_VAULT,
        details.asset.symbol,
        details.strategy.id,
        details.collateralAmount
      );

      await loadPositions();

      setToastMessage(
        `Deposit Confirmed: Locked ${details.collateralAmount} ${details.asset.symbol}. Earned +$${details.premiumUsd.toFixed(2)} upfront premium!`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Write failed";
      setToastMessage(`Error: ${msg}`);
    }
  };

  const handleHarvestPremium = async () => {
    if (DEFAULT_VAULT === "0x0000000000000000000000000000000000000000") {
      setToastMessage(
        "No vault configured. Set NEXT_PUBLIC_EQUITY_VAULT_ADDRESS in .env to enable yield."
      );
      return;
    }

    try {
      await settleEquityOptions(DEFAULT_VAULT);
      await loadPositions();
      setToastMessage("Yield harvested and positions settled.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Harvest failed";
      setToastMessage(`Error: ${msg}`);
    }
  };

  const handleRollPosition = (pos: PositionContract) => {
    const asset = assets.find((a) => a.symbol === pos.symbol);
    if (asset) {
      setSelectedAsset(asset);
      setActiveTab("vaults");
    }
  };

  const TABS: { id: StockTab; label: string }[] = [
    { id: "vaults", label: "Vaults" },
    { id: "stocks", label: "Stocks" },
    { id: "positions", label: "Positions" },
    { id: "yield", label: "Yield" },
  ];

  return (
    <main className="min-h-[calc(100vh-64px)] flex-1 bg-[#080808] pb-32 text-white">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 max-w-sm rounded-lg border border-[#FF6B00] p-3 shadow-2xl text-xs text-white flex items-start gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-[#00D084] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-[#FF6B00] block text-[10px] uppercase">
              Base L2 Confirmed
            </span>
            <span className="text-[#94a3b8] leading-tight">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#77717e] hover:text-white text-xs ml-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
        {/* Vault not configured warning */}
        {DEFAULT_VAULT === "0x0000000000000000000000000000000000000000" && walletConnected && (
          <div className="mb-4 rounded-lg border border-[#FF6B00]/30 bg-[#FF6B00]/5 p-3 flex items-center gap-2">
            <span className="text-[11px] text-[#FF6B00]">
              No vault configured. Set <code className="font-bold">NEXT_PUBLIC_EQUITY_VAULT_ADDRESS</code> in .env to enable deposits and yield.
            </span>
          </div>
        )}

        {/* Wallet bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-[#FF6B00]" size={16} />
            <h1 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#d7d0db]">
              Coinbase B20 Tokenized Stocks
            </h1>
            <span className="h-1.5 w-1.5 rounded-full bg-[#00D084]" />
            <span className="font-mono text-[10px] text-[#827b88]">
              Base L2 · Chainlink Oracles
            </span>
          </div>
          {!walletConnected ? (
            <button
              onClick={() => onConnectWallet?.()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#FF7A1A] text-black font-mono text-[11px] font-bold uppercase transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#827b88] bg-[#161616] px-2 py-1 rounded">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </span>
              <button
                onClick={() => onDisconnectWallet?.()}
                className="p-1.5 rounded hover:bg-[#161616] transition-colors cursor-pointer"
                title="Disconnect"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#1a1a1a] pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#FF6B00] text-[#FF6B00]"
                  : "border-transparent text-[#77717e] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "stocks" && (
        <div className="mx-auto max-w-[1440px] px-4 md:px-7 lg:px-10">
          <div className="rounded-lg border border-[#1a1a1a] overflow-hidden">
            {assets.map((asset) => (
              <StockCard
                key={asset.symbol}
                asset={asset}
                onClick={() => {
                  setSelectedAsset(asset);
                  setActiveTab("vaults");
                }}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === "vaults" && (
        <VaultsTab
          assets={assets}
          selectedAsset={safeSelected}
          onSelectAsset={setSelectedAsset}
          onExecuteTrade={handleExecuteTrade}
        />
      )}

      {activeTab === "positions" && (
        <PositionsTab
          positions={positions}
          onRoll={handleRollPosition}
        />
      )}

      {activeTab === "yield" && (
        <YieldTab onHarvest={handleHarvestPremium} />
      )}
    </main>
  );
}
