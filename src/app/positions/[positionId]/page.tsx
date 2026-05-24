import type { Metadata } from "next";

import { EmptyState } from "../../../components/EmptyState";
import { PositionCard } from "../../../components/PositionCard";
import { getMarket, getPosition, listPositionCopyIntents } from "../../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../../lib/miniapp";

export const dynamic = "force-dynamic";

type PositionPageProps = {
  params: Promise<{ positionId: string }>;
};

export async function generateMetadata({ params }: PositionPageProps): Promise<Metadata> {
  const { positionId } = await params;
  const position = await getPosition(positionId);

  return createMiniAppPageMetadata({
    title: position ? position.side + " position intent" : "Position",
    description: position
      ? "Position intent status: " + position.status
      : "Position details from the Conviction Markets core API.",
    imagePath: getMiniAppImagePath("position", positionId),
    targetPath: "/positions/" + positionId,
    buttonTitle: "Open position",
  });
}

export default async function PositionPage({ params }: PositionPageProps) {
  const { positionId } = await params;
  const position = await getPosition(positionId);

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

  const [copyIntents, market] = await Promise.all([
    listPositionCopyIntents(position.id),
    getMarket(position.marketId),
  ]);

  return (
    <main className="page-shell">
      <PositionCard
        copyCount={copyIntents.length}
        market={market}
        position={position}
        showCopyIntent
      />

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
