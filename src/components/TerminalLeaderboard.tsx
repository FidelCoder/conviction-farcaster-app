import Link from "next/link";

import type { LeaderboardEntry } from "../lib/core-api";

type TerminalLeaderboardProps = {
  leaderboard: LeaderboardEntry[];
};

export function TerminalLeaderboard({ leaderboard }: TerminalLeaderboardProps) {
  const totalSignals = leaderboard.reduce((sum, entry) => sum + entry.numberOfSignals, 0);
  const totalCopyIntents = leaderboard.reduce((sum, entry) => sum + entry.numberOfCopyIntents, 0);
  const topTrader = leaderboard[0]?.handle ?? "No leader yet";

  return (
    <main className="terminal-page terminal-account-page terminal-leaderboard-page">
      <section className="terminal-page-heading">
        <div>
          <p>Leaderboard</p>
          <h1>Trader rankings</h1>
          <span>Ranked .viction profiles from real signals, copy intents, and public activity recorded by core.</span>
        </div>
        <div className="my-activity-actions">
          <Link className="text-link" href="/activity">Open Pulse</Link>
          <Link className="text-link" href="/markets">Find markets</Link>
        </div>
      </section>

      <section className="terminal-leaderboard-summary" aria-label="Leaderboard overview">
        <SummaryCard label="Ranked traders" value={leaderboard.length} />
        <SummaryCard label="Signals" value={totalSignals} />
        <SummaryCard label="Copy intents" value={totalCopyIntents} />
        <SummaryCard label="Top trader" value={topTrader} />
      </section>

      <section className="terminal-leaderboard-list" aria-label="Trader rankings">
        {leaderboard.length > 0 ? (
          leaderboard.map((entry) => <TerminalLeaderboardRow entry={entry} key={entry.traderProfileId} />)
        ) : (
          <div className="terminal-leaderboard-empty">
            <strong>No trader stats yet</strong>
            <span>Signals, copy intents, and public activity will appear here once recorded by core.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TerminalLeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <article className="terminal-leaderboard-row">
      <div className="terminal-leaderboard-rank">#{entry.rank}</div>
      <div className="terminal-leaderboard-profile">
        <span>Trader</span>
        <strong>{entry.handle}</strong>
      </div>
      <dl>
        <div>
          <dt>Signals</dt>
          <dd>{entry.numberOfSignals}</dd>
        </div>
        <div>
          <dt>Copy intents</dt>
          <dd>{entry.numberOfCopyIntents}</dd>
        </div>
        <div>
          <dt>Copied volume</dt>
          <dd>{entry.copiedVolume}</dd>
        </div>
        <div>
          <dt>Executed</dt>
          <dd>{entry.executedCopiedVolume ?? "--"}</dd>
        </div>
      </dl>
      <Link href={"/traders/" + entry.traderProfileId}>View profile</Link>
    </article>
  );
}
