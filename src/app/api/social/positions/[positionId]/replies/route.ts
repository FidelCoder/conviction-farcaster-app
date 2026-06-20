import { NextResponse } from "next/server";

import { CoreApiError, createPositionReply } from "../../../../../../lib/core-api";

type RouteContext = { params: Promise<{ positionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const body = await parseBody(request);
  const { positionId } = await context.params;

  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const authorUserId = stringField(body, "authorUserId");
  const text = stringField(body, "body");
  if (!authorUserId || !text) return validationError("Author and comment are required.");

  try {
    const reply = await createPositionReply({ positionId, authorUserId, body: text });
    return NextResponse.json({ ok: true, data: { reply } }, { status: 201 });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ ok: false, error: { code: "POSITION_REPLY_FAILED", message: "Core API did not accept the trade comment." } }, { status: 502 });
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_POSITION_REPLY", message } }, { status: 422 });
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
