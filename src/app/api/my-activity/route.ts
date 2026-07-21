import { NextRequest, NextResponse } from "next/server";

import {
  CoreApiError,
  getPolymarketMarginExecution,
  getPolymarketPositionControls,
  listMarkets,
  listPolymarketCloseAttempts,
  listTraderSignals,
  listUserCopyIntents,
  listUserPositions,
} from "../../../lib/core-api";

type MyActivityBody = {
  traderProfileId?: unknown;
  userId?: unknown;
};

export async function POST(request: NextRequest) {
  let body: MyActivityBody;

  try {
    body = (await request.json()) as MyActivityBody;
  } catch {
    return validationError("Request body must be valid JSON.");
  }

  const userId = normalizeRequiredString(body.userId);
  const traderProfileId = normalizeOptionalString(body.traderProfileId);

  if (!userId) {
    return validationError("A real core user id is required.");
  }

  try {
    const [markets, signals, positions, copyIntents] = await Promise.all([
      listMarkets(),
      traderProfileId ? listTraderSignals(traderProfileId) : Promise.resolve([]),
      listUserPositions(userId),
      listUserCopyIntents(userId),
    ]);
    const marketIds = new Set([
      ...signals.map((signal) => signal.marketId),
      ...positions.map((position) => position.marketId),
    ]);
    const marketMap = Object.fromEntries(
      markets.filter((market) => marketIds.has(market.id)).map((market) => [market.id, market]),
    );
    const polymarketExecutions = Object.fromEntries(
      await Promise.all(
        positions
          .filter((position) => position.chainId === 137 && position.executionMode === "MARGIN")
          .map(async (position) => {
            try {
              const [execution, closeAttempts, controls] = await Promise.all([
                getPolymarketMarginExecution(position.id, userId),
                listPolymarketCloseAttempts(position.id, userId),
                getPolymarketPositionControls(position.id, userId),
              ]);
              return [position.id, { closeAttempts, controls, execution }] as const;
            } catch (error) {
              if (error instanceof CoreApiError && error.statusCode === 404) {
                return [position.id, null] as const;
              }
              throw error;
            }
          }),
      ),
    );

    return NextResponse.json({
      ok: true,
      data: {
        signals,
        positions,
        copyIntents,
        markets: marketMap,
        polymarketExecutions,
      },
    });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MY_ACTIVITY_FAILED",
          message: "Core API did not return Farcaster activity records.",
        },
      },
      { status: 502 },
    );
  }
}

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validationError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_MY_ACTIVITY_REQUEST",
        message,
      },
    },
    { status: 400 },
  );
}
