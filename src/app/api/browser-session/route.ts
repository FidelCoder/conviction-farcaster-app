import { NextResponse } from "next/server";

import { CoreApiError, createBrowserWalletSession } from "../../../lib/core-api";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const walletAddress = stringField(body, "walletAddress");
  const authProvider = optionalStringField(body, "authProvider");
  const source = optionalStringField(body, "source");

  if (!evmAddressPattern.test(walletAddress)) {
    return validationError("A valid EVM wallet address is required.");
  }

  try {
    const session = await createBrowserWalletSession({
      walletAddress,
      authProvider: authProvider === "THIRDWEB_SMART_WALLET" ? "THIRDWEB_SMART_WALLET" : "EVM_EOA",
      source: source ?? "WEB_APP",
    });

    return NextResponse.json({ ok: true, data: { session } }, { status: 201 });
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
          code: "BROWSER_SESSION_FAILED",
          message: "Core API did not accept the browser wallet session.",
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
    { ok: false, error: { code: "INVALID_BROWSER_SESSION", message } },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
