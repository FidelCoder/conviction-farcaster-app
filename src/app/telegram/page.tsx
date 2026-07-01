import Script from "next/script";
import type { Metadata } from "next";

import { TelegramMiniApp, type TelegramMiniMarket } from "../../components/telegram/TelegramMiniApp";
import { listMarkets, type Market } from "../../lib/core-api";
import { getMarketDiscoveryProfile, getRegionLabel, getTopicLabel } from "../../lib/market-discovery";
import { sortMarketsForConvictionBoard } from "../../lib/market-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telegram Mini App",
  description:
    "Conviction Markets Telegram Mini App for prediction markets, Pulse, margin requests, TON wallet access, and liquidity vaults.",
  alternates: { canonical: "/telegram" },
  openGraph: {
    title: "Conviction Markets Telegram Mini App",
    description: "Open markets, Pulse, margin, and TON liquidity workflows inside Telegram.",
    url: "/telegram",
  },
};

export default async function TelegramMiniAppPage() {
  const markets = await listMarkets();
  const sortedMarkets = sortMarketsForConvictionBoard(markets);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TelegramMiniApp marketCount={markets.length} markets={sortedMarkets.slice(0, 120).map(toMiniMarket)} />
    </>
  );
}

function toMiniMarket(market: Market): TelegramMiniMarket {
  const profile = getMarketDiscoveryProfile(market);
  const price = market.lastTradePrice ?? market.bestAsk ?? market.bestBid;

  return {
    id: market.id,
    title: market.title,
    category: market.category ?? "Market",
    topic: getTopicLabel(profile.topic),
    region: getRegionLabel(profile.regions[0] ?? "GLOBAL"),
    yesPercent: formatPercent(price),
    imageUrl:
      market.providerMetadata?.imageUrl ??
      market.providerMetadata?.iconUrl ??
      "/logo/conviction-markets-3d-black-bg.png",
  };
}

function formatPercent(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "--";
  return (parsed * 100).toFixed(parsed < 0.1 ? 1 : 0) + "%";
}
