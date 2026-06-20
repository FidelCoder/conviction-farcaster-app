"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  getSessionWalletAddress,
  getStoredBrowserWalletSession,
} from "../lib/browser-wallet-session";
import type { CopyIntent, Market, Position, TradeSignal, UserSession } from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import { EmptyState } from "./EmptyState";
import { PositionCard } from "./PositionCard";
import { SignalCard } from "./SignalCard";

type ActivityState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; activity: MyActivity }
  | { status: "error"; message: string };

type MyActivity = {
  copyIntents: CopyIntent[];
  markets: Record<string, Market>;
  positions: Position[];
  signals: TradeSignal[];
};

type MyActivityResponse =
  | { ok: true; data: MyActivity }
  | { ok: false; error: { code: string; message: string } };

export function MyActivityDashboard() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activityState, setActivityState] = useState<ActivityState>({
    status: "idle",
    message: "Connect a wallet to load your portfolio.",
  });

  useEffect(() => {
    const storedSession = getStoredBrowserWalletSession();
    setSession(storedSession);

    function handleSessionChange(event: Event) {
      const detail = (event as CustomEvent<UserSession | null>).detail;
      setSession(detail);
    }

    window.addEventListener("conviction-browser-session", handleSessionChange as EventListener);

    return () => {
      window.removeEventListener("conviction-browser-session", handleSessionChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setActivityState({ status: "idle", message: "Connect a wallet to load your portfolio." });
      return;
    }

    let isMounted = true;

    async function loadActivity() {
      setActivityState({ status: "loading", message: "Loading your portfolio records..." });

      try {
        const response = await fetch("/api/my-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            traderProfileId: session?.traderProfile?.id ?? null,
            userId: session?.user.id ?? null,
          }),
        });
        const body = (await response.json()) as MyActivityResponse;

        if (!isMounted) return;

        if (!response.ok || !body.ok) {
          setActivityState({
            status: "error",
            message: body.ok ? "Portfolio failed to load." : body.error.message,
          });
          return;
        }

        setActivityState({
          status: "ready",
          message: "Loaded portfolio records from core.",
          activity: body.data,
        });
      } catch {
        if (isMounted) {
          setActivityState({
            status: "error",
            message: "Core API portfolio records are unavailable right now.",
          });
        }
      }
    }

    void loadActivity();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const activity = activityState.status === "ready" ? activityState.activity : null;
  const walletAddress = getSessionWalletAddress(session);
  const activePositions = activity?.positions.filter((position) =>
    ["PENDING_EXECUTION", "EXECUTED"].includes(position.status),
  ) ?? [];
  const pastPositions = activity?.positions.filter((position) =>
    !["PENDING_EXECUTION", "EXECUTED"].includes(position.status),
  ) ?? [];
  const vaultCollateral = activity?.positions.reduce((sum, position) => {
    const amount = Number(position.marginCollateral ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0) ?? 0;

  return (
    <section className="my-activity-shell" aria-label="My portfolio">
      <section className="profile-session-card">
        <div>
          <p className="eyebrow">Wallet portfolio</p>
          <h2>{session?.traderProfile?.handle ?? "Connect wallet"}</h2>
          <span>{walletAddress ? truncateHash(walletAddress) : "Wallet required for portfolio records."}</span>
        </div>
        <Link className="text-link" href="/me/profile">
          Edit profile
        </Link>
      </section>

      <div className="activity-summary-grid" aria-label="Portfolio summary">
        <SummaryTile label="Active positions" value={activePositions.length} />
        <SummaryTile label="Past positions" value={pastPositions.length} />
        <SummaryTile label="Copy intents" value={activity?.copyIntents.length ?? 0} />
        <SummaryTile label="Vault collateral" value={formatUsd(vaultCollateral)} />
      </div>

      <p className={activityState.status === "error" ? "ticket-message error" : "ticket-message"}>
        {activityState.message}
      </p>

      {activity ? (
        <div className="activity-section-stack">
          <ActivitySection
            emptyBody="Open a margin request from a market to see active positions here."
            emptyTitle="No active positions"
            title="Active positions"
          >
            {activePositions.length > 0 ? (
              <div className="card-grid compact-grid">
                {activePositions.map((position) => (
                  <PositionCard
                    key={position.id}
                    market={activity.markets[position.marketId] ?? null}
                    position={position}
                  />
                ))}
              </div>
            ) : null}
          </ActivitySection>

          <ActivitySection
            emptyBody="Closed, failed, or cancelled position records will appear here."
            emptyTitle="No past positions"
            title="Past positions"
          >
            {pastPositions.length > 0 ? (
              <div className="card-grid compact-grid">
                {pastPositions.map((position) => (
                  <PositionCard
                    key={position.id}
                    market={activity.markets[position.marketId] ?? null}
                    position={position}
                  />
                ))}
              </div>
            ) : null}
          </ActivitySection>

          <ActivitySection
            emptyBody="Publish a market take from Activity to see your signals here."
            emptyTitle="No market signals"
            title="Signals"
          >
            {activity.signals.length > 0 ? (
              <div className="card-grid compact-grid">
                {activity.signals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    market={activity.markets[signal.marketId] ?? null}
                    signal={signal}
                  />
                ))}
              </div>
            ) : null}
          </ActivitySection>

          <ActivitySection
            emptyBody="Copy intents against trader positions will appear here."
            emptyTitle="No copy intents"
            title="Copy intents"
          >
            {activity.copyIntents.length > 0 ? (
              <div className="activity-table" role="table" aria-label="Submitted copy intents">
                {activity.copyIntents.map((copyIntent) => (
                  <Link
                    className="activity-row"
                    href={"/positions/" + copyIntent.sourcePositionId}
                    key={copyIntent.id}
                  >
                    <span>{copyIntent.requestedQuantity}</span>
                    <span>{executionStatusLabel(copyIntent.status)}</span>
                    <span>{formatDate(copyIntent.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </ActivitySection>
        </div>
      ) : session ? null : (
        <EmptyState
          title="Wallet not connected"
          body="Connect from the top-right wallet button, then return here to see your portfolio."
        />
      )}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActivitySection({
  children,
  emptyBody,
  emptyTitle,
  title,
}: {
  children: ReactNode;
  emptyBody: string;
  emptyTitle: string;
  title: string;
}) {
  const hasContent = Boolean(children);

  return (
    <section className="activity-section" aria-label={title}>
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{title}</h2>
        </div>
        {title === "Active positions" ? (
          <Link className="text-link" href="/markets">
            Find market
          </Link>
        ) : null}
      </div>
      {hasContent ? children : <EmptyState title={emptyTitle} body={emptyBody} />}
    </section>
  );
}

function truncateHash(value: string) {
  return value.slice(0, 6) + "..." + value.slice(-4);
}

function formatUsd(value: number) {
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
