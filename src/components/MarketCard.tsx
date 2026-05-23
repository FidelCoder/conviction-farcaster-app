import Link from "next/link";

import type { Market } from "../lib/core-api";
import { formatDate } from "../lib/display";

export function MarketCard({ market }: { market: Market }) {
  const priceRows = [
    { label: "Last", value: market.lastTradePrice },
    { label: "Bid", value: market.bestBid },
    { label: "Ask", value: market.bestAsk },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const statusClass = "status-" + market.status.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <article className={"card market-card " + statusClass}>
      <div className="card-kicker">
        <span>{market.source}</span>
        <span className="status-pill">{market.status}</span>
      </div>

      <div className="market-card-title">
        <h3>
          <Link href={"/markets/" + market.id}>{market.title}</Link>
        </h3>
        <span className="market-map-state">
          {market.yesTokenId && market.noTokenId ? "YES/NO mapped" : "Token mapping pending"}
        </span>
      </div>

      {market.description ? <p>{market.description}</p> : null}

      {priceRows.length > 0 ? (
        <dl className="price-strip">
          {priceRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="subtle-note">No live price snapshot stored yet.</p>
      )}

      <dl className="metric-list">
        {market.category ? (
          <div>
            <dt>Category</dt>
            <dd>{market.category}</dd>
          </div>
        ) : null}
        {market.resolutionDate ? (
          <div>
            <dt>Resolution</dt>
            <dd>{formatDate(market.resolutionDate)}</dd>
          </div>
        ) : null}
        {market.syncedAt ? (
          <div>
            <dt>Synced</dt>
            <dd>{formatDate(market.syncedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {market.externalUrl ? (
        <a className="text-link" href={market.externalUrl} rel="noreferrer" target="_blank">
          View source market
        </a>
      ) : null}
    </article>
  );
}
