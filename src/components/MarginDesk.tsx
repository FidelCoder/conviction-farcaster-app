"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ExecutionCapabilities, Market } from "../lib/core-api";
import { formatDate } from "../lib/display";

const leverageOptions = [1, 2, 3, 5, 10] as const;
const marginHealthThreshold = 45;

type Side = "YES" | "NO";

type MarginDeskProps = {
  execution: ExecutionCapabilities;
  markets: Market[];
};

export function MarginDesk({ execution, markets }: MarginDeskProps) {
  const firstPricedMarket =
    markets.find((market) => Boolean(getPriceSnapshot(market))) ?? markets[0];
  const [selectedMarketId, setSelectedMarketId] = useState(firstPricedMarket?.id ?? "");
  const [side, setSide] = useState<Side>("YES");
  const [marginAmount, setMarginAmount] = useState("");
  const [leverage, setLeverage] = useState<(typeof leverageOptions)[number]>(3);
  const [chainId, setChainId] = useState(() => String(execution.chains[0]?.chainId ?? ""));
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ?? firstPricedMarket;
  const selectedChain = execution.chains.find((chain) => String(chain.chainId) === chainId);
  const preview = useMemo(
    () => buildMarginPreview(selectedMarket, side, marginAmount, leverage),
    [leverage, marginAmount, selectedMarket, side],
  );
  const isMarginLive = execution.marginExecutionEnabled && execution.leverageEnabled;
  const submitDisabledReason = getSubmitDisabledReason({
    execution,
    marginAmount,
    preview,
    selectedMarket,
  });

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

        <div className="trade-ticket" aria-label="Margin trade ticket">
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
                <span>Margin deposit</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setMarginAmount(event.target.value)}
                  placeholder="USDC amount"
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

              <button className="ticket-submit" disabled type="button">
                {isMarginLive ? "Connect Farcaster wallet" : "Margin contracts not live"}
              </button>
              <p className="ticket-message">{submitDisabledReason}</p>
            </>
          ) : (
            <div className="desk-empty">
              <strong>No market selected</strong>
              <span>
                Markets must come from the core API before a margin intent can be prepared.
              </span>
            </div>
          )}
        </div>

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

function getSubmitDisabledReason({
  execution,
  marginAmount,
  preview,
  selectedMarket,
}: {
  execution: ExecutionCapabilities;
  marginAmount: string;
  preview: ReturnType<typeof buildMarginPreview>;
  selectedMarket: Market | undefined;
}) {
  if (!selectedMarket) {
    return "Select a real synced market first.";
  }

  if (!getPriceSnapshot(selectedMarket)) {
    return "This market has no stored price snapshot, so leveraged sizing stays unavailable.";
  }

  if (parsePositiveNumber(marginAmount) === null) {
    return "Enter a real USDC margin amount to preview notional and borrowed capital.";
  }

  if (!execution.marginExecutionEnabled || !execution.leverageEnabled) {
    return "Execution remains disabled until core API reports live margin contracts, vault liquidity, liquidation, and adapters.";
  }

  return (
    preview.referencePriceLabel + " is a reference only. A real wallet flow is still required."
  );
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

  if (!/^(?=.*[1-9])(?:0|[1-9]d*)(?:.d{1,8})?$/.test(trimmed)) {
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
