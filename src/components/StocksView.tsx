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
  BarChart3,
  Zap,
  ChevronRight,
  Minus,
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
//  Featured Stock Card — hero section
// ---------------------------------------------------------------

function FeaturedStockCard({
  asset,
  onClick,
  large,
}: {
  asset: SyntheticAsset;
  onClick: () => void;
  large?: boolean;
}) {
  const isPositive = asset.change24h >= 0;
  const ticker = asset.symbol.replace("c", "");

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded border border-[#1e1e1e] bg-[#0e0e0e] text-left transition-all hover:border-[#FF6B00]/30 cursor-pointer ${
        large ? "min-h-[14rem] p-6" : "min-h-[11rem] p-4"
      }`}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B00]/[0.03] via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <span className={`font-mono font-bold text-white ${large ? "text-2xl" : "text-lg"}`}>
              {ticker}
            </span>
            <span className="ml-2 text-[11px] text-[#77717e]">{asset.name}</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded border border-[#262626] bg-[#141414] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#827b88]">
            <BarChart3 size={9} />
            Vol {asset.impliedVol}%
          </span>
        </div>

        {/* Bottom row */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#77717e]">
              {asset.oracleFeed}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`font-mono font-bold ${large ? "text-3xl" : "text-2xl"} text-white`}>
                ${asset.price.toFixed(2)}
              </span>
              <span className={`flex items-center gap-0.5 font-mono text-sm font-bold ${
                isPositive ? "text-[#00D084]" : "text-[#ff4444]"
              }`}>
                {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {isPositive ? "+" : ""}{asset.change24h.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded bg-[#FF6B00]/10 px-3 py-1.5 text-[#FF6B00] transition-colors group-hover:bg-[#FF6B00]/20">
            <Zap size={12} />
            <span className="font-mono text-[10px] font-bold uppercase">
              {asset.vaultApy.toFixed(1)}% APY
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------
//  Stock List Row
// ---------------------------------------------------------------

function StockRow({
  asset,
  onClick,
  index,
}: {
  asset: SyntheticAsset;
  onClick: () => void;
  index: number;
}) {
  const isPositive = asset.change24h >= 0;
  const ticker = asset.symbol.replace("c", "");

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 border-b border-[#141414] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.02] cursor-pointer"
    >
      {/* Rank */}
      <span className="w-5 shrink-0 text-center font-mono text-[10px] text-[#555]">
        {index + 1}
      </span>

      {/* Ticker badge */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#222] bg-[#111] font-mono text-[10px] font-bold text-white">
        {ticker}
      </span>

      {/* Name + Exchange */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white group-hover:text-[#FF6B00]">
          {asset.name}
        </span>
        <span className="text-[10px] text-[#77717e]">{asset.oracleFeed}</span>
      </div>

      {/* Price + Change */}
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-sm font-bold text-white">
          ${asset.price.toFixed(2)}
        </span>
        <span className={`flex items-center gap-0.5 font-mono text-[11px] font-bold ${
          isPositive ? "text-[#00D084]" : "text-[#ff4444]"
        }`}>
          {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {isPositive ? "+" : ""}{asset.change24h.toFixed(2)}%
        </span>
      </div>

      {/* Vol */}
      <div className="hidden shrink-0 flex-col items-end sm:flex">
        <span className="text-[10px] text-[#77717e]">Vol</span>
        <span className="font-mono text-[11px] font-bold text-[#827b88]">
          {asset.impliedVol}%
        </span>
      </div>

      {/* APY */}
      <div className="hidden shrink-0 flex-col items-end md:flex">
        <span className="text-[10px] text-[#77717e]">APY</span>
        <span className="font-mono text-[11px] font-bold text-[#FF6B00]">
          {asset.vaultApy.toFixed(1)}%
        </span>
      </div>

      {/* Arrow */}
      <ChevronRight size={14} className="shrink-0 text-[#333] transition-colors group-hover:text-[#FF6B00]" />
    </button>
  );
}

// ---------------------------------------------------------------
//  Vaults Tab
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
  const isPositive = asset.change24h >= 0;
  const ticker = asset.symbol.replace("c", "");

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-7 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Asset overview */}
        <div>
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded border border-[#222] bg-[#111] font-mono text-sm font-bold text-white">
              {ticker}
            </span>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-white">
                  ${asset.price.toFixed(2)}
                </span>
                <span className={`flex items-center gap-0.5 font-mono text-sm font-bold ${
                  isPositive ? "text-[#00D084]" : "text-[#ff4444]"
                }`}>
                  {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {isPositive ? "+" : ""}{asset.change24h.toFixed(2)}%
                </span>
              </div>
              <span className="text-xs text-[#77717e]">{asset.name} · {asset.oracleFeed}</span>
            </div>
          </div>

          {/* Strategy cards */}
          <div className="mb-5">
            <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
              Strategy
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s)}
                  className={`rounded border p-3 text-left transition-all cursor-pointer ${
                    strategy.id === s.id
                      ? "border-[#FF6B00]/40 bg-[#FF6B00]/5"
                      : "border-[#1e1e1e] hover:border-[#333]"
                  }`}
                >
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${s.riskClass}`}>
                    {s.riskBadge}
                  </span>
                  <p className="mt-1.5 text-xs font-bold text-white">{s.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#77717e]">{s.apyRange}</p>
                  {s.recommended && (
                    <span className="mt-1.5 inline-block rounded bg-[#FF6B00]/10 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#FF6B00]">
                      RECOMMENDED
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Collateral input */}
          <div className="mb-5">
            <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
              Collateral ({asset.shortCode}c)
            </label>
            <div className="relative">
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-[#1e1e1e] bg-[#0e0e0e] px-4 py-3 font-mono text-lg text-white placeholder-[#333] focus:border-[#FF6B00]/50 focus:outline-none transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#77717e]">
                ≈ ${(collateralNum * asset.price).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Execute */}
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
            className="w-full rounded bg-[#FF6B00] py-3.5 font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#FF7A1A] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            Write Covered Call
          </button>
        </div>

        {/* Right: Premium summary */}
        <div className="flex flex-col gap-4">
          <div className="rounded border border-[#1e1e1e] bg-[#0e0e0e] p-5">
            <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
              Premium Estimate
            </h3>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-[#00D084]">
                ${premiumEst.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] uppercase text-[#77717e]">ETH Equivalent</span>
                <span className="font-mono text-sm font-bold text-white">
                  {premiumEth.toFixed(4)} ETH
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#77717e]">Lock Period</span>
                <span className="font-mono text-sm font-bold text-white">
                  {strategy.expiryDays} days
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#77717e]">Strike Offset</span>
                <span className="font-mono text-sm font-bold text-white">
                  {strategy.otmPercentage}% OTM
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#77717e]">Est. APY</span>
                <span className="font-mono text-sm font-bold text-[#FF6B00]">
                  {strategy.apyRange}
                </span>
              </div>
            </div>
          </div>

          {/* Asset selector */}
          <div className="rounded border border-[#1e1e1e] bg-[#0e0e0e] p-5">
            <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
              Select Asset
            </h3>
            <div className="max-h-[300px] overflow-y-auto">
              {assets.map((a) => {
                const isActive = a.symbol === asset.symbol;
                const aPositive = a.change24h >= 0;
                return (
                  <button
                    key={a.symbol}
                    onClick={() => onSelectAsset(a)}
                    className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors cursor-pointer ${
                      isActive ? "bg-[#FF6B00]/10" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#222] bg-[#111] font-mono text-[9px] font-bold text-white">
                      {a.symbol.replace("c", "")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-white">
                      {a.name}
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${
                      aPositive ? "text-[#00D084]" : "text-[#ff4444]"
                    }`}>
                      {aPositive ? "+" : ""}{a.change24h.toFixed(2)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
      <div className="mx-auto max-w-[1440px] px-4 py-20 md:px-7 lg:px-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded border border-[#222] bg-[#111]">
          <Lock className="w-7 h-7 text-[#555]" />
        </div>
        <p className="text-sm font-semibold text-white">No active positions</p>
        <p className="mt-1 text-xs text-[#77717e]">
          Write a covered call from the Vaults tab to start earning premium
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-7 lg:px-10">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
          {positions.length} Active Position{positions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {positions.map((pos) => {
          const isSafe = pos.status === "Safe (OTM)";
          return (
            <div
              key={pos.id}
              className="group flex items-center gap-4 rounded border border-[#1e1e1e] bg-[#0e0e0e] p-4 transition-colors hover:border-[#333]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#222] bg-[#111] font-mono text-xs font-bold text-white">
                {pos.symbol.replace("c", "")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">{pos.symbol}</span>
                  <span className="text-[10px] text-[#77717e]">{pos.strategyName}</span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    isSafe
                      ? "bg-[#00D084]/10 text-[#00D084]"
                      : "bg-[#ff4444]/10 text-[#ff4444]"
                  }`}>
                    {pos.status}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-[#1a1a1a]">
                  <div
                    className="h-full rounded-full bg-[#FF6B00] transition-all"
                    style={{ width: `${pos.cyclePercentElapsed}%` }}
                  />
                </div>
                <div className="mt-1.5 flex gap-4 text-[10px] text-[#77717e]">
                  <span>Strike ${pos.strikePrice.toFixed(2)}</span>
                  <span>{pos.lockedCollateral} locked</span>
                  <span>{pos.daysRemaining}d left</span>
                </div>
              </div>
              <button
                onClick={() => onRoll(pos)}
                className="shrink-0 rounded border border-[#262626] px-3 py-1.5 text-[10px] font-bold text-[#77717e] transition-colors hover:border-[#FF6B00]/40 hover:text-[#FF6B00] cursor-pointer"
              >
                Roll
              </button>
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
    } catch {}
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
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-7 lg:px-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Yield", value: `$${totalPremium.toFixed(2)}`, sub: totalPremium > 0 ? `${(totalPremium / 4000).toFixed(3)} ETH` : "0.000 ETH" },
          { label: "Blended APY", value: avgApy > 0 ? `${avgApy.toFixed(1)}%` : "—", sub: avgApy > 0 ? `+${(avgApy * 0.2).toFixed(1)}% vs hold` : "No data", accent: true },
          { label: "Active Strategies", value: totalPremium > 0 ? "1" : "0", sub: "vaults tracked" },
          { label: "Available", value: totalPremium > 0 ? "Ready" : "—", sub: "harvest premium" },
        ].map((item) => (
          <div key={item.label} className="rounded border border-[#1e1e1e] bg-[#0e0e0e] p-5">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
              {item.label}
            </span>
            <span className={`mt-2 block font-mono text-2xl font-bold ${
              item.accent ? "text-[#FF6B00]" : "text-white"
            }`}>
              {item.value}
            </span>
            <span className="mt-1 block text-[10px] text-[#77717e]">{item.sub}</span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button
          onClick={handleHarvest}
          disabled={isHarvesting || totalPremium === 0}
          className="rounded bg-[#FF6B00] px-6 py-3 font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#FF7A1A] cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isHarvesting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Bolt className="w-4 h-4" />
          )}
          {isHarvesting ? "Transferring..." : "Harvest Premium"}
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
  const [assets] = useState<SyntheticAsset[]>(SEED_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<SyntheticAsset | null>(null);
  const [positions, setPositions] = useState<PositionContract[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const safeSelected = selectedAsset || assets[0];

  useEffect(() => {
    if (walletConnected && DEFAULT_VAULT !== "0x".padEnd(42, "0")) {
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
    } catch {}
  };

  const handleExecuteTrade = async (details: TradeDetails) => {
    if (DEFAULT_VAULT === "0x".padEnd(42, "0")) {
      setToastMessage("No vault configured. Set NEXT_PUBLIC_EQUITY_VAULT_ADDRESS in .env.");
      return;
    }
    try {
      await writeEquityOption(DEFAULT_VAULT, details.asset.symbol, details.strategy.id, details.collateralAmount);
      await loadPositions();
      setToastMessage(`Locked ${details.collateralAmount} ${details.asset.symbol}. +$${details.premiumUsd.toFixed(2)} premium earned.`);
    } catch (err) {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Write failed"}`);
    }
  };

  const handleHarvestPremium = async () => {
    if (DEFAULT_VAULT === "0x".padEnd(42, "0")) {
      setToastMessage("No vault configured.");
      return;
    }
    try {
      await settleEquityOptions(DEFAULT_VAULT);
      await loadPositions();
      setToastMessage("Yield harvested and positions settled.");
    } catch (err) {
      setToastMessage(`Error: ${err instanceof Error ? err.message : "Harvest failed"}`);
    }
  };

  const handleRollPosition = (pos: PositionContract) => {
    const asset = assets.find((a) => a.symbol === pos.symbol);
    if (asset) {
      setSelectedAsset(asset);
      setActiveTab("vaults");
    }
  };

  // Sorted lists
  const topGainers = [...assets].sort((a, b) => b.change24h - a.change24h).slice(0, 3);
  const topLosers = [...assets].sort((a, b) => a.change24h - b.change24h).slice(0, 3);

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
        <div className="fixed top-14 right-4 z-50 max-w-sm rounded border border-[#FF6B00] bg-[#0e0e0e] p-3 shadow-2xl text-xs text-white flex items-start gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-[#00D084] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-[#FF6B00] block text-[10px] uppercase">
              Base L2 Confirmed
            </span>
            <span className="text-[#94a3b8] leading-tight">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-[#77717e] hover:text-white text-xs ml-1">
            ✕
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
        {/* Vault warning */}
        {DEFAULT_VAULT === "0x".padEnd(42, "0") && walletConnected && (
          <div className="mb-4 rounded border border-[#FF6B00]/20 bg-[#FF6B00]/5 p-3">
            <span className="text-[11px] text-[#FF6B00]">
              No vault configured. Set <code className="font-bold">NEXT_PUBLIC_EQUITY_VAULT_ADDRESS</code> in .env.
            </span>
          </div>
        )}

        {/* Header */}
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
              className="flex items-center gap-1.5 rounded bg-[#FF6B00] px-4 py-2 font-mono text-[11px] font-bold uppercase text-black transition-colors hover:bg-[#FF7A1A] cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#161616] px-2 py-1 font-mono text-[10px] text-[#827b88]">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </span>
              <button onClick={() => onDisconnectWallet?.()} className="rounded p-1.5 text-[#77717e] hover:bg-[#161616] hover:text-white transition-colors cursor-pointer">
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#1a1a1a]">
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
          {/* Featured: Top Gainers */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D084]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
                Top Gainers
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topGainers.map((asset) => (
                <FeaturedStockCard
                  key={asset.symbol}
                  asset={asset}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setActiveTab("vaults");
                  }}
                />
              ))}
            </div>
          </section>

          {/* All Stocks */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#77717e]">
                All Stocks
              </span>
              <span className="font-mono text-[10px] text-[#555]">{assets.length} assets</span>
            </div>
            <div className="overflow-hidden rounded border border-[#1e1e1e]">
              {/* Header row */}
              <div className="flex items-center gap-4 border-b border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2.5">
                <span className="w-5 text-center font-mono text-[9px] font-bold uppercase text-[#555]">#</span>
                <span className="w-9" />
                <span className="flex-1 font-mono text-[9px] font-bold uppercase text-[#555]">Asset</span>
                <span className="text-right font-mono text-[9px] font-bold uppercase text-[#555]">Price</span>
                <span className="hidden w-12 text-right font-mono text-[9px] font-bold uppercase text-[#555] sm:block">Vol</span>
                <span className="hidden w-12 text-right font-mono text-[9px] font-bold uppercase text-[#555] md:block">APY</span>
                <span className="w-4" />
              </div>
              {assets.map((asset, i) => (
                <StockRow
                  key={asset.symbol}
                  asset={asset}
                  index={i}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setActiveTab("vaults");
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "vaults" && (
        <VaultsTab assets={assets} selectedAsset={safeSelected} onSelectAsset={setSelectedAsset} onExecuteTrade={handleExecuteTrade} />
      )}

      {activeTab === "positions" && (
        <PositionsTab positions={positions} onRoll={handleRollPosition} />
      )}

      {activeTab === "yield" && (
        <YieldTab onHarvest={handleHarvestPremium} />
      )}
    </main>
  );
}
