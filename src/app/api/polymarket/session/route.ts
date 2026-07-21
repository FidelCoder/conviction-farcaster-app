import { NextResponse } from "next/server";

import {
  CoreApiError,
  completePolymarketAuth,
  createPolymarketAuthChallenge,
} from "../../../../lib/core-api";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const signaturePattern = /^0x[a-fA-F0-9]{130,}$/;

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const action = stringField(body, "action");

  try {
    if (action === "challenge") {
      if (!hasOnlyKeys(body, ["action", "ownerAddress"])) {
        return validationError("Only the Polymarket owner address is accepted.");
      }

      const ownerAddress = stringField(body, "ownerAddress");

      if (!evmAddressPattern.test(ownerAddress)) {
        return validationError("A valid Polymarket owner wallet is required.");
      }

      const challenge = await createPolymarketAuthChallenge(ownerAddress);
      return NextResponse.json({ ok: true, data: { challenge } }, { status: 201 });
    }

    if (action === "complete") {
      if (!hasOnlyKeys(body, ["action", "challengeId", "signature"])) {
        return validationError("Only the challenge and wallet signature are accepted.");
      }

      const challengeId = stringField(body, "challengeId");
      const signature = stringField(body, "signature");

      if (!challengeId || challengeId.length > 128 || !signaturePattern.test(signature)) {
        return validationError("A valid challenge and wallet signature are required.");
      }

      const authentication = await completePolymarketAuth({ challengeId, signature });
      return NextResponse.json({ ok: true, data: authentication }, { status: 201 });
    }

    return validationError("Choose a supported Polymarket sign-in action.");
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
          code: "POLYMARKET_AUTH_FAILED",
          message: "Polymarket sign-in is unavailable right now.",
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

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_POLYMARKET_AUTH_REQUEST", message } },
    { status: 422 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
