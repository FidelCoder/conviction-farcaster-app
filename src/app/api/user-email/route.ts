import { NextResponse } from "next/server";

import { CoreApiError, createBrowserWalletSession, updateUserEmail } from "../../../lib/core-api";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export async function PATCH(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const walletAddress = stringField(body, "walletAddress");
  const email = stringField(body, "email");

  if (!evmAddressPattern.test(walletAddress)) {
    return validationError("Connect a valid EVM wallet before updating email.");
  }

  if (!email || !email.includes("@")) {
    return validationError("A valid email address is required.");
  }

  try {
    const session = await createBrowserWalletSession({ walletAddress });
    const result = await updateUserEmail(session.user.id, email);
    const nextSession = { ...session, user: { ...session.user, email: result.email } };

    return NextResponse.json({ ok: true, data: { email: result.email, session: nextSession } });
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
          code: "EMAIL_UPDATE_FAILED",
          message: "Core API did not accept the wallet email update.",
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
    { ok: false, error: { code: "INVALID_EMAIL_UPDATE", message } },
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
