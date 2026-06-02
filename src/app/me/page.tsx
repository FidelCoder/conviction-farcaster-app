import { MyActivityDashboard } from "../../components/MyActivityDashboard";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "My Conviction Activity",
  description: "Your real Farcaster signals, position intents, and copy intents.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/me",
  buttonTitle: "Open my activity",
});

export default function MyActivityPage() {
  return (
    <main className="page-shell wide">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Farcaster beta</p>
          <h1>My activity</h1>
          <p>
            Review records created from your Farcaster account. This page only shows records
            returned by the core API; it does not create sample signals, fake fills, balances, or
            PnL.
          </p>
        </div>
      </section>
      <MyActivityDashboard />
    </main>
  );
}
