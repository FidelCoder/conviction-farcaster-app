"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  ExecutionCapabilities,
  PolymarketMarginExecution,
  PreparedPolymarketMarginExecution,
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
import type { PredictionMarket, UserPortfolio } from "../zip-ui/types";

type MarginIntentResponse =
  | { ok: true; data: { position: { id: string } } }
  | { ok: false; error: { code: string; message: string } };

type ExecutionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type ReviewContext = {
  deadline: number;
  idempotencyKey: string;
  nonce: string;
  positionId: string;
  prepared: PreparedPolymarketMarginExecution;
};

type Props = {
  execution: ExecutionCapabilities;
  market: PredictionMarket;
  onStatus: (type: "success" | "info", message: string) => void;
  portfolio: UserPortfolio;
  session: UserSession | null;
};

const terminalStates = new Set([
  "OPEN",
  "CLOSED",
  "FAILED",
  "CANCELLED",
  "RECONCILIATION_REQUIRED",
]);

export function PolymarketMarginPanel({ execution, market, onStatus, portfolio, session }: Props) {
  const polygon = execution.chains.find((chain) => chain.chainId === 137);
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [collateral, setCollateral] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [slippageBps, setSlippageBps] = useState(100);
  const [review, setReview] = useState<ReviewContext | null>(null);
  const [liveExecution, setLiveExecution] = useState<PolymarketMarginExecution | null>(null);
  const [pendingReservationHash, setPendingReservationHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("Review order");
  const [error, setError] = useState<string | null>(null);
  const maxLeverage = Math.max(2, Math.min(3, execution.maxPendingMarginLeverage ?? 3));
  const walletBalance = portfolio.walletBalances["chain-137"];
  const available = walletBalance?.status === "ready" ? walletBalance.amount : null;
  const eligible = Boolean(
    polygon?.marginExecutionEnabled &&
      polygon.vaultAddress &&
      polygon.collateralTokenAddress &&
      market.status === "LIVE" &&
      market.yesTokenId &&
      market.noTokenId,
  );
  const blockedReason = useMemo(() => {
    if (!polygon?.marginExecutionEnabled) return execution.recommendation;
    if (!market.yesTokenId || !market.noTokenId)
      return "This market is not mapped to both Polymarket outcome tokens.";
    if (market.status !== "LIVE") return "This market is no longer accepting margin orders.";
    if (!polygon.vaultAddress || !polygon.collateralTokenAddress)
      return "The Polygon pUSD vault is not configured.";
    return null;
  }, [execution.recommendation, market, polygon]);

  async function prepareReview() {
    setError(null);
    if (!eligible || !polygon)
      return setError(blockedReason ?? "Production execution is unavailable.");
    if (!session || !portfolio.address)
      return setError("Sign in before opening a margin position.");
    const assets = normalizeAssets(collateral);
    if (!assets) return setError("Enter a positive pUSD collateral amount.");
    if (walletBalance?.status === "ready" && exceedsWalletBalance(assets, walletBalance.raw))
      return setError(`Wallet balance is ${walletBalance.amount.toFixed(2)} pUSD.`);

    setBusy(true);
    setStep("Checking market depth");
    try {
      const positionResponse = await fetch("/api/margin-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: 137,
          leverageMultiplier: String(leverage),
          marginCollateral: assets,
          marketId: market.id,
          quantity: multiplyAssets(assets, leverage),
          side,
          userId: session.user.id,
          visibility,
          walletAddress: portfolio.address,
        }),
      });
      const positionBody = (await positionResponse.json()) as MarginIntentResponse;
      if (!positionResponse.ok || !positionBody.ok) {
        throw new Error(
          positionBody.ok ? "Margin position could not be created." : positionBody.error.message,
        );
      }

      const identity = createExecutionRequestIdentity("open");
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
      const prepared = await executionAction<{ prepared: PreparedPolymarketMarginExecution }>({
        action: "prepare-open",
        deadline,
        idempotencyKey: identity.idempotencyKey,
        maxSlippageBps: slippageBps,
        nonce: identity.nonce,
        positionId: positionBody.data.position.id,
        userId: session.user.id,
      });
      setReview({
        ...identity,
        deadline,
        positionId: positionBody.data.position.id,
        prepared: prepared.prepared,
      });
      setStep("Confirm exact terms");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function authorizeAndExecute() {
    if (
      !review ||
      !session ||
      !portfolio.address ||
      !polygon?.vaultAddress ||
      !polygon.collateralTokenAddress
    )
      return;
    setBusy(true);
    setError(null);
    try {
      setStep("Sign bounded order terms");
      const signature = await signPolymarketTypedData(portfolio.address, review.prepared.typedData);
      const authorized = await executionAction<{ execution: PolymarketMarginExecution }>({
        action: "authorize-open",
        borrowAssets: review.prepared.authorization.borrowAssets,
        deadline: review.deadline,
        financingFeeAssets: review.prepared.authorization.financingFeeAssets,
        idempotencyKey: review.idempotencyKey,
        maxSlippageBps: slippageBps,
        minimumOutcomeShares: review.prepared.authorization.minimumOutcomeShares,
        nonce: review.nonce,
        positionId: review.positionId,
        priceLimit: review.prepared.authorization.priceLimit,
        quoteId: review.prepared.authorization.quoteId,
        signature,
        userId: session.user.id,
      });
      await continueExecution(authorized.execution);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resumeExecution() {
    if (!liveExecution) return;
    setBusy(true);
    setError(null);
    try {
      await continueExecution(liveExecution);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueExecution(initial: PolymarketMarginExecution) {
    if (!review || !session || !portfolio.address || !polygon?.vaultAddress) return;
    let current = initial;
    setLiveExecution(current);
    if (current.state === "AUTHORIZED") {
      const approval =
        current.stageInstruction?.approvalCall ??
        review.prepared.walletCalls.find((call) => call.id === "approve-pusd");
      const reservation =
        current.stageInstruction?.walletCall ??
        review.prepared.walletCalls.find((call) => call.id === "reserve-margin-loan");
      if (!approval || !reservation) {
        throw new Error("Core did not return recoverable reservation instructions.");
      }
      setStep("Check pUSD approval");
      await sendPolymarketWalletCall(portfolio.address, approval, {
        owner: portfolio.address,
        requiredAssets: review.prepared.quote.collateralAssets,
        spender: polygon.vaultAddress,
        token: approval.to,
      });
      setStep(pendingReservationHash ? "Record reservation" : "Reserve vault liquidity");
      const reservationHash =
        pendingReservationHash ??
        getPendingReservationHash(current.id) ??
        (await sendPolymarketWalletCall(portfolio.address, reservation));
      if (!reservationHash) throw new Error("Vault reservation was not submitted.");
      setPendingReservationHash(reservationHash);
      rememberPendingReservationHash(current.id, reservationHash);
      current = (
        await executionAction<{ execution: PolymarketMarginExecution }>({
          action: "reservation",
          executionId: current.id,
          transactionHash: reservationHash,
          userId: session.user.id,
        })
      ).execution;
      setPendingReservationHash(null);
      clearPendingReservationHash(current.id);
      setLiveExecution(current);
    }
    current = await advanceToUserOrTerminal(
      current,
      session.user.id,
      portfolio.address,
      setLiveExecution,
      setStep,
    );
    setLiveExecution(current);
    if (current.state === "OPEN") {
      setStep("Position open");
      onStatus("success", "Polymarket fill secured and the vault loan is active.");
    } else if (current.state === "RECONCILIATION_REQUIRED") {
      setError(
        "Execution requires reconciliation. No local fill is being assumed; resume from Portfolio.",
      );
    } else if (current.state === "FAILED") {
      setError(
        current.failureMessage ?? "Execution failed. Core is reconciling the isolated account.",
      );
    } else {
      setStep(formatState(current.state));
    }
  }

  if (review) {
    const quote = review.prepared.quote;
    return (
      <section className="rounded border border-[#2b2b2b] bg-[#151515] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
              Polygon pUSD margin
            </p>
            <h3 className="mt-1 text-lg font-bold text-white">Confirm exact order terms</h3>
          </div>
          {!busy && !liveExecution ? (
            <button
              type="button"
              onClick={() => setReview(null)}
              aria-label="Cancel review"
              className="grid h-9 w-9 place-items-center rounded border border-[#303030] text-[#ccc3d8] hover:text-white"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded border border-[#292929] bg-[#292929]">
          <Term label="Your collateral" value={`${quote.collateralAssets} pUSD`} />
          <Term label="Vault borrow" value={`${quote.borrowAssets} pUSD`} />
          <Term label="Total exposure" value={`${quote.notionalAssets} pUSD`} />
          <Term label="Minimum shares" value={quote.estimatedOutcomeShares} />
          <Term label="Opening price" value={formatPrice(quote.openingPrice)} />
          <Term label="Price limit" value={formatPrice(review.prepared.authorization.priceLimit)} />
          <Term label="Financing fee" value={`${quote.feeAssets} pUSD`} />
          <Term
            label="Liquidation price"
            value={formatPrice(quote.liquidationPrice)}
            tone="danger"
          />
          <Term label="Mandatory close" value={formatDateTime(quote.mandatoryCloseAt)} />
          <Term label="Quote expires" value={formatDateTime(quote.quoteExpiresAt)} />
        </div>

        <div className="mt-4 flex gap-3 rounded border border-[#2e2a20] bg-[#19160f] p-3 text-xs leading-relaxed text-[#d8cfc3]">
          <ShieldCheck size={17} className="mt-0.5 flex-shrink-0 text-deep-orange" />
          <p>{review.prepared.warning}</p>
        </div>
        {liveExecution ? <ExecutionStatus execution={liveExecution} step={step} /> : null}
        {error ? <ErrorNotice message={error} /> : null}
        <button
          type="button"
          disabled={busy || liveExecution?.state === "OPEN"}
          onClick={() => void (liveExecution ? resumeExecution() : authorizeAndExecute())}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-deep-orange px-4 py-3.5 text-xs font-bold uppercase text-black disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : liveExecution?.state === "OPEN" ? (
            <CheckCircle2 size={15} />
          ) : (
            <ShieldCheck size={15} />
          )}
          {busy
            ? step
            : liveExecution?.state === "OPEN"
              ? "Position open"
              : liveExecution
                ? "Resume execution"
                : "Confirm and sign"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded border border-[#2b2b2b] border-t-2 border-t-deep-orange bg-[#151515] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
            Real venue execution
          </p>
          <h3 className="mt-1 text-lg font-bold text-white">Open margin</h3>
        </div>
        <span className="rounded border border-[#303030] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#ccc3d8]">
          Polygon
        </span>
      </div>

      <label className="mt-5 block font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
        Outcome
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["YES", "NO"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={`rounded border px-3 py-3 text-xs font-bold ${side === value ? (value === "YES" ? "border-deep-orange bg-deep-orange text-black" : "border-red-500 bg-red-500 text-white") : "border-[#303030] bg-[#0b0b0b] text-[#ccc3d8]"}`}
          >
            {value}{" "}
            {value === "YES"
              ? market.currentOdds.toFixed(1)
              : (100 - market.currentOdds).toFixed(1)}
            %
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
            Collateral
          </span>
          <div className="mt-2 flex items-center rounded border border-[#303030] bg-[#090909] px-3">
            <input
              value={collateral}
              onChange={(event) => setCollateral(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent py-3 text-right font-mono text-base text-white outline-none"
            />
            <span className="ml-2 font-mono text-[10px] text-[#ccc3d8]">pUSD</span>
          </div>
        </label>
        <label className="block">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
            Leverage
          </span>
          <select
            value={leverage}
            onChange={(event) => setLeverage(Number(event.target.value))}
            className="mt-2 w-full rounded border border-[#303030] bg-[#090909] px-3 py-3 font-mono text-sm text-white outline-none"
          >
            {Array.from({ length: maxLeverage - 1 }, (_, index) => index + 2).map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-[#8f8998]">
        <span>Wallet balance</span>
        <span>{available === null ? "Reading Polygon..." : `${available.toFixed(2)} pUSD`}</span>
      </div>

      <label className="mt-5 block font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
        Max slippage
      </label>
      <select
        value={slippageBps}
        onChange={(event) => setSlippageBps(Number(event.target.value))}
        className="mt-2 w-full rounded border border-[#303030] bg-[#090909] px-3 py-3 font-mono text-xs text-white outline-none"
      >
        <option value={50}>0.5%</option>
        <option value={100}>1.0%</option>
        <option value={200}>2.0%</option>
      </select>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {(["PRIVATE", "PUBLIC"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setVisibility(value)}
            className={`rounded border px-3 py-2.5 font-mono text-[9px] font-bold uppercase ${visibility === value ? "border-deep-orange text-deep-orange" : "border-[#303030] text-[#8f8998]"}`}
          >
            {value}
          </button>
        ))}
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {!eligible ? <ErrorNotice message={blockedReason ?? "Execution is unavailable."} /> : null}
      <button
        type="button"
        disabled={busy || !eligible}
        onClick={() => void prepareReview()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-deep-orange px-4 py-3.5 text-xs font-bold uppercase text-black disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
        {busy ? step : "Review exact quote"}
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-[#8f8998]">
        No order is signed until you review Core&apos;s current depth, fee, liquidation, and close
        terms.
      </p>
    </section>
  );
}

async function advanceToUserOrTerminal(
  initial: PolymarketMarginExecution,
  userId: string,
  walletAddress: string,
  onExecution: (execution: PolymarketMarginExecution) => void,
  onStep: (step: string) => void,
) {
  let current = initial;
  for (let attempt = 0; attempt < 48 && !terminalStates.has(current.state); attempt += 1) {
    if (current.state === "WALLET_COMMIT_REQUIRED") {
      const walletCall = current.stageInstruction?.walletCall;
      if (!walletCall) return current;
      onStep("Confirm isolated execution wallet");
      const hash = await sendPolymarketWalletCall(walletAddress, walletCall);
      if (!hash) throw new Error("Execution-wallet commitment was not submitted.");
      current = (
        await executionAction<{ execution: PolymarketMarginExecution }>({
          action: "wallet-commit",
          executionId: current.id,
          transactionHash: hash,
          userId,
        })
      ).execution;
      onExecution(current);
      continue;
    }
    onStep(formatState(current.state));
    current = (
      await executionAction<{ execution: PolymarketMarginExecution }>({
        action: "advance",
        executionId: current.id,
        userId,
      })
    ).execution;
    onExecution(current);
    if (
      current.state === "WALLET_DEPLOYING" ||
      current.state === "ORDER_SUBMITTED" ||
      current.state === "CLOSING"
    ) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }
  }
  return current;
}

async function executionAction<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/polymarket-execution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as ExecutionResponse<T>;
  if (!response.ok || !result.ok)
    throw new Error(result.ok ? "Execution request failed." : result.error.message);
  return result.data;
}

function ExecutionStatus({
  execution,
  step,
}: {
  execution: PolymarketMarginExecution;
  step: string;
}) {
  return (
    <div className="mt-4 rounded border border-[#263128] bg-[#0d1711] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-400">
          {formatState(execution.state)}
        </span>
        <span className="text-[11px] text-[#b9c8bc]">{step}</span>
      </div>
      {execution.fundingTxHash ? (
        <ExplorerLink hash={execution.fundingTxHash} label="Reservation" />
      ) : null}
      {execution.activationTxHash ? (
        <ExplorerLink hash={execution.activationTxHash} label="Activation" />
      ) : null}
      {execution.clobOrderId ? (
        <p className="mt-2 break-all font-mono text-[10px] text-[#9ca3af]">
          CLOB order {execution.clobOrderId}
        </p>
      ) : null}
    </div>
  );
}

function ExplorerLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={`https://polygonscan.com/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-1 font-mono text-[10px] text-deep-orange hover:text-white"
    >
      {label} {shortHash(hash)} <ArrowUpRight size={11} />
    </a>
  );
}

function Term({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="bg-[#0b0b0b] p-3">
      <dt className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#77717e]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-xs font-semibold ${tone === "danger" ? "text-red-400" : "text-white"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded border border-red-900/60 bg-red-950/20 p-3 text-xs leading-relaxed text-red-200">
      <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function normalizeAssets(value: string) {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(trimmed)) return null;
  if (assetUnits(trimmed) <= BigInt(0)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${BigInt(whole!)}.${normalizedFraction}` : BigInt(whole!).toString();
}

function multiplyAssets(value: string, multiplier: number) {
  return formatAssetUnits(assetUnits(value) * BigInt(multiplier));
}

function exceedsWalletBalance(value: string, walletRaw: string) {
  return assetUnits(value) > BigInt(walletRaw);
}

function assetUnits(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
}

function formatAssetUnits(value: bigint) {
  const scale = BigInt(1_000_000);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function formatPrice(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}c` : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatState(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Margin execution failed.";
}
