import { MarginDesk } from "../../components/MarginDesk";
import { getExecutionCapabilities, listMarkets } from "../../lib/core-api";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Margin Desk",
  description: "A Farcaster-first margin layer for real synced prediction markets.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/margin",
  buttonTitle: "Open margin desk",
});

export default async function MarginPage() {
  const [markets, execution] = await Promise.all([listMarkets(), getExecutionCapabilities()]);

  return (
    <main className="page-shell wide">
      <MarginDesk execution={execution} markets={markets} />
    </main>
  );
}
