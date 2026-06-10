import Link from "next/link";

import { EmptyState } from "../../components/EmptyState";
import { SharePredictionActions } from "../../components/SharePredictionActions";
import { SocialPostActions } from "../../components/SocialPostActions";
import type { Market, SocialActor, SocialFeedItem, TradeSignal } from "../../lib/core-api";
import { getSocialFeed } from "../../lib/core-api";
import { formatMarketPrice, getMarketPrice } from "../../lib/market-display";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Ideas",
  description: "A real prediction-market social feed for Conviction Markets.",
  imagePath: getMiniAppImagePath("leaderboard"),
  targetPath: "/social",
  buttonTitle: "Open ideas",
});

type FeedPost = SocialFeedItem;

export default async function SocialPage() {
  const signalFeed = await getSocialFeed({ limit: 80 });
  const posts = signalFeed.feed;
  const stats = getFeedStats(posts);
  const totalMarkets = stats.markets;

  return (
    <main className="social-feed-shell">
      <aside className="social-feed-sidebar" aria-label="Social navigation">
        <div className="social-feed-title">
          <p className="eyebrow">Ideas</p>
          <h1>Prediction takes</h1>
          <span>Signals, replies, saves, and shares tied to real markets.</span>
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

        <div className="social-new-posts-pill">{signalFeed.status === "ready" ? posts.length + " real posts" : "Feed unavailable"}</div>

        {posts.length > 0 ? (
          <div className="social-post-list">
            {posts.map((post) => (
              <SocialSignalPost key={post.signal.id} post={post} />
            ))}
          </div>
        ) : signalFeed.status === "unavailable" ? (
          <EmptyState
            title="Ideas feed unavailable"
            body={signalFeed.message + " The feed is not showing placeholder posts."}
          />
        ) : (
          <EmptyState
            title="No prediction takes yet"
            body="Publish a real signal from a synced market and it will appear here. No fake posts are shown."
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
            <dt>Replies</dt>
            <dd>{stats.replies}</dd>
          </div>
        </dl>
        <p>{signalFeed.status === "ready" ? "Every feed item is a saved signal. Replies, likes, bookmarks, and copy counts appear only after core records them." : signalFeed.message}</p>
      </aside>
    </main>
  );
}

function SocialSignalPost({ post }: { post: FeedPost }) {
  const { market, signal } = post;
  const sideClass = signal.side.toLowerCase();
  const author = getActorLabel(post.author, post.trader?.handle ?? null);
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
          <Link href={post.trader ? "/traders/" + post.trader.id : "/social"}>{author}</Link>
          <span>{formatRelativeTime(signal.createdAt)}</span>
          <small>{signal.source.toLowerCase()}</small>
        </header>
        <p className="social-post-thesis">{signal.thesis}</p>
        <Link className="social-market-callout" href={"/markets/" + signal.marketId}>
          <strong>{marketTitle}</strong>
          <span>{detailText}</span>
        </Link>
        <footer className="social-post-footer">
          <SocialPostActions
            initialCounts={post.counts}
            initialReplies={post.recentReplies}
            initialViewer={post.viewer}
            signalId={signal.id}
          />
          <SharePredictionActions
            className="social-post-share"
            context={signal.side + " signal"}
            path={"/signals/" + signal.id}
            title={marketTitle}
          />
          <Link className="social-open-market" href={"/markets/" + signal.marketId}>
            Open market
          </Link>
        </footer>
      </div>
    </article>
  );
}

function getFeedStats(posts: SocialFeedItem[]) {
  const marketIds = new Set<string>();
  let replies = 0;
  let reactions = 0;
  let bookmarks = 0;
  let copyIntents = 0;

  for (const post of posts) {
    replies += post.counts.replies;
    reactions += post.counts.reactions;
    bookmarks += post.counts.bookmarks;
    copyIntents += post.counts.copyIntents;
    marketIds.add(post.signal.marketId);
  }

  return {
    replies,
    reactions,
    bookmarks,
    copyIntents,
    markets: marketIds.size,
  };
}

function getActorLabel(actor: SocialActor, fallbackHandle: string | null) {
  if (actor.username) {
    return "@" + actor.username;
  }

  return actor.handle ?? fallbackHandle ?? actor.displayName ?? compactId(actor.userId);
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
