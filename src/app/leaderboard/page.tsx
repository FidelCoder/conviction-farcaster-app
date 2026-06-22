import { TerminalLeaderboard } from "../../components/TerminalLeaderboard";
import { TerminalShell } from "../../components/TerminalShell";
import { getExecutionCapabilities, listLeaderboard, listMarkets } from "../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Prediction Market Trader Leaderboard",
  description: "Ranked Conviction traders, signals, and copy activity from recorded platform data.",
  imagePath: getMiniAppImagePath("leaderboard"),
  targetPath: "/leaderboard",
  buttonTitle: "Open leaderboard",
});

export default async function LeaderboardPage() {
  const [leaderboard, execution, markets] = await Promise.all([
    listLeaderboard(50),
    getExecutionCapabilities(),
    listMarkets(),
  ]);

  return (
    <TerminalShell activeTab="leaderboard" execution={execution} marketCount={markets.length}>
      <TerminalLeaderboard leaderboard={leaderboard} />
    </TerminalShell>
  );
}
