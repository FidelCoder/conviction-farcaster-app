import { BrowserTerminal, type TerminalTab } from "./BrowserTerminal";
import { getExecutionCapabilities, getSocialFeed, listLeaderboard, listMarkets } from "../lib/core-api";

type TerminalRoutePageProps = {
  initialMarketId?: string;
  initialTab?: TerminalTab;
};

export async function TerminalRoutePage({ initialMarketId, initialTab = "landing" }: TerminalRoutePageProps) {
  const [markets, execution, socialFeedResult, leaderboard] = await Promise.all([
    listMarkets(),
    getExecutionCapabilities(),
    getSocialFeed({ limit: 40 }),
    listLeaderboard(12),
  ]);

  return (
    <BrowserTerminal
      execution={execution}
      initialMarketId={initialMarketId}
      initialTab={initialTab}
      leaderboard={leaderboard}
      markets={markets}
      socialFeed={socialFeedResult.feed}
    />
  );
}
