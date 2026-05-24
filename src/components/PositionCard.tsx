import Link from "next/link";

import type { Market, Position } from "../lib/core-api";
import { executionStatusLabel, executionStatusNotice } from "../lib/display";
import { getWarpcastShareUrl } from "../lib/miniapp";
import { CopyIntentButton } from "./CopyIntentButton";

export function PositionCard({
  copyCount,
  market,
  position,
  showCopyIntent = false,
}: {
  copyCount?: number;
  market?: Market | null;
  position: Position;
  showCopyIntent?: boolean;
}) {
  const notice = executionStatusNotice(position.status);
  const sharePath = "/positions/" + position.id;

  return (
    <article className={"card position-card side-" + position.side.toLowerCase()}>
      <div className="card-kicker">
        <span>{position.side}</span>
        <span className="status-pill">{executionStatusLabel(position.status)}</span>
      </div>
      <h3>
        <Link href={"/positions/" + position.id}>{position.quantity} shares</Link>
      </h3>
      <dl className="metric-list">
        <div>
          <dt>Market</dt>
          <dd>
            <Link href={"/markets/" + position.marketId}>{market?.title ?? position.marketId}</Link>
          </dd>
        </div>
        {typeof copyCount === "number" ? (
          <div>
            <dt>Copy count</dt>
            <dd>{copyCount}</dd>
          </div>
        ) : null}
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
      {notice ? <p className="notice">{notice}</p> : null}
      {showCopyIntent ? <CopyIntentButton positionId={position.id} /> : null}
      <a
        className="secondary-link"
        href={getWarpcastShareUrl({
          path: sharePath,
          text: position.side + " position intent on Conviction Markets",
        })}
        rel="noreferrer"
        target="_blank"
      >
        Share on Farcaster
      </a>
    </article>
  );
}
