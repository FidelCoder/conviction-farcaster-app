import Link from "next/link";

import { EmptyState } from "../../components/EmptyState";
import { SharePredictionActions } from "../../components/SharePredictionActions";
import type { Market, TraderProfile, TradeSignal } from "../../lib/core-api";
import {
  getMarket,
  getTraderProfile,
  listMarkets,
  listRecentSignals,
} from "../../lib/core-api";
import { formatMarketPrice, getMarketPrice } from "../../lib/market-display";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Social Feed",
  description: "Real prediction-market signals from Conviction Markets traders.",
  imagePath: getMiniAppImagePath("leaderboard"),
  targetPath: "/social",
  buttonTitle: "Open social feed",
});

type FeedPost = {
  market: Market | null;
  signal: TradeSignal;
  trader: TraderProfile | null;
};

export default async function SocialPage() {
  const [signals, markets] = await Promise.all([listRecentSignals(60), listMarkets()]);
  const marketMap = new Map(markets.map((market) => [market.id, market]));
  const missingMarketIds = Array.from(
    new Set(signals.map((signal) => signal.marketId).filter((marketId) => !marketMap.has(marketId))),
  );
  const traderIds = Array.from(new Set(signals.map((signal) => signal.traderProfileId)));
  const [missingMarkets, traders] = await Promise.all([
    Promise.all(missingMarketIds.map((marketId) => getMarket(marketId))),
    Promise.all(traderIds.map((traderId) => getTraderProfile(traderId))),
  ]);

  missingMarkets.forEach((market) => {
    if (market) {
      marketMap.set(market.id, market);
    }
  });

  const traderMap = new Map<string, TraderProfile | null>();
  traderIds.forEach((traderId, index) => {
    traderMap.set(traderId, traders[index] ?? null);
  });

  const posts = signals.map((signal) => ({
    market: marketMap.get(signal.marketId) ?? null,
    signal,
    trader: traderMap.get(signal.traderProfileId) ?? null,
  }));
  const totalMarkets = new Set(posts.map((post) => post.signal.marketId)).size;

  return (
    <main className="social-feed-shell">
      <aside className="social-feed-sidebar" aria-label="Social navigation">
        <div className="social-feed-title">
          <p className="eyebrow">Ideas</p>
          <h1>Conviction feed</h1>
          <span>Real market signals only.</span>
        </div>
        <nav aria-label="Feed sections">
          <Link aria-current="page" href="/social">
            <span className="social-nav-icon home" aria-hidden="true" />
            Home
          </Link>
          <Link href="/me">
            <span className="social-nav-icon profile" aria-hidden="true" />
            Profile
          </Link>
          <Link href="/leaderboard">
            <span className="social-nav-icon rank" aria-hidden="true" />
            Leaders
          </Link>
          <Link href="/markets">
            <span className="social-nav-icon bookmark" aria-hidden="true" />
            Markets
          </Link>
        </nav>
        <Link className="social-post-button" href="/markets">
          Post signal
        </Link>
      </aside>

      <section className="social-feed-column" aria-label="Signal feed">
        <div className="social-feed-tools" aria-label="Feed actions">
          <Link href="/social" aria-label="Feed replies">
            <span className="feed-tool reply" aria-hidden="true" />
          </Link>
          <Link href="/leaderboard" aria-label="Ranked traders">
            <span className="feed-tool heart" aria-hidden="true" />
          </Link>
          <Link href="/me" aria-label="Saved activity">
            <span className="feed-tool bookmark" aria-hidden="true" />
          </Link>
          <Link href="/markets" aria-label="Shareable markets">
            <span className="feed-tool share" aria-hidden="true" />
          </Link>
        </div>

        <div className="social-new-posts-pill">{posts.length} real signals</div>

        {posts.length > 0 ? (
          <div className="social-post-list">
            {posts.map((post) => (
              <SocialSignalPost key={post.signal.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No signal posts yet"
            body="When traders publish real signals through core, they will appear here. No placeholder posts are shown."
          />
        )}
      </section>

      <aside className="social-feed-context" aria-label="Feed context">
        <dl>
          <div>
            <dt>Posts</dt>
            <dd>{posts.length}</dd>
          </div>
          <div>
            <dt>Markets</dt>
            <dd>{totalMarkets}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>Core API</dd>
          </div>
        </dl>
        <p>Every feed item is a saved signal. Comments, likes, and bookmarks need real backend records before counts appear.</p>
      </aside>
    </main>
  );
}

function SocialSignalPost({ post }: { post: FeedPost }) {
  const { market, signal, trader } = post;
  const sideClass = signal.side.toLowerCase();
  const author = trader?.handle ?? compactId(signal.traderProfileId);
  const priceLabel = market ? getSignalPriceLabel(market, signal.side) : null;
  const marketTitle = market?.title ?? "Market unavailable";
  const detailText = [
    signal.side,
    priceLabel ? priceLabel + " current" : "price unavailable",
    signal.convictionLevel ? signal.convictionLevel + "% conviction" : null,
    "Signal only",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={"social-post side-" + sideClass}>
      <div className="social-avatar" aria-hidden="true">
        {getInitials(author)}
      </div>
      <div className="social-post-body">
        <header className="social-post-header">
          <Link href={"/traders/" + signal.traderProfileId}>{author}</Link>
          <span>{formatRelativeTime(signal.createdAt)}</span>
        </header>
        <p className="social-post-thesis">{signal.thesis}</p>
        <Link className="social-market-callout" href={"/markets/" + signal.marketId}>
          <strong>{marketTitle}</strong>
          <span>{detailText}</span>
        </Link>
        <footer className="social-post-footer">
          <div className="social-icon-row" aria-label="Post actions">
            <Link href={"/signals/" + signal.id} aria-label="Open signal">
              <span className="feed-tool reply" aria-hidden="true" />
            </Link>
            <Link href="/leaderboard" aria-label="Open leaderboard">
              <span className="feed-tool heart" aria-hidden="true" />
            </Link>
            <Link href="/me" aria-label="Open activity">
              <span className="feed-tool bookmark" aria-hidden="true" />
            </Link>
          </div>
          <SharePredictionActions
            className="social-post-share"
            context={signal.side + " signal"}
            path={"/signals/" + signal.id}
            title={marketTitle}
          />
          <Link className="social-open-market" href={"/markets/" + signal.marketId}>
            Open
          </Link>
        </footer>
      </div>
    </article>
  );
}

function getSignalPriceLabel(market: Market, side: TradeSignal["side"]) {
  const price = getMarketPrice(market);
  const parsed = price ? Number(price) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const sidePrice = side === "YES" ? parsed : 1 - parsed;

  return formatMarketPrice(String(sidePrice));
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes + "m";
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours + "h";
  }

  const days = Math.floor(hours / 24);
  return days + "d";
}

function compactId(id: string) {
  return id.length > 10 ? id.slice(0, 6) + "..." + id.slice(-4) : id;
}

function getInitials(value: string) {
  const compact = value.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();

  return compact || "CM";
}
