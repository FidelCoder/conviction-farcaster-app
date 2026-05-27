import { EmptyState } from "../../components/EmptyState";
import { LeaderboardCard } from "../../components/LeaderboardCard";
import { listLeaderboard } from "../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Leaderboard",
  description: "Real trader stats from Conviction Markets records.",
  imagePath: getMiniAppImagePath("leaderboard"),
  targetPath: "/leaderboard",
  buttonTitle: "Open leaderboard",
});

export default async function LeaderboardPage() {
  const leaderboard = await listLeaderboard(50);
  const totalSignals = leaderboard.reduce((sum, entry) => sum + entry.numberOfSignals, 0);
  const totalCopyIntents = leaderboard.reduce((sum, entry) => sum + entry.numberOfCopyIntents, 0);

  return (
    <main className="page-shell">
      <section className="page-heading compact">
        <p className="eyebrow">Leaderboard</p>
        <h1>Real trader activity</h1>
      </section>

      <section className="market-overview-band" aria-label="Leaderboard overview">
        <dl className="market-summary horizontal">
          <div>
            <dt>Ranked traders</dt>
            <dd>{leaderboard.length}</dd>
          </div>
          <div>
            <dt>Signals</dt>
            <dd>{totalSignals}</dd>
          </div>
          <div>
            <dt>Copy intents</dt>
            <dd>{totalCopyIntents}</dd>
          </div>
        </dl>
      </section>

      {leaderboard.length > 0 ? (
        <section className="leaderboard-list">
          {leaderboard.map((entry) => (
            <LeaderboardCard key={entry.traderProfileId} entry={entry} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No trader stats yet"
          body="The core API returned no leaderboard entries from recorded signals or copy intents."
        />
      )}
    </main>
  );
}
