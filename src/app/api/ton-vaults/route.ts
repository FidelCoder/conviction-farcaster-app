import { NextResponse } from "next/server";

import { CoreApiError, createTonVaultIntent, getTonVaultSummary, listTonVaultIntents } from "../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || undefined;
  const tonAddress = url.searchParams.get("tonAddress")?.trim() || undefined;
  const limit = normalizeLimit(url.searchParams.get("limit"));

  try {
    const [summary, intents] = await Promise.all([
      getTonVaultSummary(),
      listTonVaultIntents({ userId, tonAddress, limit }),
    ]);
    return NextResponse.json({ ok: true, data: { summary, intents } });
  } catch (error) {
    return apiError(error, "TON_VAULTS_FAILED", "Core API did not return TON vault records.");
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const userId = optionalStringField(body, "userId");
  const telegramUserId = optionalStringField(body, "telegramUserId");
  const tonAddress = stringField(body, "tonAddress");
  const asset = stringField(body, "asset");
  const amount = stringField(body, "amount");
  const note = optionalStringField(body, "note");

  if (!tonAddress || !asset || !amount) return validationError("TON address, asset, and amount are required.");

  try {
    const intent = await createTonVaultIntent({ userId, telegramUserId, tonAddress, asset, amount, note });
    return NextResponse.json({ ok: true, data: { intent } }, { status: 201 });
  } catch (error) {
    return apiError(error, "TON_VAULT_INTENT_FAILED", "Core API did not accept the TON vault intent.");
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 25;
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_TON_VAULT_INTENT", message } }, { status: 422 });
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
