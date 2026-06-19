"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [historyState, setHistoryState] = useState<MarketHistoryState>({
    status: "loading",
    candles: [],
    source: "CONVICTION_LOADING",
  });
  const priceTiles = useMemo(() => buildPriceTiles(market), [market]);

  useEffect(() => {
    let isCurrent = true;

    setHistoryState({ status: "loading", candles: [], source: "CONVICTION_LOADING" });

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

  useEffect(() => {
    drawCandlestickChart(canvasRef.current, historyState.candles);

    const handleResize = () => drawCandlestickChart(canvasRef.current, historyState.candles);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [historyState]);

  return (
    <section className="card market-flow-card" aria-label="Market price flow">
      <div className="market-flow-heading">
        <div>
          <p className="eyebrow">Market flow</p>
          <h2>YES price candles</h2>
        </div>
        <span>{getHistoryStatusLabel(historyState)}</span>
      </div>

      <div className="market-flow-canvas">
        <canvas ref={canvasRef} />
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

function drawCandlestickChart(canvas: HTMLCanvasElement | null, candles: MarketCandle[]) {
  if (!canvas) return;

  const parent = canvas.parentElement;
  const width = Math.max(320, parent?.clientWidth ?? 720);
  const height = Math.max(240, parent?.clientHeight ?? 320);
  const pixelRatio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  if (!context) return;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  drawChartBackground(context, width, height);

  if (candles.length === 0) {
    drawChartEmptyState(context, width, height, "Awaiting synced market price");
    return;
  }

  const plot = { left: 44, right: 20, top: 20, bottom: 34 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const values = candles.flatMap((candle) => [candle.high, candle.low, candle.open, candle.close]);
  const min = Math.max(0, Math.min(...values) - 2);
  const max = Math.min(100, Math.max(...values) + 2);
  const range = Math.max(1, max - min);
  const yFor = (value: number) => plot.top + ((max - value) / range) * plotHeight;

  drawChartAxis(context, width, height, plot, min, max);

  const candleGap = candles.length > 1 ? plotWidth / candles.length : plotWidth;
  const candleWidth = Math.max(5, Math.min(18, candleGap * 0.54));

  candles.forEach((candle, index) => {
    const x = plot.left + candleGap * index + candleGap / 2;
    const openY = yFor(candle.open);
    const closeY = yFor(candle.close);
    const highY = yFor(candle.high);
    const lowY = yFor(candle.low);
    const isUp = candle.close >= candle.open;
    const color = isUp ? "#087452" : "#a93646";
    const fill = isUp ? "rgba(8, 116, 82, 0.22)" : "rgba(169, 54, 70, 0.2)";
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(2, Math.abs(closeY - openY));

    context.strokeStyle = color;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(x, highY);
    context.lineTo(x, lowY);
    context.stroke();

    context.fillStyle = fill;
    context.strokeStyle = color;
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    context.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
  });

  const lastCandle = candles[candles.length - 1];
  const lastY = yFor(lastCandle.close);

  context.strokeStyle = "#9a6716";
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(plot.left, lastY);
  context.lineTo(width - plot.right, lastY);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#9a6716";
  context.font = "800 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(formatPercent(lastCandle.close), width - plot.right - 58, Math.max(18, lastY - 6));

  context.fillStyle = "rgba(17, 22, 20, 0.54)";
  context.font = "800 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("CONVICTION YES FLOW", plot.left, height - 12);
}

function drawChartBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(17, 22, 20, 0.065)";
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 36) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 36) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawChartAxis(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plot: { left: number; right: number; top: number; bottom: number },
  min: number,
  max: number,
) {
  context.strokeStyle = "rgba(17, 22, 20, 0.16)";
  context.lineWidth = 1;
  context.strokeRect(plot.left, plot.top, width - plot.left - plot.right, height - plot.top - plot.bottom);
  context.fillStyle = "rgba(17, 22, 20, 0.58)";
  context.font = "800 9px ui-monospace, SFMono-Regular, Menlo, monospace";

  [max, (max + min) / 2, min].forEach((value, index) => {
    const y = index === 0 ? plot.top + 10 : index === 1 ? height / 2 : height - plot.bottom - 4;
    context.fillText(formatPercent(value), 6, y);
  });
}

function drawChartEmptyState(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: string,
) {
  context.fillStyle = "rgba(17, 22, 20, 0.62)";
  context.font = "800 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
  context.textAlign = "start";
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

function clampProbability(value: number) {
  return Math.max(0.1, Math.min(99.9, value));
}
