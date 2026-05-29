import { EmptyState } from "../../../components/EmptyState";
import { MarginDesk } from "../../../components/MarginDesk";
import { SignalCard } from "../../../components/SignalCard";
import { SignalComposer } from "../../../components/SignalComposer";
import { getExecutionCapabilities, getMarket, listMarketSignals } from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type MarketPageProps = {
  params: Promise<{ marketId: string }>;
};

export default async function MarketPage({ params }: MarketPageProps) {
  const { marketId } = await params;
  const [market, signals, execution] = await Promise.all([
    getMarket(marketId),
    listMarketSignals(marketId),
    getExecutionCapabilities(),
  ]);

  if (!market) {
    return (
      <main className="page-shell">
        <EmptyState
          title="Market not found"
          body="The core API did not return a market for this ID."
        />
      </main>
    );
  }

  return (
    <main className="page-shell wide">
      <MarginDesk execution={execution} markets={[market]} />
      <SignalComposer anchorId="signal" markets={[market]} />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Market signals</h2>
        </div>
      </section>

      {signals.length > 0 ? (
        <section className="card-grid">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </section>
      ) : (
        <EmptyState title="No signals yet" body="The core API has no signals for this market." />
      )}
    </main>
  );
}
