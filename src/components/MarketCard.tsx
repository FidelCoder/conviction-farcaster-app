import Link from "next/link";

import type { Market } from "../lib/core-api";
import { formatDate } from "../lib/display";
import { formatMarketPrice, getMarketDisplayCase, getSourceInitials } from "../lib/market-display";

export function MarketCard({ market, compact = false }: { market: Market; compact?: boolean }) {
  const displayCase = getMarketDisplayCase(market);
  const priceRows = [
    { label: "Last", value: market.lastTradePrice },
    { label: "Bid", value: market.bestBid },
    { label: "Ask", value: market.bestAsk },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const statusClass = "status-" + market.status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const detailRows = [
    market.category ? { label: "Category", value: market.category } : null,
    displayCase.resolutionLabel
      ? { label: "Resolution", value: displayCase.resolutionLabel }
      : null,
    market.syncedAt ? { label: "Synced", value: formatDate(market.syncedAt) } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <article
      className={(
        "card market-card conviction-card " +
        statusClass +
        (compact ? " compact" : "")
      ).trim()}
    >
      <div className="market-card-top">
        <div className="market-avatar" aria-hidden="true">
          {getSourceInitials(market.source)}
        </div>
        <div className="market-card-heading">
          <div className="card-kicker">
            <span>{market.source}</span>
            <span className="status-pill">{displayCase.label}</span>
          </div>
          <h3>
            <Link href={"/markets/" + market.id}>{market.title}</Link>
          </h3>
        </div>
        <div className="market-price-callout">
          <span>Price</span>
          <strong>{displayCase.price ?? "--"}</strong>
        </div>
      </div>

      {!compact && market.description ? <p>{market.description}</p> : null}

      <div
        className="case-meter"
        aria-label={"Board fit " + displayCase.boardFitScore + " percent"}
      >
        <span style={{ width: displayCase.boardFitScore + "%" }} />
      </div>

      <ul className="case-list">
        {displayCase.reasons.slice(0, compact ? 3 : 4).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {priceRows.length > 0 ? (
        <dl className="price-strip market-price-strip">
          {priceRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{formatMarketPrice(row.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="subtle-note">No live price snapshot stored yet.</p>
      )}

      {detailRows.length > 0 ? (
        <dl className="metric-list market-detail-list">
          {detailRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="card-actions conviction-card-actions">
        <Link className="secondary-link" href={"/markets/" + market.id}>
          Open market
        </Link>
        <Link className="text-link" href={"/markets/" + market.id + "#signal"}>
          Create signal
        </Link>
        {market.externalUrl ? (
          <a className="text-link" href={market.externalUrl} rel="noreferrer" target="_blank">
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
