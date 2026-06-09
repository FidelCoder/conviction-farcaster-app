import Link from "next/link";
import type { CSSProperties } from "react";

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
  const categories = getMarketCategories(rankedMarkets);
  const visibleMarkets = rankedMarkets.slice(0, 24);

  return (
    <main className="markets-browse-shell">
      <section className="markets-browse-toolbar" aria-label="Market navigation">
        <div className="browse-brand-lockup">
          <Link className="browse-brand" href="/">
            Conviction
          </Link>
          <nav aria-label="Primary market navigation">
            <Link aria-current="page" href="/markets">
              Markets
            </Link>
            <Link href="/margin">Margin</Link>
            <Link href="/leaderboard">Social</Link>
            <Link href="/me">Portfolio</Link>
          </nav>
        </div>

        <label className="browse-search" htmlFor="market-search-preview">
          <span aria-hidden="true" className="search-icon" />
          <input
            disabled
            id="market-search-preview"
            placeholder="Search real synced markets"
            type="search"
          />
        </label>

        <Link className="browse-open-margin" href="/margin">
          Open margin
        </Link>
      </section>

      <nav className="browse-category-strip" aria-label="Market categories">
        <span className="category-all">Trending</span>
        {categories.slice(0, 9).map((category) => (
          <span key={category}>{category}</span>
        ))}
      </nav>

      <section className="markets-browse-header" aria-labelledby="markets-title">
        <div>
          <p className="eyebrow">Browse markets</p>
          <h1 id="markets-title">Prediction markets worth a side.</h1>
        </div>
        <dl className="browse-stat-strip" aria-label="Market board composition">
          <div>
            <dt>Actionable</dt>
            <dd>{boardStats.qualified}</dd>
          </div>
          <div>
            <dt>Priced</dt>
            <dd>{boardStats.priced}</dd>
          </div>
          <div>
            <dt>YES/NO</dt>
            <dd>{boardStats.mapped}</dd>
          </div>
          <div>
            <dt>Synced</dt>
            <dd>{boardStats.total}</dd>
          </div>
        </dl>
      </section>

      <section className="browse-filter-row" aria-label="Market filters">
        <button type="button">Trending</button>
        <button type="button">Frequency</button>
        <button type="button">All categories</button>
        <button aria-label="More filters" type="button">
          More
        </button>
      </section>

      {visibleMarkets.length > 0 ? (
        <section className="prediction-card-grid" aria-label="Prediction markets">
          {visibleMarkets.map((market) => (
            <PredictionMarketCard key={market.id} market={market} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No markets yet"
          body="Markets are not available from the core API yet."
        />
      )}
    </main>
  );
}

function PredictionMarketCard({ market }: { market: Market }) {
  const displayCase = getMarketDisplayCase(market);
  const yesPrice = displayCase.price ?? "--";
  const noPrice = getNoPrice(market) ?? "--";
  const probability = getMarketProbability(market);
  const noProbability = probability === null ? null : Math.max(0, 1 - probability);
  const category = market.category?.trim() || market.source;
  const resolution = displayCase.resolutionLabel ?? "Close date pending";

  return (
    <article className="prediction-market-card">
      <Link className="prediction-card-link" href={"/markets/" + market.id}>
        <div className="prediction-card-topline">
          <span className="market-avatar" aria-hidden="true">
            {getCategoryInitial(category)}
          </span>
          <span className="market-card-category">{category}</span>
          <span className="market-card-status">{displayCase.label}</span>
        </div>

        <h2>{market.title}</h2>
        <p className="market-card-resolution">{resolution}</p>

        <div className="outcome-stack" aria-label="Outcome prices">
          <OutcomeRow
            color="yes"
            label="YES"
            name={getOutcomeLabel(market, "YES")}
            probability={probability}
            price={yesPrice}
          />
          <OutcomeRow
            color="no"
            label="NO"
            name={getOutcomeLabel(market, "NO")}
            probability={noProbability}
            price={noPrice}
          />
        </div>

        <footer className="prediction-card-footer">
          <span>{market.externalUrl ? "Provider market" : "Core market"}</span>
          <span>{market.yesTokenId && market.noTokenId ? "YES/NO mapped" : "Mapping pending"}</span>
        </footer>
      </Link>
    </article>
  );
}

function OutcomeRow({
  color,
  label,
  name,
  price,
  probability,
}: {
  color: "yes" | "no";
  label: string;
  name: string;
  price: string;
  probability: number | null;
}) {
  return (
    <div className={"outcome-row " + color}>
      <div className="outcome-identity">
        <span>{label}</span>
        <strong>{name}</strong>
      </div>
      <span className="outcome-line" style={getOutcomeLineStyle(probability)} />
      <strong className="outcome-price">{price}</strong>
    </div>
  );
}

function getMarketCategories(markets: Market[]) {
  const categories = new Set<string>();

  markets.forEach((market) => {
    const category = market.category?.trim();

    if (category) {
      categories.add(category);
    }
  });

  return Array.from(categories).sort((left, right) => left.localeCompare(right));
}

function getMarketProbability(market: Market) {
  const price = getMarketPrice(market);
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 1) {
    return null;
  }

  return numericPrice;
}

function getNoPrice(market: Market) {
  const probability = getMarketProbability(market);

  if (probability === null) {
    return null;
  }

  return formatMarketPrice(String(1 - probability));
}

function getOutcomeLineStyle(probability: number | null) {
  const width = probability === null ? "18%" : Math.max(8, Math.min(92, probability * 100)) + "%";

  return { "--outcome-width": width } as CSSProperties;
}

function getOutcomeLabel(market: Market, side: "YES" | "NO") {
  if (side === "YES") {
    return trimMarketTitle(market.title);
  }

  return "Not " + trimMarketTitle(market.title);
}

function trimMarketTitle(title: string) {
  const compact = title
    .replace(/^Will\s+/i, "")
    .replace(/\?$/, "")
    .trim();

  return compact.length > 34 ? compact.slice(0, 31).trimEnd() + "..." : compact;
}

function getCategoryInitial(category: string) {
  return (
    category
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 1)
      .toUpperCase() || "C"
  );
}
