import { TerminalRoutePage } from "../../components/TerminalRoutePage";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Prediction Market Margin Trading",
  description:
    "Use vault-backed liquidity to get more exposure to prediction markets and event outcomes.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/margin-desk",
  buttonTitle: "Open market margin",
});

export default async function MarginDeskPage() {
  return <TerminalRoutePage initialTab="margin-desk" />;
}
