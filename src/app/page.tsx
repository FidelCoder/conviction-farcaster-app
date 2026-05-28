import Link from "next/link";

import { EmptyState } from "../components/EmptyState";
import { MarginDesk } from "../components/MarginDesk";
import { MarketCard } from "../components/MarketCard";
import { SignalComposer } from "../components/SignalComposer";
import { getExecutionCapabilities, listMarkets } from "../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets",
  description: "Farcaster margin layer for real Conviction Markets data.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Open margin desk",
});

export default async function HomePage() {
  const [markets, execution] = await Promise.all([listMarkets(), getExecutionCapabilities()]);
  const featuredMarkets = markets.slice(0, 6);
  return (
    <main className="page-shell wide">
      <MarginDesk execution={execution} markets={markets} />
      <SignalComposer markets={markets} />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Market board</p>
          <h2>Live synced markets</h2>
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
        <EmptyState
          title="No markets yet"
          body="Markets have not been synced into the core API, or the core API is not reachable."
        />
      )}
    </main>
  );
}
