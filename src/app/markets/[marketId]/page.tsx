import type { Metadata } from "next";

import { TerminalRoutePage } from "../../../components/TerminalRoutePage";
import { getMarket } from "../../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../../lib/miniapp";

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

  const category = market.category ? market.category + " prediction market" : "prediction market";
  const description = summarizeForSearch(
    market.description ??
      "Review event rules, live odds, market signals, and Conviction margin availability for this prediction market.",
  );

  return {
    ...createMiniAppPageMetadata({
      title: market.title + " | " + category,
      description,
      imagePath: getMiniAppImagePath("market", market.id),
      targetPath: "/markets/" + market.id,
      buttonTitle: "Open market",
    }),
    alternates: { canonical: "/markets/" + market.id },
    keywords: [
      market.title,
      category,
      "event market",
      "prediction market odds",
      "prediction market margin",
      "Conviction Markets",
    ],
  };
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { marketId } = await params;

  return <TerminalRoutePage initialMarketId={marketId} initialTab="margin-desk" />;
}

function summarizeForSearch(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 158);
}
