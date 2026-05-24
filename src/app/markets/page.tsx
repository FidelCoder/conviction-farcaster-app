import Link from "next/link";

import { EmptyState } from "../../components/EmptyState";
import { MarketCard } from "../../components/MarketCard";
import { listMarkets } from "../../lib/core-api";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const markets = await listMarkets();

  return (
    <main className="page-shell">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Markets</p>
          <h1>Synced markets</h1>
        </div>
        <Link className="primary-link" href="/margin">
          Open margin desk
        </Link>
      </section>

      {markets.length > 0 ? (
        <section className="card-grid">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No markets yet"
          body="Markets have not been synced into the core API, or the core API is not reachable."
        />
      )}
    </main>
  );
}
