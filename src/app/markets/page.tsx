import { MarketDiscoveryBoard } from "../../components/MarketDiscoveryBoard";
import { listMarkets } from "../../lib/core-api";
import { sortMarketsForConvictionBoard } from "../../lib/market-display";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const markets = await listMarkets();
  const rankedMarkets = sortMarketsForConvictionBoard(markets);

  return <MarketDiscoveryBoard markets={rankedMarkets} />;
}
