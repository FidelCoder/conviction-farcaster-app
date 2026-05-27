import type { TraderProfile, TraderStats } from "../lib/core-api";

export function TraderCard({
  stats,
  trader,
  traderId,
}: {
  stats?: TraderStats | null;
  trader: TraderProfile | null;
  traderId: string;
}) {
  if (!trader) {
    return (
      <article className="card">
        <div className="card-kicker">Trader</div>
        <h3>{traderId}</h3>
        <p>Trader profile was not returned by the core API.</p>
      </article>
    );
  }

  return (
    <article className="card trader-card">
      <div className="card-kicker">Trader</div>
      <h3>{trader.handle}</h3>
      {trader.bio ? <p>{trader.bio}</p> : null}
      {stats ? (
        <dl className="stats-strip">
          <div>
            <dt>Signals</dt>
            <dd>{stats.numberOfSignals}</dd>
          </div>
          <div>
            <dt>Copy intents</dt>
            <dd>{stats.numberOfCopyIntents}</dd>
          </div>
          <div>
            <dt>Copied volume</dt>
            <dd>{stats.copiedVolume}</dd>
          </div>
          <div>
            <dt>Executed volume</dt>
            <dd>{formatNullableMetric(stats.executedCopiedVolume)}</dd>
          </div>
          <div>
            <dt>Realized PnL</dt>
            <dd>{formatNullableMetric(stats.realizedPnl)}</dd>
          </div>
        </dl>
      ) : null}
      <dl className="metric-list">
        <div>
          <dt>Trader ID</dt>
          <dd>{trader.id}</dd>
        </div>
        <div>
          <dt>User ID</dt>
          <dd>{trader.userId}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatNullableMetric(value: string | null) {
  return value ?? "Not available";
}
