import type { Metadata } from "next";
import { MarketDiscoveryBoard } from "../../components/MarketDiscoveryBoard";
import { listMarkets } from "../../lib/core-api";
import { sortMarketsForConvictionBoard } from "../../lib/market-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prediction Markets by Topic and Region",
  description:
    "Browse live prediction markets across crypto, sports, geopolitics, social events, economics, culture, technology, and global regions.",
  alternates: { canonical: "/markets" },
};

export default async function MarketsPage() {
  const markets = await listMarkets();
  const rankedMarkets = sortMarketsForConvictionBoard(markets);

  return <MarketDiscoveryBoard markets={rankedMarkets} />;
}
