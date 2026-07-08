import React, { useState } from "react";
import { PredictionMarket } from "../types";
import {
  ShieldCheck,
  ArrowRight,
  Coins,
  Gauge,
  Sparkles,
  BookOpen,
  HelpCircle,
  MessageCircle,
  UsersRound,
} from "lucide-react";

interface LandingViewProps {
  activeMarket: PredictionMarket;
  marketCount: number;
  maxLeverage: number;
  onLaunchTerminal: () => void;
  onExploreVaults: () => void;
  onOpenPulse: () => void;
  socialCount: number;
  walletConnected: boolean;
}

export default function LandingView({
  activeMarket,
  marketCount,
  maxLeverage,
  onLaunchTerminal,
  onExploreVaults,
  onOpenPulse,
  socialCount,
  walletConnected,
}: LandingViewProps) {
  // Simulator states
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [leverage, setLeverage] = useState<number>(5);
  const [collateral, setCollateral] = useState<number>(1000);

  const optionYesPrice = Math.max(0.01, activeMarket.currentOdds / 100 || 0.01);
  const optionNoPrice = Math.max(0.01, 1 - optionYesPrice);

  const currentPrice = outcome === "YES" ? optionYesPrice : optionNoPrice;
  const borrowCapital = collateral * (leverage - 1);
  const totalTradingPower = collateral * leverage;
  const contractShares = Math.floor(totalTradingPower / currentPrice);

  // Potential multiplier
  const payoutPotential = contractShares * 1.0; // each share is worth $1 upon resolution
  const totalReturnOnCollateral =
    ((payoutPotential - borrowCapital - collateral) / collateral) * 100;

  return (
    <main className="flex-1 px-4 pb-28 pt-28 md:px-10 md:pb-36 md:pt-32 max-w-[1280px] mx-auto w-full bg-grid-tech">
      {/* 1. HERO SECTION */}
      <section className="relative z-10 mb-24 md:mb-32">
        {/* Decorative ambient radial lights */}
        <div className="absolute top-[-50px] left-[15%] w-72 h-72 bg-electric-purple/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[20px] right-[10%] w-80 h-80 bg-deep-orange/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-deep-orange/10 border border-deep-orange/20 rounded-full text-xs font-mono font-bold text-deep-orange mb-8 uppercase tracking-wider">
            <Sparkles size={12} className="animate-pulse" />
            <span>Prediction markets, sorted for your interests</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-6xl font-sans font-extrabold tracking-tight text-white mb-8 leading-tight">
            Find Markets.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-deep-orange to-[#a78bfa]">
              Trade With Margin
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-sm md:text-base text-[#ccc3d8] leading-relaxed mb-12 max-w-2xl mx-auto font-sans">
            Discover live event markets and back your strongest calls with margin powered by vault
            liquidity.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5">
            <button
              onClick={onLaunchTerminal}
              className="w-full sm:w-auto bg-deep-orange text-black font-sans font-extrabold text-xs tracking-widest uppercase px-9 py-4 rounded hover:bg-white transition-all duration-200 shadow-lg shadow-deep-orange/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Find Markets</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={onExploreVaults}
              className="w-full sm:w-auto border border-[#ccc3d8]/40 text-[#ccc3d8] hover:text-white hover:border-white hover:bg-white/5 font-sans font-bold text-xs tracking-widest uppercase px-9 py-4 rounded transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Coins size={14} />
              <span>Earn Yield</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mb-20 md:mb-28">
        <button
          className="group grid w-full cursor-pointer gap-6 rounded-xl border border-[#262626] bg-surface-card/90 p-5 text-left transition-all hover:border-deep-orange/70 hover:bg-[#1f1b18] md:grid-cols-[1.2fr_0.8fr] md:p-8"
          onClick={onOpenPulse}
          type="button"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-deep-orange/30 bg-deep-orange/10 text-deep-orange transition-colors group-hover:bg-deep-orange group-hover:text-black">
              <MessageCircle size={20} />
            </span>
            <div>
              <p className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-deep-orange">
                Market Pulse
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                Talk markets before the price moves.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
                Follow traders, post calls, join market rooms, and turn event news into a live
                conviction feed.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
            <PulseStat label="Posts" value={socialCount.toLocaleString()} />
            <PulseStat label="Traders" value="Live" icon={<UsersRound size={14} />} />
            <span className="inline-flex min-h-14 items-center justify-between rounded border border-deep-orange/30 bg-deep-orange px-4 font-mono text-[10px] font-extrabold uppercase tracking-widest text-black transition-colors group-hover:bg-white">
              Open Pulse
              <ArrowRight size={14} />
            </span>
          </div>
        </button>
      </section>

      {/* 2. REAL-TIME INTERACTIVE LEVERAGE SIMULATOR */}
      <section className="mb-24 md:mb-28">
        <div className="text-center mb-12 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-sans font-bold text-white mb-4">
            Preview Margin Mechanics
          </h2>
          <p className="mx-auto max-w-xl text-sm text-[#ccc3d8]/80">
            Estimate how collateral, borrowed vault liquidity, and YES/NO prices shape a margin
            request.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-stretch">
          {/* SIMULATOR CONTROLS (cols 5) */}
          <div className="lg:col-span-5 bg-surface-card border border-[#262626] rounded-xl p-6 md:p-8 flex flex-col justify-between glow-orange relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-deep-orange/5 rounded-full blur-xl pointer-events-none" />

            <div>
              {/* Target market info */}
              <div className="mb-6">
                <span className="font-mono text-[9px] text-deep-orange uppercase tracking-wider font-extrabold px-2 py-0.5 bg-deep-orange/10 rounded">
                  CURRENT EVENT MARKET
                </span>
                <h3 className="text-md font-bold text-white mt-2 leading-snug">
                  {activeMarket.title}
                </h3>
              </div>

              {/* Set Outcome Selection */}
              <div className="mb-6">
                <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-extrabold mb-2">
                  Pick Outcome
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOutcome("YES")}
                    className={`p-3 rounded text-center transition-all cursor-pointer font-sans font-bold text-xs ${
                      outcome === "YES"
                        ? "bg-deep-orange text-black border-none"
                        : "bg-[#0e0e0e] text-[#ccc3d8] border border-[#262626] hover:border-white/30"
                    }`}
                  >
                    YES ({(optionYesPrice * 100).toFixed(0)}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("NO")}
                    className={`p-3 rounded text-center transition-all cursor-pointer font-sans font-bold text-xs ${
                      outcome === "NO"
                        ? "bg-[#EF4444] text-white border-none"
                        : "bg-[#0e0e0e] text-[#ccc3d8] border border-[#262626] hover:border-white/30"
                    }`}
                  >
                    NO ({(optionNoPrice * 100).toFixed(0)}%)
                  </button>
                </div>
              </div>

              {/* Set Collateral Input */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-extrabold">
                    Your Collateral (USDC)
                  </label>
                  <span className="font-mono text-[10px] text-[#ccc3d8]">
                    Available: {walletConnected ? "Connect balance adapter" : "Not signed in"}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="100"
                    min="100"
                    max="10000"
                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-base text-right focus:outline-none focus:border-deep-orange"
                    value={collateral}
                    onChange={(e) => setCollateral(Math.max(100, parseFloat(e.target.value) || 0))}
                  />
                  <span className="absolute left-3 top-3 text-xs font-mono font-bold text-[#ccc3d8] italic">
                    USDC
                  </span>
                </div>
              </div>

              {/* Set Leverage Drag slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-extrabold">
                    Leverage
                  </label>
                  <span className="font-mono text-sm font-bold text-deep-orange bg-deep-orange/10 px-2 py-0.5 rounded leading-none">
                    {Math.min(leverage, maxLeverage)}x Leverage
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={maxLeverage}
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full accent-deep-orange cursor-pointer bg-[#262626] rounded-lg appearance-none h-1.5"
                />
                <div className="flex justify-between font-mono text-[9px] text-[#ccc3d8]/40 mt-1 uppercase">
                  <span>1x (Unleveraged)</span>
                  <span>5x</span>
                  <span>{maxLeverage}x (Max Risk)</span>
                </div>
              </div>
            </div>

            {/* Quick launch directly with these values! */}
            <button
              onClick={onLaunchTerminal}
              className="w-full bg-white/5 border border-white/10 hover:bg-deep-orange hover:text-black hover:border-deep-orange text-white py-3 rounded font-sans font-bold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer text-center mt-4"
            >
              Review Markets
            </button>
          </div>

          {/* SIMULATED OUTCOME DYNAMIC CHART (cols 7) */}
          <div className="lg:col-span-7 bg-[#1c1b1b]/60 border border-[#262626] rounded-xl p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-baseline mb-6 border-b border-[#262626] pb-4">
                <span className="font-mono text-xs font-bold text-[#ccc3d8] uppercase tracking-wide">
                  Margin Estimate
                </span>
                <span className="font-mono text-[9px] text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full uppercase leading-none">
                  <Gauge size={12} />
                  Safe Margins
                </span>
              </div>

              {/* Grid representation */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded">
                  <span className="font-mono text-[9px] text-[#ccc3d8]/50 uppercase tracking-wider block mb-1">
                    Your Collateral
                  </span>
                  <span className="font-mono text-[#e5e2e1] font-bold text-base">
                    ${collateral.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded">
                  <span className="font-mono text-[9px] text-[#ccc3d8]/50 uppercase tracking-wider block mb-1">
                    Vault Liquidity Used
                  </span>
                  <span className="font-mono text-[#F97316] font-semibold text-base">
                    ${borrowCapital.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded col-span-2 md:col-span-1">
                  <span className="font-mono text-[9px] text-[#ccc3d8]/50 uppercase tracking-wider block mb-1">
                    Total Exposure
                  </span>
                  <span className="font-mono text-white font-extrabold text-base">
                    ${totalTradingPower.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Outcomes Compare Graphic */}
              <div className="space-y-4 bg-[#0a0a0a] p-4 rounded border border-[#262626]/80 mb-6 font-mono text-xs">
                {/* Result line 1 */}
                <div className="flex justify-between items-center">
                  <span className="text-[#ccc3d8]/80">Option Share Cost:</span>
                  <span className="text-white font-bold">{(currentPrice * 100).toFixed(0)}%</span>
                </div>
                {/* Result line 2 */}
                <div className="flex justify-between items-center">
                  <span className="text-[#ccc3d8]/80">Effective Contract Shares Held:</span>
                  <span className="text-white font-bold">
                    {contractShares.toLocaleString()} shares
                  </span>
                </div>
                {/* Result line 3 */}
                <div className="flex justify-between items-center">
                  <span className="text-[#ccc3d8]/80">Liquidation Trigger Price:</span>
                  <span className="text-[#EF4444] font-bold">
                    {(currentPrice * 82).toFixed(1)}%
                  </span>
                </div>
                {/* Result line 4 */}
                <div className="flex justify-between items-center border-t border-[#262626] pt-3 text-emerald-400">
                  <span className="font-medium">Potential Yield On Correct Outcome:</span>
                  <span className="text-base font-extrabold">
                    +{totalReturnOnCollateral.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory text */}
            <div className="mt-2 p-5 bg-[#201f1f] rounded border border-[#262626] text-sm text-[#ccc3d8] leading-relaxed flex gap-3.5 items-start">
              <ShieldCheck size={20} className="text-deep-orange flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-sans text-base font-bold text-white block mb-1">
                  Automated Collateral Guard:
                </span>
                Your position resolves to $1.00 per share when the outcome is correct. Risk controls
                monitor drawdowns and help protect vault liquidity from runaway losses.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ECOSYSTEM METRICS DETAILS */}
      <section className="mb-20 bg-surface-card border border-[#262626] rounded-xl p-6 md:p-9 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-deep-orange via-electric-purple to-emerald-400" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 text-center md:text-left">
          <div>
            <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold block mb-2">
              Available Markets
            </span>
            <span className="font-mono text-3xl font-extrabold text-white">{marketCount}</span>
            {marketCount === 0 ? (
              <span className="mt-2 block text-[10px] text-deep-orange">
                Core feed reconnecting
              </span>
            ) : null}
          </div>
          <div>
            <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold block mb-2">
              Market Posts
            </span>
            <span className="font-mono text-3xl font-extrabold text-white">{socialCount}</span>
          </div>
          <div>
            <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold block mb-2">
              Get Up To
            </span>
            <span className="font-mono text-3xl font-extrabold text-deep-orange">
              {Math.max(maxLeverage, 10)}x
            </span>
          </div>
          <div>
            <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold block mb-2">
              Trading Flow
            </span>
            <span className="font-mono text-3xl font-extrabold text-emerald-400">Request</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#262626] pt-8 md:pt-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#ccc3d8]/50">
              Conviction Markets
            </p>
            <p className="mt-1 text-sm text-[#ccc3d8]">Docs, community, and product updates.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <SocialLink href="/docs" label="Docs" icon={<BookOpen size={16} />} />
            <SocialLink href="/support" label="Support" icon={<HelpCircle size={16} />} />
            <SocialLink href="https://x.com/VictionMarkets" label="X" icon={<XLogo />} />
            <SocialLink
              href="https://t.me/+KYjXR2Tz2P4xMGY0"
              label="Telegram"
              icon={<TelegramLogo />}
            />
          </div>
        </div>
      </footer>
    </main>
  );
}

function PulseStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="flex min-h-14 items-center justify-between gap-3 rounded border border-[#262626] bg-[#0A0A0A] px-4">
      <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#ccc3d8]/55">
        {label}
      </span>
      <strong className="inline-flex items-center gap-2 font-mono text-sm font-extrabold text-white">
        {icon}
        {value}
      </strong>
    </span>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const isExternal = href.startsWith("http");

  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
      aria-label={"Open " + label}
      className="inline-flex h-10 items-center gap-2 rounded border border-[#262626] bg-[#0A0A0A] px-3 text-xs font-extrabold uppercase tracking-widest text-white transition hover:border-deep-orange hover:text-deep-orange"
    >
      {icon}
      {label}
    </a>
  );
}

function XLogo() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.55l-5.13-6.7L5.2 22H1.94l7.6-8.69L1.5 2h6.72l4.64 6.13L18.244 2Zm-1.14 17.91h1.8L7.24 3.98H5.31l11.794 15.93Z" />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.88 4.14c.28-1.18-.84-1.7-1.7-1.36L2.86 9.48c-1.18.46-1.16 1.1-.2 1.4l4.45 1.39L17.43 5.8c.49-.3.93-.14.57.18l-8.36 7.55-.32 4.72c.47 0 .68-.22.94-.48l2.26-2.2 4.7 3.47c.86.48 1.48.23 1.7-.8l2.96-14.1Z" />
    </svg>
  );
}
