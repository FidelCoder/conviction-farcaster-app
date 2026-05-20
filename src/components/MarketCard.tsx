import Link from "next/link";

import type { Market } from "../lib/core-api";

export function MarketCard({ market }: { market: Market }) {
  const price = market.lastTradePrice ?? market.bestAsk ?? market.bestBid ?? null;

  return (
    <article className="card market-card">
      <div className="card-kicker">
        <span>{market.source}</span>
        <span className="status-pill">{market.status}</span>
      </div>
      <h3>
        <Link href={"/markets/" + market.id}>{market.title}</Link>
      </h3>
      {market.description ? <p>{market.description}</p> : null}
      <dl className="metric-list">
        {market.category ? (
          <div>
            <dt>Category</dt>
            <dd>{market.category}</dd>
          </div>
        ) : null}
        {price ? (
          <div>
            <dt>Observed price</dt>
            <dd>{price}</dd>
          </div>
        ) : null}
        {market.resolutionDate ? (
          <div>
            <dt>Resolution</dt>
            <dd>{formatDate(market.resolutionDate)}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}
