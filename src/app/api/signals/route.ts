import { NextResponse } from "next/server";

import { CoreApiError, createTradeSignal } from "../../../lib/core-api";

const signalSides = new Set(["YES", "NO"]);

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const traderProfileId = stringField(body, "traderProfileId");
  const marketId = stringField(body, "marketId");
  const side = stringField(body, "side");
  const thesis = stringField(body, "thesis");
  const convictionLevel = optionalInteger(body.convictionLevel);

  if (!traderProfileId || !marketId || !side || !thesis) {
    return validationError("Trader profile, market, side, and thesis are required.");
  }

  if (!signalSides.has(side)) {
    return validationError("Side must be YES or NO.");
  }

  if (thesis.length > 5000) {
    return validationError("Thesis must be 5000 characters or less.");
  }

  if (
    convictionLevel !== null &&
    (!Number.isInteger(convictionLevel) || convictionLevel < 1 || convictionLevel > 100)
  ) {
    return validationError("Conviction level must be between 1 and 100.");
  }

  try {
    const signal = await createTradeSignal({
      traderProfileId,
      marketId,
      side: side as "YES" | "NO",
      thesis,
      convictionLevel,
      source: "FARCASTER",
    });

    return NextResponse.json({ ok: true, data: { signal } }, { status: 201 });
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
          code: "SIGNAL_CREATE_FAILED",
          message: "Core API did not accept the signal.",
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
        code: "INVALID_SIGNAL",
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

function optionalInteger(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
