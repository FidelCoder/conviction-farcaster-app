"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, Clock3, Download, KeyRound, RefreshCw, ShieldCheck, LineChart, UsersRound } from "lucide-react";

import type { AdminUsageAnalyticsResult } from "../../../lib/core-api";

type AdminResponse =
  | { ok: true; data: AdminUsageAnalyticsResult }
  | { ok: false; error: { code: string; message: string } };

const emptyAnalytics: AdminUsageAnalyticsResult | null = null;

export default function AdminAnalyticsPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AdminUsageAnalyticsResult | null>(emptyAnalytics);

  const csv = useMemo(() => buildCsv(analytics), [analytics]);

  async function loadAnalytics() {
    if (!token.trim()) {
      setStatus("Enter the admin token first.");
      return;
    }

    setLoading(true);
    setStatus("Loading real-user analytics...");

    try {
      const response = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = (await response.json()) as AdminResponse;

      if (!body.ok) {
        setAnalytics(null);
        setStatus(body.error.message);
        return;
      }

      setAnalytics(body.data);
      setStatus("Loaded analytics generated " + formatDate(body.data.generatedAt) + ".");
    } catch {
      setAnalytics(null);
      setStatus("Admin analytics are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "conviction-product-analytics.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#050505] bg-grid-tech px-4 py-8 text-white sm:px-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-lg border border-[#262626] bg-[#111111]/95 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Admin only</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Product analytics</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#ccc3d8]">
                Real-user dashboard for claimed .viction accounts, auth source, session time, product usage, and active areas. Generated fallback profiles and internal records are separated from the real user count.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-deep-orange/30 bg-deep-orange/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">
              <ShieldCheck size={14} /> Token protected
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#ccc3d8]/50" size={16} />
              <input
                className="min-h-12 w-full rounded border border-[#262626] bg-[#080808] pl-10 pr-4 font-mono text-sm text-white outline-none focus:border-deep-orange"
                onChange={(event) => setToken(event.target.value)}
                placeholder="ADMIN_DASHBOARD_TOKEN"
                type="password"
                value={token}
              />
            </label>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-deep-orange px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-black disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadAnalytics()}
              type="button"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Load
            </button>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded border border-[#333] bg-[#0A0A0A] px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!analytics}
              onClick={downloadCsv}
              type="button"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {status ? <p className="mt-3 text-sm text-[#ccc3d8]">{status}</p> : null}
        </div>

        {analytics ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<UsersRound size={18} />} label="Real users" value={analytics.users.realUsers} detail={analytics.users.rawAccounts + " raw account records"} />
              <MetricCard icon={<ShieldCheck size={18} />} label="Claimed .viction" value={analytics.users.claimedViction} detail={analytics.users.fallbackProfiles + " generated profiles hidden"} />
              <MetricCard icon={<Activity size={18} />} label="Active 7 days" value={analytics.users.active7d} detail={analytics.users.active24h + " active in 24h"} />
              <MetricCard icon={<Clock3 size={18} />} label="Avg session" value={formatDuration(analytics.engagement.avgSessionSeconds)} detail={"Median " + formatDuration(analytics.engagement.medianSessionSeconds)} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="User quality" eyebrow="Real-user funnel">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SmallStat label="Wallet-linked" value={analytics.users.walletLinked} />
                  <SmallStat label="EVM wallets" value={analytics.users.evmWallets} />
                  <SmallStat label="TON wallets" value={analytics.users.tonWallets} />
                  <SmallStat label="Email configured" value={analytics.users.emailConfigured} />
                  <SmallStat label="No profile" value={analytics.users.noProfile} />
                  <SmallStat label="Internal marked" value={analytics.users.internalMarked} />
                </div>
              </Panel>

              <Panel title="Acquisition" eyebrow="Auth source">
                <RankedList items={toRankedItems(analytics.acquisition)} empty="No auth-provider data yet." />
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <Panel title="Top areas" eyebrow="Where users go">
                <RankedList items={analytics.productUsage.topAreas} empty="No area events yet." />
              </Panel>
              <Panel title="Top actions" eyebrow="What users do">
                <RankedList items={analytics.productUsage.topActions} empty="No action events yet." />
              </Panel>
              <Panel title="Top paths" eyebrow="Navigation">
                <RankedList items={analytics.productUsage.topPaths} empty="No page path events yet." />
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Engagement" eyebrow="Tracked product usage">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SmallStat label="Sessions" value={analytics.engagement.sessions} />
                  <SmallStat label="Tracked events" value={analytics.engagement.trackedEvents} />
                  <SmallStat label="Events/session" value={analytics.engagement.avgEventsPerSession} />
                  <SmallStat label="Signals" value={analytics.engagement.signals} />
                  <SmallStat label="Positions" value={analytics.engagement.positions} />
                  <SmallStat label="Support tickets" value={analytics.engagement.supportTickets} />
                </div>
              </Panel>

              <Panel title="Recent sessions" eyebrow="Anonymous operational view">
                {analytics.recentSessions.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/70">
                        <tr>
                          <th className="border-b border-[#262626] px-3 py-3">Source</th>
                          <th className="border-b border-[#262626] px-3 py-3">Auth</th>
                          <th className="border-b border-[#262626] px-3 py-3">Path</th>
                          <th className="border-b border-[#262626] px-3 py-3">Time</th>
                          <th className="border-b border-[#262626] px-3 py-3">Events</th>
                          <th className="border-b border-[#262626] px-3 py-3">Last seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.recentSessions.map((session) => (
                          <tr key={session.id}>
                            <td className="border-b border-[#1f1f1f] px-3 py-3 font-mono text-xs text-deep-orange">{session.source}</td>
                            <td className="border-b border-[#1f1f1f] px-3 py-3 font-mono text-xs text-white">{session.authProvider}</td>
                            <td className="max-w-[280px] truncate border-b border-[#1f1f1f] px-3 py-3 text-[#ccc3d8]">{session.currentPath ?? "/"}</td>
                            <td className="border-b border-[#1f1f1f] px-3 py-3 font-mono text-xs text-white">{formatDuration(session.durationSeconds)}</td>
                            <td className="border-b border-[#1f1f1f] px-3 py-3 font-mono text-xs text-white">{session.eventCount}</td>
                            <td className="border-b border-[#1f1f1f] px-3 py-3 font-mono text-xs text-[#ccc3d8]">{formatDate(session.lastSeenAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState>No sessions tracked yet.</EmptyState>
                )}
              </Panel>
            </section>
          </>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#262626] bg-[#080808] p-8 text-center text-sm text-[#ccc3d8]">
            <div>
              <BarChart3 className="mx-auto mb-3 text-[#ccc3d8]/50" size={28} />
              Enter the admin token and load product analytics.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({ detail, icon, label, value }: { detail: string; icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[#262626] bg-[#111111]/95 p-5">
      <div className="flex items-center justify-between gap-3 text-deep-orange">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest">{label}</p>
        {icon}
      </div>
      <strong className="mt-3 block text-3xl font-bold text-white">{value}</strong>
      <p className="mt-2 text-sm text-[#ccc3d8]">{detail}</p>
    </div>
  );
}

function Panel({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="rounded-lg border border-[#262626] bg-[#111111]/95 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold text-white">{title}</h2>
        </div>
        <LineChart className="text-deep-orange" size={18} />
      </div>
      {children}
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#080808] p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">{label}</p>
      <strong className="mt-2 block text-2xl text-white">{value}</strong>
    </div>
  );
}

function RankedList({ empty, items }: { empty: string; items: Array<{ label: string; count: number }> }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;

  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-[#f5f0ff]">{formatLabel(item.label)}</span>
            <span className="font-mono text-xs text-deep-orange">{item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#262626]">
            <div className="h-full rounded-full bg-deep-orange" style={{ width: Math.max((item.count / max) * 100, 4) + "%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-dashed border-[#262626] bg-[#080808] p-6 text-sm text-[#ccc3d8]">{children}</div>;
}

function toRankedItems(record: Record<string, number>) {
  return Object.entries(record)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return Math.round(seconds) + "s";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes + "m " + remainder + "s";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function buildCsv(analytics: AdminUsageAnalyticsResult | null) {
  if (!analytics) return "";

  const rows = [
    ["section", "metric", "value"],
    ["users", "raw_accounts", analytics.users.rawAccounts],
    ["users", "real_users", analytics.users.realUsers],
    ["users", "wallet_linked", analytics.users.walletLinked],
    ["users", "claimed_viction", analytics.users.claimedViction],
    ["users", "fallback_profiles", analytics.users.fallbackProfiles],
    ["users", "email_configured", analytics.users.emailConfigured],
    ["users", "active_24h", analytics.users.active24h],
    ["users", "active_7d", analytics.users.active7d],
    ["engagement", "sessions", analytics.engagement.sessions],
    ["engagement", "tracked_events", analytics.engagement.trackedEvents],
    ["engagement", "avg_session_seconds", analytics.engagement.avgSessionSeconds],
    ["engagement", "median_session_seconds", analytics.engagement.medianSessionSeconds],
    ["engagement", "signals", analytics.engagement.signals],
    ["engagement", "positions", analytics.engagement.positions],
    ["engagement", "support_tickets", analytics.engagement.supportTickets],
  ];

  return rows.map((row) => row.map((cell) => JSON.stringify(String(cell))).join(",")).join("\n");
}
