import Link from "next/link";

import { getExecutionCapabilities, listMarkets } from "../lib/core-api";
import { getMarketBoardStats } from "../lib/market-display";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets",
  description: "Prediction-market margin desk for conviction trades.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Launch app",
});

export default async function HomePage() {
  const [markets, execution] = await Promise.all([listMarkets(), getExecutionCapabilities()]);
  const boardStats = getMarketBoardStats(markets);
  const executionMode = execution.marginExecutionEnabled ? "Live" : "Intent";

  return (
    <main className="launch-shell">
      <section className="launch-stage unified-launch" aria-labelledby="launch-title">
        <div className="launch-copy">
          <p className="launch-mark">Conviction Markets</p>
          <h1 id="launch-title">Trade the thesis.</h1>
          <p className="launch-brief">
            Size YES/NO conviction before capital moves. Execution only counts when vaults confirm.
          </p>

          <div className="experience-switch" aria-label="Choose app surface">
            <Link className="experience-card primary" href="/markets">
              <span>Mini app</span>
              <strong>Launch inside Farcaster</strong>
              <small>Fast board, thesis entry, social copy flow.</small>
            </Link>
            <Link className="experience-card" href="/margin">
              <span>Browser desk</span>
              <strong>Open the margin desk</strong>
              <small>Wallet status, risk view, vault checks.</small>
            </Link>
          </div>
        </div>

        <dl className="launch-stats surface-stats" aria-label="Current app state">
          <div>
            <dt>Markets</dt>
            <dd>{boardStats.total}</dd>
          </div>
          <div>
            <dt>Ready</dt>
            <dd>{boardStats.qualified}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{executionMode}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
