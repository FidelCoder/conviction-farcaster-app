import Link from "next/link";
import type { ReactNode } from "react";

import type { Market, Position, TraderProfile, TraderStats, TradeSignal } from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import { formatMarketPrice, getMarketPrice } from "../lib/market-display";

type PublicTraderProfileProps = {
  markets: Market[];
  positions: Position[];
  signals: TradeSignal[];
  stats: TraderStats | null;
  trader: TraderProfile | null;
  traderId: string;
};

export function PublicTraderProfile({
  markets,
  positions,
  signals,
  stats,
  trader,
  traderId,
}: PublicTraderProfileProps) {
  const marketById = new Map(markets.map((market) => [market.id, market]));
  const handle = trader?.handle ?? "Trader unavailable";
  const avatarUrl = trader?.avatarUrl ?? null;
  const initial = getInitial(handle || traderId);
  const publicSignals = signals.slice(0, 12);
  const publicPositions = positions.filter((position) => position.visibility !== "PRIVATE").slice(0, 12);

  return (
    <main className="terminal-page terminal-account-page public-trader-page">
      <section className="public-trader-topbar" aria-label="Pulse profile navigation">
        <Link href="/activity">Back to Pulse</Link>
        <Link href="/markets">Find markets</Link>
      </section>

      <section className="public-trader-hero">
        <div className="public-trader-avatar" aria-hidden="true">
          {avatarUrl ? <img alt="" src={avatarUrl} /> : <span>{initial}</span>}
        </div>
        <div className="public-trader-copy">
          <p>Pulse profile</p>
          <h1>{handle}</h1>
          <span>{trader?.bio || "Public signals, market takes, and visible positions from this Conviction trader."}</span>
        </div>
        <div className="public-trader-actions">
          <Link href="/activity">Open Pulse</Link>
          <Link href="/markets">Trade markets</Link>
        </div>
      </section>

      <section className="public-trader-stats" aria-label="Public profile stats">
        <ProfileStat label="Signals" value={stats?.numberOfSignals ?? signals.length} />
        <ProfileStat label="Copy intents" value={stats?.numberOfCopyIntents ?? 0} />
        <ProfileStat label="Copied volume" value={stats?.copiedVolume ?? "0"} />
        <ProfileStat label="Public positions" value={publicPositions.length} />
      </section>

      <section className="public-trader-layout">
        <div className="public-trader-main">
          <ProfileSection count={publicSignals.length} eyebrow="Pulse" title="Public market posts">
            {publicSignals.length > 0 ? (
              <div className="public-trader-feed">
                {publicSignals.map((signal) => (
                  <SignalProfilePost
                    key={signal.id}
                    market={marketById.get(signal.marketId) ?? null}
                    signal={signal}
                  />
                ))}
              </div>
            ) : (
              <ProfileEmptyState
                title="No public posts yet"
                body="When this trader shares a market call on Pulse, it will appear here."
              />
            )}
          </ProfileSection>

          <ProfileSection count={publicPositions.length} eyebrow="Portfolio" title="Visible positions">
            {publicPositions.length > 0 ? (
              <div className="public-position-list">
                {publicPositions.map((position) => (
                  <PositionProfileRow
                    key={position.id}
                    market={marketById.get(position.marketId) ?? null}
                    position={position}
                  />
                ))}
              </div>
            ) : (
              <ProfileEmptyState
                title="No public positions"
                body="Private trades stay private. Public trades from this profile will show here."
              />
            )}
          </ProfileSection>
        </div>

        <aside className="public-trader-aside" aria-label="Profile context">
          <section>
            <p>Identity</p>
            <strong>{trader ? ".viction claimed" : "Profile unavailable"}</strong>
            <span>Conviction profiles show public activity without exposing wallet addresses in the social layer.</span>
          </section>
          <section>
            <p>Latest activity</p>
            <strong>{getLatestActivityLabel([...signals, ...positions])}</strong>
            <span>Only real records returned by core are shown here.</span>
          </section>
          <section>
            <p>Discover</p>
            <strong>Follow the flow</strong>
            <span>Use Pulse for conversations, market pages for rules, and the margin desk for requests.</span>
          </section>
        </aside>
      </section>
    </main>
  );
}

function ProfileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileSection({
  children,
  count,
  eyebrow,
  title,
}: {
  children: ReactNode;
  count: number;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="public-trader-section">
      <header>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{count}</span>
      </header>
      {children}
    </section>
  );
}

function SignalProfilePost({ market, signal }: { market: Market | null; signal: TradeSignal }) {
  const sideClass = signal.side.toLowerCase();
  const marketPrice = getSignalPrice(market, signal.side);

  return (
    <article className={"public-pulse-post side-" + sideClass}>
      <div className="public-pulse-post-meta">
        <span>{signal.side}</span>
        <time dateTime={signal.createdAt}>{formatDate(signal.createdAt)}</time>
      </div>
      <p>{signal.thesis}</p>
      <Link className="public-pulse-market" href={"/markets/" + signal.marketId}>
        <strong>{market?.title ?? "Market details"}</strong>
        <span>{marketPrice ? signal.side + " " + marketPrice : "Open market details"}</span>
      </Link>
    </article>
  );
}

function PositionProfileRow({ market, position }: { market: Market | null; position: Position }) {
  return (
    <article className={"public-position-row side-" + position.side.toLowerCase()}>
      <div>
        <span>{position.side} position</span>
        <strong>{market?.title ?? "Market details"}</strong>
      </div>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{executionStatusLabel(position.status)}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{position.quantity}</dd>
        </div>
        <div>
          <dt>Entry</dt>
          <dd>{position.averageEntryPrice ?? "Pending"}</dd>
        </div>
      </dl>
      <Link href={"/markets/" + position.marketId}>View market</Link>
    </article>
  );
}

function ProfileEmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="public-profile-empty">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function getSignalPrice(market: Market | null, side: TradeSignal["side"]) {
  if (!market) return null;
  const price = getMarketPrice(market);
  const parsed = price ? Number(price) : Number.NaN;

  if (!Number.isFinite(parsed)) return price ? formatMarketPrice(price) : null;

  return formatMarketPrice(String(side === "YES" ? parsed : 1 - parsed));
}

function getLatestActivityLabel(items: Array<TradeSignal | Position>) {
  const timestamps = items
    .map((item) => new Date(item.createdAt).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) return "No public activity";

  return formatDate(new Date(Math.max(...timestamps)).toISOString());
}

function getInitial(value: string) {
  const compact = value.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();
  return compact || "CM";
}
