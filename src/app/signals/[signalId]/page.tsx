import type { Metadata } from "next";

import { EmptyState } from "../../../components/EmptyState";
import { PositionCard } from "../../../components/PositionCard";
import { SignalCard } from "../../../components/SignalCard";
import { getMarket, getSignal, getTraderProfile, listTraderPositions } from "../../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../../lib/miniapp";

export const dynamic = "force-dynamic";

type SignalPageProps = {
  params: Promise<{ signalId: string }>;
};

export async function generateMetadata({ params }: SignalPageProps): Promise<Metadata> {
  const { signalId } = await params;
  const signal = await getSignal(signalId);

  return createMiniAppPageMetadata({
    title: signal ? signal.side + " signal" : "Signal",
    description: signal?.thesis ?? "Signal details from the Conviction Markets core API.",
    imagePath: getMiniAppImagePath("signal", signalId),
    targetPath: "/signals/" + signalId,
    buttonTitle: "Open signal",
  });
}

export default async function SignalPage({ params }: SignalPageProps) {
  const { signalId } = await params;
  const signal = await getSignal(signalId);

  if (!signal) {
    return (
      <main className="page-shell">
        <EmptyState
          title="Signal not found"
          body="The core API did not return a signal for this ID."
        />
      </main>
    );
  }

  const [market, trader, traderPositions] = await Promise.all([
    getMarket(signal.marketId),
    getTraderProfile(signal.traderProfileId),
    listTraderPositions(signal.traderProfileId),
  ]);
  const sourcePositions = traderPositions.filter(
    (position) => position.marketId === signal.marketId,
  );

  return (
    <main className="page-shell">
      <SignalCard market={market} signal={signal} trader={trader} />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Copy flow</p>
          <h2>Copy real position intents</h2>
        </div>
      </section>

      {sourcePositions.length > 0 ? (
        <section className="card-grid">
          {sourcePositions.map((position) => (
            <PositionCard
              key={position.id}
              market={market}
              position={position}
              showCopyIntent
              sourceSignalId={signal.id}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No copyable position yet"
          body="This post is a market call. Copy intents require a real source position from the trader on the same market."
        />
      )}
    </main>
  );
}
