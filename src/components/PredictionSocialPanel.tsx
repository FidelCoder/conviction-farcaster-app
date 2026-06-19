import type { Market } from "../lib/core-api";
import { getMarketDiscoveryLabel } from "../lib/market-discovery";
import { SharePredictionActions } from "./SharePredictionActions";

type PredictionSocialPanelProps = {
  market: Market;
  signalCount: number;
};

export function PredictionSocialPanel({ market, signalCount }: PredictionSocialPanelProps) {
  const marketPath = "/markets/" + market.id;

  return (
    <section className="prediction-social-panel" aria-label="Prediction conversation">
      <div className="prediction-social-copy">
        <p className="eyebrow">Social layer</p>
        <h2>Turn the market into a public thesis.</h2>
        <p>
          Share the odds, publish a signal, or start the debate around this market. Conversations
          stay public; execution still requires the core API and wallet flow.
        </p>
      </div>
      <div className="prediction-social-actions">
        <dl>
          <div>
            <dt>Lens</dt>
            <dd>{getMarketDiscoveryLabel(market)}</dd>
          </div>
          <div>
            <dt>Signals</dt>
            <dd>{signalCount}</dd>
          </div>
          <div>
            <dt>Market</dt>
            <dd>Conviction</dd>
          </div>
        </dl>
        <SharePredictionActions
          context={getMarketDiscoveryLabel(market)}
          path={marketPath}
          title={market.title}
        />
        <a className="social-thread-link" href="#signal">
          Publish signal
        </a>
      </div>
    </section>
  );
}
