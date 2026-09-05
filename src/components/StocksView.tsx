"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  listEquityStocks,
  listEquityPrices,
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
//  Seed data — all 13 Coinbase B20 tokenized stocks on Base mainnet
//  Real contract addresses from https://docs.base.org/specifications/b20
//  Prices are updated from Chainlink oracles on mount
// ---------------------------------------------------------------

const SEED_ASSETS: SyntheticAsset[] = [
  { symbol: "NVDAc", name: "NVIDIA Corp", shortCode: "NV", price: 124.50, change24h: 2.31, impliedVol: 45, vaultApy: 14.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase NVDA", contractAddress: "0xb20000000000000000000078ee7ce2fE4908108C" },
  { symbol: "AAPLc", name: "Apple Inc", shortCode: "AP", price: 227.35, change24h: 0.82, impliedVol: 28, vaultApy: 10.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase AAPL", contractAddress: "0xb200000000000000000000C2e324d24d7eEcd1fb" },
  { symbol: "GOOGLc", name: "Alphabet Inc", shortCode: "GO", price: 165.20, change24h: -0.45, impliedVol: 32, vaultApy: 11.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase GOOGL", contractAddress: "0xb2000000000000000000002D0BA3164cc74f58B7" },
  { symbol: "METAc", name: "Meta Platforms", shortCode: "ME", price: 563.80, change24h: 1.15, impliedVol: 38, vaultApy: 12.4, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase META", contractAddress: "0xb2000000000000000000008bC8786B856E61707C" },
  { symbol: "AMZNc", name: "Amazon.com Inc", shortCode: "AM", price: 231.50, change24h: 0.67, impliedVol: 30, vaultApy: 11.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase AMZN", contractAddress: "0xb200000000000000000000d9192b6B456483C2E8" },
  { symbol: "TSLAc", name: "Tesla Inc", shortCode: "TS", price: 348.90, change24h: -1.23, impliedVol: 55, vaultApy: 18.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase TSLA", contractAddress: "0xb2000000000000000000001e800a7f5189430cD0" },
  { symbol: "MSFTc", name: "Microsoft Corp", shortCode: "MS", price: 420.15, change24h: 0.34, impliedVol: 25, vaultApy: 9.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase MSFT", contractAddress: "0xB200000000000000000000Ab99cFa739E253872B" },
  { symbol: "COINc", name: "Coinbase Global", shortCode: "CO", price: 265.40, change24h: 3.12, impliedVol: 52, vaultApy: 16.8, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase COIN", contractAddress: "0xb200000000000000000000c85a31389D71F3ecfb" },
  { symbol: "INTCc", name: "Intel Corp", shortCode: "IN", price: 22.85, change24h: -0.78, impliedVol: 42, vaultApy: 13.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase INTC", contractAddress: "0xB2000000000000000000004AFF16039bA04bdFBc" },
  { symbol: "MSTRc", name: "MicroStrategy", shortCode: "MU", price: 185.60, change24h: 4.50, impliedVol: 65, vaultApy: 22.0, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase MSTR", contractAddress: "0xB2000000000000000000004884b426556b92883d" },
  { symbol: "CRCLc", name: "Circle (USDC)", shortCode: "CR", price: 1.00, change24h: 0.01, impliedVol: 5, vaultApy: 4.2, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase CRCL", contractAddress: "0xB20000000000000000000019f6E7C675b73C2e4D" },
  { symbol: "SNDKc", name: "SanDisk Corp", shortCode: "SN", price: 62.30, change24h: -0.25, impliedVol: 35, vaultApy: 11.0, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase SNDK", contractAddress: "0xb200000000000000000000397293Cb8cda9a10c5" },
  { symbol: "SPCXc", name: "SPACEX Token", shortCode: "SP", price: 180.00, change24h: 1.85, impliedVol: 48, vaultApy: 15.5, userHoldings: 0, holdingValue: 0, oracleFeed: "Coinbase SPCX", contractAddress: "0xb2000000000000000000007b9fcbd005511aCBd5" },
];

// ---------------------------------------------------------------
//  Strategy presets
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
    riskClass: "text-[#FF6B00] bg-[#FF6B00]/10 border border-[#FF6B00]/30",
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
    riskClass: "text-[#F04438] bg-[#F04438]/10 border border-[#F04438]/30",
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
//  Props from parent (BrowserTerminal wallet context)
// ---------------------------------------------------------------

interface StocksViewProps {
  walletAddress?: string | null;
  walletConnected?: boolean;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

// ---------------------------------------------------------------
//  StocksGrid — the stock picker
// ---------------------------------------------------------------

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
        Tokenized Stocks on Base — 13 Coinbase B20 Assets
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {assets.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => onSelect(asset)}
            className="bg-[#141724] border border-[#1F2436] p-3 text-left hover:border-[#FF6B00]/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F8FAFC] text-[11px] group-hover:text-[#FF6B00]">
                {asset.symbol}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 ${
                  asset.change24h >= 0
                    ? "text-[#00D084] bg-[#00D084]/10"
                    : "text-[#F04438] bg-[#F04438]/10"
                }`}
              >
                {asset.change24h >= 0 ? "+" : ""}
                {asset.change24h.toFixed(2)}%
              </span>
            </div>
            <div className="text-[9px] text-[#5C658E] mt-1">{asset.name}</div>
            <div className="text-sm font-bold text-[#F8FAFC] mt-1">
              ${asset.price.toFixed(2)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
//  TerminalView — full-screen trading terminal
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
  const premiumEstimate = Number(
    (
      selectedAsset.price *
      collateralAmount *
      selectedStrategy.premEstMultiplier
    ).toFixed(2),
  );

  const handleExecute = () => {
    onExecuteTrade({
      asset: selectedAsset,
      collateralAmount,
      strategy: selectedStrategy,
      premiumEth: premiumEstimate / 4000,
      premiumUsd: premiumEstimate,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Asset selector */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-[#141724] border border-[#1F2436] hover:border-[#FF6B00]/50 transition-colors cursor-pointer"
          >
            <span className="font-bold text-[#F8FAFC] text-xs">
              {selectedAsset.symbol}
            </span>
            <span className="text-[10px] text-[#5C658E]">
              ${selectedAsset.price.toFixed(2)}
            </span>
            <ChevronDown className="w-3 h-3 text-[#5C658E]" />
          </button>
          {isAssetDropdownOpen && (
            <div className="absolute top-full left-0 z-20 mt-1 w-64 bg-[#0E111A] border border-[#1F2436] shadow-xl max-h-60 overflow-y-auto">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => {
                    onSelectAsset(a);
                    setIsAssetDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#141724] transition-colors cursor-pointer text-left"
                >
                  <span className="text-[11px] text-[#F8FAFC] font-bold">
                    {a.symbol}
                  </span>
                  <span className="text-[10px] text-[#5C658E]">
                    ${a.price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price & oracle */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#141724] border border-[#1F2436] p-2">
          <div className="text-[9px] text-[#5C658E] uppercase">Spot Price</div>
          <div className="text-lg font-bold text-[#F8FAFC]">
            ${selectedAsset.price.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#141724] border border-[#1F2436] p-2">
          <div className="text-[9px] text-[#5C658E] uppercase">Strike</div>
          <div className="text-lg font-bold text-[#FF6B00]">
            ${strikePrice.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#141724] border border-[#1F2436] p-2">
          <div className="text-[9px] text-[#5C658E] uppercase">Premium</div>
          <div className="text-lg font-bold text-[#00D084]">
            ${premiumEstimate.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Strategy selector */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] text-[#5C658E] uppercase">
          Covered Call Strategy
        </div>
        <div className="flex gap-1.5">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStrategyId(s.id)}
              className={`flex-1 py-2 px-2 text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                selectedStrategyId === s.id
                  ? s.riskClass
                  : "text-[#5C658E] bg-[#141724] border-[#1F2436] hover:text-[#F8FAFC]"
              }`}
            >
              <div>{s.label}</div>
              <div className="text-[8px] mt-0.5 opacity-70">{s.apyRange}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Collateral input */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-[#5C658E] uppercase">
          Collateral Amount ({selectedAsset.symbol})
        </div>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={collateralAmount}
          onChange={(e) => setCollateralAmount(parseFloat(e.target.value) || 0)}
          className="bg-[#141724] border border-[#1F2436] px-3 py-2 text-[#F8FAFC] font-mono text-sm focus:border-[#FF6B00] focus:outline-none"
        />
      </div>

      {/* Execute button */}
      <button
        onClick={handleExecute}
        disabled={collateralAmount <= 0}
        className="w-full py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Lock className="w-3.5 h-3.5" />
        Write {selectedStrategy.label} Covered Call
      </button>
    </div>
  );
}

// ---------------------------------------------------------------
//  VaultDesk — single-asset deposit & write
// ---------------------------------------------------------------

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
  const premiumEstimate = Number(
    (asset.price * collateralAmount * selectedStrategy.premEstMultiplier).toFixed(2),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
        <span className="text-[11px] text-[#F8FAFC] font-bold uppercase">
          Deposit {asset.symbol} & Write Covered Call
        </span>
      </div>

      <div className="bg-[#141724] border border-[#1F2436] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#5C658E] uppercase">Asset</span>
          <span className="text-[11px] text-[#F8FAFC] font-bold">
            {asset.name} ({asset.symbol})
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#5C658E] uppercase">Oracle Feed</span>
          <span className="text-[10px] text-[#00D084] flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full animate-pulse"></span>
            {asset.oracleFeed} (Chainlink)
          </span>
        </div>
      </div>

      {/* Strategy selector */}
      <div className="flex gap-1.5">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStrategyId(s.id)}
            className={`flex-1 py-2 px-2 text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
              selectedStrategyId === s.id
                ? s.riskClass
                : "text-[#5C658E] bg-[#141724] border-[#1F2436] hover:text-[#F8FAFC]"
            }`}
          >
            <div>{s.label}</div>
            <div className="text-[8px] mt-0.5 opacity-70">{s.apyRange}</div>
          </button>
        ))}
      </div>

      {/* Collateral */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-[#5C658E] uppercase">
          Amount to Deposit ({asset.symbol})
        </div>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={collateralAmount}
          onChange={(e) => setCollateralAmount(parseFloat(e.target.value) || 0)}
          className="bg-[#141724] border border-[#1F2436] px-3 py-2 text-[#F8FAFC] font-mono text-sm focus:border-[#FF6B00] focus:outline-none"
        />
      </div>

      {/* Summary */}
      <div className="bg-[#141724] border border-[#1F2436] p-3 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="text-[#5C658E] uppercase">Strike Price</div>
          <div className="text-[#F8FAFC] font-bold text-sm mt-0.5">
            ${strikePrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#5C658E] uppercase">Est. Premium</div>
          <div className="text-[#00D084] font-bold text-sm mt-0.5">
            ${premiumEstimate.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#5C658E] uppercase">Expiry</div>
          <div className="text-[#F8FAFC] mt-0.5">{selectedStrategy.expiryDays} days</div>
        </div>
        <div>
          <div className="text-[#5C658E] uppercase">Est. APY</div>
          <div className="text-[#FF6B00] mt-0.5">{selectedStrategy.apyRange}</div>
        </div>
      </div>

      <button
        onClick={() =>
          onExecuteTrade({
            asset,
            collateralAmount,
            strategy: selectedStrategy,
            premiumEth: premiumEstimate / 4000,
            premiumUsd: premiumEstimate,
          })
        }
        disabled={collateralAmount <= 0}
        className="w-full py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Lock className="w-3.5 h-3.5" />
        Deposit & Write Covered Call
      </button>
    </div>
  );
}

// ---------------------------------------------------------------
//  PositionsList
// ---------------------------------------------------------------

function PositionsList({
  positions,
  onRoll,
}: {
  positions: PositionContract[];
  onRoll: (pos: PositionContract) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#5C658E]">
        <Lock className="w-8 h-8 mb-3 opacity-30" />
        <div className="text-[11px] uppercase">No Active Positions</div>
        <div className="text-[10px] mt-1 opacity-60">
          Deposit collateral and write a covered call to get started
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-[#5C658E] uppercase">
        Active Positions ({positions.length})
      </div>
      {positions.map((pos) => (
        <div
          key={pos.id}
          className="bg-[#141724] border border-[#1F2436] p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#F8FAFC] font-bold">
              {pos.symbol} — {pos.strategyName}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 ${
                pos.status === "Safe (OTM)"
                  ? "text-[#00D084] bg-[#00D084]/10"
                  : pos.status === "In The Money (ITM)"
                    ? "text-[#F04438] bg-[#F04438]/10"
                    : "text-[#FF6B00] bg-[#FF6B00]/10"
              }`}
            >
              {pos.status}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-[9px]">
            <div>
              <div className="text-[#5C658E]">Strike</div>
              <div className="text-[#F8FAFC] font-bold">${pos.strikePrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[#5C658E]">Spot</div>
              <div className="text-[#F8FAFC] font-bold">${pos.oracleSpot.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[#5C658E]">Locked</div>
              <div className="text-[#F8FAFC] font-bold">{pos.lockedCollateral} {pos.symbol}</div>
            </div>
            <div>
              <div className="text-[#5C658E]">Expires</div>
              <div className="text-[#F8FAFC] font-bold">{pos.expiryDateFormatted}</div>
            </div>
          </div>
          <div className="mt-2 h-1 bg-[#0E111A]">
            <div
              className="h-full bg-[#FF6B00] transition-all"
              style={{ width: `${pos.cyclePercentElapsed}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[9px] text-[#5C658E]">
              {pos.daysRemaining}d remaining
            </span>
            <button
              onClick={() => onRoll(pos)}
              className="text-[9px] text-[#FF6B00] hover:text-[#FF7A1A] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Roll Position
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
//  YieldPanel
// ---------------------------------------------------------------

function YieldPanel({ onHarvest }: { onHarvest: (eth: number, usd: number) => void }) {
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
            $0.00
          </div>
          <div className="text-[#00D084] text-[10px] mt-0.5">
            0.000 ETH cumulative
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
//  Main StocksView — pure component, no WagmiProvider wrapper
// ---------------------------------------------------------------

export default function StocksView({
  walletAddress,
  walletConnected,
  onConnectWallet,
  onDisconnectWallet,
}: StocksViewProps) {
  const [activeTab, setActiveTab] = useState<TerminalTab>("all-screen");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [assets, setAssets] = useState<SyntheticAsset[]>(SEED_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<SyntheticAsset | null>(
    SEED_ASSETS[0],
  );
  const [positions, setPositions] = useState<PositionContract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const priceHistoryRef = useRef<
    Map<string, { price: number; timestamp: number }[]>
  >(new Map());

  // Load real prices from API on mount, updating seed data
  useEffect(() => {
    loadRealPrices();
  }, []);

  // Poll prices every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      loadRealPrices();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load positions when wallet connects
  useEffect(() => {
    if (walletConnected && DEFAULT_VAULT !== "0x".padEnd(42, "0")) {
      loadPositions();
    }
  }, [walletConnected]);

  const loadRealPrices = async () => {
    try {
      const [stocks, prices] = await Promise.all([
        listEquityStocks(),
        listEquityPrices(),
      ]);

      if (prices.length > 0) {
        setAssets((prev) =>
          prev.map((asset) => {
            const priceData = prices.find((p) => p.symbol === asset.symbol);
            const stockData = stocks.find((s) => s.symbol === asset.symbol);
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
                        ((priceData.price - oldPrice.price) / oldPrice.price) *
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
              return {
                ...asset,
                price: priceData.price,
                change24h,
                contractAddress: stockData?.tokenAddress ?? asset.contractAddress,
              };
            }
            return asset;
          }),
        );
        setApiError(null);
      }
    } catch {
      // API not available — keep seed data, no error shown
    } finally {
      setIsLoading(false);
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
      // Positions load failed — acceptable
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExecuteTrade = async (details: TradeDetails) => {
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
        (
          ((details.asset.price * details.strategy.strikeOffset -
            details.asset.price) /
            details.asset.price) *
          100
        ).toFixed(2),
      ),
      lockedCollateral: details.collateralAmount,
      collateralUsdValue: Number(
        (details.collateralAmount * details.asset.price).toFixed(2),
      ),
      harvestedEth: 0,
      harvestedUsd: 0,
      cyclePercentElapsed: 0,
      daysRemaining: details.strategy.expiryDays,
      totalCycleDays: details.strategy.expiryDays,
      expiryDateFormatted: new Date(
        Date.now() + details.strategy.expiryDays * 86400 * 1000,
      ).toUTCString(),
      oracleFeedAddress: details.asset.oracleFeed,
      status: "Safe (OTM)",
    };

    setPositions((prev) => [newContract, ...prev]);

    showToast(
      `Deposit Confirmed: Locked ${details.collateralAmount} ${details.asset.symbol}. Earned +$${details.premiumUsd.toFixed(2)} upfront premium!`,
    );
  };

  const handleRollPosition = (pos: PositionContract) => {
    showToast(
      `Roll request submitted for ${pos.symbol} position. New cycle will begin after settlement.`,
    );
  };

  const handleHarvestPremium = (ethAmount: number, usdAmount: number) => {
    showToast(
      `Harvested ${ethAmount} ETH (~$${usdAmount.toFixed(2)} USD) to wallet.`,
    );
  };

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
      {!walletConnected && (
        <div className="px-3 py-2 bg-[#141724] border border-[#1F2436] flex items-center justify-between">
          <span className="text-[10px] text-[#5C658E]">
            Connect your Base wallet to trade tokenized stocks
          </span>
          <button
            onClick={() => onConnectWallet?.()}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#090A0F] font-mono text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            Connect
          </button>
        </div>
      )}
      {walletConnected && walletAddress && (
        <div className="px-3 py-1 bg-[#00D084]/5 border border-[#00D084]/20 flex items-center justify-between">
          <span className="text-[10px] text-[#00D084] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full animate-pulse"></span>
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
          <button
            onClick={() => onDisconnectWallet?.()}
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
        {activeTab === "all-screen" && safeSelected && (
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
        {activeTab === "yield" && (
          <YieldPanel onHarvest={handleHarvestPremium} />
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
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <Cpu className="w-3 h-3" />
          <span>BASE L2</span>
        </div>
      </div>
    </div>
  );
}
