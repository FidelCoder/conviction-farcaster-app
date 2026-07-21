import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getVaultAvailableBalance } from "../../lib/wallet-balances";
import { GlobalRiskParameter, UserPortfolio, Vault, VaultDepositTransaction } from "../types";
import { Check, Copy, ExternalLink, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";

function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(amount: number, symbol: string) {
  const formatted = amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 1 ? 2 : 6,
    minimumFractionDigits: amount >= 1 ? 2 : 0,
  });

  return `${formatted} ${symbol}`;
}

interface VaultsViewProps {
  vaults: Vault[];
  riskParameters: GlobalRiskParameter[];
  portfolio: UserPortfolio;
  onDeposit: (
    vaultId: string,
    amount: number,
  ) => Promise<VaultDepositTransaction | false> | VaultDepositTransaction | false | void;
  onWithdraw: (vaultId: string, amount: number) => Promise<boolean> | boolean | void;
  onRefreshWalletBalances?: () => void;
}

export default function VaultsView({
  vaults,
  riskParameters,
  portfolio,
  onDeposit,
  onWithdraw,
  onRefreshWalletBalances,
}: VaultsViewProps) {
  const [activeModal, setActiveModal] = useState<"none" | "deposit" | "withdraw">("none");
  const [selectedVaultId, setSelectedVaultId] = useState<string>("");
  const [transactionAmount, setTransactionAmount] = useState<string>("");
  const [fundingCopyState, setFundingCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [confirmedDeposit, setConfirmedDeposit] = useState<VaultDepositTransaction | null>(null);

  const activeVault = vaults.find((v) => v.id === selectedVaultId);
  const fundingAddress = portfolio.address;
  const fundingQrValue = fundingAddress ? `ethereum:${fundingAddress}` : "";
  const totalValueLockedValue = Object.values(portfolio.vaultMetrics).reduce(
    (total, metrics) => total + metrics.totalAssets,
    0,
  );

  const recentTransactions = useMemo(
    () => portfolio.vaultTransactions.slice(0, 8),
    [portfolio.vaultTransactions],
  );

  const activeVaultLiveBalance = activeVault ? portfolio.walletBalances[activeVault.id] : undefined;
  const activeVaultAvailable = activeVault
    ? getVaultAvailableBalance({ portfolio, vault: activeVault })
    : 0;
  const activeVaultBalanceLabel = activeVault
    ? activeVaultLiveBalance?.status === "ready"
      ? formatTokenAmount(activeVaultLiveBalance.amount, activeVault.asset)
      : `${activeVaultAvailable.toFixed(2)} ${activeVault.asset}`
    : "--";
  const activeVaultBalanceSource =
    activeVaultLiveBalance?.status === "ready"
      ? `${activeVaultLiveBalance.chainName} wallet balance`
      : portfolio.walletBalancesStatus === "loading"
        ? "Reading wallet balance..."
        : activeVaultLiveBalance?.status === "error"
          ? "Balance read failed"
          : "Wallet balance unavailable";

  const openDeposit = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setTransactionAmount("");
    setFundingCopyState("idle");
    setActiveModal("deposit");
  };

  const openWithdraw = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setTransactionAmount("");
    setActiveModal("withdraw");
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDepositing) return;
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a positive numeric collateral amount.");
      return;
    }
    const currentVault = vaults.find((v) => v.id === selectedVaultId);
    if (!currentVault) return;

    if (!portfolio.connected || !portfolio.address) {
      alert("Sign in from the top-right action before funding or depositing into a vault.");
      return;
    }

    const available = getVaultAvailableBalance({ portfolio, vault: currentVault });
    if (amount > available) {
      alert(
        `Insufficient Funds: You only have ${available.toFixed(2)} ${currentVault.asset} available. Add funds to your connected wallet using the QR code or copy address, then try again.`,
      );
      return;
    }

    setIsDepositing(true);

    try {
      const result = await onDeposit(selectedVaultId, amount);

      if (result && typeof result === "object") {
        setConfirmedDeposit(result);
        setActiveModal("none");
      }
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a positive numeric collateral amount.");
      return;
    }
    const currentVault = vaults.find((v) => v.id === selectedVaultId);
    if (!currentVault) return;

    if (amount > (portfolio.vaultTotalBalances[selectedVaultId] || 0)) {
      alert(
        `Insufficient Deposits: You hold ${(portfolio.vaultTotalBalances[selectedVaultId] || 0).toFixed(2)} in this vault.`,
      );
      return;
    }
    setIsWithdrawing(true);
    try {
      const completed = await onWithdraw(selectedVaultId, amount);
      if (completed) setActiveModal("none");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const copyFundingAddress = async () => {
    if (!fundingAddress) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fundingAddress);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = fundingAddress;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setFundingCopyState("copied");
      window.setTimeout(() => setFundingCopyState("idle"), 1800);
    } catch {
      setFundingCopyState("failed");
    }
  };

  function closeConfirmation() {
    setConfirmedDeposit(null);
    setSelectedVaultId("");
  }

  return (
    <main className="flex-1 bg-grid-tech pt-8 px-4 md:px-10 pb-32 max-w-[1280px] mx-auto w-full">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Total Value Locked (TVL)"
          value={
            totalValueLockedValue > 0
              ? "$" +
                totalValueLockedValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "--"
          }
        />
        <MetricCard label="Weighted Protocol APY" value="--" tone="green" />
        <MetricCard
          label="Active Margin Requests"
          value={String(portfolio.activeRequestsCount)}
          tone="orange"
        />
      </section>

      <section className="mb-10">
        <div className="mb-6">
          <div>
            <h1 className="text-2xl font-sans font-bold text-white">Active Liquidity Vaults</h1>
            <p className="text-xs text-[#ccc3d8]/80 mt-1">
              Provide liquidity to back prediction contracts and claim institutional yields.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {vaults.map((vault) => {
            const isPurple = vault.accentColor === "purple";
            const userBalance = portfolio.vaultBalances[vault.id] || 0;
            const metrics = portfolio.vaultMetrics[vault.id];

            return (
              <div
                key={vault.id}
                className={`bg-surface-card border border-[#262626] rounded-lg flex flex-col relative overflow-hidden transition-all duration-300 ${
                  isPurple
                    ? "border-t-2 border-t-electric-purple"
                    : "border-t-2 border-t-deep-orange"
                }`}
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-5 gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1">{vault.name}</h2>
                      <span
                        className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          isPurple
                            ? "text-[#EF4444] bg-[#EF4444]/10"
                            : "text-primary bg-[#7c3aed]/10"
                        }`}
                      >
                        {vault.riskTag}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-[#10B981] mb-1">
                        -- APY
                      </div>
                      <div className="font-mono text-[9px] text-[#ccc3d8] uppercase tracking-wider font-semibold">
                        Accrued fees only
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5 border-y border-[#262626]/40 py-4 font-mono text-xs text-[#ccc3d8]">
                    <VaultStat
                      label="Total Assets"
                      value={metrics ? formatTokenAmount(metrics.totalAssets, vault.asset) : "--"}
                    />
                    <VaultStat
                      label="Utilization"
                      value={metrics ? `${metrics.utilization.toFixed(2)}%` : "--"}
                    />
                    <VaultStat
                      label="Available Liquidity"
                      value={
                        metrics ? formatTokenAmount(metrics.availableLiquidity, vault.asset) : "--"
                      }
                      tone="green"
                    />
                    <VaultStat label="Max Leverage Allowed" value={`${vault.maxLeverage}x`} />
                    <VaultStat
                      label="Borrowed"
                      value={
                        metrics ? formatTokenAmount(metrics.borrowedAssets, vault.asset) : "--"
                      }
                    />
                    <VaultStat
                      label="Reserved"
                      value={
                        metrics ? formatTokenAmount(metrics.reservedAssets, vault.asset) : "--"
                      }
                    />
                    <VaultStat
                      label="Share Value"
                      value={metrics ? `${metrics.shareValue.toFixed(6)} ${vault.asset}` : "--"}
                    />
                    <VaultStat
                      label="Withdrawal Queue"
                      value={metrics ? formatTokenAmount(metrics.queuedAssets, vault.asset) : "--"}
                    />
                  </div>

                  <div className="rounded border border-[#262626] bg-[#0a0a0a] p-3 font-mono">
                    <div className="flex justify-between items-center gap-3 text-xs">
                      <span className="text-[#ccc3d8]/85">Your Vault Balance</span>
                      <span className="text-white font-bold text-sm">
                        {formatTokenAmount(userBalance, vault.asset)}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-[#ccc3d8]/50">
                      {portfolio.walletBalancesStatus === "loading"
                        ? "Syncing onchain balance"
                        : "Available in vault contract"}
                    </div>
                  </div>
                </div>

                <div className="bg-[#1b1a1a] p-3 border-t border-[#262626] grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openDeposit(vault.id)}
                    className={`text-black py-2.5 rounded font-sans font-bold text-xs tracking-wider uppercase opacity-95 hover:opacity-100 transition-opacity cursor-pointer ${
                      isPurple ? "bg-electric-purple text-white" : "bg-deep-orange text-black"
                    }`}
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => openWithdraw(vault.id)}
                    className="border border-[#ccc3d8]/40 hover:border-white text-white py-2.5 rounded font-sans font-bold text-xs tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] gap-5">
        <RiskTable riskParameters={riskParameters} />
        <TransactionHistory transactions={recentTransactions} />
      </section>

      {activeModal === "deposit" && activeVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleDepositSubmit}
            className="bg-[#161616] border border-[#262626] rounded-lg w-full max-w-xl p-5 relative animate-scale-up"
          >
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              className="absolute right-3 top-3 rounded border border-[#262626] p-2 text-[#ccc3d8] hover:text-white"
            >
              <X size={15} />
            </button>
            <div className="mb-4 pr-10">
              <div className="flex items-center gap-2 text-deep-orange mb-2">
                <Wallet size={16} />
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
                  Vault Deposit
                </span>
              </div>
              <h3 className="text-lg font-sans font-bold text-white">{activeVault.name}</h3>
              <p className="text-xs text-[#ccc3d8] mt-2 leading-relaxed">
                Available: {activeVaultBalanceLabel}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <section className="rounded border border-[#262626] bg-[#0A0A0A] p-3">
                {portfolio.connected && fundingAddress ? (
                  <>
                    <div className="mx-auto flex aspect-square w-full items-center justify-center rounded border border-[#262626] bg-white p-2">
                      <QRCodeSVG
                        value={fundingQrValue}
                        size={112}
                        bgColor="#ffffff"
                        fgColor="#0A0A0A"
                        level="M"
                        className="h-full w-full"
                        title="Funding QR code"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={copyFundingAddress}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-deep-orange/50 px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange hover:bg-deep-orange hover:text-black"
                    >
                      {fundingCopyState === "copied" ? <Check size={13} /> : <Copy size={13} />}
                      {fundingCopyState === "copied" ? "Copied" : "Copy"}
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-[#ccc3d8]">Sign in to reveal funding QR.</div>
                )}
              </section>

              <section className="grid gap-3">
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <DepositMetric
                    label="Funding"
                    value={fundingAddress ? "Ready" : "Not Connected"}
                  />
                  <DepositMetric label="Chain" value={activeVault.chainName ?? "Vault Chain"} />
                </div>
                <label>
                  <span className="mb-2 block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-bold">
                    Amount
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                      disabled={!portfolio.connected || !fundingAddress || isDepositing}
                      className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-lg text-right focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="absolute left-3 top-4 text-xs font-mono font-bold text-[#ccc3d8] italic">
                      {activeVault.asset}
                    </span>
                  </div>
                </label>
                <div className="flex items-center justify-between gap-3 text-[10px] text-[#ccc3d8]/60">
                  <span>{activeVaultBalanceSource}</span>
                  <button
                    type="button"
                    onClick={onRefreshWalletBalances}
                    disabled={
                      !onRefreshWalletBalances || portfolio.walletBalancesStatus === "loading"
                    }
                    className="inline-flex items-center gap-1 font-mono font-bold uppercase tracking-widest text-deep-orange disabled:opacity-40"
                  >
                    <RefreshCw
                      size={12}
                      className={portfolio.walletBalancesStatus === "loading" ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!portfolio.connected || !fundingAddress || isDepositing}
                  className="bg-deep-orange text-black font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDepositing ? "Waiting For Wallet" : "Deposit To Vault"}
                </button>
              </section>
            </div>
          </form>
        </div>
      )}

      {confirmedDeposit ? (
        <DepositConfirmation transaction={confirmedDeposit} onClose={closeConfirmation} />
      ) : null}

      {activeModal === "withdraw" && activeVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleWithdrawSubmit}
            className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-md p-6 relative glow-orange"
          >
            <h3 className="text-lg font-sans font-bold text-white mb-2">Withdraw Liquidity</h3>
            <p className="text-xs text-[#ccc3d8] mb-5">
              Pull capital out of <span className="font-bold text-white">{activeVault.name}</span>.
              Available now: {(portfolio.vaultBalances[activeVault.id] || 0).toFixed(2)}{" "}
              {activeVault.asset}. Any remaining vault shares enter the onchain withdrawal queue.
            </p>
            <div className="mb-6">
              <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-bold mb-2">
                Withdraw Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-lg text-right focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors"
                />
                <span className="absolute left-3 top-4 text-xs font-mono font-bold text-[#ccc3d8] italic">
                  {activeVault.asset}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isWithdrawing}
                className="flex-1 bg-deep-orange text-black font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isWithdrawing ? "Waiting For Wallet" : "Confirm Withdraw"}
              </button>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="flex-1 border border-[#ccc3d8]/40 hover:border-white text-white font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "green" | "orange";
  value: string;
}) {
  const color =
    tone === "green" ? "text-[#10B981]" : tone === "orange" ? "text-[#F97316]" : "text-white";

  return (
    <div className="bg-surface-card border border-[#262626] rounded-lg p-5">
      <div className="font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">
        {label}
      </div>
      <div className={`font-mono text-2xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function VaultStat({ label, tone, value }: { label: string; tone?: "green"; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[#ccc3d8]/60 mb-1 uppercase tracking-wider">{label}</div>
      <div
        className={`font-semibold text-sm ${tone === "green" ? "text-[#10B981]" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}

function DepositMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#0A0A0A] p-3 font-mono">
      <div className="text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function TransactionHistory({ transactions }: { transactions: VaultDepositTransaction[] }) {
  return (
    <section className="rounded-lg border border-[#262626] bg-[#161616] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Vault Transaction History</h2>
        <p className="text-xs text-[#ccc3d8]/70">
          Confirmed deposit and withdrawal receipts from this wallet session.
        </p>
      </div>
      {transactions.length === 0 ? (
        <div className="rounded border border-[#262626] bg-[#0A0A0A] p-4 text-xs text-[#ccc3d8]/70">
          No vault transactions yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded border border-[#262626] bg-[#0A0A0A] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-white">
                    {tx.type === "WITHDRAWAL"
                      ? "-"
                      : tx.type === "REDEMPTION_REQUEST"
                        ? "Queue "
                        : "+"}
                    {formatTokenAmount(tx.amount, tx.asset)}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#ccc3d8]/70">{tx.vaultName}</div>
                </div>
                <span className="rounded border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#10B981]">
                  {tx.status}
                </span>
              </div>
              <a
                href={getExplorerUrl(tx)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange"
              >
                View transaction <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RiskTable({ riskParameters }: { riskParameters: GlobalRiskParameter[] }) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-sans font-bold text-white">Protocol Risk Configuration</h2>
        <p className="text-xs text-[#ccc3d8]/80 mt-1">
          Read-only limits reported by the Core execution service.
        </p>
      </div>
      <div className="bg-[#161616] border border-[#262626] rounded-lg overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left border-collapse">
          <thead>
            <tr className="bg-[#1c1b1b] border-b border-[#262626]">
              <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">
                Parameter
              </th>
              <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">
                Current
              </th>
              <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs divide-y divide-[#262626]/40">
            {riskParameters.map((param, index) => (
              <tr
                key={`${param.parameter}-${index}`}
                className="hover:bg-[#1A1A1A] transition-colors"
              >
                <td className="p-4 py-3 font-semibold text-white">{param.parameter}</td>
                <td className="p-4 py-3 text-[#ccc3d8]">{param.currentValue}</td>
                <td className="p-4 py-3">
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      param.status === "Active" ? "text-[#10B981]" : "text-deep-orange"
                    }`}
                  >
                    <ShieldCheck size={14} />
                    {param.status === "Active" ? "Active" : "Not enabled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DepositConfirmation({
  transaction,
  onClose,
}: {
  transaction: VaultDepositTransaction;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <section className="w-full max-w-md rounded-lg border border-[#262626] border-t-2 border-t-[#10B981] bg-[#161616] p-5 shadow-2xl animate-scale-up">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Deposit Confirmed
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">
              {formatTokenAmount(transaction.amount, transaction.asset)}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded border border-[#262626] p-2 text-[#ccc3d8] hover:text-white"
            aria-label="Close confirmation"
          >
            <X size={15} />
          </button>
        </div>
        <dl className="grid gap-3 text-sm">
          <ConfirmationRow label="Vault" value={transaction.vaultName} />
          <ConfirmationRow
            label="Chain"
            value={transaction.chainName ?? String(transaction.chainId ?? "Unknown")}
          />
          {transaction.approvalHash ? (
            <ConfirmationRow
              label="Approval"
              value={formatWalletAddress(transaction.approvalHash)}
            />
          ) : null}
          <ConfirmationRow
            label="Deposit Tx"
            value={formatWalletAddress(transaction.depositHash)}
          />
        </dl>
        <a
          href={getExplorerUrl(transaction)}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center justify-center gap-2 rounded bg-deep-orange px-3 py-3 font-sans text-xs font-bold uppercase tracking-wider text-black"
        >
          View on explorer <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#0A0A0A] p-3">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">{label}</dt>
      <dd className="mt-1 break-words font-mono text-xs font-bold text-white">{value}</dd>
    </div>
  );
}

function getExplorerUrl(transaction: VaultDepositTransaction) {
  const explorers: Record<number, string> = {
    137: "https://polygonscan.com/tx/",
    84532: "https://sepolia.basescan.org/tx/",
    11155111: "https://sepolia.etherscan.io/tx/",
    421614: "https://sepolia.arbiscan.io/tx/",
  };

  return (
    (explorers[transaction.chainId ?? 0] ?? "https://polygonscan.com/tx/") + transaction.depositHash
  );
}
