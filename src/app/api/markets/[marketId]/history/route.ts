import { NextRequest, NextResponse } from "next/server";

import { getCoreApiUrl } from "../../../../../lib/core-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ marketId: string }>;
};

const supportedRanges = new Set(["1h", "1w", "1m", "1y"]);

export async function GET(request: NextRequest, context: RouteContext) {
  const { marketId } = await context.params;
  const rangeValue = request.nextUrl.searchParams.get("range") ?? "1w";
  const range = supportedRanges.has(rangeValue) ? rangeValue : "1w";
  const url = new URL("/markets/" + encodeURIComponent(marketId) + "/history", getCoreApiUrl());

  url.searchParams.set("range", range);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await response.json();

    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MARKET_HISTORY_UNAVAILABLE",
          message: "Core market history is unavailable right now.",
        },
      },
      { status: 502 },
    );
  }
}
