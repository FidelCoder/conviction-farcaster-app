"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { TerminalShell } from "../../../components/TerminalShell";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type UserSession,
} from "../../../lib/core-api";

type EmailResponse =
  | { ok: true; data: { email: string; session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type PreferenceKey = "positions" | "vaults" | "social" | "culture";

type SaveState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const preferenceLabels: Array<{ key: PreferenceKey; title: string; body: string }> = [
  {
    key: "positions",
    title: "Position intent updates",
    body: "Preparation, submitted, confirmed, failed, and cancelled status changes.",
  },
  {
    key: "vaults",
    title: "Vault transactions",
    body: "Approval, deposit, margin intent, close, and liquidation transaction records.",
  },
  {
    key: "social",
    title: "Social activity",
    body: "Replies, reactions, bookmarks, and copy intents around your signals.",
  },
  {
    key: "culture",
    title: ".viction culture drops",
    body: "Avatar cards, beta rituals, release notes, and community prompts.",
  },
];

const defaultPreferences: Record<PreferenceKey, boolean> = {
  positions: true,
  vaults: true,
  social: true,
  culture: true,
};

export default function NotificationsPage() {
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });

  useEffect(() => {
    void Promise.all([getExecutionCapabilities(), listMarkets()]).then(([execution, markets]) => {
      setTerminalData({ execution, marketCount: markets.length });
    });

    const rawSession = window.localStorage.getItem("conviction-browser-session");
    if (rawSession) {
      try {
        const storedSession = JSON.parse(rawSession) as UserSession;
        setSession(storedSession);
        setEmail(storedSession.user.email ?? "");
      } catch {
        window.localStorage.removeItem("conviction-browser-session");
      }
    }

    const rawPreferences = window.localStorage.getItem("conviction-notification-preferences");
    if (rawPreferences) {
      try {
        const parsed = JSON.parse(rawPreferences) as Partial<Record<PreferenceKey, boolean>>;
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch {
        setPreferences(defaultPreferences);
      }
    }
  }, []);

  const handleSessionChange = useCallback((nextSession: UserSession | null) => {
    setSession(nextSession);
    setEmail(nextSession?.user.email ?? "");
  }, []);

  const walletAddress = getConnectedWalletAddress(session);
  const isWalletConnected = Boolean(walletAddress);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !walletAddress) {
      setState({ status: "error", message: "Connect a wallet from the terminal header first." });
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setState({ status: "error", message: "Add a valid email for notifications." });
      return;
    }

    setState({ status: "saving", message: "Saving notification settings..." });

    try {
      const response = await fetch("/api/user-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, email: email.trim() }),
      });
      const body = (await response.json()) as EmailResponse;

      if (!response.ok || !body.ok) {
        setState({
          status: "error",
          message: body.ok ? "Email update failed." : body.error.message,
        });
        return;
      }

      const nextSession = body.data.session;

      setSession(nextSession);
      window.localStorage.setItem("conviction-browser-session", JSON.stringify(nextSession));
      window.localStorage.setItem(
        "conviction-notification-preferences",
        JSON.stringify(preferences),
      );
      setState({ status: "saved", message: "Notifications saved for " + body.data.email + "." });
    } catch {
      setState({ status: "error", message: "Notification settings were not saved." });
    }
  }

  function promptWalletConnection() {
    setState({ status: "error", message: "Connect a wallet from the terminal header first." });
  }

  function togglePreference(key: PreferenceKey) {
    if (!isWalletConnected) {
      promptWalletConnection();
      return;
    }

    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <TerminalShell
      activeTab="notifications"
      execution={terminalData?.execution ?? fallbackExecution}
      marketCount={terminalData?.marketCount ?? 0}
      onSessionChange={handleSessionChange}
      sessionOverride={session ?? undefined}
    >
      <main className="terminal-page terminal-account-page">
        <section className="terminal-page-heading">
          <div>
            <p>Notifications</p>
            <h1>Notification center</h1>
            <span>Pick the updates that should follow your .viction identity.</span>
          </div>
          <div className="my-activity-actions">
            <Link className="text-link" href="/me/settings">
              Settings
            </Link>
            <Link className="text-link" href="/me/profile">
              Profile
            </Link>
          </div>
        </section>

        <section className="terminal-connect-panel">
          <span>{isWalletConnected ? "Wallet profile active" : "Wallet profile required"}</span>
          <p>Connect from the top-right wallet action before editing notification email.</p>
        </section>

        <form className="notification-panel" onSubmit={handleSave}>
          {!isWalletConnected ? (
            <div className="profile-wallet-lock">
              <strong>Wallet connection required</strong>
              <span>Email and preference changes are saved against the connected wallet.</span>
            </div>
          ) : null}
          <label className="profile-field">
            <span>Email destination</span>
            <input
              onFocus={() => {
                if (!isWalletConnected) promptWalletConnection();
              }}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              readOnly={!isWalletConnected}
              type="email"
              value={email}
            />
          </label>

          <div className="notification-list">
            {preferenceLabels.map((item) => (
              <label className="notification-row" key={item.key}>
                <input
                  checked={preferences[item.key]}
                  onChange={() => togglePreference(item.key)}
                  type="checkbox"
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
              </label>
            ))}
          </div>

          <button className="profile-submit" disabled={state.status === "saving"} type="submit">
            {state.status === "saving"
              ? "Saving..."
              : isWalletConnected
                ? "Save notifications"
                : "Connect wallet to save"}
          </button>

          <p
            className={
              "profile-message" +
              (state.status === "error" ? " error" : "") +
              (state.status === "saved" ? " success" : "")
            }
          >
            {state.message || " "}
          </p>
        </form>
      </main>
    </TerminalShell>
  );
}

function getConnectedWalletAddress(session: UserSession | null) {
  if (session?.socialAccount.platform !== "WEB") return null;

  const walletAddress = session.socialAccount.platformUserId.trim();

  return /^0x[a-fA-F0-9]{40}$/.test(walletAddress) ? walletAddress : null;
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
