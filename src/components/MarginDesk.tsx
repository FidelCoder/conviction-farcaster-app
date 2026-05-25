"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  ExecutionAttempt,
  ExecutionCapabilities,
  Market,
  Position,
  UserSession,
} from "../lib/core-api";
import { formatDate } from "../lib/display";

const leverageOptions = [1, 2, 3, 5, 10] as const;
const marginHealthThreshold = 45;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

type Side = "YES" | "NO";

type MarginSubmitState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "submitted"; message: string; position: Position; executionAttempt: ExecutionAttempt }
  | { status: "error"; message: string };

type MarginIntentResponse =
  | {
      ok: true;
      data: {
        position: Position;
        executionAttempt: ExecutionAttempt;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type FarcasterSessionState =
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; session: UserSession }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type FarcasterSessionResponse =
  | {
      ok: true;
      data: {
        session: UserSession;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type FarcasterContext = {
  user?: {
    fid?: unknown;
    username?: unknown;
    displayName?: unknown;
    pfpUrl?: unknown;
  };
};

type MarginDeskProps = {
  execution: ExecutionCapabilities;
  markets: Market[];
};

export function MarginDesk({ execution, markets }: MarginDeskProps) {
  const firstPricedMarket =
    markets.find((market) => Boolean(getPriceSnapshot(market))) ?? markets[0];
  const [selectedMarketId, setSelectedMarketId] = useState(firstPricedMarket?.id ?? "");
  const [side, setSide] = useState<Side>("YES");
  const [sessionState, setSessionState] = useState<FarcasterSessionState>({
    status: "loading",
    message: "Connecting Farcaster account...",
  });
  const [walletAddress, setWalletAddress] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marginAmount, setMarginAmount] = useState("");
  const [leverage, setLeverage] = useState<(typeof leverageOptions)[number]>(3);
  const [chainId, setChainId] = useState(() => String(execution.chains[0]?.chainId ?? ""));
  const [submitState, setSubmitState] = useState<MarginSubmitState>({
    status: "idle",
    message: "",
  });
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ?? firstPricedMarket;
  const selectedChain = execution.chains.find((chain) => String(chain.chainId) === chainId);
  const preview = useMemo(
    () => buildMarginPreview(selectedMarket, side, marginAmount, leverage),
    [leverage, marginAmount, selectedMarket, side],
  );
  const isMarginLive = execution.marginExecutionEnabled && execution.leverageEnabled;
  const submitBlockReason = getSubmitBlockReason({
    chainId,
    leverage,
    marginAmount,
    quantity,
    selectedMarket,
    sessionState,
    walletAddress,
  });
  const isSubmitting = submitState.status === "submitting";
  const ticketMessage = getTicketMessage({
    execution,
    preview,
    sessionState,
    submitBlockReason,
    submitState,
  });

  useEffect(() => {
    let isMounted = true;

    async function connectFarcasterSession() {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const isInMiniApp = await sdk.isInMiniApp();

        if (!isMounted) {
          return;
        }

        if (!isInMiniApp) {
          setSessionState({
            status: "unavailable",
            message: "Open this page as a Farcaster Mini App to attach your real account.",
          });
          return;
        }

        const context = (await sdk.context) as FarcasterContext;
        const user = context.user;
        const fid = normalizeFid(user?.fid);

        if (!fid) {
          setSessionState({
            status: "error",
            message: "Farcaster context did not include a valid fid.",
          });
          return;
        }

        const response = await fetch("/api/farcaster-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fid,
            username: normalizeOptionalString(user?.username),
            displayName: normalizeOptionalString(user?.displayName),
            pfpUrl: normalizeOptionalString(user?.pfpUrl),
          }),
        });
        const body = (await response.json()) as FarcasterSessionResponse;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !body.ok) {
          setSessionState({
            status: "error",
            message: body.ok ? "Farcaster session failed." : body.error.message,
          });
          return;
        }

        setSessionState({
          status: "ready",
          message: "Connected as " + getSessionLabel(body.data.session) + ".",
          session: body.data.session,
        });
      } catch {
        if (isMounted) {
          setSessionState({
            status: "error",
            message: "Unable to create a Farcaster session through the core API.",
          });
        }
      }
    }

    void connectFarcasterSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMarket || submitBlockReason || sessionState.status !== "ready") {
      setSubmitState({
        status: "error",
        message:
          submitBlockReason ??
          (sessionState.status === "ready"
            ? "Select a real market before submitting."
            : sessionState.message),
      });
      return;
    }

    setSubmitState({
      status: "submitting",
      message: "Submitting margin intent...",
    });

    try {
      const response = await fetch("/api/margin-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: sessionState.session.user.id,
          marketId: selectedMarket.id,
          side,
          quantity: quantity.trim(),
          chainId: Number(chainId),
          walletAddress: walletAddress.trim(),
          leverageMultiplier: String(leverage),
          marginCollateral: marginAmount.trim(),
        }),
      });
      const body = (await response.json()) as MarginIntentResponse;

      if (!response.ok || !body.ok) {
        setSubmitState({
          status: "error",
          message: body.ok ? "Margin intent failed." : body.error.message,
        });
        return;
      }

      setSubmitState({
        status: "submitted",
        message: buildSubmittedMessage(body.data.executionAttempt),
        position: body.data.position,
        executionAttempt: body.data.executionAttempt,
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "Core API did not accept the margin intent.",
      });
    }
  }

  return (
    <section className="margin-desk" aria-label="Margin trading desk">
      <div className="margin-desk-header">
        <div>
          <p className="eyebrow">Farcaster margin layer</p>
          <h1>Leveraged probability trades, built as real intents first.</h1>
          <p>
            A Conviction-native margin desk for synced markets: deposited collateral, vault capital,
            execution custody, liquidation health, and forced close windows. No fake fills, no fake
            PnL, no simulated markets.
          </p>
        </div>
        <div className={isMarginLive ? "live-badge ready" : "live-badge pending"}>
          <span>{isMarginLive ? "Margin live" : "Margin pending"}</span>
          <strong>{execution.evmOnly ? "EVM" : "Cross-chain"}</strong>
        </div>
      </div>

      <div className="margin-workspace">
        <aside className="market-rail" aria-label="Synced markets">
          <div className="rail-heading">
            <span>Markets</span>
            <strong>{markets.length}</strong>
          </div>
          {markets.length > 0 ? (
            <div className="market-rail-list">
              {markets.slice(0, 12).map((market) => {
                const snapshot = getPriceSnapshot(market);
                const isSelected = market.id === selectedMarket?.id;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={isSelected ? "market-rail-item active" : "market-rail-item"}
                    key={market.id}
                    onClick={() => setSelectedMarketId(market.id)}
                    type="button"
                  >
                    <span>{market.title}</span>
                    <strong>
                      {snapshot ? formatProbability(snapshot.probability) : "No price"}
                    </strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="desk-empty compact">
              <strong>No synced markets</strong>
              <span>Sync a real provider in the core API before trading from Farcaster.</span>
            </div>
          )}
        </aside>

        <form className="trade-ticket" aria-label="Margin trade ticket" onSubmit={handleSubmit}>
          <div className="ticket-topline">
            <span>Trade ticket</span>
            <strong>{selectedMarket?.source ?? "Core API"}</strong>
          </div>

          {selectedMarket ? (
            <>
              <div className="selected-market-copy">
                <h2>{selectedMarket.title}</h2>
                <p>{selectedMarket.description ?? "No market description returned by core API."}</p>
                <Link href={"/markets/" + selectedMarket.id}>Open market page</Link>
              </div>

              <div
                className={
                  sessionState.status === "ready" ? "session-panel ready" : "session-panel"
                }
              >
                <span>Farcaster account</span>
                <strong>
                  {sessionState.status === "ready"
                    ? getSessionLabel(sessionState.session)
                    : sessionState.status === "loading"
                      ? "Connecting..."
                      : "Not connected"}
                </strong>
                <p>{sessionState.message}</p>
              </div>

              <div className="segmented-control" aria-label="Trade side">
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
                <span>Requested market size</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Outcome share size"
                  type="text"
                  value={quantity}
                />
              </label>

              <label className="ticket-field">
                <span>Margin deposit</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setMarginAmount(event.target.value)}
                  placeholder="USDC collateral"
                  type="text"
                  value={marginAmount}
                />
              </label>

              <div className="leverage-row" aria-label="Leverage multiplier">
                {leverageOptions.map((option) => (
                  <button
                    aria-pressed={option === leverage}
                    className={option === leverage ? "active" : ""}
                    key={option}
                    onClick={() => setLeverage(option)}
                    type="button"
                  >
                    {option}x
                  </button>
                ))}
              </div>

              <label className="ticket-field">
                <span>Execution chain</span>
                <select onChange={(event) => setChainId(event.target.value)} value={chainId}>
                  {execution.chains.length > 0 ? (
                    execution.chains.map((chain) => (
                      <option key={chain.chainId} value={chain.chainId}>
                        {chain.chainName} ({chain.network})
                      </option>
                    ))
                  ) : (
                    <option value="">Core capabilities unavailable</option>
                  )}
                </select>
              </label>

              <label className="ticket-field">
                <span>Wallet</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setWalletAddress(event.target.value)}
                  placeholder="0x..."
                  type="text"
                  value={walletAddress}
                />
              </label>

              <dl className="ticket-metrics">
                <div>
                  <dt>Reference price</dt>
                  <dd>{preview.referencePriceLabel}</dd>
                </div>
                <div>
                  <dt>Notional</dt>
                  <dd>{preview.notionalLabel}</dd>
                </div>
                <div>
                  <dt>Borrowed</dt>
                  <dd>{preview.borrowedLabel}</dd>
                </div>
                <div>
                  <dt>Health threshold</dt>
                  <dd>{leverage > 1 ? marginHealthThreshold + "%" : "Spot"}</dd>
                </div>
                <div>
                  <dt>Liquidation guard</dt>
                  <dd>{preview.liquidationLabel}</dd>
                </div>
                <div>
                  <dt>Forced close</dt>
                  <dd>{getForcedCloseLabel(selectedMarket)}</dd>
                </div>
              </dl>

              <button
                className="ticket-submit"
                disabled={isSubmitting || Boolean(submitBlockReason)}
                type="submit"
              >
                {isSubmitting ? "Submitting..." : "Submit margin intent"}
              </button>
              <p
                className={
                  submitState.status === "error" ? "ticket-message error" : "ticket-message"
                }
              >
                {ticketMessage}
              </p>
            </>
          ) : (
            <div className="desk-empty">
              <strong>No market selected</strong>
              <span>
                Markets must come from the core API before a margin intent can be prepared.
              </span>
            </div>
          )}
        </form>

        <aside className="risk-console" aria-label="Risk and execution status">
          <div>
            <p className="eyebrow">Risk model</p>
            <h2>Prime-broker style, not synthetic perps.</h2>
            <p>
              The margin layer needs real vault liquidity, execution adapters, custody, health
              checks, liquidation, and auto-close contracts before any leveraged order can execute.
            </p>
          </div>

          <dl className="risk-list">
            <div>
              <dt>Spot adapters</dt>
              <dd>{execution.spotExecutionEnabled ? "Live" : "Not live"}</dd>
            </div>
            <div>
              <dt>Margin adapters</dt>
              <dd>{execution.marginExecutionEnabled ? "Live" : "Not live"}</dd>
            </div>
            <div>
              <dt>Leverage</dt>
              <dd>{execution.leverageEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Selected chain</dt>
              <dd>{selectedChain ? selectedChain.chainName : "No active chain"}</dd>
            </div>
          </dl>

          <div className="process-rail" aria-label="Execution flow">
            <span>Deposit margin</span>
            <span>Borrow vault USDC</span>
            <span>Execute market order</span>
            <span>Monitor health</span>
            <span>Close before resolution</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildMarginPreview(
  market: Market | undefined,
  side: Side,
  marginAmount: string,
  leverage: number,
) {
  const snapshot = market ? getPriceSnapshot(market) : null;
  const margin = parsePositiveNumber(marginAmount);
  const sidePrice = snapshot ? getSideReferencePrice(snapshot.probability, side) : null;
  const notional = margin === null ? null : margin * leverage;
  const borrowed = margin === null ? null : Math.max(notional ?? 0, 0) - margin;
  const liquidationPrice =
    sidePrice !== null && leverage > 1 ? Math.max(sidePrice * (1 - 0.55 / leverage), 0) : null;

  return {
    borrowedLabel: borrowed === null ? "Enter margin" : formatUsd(borrowed),
    liquidationLabel:
      leverage <= 1
        ? "No borrow"
        : liquidationPrice === null
          ? "Needs real price"
          : formatProbability(liquidationPrice),
    notionalLabel: notional === null ? "Enter margin" : formatUsd(notional),
    referencePriceLabel: sidePrice === null ? "No stored price" : formatProbability(sidePrice),
  };
}

function getSubmitBlockReason({
  chainId,
  leverage,
  marginAmount,
  quantity,
  selectedMarket,
  sessionState,
  walletAddress,
}: {
  chainId: string;
  leverage: number;
  marginAmount: string;
  quantity: string;
  selectedMarket: Market | undefined;
  sessionState: FarcasterSessionState;
  walletAddress: string;
}) {
  if (!selectedMarket) {
    return "Select a real synced market first.";
  }

  if (sessionState.status !== "ready") {
    return sessionState.message;
  }

  if (!parsePositiveNumber(quantity)) {
    return "Enter a requested market size greater than zero.";
  }

  if (parsePositiveNumber(marginAmount) === null) {
    return "Enter a real USDC margin amount to preview notional and borrowed capital.";
  }

  if (leverage <= 1) {
    return "Choose leverage above 1x for a margin intent.";
  }

  if (!chainId) {
    return "Select an execution chain from core capabilities.";
  }

  if (!evmAddressPattern.test(walletAddress.trim())) {
    return "Enter a valid EVM wallet address.";
  }

  return null;
}

function getTicketMessage({
  execution,
  preview,
  sessionState,
  submitBlockReason,
  submitState,
}: {
  execution: ExecutionCapabilities;
  preview: ReturnType<typeof buildMarginPreview>;
  sessionState: FarcasterSessionState;
  submitBlockReason: string | null;
  submitState: MarginSubmitState;
}) {
  if (submitState.message) {
    return submitState.message;
  }

  if (submitBlockReason) {
    return submitBlockReason;
  }

  if (sessionState.status !== "ready") {
    return sessionState.message;
  }

  if (!execution.marginExecutionEnabled || !execution.leverageEnabled) {
    return "Submitting records a real margin intent and execution attempt. Execution will stay blocked until core reports live contracts, vault liquidity, liquidation, and adapters.";
  }

  return (
    preview.referencePriceLabel + " is a reference only. A real wallet flow is still required."
  );
}

function buildSubmittedMessage(executionAttempt: ExecutionAttempt) {
  if (executionAttempt.status === "BLOCKED") {
    return (
      "Margin intent recorded. Execution attempt blocked: " +
      (executionAttempt.failureMessage ?? "adapter or contracts are not active.")
    );
  }

  return "Margin intent recorded. Execution attempt status: " + executionAttempt.status + ".";
}

function getPriceSnapshot(market: Market) {
  const rawPrice = market.lastTradePrice ?? market.bestAsk ?? market.bestBid;
  const source = market.lastTradePrice
    ? "Last trade"
    : market.bestAsk
      ? "Best ask"
      : market.bestBid
        ? "Best bid"
        : null;
  const probability = parseProbability(rawPrice);

  if (probability === null || !source) {
    return null;
  }

  return { probability, source };
}

function parseProbability(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed <= 1) {
    return parsed;
  }

  if (parsed <= 100) {
    return parsed / 100;
  }

  return null;
}

function getSideReferencePrice(yesProbability: number, side: Side) {
  return side === "YES" ? yesProbability : Math.max(1 - yesProbability, 0.0001);
}

function parsePositiveNumber(value: string) {
  const trimmed = value.trim();

  if (!/^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getForcedCloseLabel(market: Market) {
  if (!market.resolutionDate) {
    return "Needs resolution date";
  }

  return "Before " + formatDate(market.resolutionDate);
}

function formatProbability(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function normalizeFid(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSessionLabel(session: UserSession) {
  return session.socialAccount.username
    ? "@" + session.socialAccount.username
    : "fid " + session.socialAccount.platformUserId;
}
