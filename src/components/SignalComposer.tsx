"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import type { Market, TradeSignal } from "../lib/core-api";
import { getWarpcastShareUrl } from "../lib/miniapp";
import { getFarcasterSessionLabel, useFarcasterSession } from "../hooks/useFarcasterSession";

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
  markets: Market[];
};

export function SignalComposer({ markets }: SignalComposerProps) {
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
    <section className="signal-composer" aria-label="Create signal">
      <div className="signal-composer-copy">
        <p className="eyebrow">Signal desk</p>
        <h2>Create a real market signal</h2>
        <p>
          Signals are published intent and thesis records. They do not execute trades, create
          positions, calculate PnL, or simulate balances.
        </p>
      </div>

      <form className="signal-form" onSubmit={handleSubmit}>
        <div className={sessionState.status === "ready" ? "session-panel ready" : "session-panel"}>
          <span>Farcaster trader</span>
          <strong>
            {sessionState.status === "ready"
              ? getFarcasterSessionLabel(sessionState.session)
              : sessionState.status === "loading"
                ? "Connecting..."
                : "Not connected"}
          </strong>
          <p>{getSessionMessage(sessionState)}</p>
        </div>

        {markets.length > 0 ? (
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
        ) : (
          <div className="desk-empty compact">
            <strong>No synced markets</strong>
            <span>Sync real markets in core before creating a signal.</span>
          </div>
        )}

        {selectedMarket ? (
          <div className="signal-market-summary">
            <strong>{selectedMarket.title}</strong>
            <span>{selectedMarketPriceLabel ?? "No stored price"}</span>
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
            placeholder="Write the actual reason for this signal."
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
            "Signal will be saved to core API as FARCASTER source."}
        </p>

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
    return "Select a real synced market first.";
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

function getSessionMessage(sessionState: ReturnType<typeof useFarcasterSession>) {
  if (sessionState.status !== "ready") {
    return sessionState.message;
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
