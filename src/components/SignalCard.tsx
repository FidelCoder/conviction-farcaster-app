import Link from "next/link";

import type { Market, TraderProfile, TradeSignal } from "../lib/core-api";
import { formatDate, signalStatusLabel } from "../lib/display";
import { getWarpcastShareUrl } from "../lib/miniapp";

export function SignalCard({
  copyCount,
  market,
  signal,
  trader,
}: {
  copyCount?: number | null;
  market?: Market | null;
  signal: TradeSignal;
  trader?: TraderProfile | null;
}) {
  const sharePath = "/signals/" + signal.id;

  return (
    <article className={"card signal-card side-" + signal.side.toLowerCase()}>
      <div className="card-kicker">
        <span>{signal.source}</span>
        <span className="status-pill">{signalStatusLabel()}</span>
      </div>
      <h3>
        <Link href={"/signals/" + signal.id}>{signal.side} signal</Link>
      </h3>
      <p>{signal.thesis}</p>
      <dl className="metric-list">
        <div>
          <dt>Market</dt>
          <dd>
            <Link href={"/markets/" + signal.marketId}>{market?.title ?? signal.marketId}</Link>
          </dd>
        </div>
        <div>
          <dt>Trader</dt>
          <dd>
            <Link href={"/traders/" + signal.traderProfileId}>
              {trader?.handle ?? signal.traderProfileId}
            </Link>
          </dd>
        </div>
        {typeof copyCount === "number" ? (
          <div>
            <dt>Copy count</dt>
            <dd>{copyCount}</dd>
          </div>
        ) : null}
        <div>
          <dt>Created</dt>
          <dd>{formatDate(signal.createdAt)}</dd>
        </div>
      </dl>
      <a
        className="secondary-link"
        href={getWarpcastShareUrl({
          path: sharePath,
          text: signal.side + " signal on Conviction Markets",
        })}
        rel="noreferrer"
        target="_blank"
      >
        Share on Farcaster
      </a>
    </article>
  );
}
