import Link from "next/link";

import type { Position } from "../lib/core-api";
import { CopyIntentButton } from "./CopyIntentButton";

export function PositionCard({
  position,
  showCopyIntent = false,
}: {
  position: Position;
  showCopyIntent?: boolean;
}) {
  return (
    <article className="card position-card">
      <div className="card-kicker">
        <span>{position.side}</span>
        <span className="status-pill">{position.status}</span>
      </div>
      <h3>
        <Link href={"/positions/" + position.id}>{position.quantity} shares</Link>
      </h3>
      <dl className="metric-list">
        <div>
          <dt>Market</dt>
          <dd>
            <Link href={"/markets/" + position.marketId}>{position.marketId}</Link>
          </dd>
        </div>
        <div>
          <dt>Entry price</dt>
          <dd>{position.averageEntryPrice ?? "No confirmed execution"}</dd>
        </div>
        {position.observedMarketPrice ? (
          <div>
            <dt>Observed price</dt>
            <dd>{position.observedMarketPrice}</dd>
          </div>
        ) : null}
      </dl>
      {position.status === "PENDING_EXECUTION" ? (
        <p className="notice">Execution not yet enabled.</p>
      ) : null}
      {showCopyIntent ? <CopyIntentButton positionId={position.id} /> : null}
    </article>
  );
}
