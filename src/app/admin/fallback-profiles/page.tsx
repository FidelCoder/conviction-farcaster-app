"use client";

import { useMemo, useState } from "react";
import { Download, EyeOff, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

import type { AdminFallbackProfile } from "../../../lib/core-api";

type AdminResponse =
  | { ok: true; data: { count: number; fallbackProfiles: AdminFallbackProfile[] } }
  | { ok: false; error: { code: string; message: string } };

export default function FallbackProfilesAdminPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<AdminFallbackProfile[]>([]);

  const csv = useMemo(() => buildCsv(profiles), [profiles]);

  async function loadProfiles() {
    if (!token.trim()) {
      setStatus("Enter the admin token first.");
      return;
    }

    setLoading(true);
    setStatus("Loading fallback profiles...");

    try {
      const response = await fetch("/api/admin/fallback-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = (await response.json()) as AdminResponse;

      if (!body.ok) {
        setProfiles([]);
        setStatus(body.error.message);
        return;
      }

      setProfiles(body.data.fallbackProfiles);
      setStatus("Loaded " + body.data.count + " fallback profiles.");
    } catch {
      setProfiles([]);
      setStatus("Admin dashboard is unavailable right now.");
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
    anchor.download = "conviction-fallback-viction-profiles.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#050505] bg-grid-tech px-4 py-8 text-white sm:px-6 lg:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-lg border border-[#262626] bg-[#111111]/95 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Admin only</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Fallback .viction profiles</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#ccc3d8]">
                Private dashboard for accounts that still have generated handles. Use this to audit wallets that must be pushed back through the profile-claim flow.
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
              onClick={() => void loadProfiles()}
              type="button"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Load
            </button>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded border border-[#333] bg-[#0A0A0A] px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!profiles.length}
              onClick={downloadCsv}
              type="button"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {status ? <p className="mt-3 text-sm text-[#ccc3d8]">{status}</p> : null}
        </div>

        <section className="rounded-lg border border-[#262626] bg-[#111111]/95 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Profiles</p>
              <h2 className="text-xl font-bold">Generated handle audit</h2>
            </div>
            <span className="font-mono text-xs text-[#ccc3d8]">{profiles.length} records</span>
          </div>

          {profiles.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/70">
                  <tr>
                    <th className="border-b border-[#262626] px-3 py-3">Handle</th>
                    <th className="border-b border-[#262626] px-3 py-3">Reason</th>
                    <th className="border-b border-[#262626] px-3 py-3">Wallets</th>
                    <th className="border-b border-[#262626] px-3 py-3">User ID</th>
                    <th className="border-b border-[#262626] px-3 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.traderProfileId}>
                      <td className="border-b border-[#1f1f1f] px-3 py-4 font-mono text-deep-orange">{profile.handle}</td>
                      <td className="border-b border-[#1f1f1f] px-3 py-4 font-mono text-xs uppercase tracking-widest text-[#ccc3d8]">{profile.reason.replaceAll("_", " ")}</td>
                      <td className="border-b border-[#1f1f1f] px-3 py-4">
                        <div className="flex flex-col gap-1 font-mono text-xs text-white">
                          {profile.wallets.length ? profile.wallets.map((wallet) => (
                            <span className="break-all" key={wallet.type + wallet.address}>{wallet.type}: {wallet.address}</span>
                          )) : <span className="text-[#ccc3d8]/60">No wallet account</span>}
                        </div>
                      </td>
                      <td className="border-b border-[#1f1f1f] px-3 py-4 font-mono text-xs text-[#ccc3d8]">{profile.userId}</td>
                      <td className="border-b border-[#1f1f1f] px-3 py-4 font-mono text-xs text-[#ccc3d8]">{formatDate(profile.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded border border-dashed border-[#262626] bg-[#080808] p-8 text-center text-sm text-[#ccc3d8]">
              <div>
                <EyeOff className="mx-auto mb-3 text-[#ccc3d8]/50" size={24} />
                Enter the admin token and load fallback profiles.
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function buildCsv(profiles: AdminFallbackProfile[]) {
  if (!profiles.length) return "";
  const rows = [["handle", "reason", "wallet_type", "wallet_address", "user_id", "trader_profile_id", "updated_at"]];

  profiles.forEach((profile) => {
    if (!profile.wallets.length) {
      rows.push([profile.handle, profile.reason, "", "", profile.userId, profile.traderProfileId, profile.updatedAt]);
      return;
    }

    profile.wallets.forEach((wallet) => {
      rows.push([profile.handle, profile.reason, wallet.type, wallet.address, profile.userId, profile.traderProfileId, profile.updatedAt]);
    });
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}
