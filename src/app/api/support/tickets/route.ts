import { NextResponse } from "next/server";

import { CoreApiError, createSupportTicket, listSupportTickets } from "../../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const tickets = await listSupportTickets({
      userId: url.searchParams.get("userId"),
      email: url.searchParams.get("email"),
      limit: normalizeLimit(url.searchParams.get("limit")),
    });
    return NextResponse.json({ ok: true, data: { tickets } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ ok: false, error: { code: "SUPPORT_TICKETS_FAILED", message: "Core API did not return support tickets." } }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_SUPPORT_TICKET", message: "Request body must be a JSON object." } }, { status: 422 });
  }

  const email = stringField(body, "email");
  const subject = stringField(body, "subject");
  const summary = stringField(body, "summary");

  if (!email.includes("@") || !subject || !summary) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_SUPPORT_TICKET", message: "Email, subject, and summary are required." } }, { status: 422 });
  }

  const ticket = await createSupportTicket({
    userId: stringField(body, "userId") || null,
    wallet: stringField(body, "wallet") || null,
    email,
    subject,
    summary,
    transcript: stringField(body, "transcript") || null,
  });

  return NextResponse.json({ ok: true, data: { ticket } }, { status: 201 });
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

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 25;
}
