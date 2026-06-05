import Link from "next/link";

import { EmptyState } from "../../components/EmptyState";
import type { Market } from "../../lib/core-api";
import { listMarkets } from "../../lib/core-api";
import {
  formatMarketPrice,
  getMarketBoardStats,
  getMarketDisplayCase,
  getMarketPrice,
  sortMarketsForConvictionBoard,
} from "../../lib/market-display";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const markets = await listMarkets();
  const rankedMarkets = sortMarketsForConvictionBoard(markets);
  const boardStats = getMarketBoardStats(markets);
  const marketClusters = getMarketClusters(rankedMarkets);
  const featuredClusters = marketClusters.slice(0, 4);

  return (
    <main className="page-shell app-layer-shell">
      <section className="app-board-hero market-board-hero" aria-labelledby="markets-title">
        <div className="app-title-lockup market-board-copy">
          <p className="eyebrow">Market board</p>
          <h1 id="markets-title">Pick a side. Size the thesis.</h1>
          <p>Four live boards up front. Tap one for YES/NO price, resolution, and signal entry.</p>
        </div>
        <Link className="app-hero-action" href="/margin">
          Open margin desk
        </Link>
        <dl className="app-board-stats compact-stats" aria-label="Market board composition">
          <div>
            <dt>Ready</dt>
            <dd>{boardStats.qualified}</dd>
          </div>
          <div>
            <dt>Priced</dt>
            <dd>{boardStats.priced}</dd>
          </div>
          <div>
            <dt>Mapped</dt>
            <dd>{boardStats.mapped}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{boardStats.total}</dd>
          </div>
        </dl>
      </section>

      {markets.length > 0 ? (
        <>
          <section className="market-cluster-board" aria-label="Featured market clusters">
            {featuredClusters.map((cluster) => (
              <MarketClusterCard cluster={cluster} key={cluster.name} />
            ))}
          </section>

          <section className="section-heading conviction-section-heading compact-heading">
            <div>
              <p className="eyebrow">Categories</p>
              <h2>Browse by thesis</h2>
            </div>
            <span>{marketClusters.length} groups</span>
          </section>

          <section className="category-section-stack" aria-label="Market categories">
            {marketClusters.map((cluster) => (
              <CategoryMarketSection cluster={cluster} key={cluster.name} />
            ))}
          </section>
        </>
      ) : (
        <EmptyState
          title="No markets yet"
          body="No market board records are available from the core API yet."
        />
      )}
    </main>
  );
}

type MarketCluster = {
  name: string;
  markets: Market[];
  readyCount: number;
};

function MarketClusterCard({ cluster }: { cluster: MarketCluster }) {
  const topMarket = cluster.markets[0];
  const displayCase = getMarketDisplayCase(topMarket);
  const yesPrice = displayCase.price ?? "--";
  const noPrice = getNoPrice(topMarket) ?? "--";

  return (
    <article className="market-cluster-card" tabIndex={0}>
      <div className="cluster-summary">
        <span className="cluster-topline">
          <span>{cluster.name}</span>
          <strong>{cluster.markets.length}</strong>
        </span>
        <h2>{topMarket.title}</h2>
        <span className="cluster-price-row">
          <span>
            <b>YES</b>
            {yesPrice}
          </span>
          <span>
            <b>NO</b>
            {noPrice}
          </span>
        </span>
      </div>

      <div className="cluster-intel">
        <dl>
          <div>
            <dt>Ready</dt>
            <dd>
              {cluster.readyCount}/{cluster.markets.length}
            </dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>{displayCase.resolutionLabel ?? "Pending"}</dd>
          </div>
        </dl>

        <ul>
          {cluster.markets.slice(0, 3).map((market) => {
            const marketCase = getMarketDisplayCase(market);

            return (
              <li key={market.id}>
                <span>{market.title}</span>
                <strong>{marketCase.price ?? "--"}</strong>
              </li>
            );
          })}
        </ul>

        <div className="cluster-actions">
          <Link href={"/markets/" + topMarket.id}>Open details</Link>
          <Link href={"/markets/" + topMarket.id + "#signal"}>YES/NO thesis</Link>
        </div>
      </div>
    </article>
  );
}

function CategoryMarketSection({ cluster }: { cluster: MarketCluster }) {
  return (
    <section className="category-market-section">
      <header>
        <div>
          <p className="eyebrow">Category</p>
          <h3>{cluster.name}</h3>
        </div>
        <span>{cluster.markets.length}</span>
      </header>

      <div className="market-row-list">
        {cluster.markets.slice(0, 6).map((market) => {
          const displayCase = getMarketDisplayCase(market);

          return (
            <Link className="market-row-link" href={"/markets/" + market.id} key={market.id}>
              <span>{market.title}</span>
              <span className="row-price-pair">
                <strong>YES {displayCase.price ?? "--"}</strong>
                <strong>NO {getNoPrice(market) ?? "--"}</strong>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function getMarketClusters(markets: Market[]): MarketCluster[] {
  const groups = new Map<string, Market[]>();

  markets.forEach((market) => {
    const category = market.category?.trim() || "General";
    groups.set(category, [...(groups.get(category) ?? []), market]);
  });

  return Array.from(groups.entries())
    .map(([name, groupedMarkets]) => {
      const marketsForCluster = sortMarketsForConvictionBoard(groupedMarkets);
      const readyCount = marketsForCluster.filter(
        (market) => getMarketDisplayCase(market).boardFitScore >= 70,
      ).length;

      return { name, markets: marketsForCluster, readyCount };
    })
    .sort((left, right) => {
      const countDelta = right.markets.length - left.markets.length;
      if (countDelta !== 0) return countDelta;

      return (
        getMarketDisplayCase(right.markets[0]).boardFitScore -
          getMarketDisplayCase(left.markets[0]).boardFitScore || left.name.localeCompare(right.name)
      );
    });
}

function getNoPrice(market: Market) {
  const price = getMarketPrice(market);
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 1) {
    return null;
  }

  return formatMarketPrice(String(1 - numericPrice));
}
