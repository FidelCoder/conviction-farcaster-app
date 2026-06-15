import { BrowserTerminal } from "../components/BrowserTerminal";
import { getExecutionCapabilities, getSocialFeed, listLeaderboard, listMarkets } from "../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets Browser Terminal",
  description: "Core-backed prediction market terminal for browser wallets and margin intents.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Launch terminal",
});

export default async function HomePage() {
  const [markets, execution, socialFeedResult, leaderboard] = await Promise.all([
    listMarkets(),
    getExecutionCapabilities(),
    getSocialFeed({ limit: 40 }),
    listLeaderboard(12),
  ]);

  return (
    <BrowserTerminal
      execution={execution}
      leaderboard={leaderboard}
      markets={markets}
      socialFeed={socialFeedResult.feed}
    />
  );
}
