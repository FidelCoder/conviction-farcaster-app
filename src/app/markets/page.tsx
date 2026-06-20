import type { Metadata } from "next";

import { TerminalRoutePage } from "../../components/TerminalRoutePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prediction Markets and Event Odds",
  description:
    "Find live event markets across sports, crypto, politics, geopolitics, weather, culture, finance, and breaking news.",
  alternates: { canonical: "/markets" },
  openGraph: {
    title: "Prediction Markets and Event Odds",
    description:
      "Find live event markets and review market rules before trading with Conviction margin.",
    url: "/markets",
  },
};

export default async function MarketsPage() {
  return <TerminalRoutePage initialTab="markets" />;
}
