import { NextRequest, NextResponse } from "next/server";

import {
  CoreApiError,
  advancePolymarketExecution,
  authorizePolymarketMarginExecution,
  authorizePolymarketPositionClose,
  getPolymarketMarginExecution,
  getPolymarketPositionControls,
  listPolymarketCloseAttempts,
  preparePolymarketMarginExecution,
  preparePolymarketPositionClose,
  preparePolymarketPositionControls,
  preparePolymarketPrincipalRepayment,
  recordPolymarketReservation,
  recordPolymarketWalletCommit,
  recordPolymarketPrincipalRepayment,
  updatePolymarketPositionControls,
} from "../../../lib/core-api";

export async function GET(request: NextRequest) {
  const positionId = request.nextUrl.searchParams.get("positionId")?.trim();
  const userId = request.nextUrl.searchParams.get("userId")?.trim();

  if (!positionId || !userId) return validationError("Position and signed-in user are required.");

  try {
    const [execution, closeAttempts, controls] = await Promise.all([
      getPolymarketMarginExecution(positionId, userId),
      listPolymarketCloseAttempts(positionId, userId),
      getPolymarketPositionControls(positionId, userId),
    ]);
    return NextResponse.json({ ok: true, data: { execution, closeAttempts, controls } });
  } catch (error) {
    return coreError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const action = text(body.action);
  const positionId = text(body.positionId);
  const executionId = text(body.executionId);
  const userId = text(body.userId);

  if (!userId) return validationError("A signed-in Conviction user is required.");

  try {
    if (action === "prepare-open" && positionId) {
      const prepared = await preparePolymarketMarginExecution(
        positionId,
        prepareInput(body, userId),
      );
      return NextResponse.json({ ok: true, data: { prepared } });
    }
    if (action === "authorize-open" && positionId) {
      const prepared = authorizationInput(body, userId);
      const execution = await authorizePolymarketMarginExecution(positionId, prepared);
      return NextResponse.json({ ok: true, data: { execution } }, { status: 201 });
    }
    if (action === "reservation" && executionId) {
      const execution = await recordPolymarketReservation(executionId, {
        userId,
        transactionHash: requiredText(body, "transactionHash"),
      });
      return NextResponse.json({ ok: true, data: { execution } });
    }
    if (action === "wallet-commit" && executionId) {
      const execution = await recordPolymarketWalletCommit(executionId, {
        userId,
        transactionHash: requiredText(body, "transactionHash"),
      });
      return NextResponse.json({ ok: true, data: { execution } });
    }
    if (action === "advance" && executionId) {
      const execution = await advancePolymarketExecution(executionId, userId);
      return NextResponse.json({ ok: true, data: { execution } }, { status: 202 });
    }
    if (action === "prepare-close" && positionId) {
      const prepared = await preparePolymarketPositionClose(positionId, prepareInput(body, userId));
      return NextResponse.json({ ok: true, data: { prepared } });
    }
    if (action === "authorize-close" && positionId) {
      const base = prepareInput(body, userId);
      const closeAttempt = await authorizePolymarketPositionClose(positionId, {
        ...base,
        minimumProceeds: requiredText(body, "minimumProceeds"),
        priceLimit: requiredText(body, "priceLimit"),
        signature: requiredText(body, "signature"),
      });
      return NextResponse.json({ ok: true, data: { closeAttempt } }, { status: 201 });
    }
    if (action === "prepare-controls" && positionId) {
      const prepared = await preparePolymarketPositionControls(positionId, {
        userId,
        stopLossPrice: nullableText(body.stopLossPrice),
        takeProfitPrice: nullableText(body.takeProfitPrice),
        nonce: requiredText(body, "nonce"),
        deadline: requiredInteger(body, "deadline"),
      });
      return NextResponse.json({ ok: true, data: { prepared } });
    }
    if (action === "authorize-controls" && positionId) {
      const controls = await updatePolymarketPositionControls(positionId, {
        userId,
        stopLossPrice: nullableText(body.stopLossPrice),
        takeProfitPrice: nullableText(body.takeProfitPrice),
        nonce: requiredText(body, "nonce"),
        deadline: requiredInteger(body, "deadline"),
        signature: requiredText(body, "signature"),
      });
      return NextResponse.json({ ok: true, data: { controls } });
    }
    if (action === "prepare-repayment" && positionId) {
      const prepared = await preparePolymarketPrincipalRepayment(positionId, {
        userId,
        assets: requiredText(body, "assets"),
      });
      return NextResponse.json({ ok: true, data: { prepared } });
    }
    if (action === "repayment" && executionId) {
      const controls = await recordPolymarketPrincipalRepayment(executionId, {
        userId,
        assets: requiredText(body, "assets"),
        transactionHash: requiredText(body, "transactionHash"),
      });
      return NextResponse.json({ ok: true, data: { controls } });
    }
    return validationError("Unsupported execution action or missing identifier.");
  } catch (error) {
    return coreError(error);
  }
}

function prepareInput(body: Record<string, unknown>, userId: string) {
  return {
    userId,
    idempotencyKey: requiredText(body, "idempotencyKey"),
    nonce: requiredText(body, "nonce"),
    deadline: requiredInteger(body, "deadline"),
    maxSlippageBps: requiredInteger(body, "maxSlippageBps"),
  };
}

function authorizationInput(body: Record<string, unknown>, userId: string) {
  return {
    ...prepareInput(body, userId),
    quoteId: requiredText(body, "quoteId"),
    borrowAssets: requiredText(body, "borrowAssets"),
    minimumOutcomeShares: requiredText(body, "minimumOutcomeShares"),
    financingFeeAssets: requiredText(body, "financingFeeAssets"),
    priceLimit: requiredText(body, "priceLimit"),
    signature: requiredText(body, "signature"),
  };
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function requiredText(body: Record<string, unknown>, key: string) {
  const value = text(body[key]);
  if (!value) throw new Error(key + " is required.");
  return value;
}

function requiredInteger(body: Record<string, unknown>, key: string) {
  const value = Number(body[key]);
  if (!Number.isInteger(value) || value < 0) throw new Error(key + " must be an integer.");
  return value;
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_POLYMARKET_EXECUTION_REQUEST", message } },
    { status: 422 },
  );
}

function coreError(error: unknown) {
  if (error instanceof CoreApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "POLYMARKET_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Execution request failed.",
      },
    },
    { status: 502 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
