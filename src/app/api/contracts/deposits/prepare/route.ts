import { NextResponse } from "next/server";

import { CoreApiError, prepareCollateralDepositContractCall } from "../../../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const positionId = stringField(body, "positionId");

  if (!positionId) {
    return validationError("positionId is required.");
  }

  try {
    const prepared = await prepareCollateralDepositContractCall({ positionId });

    return NextResponse.json({ ok: true, data: prepared }, { status: 201 });
  } catch (error) {
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
          code: "COLLATERAL_DEPOSIT_PREPARE_FAILED",
          message: "Core API could not prepare the collateral deposit.",
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
    { ok: false, error: { code: "INVALID_COLLATERAL_DEPOSIT_PREPARE", message } },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
