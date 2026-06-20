import type { Metadata } from "next";

import { TerminalRoutePage } from "../../components/TerminalRoutePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prediction Market Liquidity Vaults",
  description:
    "Deposit liquidity into Conviction vaults that back margin activity across event markets.",
  alternates: { canonical: "/vaults" },
  openGraph: {
    title: "Prediction Market Liquidity Vaults",
    description: "Supply liquidity to Conviction vaults and track vault activity.",
    url: "/vaults",
  },
};

export default async function VaultsPage() {
  return <TerminalRoutePage initialTab="vaults" />;
}
