import { NextResponse } from "next/server";

import {
  CoreApiError,
  createBrowserWalletSession,
  upsertTraderProfile,
} from "../../../lib/core-api";
import {
  buildVictionHandle,
  isClaimedVictionHandle,
  normalizeVictionHandle,
} from "../../../lib/viction-profile";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const walletAddress = stringField(body, "walletAddress");
  const handle = buildVictionHandle(normalizeVictionHandle(stringField(body, "handle")));
  const bio = optionalString(body.bio);
  const avatarUrl = optionalString(body.avatarUrl);

  if (!evmAddressPattern.test(walletAddress)) {
    return validationError("Connect a valid EVM wallet before updating a profile.");
  }

  if (!isClaimedVictionHandle(handle)) {
    return validationError("Choose a unique .viction handle that is not a generated wallet or trader fallback.");
  }

  try {
    const session = await createBrowserWalletSession({ walletAddress });
    const traderProfile = await upsertTraderProfile({
      userId: session.user.id,
      handle,
      bio,
      avatarUrl,
    });

    return NextResponse.json(
      { ok: true, data: { session: { ...session, traderProfile }, traderProfile } },
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
          code: "TRADER_PROFILE_FAILED",
          message: "Core API did not accept the wallet profile update.",
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
    { ok: false, error: { code: "INVALID_TRADER_PROFILE", message } },
    { status: 422 },
  );
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
