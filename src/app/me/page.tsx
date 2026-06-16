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
          <p className="eyebrow">Activity</p>
          <h1>My activity</h1>
          <p>
            Review signals, position intents, and copy intents returned by the core API. Execution
            status stays explicit.
          </p>
        </div>
        <div className="my-activity-actions">
          <a className="text-link" href="/me/profile">
            Edit profile
          </a>
        </div>
      </section>
      <MyActivityDashboard />
    </main>
  );
}
