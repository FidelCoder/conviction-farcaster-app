import { NextResponse } from "next/server";

import { CoreApiError, createSupportReply } from "../../../../../../lib/core-api";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_SUPPORT_REPLY", message: "Request body must be a JSON object." } }, { status: 422 });
  }

  const text = stringField(body, "body");

  if (!text) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_SUPPORT_REPLY", message: "Reply body is required." } }, { status: 422 });
  }

  try {
    const result = await createSupportReply({
      ticketId,
      userId: stringField(body, "userId") || null,
      subject: stringField(body, "subject") || null,
      body: text,
    });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ ok: false, error: { code: "SUPPORT_REPLY_FAILED", message: "Core API did not save the support reply." } }, { status: 502 });
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
