import type { Metadata } from "next";

import { TelegramMiniApp } from "../../components/telegram/TelegramMiniApp";
import {
  getOmnistonStatus,
  getOmnistonSummary,
  listMarkets,
} from "../../lib/core-api";
import { sortMarketsForConvictionBoard } from "../../lib/market-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telegram Mini App",
  description:
    "Conviction Markets Telegram Mini App for prediction markets, TON quote previews, Pulse, vaults, and support.",
  alternates: { canonical: "/telegram" },
  openGraph: {
    title: "Conviction Markets Telegram Mini App",
    description: "Explore markets, preview TON routes, and open Conviction workflows inside Telegram.",
    url: "/telegram",
  },
};

export default async function TelegramMiniAppPage() {
  const [markets, omniston, summary] = await Promise.all([
    listMarkets(),
    getOmnistonStatus(),
    getOmnistonSummary(),
  ]);

  return (
    <TelegramMiniApp
      markets={sortMarketsForConvictionBoard(markets).slice(0, 120)}
      omniston={omniston}
      summary={summary}
    />
  );
}
