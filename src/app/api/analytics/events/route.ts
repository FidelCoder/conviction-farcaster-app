import { NextResponse } from "next/server";

import {
  CoreApiError,
  recordUsageEvent,
  type AuthProvider,
  type UsageEventType,
} from "../../../../lib/core-api";

const usageEventTypes: UsageEventType[] = [
  "PAGE_VIEW",
  "HEARTBEAT",
  "AUTH_CONNECT",
  "AUTH_DISCONNECT",
  "PROFILE_CLAIM",
  "MARKET_VIEW",
  "MARKET_OPEN_MARGIN",
  "MARGIN_REQUEST",
  "VAULT_DEPOSIT",
  "PULSE_POST",
  "PULSE_SIGNAL",
  "PULSE_FOLLOW",
  "SUPPORT_OPEN",
  "MINIAPP_OPEN",
];

const authProviders: AuthProvider[] = [
  "EVM_EOA",
  "POLYMARKET_WALLET",
  "THIRDWEB_SMART_WALLET",
  "TON_WALLET",
  "TELEGRAM",
  "FARCASTER",
  "UNKNOWN",
];

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const clientSessionId = stringField(body, "clientSessionId");
  const type = stringField(body, "type") as UsageEventType;

  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(clientSessionId)) {
    return validationError("A valid analytics session id is required.");
  }

  if (!usageEventTypes.includes(type)) {
    return validationError("A valid analytics event type is required.");
  }

  const authProvider = stringField(body, "authProvider") as AuthProvider;

  try {
    const result = await recordUsageEvent({
      area: optionalStringField(body, "area"),
      authProvider: authProviders.includes(authProvider) ? authProvider : "UNKNOWN",
      clientSessionId,
      label: optionalStringField(body, "label"),
      metadata: objectField(body, "metadata"),
      path: optionalStringField(body, "path"),
      referrer: optionalStringField(body, "referrer"),
      socialAccountId: optionalStringField(body, "socialAccountId"),
      source: optionalStringField(body, "source"),
      type,
      userId: optionalStringField(body, "userId"),
      value: numberField(body, "value"),
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ANALYTICS_EVENT_FAILED",
          message: "Core API did not accept the analytics event.",
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
    { ok: false, error: { code: "INVALID_ANALYTICS_EVENT", message } },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function objectField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
