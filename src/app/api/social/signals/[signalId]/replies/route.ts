import { NextResponse } from "next/server";

import { CoreApiError, createSignalReply } from "../../../../../../lib/core-api";

type RouteContext = {
  params: Promise<{ signalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await parseBody(request);
  const { signalId } = await context.params;

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const authorUserId = stringField(body, "authorUserId");
  const replyBody = stringField(body, "body");

  if (!authorUserId || !replyBody) {
    return validationError("User and reply body are required.");
  }

  if (replyBody.length > 1000) {
    return validationError("Reply must be 1000 characters or less.");
  }

  try {
    const reply = await createSignalReply({
      signalId,
      authorUserId,
      body: replyBody,
    });

    return NextResponse.json({ ok: true, data: { reply } }, { status: 201 });
  } catch (error) {
    return socialActionError(error, "SIGNAL_REPLY_FAILED", "Core API did not accept the reply.");
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
    { ok: false, error: { code: "INVALID_SIGNAL_REPLY", message } },
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
