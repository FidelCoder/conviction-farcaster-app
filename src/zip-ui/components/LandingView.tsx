"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircle, Search, Send, ShieldCheck, TrendingUp } from "lucide-react";

import type { PredictionMarket } from "../types";

export type LandingSocialPreview = {
  author: string;
  avatarUrl: string | null;
  convictionLevel: number | null;
  displayName: string;
  marketTitle: string | null;
  side: "YES" | "NO" | null;
  thesis: string;
  time: string;
};

interface LandingViewProps {
  activeMarket: PredictionMarket;
  markets: PredictionMarket[];
  marketCount: number;
  maxLeverage: number;
  onLaunchTerminal: () => void;
  onOpenMarket: (market: PredictionMarket) => void;
  onExploreVaults: () => void;
  onOpenPulse: () => void;
  socialCount: number;
  socialPreview: LandingSocialPreview | null;
  vaultCount: number;
  walletConnected: boolean;
}

export default function LandingView({
  activeMarket,
  markets,
  marketCount,
  maxLeverage,
  onLaunchTerminal,
  onOpenMarket,
  onExploreVaults,
  onOpenPulse,
  socialCount,
  socialPreview,
  vaultCount,
  walletConnected,
}: LandingViewProps) {
  const leverageLimit = Math.max(1, maxLeverage);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [leverage, setLeverage] = useState(Math.min(5, leverageLimit));
  const [collateral, setCollateral] = useState(1000);
  const heroMarkets = useMemo(() => getLandingHeroMarkets(markets), [markets]);
  const [heroMarketIndex, setHeroMarketIndex] = useState(0);

  useEffect(() => {
    if (heroMarkets.length <= 1) {
      setHeroMarketIndex(0);
      return;
    }

    const syncRotation = () => {
      setHeroMarketIndex(Math.floor(Date.now() / 8_000) % heroMarkets.length);
    };

    syncRotation();
    const interval = window.setInterval(syncRotation, 1_000);

    return () => window.clearInterval(interval);
  }, [heroMarkets.length]);

  const heroMarket = heroMarkets[heroMarketIndex] ?? activeMarket;
  const heroYesProbability = clamp(heroMarket.currentOdds, 0, 100);
  const heroNoProbability = 100 - heroYesProbability;
  const hasHeroMarketImage = isLandingMarketImage(heroMarket.imageUrl);

  const yesProbability = clamp(activeMarket.currentOdds, 0, 100);
  const noProbability = 100 - yesProbability;
  const selectedProbability = outcome === "YES" ? yesProbability : noProbability;
  const selectedPrice = Math.max(0.01, selectedProbability / 100);
  const effectiveLeverage = Math.min(leverage, leverageLimit);
  const borrowedCapital = Math.max(0, collateral * (effectiveLeverage - 1));
  const positionSize = collateral * effectiveLeverage;
  const estimatedShares = Math.floor(positionSize / selectedPrice);
  const liquidationPrice = selectedPrice * 0.82;
  return (
    <main className="landing-v2">
      <section className="landing-v2-hero">
        <div className="landing-v2-network" aria-hidden="true" />
        <div className="landing-v2-container landing-v2-hero-grid">
          <div className="landing-v2-hero-copy">
            <p className="landing-v2-kicker">
              <span /> Prediction markets, sorted for your interests
            </p>
            <h1>
              Find Markets.
              <strong>
                Trade With <span>Margin.</span>
              </strong>
            </h1>
            <p className="landing-v2-lead">
              Discover live event markets and back your strongest calls with margin powered by vault
              liquidity. The precision of a terminal, the thrill of prediction.
            </p>
            <div className="landing-v2-actions">
              <button className="landing-v2-primary" onClick={onLaunchTerminal} type="button">
                Find markets <ArrowRight size={15} />
              </button>
              <button className="landing-v2-secondary" onClick={onExploreVaults} type="button">
                Earn yield
              </button>
            </div>
          </div>

          <MarketSnapshot
            key={heroMarket.id}
            market={heroMarket}
            hasImage={hasHeroMarketImage}
            noProbability={heroNoProbability}
            onOpenMarket={() => onOpenMarket(heroMarket)}
            yesProbability={heroYesProbability}
          />
        </div>
      </section>

      <section className="landing-v2-band landing-v2-pulse">
        <div className="landing-v2-container landing-v2-pulse-grid">
          <div className="landing-v2-section-copy">
            <p className="landing-v2-eyebrow">Market Pulse</p>
            <h2>Talk markets before the price moves.</h2>
            <p>
              Follow traders, post calls, join market rooms, and turn event news into a live
              conviction feed. Signal over noise, right in your trading view.
            </p>
            <dl className="landing-v2-pulse-stats">
              <div>
                <dt>Posts</dt>
                <dd>{socialCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Traders</dt>
                <dd>
                  <span /> Live
                </dd>
              </div>
            </dl>
            <button className="landing-v2-text-action" onClick={onOpenPulse} type="button">
              Open Pulse <ArrowRight size={14} />
            </button>
          </div>

          <PulsePreview preview={socialPreview} onOpenPulse={onOpenPulse} />
        </div>
      </section>

      <section className="landing-v2-band landing-v2-workflow">
        <div className="landing-v2-container">
          <div className="landing-v2-section-heading">
            <h2>Execution is everything.</h2>
            <p>A unified pipeline from discovery to settlement.</p>
          </div>
          <div className="landing-v2-steps">
            <WorkflowStep
              icon={<Search size={17} />}
              number="01"
              title="Find Your Market"
              body="Browse current event markets sorted by topic, region, and real market activity."
            />
            <WorkflowStep
              icon={<TrendingUp size={17} />}
              number="02"
              title="Back Your Conviction"
              body={
                "Request larger YES/NO exposure with vault-backed liquidity, up to " +
                leverageLimit +
                "x."
              }
            />
            <WorkflowStep
              icon={<ShieldCheck size={17} />}
              number="03"
              title="Manage The Position"
              body="Track collateral, execution status, market price, and transaction records from your portfolio."
            />
          </div>
        </div>
      </section>

      <section className="landing-v2-band landing-v2-margin">
        <div className="landing-v2-container landing-v2-margin-grid">
          <MarginPreview
            borrowedCapital={borrowedCapital}
            collateral={collateral}
            effectiveLeverage={effectiveLeverage}
            estimatedShares={estimatedShares}
            leverage={leverage}
            leverageLimit={leverageLimit}
            liquidationPrice={liquidationPrice}
            market={activeMarket}
            onCollateralChange={setCollateral}
            onLeverageChange={setLeverage}
            onOpenMarket={onLaunchTerminal}
            onOutcomeChange={setOutcome}
            outcome={outcome}
            positionSize={positionSize}
            selectedPrice={selectedPrice}
            walletConnected={walletConnected}
          />

          <div className="landing-v2-margin-copy">
            <p className="landing-v2-eyebrow">Preview margin mechanics</p>
            <h2>See how collateral, borrowed liquidity, and price shape a margin request.</h2>
            <p>
              Start with collateral, choose your leverage, and preview the resulting exposure before
              opening the full market desk.
            </p>
            <ul>
              <li>
                <span /> Cross-margin requests can draw from configured vault liquidity.
              </li>
              <li>
                <span /> Liquidation thresholds respond to market volatility and entry price.
              </li>
              <li>
                <span /> Borrowing, position, and transaction records stay visible in portfolio.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-v2-band landing-v2-yield">
        <div className="landing-v2-container">
          <div className="landing-v2-section-heading">
            <h2>Earn Yield. Power Markets.</h2>
            <p>
              Supply assets to configured vaults. Your liquidity supports margin activity and earns
              from protocol activity when yield is available.
            </p>
          </div>
          <dl className="landing-v2-yield-stats">
            <div>
              <dt>Yield model</dt>
              <dd className="is-green">Variable</dd>
            </div>
            <div>
              <dt>Live markets</dt>
              <dd>{marketCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Configured vaults</dt>
              <dd>{vaultCount}</dd>
            </div>
          </dl>
          <button className="landing-v2-secondary" onClick={onExploreVaults} type="button">
            Explore vaults
          </button>
        </div>
      </section>

      <footer className="landing-v2-footer">
        <div className="landing-v2-container landing-v2-footer-grid">
          <div className="landing-v2-footer-brand">
            <Image
              alt="Conviction Markets"
              height={120}
              src="/logo/conviction-markets-header.png"
              width={620}
            />
            <p>Leveraged prediction markets.</p>
          </div>
          <nav aria-label="Landing page footer">
            <button onClick={onLaunchTerminal} type="button">
              Markets
            </button>
            <button onClick={onOpenPulse} type="button">
              Pulse
            </button>
            <button onClick={onExploreVaults} type="button">
              Vaults
            </button>
            <a href="/leaderboard">Leaderboard</a>
            <a href="/docs">Docs</a>
            <a href="/support">Support</a>
          </nav>
          <div className="landing-v2-footer-socials">
            <a href="https://x.com/VictionMarkets" rel="noreferrer" target="_blank">
              X
            </a>
            <a href="https://t.me/+KYjXR2Tz2P4xMGY0" rel="noreferrer" target="_blank">
              <Send size={14} /> Telegram
            </a>
          </div>
          <small>© 2026 Conviction Markets</small>
        </div>
      </footer>
    </main>
  );
}

function getLandingHeroMarkets(markets: PredictionMarket[]) {
  return markets
    .filter((market) => market.status === "LIVE" && isLandingMarketImage(market.imageUrl))
    .sort((left, right) => {
      const scoreDifference = getLandingHeroScore(right) - getLandingHeroScore(left);

      return scoreDifference || left.id.localeCompare(right.id);
    })
    .slice(0, 6);
}

function getLandingHeroScore(market: PredictionMarket) {
  const volume = market.volume24hValue ?? parseLandingMarketValue(market.vol24h);
  const liquidity = market.liquidityValue ?? parseLandingMarketValue(market.liquidity);
  const movement = Math.abs(market.oneDayPriceChange ?? 0);

  return (
    Math.log10(Math.max(0, volume) + 1) * 24 +
    Math.log10(Math.max(0, liquidity) + 1) * 14 +
    Math.min(movement, 25) * 2 +
    market.convictionValue * 0.25
  );
}

function parseLandingMarketValue(value: string) {
  const normalized = value.trim().replace(/[$,]/g, "").toUpperCase();
  const numericValue = Number.parseFloat(normalized);

  if (!Number.isFinite(numericValue)) return 0;
  if (normalized.endsWith("B")) return numericValue * 1_000_000_000;
  if (normalized.endsWith("M")) return numericValue * 1_000_000;
  if (normalized.endsWith("K")) return numericValue * 1_000;

  return numericValue;
}

function isLandingMarketImage(value?: string | null): value is string {
  return Boolean(value?.startsWith("https://polymarket-upload.s3.us-east-2.amazonaws.com/"));
}

function MarketSnapshot({
  market,
  hasImage,
  noProbability,
  onOpenMarket,
  yesProbability,
}: {
  market: PredictionMarket;
  hasImage: boolean;
  noProbability: number;
  onOpenMarket: () => void;
  yesProbability: number;
}) {
  return (
    <button className="landing-v2-market" onClick={onOpenMarket} type="button">
      {hasImage && market.imageUrl ? (
        <Image
          alt=""
          className="landing-v2-market-image"
          fill
          priority
          quality={58}
          sizes="(max-width: 760px) 92vw, 520px"
          src={market.imageUrl}
        />
      ) : null}
      <div className="landing-v2-market-content">
        <div className="landing-v2-market-meta">
          <span>{market.discoveryTopic || market.category}</span>
          <span className="is-live">● Live</span>
          <span>{market.vol24h} 24h</span>
        </div>
        <h2>{market.title}</h2>
        <p className="landing-v2-market-label">Live probability</p>
        <div className="landing-v2-probability-row">
          <strong>{yesProbability.toFixed(1)}</strong>
          <span>% YES</span>
        </div>
        <div className="landing-v2-probability-track" aria-hidden="true">
          <span style={{ width: yesProbability + "%" }} />
        </div>
        <div className="landing-v2-outcomes">
          <span className="is-yes">YES {yesProbability.toFixed(0)}¢</span>
          <span className="is-no">NO {noProbability.toFixed(0)}¢</span>
        </div>
        <div className="landing-v2-market-foot">
          <span>Liquidity: {market.liquidity}</span>
          <span>{market.discoveryRegion || "Global"}</span>
        </div>
      </div>
    </button>
  );
}

function PulsePreview({
  preview,
  onOpenPulse,
}: {
  preview: LandingSocialPreview | null;
  onOpenPulse: () => void;
}) {
  if (!preview) {
    return (
      <button className="landing-v2-pulse-preview is-empty" onClick={onOpenPulse} type="button">
        <MessageCircle size={22} />
        <strong>Open the live trader feed.</strong>
        <span>Post a market take, follow traders, or join a market room.</span>
      </button>
    );
  }

  const initial =
    preview.displayName.replace(/^@/, "").charAt(0).toUpperCase() ||
    preview.author.replace(/^@/, "").charAt(0).toUpperCase() ||
    "V";

  return (
    <button className="landing-v2-pulse-preview" onClick={onOpenPulse} type="button">
      <div className="landing-v2-pulse-author">
        <span className="landing-v2-avatar">
          {preview.avatarUrl ? (
            // Claimed avatars may be hosted outside the market-image allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" loading="lazy" src={preview.avatarUrl} />
          ) : (
            initial
          )}
        </span>
        <span className="landing-v2-pulse-identity">
          <strong>{preview.displayName}</strong>
          <span>{preview.author}</span>
        </span>
        <small>{preview.time}</small>
      </div>
      <p>{preview.thesis}</p>
      {preview.marketTitle && preview.side ? (
        <div className="landing-v2-linked-market">
          <span>Linked market</span>
          <strong>{preview.marketTitle}</strong>
          <small className={preview.side === "YES" ? "is-yes" : "is-no"}>
            {preview.side} signal
            {preview.convictionLevel ? " · " + preview.convictionLevel + "% conviction" : ""}
          </small>
        </div>
      ) : null}
      <span className="landing-v2-open-link">
        View in Pulse <ArrowRight size={13} />
      </span>
    </button>
  );
}

function WorkflowStep({
  body,
  icon,
  number,
  title,
}: {
  body: string;
  icon: React.ReactNode;
  number: string;
  title: string;
}) {
  return (
    <article className="landing-v2-step">
      <div>
        <span className="landing-v2-step-icon">{icon}</span>
        <span className="landing-v2-step-number">{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

type MarginPreviewProps = {
  borrowedCapital: number;
  collateral: number;
  effectiveLeverage: number;
  estimatedShares: number;
  leverage: number;
  leverageLimit: number;
  liquidationPrice: number;
  market: PredictionMarket;
  onCollateralChange: (value: number) => void;
  onLeverageChange: (value: number) => void;
  onOpenMarket: () => void;
  onOutcomeChange: (value: "YES" | "NO") => void;
  outcome: "YES" | "NO";
  positionSize: number;
  selectedPrice: number;
  walletConnected: boolean;
};

function MarginPreview({
  borrowedCapital,
  collateral,
  effectiveLeverage,
  estimatedShares,
  leverage,
  leverageLimit,
  liquidationPrice,
  market,
  onCollateralChange,
  onLeverageChange,
  onOpenMarket,
  onOutcomeChange,
  outcome,
  positionSize,
  selectedPrice,
  walletConnected,
}: MarginPreviewProps) {
  return (
    <div className="landing-v2-order">
      <div className="landing-v2-order-head">
        <span>New position</span>
        <strong>Margin preview</strong>
      </div>
      <p className="landing-v2-order-market">{market.title}</p>
      <div className="landing-v2-side-control" role="group" aria-label="Select outcome">
        <button
          aria-pressed={outcome === "YES"}
          onClick={() => onOutcomeChange("YES")}
          type="button"
        >
          YES
        </button>
        <button aria-pressed={outcome === "NO"} onClick={() => onOutcomeChange("NO")} type="button">
          NO
        </button>
      </div>
      <label className="landing-v2-order-row">
        <span>Collateral</span>
        <span className="landing-v2-input-wrap">
          <input
            aria-label="Collateral in USDC"
            min="100"
            onChange={(event) => onCollateralChange(Math.max(100, Number(event.target.value) || 0))}
            step="100"
            type="number"
            value={collateral}
          />
          <em>USDC</em>
        </span>
      </label>
      <label className="landing-v2-order-row landing-v2-leverage-row">
        <span>Leverage</span>
        <strong>{effectiveLeverage.toFixed(2)}x</strong>
        <input
          aria-label="Leverage"
          max={leverageLimit}
          min="1"
          onChange={(event) => onLeverageChange(Number(event.target.value))}
          step="1"
          type="range"
          value={leverage}
        />
      </label>
      <div className="landing-v2-order-row">
        <span>Position size</span>
        <strong>{formatUsdc(positionSize)}</strong>
      </div>
      <div className="landing-v2-order-detail">
        <span>Entry price ({outcome})</span>
        <strong>{formatCents(selectedPrice)}</strong>
      </div>
      <div className="landing-v2-order-detail">
        <span>Liquidation estimate</span>
        <strong className="is-red">{formatCents(liquidationPrice)}</strong>
      </div>
      <div className="landing-v2-order-detail">
        <span>Vault liquidity used</span>
        <strong className="is-green">{formatUsdc(borrowedCapital)}</strong>
      </div>
      <div className="landing-v2-order-detail">
        <span>Estimated shares</span>
        <strong>{estimatedShares.toLocaleString()}</strong>
      </div>
      <button className="landing-v2-order-submit" onClick={onOpenMarket} type="button">
        {walletConnected ? "Review market" : "Explore markets"} <ArrowRight size={14} />
      </button>
      <small>This preview does not place an order.</small>
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function formatUsdc(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " USDC";
}

function formatCents(value: number) {
  return (value * 100).toFixed(1) + "¢";
}
