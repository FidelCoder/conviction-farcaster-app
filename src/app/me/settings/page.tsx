"use client";

import Link from "next/link";

import { FarcasterSessionPanel } from "../../../components/FarcasterSessionPanel";
import { useFarcasterSession } from "../../../hooks/useFarcasterSession";

const settingCards = [
  {
    title: "Profile identity",
    body: "Claim a .viction handle, pick an avatar card, and keep your public trader bio current.",
    href: "/me/profile",
    action: "Edit profile",
  },
  {
    title: "Notifications",
    body: "Choose which account, position, vault, and social updates should reach you during beta.",
    href: "/me/notifications",
    action: "Open notifications",
  },
  {
    title: "Activity",
    body: "Review real signals, copy intents, and margin position intents returned by the core API.",
    href: "/me",
    action: "View activity",
  },
  {
    title: "Docs",
    body: "Read the current rules for margin, vaults, signals, and the intent-first execution model.",
    href: "/docs",
    action: "Read docs",
  },
] as const;

export default function SettingsPage() {
  const sessionState = useFarcasterSession();
  const session = sessionState.status === "ready" ? sessionState.session : null;

  return (
    <main className="page-shell wide">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account settings</h1>
          <p>Keep your Conviction identity, contact path, and beta surfaces aligned.</p>
        </div>
        <div className="settings-status-pill">
          {session?.traderProfile?.handle ?? "guest.viction"}
        </div>
      </section>

      <FarcasterSessionPanel
        label="Farcaster account"
        readyMessage="Settings are attached to your core user."
        sessionState={sessionState}
      />

      <section className="settings-grid" aria-label="Settings sections">
        {settingCards.map((card) => (
          <article className="settings-card" key={card.href}>
            <div>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </div>
            <Link href={card.href}>{card.action}</Link>
          </article>
        ))}
      </section>

      <section className="settings-card settings-wide-card">
        <div>
          <h2>Execution safety</h2>
          <p>
            Margin remains intent-first until vault liquidity, monitoring, liquidation operations,
            and execution adapters are live. Settings never mark a position executed locally.
          </p>
        </div>
        <Link href="/margin">Open margin desk</Link>
      </section>
    </main>
  );
}
