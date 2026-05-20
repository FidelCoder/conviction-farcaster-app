import type { TraderProfile } from "../lib/core-api";

export function TraderCard({
  trader,
  traderId,
}: {
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
