import Link from "next/link";

import { EmptyState } from "../components/EmptyState";
import { MarketCard } from "../components/MarketCard";
import { listMarkets } from "../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets",
  description: "Real prediction-market signals from the Conviction Markets core API.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Open markets",
});

export default async function HomePage() {
  const markets = await listMarkets();
  const featuredMarkets = markets.slice(0, 6);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Real prediction market data</p>
        <h1>Conviction Markets</h1>
        <p>Markets, signals, and positions shown here are read from the core API.</p>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Markets</p>
          <h2>Synced markets</h2>
        </div>
        <Link className="text-link" href="/markets">
          View all
        </Link>
      </section>

      {featuredMarkets.length > 0 ? (
        <section className="card-grid">
          {featuredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </section>
      ) : (
        <EmptyState title="No markets yet" body="Markets have not been synced into the core API." />
      )}
    </main>
  );
}
