"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useFarcasterSession } from "../hooks/useFarcasterSession";
import type { CopyIntent, Market, Position, TradeSignal } from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import { EmptyState } from "./EmptyState";
import { FarcasterSessionPanel } from "./FarcasterSessionPanel";
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
  | {
      ok: true;
      data: MyActivity;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function MyActivityDashboard() {
  const sessionState = useFarcasterSession();
  const [activityState, setActivityState] = useState<ActivityState>({
    status: "idle",
    message: "Connect Farcaster to load your real records.",
  });

  useEffect(() => {
    if (sessionState.status !== "ready") {
      setActivityState({ status: "idle", message: sessionState.message });
      return;
    }

    let isMounted = true;

    async function loadActivity() {
      setActivityState({ status: "loading", message: "Loading your core records..." });

      try {
        const response = await fetch("/api/my-activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            traderProfileId:
              sessionState.status === "ready" ? sessionState.session.traderProfile?.id : null,
            userId: sessionState.status === "ready" ? sessionState.session.user.id : null,
          }),
        });
        const body = (await response.json()) as MyActivityResponse;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !body.ok) {
          setActivityState({
            status: "error",
            message: body.ok ? "Activity failed to load." : body.error.message,
          });
          return;
        }

        setActivityState({
          status: "ready",
          message: "Loaded real records from the core API.",
          activity: body.data,
        });
      } catch {
        if (isMounted) {
          setActivityState({
            status: "error",
            message: "Core API activity records are unavailable right now.",
          });
        }
      }
    }

    void loadActivity();

    return () => {
      isMounted = false;
    };
  }, [sessionState]);

  const activity = activityState.status === "ready" ? activityState.activity : null;

  return (
    <section className="my-activity-shell" aria-label="My Farcaster activity">
      <FarcasterSessionPanel
        label="Farcaster account"
        readyMessage="Your activity uses the core user and trader profile attached to this Farcaster account."
        sessionState={sessionState}
      />

      <div className="activity-summary-grid" aria-label="Activity summary">
        <SummaryTile label="Signals" value={activity?.signals.length ?? 0} />
        <SummaryTile label="Position intents" value={activity?.positions.length ?? 0} />
        <SummaryTile label="Copy intents" value={activity?.copyIntents.length ?? 0} />
      </div>

      <p className={activityState.status === "error" ? "ticket-message error" : "ticket-message"}>
        {activityState.message}
      </p>

      {activity ? (
        <div className="activity-section-stack">
          <ActivitySection
            emptyBody="Create a signal from a real synced market to see it here."
            emptyTitle="No signals yet"
            title="My signals"
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
            emptyBody="Submit a real margin intent from a market page to see position intent records here."
            emptyTitle="No position intents yet"
            title="My position intents"
          >
            {activity.positions.length > 0 ? (
              <div className="card-grid compact-grid">
                {activity.positions.map((position) => (
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
            emptyBody="Submit a copy intent against another trader's real position to see it here once core exposes follower copy-intent reads."
            emptyTitle="No submitted copy intents yet"
            title="My copy intents"
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
      ) : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
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
          <p className="eyebrow">Farcaster beta</p>
          <h2>{title}</h2>
        </div>
        {title === "My signals" ? (
          <Link className="text-link" href="/markets">
            Find market
          </Link>
        ) : null}
      </div>
      {hasContent ? children : <EmptyState title={emptyTitle} body={emptyBody} />}
    </section>
  );
}
