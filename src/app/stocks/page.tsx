import type { Metadata } from "next";

import { TerminalRoutePage } from "../../components/TerminalRoutePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tokenized Stocks — Base L2 | Conviction Markets",
  description:
    "Trade Coinbase B20 tokenized stocks on Base. Covered calls on NVDA, AAPL, TSLA, GOOGL, AMZN, MSFT, META, and more via Chainlink oracles.",
  alternates: { canonical: "/stocks" },
  openGraph: {
    title: "Tokenized Stocks — Base L2 | Conviction Markets",
    description:
      "Write covered calls on 13 Coinbase B20 tokenized stocks. Real-time Chainlink oracle pricing on Base L2.",
    url: "/stocks",
  },
};

export default async function StocksPage() {
  return <TerminalRoutePage initialTab="stocks" />;
}
