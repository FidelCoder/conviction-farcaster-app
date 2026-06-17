"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { FarcasterSessionPanel } from "../../../components/FarcasterSessionPanel";
import { useFarcasterSession } from "../../../hooks/useFarcasterSession";

type EmailResponse =
  | { ok: true; data: { email: string } }
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
  const sessionState = useFarcasterSession();
  const session = sessionState.status === "ready" ? sessionState.session : null;
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });

  useEffect(() => {
    if (session?.user.email) {
      setEmail(session.user.email);
    }
  }, [session?.user.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("conviction-notification-preferences");

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<Record<PreferenceKey, boolean>>;
      setPreferences({ ...defaultPreferences, ...parsed });
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      setState({ status: "error", message: "Connect a Farcaster account first." });
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
        body: JSON.stringify({ userId: session.user.id, email: email.trim() }),
      });
      const body = (await response.json()) as EmailResponse;

      if (!response.ok || !body.ok) {
        setState({
          status: "error",
          message: body.ok ? "Email update failed." : body.error.message,
        });
        return;
      }

      window.localStorage.setItem(
        "conviction-notification-preferences",
        JSON.stringify(preferences),
      );
      setState({ status: "saved", message: "Notifications saved for " + body.data.email + "." });
    } catch {
      setState({ status: "error", message: "Notification settings were not saved." });
    }
  }

  function togglePreference(key: PreferenceKey) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="page-shell wide">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Notification center</h1>
          <p>Pick the updates that should follow your .viction identity.</p>
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

      <FarcasterSessionPanel
        label="Farcaster account"
        readyMessage="Notifications are attached to your core user."
        sessionState={sessionState}
      />

      <form className="notification-panel" onSubmit={handleSave}>
        <label className="profile-field">
          <span>Email destination</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
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
          {state.status === "saving" ? "Saving..." : "Save notifications"}
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
  );
}
