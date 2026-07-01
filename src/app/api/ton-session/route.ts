import { NextResponse } from "next/server";

import { CoreApiError, createTonWalletSession } from "../../../lib/core-api";

const tonAddressPattern = /^(?:EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46,}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const tonAddress = stringField(body, "tonAddress");
  const displayName = optionalStringField(body, "displayName");

  if (!tonAddressPattern.test(tonAddress)) return validationError("A valid TON wallet address is required.");

  try {
    const session = await createTonWalletSession({ tonAddress, displayName });
    return NextResponse.json({ ok: true, data: { session } }, { status: 201 });
  } catch (error) {
    return apiError(error, "TON_SESSION_FAILED", "Core API did not accept the TON wallet session.");
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_TON_SESSION", message } }, { status: 422 });
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
