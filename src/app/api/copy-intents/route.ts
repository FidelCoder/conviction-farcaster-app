import { NextResponse } from "next/server";

import { CoreApiError, createCopyIntent } from "../../../lib/core-api";

const positiveDecimalInputPattern = /^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const followerId = stringField(body, "followerId");
  const sourcePositionId = stringField(body, "sourcePositionId");
  const requestedQuantity = stringField(body, "requestedQuantity");
  const sourceSignalId = optionalStringField(body, "sourceSignalId");

  if (!followerId || !sourcePositionId || !requestedQuantity) {
    return validationError("Follower, source position, and amount are required.");
  }

  if (!positiveDecimalInputPattern.test(requestedQuantity)) {
    return validationError("Amount must be greater than zero with up to 8 decimals.");
  }

  try {
    const copyIntent = await createCopyIntent({
      followerId,
      sourcePositionId,
      requestedQuantity,
      sourceSignalId,
    });

    return NextResponse.json({ ok: true, data: { copyIntent } }, { status: 201 });
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
          code: "CORE_API_UNAVAILABLE",
          message: "Core API did not accept the copy intent.",
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
        code: "INVALID_COPY_INTENT",
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

function optionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
