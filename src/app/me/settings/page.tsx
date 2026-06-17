"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TerminalShell } from "../../../components/TerminalShell";
import { getStoredBrowserWalletSession } from "../../../lib/browser-wallet-session";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type UserSession,
} from "../../../lib/core-api";

const settingCards = [
  {
    title: "Profile identity",
    body: "Claim a .viction handle, pick a Web3 avatar card, and keep your public trader bio current.",
    href: "/me/profile",
    action: "Edit profile",
  },
  {
    title: "Notifications",
    body: "Choose which wallet, position, vault, and social updates should reach you during beta.",
    href: "/me/notifications",
    action: "Open notifications",
  },
  {
    title: "Activity",
    body: "Review real signals, copy intents, and margin position intents returned by the core API.",
    href: "/#activity",
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
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    void Promise.all([getExecutionCapabilities(), listMarkets()]).then(([execution, markets]) => {
      setTerminalData({ execution, marketCount: markets.length });
    });

    setSession(getStoredBrowserWalletSession());
  }, []);

  return (
    <TerminalShell
      activeTab="settings"
      execution={terminalData?.execution ?? fallbackExecution}
      marketCount={terminalData?.marketCount ?? 0}
      onSessionChange={setSession}
      sessionOverride={session ?? undefined}
    >
      <main className="terminal-page terminal-account-page">
        <section className="terminal-page-heading">
          <div>
            <p>Settings</p>
            <h1>Account settings</h1>
            <span>Keep your Conviction identity, contact path, and beta surfaces aligned.</span>
          </div>
          <div className="settings-status-pill">
            {session?.traderProfile?.handle ?? "wallet.viction"}
          </div>
        </section>

        <section className="terminal-connect-panel">
          <span>{session ? "Wallet profile active" : "Wallet profile required"}</span>
          <p>Connect from the top-right wallet action. No Farcaster account is required.</p>
        </section>

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
          <Link href="/#margin-desk">Open margin desk</Link>
        </section>
      </main>
    </TerminalShell>
  );
}

const fallbackExecution: ExecutionCapabilities = {
  evmOnly: true,
  architecture: "INTENT_FIRST_MULTICHAIN_MARGIN_LAYER",
  spotExecutionEnabled: false,
  marginExecutionEnabled: false,
  leverageEnabled: false,
  leverageRequiresContracts: true,
  activeAdapters: [],
  recommendation: "Connect core API for live execution capabilities.",
  chains: [],
};
