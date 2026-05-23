import Link from "next/link";

import { EmptyState } from "../components/EmptyState";
import { MarketCard } from "../components/MarketCard";
import { listMarkets } from "../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets",
  description: "Real prediction-market signals from the Conviction Markets core API.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Open markets",
});

export default async function HomePage() {
  const markets = await listMarkets();
  const featuredMarkets = markets.slice(0, 6);
  const activeMarkets = markets.filter((market) => market.status.toLowerCase() === "active").length;
  const pricedMarkets = markets.filter(
    (market) => market.lastTradePrice ?? market.bestBid ?? market.bestAsk,
  ).length;
  const latestSync = getLatestSyncTime(markets);

  return (
    <main className="page-shell">
      <section className="home-board">
        <div className="home-board-copy">
          <p className="eyebrow">Farcaster Mini App</p>
          <h1>Conviction Markets</h1>
          <p>Real prediction-market signals, positions, and copy intents from the core API.</p>
          <div className="action-row">
            <Link className="primary-link" href="/markets">
              Browse markets
            </Link>
            <span className="status-note">
              {latestSync ? "Latest sync " + latestSync : "Waiting for provider sync"}
            </span>
          </div>
        </div>

        <dl className="market-summary">
          <div>
            <dt>Markets</dt>
            <dd>{markets.length}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{activeMarkets}</dd>
          </div>
          <div>
            <dt>Priced</dt>
            <dd>{pricedMarkets}</dd>
          </div>
        </dl>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Markets</p>
          <h2>Synced markets</h2>
        </div>
        <Link className="text-link" href="/markets">
          View all
        </Link>
      </section>

      {featuredMarkets.length > 0 ? (
        <section className="card-grid">
          {featuredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No markets yet"
          body="Markets have not been synced into the core API, or the core API is not reachable."
        />
      )}
    </main>
  );
}

function getLatestSyncTime(markets: Awaited<ReturnType<typeof listMarkets>>) {
  const timestamps = markets
    .map((market) => market.syncedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Math.max(...timestamps)));
}
