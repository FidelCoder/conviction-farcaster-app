import { getFarcasterBetaReadiness } from "../../lib/beta-readiness";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Farcaster Beta Readiness",
  description: "Deployment checks for Conviction Markets Farcaster beta.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/beta-readiness",
  buttonTitle: "Check beta readiness",
});

export default async function BetaReadinessPage() {
  const readiness = await getFarcasterBetaReadiness();
  const blockingIssues = readiness.checks.filter((check) => check.status === "fail").length;
  const warnings = readiness.checks.filter((check) => check.status === "warn").length;

  return (
    <main className="page-shell">
      <section className="page-heading compact">
        <p className="eyebrow">Farcaster beta</p>
        <h1>Readiness checks</h1>
      </section>

      <section className="market-overview-band" aria-label="Beta readiness overview">
        <dl className="market-summary horizontal">
          <div>
            <dt>Blocking</dt>
            <dd>{blockingIssues}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{warnings}</dd>
          </div>
          <div>
            <dt>Markets</dt>
            <dd>{readiness.marketsCount}</dd>
          </div>
          <div>
            <dt>Leaderboard</dt>
            <dd>{readiness.leaderboardEntries}</dd>
          </div>
        </dl>
      </section>

      <section className="readiness-list">
        {readiness.checks.map((check) => (
          <article className={"readiness-check " + check.status} key={check.label}>
            <div>
              <p className="card-kicker">{check.status}</p>
              <h2>{check.label}</h2>
            </div>
            <p>{check.detail}</p>
          </article>
        ))}
      </section>

      <section className="card readiness-config">
        <div className="card-kicker">Runtime</div>
        <dl className="metric-list">
          <div>
            <dt>App URL</dt>
            <dd>{readiness.appUrl}</dd>
          </div>
          <div>
            <dt>Core API</dt>
            <dd>{readiness.coreApiUrl}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{readiness.manifestUrl}</dd>
          </div>
          <div>
            <dt>Margin intents</dt>
            <dd>{readiness.marginIntentsEnabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>{readiness.marginExecutionEnabled ? "Enabled" : "Intent only"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
