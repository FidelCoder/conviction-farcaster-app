import { getFarcasterBetaReadiness } from "../../lib/beta-readiness";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Release Readiness",
  description: "Deployment and Polymarket margin release checks for Conviction Markets.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/beta-readiness",
  buttonTitle: "Check readiness",
});

export default async function BetaReadinessPage() {
  const readiness = await getFarcasterBetaReadiness();
  const margin = readiness.polymarketReadiness;
  const blockingIssues =
    readiness.checks.filter(
      (check) => check.status === "fail" && check.label !== "Polymarket margin release",
    ).length + (margin ? margin.gates.filter((gate) => !gate.ready).length : 1);
  const warnings =
    readiness.checks.filter((check) => check.status === "warn").length +
    (margin?.warnings.length ?? 0);
  const readyGates = margin?.gates.filter((gate) => gate.ready).length ?? 0;
  const gateCount = margin?.gates.length ?? 0;

  return (
    <main className="page-shell">
      <section className="page-heading compact">
        <p className="eyebrow">Operations</p>
        <h1>Release readiness</h1>
        <p>Core infrastructure, risk limits, and public app checks from live runtime state.</p>
      </section>

      <section className="market-overview-band" aria-label="Readiness overview">
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
            <dt>Margin mode</dt>
            <dd>{readiness.releaseState.mode.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Release gates</dt>
            <dd>{gateCount ? `${readyGates}/${gateCount}` : "Unavailable"}</dd>
          </div>
        </dl>
      </section>

      {margin ? (
        <>
          <section className="page-heading compact">
            <p className="eyebrow">Polygon pUSD</p>
            <h2>Execution gates</h2>
          </section>
          <section
            className="readiness-list readiness-gates-grid"
            aria-label="Polymarket execution gates"
          >
            {margin.gates.map((gate) => (
              <article className={`readiness-check ${gate.ready ? "pass" : "fail"}`} key={gate.id}>
                <div>
                  <p className="card-kicker">{gate.ready ? "ready" : "blocked"}</p>
                  <h2>{gate.label}</h2>
                </div>
                <p>{gate.detail}</p>
              </article>
            ))}
          </section>

          <section className="card readiness-config">
            <div className="card-kicker">Enforced release limits</div>
            <dl className="metric-list">
              <div>
                <dt>Access</dt>
                <dd>{margin.releasePolicy.mode.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Invited wallets</dt>
                <dd>{margin.releasePolicy.allowedWalletsCount}</dd>
              </div>
              <div>
                <dt>Canary markets</dt>
                <dd>{margin.releasePolicy.allowedMarketsCount}</dd>
              </div>
              <div>
                <dt>Maximum leverage</dt>
                <dd>{formatBpsAsMultiplier(margin.releasePolicy.caps.maxLeverageBps)}</dd>
              </div>
              <div>
                <dt>Position notional</dt>
                <dd>{margin.releasePolicy.caps.maxPositionAssets} pUSD</dd>
              </div>
              <div>
                <dt>Vault TVL</dt>
                <dd>
                  {margin.releasePolicy.currentTvlAssets ?? "Unavailable"} /{" "}
                  {margin.releasePolicy.caps.maxTvlAssets} pUSD
                </dd>
              </div>
              <div>
                <dt>Vault utilization</dt>
                <dd>
                  {formatBps(margin.releasePolicy.currentUtilizationBps)} /{" "}
                  {formatBps(margin.releasePolicy.caps.maxUtilizationBps)}
                </dd>
              </div>
              <div>
                <dt>Daily realized loss</dt>
                <dd>
                  {margin.releasePolicy.dailyRealizedLossAssets ?? "Unavailable"} /{" "}
                  {margin.releasePolicy.caps.dailyLossLimitAssets} pUSD
                </dd>
              </div>
            </dl>
          </section>

          {margin.missing.length || margin.warnings.length ? (
            <section className="card readiness-config">
              <div className="card-kicker">Operator attention</div>
              <ul className="mt-4 space-y-2 text-sm text-[#ccc3d8]">
                {margin.missing.map((item) => (
                  <li key={`missing-${item}`}>Blocked: {item}</li>
                ))}
                {margin.warnings.map((item) => (
                  <li key={`warning-${item}`}>Warning: {item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <article className="readiness-check fail">
          <div>
            <p className="card-kicker">blocked</p>
            <h2>Polymarket readiness unavailable</h2>
          </div>
          <p>Core returned no structured execution readiness record.</p>
        </article>
      )}

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
            <dt>Manifest health</dt>
            <dd>{readiness.manifestReachable ? "Reachable" : "Needs attention"}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>
              {readiness.hostedManifestConfigured
                ? "Hosted manifest"
                : readiness.accountAssociationValid
                  ? "Signed association"
                  : "Not ready"}
            </dd>
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

function formatBps(value: number | null) {
  return value === null ? "Unavailable" : `${(value / 100).toFixed(2)}%`;
}

function formatBpsAsMultiplier(value: number) {
  return `${(value / 10_000).toFixed(2).replace(/\.00$/, "")}x`;
}
