"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import type { Market, TradeSignal } from "../lib/core-api";
import { signalStatusLabel } from "../lib/display";
import { getWarpcastShareUrl } from "../lib/miniapp";
import { useFarcasterSession } from "../hooks/useFarcasterSession";
import { FarcasterSessionPanel } from "./FarcasterSessionPanel";

type Side = "YES" | "NO";

type SignalSubmitState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "submitted"; message: string; signal: TradeSignal }
  | { status: "error"; message: string };

type SignalResponse =
  | {
      ok: true;
      data: {
        signal: TradeSignal;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type SignalComposerProps = {
  anchorId?: string;
  markets: Market[];
};

export function SignalComposer({ anchorId = "signal", markets }: SignalComposerProps) {
  const pricedMarket = markets.find((market) => Boolean(getMarketPriceLabel(market))) ?? markets[0];
  const [selectedMarketId, setSelectedMarketId] = useState(pricedMarket?.id ?? "");
  const [side, setSide] = useState<Side>("YES");
  const [thesis, setThesis] = useState("");
  const [convictionLevel, setConvictionLevel] = useState("70");
  const [submitState, setSubmitState] = useState<SignalSubmitState>({
    status: "idle",
    message: "",
  });
  const sessionState = useFarcasterSession();
  const selectedMarket = markets.find((market) => market.id === selectedMarketId) ?? pricedMarket;
  const submitBlockReason = getSubmitBlockReason({
    selectedMarket,
    sessionState,
    thesis,
    convictionLevel,
  });
  const selectedMarketPriceLabel = useMemo(
    () => (selectedMarket ? getMarketPriceLabel(selectedMarket) : null),
    [selectedMarket],
  );
  const marketCountLabel =
    markets.length === 1 ? "Focused market" : markets.length + " synced markets";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMarket || submitBlockReason || sessionState.status !== "ready") {
      setSubmitState({
        status: "error",
        message:
          submitBlockReason ??
          (sessionState.status === "ready"
            ? "Select a real market before creating a signal."
            : sessionState.message),
      });
      return;
    }

    const traderProfile = sessionState.session.traderProfile;

    if (!traderProfile) {
      setSubmitState({
        status: "error",
        message: "Core API did not return a trader profile for this Farcaster account.",
      });
      return;
    }

    setSubmitState({
      status: "submitting",
      message: "Creating signal...",
    });

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          traderProfileId: traderProfile.id,
          marketId: selectedMarket.id,
          side,
          thesis: thesis.trim(),
          convictionLevel: convictionLevel ? Number(convictionLevel) : null,
        }),
      });
      const body = (await response.json()) as SignalResponse;

      if (!response.ok || !body.ok) {
        setSubmitState({
          status: "error",
          message: body.ok ? "Signal creation failed." : body.error.message,
        });
        return;
      }

      setSubmitState({
        status: "submitted",
        message: "Signal created. Execution not yet enabled.",
        signal: body.data.signal,
      });
      setThesis("");
    } catch {
      setSubmitState({
        status: "error",
        message: "Core API did not accept the signal.",
      });
    }
  }

  return (
    <section className="signal-composer" id={anchorId} aria-label="Create signal">
      <div className="signal-composer-copy">
        <p className="eyebrow">Signal desk</p>
        <h2>Publish the thesis behind the trade.</h2>
        <p>
          Signals are real Farcaster-sourced records tied to synced markets. They stay separate from
          execution until the core API confirms a live adapter.
        </p>
      </div>

      <form className="signal-form" onSubmit={handleSubmit}>
        <div className="signal-form-header">
          <div>
            <span>Signal ticket</span>
            <strong>{selectedMarketPriceLabel ?? "Awaiting price"}</strong>
          </div>
          <small>{marketCountLabel}</small>
        </div>
        <FarcasterSessionPanel
          label="Farcaster trader"
          readyMessage={getReadySessionMessage(sessionState)}
          sessionState={sessionState}
        />

        {markets.length > 1 ? (
          <label className="ticket-field">
            <span>Market</span>
            <select
              onChange={(event) => setSelectedMarketId(event.target.value)}
              value={selectedMarketId}
            >
              {markets.slice(0, 30).map((market) => (
                <option key={market.id} value={market.id}>
                  {market.title}
                </option>
              ))}
            </select>
          </label>
        ) : markets.length === 0 ? (
          <div className="desk-empty compact">
            <strong>No synced markets</strong>
            <span>Sync real markets in core before creating a signal.</span>
          </div>
        ) : null}

        {selectedMarket ? (
          <div className="signal-market-summary">
            <span>{selectedMarket.category ?? selectedMarket.source}</span>
            <strong>{selectedMarket.title}</strong>
            <small>{selectedMarketPriceLabel ?? "No stored price"}</small>
          </div>
        ) : null}

        <div className="segmented-control" aria-label="Signal side">
          <button
            className={side === "YES" ? "active yes" : "yes"}
            onClick={() => setSide("YES")}
            type="button"
          >
            YES
          </button>
          <button
            className={side === "NO" ? "active no" : "no"}
            onClick={() => setSide("NO")}
            type="button"
          >
            NO
          </button>
        </div>

        <label className="ticket-field">
          <span>Thesis</span>
          <textarea
            maxLength={5000}
            onChange={(event) => setThesis(event.target.value)}
            placeholder="What do you believe the market is missing?"
            value={thesis}
          />
        </label>

        <label className="ticket-field">
          <span>Conviction</span>
          <input
            inputMode="numeric"
            max={100}
            min={1}
            onChange={(event) => setConvictionLevel(event.target.value)}
            type="number"
            value={convictionLevel}
          />
        </label>

        <button
          className="ticket-submit"
          disabled={submitState.status === "submitting" || Boolean(submitBlockReason)}
          type="submit"
        >
          {submitState.status === "submitting" ? "Creating..." : "Create signal"}
        </button>

        <p className={submitState.status === "error" ? "ticket-message error" : "ticket-message"}>
          {submitState.message ||
            submitBlockReason ||
            "Saved as a real Farcaster signal. No execution or PnL is implied."}
        </p>

        {submitState.status === "submitted" ? (
          <div className="intent-confirmation" aria-live="polite">
            <div className="intent-confirmation-topline">
              <span>Signal record</span>
              <strong>{signalStatusLabel()}</strong>
            </div>
            <dl>
              <div>
                <dt>Side</dt>
                <dd>{submitState.signal.side}</dd>
              </div>
              <div>
                <dt>Conviction</dt>
                <dd>{submitState.signal.convictionLevel ?? "Not set"}</dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>{formatCompactId(submitState.signal.id)}</dd>
              </div>
            </dl>
            <p>Core stored the thesis as a signal only. No fill, balance, or PnL was created.</p>
          </div>
        ) : null}

        {submitState.status === "submitted" ? (
          <div className="inline-actions">
            <Link className="text-link" href={"/signals/" + submitState.signal.id}>
              Open signal
            </Link>
            <a
              className="text-link"
              href={getWarpcastShareUrl({
                path: "/signals/" + submitState.signal.id,
                text: submitState.signal.side + " signal on Conviction Markets",
              })}
              rel="noreferrer"
              target="_blank"
            >
              Share signal
            </a>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function getSubmitBlockReason({
  convictionLevel,
  selectedMarket,
  sessionState,
  thesis,
}: {
  convictionLevel: string;
  selectedMarket: Market | undefined;
  sessionState: ReturnType<typeof useFarcasterSession>;
  thesis: string;
}) {
  if (sessionState.status !== "ready") {
    return sessionState.message;
  }

  if (!sessionState.session.traderProfile) {
    return "Core API did not return a trader profile for this Farcaster account.";
  }

  if (!selectedMarket) {
    return "Select a market from the board first.";
  }

  if (!thesis.trim()) {
    return "Write a real thesis before publishing a signal.";
  }

  const parsedConviction = convictionLevel ? Number(convictionLevel) : null;

  if (
    parsedConviction !== null &&
    (!Number.isInteger(parsedConviction) || parsedConviction < 1 || parsedConviction > 100)
  ) {
    return "Conviction must be a whole number from 1 to 100.";
  }

  return null;
}

function getReadySessionMessage(sessionState: ReturnType<typeof useFarcasterSession>) {
  if (sessionState.status !== "ready") {
    return undefined;
  }

  return sessionState.session.traderProfile
    ? "Trader profile " + sessionState.session.traderProfile.handle + " is ready."
    : "Core API did not return a trader profile.";
}

function getMarketPriceLabel(market: Market) {
  const price = market.lastTradePrice ?? market.bestAsk ?? market.bestBid;

  if (!price) {
    return null;
  }

  const parsed = Number(price);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(parsed <= 1 ? parsed : parsed / 100);
}

function formatCompactId(id: string) {
  return id.length > 12 ? id.slice(0, 6) + "..." + id.slice(-4) : id;
}
