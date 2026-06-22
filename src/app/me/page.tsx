"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MyActivityDashboard } from "../../components/MyActivityDashboard";
import { TerminalShell } from "../../components/TerminalShell";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type UserSession,
} from "../../lib/core-api";

export const dynamic = "force-dynamic";

export default function MyActivityPage() {
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    void Promise.all([getExecutionCapabilities(), listMarkets()]).then(([execution, markets]) => {
      setTerminalData({ execution, marketCount: markets.length });
    });
  }, []);

  return (
    <TerminalShell
      activeTab="portfolio"
      execution={terminalData?.execution ?? fallbackExecution}
      marketCount={terminalData?.marketCount ?? 0}
      onSessionChange={setSession}
      sessionOverride={session ?? undefined}
    >
      <main className="terminal-page terminal-account-page terminal-wallet-page">
        <section className="terminal-page-heading">
          <div>
            <p>Portfolio</p>
            <h1>Wallet command center</h1>
            <span>Track wallet identity, active margin, vault collateral, signals, copy intents, and transaction records in one place.</span>
          </div>
          <div className="my-activity-actions">
            <Link className="text-link" href="/me/profile">
              Profile
            </Link>
            <Link className="text-link" href="/me/notifications">
              Notifications
            </Link>
            <Link className="text-link" href="/me/settings">
              Settings
            </Link>
          </div>
        </section>

        <MyActivityDashboard />
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
