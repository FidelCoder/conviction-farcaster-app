import Link from "next/link";

import type { TradeSignal } from "../lib/core-api";

export function SignalCard({ signal }: { signal: TradeSignal }) {
  return (
    <article className="card signal-card">
      <div className="card-kicker">
        <span>{signal.source}</span>
        <span className="status-pill">{signal.status}</span>
      </div>
      <h3>
        <Link href={"/signals/" + signal.id}>{signal.side} signal</Link>
      </h3>
      <p>{signal.thesis}</p>
      <dl className="metric-list">
        <div>
          <dt>Market</dt>
          <dd>
            <Link href={"/markets/" + signal.marketId}>{signal.marketId}</Link>
          </dd>
        </div>
        <div>
          <dt>Trader</dt>
          <dd>
            <Link href={"/traders/" + signal.traderProfileId}>{signal.traderProfileId}</Link>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(signal.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}
