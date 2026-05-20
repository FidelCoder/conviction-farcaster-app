import { EmptyState } from "../../../components/EmptyState";
import { PositionCard } from "../../../components/PositionCard";
import { getPosition, listPositionCopyIntents } from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type PositionPageProps = {
  params: Promise<{ positionId: string }>;
};

export default async function PositionPage({ params }: PositionPageProps) {
  const { positionId } = await params;
  const [position, copyIntents] = await Promise.all([
    getPosition(positionId),
    listPositionCopyIntents(positionId),
  ]);

  if (!position) {
    return (
      <main className="page-shell">
        <EmptyState
          title="Position not found"
          body="The core API did not return a position for this ID."
        />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PositionCard position={position} showCopyIntent />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Copy intents</p>
          <h2>Position copy intents</h2>
        </div>
      </section>

      {copyIntents.length > 0 ? (
        <section className="table-panel">
          {copyIntents.map((intent) => (
            <div className="table-row" key={intent.id}>
              <span>{intent.requestedQuantity}</span>
              <span>{intent.status}</span>
              <span>{intent.id}</span>
            </div>
          ))}
        </section>
      ) : (
        <EmptyState
          title="No copy intents"
          body="The core API returned no copy intents for this position."
        />
      )}
    </main>
  );
}
