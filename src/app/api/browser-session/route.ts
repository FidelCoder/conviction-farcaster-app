import { NextResponse } from "next/server";

import {
  CoreApiError,
  createBrowserWalletSession,
  upsertTraderProfile,
} from "../../../lib/core-api";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const walletAddress = stringField(body, "walletAddress");

  if (!evmAddressPattern.test(walletAddress)) {
    return validationError("A valid EVM wallet address is required.");
  }

  try {
    const session = await createBrowserWalletSession({ walletAddress });
    const traderProfile =
      session.traderProfile ??
      (await upsertTraderProfile({
        userId: session.user.id,
        handle: buildWalletHandle(walletAddress),
        bio: null,
      }));

    return NextResponse.json(
      { ok: true, data: { session: { ...session, traderProfile } } },
      { status: 201 },
    );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildWalletHandle(walletAddress: string) {
  return (
    "wallet" +
    walletAddress.slice(2, 8).toLowerCase() +
    walletAddress.slice(-4).toLowerCase() +
    ".viction"
  );
}
