import Link from "next/link";

import { EmptyState } from "../../components/EmptyState";
import { MarketCard } from "../../components/MarketCard";
import type { Market } from "../../lib/core-api";
import { listMarkets } from "../../lib/core-api";
import {
  getMarketBoardStats,
  getMarketDisplayCase,
  sortMarketsForConvictionBoard,
} from "../../lib/market-display";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const markets = await listMarkets();
  const rankedMarkets = sortMarketsForConvictionBoard(markets);
  const boardStats = getMarketBoardStats(markets);
  const qualifiedMarkets = rankedMarkets.filter(
    (market) => getMarketDisplayCase(market).boardFitScore >= 70,
  );
  const boardMarkets = (qualifiedMarkets.length > 0 ? qualifiedMarkets : rankedMarkets).slice(0, 6);
  const boardIds = new Set(boardMarkets.map((market) => market.id));
  const monitoringMarkets = rankedMarkets.filter((market) => !boardIds.has(market.id)).slice(0, 12);
  const categories = getCategorySummary(rankedMarkets);
  const boardTitle = qualifiedMarkets.length > 0 ? "Conviction board" : "Synced market queue";

  return (
    <main className="page-shell app-layer-shell">
      <section className="app-board-hero" aria-labelledby="markets-title">
        <div className="app-title-lockup">
          <p className="eyebrow">Farcaster market layer</p>
          <h1 id="markets-title">Markets with enough signal to act on.</h1>
          <p>
            Active, mapped, and priced records surface first. The app keeps weaker records in the
            monitoring queue until the core API has better real metadata.
          </p>
        </div>
        <Link className="app-hero-action" href="/margin">
          Open margin desk
        </Link>
        <dl className="app-board-stats" aria-label="Market board composition">
          <div>
            <dt>Qualified</dt>
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

      {categories.length > 0 ? (
        <section className="category-board" aria-label="Synced market categories">
          {categories.map((category) => (
            <div key={category.name}>
              <span>{category.name}</span>
              <strong>{category.count}</strong>
            </div>
          ))}
        </section>
      ) : null}

      {markets.length > 0 ? (
        <>
          <section className="section-heading conviction-section-heading">
            <div>
              <p className="eyebrow">
                {qualifiedMarkets.length > 0 ? "Qualified" : "Provider sync"}
              </p>
              <h2>{boardTitle}</h2>
            </div>
            <span>{boardMarkets.length} shown</span>
          </section>

          <section className="conviction-market-grid priority-grid">
            {boardMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </section>

          {monitoringMarkets.length > 0 ? (
            <>
              <section className="section-heading conviction-section-heading compact-heading">
                <div>
                  <p className="eyebrow">Monitoring</p>
                  <h2>Waiting for stronger market data</h2>
                </div>
                <span>{monitoringMarkets.length} queued</span>
              </section>

              <section className="conviction-market-grid monitoring-grid">
                {monitoringMarkets.map((market) => (
                  <MarketCard key={market.id} market={market} compact />
                ))}
              </section>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No markets yet"
          body="Markets have not been synced into the core API, or the core API is not reachable."
        />
      )}
    </main>
  );
}

function getCategorySummary(markets: Market[]) {
  const counts = new Map<string, number>();

  markets.forEach((market) => {
    const category = market.category?.trim() || "General";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 6);
}
