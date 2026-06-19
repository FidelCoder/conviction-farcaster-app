import { NextResponse } from "next/server";

import { getMarket } from "../../../../../lib/core-api";

export const dynamic = "force-dynamic";

type HistoryPoint = {
  t?: number;
  p?: number;
};

type RouteContext = {
  params: Promise<{ marketId: string }>;
};

const POLYMARKET_CLOB_URL = "https://clob.polymarket.com";
const HISTORY_TIMEOUT_MS = 6500;

export async function GET(_request: Request, context: RouteContext) {
  const { marketId } = await context.params;
  const market = await getMarket(marketId);

  if (!market) {
    return NextResponse.json(
      { ok: false, error: { code: "MARKET_NOT_FOUND", message: "Market was not found." } },
      { status: 404 },
    );
  }

  const snapshotCandles = buildSnapshotCandles(market);

  if (market.source !== "POLYMARKET" || !market.yesTokenId) {
    return NextResponse.json({
      ok: true,
      data: {
        candles: snapshotCandles,
        marketId: market.id,
        source: "CONVICTION_SNAPSHOT",
        status: snapshotCandles.length > 1 ? "ready" : "snapshot_only",
      },
    });
  }

  try {
    const history = await fetchPolymarketPriceHistory(market.yesTokenId);
    const candles = pointsToCandles(history);

    if (candles.length > 0) {
      return NextResponse.json({
        ok: true,
        data: {
          candles,
          marketId: market.id,
          source: "CONVICTION_PROVIDER_HISTORY",
          status: "ready",
        },
      });
    }
  } catch {
    // Keep the user in-product even when the provider history endpoint is temporarily unavailable.
  }

  return NextResponse.json({
    ok: true,
    data: {
      candles: snapshotCandles,
      marketId: market.id,
      source: "CONVICTION_SNAPSHOT",
      status: snapshotCandles.length > 1 ? "ready" : "snapshot_only",
    },
  });
}

async function fetchPolymarketPriceHistory(tokenId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HISTORY_TIMEOUT_MS);
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - 60 * 60 * 24 * 7;
  const url = new URL("/prices-history", POLYMARKET_CLOB_URL);

  url.searchParams.set("market", tokenId);
  url.searchParams.set("startTs", String(startTs));
  url.searchParams.set("endTs", String(endTs));
  url.searchParams.set("interval", "1h");
  url.searchParams.set("fidelity", "60");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as { history?: HistoryPoint[] };

    return Array.isArray(body.history) ? body.history : [];
  } finally {
    clearTimeout(timeout);
  }
}

function pointsToCandles(points: HistoryPoint[]) {
  return points
    .filter((point): point is { t: number; p: number } =>
      Number.isFinite(point.t) && Number.isFinite(point.p),
    )
    .map((point, index, filteredPoints) => {
      const previous = filteredPoints[index - 1]?.p ?? point.p;
      const open = clampProbability(previous * 100);
      const close = clampProbability(point.p * 100);

      return {
        close,
        high: Math.max(open, close),
        low: Math.min(open, close),
        open,
        timestamp: new Date(point.t * 1000).toISOString(),
        volume: null,
      };
    });
}

function buildSnapshotCandles(market: Awaited<ReturnType<typeof getMarket>>) {
  if (!market) return [];

  const bestBid = parseProbability(market.bestBid);
  const bestAsk = parseProbability(market.bestAsk);
  const lastTrade = parseProbability(market.lastTradePrice);
  const midpoint = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const close = lastTrade ?? midpoint ?? bestAsk ?? bestBid;

  if (close === null) {
    return [];
  }

  const open = midpoint ?? close;
  const high = Math.max(open, close, bestAsk ?? close);
  const low = Math.min(open, close, bestBid ?? close);
  const timestamp = market.syncedAt ?? new Date().toISOString();

  return [
    {
      close: clampProbability(close),
      high: clampProbability(high),
      low: clampProbability(low),
      open: clampProbability(open),
      timestamp,
      volume: null,
    },
  ];
}

function parseProbability(value: string | null | undefined) {
  if (!value) return null;
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue <= 1 ? numericValue * 100 : numericValue;
}

function clampProbability(value: number) {
  return Math.max(0.1, Math.min(99.9, value));
}
