import Link from "next/link";

import type { LeaderboardEntry } from "../lib/core-api";

export function LeaderboardCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <article className="card leaderboard-card">
      <div className="leaderboard-rank">#{entry.rank}</div>
      <div className="leaderboard-body">
        <div className="leaderboard-title">
          <div>
            <p className="card-kicker">Trader</p>
            <h3>{entry.handle}</h3>
          </div>
          <Link className="text-link" href={"/traders/" + entry.traderProfileId}>
            Open
          </Link>
        </div>

        <dl className="stats-strip">
          <div>
            <dt>Signals</dt>
            <dd>{entry.numberOfSignals}</dd>
          </div>
          <div>
            <dt>Copy intents</dt>
            <dd>{entry.numberOfCopyIntents}</dd>
          </div>
          <div>
            <dt>Copied volume</dt>
            <dd>{entry.copiedVolume}</dd>
          </div>
          <div>
            <dt>Executed volume</dt>
            <dd>{formatNullableMetric(entry.executedCopiedVolume)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function formatNullableMetric(value: string | null) {
  return value ?? "Not available";
}
