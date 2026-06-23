"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { OddsFlowChart, type OddsFlowHitTarget } from "./OddsFlowChart";
import type { Market } from "../lib/core-api";
import { formatMarketPrice } from "../lib/market-display";

type MarketCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
  volume?: number | null;
};

type MarketHistoryState =
  | { status: "loading"; candles: MarketCandle[]; source: string }
  | { status: "ready"; candles: MarketCandle[]; source: string }
  | { status: "snapshot_only"; candles: MarketCandle[]; source: string }
  | { status: "empty"; candles: MarketCandle[]; source: string };

type MarketFlowChartProps = {
  market: Market;
};

export function MarketFlowChart({ market }: MarketFlowChartProps) {
  const chartTargetsRef = useRef<OddsFlowHitTarget[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<OddsFlowHitTarget | null>(null);
  const [historyState, setHistoryState] = useState<MarketHistoryState>({
    status: "loading",
    candles: [],
    source: "CONVICTION_LOADING",
  });
  const priceTiles = useMemo(() => buildPriceTiles(market), [market]);

  useEffect(() => {
    let isCurrent = true;

    setHistoryState({ status: "loading", candles: [], source: "CONVICTION_LOADING" });
    setHoveredPoint(null);

    fetch("/api/markets/" + encodeURIComponent(market.id) + "/history")
      .then((response) => response.json())
      .then((body: unknown) => {
        if (!isCurrent) return;
        setHistoryState(parseHistoryResponse(body));
      })
      .catch(() => {
        if (!isCurrent) return;
        const fallback = buildSnapshotCandles(market);
        setHistoryState({
          status: fallback.length > 0 ? "snapshot_only" : "empty",
          candles: fallback,
          source: "CONVICTION_SNAPSHOT",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [market]);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const targets = chartTargetsRef.current;
    const firstTarget = targets[0];

    if (!firstTarget) {
      if (hoveredPoint) setHoveredPoint(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < firstTarget.plotLeft || x > firstTarget.plotRight || y < firstTarget.plotTop || y > firstTarget.plotBottom) {
      if (hoveredPoint) setHoveredPoint(null);
      return;
    }

    const nearest = targets.reduce((closest, target) => (
      Math.abs(target.x - x) < Math.abs(closest.x - x) ? target : closest
    ));

    if (hoveredPoint?.index !== nearest.index) {
      setHoveredPoint(nearest);
    }
  }

  return (
    <section className="card market-flow-card" aria-label="Market price flow">
      <div className="market-flow-heading">
        <div>
          <p className="eyebrow">Market flow</p>
          <h2>YES odds flow</h2>
        </div>
        <span>{getHistoryStatusLabel(historyState)}</span>
      </div>

      <div
        className="market-flow-canvas"
        onPointerLeave={() => setHoveredPoint(null)}
        onPointerMove={handlePointerMove}
      >
        <OddsFlowChart
          emptyMessage="Awaiting synced market price"
          hoveredIndex={hoveredPoint?.index ?? null}
          onTargetsChange={(targets) => {
            chartTargetsRef.current = targets;
          }}
          points={historyState.candles}
          tone="light"
        />
        {hoveredPoint ? (
          <div
            className="market-flow-tooltip"
            style={{
              left: `min(calc(100% - 12rem), ${Math.max(10, hoveredPoint.x + 12)}px)`,
              top: `max(10px, ${Math.min(hoveredPoint.y - 42, hoveredPoint.plotBottom - 92)}px)`,
            }}
          >
            <span>{formatChartTime(hoveredPoint.point.timestamp)}</span>
            <strong>{formatPercent(hoveredPoint.point.close)} YES</strong>
            <small>{formatPercent(100 - hoveredPoint.point.close)} NO</small>
          </div>
        ) : null}
        {historyState.status === "loading" ? (
          <div className="market-flow-overlay">Loading market flow...</div>
        ) : null}
        {historyState.status === "empty" ? (
          <div className="market-flow-overlay">No price snapshot is available for this market yet.</div>
        ) : null}
      </div>

      <dl className="market-flow-prices">
        {priceTiles.map((tile) => (
          <div key={tile.label}>
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>

      <p className="subtle-note">
        Conviction renders synced price history inside the product. When history is unavailable, the chart shows only the latest stored bid, ask, and trade snapshot.
      </p>
    </section>
  );
}

function parseHistoryResponse(body: unknown): MarketHistoryState {
  if (!isRecord(body) || body.ok !== true || !isRecord(body.data)) {
    return { status: "empty", candles: [], source: "CONVICTION_EMPTY" };
  }

  const candlesValue = body.data.candles;
  const candles = Array.isArray(candlesValue) ? candlesValue.filter(isMarketCandle) : [];
  const statusValue = typeof body.data.status === "string" ? body.data.status : "empty";
  const source = typeof body.data.source === "string" ? body.data.source : "CONVICTION_HISTORY";

  if (candles.length === 0) {
    return { status: "empty", candles: [], source };
  }

  if (statusValue === "snapshot_only") {
    return { status: "snapshot_only", candles, source };
  }

  return { status: "ready", candles, source };
}

function buildSnapshotCandles(market: Market): MarketCandle[] {
  const bestBid = parseProbabilityValue(market.bestBid);
  const bestAsk = parseProbabilityValue(market.bestAsk);
  const lastTrade = parseProbabilityValue(market.lastTradePrice);
  const midpoint = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const close = lastTrade ?? midpoint ?? bestAsk ?? bestBid;

  if (close === null) return [];

  const open = midpoint ?? close;
  const high = Math.max(open, close, bestAsk ?? close);
  const low = Math.min(open, close, bestBid ?? close);

  return [
    {
      close: clampProbability(close),
      high: clampProbability(high),
      low: clampProbability(low),
      open: clampProbability(open),
      timestamp: market.syncedAt ?? new Date().toISOString(),
      volume: null,
    },
  ];
}

function buildPriceTiles(market: Market) {
  return [
    { label: "Last trade", value: formatProbabilityValue(market.lastTradePrice) },
    { label: "Best bid", value: formatProbabilityValue(market.bestBid) },
    { label: "Best ask", value: formatProbabilityValue(market.bestAsk) },
    { label: "Min order", value: market.orderMinSize ? market.orderMinSize + " contracts" : "Pending" },
  ];
}

function getHistoryStatusLabel(history: MarketHistoryState) {
  if (history.status === "loading") return "Loading";
  if (history.status === "ready") return "Synced history";
  if (history.status === "snapshot_only") return "Latest snapshot";
  return "Awaiting data";
}

function isMarketCandle(value: unknown): value is MarketCandle {
  return (
    isRecord(value) &&
    typeof value.timestamp === "string" &&
    Number.isFinite(value.open) &&
    Number.isFinite(value.high) &&
    Number.isFinite(value.low) &&
    Number.isFinite(value.close)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProbabilityValue(value: string | null | undefined) {
  if (!value) return null;
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return null;

  return numericValue <= 1 ? numericValue * 100 : numericValue;
}

function formatProbabilityValue(value: string | null | undefined) {
  if (!value) return "Pending";

  return formatMarketPrice(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(1) + "%";
}

function formatChartTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Latest";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clampProbability(value: number) {
  return Math.max(0.1, Math.min(99.9, value));
}
