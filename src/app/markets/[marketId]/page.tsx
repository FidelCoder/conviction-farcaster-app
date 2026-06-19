import type { Metadata } from "next";
import { EmptyState } from "../../../components/EmptyState";
import { MarginDesk } from "../../../components/MarginDesk";
import { MarketFlowChart } from "../../../components/MarketFlowChart";
import { PredictionSocialPanel } from "../../../components/PredictionSocialPanel";
import { SignalCard } from "../../../components/SignalCard";
import { SignalComposer } from "../../../components/SignalComposer";
import { getExecutionCapabilities, getMarket, listMarketSignals } from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type MarketPageProps = {
  params: Promise<{ marketId: string }>;
};

export async function generateMetadata({ params }: MarketPageProps): Promise<Metadata> {
  const { marketId } = await params;
  const market = await getMarket(marketId);

  if (!market) {
    return {
      title: "Market not found",
      robots: { index: false, follow: true },
    };
  }

  return {
    title: market.title,
    description:
      market.description ??
      "Review prediction market details, outcome prices, resolution rules, and margin availability on Conviction Markets.",
    alternates: { canonical: "/markets/" + market.id },
    openGraph: {
      title: market.title,
      description: market.description ?? "Prediction market details on Conviction Markets.",
      url: "/markets/" + market.id,
      type: "article",
    },
  };
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { marketId } = await params;
  const [market, signals, execution] = await Promise.all([
    getMarket(marketId),
    listMarketSignals(marketId),
    getExecutionCapabilities(),
  ]);

  if (!market) {
    return (
      <main className="page-shell">
        <EmptyState
          title="Market not found"
          body="The core API did not return a market for this ID."
        />
      </main>
    );
  }

  return (
    <main className="page-shell wide">
      <MarginDesk execution={execution} markets={[market]} />
      <MarketFlowChart market={market} />
      <section id="rules" className="card market-rules-card">
        <p className="eyebrow">Conviction rules view</p>
        <h2>Market details and resolution rules</h2>
        <p>{market.description ?? "This market does not have a full resolution description stored yet."}</p>
        <dl className="metric-list market-detail-list">
          <div>
            <dt>Category</dt>
            <dd>{market.category ?? "General"}</dd>
          </div>
          <div>
            <dt>Resolution date</dt>
            <dd>{market.resolutionDate ? new Date(market.resolutionDate).toLocaleDateString() : "Pending"}</dd>
          </div>
          <div>
            <dt>YES token</dt>
            <dd>{market.yesTokenId ? "Mapped" : "Pending"}</dd>
          </div>
          <div>
            <dt>NO token</dt>
            <dd>{market.noTokenId ? "Mapped" : "Pending"}</dd>
          </div>
        </dl>
        <p className="subtle-note">
          Conviction keeps upstream feed URLs internal. Users review rules, signals, margin, and vault risk inside this product.
        </p>
      </section>
      <PredictionSocialPanel market={market} signalCount={signals.length} />
      <SignalComposer anchorId="signal" markets={[market]} />

      <section className="section-heading">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Market signals</h2>
        </div>
      </section>

      {signals.length > 0 ? (
        <section className="card-grid">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </section>
      ) : (
        <EmptyState title="No signals yet" body="The core API has no signals for this market." />
      )}
    </main>
  );
}
