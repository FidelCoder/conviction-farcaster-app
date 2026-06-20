import { TerminalRoutePage } from "../components/TerminalRoutePage";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Leveraged Prediction Markets",
  description:
    "Trade event markets with more exposure. Liquidity providers supply capital to Conviction vaults and earn yield from margin activity.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/",
  buttonTitle: "Open Conviction",
});

export default async function HomePage() {
  return <TerminalRoutePage initialTab="landing" />;
}
