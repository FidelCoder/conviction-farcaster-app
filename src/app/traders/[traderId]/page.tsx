import { PublicTraderProfile } from "../../../components/PublicTraderProfile";
import { TerminalShell } from "../../../components/TerminalShell";
import {
  getExecutionCapabilities,
  getTraderProfile,
  getTraderStats,
  listMarkets,
  listTraderPositions,
  listTraderSignals,
} from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type TraderPageProps = {
  params: Promise<{ traderId: string }>;
};

export default async function TraderPage({ params }: TraderPageProps) {
  const { traderId } = await params;
  const [trader, stats, signals, positions, markets, execution] = await Promise.all([
    getTraderProfile(traderId),
    getTraderStats(traderId),
    listTraderSignals(traderId),
    listTraderPositions(traderId),
    listMarkets(),
    getExecutionCapabilities(),
  ]);

  return (
    <TerminalShell activeTab="activity" execution={execution} marketCount={markets.length}>
      <PublicTraderProfile
        markets={markets}
        positions={positions}
        signals={signals}
        stats={stats}
        trader={trader}
        traderId={traderId}
      />
    </TerminalShell>
  );
}
