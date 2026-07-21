"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";

import type {
  Market,
  PolymarketCloseAttempt,
  PolymarketMarginExecution,
  PolymarketPositionControls,
  PreparedPolymarketClose,
  PreparedPolymarketControls,
  PreparedPolymarketRepayment,
  Position,
  UserSession,
} from "../lib/core-api";
import {
  clearPendingReservationHash,
  createExecutionRequestIdentity,
  getPendingReservationHash,
  rememberPendingReservationHash,
  sendPolymarketWalletCall,
  signPolymarketTypedData,
} from "../lib/polymarket-execution-wallet";
import { PositionCard } from "./PositionCard";

type Props = {
  closeAttempts: PolymarketCloseAttempt[];
  controls: PolymarketPositionControls | null;
  execution: PolymarketMarginExecution | null;
  market: Market | null;
  onChanged: () => void;
  position: Position;
  session: UserSession;
  walletAddress: string;
};

type PreparedCloseContext = PreparedPolymarketClose & {
  deadline: number;
  idempotencyKey: string;
  nonce: string;
};

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
const terminalStates = new Set([
  "OPEN",
  "CLOSED",
  "FAILED",
  "CANCELLED",
]);

export function PolymarketPositionLifecycle({
  closeAttempts,
  controls: initialControls,
  execution: initial,
  market,
  onChanged,
  position,
  session,
  walletAddress,
}: Props) {
  const [execution, setExecution] = useState(initial);
  const [controls, setControls] = useState(initialControls);
  const [preparedClose, setPreparedClose] = useState<PreparedCloseContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stopLossPercent, setStopLossPercent] = useState(
    initialControls?.stopLossPrice ? String(Number(initialControls.stopLossPrice) * 100) : "",
  );
  const [takeProfitPercent, setTakeProfitPercent] = useState(
    initialControls?.takeProfitPrice ? String(Number(initialControls.takeProfitPrice) * 100) : "",
  );
  const [repaymentAssets, setRepaymentAssets] = useState("");

  async function resume() {
    if (!execution) return;
    setBusy(true);
    setError(null);
    try {
      const next = await advanceExecution(
        execution,
        session.user.id,
        walletAddress,
        setExecution,
        setStep,
      );
      setExecution(next);
      if (terminalStates.has(next.state)) onChanged();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function prepareClose() {
    setBusy(true);
    setError(null);
    setStep("Reading exit depth");
    try {
      const identity = createExecutionRequestIdentity("close");
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
      const result = await action<{ prepared: PreparedPolymarketClose }>({
        action: "prepare-close",
        deadline,
        idempotencyKey: identity.idempotencyKey,
        maxSlippageBps: 100,
        nonce: identity.nonce,
        positionId: position.id,
        userId: session.user.id,
      });
      setPreparedClose({ ...result.prepared, ...identity, deadline });
      setStep("");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirmClose() {
    if (!preparedClose || !execution) return;
    setBusy(true);
    setError(null);
    setStep("Sign close terms");
    try {
      const signature = await signPolymarketTypedData(walletAddress, preparedClose.typedData);
      await action({
        action: "authorize-close",
        deadline: preparedClose.deadline,
        idempotencyKey: preparedClose.idempotencyKey,
        maxSlippageBps: 100,
        minimumProceeds: preparedClose.quote.minimumProceeds,
        nonce: preparedClose.nonce,
        positionId: position.id,
        priceLimit: preparedClose.quote.priceLimit,
        signature,
        userId: session.user.id,
      });
      const current = { ...execution, state: "CLOSING" as const };
      setExecution(current);
      setPreparedClose(null);
      const closed = await advanceExecution(
        current,
        session.user.id,
        walletAddress,
        setExecution,
        setStep,
      );
      setExecution(closed);
      onChanged();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveRiskControls() {
    if (!execution) return;
    setBusy(true);
    setError(null);
    setStep("Prepare signed exit controls");
    try {
      const stopLossPrice = normalizePercentPrice(stopLossPercent);
      const takeProfitPrice = normalizePercentPrice(takeProfitPercent);
      const identity = createExecutionRequestIdentity("risk-controls");
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
      const prepared = (
        await action<{ prepared: PreparedPolymarketControls }>({
          action: "prepare-controls",
          deadline,
          nonce: identity.nonce,
          positionId: position.id,
          stopLossPrice,
          takeProfitPrice,
          userId: session.user.id,
        })
      ).prepared;
      setStep("Sign exit controls");
      const signature = await signPolymarketTypedData(walletAddress, prepared.typedData);
      const updated = (
        await action<{ controls: PolymarketPositionControls }>({
          action: "authorize-controls",
          deadline,
          nonce: identity.nonce,
          positionId: position.id,
          signature,
          stopLossPrice: prepared.stopLossPrice,
          takeProfitPrice: prepared.takeProfitPrice,
          userId: session.user.id,
        })
      ).controls;
      setControls(updated);
      setStep("");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reducePrincipal() {
    if (!execution || !controls?.activeRepaymentEnabled) return;
    const assets = normalizeAssets(repaymentAssets);
    if (!assets) {
      setError("Enter a positive pUSD repayment amount.");
      return;
    }
    setBusy(true);
    setError(null);
    setStep("Prepare principal reduction");
    try {
      const prepared = (
        await action<{ prepared: PreparedPolymarketRepayment }>({
          action: "prepare-repayment",
          assets,
          positionId: position.id,
          userId: session.user.id,
        })
      ).prepared;
      const approval = prepared.walletCalls.find((call) => call.id === "approve-pusd-repayment");
      if (approval) {
        setStep("Check pUSD approval");
        await sendPolymarketWalletCall(walletAddress, approval, {
          owner: walletAddress,
          requiredAssets: prepared.assets,
          spender: execution.vaultAddress,
          token: approval.to,
        });
      }
      const repayment = prepared.walletCalls.find((call) => call.id === "repay-principal");
      if (!repayment) throw new Error("Core did not return the principal repayment call.");
      setStep("Confirm principal reduction");
      const transactionHash = await sendPolymarketWalletCall(walletAddress, repayment);
      if (!transactionHash) throw new Error("Principal repayment was not submitted.");
      const updated = (
        await action<{ controls: PolymarketPositionControls }>({
          action: "repayment",
          assets: prepared.assets,
          executionId: execution.id,
          transactionHash,
          userId: session.user.id,
        })
      ).controls;
      setControls(updated);
      setRepaymentAssets("");
      onChanged();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="polymarket-lifecycle-card">
      <PositionCard market={market} position={position} />
      {execution ? (
        <section className="rounded border border-[#292929] bg-[#0b0b0b] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
                Polymarket lifecycle
              </p>
              <h4 className="mt-1 text-sm font-bold text-white">{formatState(execution.state)}</h4>
            </div>
            <span className="rounded border border-[#303030] px-2 py-1 font-mono text-[9px] text-[#aaa3b2]">
              Polygon
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Metric label="Actual shares" value={execution.actualShares ?? "Awaiting fill"} />
            <Metric
              label="Actual fill"
              value={
                execution.actualFillPrice ? formatPrice(execution.actualFillPrice) : "Awaiting fill"
              }
            />
            <Metric
              label="Actual spend"
              value={
                execution.actualSpentAssets
                  ? `${execution.actualSpentAssets} pUSD`
                  : "Awaiting fill"
              }
            />
            <Metric
              label="Actual fees"
              value={
                execution.actualFeeAssets ? `${execution.actualFeeAssets} pUSD` : "Awaiting fill"
              }
            />
            <Metric label="Authorized borrow" value={term(execution, "borrowAssets", " pUSD")} />
            <Metric
              label="Custody"
              value={execution.custodyAddress ? short(execution.custodyAddress) : "Preparing"}
            />
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <HashLink hash={execution.fundingTxHash} label="Reservation" />
            <HashLink hash={execution.custodyFundingTxHash} label="Funding" />
            <HashLink hash={execution.securityTransferTxHash} label="Security" />
            <HashLink hash={execution.activationTxHash} label="Activation" />
            {evidenceStrings(execution.settlementTxHashes).map((hash, index) => (
              <HashLink key={hash} hash={hash} label={`Settlement ${index + 1}`} />
            ))}
          </div>
          {execution.clobOrderId ? (
            <p className="mt-3 break-all font-mono text-[10px] text-[#8f8998]">
              CLOB order: {execution.clobOrderId}
            </p>
          ) : null}
          {evidenceStrings(execution.clobTradeIds).length > 0 ? (
            <p className="mt-2 break-all font-mono text-[10px] text-[#8f8998]">
              CLOB trades: {evidenceStrings(execution.clobTradeIds).join(", ")}
            </p>
          ) : null}
          {execution.state === "FAILED" && execution.failureCode === "FOK_NO_FILL" ? (
            <SuccessNotice text="No fill was recorded. Core recovered the funded pUSD and released the vault loan without opening debt." />
          ) : null}
          {execution.failureMessage ? <Notice text={execution.failureMessage} /> : null}
          {error ? <Notice text={error} /> : null}
          {busy ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#ccc3d8]">
              <LoaderCircle size={14} className="animate-spin" />
              {step || "Reconciling execution"}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!terminalStates.has(execution.state) ||
            execution.state === "RECONCILIATION_REQUIRED" ? (
              <Action
                icon={<RefreshCw size={13} />}
                label="Resume"
                onClick={() => void resume()}
                disabled={busy}
              />
            ) : null}
            {execution.state === "OPEN" ? (
              <Action
                icon={<ShieldCheck size={13} />}
                label="Close and repay"
                onClick={() => void prepareClose()}
                disabled={busy}
              />
            ) : null}
          </div>
          {closeAttempts.length > 0 ? (
            <div className="mt-4 border-t border-[#292929] pt-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#8f8998]">
                Close history
              </p>
              {closeAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="mt-2 rounded border border-[#292929] bg-[#111] p-2.5"
                >
                  <p className="text-xs text-[#ccc3d8]">
                    {formatState(attempt.reason)} · {formatState(attempt.stage)}
                    {attempt.actualProceeds ? ` · ${attempt.actualProceeds} pUSD` : ""}
                  </p>
                  {attempt.clobOrderId ? (
                    <p className="mt-1 break-all font-mono text-[9px] text-[#77717e]">
                      Order {attempt.clobOrderId}
                    </p>
                  ) : null}
                  {evidenceStrings(attempt.clobTradeIds).length > 0 ? (
                    <p className="mt-1 break-all font-mono text-[9px] text-[#77717e]">
                      Trades {evidenceStrings(attempt.clobTradeIds).join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <HashLink hash={attempt.vaultBeginTxHash} label="Close started" />
                    <HashLink hash={attempt.returnTxHash} label="Proceeds returned" />
                    <HashLink hash={attempt.vaultSettlementTxHash} label="Vault repaid" />
                    {evidenceStrings(attempt.settlementTxHashes).map((hash, index) => (
                      <HashLink key={hash} hash={hash} label={`Venue ${index + 1}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {execution.state === "OPEN" && controls ? (
            <div className="mt-4 border-t border-[#292929] pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
                    Position protection
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#a9a2b0]">
                    Set optional YES-price triggers. Conviction signs these controls to this wallet
                    and position.
                  </p>
                </div>
                <span className="rounded border border-[#303030] px-2 py-1 font-mono text-[9px] text-[#aaa3b2]">
                  Debt {controls.currentBorrowAssets ?? "0"} pUSD
                </span>
              </div>
              {controls.health ? (
                <div className="mt-3 rounded border border-[#292929] bg-[#111] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#77717e]">
                      Current health
                    </span>
                    <HealthStatus status={controls.health.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Metric
                      label="Executable exit"
                      value={
                        controls.health.executableExitPrice
                          ? formatPrice(controls.health.executableExitPrice)
                          : "Unavailable"
                      }
                    />
                    <Metric
                      label="Minimum proceeds"
                      value={
                        controls.health.minimumExitProceeds
                          ? `${controls.health.minimumExitProceeds} pUSD`
                          : "Unavailable"
                      }
                    />
                    <Metric
                      label="Required proceeds"
                      value={
                        controls.health.requiredExitProceeds
                          ? `${controls.health.requiredExitProceeds} pUSD`
                          : "Unavailable"
                      }
                    />
                    <Metric
                      label="Debt coverage"
                      value={
                        controls.health.debtCoverageBps === null
                          ? "Unavailable"
                          : `${(controls.health.debtCoverageBps / 100).toFixed(2)}%`
                      }
                    />
                  </dl>
                  <p className="mt-2 text-[10px] leading-relaxed text-[#77717e]">
                    {controls.health.warning}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ControlInput
                  label="Stop loss"
                  value={stopLossPercent}
                  onChange={setStopLossPercent}
                  disabled={busy}
                />
                <ControlInput
                  label="Take profit"
                  value={takeProfitPercent}
                  onChange={setTakeProfitPercent}
                  disabled={busy}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Action
                  icon={<ShieldCheck size={13} />}
                  label="Save protection"
                  onClick={() => void saveRiskControls()}
                  disabled={busy}
                />
                <span className="text-[10px] leading-relaxed text-[#77717e]">
                  Leave either field blank to disable that trigger.
                </span>
              </div>
              {controls.activeRepaymentEnabled && Number(controls.currentBorrowAssets ?? 0) > 0 ? (
                <div className="mt-4 rounded border border-[#292929] bg-[#111] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#77717e]">
                        Add collateral / reduce debt
                      </span>
                      <div className="relative mt-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={repaymentAssets}
                          onChange={(event) => setRepaymentAssets(event.target.value)}
                          disabled={busy}
                          placeholder="0.00"
                          className="h-10 w-full rounded border border-[#303030] bg-[#090909] px-3 pr-14 font-mono text-sm text-white outline-none focus:border-deep-orange disabled:opacity-50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#77717e]">
                          pUSD
                        </span>
                      </div>
                    </label>
                    <Action
                      icon={<ArrowUpRight size={13} />}
                      label="Reduce debt"
                      onClick={() => void reducePrincipal()}
                      disabled={busy || !repaymentAssets.trim()}
                    />
                  </div>
                  {controls.repayments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {controls.repayments.map((repayment) => (
                        <HashLink
                          key={repayment.id}
                          hash={repayment.transactionHash}
                          label={`${repayment.assets} pUSD repaid`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-[10px] leading-relaxed text-[#77717e]">{controls.warning}</p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded border border-[#292929] bg-[#0b0b0b] p-4 text-xs text-[#8f8998]">
          No production execution authorization exists for this Polygon intent.
        </section>
      )}

      {preparedClose ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm close"
        >
          <section className="w-full max-w-md rounded border border-[#303030] bg-[#151515] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
                  Close and repay
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">Review exit terms</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreparedClose(null)}
                className="grid h-9 w-9 place-items-center rounded border border-[#303030] text-[#ccc3d8]"
                aria-label="Cancel close"
              >
                <X size={15} />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <Metric label="Shares to sell" value={preparedClose.quote.amountShares} />
              <Metric
                label="Minimum proceeds"
                value={`${preparedClose.quote.minimumProceeds} pUSD`}
              />
              <Metric
                label="Depth floor"
                value={formatPrice(preparedClose.quote.depthFloorPrice)}
              />
              <Metric
                label="Maximum venue fee"
                value={`${preparedClose.quote.maximumVenueFeeAssets} pUSD`}
              />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-[#a9a2b0]">{preparedClose.warning}</p>
            <button
              type="button"
              onClick={() => void confirmClose()}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-deep-orange px-4 py-3 text-xs font-bold uppercase text-black disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Confirm full close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

async function advanceExecution(
  initial: PolymarketMarginExecution,
  userId: string,
  walletAddress: string,
  update: (value: PolymarketMarginExecution) => void,
  status: (value: string) => void,
) {
  let current = initial;
  for (let index = 0; index < 48 && !terminalStates.has(current.state); index += 1) {
    if (current.state === "AUTHORIZED") {
      const approval = current.stageInstruction?.approvalCall;
      const reservation = current.stageInstruction?.walletCall;
      if (!approval || !reservation) {
        throw new Error("Core did not return recoverable reservation instructions.");
      }
      status("Check pUSD approval");
      await sendPolymarketWalletCall(walletAddress, approval, {
        owner: walletAddress,
        requiredAssets: termValue(current, "collateralAssets"),
        spender: reservation.to,
        token: approval.to,
      });
      status("Reserve vault liquidity");
      const hash =
        getPendingReservationHash(current.id) ??
        (await sendPolymarketWalletCall(walletAddress, reservation));
      if (!hash) throw new Error("Vault reservation was not submitted.");
      rememberPendingReservationHash(current.id, hash);
      current = (
        await action<{ execution: PolymarketMarginExecution }>({
          action: "reservation",
          executionId: current.id,
          transactionHash: hash,
          userId,
        })
      ).execution;
      clearPendingReservationHash(current.id);
    } else if (current.state === "WALLET_COMMIT_REQUIRED") {
      const call = current.stageInstruction?.walletCall;
      if (!call) return current;
      status("Confirm isolated execution wallet");
      const hash = await sendPolymarketWalletCall(walletAddress, call);
      if (!hash) throw new Error("Wallet commitment was not submitted.");
      current = (
        await action<{ execution: PolymarketMarginExecution }>({
          action: "wallet-commit",
          executionId: current.id,
          transactionHash: hash,
          userId,
        })
      ).execution;
    } else {
      status(formatState(current.state));
      current = (
        await action<{ execution: PolymarketMarginExecution }>({
          action: "advance",
          executionId: current.id,
          userId,
        })
      ).execution;
    }
    update(current);
    if (["WALLET_DEPLOYING", "ORDER_SUBMITTED", "CLOSING"].includes(current.state))
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  return current;
}

async function action<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/polymarket-execution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !result.ok)
    throw new Error(result.ok ? "Execution request failed." : result.error.message);
  return result.data;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#292929] bg-[#111] p-2.5">
      <dt className="font-mono text-[8px] uppercase tracking-widest text-[#77717e]">{label}</dt>
      <dd className="mt-1 break-all font-semibold text-white">{value}</dd>
    </div>
  );
}
function HashLink({ hash, label }: { hash: string | null; label: string }) {
  return hash ? (
    <a
      className="inline-flex items-center gap-1 rounded border border-[#303030] px-2 py-1 font-mono text-[9px] text-deep-orange hover:text-white"
      href={`https://polygonscan.com/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
    >
      {label} {short(hash)} <ArrowUpRight size={10} />
    </a>
  ) : null;
}
function Action({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded border border-deep-orange/60 px-3 py-2 font-mono text-[9px] font-bold uppercase text-deep-orange hover:bg-deep-orange hover:text-black disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
function ControlInput({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#77717e]">
        {label}
      </span>
      <div className="relative mt-1.5">
        <input
          type="number"
          min="0.01"
          max="99.99"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="Disabled"
          className="h-10 w-full rounded border border-[#303030] bg-[#090909] px-3 pr-8 font-mono text-sm text-white outline-none focus:border-deep-orange disabled:opacity-50"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#77717e]">
          %
        </span>
      </div>
    </label>
  );
}
function Notice({ text }: { text: string }) {
  return (
    <p className="mt-3 flex gap-2 rounded border border-red-900/50 bg-red-950/20 p-2.5 text-xs leading-relaxed text-red-200">
      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
      {text}
    </p>
  );
}
function SuccessNotice({ text }: { text: string }) {
  return (
    <p className="mt-3 flex gap-2 rounded border border-emerald-900/50 bg-emerald-950/20 p-2.5 text-xs leading-relaxed text-emerald-200">
      <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
      {text}
    </p>
  );
}
function HealthStatus({ status }: { status: "HEALTHY" | "LIQUIDATION_REQUIRED" | "UNAVAILABLE" }) {
  const tone =
    status === "HEALTHY"
      ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
      : status === "LIQUIDATION_REQUIRED"
        ? "border-red-900/60 bg-red-950/30 text-red-300"
        : "border-amber-900/60 bg-amber-950/30 text-amber-300";
  return (
    <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase ${tone}`}>
      {formatState(status)}
    </span>
  );
}
function term(execution: PolymarketMarginExecution, key: string, suffix = "") {
  const value = termValue(execution, key);
  return value ? `${value}${suffix}` : "Unavailable";
}
function termValue(execution: PolymarketMarginExecution, key: string) {
  const value = execution.authorizedTerms[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function formatPrice(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(2)}c` : value;
}
function formatState(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function short(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}
function evidenceStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}
function normalizePercentPrice(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100)
    throw new Error("Protection prices must be greater than 0% and less than 100%.");
  return (numeric / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
function normalizeAssets(value: string) {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(trimmed) || Number(trimmed) <= 0) return null;
  return trimmed;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Execution request failed.";
}
