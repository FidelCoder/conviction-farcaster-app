import { NextResponse } from "next/server";

import { CoreApiError, createFarcasterSession, upsertTraderProfile } from "../../../lib/core-api";

type FarcasterSessionBody = {
  fid?: unknown;
  username?: unknown;
  displayName?: unknown;
  pfpUrl?: unknown;
};

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const fid = parseFid(body.fid);

  if (!fid) {
    return validationError("A valid Farcaster fid is required.");
  }

  try {
    const session = await createFarcasterSession({
      fid,
      username: optionalString(body.username),
      displayName: optionalString(body.displayName),
      pfpUrl: optionalString(body.pfpUrl),
    });
    const traderProfile =
      session.traderProfile ??
      (await upsertTraderProfile({
        userId: session.user.id,
        handle: buildStableTraderHandle(fid),
        bio: null,
      }));

    return NextResponse.json(
      { ok: true, data: { session: { ...session, traderProfile } } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "FARCASTER_SESSION_FAILED",
          message: "Core API did not accept the Farcaster session.",
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
    {
      ok: false,
      error: {
        code: "INVALID_FARCASTER_SESSION",
        message,
      },
    },
    { status: 422 },
  );
}

function parseFid(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is FarcasterSessionBody {
  return typeof value === "object" && value !== null;
}

function buildStableTraderHandle(fid: number) {
  return "fc-" + String(fid).slice(0, 29);
}
