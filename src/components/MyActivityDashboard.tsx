"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { getSessionWalletAddress, getStoredBrowserWalletSession } from "../lib/browser-wallet-session";
import { fetchWalletBalanceSnapshot, applyWalletBalanceSnapshot } from "../lib/client-wallet-balances";
import type { CopyIntent, Market, Position, TradeSignal, UserSession } from "../lib/core-api";
import type { UserPortfolio } from "../zip-ui/types";
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
  const [portfolio, setPortfolio] = useState<UserPortfolio>({
    connected: false,
    address: null,
    usdcBalance: 0,
    wethBalance: 0,
    vaultBalances: {},
    walletBalances: {},
    vaultTransactions: [],
    walletBalancesStatus: "idle",
    activeRequestsCount: 0,
    activePositions: [],
  });
  const [activityState, setActivityState] = useState<ActivityState>({
    status: "idle",
    message: "Sign in to load your portfolio.",
  });

  useEffect(() => {
    const storedSession = getStoredBrowserWalletSession();
    setSession(storedSession);
    setPortfolio((current) => applySessionToPortfolio(current, storedSession));

    function handleSessionChange(event: Event) {
      const detail = (event as CustomEvent<UserSession | null>).detail;
      setSession(detail);
      setPortfolio((current) => applySessionToPortfolio(current, detail));
    }

    window.addEventListener("conviction-browser-session", handleSessionChange as EventListener);

    return () => {
      window.removeEventListener("conviction-browser-session", handleSessionChange as EventListener);
    };
  }, []);


  useEffect(() => {
    if (!portfolio.connected || !portfolio.address) return;

    let isCurrent = true;
    const walletAddress = portfolio.address;

    setPortfolio((current) =>
      current.address?.toLowerCase() === walletAddress.toLowerCase()
        ? { ...current, walletBalancesStatus: "loading", walletBalancesMessage: "Reading wallet token balances..." }
        : current,
    );

    void fetchWalletBalanceSnapshot(walletAddress)
      .then((snapshot) => {
        if (!isCurrent) return;
        setPortfolio((current) => {
          if (current.address?.toLowerCase() !== walletAddress.toLowerCase()) return current;
          return applyWalletBalanceSnapshot(current, snapshot);
        });
      })
      .catch(() => {
        if (!isCurrent) return;
        setPortfolio((current) =>
          current.address?.toLowerCase() === walletAddress.toLowerCase()
            ? { ...current, walletBalancesStatus: "error", walletBalancesMessage: "Unable to read wallet token balances." }
            : current,
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [portfolio.address, portfolio.connected]);

  useEffect(() => {
    if (!session) {
      setActivityState({ status: "idle", message: "Sign in to load your portfolio." });
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

  const publicSignalCount = activity?.signals.length ?? 0;
  const copyIntentCount = activity?.copyIntents.length ?? 0;
  const displayHandle = session?.traderProfile?.handle ?? (session ? "trader.viction" : "Sign in");
  const emailLabel = session?.user.email ?? "No email set";
  const walletBalanceLabel = formatTokenBalance(portfolio.usdcBalance, "USDC");
  const walletStatusLabel = portfolio.walletBalancesStatus === "loading" ? "Syncing" : portfolio.walletBalancesStatus === "error" ? "Retry from wallet menu" : "Available";

  return (
    <section className="wallet-portfolio-shell" aria-label="My portfolio">
      <section className="wallet-overview-card">
        <div className="wallet-identity-block">
          <span className="wallet-eyebrow">Portfolio</span>
          <h2>{displayHandle}</h2>
          <p>{session ? "Wallet-linked identity active." : "Sign in from the account button to load your portfolio."}</p>
        </div>
        <dl className="wallet-overview-metrics">
          <div>
            <dt>Account email</dt>
            <dd>{emailLabel}</dd>
          </div>
          <div>
            <dt>Wallet balance</dt>
            <dd>{walletBalanceLabel}</dd>
          </div>
          <div>
            <dt>Balance status</dt>
            <dd>{walletStatusLabel}</dd>
          </div>
          <div>
            <dt>Vault collateral</dt>
            <dd>{formatUsd(vaultCollateral)}</dd>
          </div>
          <div>
            <dt>Active trades</dt>
            <dd>{activePositions.length}</dd>
          </div>
        </dl>
      </section>

      <div className="wallet-layout-grid">
        <aside className="wallet-menu-panel" aria-label="Wallet sections">
          <a href="#overview">Overview</a>
          <a href="#active-trades">Active trades</a>
          <a href="#history">History</a>
          <a href="#signals">Signals</a>
          <a href="#copy-intents">Copy intents</a>
          <Link href="/vaults">Vaults</Link>
          <Link href="/markets">Find markets</Link>
        </aside>

        <div className="wallet-main-stack">
          <section className="wallet-panel" id="overview">
            <div className="wallet-panel-heading">
              <div>
                <span>Overview</span>
                <h2>Wallet records</h2>
              </div>
              <Link className="text-link" href="/me/profile">Manage identity</Link>
            </div>
            <div className="wallet-summary-grid" aria-label="Portfolio summary">
              <SummaryTile label="Wallet balance" value={walletBalanceLabel} />
              <SummaryTile label="Active positions" value={activePositions.length} />
              <SummaryTile label="Past positions" value={pastPositions.length} />
              <SummaryTile label="Signals" value={publicSignalCount} />
              <SummaryTile label="Copy intents" value={copyIntentCount} />
            </div>
            <p className={activityState.status === "error" ? "wallet-state-message error" : "wallet-state-message"}>
              {activityState.message}
            </p>
          </section>

          {activity ? (
            <>
              <ActivitySection
                emptyBody="Open a margin request from a market to see active positions here."
                emptyTitle="No active positions"
                id="active-trades"
                title="Active trades"
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
                id="history"
                title="History"
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
                emptyBody="Publish a market take from Pulse to see your signals here."
                emptyTitle="No market signals"
                id="signals"
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
                id="copy-intents"
                title="Copy intents"
              >
                {activity.copyIntents.length > 0 ? (
                  <div className="wallet-activity-table" role="table" aria-label="Submitted copy intents">
                    {activity.copyIntents.map((copyIntent) => (
                      <Link
                        className="wallet-activity-row"
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
            </>
          ) : session ? null : (
            <section className="wallet-panel">
              <EmptyState
                title="Wallet not connected"
                body="Sign in from the top-right action, then return here to see your portfolio."
              />
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function applySessionToPortfolio(current: UserPortfolio, nextSession: UserSession | null): UserPortfolio {
  if (!nextSession) {
    return {
      connected: false,
      address: null,
      usdcBalance: 0,
      wethBalance: 0,
      vaultBalances: {},
      walletBalances: {},
      vaultTransactions: [],
      walletBalancesStatus: "idle",
      activeRequestsCount: 0,
      activePositions: [],
    };
  }

  const nextAddress = getSessionWalletAddress(nextSession) ?? current.address;
  const isSameWallet = current.address?.toLowerCase() === nextAddress?.toLowerCase();

  return {
    ...current,
    connected: true,
    address: nextAddress,
    vaultBalances: isSameWallet ? current.vaultBalances : {},
    walletBalances: isSameWallet ? current.walletBalances : {},
    walletBalancesStatus: nextAddress ? "loading" : "idle",
  };
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
  id,
  title,
}: {
  children: ReactNode;
  emptyBody: string;
  emptyTitle: string;
  id: string;
  title: string;
}) {
  const hasContent = Boolean(children);

  return (
    <section className="wallet-panel" id={id} aria-label={title}>
      <div className="wallet-panel-heading">
        <div>
          <span>Portfolio</span>
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


function formatUsd(value: number) {
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTokenBalance(value: number, symbol: string) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + " " + symbol;
}
