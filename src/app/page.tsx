import Link from "next/link";

import { getExecutionCapabilities, listMarkets } from "../lib/core-api";
import {
  getMarketBoardStats,
  getMarketDisplayCase,
  sortMarketsForConvictionBoard,
} from "../lib/market-display";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Markets",
  description: "Farcaster margin layer for real Conviction Markets data.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Launch app",
});

export default async function HomePage() {
  const [markets, execution] = await Promise.all([listMarkets(), getExecutionCapabilities()]);
  const boardStats = getMarketBoardStats(markets);
  const launchMarkets = sortMarketsForConvictionBoard(markets).slice(0, 3);
  const marginMode = execution.marginExecutionEnabled ? "Live execution" : "Intent-only";

  return (
    <main className="launch-shell">
      <section className="launch-stage" aria-labelledby="launch-title">
        <div className="launch-grid" aria-hidden="true">
          <span className="grid-tile tile-violet" />
          <span className="grid-tile tile-orange" />
          <span className="grid-tile tile-ink" />
          <span className="grid-tile tile-violet soft" />
        </div>

        <div className="launch-copy">
          <p className="launch-mark">Conviction Markets</p>
          <h1 id="launch-title">The Farcaster margin layer for prediction markets.</h1>
          <p>
            Real synced markets, signal-first positioning, and vault-ready margin intents without
            fake fills or fake PnL.
          </p>

          <div className="launch-actions">
            <Link className="launch-button" href="/markets">
              Launch app
            </Link>
            <Link className="launch-secondary" href="/margin">
              Open margin desk
            </Link>
          </div>
        </div>

        <aside className="launch-market-panel" aria-label="Current market board preview">
          <div className="launch-panel-topline">
            <span>Live board</span>
            <strong>{boardStats.qualified}</strong>
          </div>
          <div className="launch-market-list">
            {launchMarkets.length > 0 ? (
              launchMarkets.map((market) => {
                const displayCase = getMarketDisplayCase(market);

                return (
                  <Link
                    className="launch-market-row"
                    href={"/markets/" + market.id}
                    key={market.id}
                  >
                    <span>{market.title}</span>
                    <strong>{displayCase.price ?? "Open"}</strong>
                  </Link>
                );
              })
            ) : (
              <div className="launch-empty">Markets are waiting for provider sync.</div>
            )}
          </div>
        </aside>

        <dl className="launch-stats" aria-label="Conviction market readiness">
          <div>
            <dt>Synced</dt>
            <dd>{boardStats.total}</dd>
          </div>
          <div>
            <dt>Qualified</dt>
            <dd>{boardStats.qualified}</dd>
          </div>
          <div>
            <dt>Margin</dt>
            <dd>{marginMode}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
