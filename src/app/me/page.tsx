import { MyActivityDashboard } from "../../components/MyActivityDashboard";
import { createMiniAppPageMetadata, getMiniAppImagePath } from "../../lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata = createMiniAppPageMetadata({
  title: "Conviction Portfolio",
  description: "Your wallet portfolio, margin positions, signals, copy intents, and vault collateral on Conviction Markets.",
  imagePath: getMiniAppImagePath("home"),
  targetPath: "/me",
  buttonTitle: "Open portfolio",
});

export default function MyActivityPage() {
  return (
    <main className="page-shell wide">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>My portfolio</h1>
          <p>
            Review wallet-linked positions, vault collateral, signals, and copy intents returned by core.
          </p>
        </div>
        <div className="my-activity-actions">
          <a className="text-link" href="/me/notifications">
            Notifications
          </a>
          <a className="text-link" href="/me/settings">
            Settings
          </a>
          <a className="text-link" href="/me/profile">
            Edit profile
          </a>
        </div>
      </section>
      <MyActivityDashboard />
    </main>
  );
}
