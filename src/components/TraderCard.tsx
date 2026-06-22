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

  const avatarUrl = trader.avatarUrl;
  const handle = trader.handle;
  const initial = handle.slice(0, 1).toUpperCase();

  return (
    <article className="card trader-card">
      <div className="card-kicker">Trader</div>
      <div className="trader-card-header">
        <div className="trader-avatar">
          {avatarUrl ? (
            <img
              alt={handle}
              className="trader-avatar-img"
              src={avatarUrl}
            />
          ) : (
            <div className="trader-avatar-fallback">
              {initial}
            </div>
          )}
        </div>
        <div className="trader-card-name">
          <h3>{handle}</h3>
          {trader.bio ? <p>{trader.bio}</p> : null}
        </div>
      </div>
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
