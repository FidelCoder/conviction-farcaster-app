import { NextResponse } from "next/server";

import {
  addSignalBookmark,
  CoreApiError,
  removeSignalBookmark,
} from "../../../../../../lib/core-api";

type RouteContext = {
  params: Promise<{ signalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await parseBody(request);
  const { signalId } = await context.params;

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const userId = stringField(body, "userId");

  if (!userId) {
    return validationError("User is required.");
  }

  try {
    const result = await addSignalBookmark({ signalId, userId });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    return socialActionError(error, "SIGNAL_BOOKMARK_FAILED", "Core API did not accept the bookmark.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const body = await parseBody(request);
  const { signalId } = await context.params;

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const userId = stringField(body, "userId");

  if (!userId) {
    return validationError("User is required.");
  }

  try {
    const result = await removeSignalBookmark({ signalId, userId });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return socialActionError(error, "SIGNAL_BOOKMARK_REMOVE_FAILED", "Core API did not remove the bookmark.");
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
    { ok: false, error: { code: "INVALID_SIGNAL_BOOKMARK", message } },
    { status: 422 },
  );
}

function socialActionError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
