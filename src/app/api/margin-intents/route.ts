import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  CoreApiError,
  createMarginPositionIntent,
  startPositionExecution,
} from "../../../lib/core-api";

const positiveDecimalPattern = /^(?=.*[1-9])(?:0|[1-9]d*)(?:.d{1,8})?$/;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const userId = stringField(body, "userId");
  const marketId = stringField(body, "marketId");
  const side = stringField(body, "side");
  const quantity = stringField(body, "quantity");
  const marginCollateral = stringField(body, "marginCollateral");
  const leverageMultiplier = stringField(body, "leverageMultiplier");
  const walletAddress = stringField(body, "walletAddress");
  const chainId = numberField(body, "chainId");

  if (!userId || !marketId || !side || !quantity || !marginCollateral || !leverageMultiplier) {
    return validationError("User, market, side, size, margin, and leverage are required.");
  }

  if (side !== "YES" && side !== "NO") {
    return validationError("Side must be YES or NO.");
  }

  if (!positiveDecimalPattern.test(quantity)) {
    return validationError("Requested size must be greater than zero with up to 8 decimals.");
  }

  if (!positiveDecimalPattern.test(marginCollateral)) {
    return validationError("Margin collateral must be greater than zero with up to 8 decimals.");
  }

  if (!positiveDecimalPattern.test(leverageMultiplier) || Number(leverageMultiplier) <= 1) {
    return validationError("Margin leverage must be greater than 1.");
  }

  if (!chainId) {
    return validationError("Execution chain is required.");
  }

  if (!evmAddressPattern.test(walletAddress)) {
    return validationError("A valid EVM wallet address is required.");
  }

  try {
    const position = await createMarginPositionIntent({
      userId,
      marketId,
      side,
      quantity,
      chainId,
      walletAddress,
      leverageMultiplier,
      marginCollateral,
      idempotencyKey: "farcaster-margin-" + randomUUID(),
    });
    const executionAttempt = await startPositionExecution(position.id);

    return NextResponse.json(
      {
        ok: true,
        data: {
          position,
          executionAttempt,
        },
      },
      { status: 202 },
    );
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
          code: "MARGIN_INTENT_FAILED",
          message: "Core API did not accept the margin intent.",
        },
      },
      { status: 502 },
    );
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function validationError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_MARGIN_INTENT",
        message,
      },
    },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
