import { NextResponse } from "next/server";

import { CoreApiError, createTelegramSession } from "../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const telegramUserId = stringField(body, "telegramUserId");
  const username = optionalStringField(body, "username");
  const displayName = optionalStringField(body, "displayName");
  const profileUrl = optionalStringField(body, "profileUrl");

  if (!telegramUserId) return validationError("Telegram user id is required.");

  try {
    const session = await createTelegramSession({ telegramUserId, username, displayName, profileUrl });
    return NextResponse.json({ ok: true, data: { session } }, { status: 201 });
  } catch (error) {
    return apiError(error, "TELEGRAM_SESSION_FAILED", "Core API did not accept the Telegram session.");
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_TELEGRAM_SESSION", message } }, { status: 422 });
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }
  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
