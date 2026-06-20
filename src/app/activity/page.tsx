import type { Metadata } from "next";

import { TerminalRoutePage } from "../../components/TerminalRoutePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prediction Market Activity and Social Signals",
  description:
    "Follow market news, trader posts, public position updates, and social signals on Conviction Markets.",
  alternates: { canonical: "/activity" },
  openGraph: {
    title: "Prediction Market Activity and Social Signals",
    description: "Market Pulse for prediction market news, trade ideas, and social discussion.",
    url: "/activity",
  },
};

export default async function ActivityPage() {
  return <TerminalRoutePage initialTab="activity" />;
}
