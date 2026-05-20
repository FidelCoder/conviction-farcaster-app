import { EmptyState } from "../../../components/EmptyState";
import { PositionCard } from "../../../components/PositionCard";
import { SignalCard } from "../../../components/SignalCard";
import { TraderCard } from "../../../components/TraderCard";
import { getTraderProfile, listTraderPositions, listTraderSignals } from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type TraderPageProps = {
  params: Promise<{ traderId: string }>;
};

export default async function TraderPage({ params }: TraderPageProps) {
  const { traderId } = await params;
  const [trader, signals, positions] = await Promise.all([
    getTraderProfile(traderId),
    listTraderSignals(traderId),
    listTraderPositions(traderId),
  ]);

  return (
    <main className="page-shell">
      <TraderCard trader={trader} traderId={traderId} />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Trader signals</h2>
        </div>
      </section>
      {signals.length > 0 ? (
        <section className="card-grid">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No signals returned"
          body="The core API returned no signals for this trader."
        />
      )}

      <section className="section-heading">
        <div>
          <p className="eyebrow">Positions</p>
          <h2>Trader positions</h2>
        </div>
      </section>
      {positions.length > 0 ? (
        <section className="card-grid">
          {positions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No positions returned"
          body="The core API returned no positions for this trader."
        />
      )}
    </main>
  );
}
